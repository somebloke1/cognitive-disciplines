/**
 * Unit tests for phronesis.ts — multi-agent cognitional cycle orchestration.
 *
 * Uses an in-memory SQLite database (`:memory:`) for isolation.
 * Tests cover cycle initiation, role ack, grounding, submit, recurse, and abort.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA, runMigrations } from '../../src/db.js';
import { createPhronesisHandlers } from '../../src/phronesis.js';
import { createLifecycleHandlers } from '../../src/lifecycle.js';
import { createMockLogger } from '@noetic-pi/shared/testing';
import type { APMContext } from '@noetic-pi/shared';
import { defaultConfig } from '@noetic-pi/shared';
import type { PhronesisHandlers } from '../../src/phronesis.js';

const TEST_CWD = '/tmp/test-phronesis-unit';
const REAL_CURRICULUM_PATH = path.resolve(__dirname, '../../../../.method/curricula/differentiated-cognition.json');

// =============================================================================
// Test Helpers
// =============================================================================

function createMockContext(db: Database.Database): APMContext {
  const log = createMockLogger();
  return {
    db, cwd: TEST_CWD, config: defaultConfig, recordEvent: vi.fn(), emitSignal: vi.fn(),
    runTransaction: <T>(fn: () => T): T => db.transaction(fn).immediate(),
    notifyRole: vi.fn(),
    notifyAgent: vi.fn(),
    handleSpawn: vi.fn().mockReturnValue({ success: true, agentId: 'agent-spawned', ptyPid: 1234 }),
    assemblePhronesisPrompt: vi.fn().mockReturnValue('test prompt'),
    loadPromptFragment: vi.fn().mockReturnValue(''),
    captureSnapshot: vi.fn(), log,
  };
}

/** Insert a phronesis_state row directly for testing internal handlers. */
function insertCycleState(
  db: Database.Database,
  id: string,
  overrides: Record<string, unknown> = {}
) {
  const defaults = {
    operation: 'p1' as string | null,
    sub_phase: 'grounding' as string | null,
    status: 'active',
    mode: 'recommend-only',
    task: 'Test task',
    initiator_id: null,
    current_agent_id: null,
    current_pty_pid: null,
    parent_cycle_id: null,
    recursion_count: 0,
    recursion_limit: 5,
    models: JSON.stringify({ p1: 'claude-opus-4-6', p2: 'claude-sonnet-4-6', p3: 'claude-opus-4-6', p4: 'claude-sonnet-4-6' }),
    providers: '{}',
    timestamps: JSON.stringify({ initiated: new Date().toISOString() }),
    updated_at: new Date().toISOString(),
    p1_agent_id: null,
    p2_agent_id: null,
    p3_agent_id: null,
    p4_agent_id: null,
    grounding_stage: 0,
  };
  const merged = { ...defaults, ...overrides };
  db.prepare(
    `INSERT INTO phronesis_state
       (id, operation, sub_phase, status, mode, task, initiator_id, current_agent_id, current_pty_pid,
        parent_cycle_id, recursion_count, recursion_limit, models, providers,
        timestamps, updated_at, p1_agent_id, p2_agent_id, p3_agent_id, p4_agent_id, grounding_stage)
     VALUES
       (:id, :operation, :sub_phase, :status, :mode, :task, :initiator_id, :current_agent_id, :current_pty_pid,
        :parent_cycle_id, :recursion_count, :recursion_limit, :models, :providers,
        :timestamps, :updated_at, :p1_agent_id, :p2_agent_id, :p3_agent_id, :p4_agent_id, :grounding_stage)`
  ).run({ id, ...merged });
}

/** Insert a phronesis_content row directly for testing. */
function insertContent(
  db: Database.Database,
  cycleId: string,
  phase: string,
  pass: number,
  payload: string,
  agentId: string | null = null
) {
  db.prepare(
    `INSERT INTO phronesis_content (cycle_id, phase, pass, agent_id, payload, feedback, timestamp)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`
  ).run(cycleId, phase, pass, agentId, payload, new Date().toISOString());
}

/** Helper to advance a cycle through full grounding (role_ack + 2 grounding_complete calls). */
function advanceThroughGrounding(
  handlers: PhronesisHandlers,
  cycleId: string,
  operation: 'p1' | 'p2' | 'p3' | 'p4'
) {
  // Stage 1 is delivered by role_ack
  handlers.handlePhronesisRoleAck({ cycleId, operation });
  // Stage 1 → Stage 2
  handlers.handlePhronesisGroundingComplete({ cycleId, operation });
  // Stage 2 → Stage 3
  handlers.handlePhronesisGroundingComplete({ cycleId, operation });
  // Stage 3 → active
  handlers.handlePhronesisGroundingComplete({ cycleId, operation });
}

// =============================================================================
// Tests
// =============================================================================

describe('phronesis.ts', () => {
  let db: Database.Database;
  let ctx: APMContext;
  let handlers: PhronesisHandlers;

  // Set up curriculum fixture at test cwd
  beforeAll(() => {
    const curriculaDir = path.join(TEST_CWD, '.method', 'curricula');
    fs.mkdirSync(curriculaDir, { recursive: true });
    fs.copyFileSync(REAL_CURRICULUM_PATH, path.join(curriculaDir, 'differentiated-cognition.json'));
  });

  afterAll(() => {
    fs.rmSync(TEST_CWD, { recursive: true, force: true });
  });

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
    runMigrations(db);
    ctx = createMockContext(db);
    const lifecycle = createLifecycleHandlers(ctx);
    handlers = createPhronesisHandlers(ctx, { lifecycle, routing: { notifyInitiator: vi.fn().mockResolvedValue(true) } });
  });

  // ===========================================================================
  // handlePhronesisInitiate
  // ===========================================================================

  describe('handlePhronesisInitiate', () => {
    it('creates cycle state with correct phase and mode', async () => {
      const result = await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-001',
        task: 'Analyze architecture',
        mode: 'recommend-only',
      });

      expect(result.success).toBe(true);
      expect(result.cycleId).toBe('cycle-001');
      expect(result.phase).toBe('p1:grounding');

      const row = db.prepare('SELECT * FROM phronesis_state WHERE id = ?').get('cycle-001') as
        Record<string, unknown> | undefined;
      expect(row).toBeDefined();
      expect(row!.operation).toBe('p1');
      expect(row!.sub_phase).toBe('grounding');
      expect(row!.status).toBe('active');
      expect(row!.mode).toBe('recommend-only');
      expect(row!.task).toBe('Analyze architecture');
    });

    it('rejects missing required fields (no cycleId)', async () => {
      const result = await handlers.handlePhronesisInitiate({
        cycleId: '',
        task: 'Some task',
        mode: 'recommend-only',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/missing required fields/i);
    });

    it('rejects invalid mode', async () => {
      const result = await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-002',
        task: 'Some task',
        mode: 'invalid-mode' as 'recommend-only',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid mode/i);
    });

    it('stores task in database', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-003',
        task: 'Store this task',
        mode: 'decision-only',
      });

      const row = db.prepare('SELECT task FROM phronesis_state WHERE id = ?').get('cycle-003') as
        { task: string } | undefined;
      expect(row?.task).toBe('Store this task');
    });

    it('respects custom recursion_limit', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-004',
        task: 'Some task',
        mode: 'recommend-only',
        recursionLimit: 3,
      });

      const row = db.prepare('SELECT recursion_limit FROM phronesis_state WHERE id = ?').get('cycle-004') as
        { recursion_limit: number } | undefined;
      expect(row?.recursion_limit).toBe(3);
    });

    it('applies model overrides', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-005',
        task: 'Some task',
        mode: 'recommend-only',
        models: { p1: 'claude-opus-4-5', p2: 'claude-haiku-4-5' },
      });

      const row = db.prepare('SELECT models FROM phronesis_state WHERE id = ?').get('cycle-005') as
        { models: string } | undefined;
      const models = JSON.parse(row!.models);
      expect(models.p1).toBe('claude-opus-4-5');
      expect(models.p2).toBe('claude-haiku-4-5');
    });

    it('normalizes explicit "default" per-operation overrides away before persistence', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-005b',
        task: 'Some task',
        mode: 'recommend-only',
        models: { p4: 'default' as never },
        providers: { p4: 'default' as never },
      });

      const row = db.prepare('SELECT models, providers FROM phronesis_state WHERE id = ?').get('cycle-005b') as
        { models: string; providers: string } | undefined;
      const models = JSON.parse(row!.models);
      const providers = JSON.parse(row!.providers);
      expect(models.p4).toBe(defaultConfig.apm.modelPolicy.standard.model);
      expect(providers.p4).toBe(defaultConfig.apm.modelPolicy.standard.provider);
    });

    it('spawns P1 agent on initiation', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-006',
        task: 'Some task',
        mode: 'recommend-only',
      });

      expect(ctx.notifyRole).toHaveBeenCalledWith('server', expect.objectContaining({ type: 'spawn_visible' }));
    });
  });

  // ===========================================================================
  // handlePhronesisRoleAck
  // ===========================================================================

  describe('handlePhronesisRoleAck', () => {
    it('returns grounding curriculum stage 1 for fresh spawn (grounding_stage=0)', () => {
      insertCycleState(db, 'cycle-ack-1', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 0,
      });

      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'cycle-ack-1',
        operation: 'p1',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe(1);
      expect(result.totalStages).toBe(4);
      expect(result.formatted).toBeDefined();
    });

    it('advances grounding_stage to 1 in database after role_ack', () => {
      insertCycleState(db, 'cycle-ack-2', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 0,
      });

      handlers.handlePhronesisRoleAck({ cycleId: 'cycle-ack-2', operation: 'p1' });

      const row = db.prepare('SELECT grounding_stage FROM phronesis_state WHERE id = ?').get('cycle-ack-2') as
        { grounding_stage: number } | undefined;
      expect(row?.grounding_stage).toBe(1);
    });

    it('returns error for non-existent cycle', () => {
      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'no-such-cycle',
        operation: 'p1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/cycle not found/i);
    });

    it('rejects if wrong agent calls ack in recall path', () => {
      insertCycleState(db, 'cycle-ack-3', {
        operation: 'p1',
        sub_phase: 'active',
        status: 'active',
        p1_agent_id: 'agent-expected',
        grounding_stage: 0,
      });

      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'cycle-ack-3',
        operation: 'p1',
        agentId: 'agent-wrong',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/wrong agent/i);
    });

    it('succeeds for recall path when agent id matches', () => {
      insertCycleState(db, 'cycle-ack-4', {
        operation: 'p1',
        sub_phase: 'active',
        status: 'active',
        p1_agent_id: 'agent-correct',
        grounding_stage: 0,
      });

      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'cycle-ack-4',
        operation: 'p1',
        agentId: 'agent-correct',
      });

      expect(result.success).toBe(true);
      expect(result.formatted).toBeDefined();
    });

    it('resolves cycle and operation from agentId when context is absent', () => {
      insertCycleState(db, 'cycle-ack-5', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        current_agent_id: 'agent-fallback-ack',
        p1_agent_id: 'agent-fallback-ack',
        grounding_stage: 0,
      });

      const result = handlers.handlePhronesisRoleAck({
        agentId: 'agent-fallback-ack',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe(1);
    });
  });

  // ===========================================================================
  // handlePhronesisGroundingComplete
  // ===========================================================================

  describe('handlePhronesisGroundingComplete', () => {
    it('rejects if grounding_stage is 0 (role_ack not called yet)', () => {
      insertCycleState(db, 'cycle-gc-1', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 0,
      });

      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-gc-1',
        operation: 'p1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/stage 1 has not yet been delivered/i);
    });

    it('advances from stage 1 to stage 2', () => {
      insertCycleState(db, 'cycle-gc-2', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 1,
      });

      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-gc-2',
        operation: 'p1',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe(2);
      expect(result.totalStages).toBe(4);
      expect(result.phase).toBe('p1:grounding');
    });

    it('advances from stage 2 to stage 3', () => {
      insertCycleState(db, 'cycle-gc-3', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 2,
      });

      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-gc-3',
        operation: 'p1',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe(3);
      expect(result.phase).toBe('p1:grounding');
    });

    it('transitions to active phase after final grounding stage (stage 3)', () => {
      insertCycleState(db, 'cycle-gc-4', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 3,
      });

      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-gc-4',
        operation: 'p1',
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('p1:active');
      expect(result.groundingComplete).toBe(true);

      const row = db.prepare('SELECT operation, sub_phase, status FROM phronesis_state WHERE id = ?').get('cycle-gc-4') as
        { operation: string | null; sub_phase: string | null; status: string } | undefined;
      expect(row?.operation).toBe('p1');
      expect(row?.sub_phase).toBe('active');
    });

    it('rejects grounding_complete when cycle is already active', () => {
      insertCycleState(db, 'cycle-gc-5', {
        operation: 'p1',
        sub_phase: 'active',
        status: 'active',
        grounding_stage: 0,
      });

      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-gc-5',
        operation: 'p1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/grounding is already complete/i);
    });

    it('resolves cycle and operation from agentId when context is absent', () => {
      insertCycleState(db, 'cycle-gc-6', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        current_agent_id: 'agent-fallback-gc',
        p1_agent_id: 'agent-fallback-gc',
        grounding_stage: 1,
      });

      const result = handlers.handlePhronesisGroundingComplete({
        agentId: 'agent-fallback-gc',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe(2);
    });
  });

  // ===========================================================================
  // handlePhronesisSubmit
  // ===========================================================================

  describe('handlePhronesisSubmit', () => {
    it('stores payload in phronesis_content', async () => {
      insertCycleState(db, 'cycle-sub-1', {
        operation: 'p1',
        sub_phase: 'active',
        status: 'active',
        grounding_stage: 0,
      });

      await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-sub-1',
        operation: 'p1',
        agentId: 'agent-p1',
        content: 'P1 findings content',
      });

      const row = db.prepare(
        'SELECT * FROM phronesis_content WHERE cycle_id = ? AND phase = ?'
      ).get('cycle-sub-1', 'p1') as Record<string, unknown> | undefined;

      expect(row).toBeDefined();
      expect(row!.payload).toBe('P1 findings content');
      expect(row!.agent_id).toBe('agent-p1');
    });

    it('transitions p1:active to p2:grounding after submit', async () => {
      insertCycleState(db, 'cycle-sub-2', {
        operation: 'p1',
        sub_phase: 'active',
        status: 'active',
        grounding_stage: 0,
      });

      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-sub-2',
        operation: 'p1',
        content: 'P1 findings',
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('p2');

      const row = db.prepare('SELECT operation, sub_phase, status FROM phronesis_state WHERE id = ?').get('cycle-sub-2') as
        { operation: string | null; sub_phase: string | null; status: string } | undefined;
      expect(row?.operation).toBe('p2');
      expect(row?.sub_phase).toBe('grounding');
    });

    it('rejects submit when phase is not active for that operation', async () => {
      insertCycleState(db, 'cycle-sub-3', {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 1,
      });

      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-sub-3',
        operation: 'p1',
        content: 'Early submit attempt',
      });

      expect(result.success).toBe(false);
    });

    it('transitions p4:active to complete after p4 submit', async () => {
      insertCycleState(db, 'cycle-sub-4', {
        operation: 'p4',
        sub_phase: 'active',
        status: 'active',
        p1_agent_id: 'agent-p1',
        p2_agent_id: 'agent-p2',
        p3_agent_id: 'agent-p3',
        grounding_stage: 0,
      });

      // Pre-insert content for p1, p2, p3
      insertContent(db, 'cycle-sub-4', 'p1', 1, 'P1 findings');
      insertContent(db, 'cycle-sub-4', 'p2', 1, 'P2 possibilities');
      insertContent(db, 'cycle-sub-4', 'p3', 1, 'P3 judgment');

      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-sub-4',
        operation: 'p4',
        content: 'P4 decision',
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('complete');

      const row = db.prepare('SELECT operation, sub_phase, status FROM phronesis_state WHERE id = ?').get('cycle-sub-4') as
        { operation: string | null; sub_phase: string | null; status: string } | undefined;
      expect(row?.status).toBe('complete');
      expect(row?.operation).toBeNull();
    });

    it('resolves cycle and operation from agentId when context is absent', async () => {
      insertCycleState(db, 'cycle-sub-5', {
        operation: 'p1',
        sub_phase: 'active',
        status: 'active',
        current_agent_id: 'agent-fallback-submit',
        p1_agent_id: 'agent-fallback-submit',
        grounding_stage: 0,
      });

      const result = await handlers.handlePhronesisSubmit({
        agentId: 'agent-fallback-submit',
        content: 'Recovered P1 findings',
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('p2');
    });
  });

  // ===========================================================================
  // handlePhronesisRecurse
  // ===========================================================================

  describe('handlePhronesisRecurse', () => {
    it('increments recursion count', async () => {
      insertCycleState(db, 'cycle-rec-1', {
        operation: 'p2',
        sub_phase: 'active',
        status: 'active',
        recursion_count: 0,
        recursion_limit: 5,
        p1_agent_id: null,
      });

      await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-1',
        operation: 'p2',
        target: 'p1',
        reason: 'P1 data was incomplete',
        content: 'P2 findings so far',
      });

      const row = db.prepare('SELECT recursion_count FROM phronesis_state WHERE id = ?').get('cycle-rec-1') as
        { recursion_count: number } | undefined;
      expect(row?.recursion_count).toBe(1);
    });

    it('rejects when recursion limit is reached', async () => {
      insertCycleState(db, 'cycle-rec-2', {
        operation: 'p2',
        sub_phase: 'active',
        status: 'active',
        recursion_count: 5,
        recursion_limit: 5,
        p1_agent_id: null,
      });

      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-2',
        operation: 'p2',
        target: 'p1',
        reason: 'Need more data',
        content: 'P2 content',
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('recursion_limit');

      const row = db.prepare('SELECT operation, sub_phase, status FROM phronesis_state WHERE id = ?').get('cycle-rec-2') as
        { operation: string | null; sub_phase: string | null; status: string } | undefined;
      expect(row?.status).toBe('recursion_limit');
      expect(row?.operation).toBeNull();
    });

    it('stores feedback content for target operation', async () => {
      insertCycleState(db, 'cycle-rec-3', {
        operation: 'p3',
        sub_phase: 'active',
        status: 'active',
        recursion_count: 0,
        recursion_limit: 5,
        p2_agent_id: null,
      });

      await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-3',
        operation: 'p3',
        target: 'p2',
        reason: 'Need more possibilities',
        content: 'P3 judgment with feedback',
      });

      const row = db.prepare(
        'SELECT feedback FROM phronesis_content WHERE cycle_id = ? AND phase = ?'
      ).get('cycle-rec-3', 'p3') as { feedback: string | null } | undefined;

      expect(row).toBeDefined();
      expect(row!.feedback).toBe('Need more possibilities');
    });

    it('rejects recursion from p1 (no prior operation)', async () => {
      insertCycleState(db, 'cycle-rec-4', {
        operation: 'p1',
        sub_phase: 'active',
        status: 'active',
        recursion_count: 0,
        recursion_limit: 5,
      });

      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-4',
        operation: 'p1',
        target: 'p1',
        reason: 'Cannot recurse from p1',
        content: 'Content',
      });

      expect(result.success).toBe(false);
    });

    it('rejects recursion to a later operation', async () => {
      insertCycleState(db, 'cycle-rec-5', {
        operation: 'p2',
        sub_phase: 'active',
        status: 'active',
        recursion_count: 0,
        recursion_limit: 5,
      });

      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-5',
        operation: 'p2',
        target: 'p3',
        reason: 'Invalid target',
        content: 'Content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/prior operation/i);
    });
  });

  // ===========================================================================
  // handlePhronesisGetFormattedContent
  // ===========================================================================

  describe('handlePhronesisGetFormattedContent', () => {
    it('resolves cycle from agentId when context is absent', () => {
      insertCycleState(db, 'cycle-gfc-1', {
        operation: 'p2',
        sub_phase: 'active',
        status: 'active',
        current_agent_id: 'agent-fallback-context',
        p2_agent_id: 'agent-fallback-context',
      });
      insertContent(db, 'cycle-gfc-1', 'p1', 1, 'P1 findings', 'agent-prev');

      const result = handlers.handlePhronesisGetFormattedContent({
        agentId: 'agent-fallback-context',
      });

      expect(result.success).toBe(true);
      expect(result.empty).toBe(false);
      expect(String(result.formatted)).toContain('P1 findings');
    });
  });

  // ===========================================================================
  // handlePhronesisAbort
  // ===========================================================================

  describe('handlePhronesisAbort', () => {
    it('transitions active cycle to aborted', async () => {
      insertCycleState(db, 'cycle-abort-1', {
        operation: 'p1',
        sub_phase: 'active',
        status: 'active',
        grounding_stage: 0,
      });

      const result = await handlers.handlePhronesisAbort({
        cycleId: 'cycle-abort-1',
        reason: 'User requested abort',
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('aborted');

      const row = db.prepare('SELECT operation, sub_phase, status FROM phronesis_state WHERE id = ?').get('cycle-abort-1') as
        { operation: string | null; sub_phase: string | null; status: string } | undefined;
      expect(row?.status).toBe('aborted');
      expect(row?.operation).toBeNull();
    });

    it('rejects abort of already-complete cycle', async () => {
      insertCycleState(db, 'cycle-abort-2', {
        operation: null,
        sub_phase: null,
        status: 'complete',
        grounding_stage: 0,
      });

      const result = await handlers.handlePhronesisAbort({
        cycleId: 'cycle-abort-2',
        reason: 'Too late',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/terminal state/i);
    });
  });

  // ===========================================================================
  // handlePhronesisListCycles
  // ===========================================================================

  describe('handlePhronesisListCycles', () => {
    it('returns empty list when no cycles exist', () => {
      const result = handlers.handlePhronesisListCycles();

      expect(result.success).toBe(true);
      expect(result.cycles).toBeDefined();
      expect(Array.isArray(result.cycles)).toBe(true);
      expect((result.cycles as unknown[]).length).toBe(0);
    });

    it('returns all created cycles', () => {
      insertCycleState(db, 'cycle-list-1', { operation: 'p1', sub_phase: 'grounding', status: 'active', mode: 'recommend-only' });
      insertCycleState(db, 'cycle-list-2', { operation: null, sub_phase: null, status: 'complete', mode: 'decision-only' });

      const result = handlers.handlePhronesisListCycles();

      expect(result.success).toBe(true);
      const cycles = result.cycles as Array<{ id: string }>;
      const ids = cycles.map((c) => c.id);
      expect(ids).toContain('cycle-list-1');
      expect(ids).toContain('cycle-list-2');
    });
  });

  // ===========================================================================
  // handlePhronesisGetState
  // ===========================================================================

  describe('handlePhronesisGetState', () => {
    it('returns full state for existing cycle', () => {
      insertCycleState(db, 'cycle-gs-1', {
        operation: 'p2',
        sub_phase: 'active',
        status: 'active',
        mode: 'decide-and-enact',
        task: 'Get state task',
      });

      const result = handlers.handlePhronesisGetState({ cycleId: 'cycle-gs-1' });

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.id).toBe('cycle-gs-1');
      expect(data.phase).toBe('p2:active');
      expect(data.mode).toBe('decide-and-enact');
      expect(data.task).toBe('Get state task');
    });

    it('returns error for non-existent cycle', () => {
      const result = handlers.handlePhronesisGetState({ cycleId: 'no-cycle' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/cycle not found/i);
    });
  });
});
