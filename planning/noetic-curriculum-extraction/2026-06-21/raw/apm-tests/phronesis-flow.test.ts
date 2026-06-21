/**
 * Phronesis integration tests.
 *
 * Tests the full cognitional cycle lifecycle using an in-memory SQLite database.
 * Covers: initiation, grounding curriculum progression, role_ack, submit,
 * phase transitions, recursion, out-of-sequence rejection, mode constraints,
 * content accumulation, recursion limit enforcement, abort, list, state queries.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi, type Mock } from 'vitest';
import Database from 'better-sqlite3';
import { createMockLogger } from '@noetic-pi/shared/testing';
import { SCHEMA, runMigrations } from '../../src/db.js';
import {
  createPhronesisHandlers,
  type PhronesisHandlers,
  type PhronesisMode,
} from '../../src/phronesis.js';
import { createLifecycleHandlers } from '../../src/lifecycle.js';
import { createCensusHandlers } from '../../src/census.js';
import type { APMContext } from '@noetic-pi/shared';
import { defaultConfig } from '@noetic-pi/shared';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestContext(db: Database.Database): APMContext {
  const recordEvent = vi.fn();
  const notifyRole = vi.fn().mockResolvedValue(undefined);
  const notifyAgent = vi.fn().mockResolvedValue(undefined);
  const log = createMockLogger();

  const ctx: APMContext = {
    db,
    cwd: TEST_CWD,
    config: defaultConfig,
    recordEvent,
    emitSignal: vi.fn(),
    runTransaction: <T>(fn: () => T): T => db.transaction(fn).immediate(),
    notifyRole,
    notifyAgent,
    handleSpawn: vi.fn().mockReturnValue({ success: true, ptyPid: 12345 }),
    assemblePhronesisPrompt: vi.fn().mockReturnValue('bootstrap prompt'),
    loadPromptFragment: vi.fn().mockReturnValue(null),
    captureSnapshot: vi.fn(),
    retireAgent: () => { /* placeholder — wired below */ },
    log,
  };

  const censusHandlers = createCensusHandlers(ctx);
  ctx.retireAgent = (id: string, deathCause?: string) => censusHandlers.retireAgent(id, deathCause);

  return ctx;
}

const CYCLE_ID = 'test-cycle-001';
const TASK = 'Evaluate the architecture of the logging module';
const TEST_CWD = '/tmp/test-phronesis';

// Curriculum fixture — read from the real project file
const REAL_CURRICULUM_PATH = path.resolve(__dirname, '../../../../.method/curricula/differentiated-cognition.json');

/**
 * Helper: advance a cycle through grounding stages 1→2→3→active for a given operation.
 * Assumes the cycle is already in {operation}:grounding with grounding_stage=0.
 */
async function completeGrounding(
  handlers: PhronesisHandlers,
  cycleId: string,
  operation: string,
  agentId?: string
): Promise<void> {
  // Stage 0 → role_ack delivers first curriculum step (harness stage 1)
  const ackResult = handlers.handlePhronesisRoleAck({ cycleId, operation: operation as any, agentId });
  expect(ackResult.success).toBe(true);
  expect(ackResult.stage).toBe(1);

  // grounding_complete → harness stage 2
  const gc1 = handlers.handlePhronesisGroundingComplete({ cycleId, operation: operation as any, agentId });
  expect(gc1.success).toBe(true);
  expect(gc1.stage).toBe(2);

  // grounding_complete → harness stage 3
  const gc2 = handlers.handlePhronesisGroundingComplete({ cycleId, operation: operation as any, agentId });
  expect(gc2.success).toBe(true);
  expect(gc2.stage).toBe(3);

  // grounding_complete → complete → transition to active
  const gc3 = handlers.handlePhronesisGroundingComplete({ cycleId, operation: operation as any, agentId });
  expect(gc3.success).toBe(true);
  expect(gc3.phase).toBe(`${operation}:active`);
  expect(gc3.groundingComplete).toBe(true);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phronesis Flow', () => {
  let db: Database.Database;
  let ctx: APMContext;
  let handlers: PhronesisHandlers;
  let mockNotifyInitiator: ReturnType<typeof vi.fn>;

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
    ctx = createTestContext(db);
    const lifecycle = createLifecycleHandlers(ctx);
    mockNotifyInitiator = vi.fn().mockResolvedValue(true);
    handlers = createPhronesisHandlers(ctx, { lifecycle, routing: { notifyInitiator: mockNotifyInitiator } });
  });

  // -----------------------------------------------------------------------
  // Initiation
  // -----------------------------------------------------------------------

  describe('handlePhronesisInitiate', () => {
    it('creates cycle in p1:grounding phase', async () => {
      const result = await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('p1:grounding');
      expect(result.cycleId).toBe(CYCLE_ID);
    });

    it('spawns P1 agent at initiation', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      expect(ctx.notifyRole).toHaveBeenCalledWith('server', expect.objectContaining({
        type: 'spawn_visible',
        role: 'p1:research',
      }));
      const spawnCall = (ctx.notifyRole as Mock).mock.calls.find((c: any[]) => c[1]?.type === 'spawn_visible')?.[1];
      expect(spawnCall?.title).toContain('DC:p1:research');
    });

    it('rejects missing required fields', async () => {
      const result = await handlers.handlePhronesisInitiate({
        cycleId: '',
        task: TASK,
        mode: 'recommend-only',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid mode', async () => {
      const result = await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'invalid-mode' as PhronesisMode,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid mode');
    });

    it('allows concurrent active cycles from same initiator, reporting activeDisciplines', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-1',
        task: TASK,
        mode: 'recommend-only',
        initiatorId: 'agent-x',
      });

      const result = await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-2',
        task: TASK,
        mode: 'recommend-only',
        initiatorId: 'agent-x',
      });
      // Concurrent cycles are now permitted — second initiate should succeed
      // and surface the already-active cycle in activeDisciplines
      expect(result.success).toBe(true);
      expect((result as { activeDisciplines?: { id: string }[] }).activeDisciplines).toContainEqual(
        expect.objectContaining({ id: 'cycle-1' }),
      );
    });

    it('stores per-operation models', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        models: { p1: 'claude-4-opus', p3: 'gemini-2.5-pro' },
      });

      const state = db.prepare('SELECT models FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as { models: string };
      const models = JSON.parse(state.models);
      expect(models.p1).toBe('claude-4-opus');
      expect(models.p3).toBe('gemini-2.5-pro');
      expect(models.p2).toBe(defaultConfig.apm.modelPolicy.standard.model); // default (standard tier from defaultConfig)
    });

    it('delegates spawn to server via notifyRole (spawn failure is server-side)', async () => {
      // Spawn is fire-and-forget via notifyRole — APM does not detect spawn failure.
      // Server is responsible for PTY lifecycle.
      const result = await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      expect(result.success).toBe(true);
      expect(ctx.notifyRole).toHaveBeenCalledWith('server', expect.objectContaining({ type: 'spawn_visible' }));
    });
  });

  // -----------------------------------------------------------------------
  // Role Ack
  // -----------------------------------------------------------------------

  describe('handlePhronesisRoleAck', () => {
    beforeEach(async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
    });

    it('delivers Stage 1 curriculum on fresh spawn', () => {
      const result = handlers.handlePhronesisRoleAck({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe(1);
      expect(result.totalStages).toBe(4);
      expect(result.formatted).toContain('Role acknowledged');
      expect(result.formatted).toContain(TASK);
    });

    it('advances grounding_stage from 0 to 1', () => {
      handlers.handlePhronesisRoleAck({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
      });

      const state = db.prepare('SELECT grounding_stage FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as { grounding_stage: number };
      expect(state.grounding_stage).toBe(1);
    });

    it('rejects out-of-sequence role_ack', () => {
      // First, advance past grounding
      handlers.handlePhronesisRoleAck({ cycleId: CYCLE_ID, operation: 'p1' });
      // Complete grounding stages 1, 2, 3
      handlers.handlePhronesisGroundingComplete({ cycleId: CYCLE_ID, operation: 'p1' });
      handlers.handlePhronesisGroundingComplete({ cycleId: CYCLE_ID, operation: 'p1' });
      handlers.handlePhronesisGroundingComplete({ cycleId: CYCLE_ID, operation: 'p1' });

      // Now in p1:active — role_ack for p2 should fail
      const result = handlers.handlePhronesisRoleAck({
        cycleId: CYCLE_ID,
        operation: 'p2',
      });
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Grounding Stage Progression
  // -----------------------------------------------------------------------

  describe('handlePhronesisGroundingComplete', () => {
    beforeEach(async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      // Deliver Stage 1 via role_ack
      handlers.handlePhronesisRoleAck({ cycleId: CYCLE_ID, operation: 'p1' });
    });

    it('rejects before role_ack (stage 0)', async () => {
      // Create a new cycle to test stage 0
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-stage0',
        task: TASK,
        mode: 'recommend-only',
      });
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-stage0',
        operation: 'p1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Stage 1 has not yet been delivered');
    });

    it('advances from stage 1 to stage 2', () => {
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: CYCLE_ID,
        operation: 'p1',
      });
      expect(result.success).toBe(true);
      expect(result.stage).toBe(2);
      // Display: "Stage 2 of 3" (visible stages only, no +1 for tasking boundary)
      expect(result.instructions).toContain('Stage 2 of 3');
    });

    it('advances from stage 2 to stage 3', () => {
      handlers.handlePhronesisGroundingComplete({ cycleId: CYCLE_ID, operation: 'p1' }); // 1→2
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: CYCLE_ID,
        operation: 'p1',
      });
      expect(result.success).toBe(true);
      expect(result.stage).toBe(3);
      // Display: "Stage 3 of 3"
      expect(result.instructions).toContain('Stage 3 of 3');
    });

    it('transitions to :active after stage 3', () => {
      handlers.handlePhronesisGroundingComplete({ cycleId: CYCLE_ID, operation: 'p1' }); // 1→2
      handlers.handlePhronesisGroundingComplete({ cycleId: CYCLE_ID, operation: 'p1' }); // 2→3
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: CYCLE_ID,
        operation: 'p1',
      });
      expect(result.success).toBe(true);
      expect(result.phase).toBe('p1:active');
      expect(result.groundingComplete).toBe(true);
    });

    it('rejects grounding_complete in wrong phase', () => {
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: CYCLE_ID,
        operation: 'p2', // p2 is not grounding — p1 is
      });
      expect(result.success).toBe(false);
      expect((result as any).outOfSequence).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  describe('handlePhronesisSubmit', () => {
    beforeEach(async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
    });

    it('stores payload in phronesis_content', async () => {
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings: the module needs refactoring.',
      });

      const rows = db
        .prepare('SELECT * FROM phronesis_content WHERE cycle_id = ?')
        .all(CYCLE_ID) as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].phase).toBe('p1');
      expect(rows[0].payload).toContain('P1 findings');
    });

    it('transitions to next operation grounding after submit', async () => {
      const result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('p2:grounding');
      expect(result.operation).toBe('p2');
    });

    it('signals server to spawn next agent on submit', async () => {
      (ctx.notifyRole as Mock).mockClear();

      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });

      expect(ctx.notifyRole).toHaveBeenCalledWith('server', expect.objectContaining({ type: 'spawn_visible' }));
      const spawnCall = (ctx.notifyRole as Mock).mock.calls.find((c: any[]) => c[1]?.type === 'spawn_visible')?.[1];
      expect(spawnCall?.title).toContain('DC:p2:ideate');
    });

    it('rejects submit in wrong phase', async () => {
      const result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p2', // p2 is not active, p1 is
        agentId: 'p2-agent',
        content: 'Premature P2 content',
      });
      expect(result.success).toBe(false);
      expect((result as any).outOfSequence).toBe(true);
    });

    it('rejects submit with missing content', async () => {
      const result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('notifies initiator via injected notifyInitiator when initiator_id is null (fallback path)', async () => {
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });

      expect(mockNotifyInitiator).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          type: 'phronesis:phase_transition',
          fromPhase: 'p1:complete',
          toPhase: 'p2:grounding',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Full cycle flow
  // -----------------------------------------------------------------------

  describe('full cycle flow', () => {
    it('completes initiate → p1 grounding → p1 submit → p2 → p3 → p4 → complete', async () => {
      // Initiate
      const initResult = await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      expect(initResult.success).toBe(true);

      // P1 grounding + submit
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      const p1Result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1: The logging module has three layers.',
      });
      expect(p1Result.success).toBe(true);
      expect(p1Result.phase).toBe('p2:grounding');

      // P2 grounding + submit
      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');
      const p2Result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p2',
        agentId: 'p2-agent',
        content: 'P2: Three possibilities for restructuring.',
      });
      expect(p2Result.success).toBe(true);
      expect(p2Result.phase).toBe('p3:grounding');

      // P3 grounding + submit
      await completeGrounding(handlers, CYCLE_ID, 'p3', 'p3-agent');
      const p3Result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        content: 'P3: Option B is the best supported by evidence.',
      });
      expect(p3Result.success).toBe(true);
      expect(p3Result.phase).toBe('p4:grounding');

      // P4 grounding + submit
      await completeGrounding(handlers, CYCLE_ID, 'p4', 'p4-agent');
      const p4Result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p4',
        agentId: 'p4-agent',
        content: 'P4: Implementing Option B with the following plan.',
      });
      expect(p4Result.success).toBe(true);
      expect(p4Result.phase).toBe('complete');

      // Verify all content accumulated
      const content = db
        .prepare('SELECT * FROM phronesis_content WHERE cycle_id = ? ORDER BY timestamp ASC')
        .all(CYCLE_ID) as any[];
      expect(content).toHaveLength(4);
      expect(content[0].phase).toBe('p1');
      expect(content[1].phase).toBe('p2');
      expect(content[2].phase).toBe('p3');
      expect(content[3].phase).toBe('p4');

      // Verify final state
      const state = db.prepare('SELECT status FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as { status: string };
      expect(state.status).toBe('complete');
    });
  });

  // -----------------------------------------------------------------------
  // Content accumulation
  // -----------------------------------------------------------------------

  describe('content accumulation', () => {
    it('getFormattedContent returns labeled markdown sections', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 content here',
      });

      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');

      const result = handlers.handlePhronesisGetFormattedContent({ cycleId: CYCLE_ID });
      expect(result.success).toBe(true);
      expect(result.formatted).toContain('P1 Findings');
      expect(result.formatted).toContain('P1 content here');
      expect(result.empty).toBe(false);
    });

    it('getFormattedContent returns empty for fresh cycle', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      const result = handlers.handlePhronesisGetFormattedContent({ cycleId: CYCLE_ID });
      expect(result.success).toBe(true);
      expect(result.empty).toBe(true);
    });

    it('getContent returns raw content rows', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'test content',
      });

      const result = handlers.handlePhronesisGetContent({ cycleId: CYCLE_ID });
      expect(result.success).toBe(true);
      expect(Array.isArray(result.content)).toBe(true);
      expect((result.content as any[]).length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Recursion
  // -----------------------------------------------------------------------

  describe('handlePhronesisRecurse', () => {
    beforeEach(async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      // Advance to p3:active
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p2',
        agentId: 'p2-agent',
        content: 'P2 possibilities',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p3', 'p3-agent');
    });

    it('p3 can recurse back to p1', async () => {
      const result = await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'P1 missed critical data',
        content: 'P3 judgment: insufficient evidence. Need P1 to re-attend.',
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('p1');
      expect(result.recursionCount).toBe(1);
      // p1 agent already exists → recall, so phase is :active
      expect(result.phase).toBe('p1:active');
    });

    it('p3 can recurse back to p2', async () => {
      const result = await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p2',
        reason: 'Need more possibilities',
        content: 'P3 judgment: possibilities too narrow.',
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('p2');
      expect(result.phase).toBe('p2:active'); // recall — p2 agent already exists
    });

    it('stores recursing agent payload with feedback', async () => {
      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'Missed data',
        content: 'P3 judgment payload',
      });

      const rows = db
        .prepare("SELECT * FROM phronesis_content WHERE cycle_id = ? AND phase = 'p3'")
        .all(CYCLE_ID) as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].payload).toContain('P3 judgment payload');
      expect(rows[0].feedback).toBe('Missed data');
    });

    it('increments recursion count', async () => {
      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'test',
        content: 'content',
      });

      const state = db.prepare('SELECT recursion_count FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as { recursion_count: number };
      expect(state.recursion_count).toBe(1);
    });

    it('p3 cannot recurse forward to p4', async () => {
      const result = await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p4',
        reason: 'test',
        content: 'test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('prior operation');
    });

    it('p3 cannot recurse to itself', async () => {
      const result = await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p3',
        reason: 'test',
        content: 'test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('prior operation');
    });

    it('notifies initiator via injected notifyInitiator when initiator_id is null (fallback path — recursion)', async () => {
      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'test recursion',
        content: 'judgment content',
      });

      expect(mockNotifyInitiator).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          type: 'phronesis:recursion',
          target: 'p1',
          recursionCount: 1,
        })
      );
    });

    it('sends recall notification to existing agent', async () => {
      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'need more attention',
        content: 'judgment content',
      });

      expect(ctx.notifyAgent).toHaveBeenCalledWith(
        'p1-agent',
        expect.objectContaining({
          type: 'phronesis:recall',
          operation: 'p1',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Recursion limit enforcement
  // -----------------------------------------------------------------------

  describe('recursion limit enforcement', () => {
    it('halts cycle at recursion limit', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        recursionLimit: 1,
      });

      // Advance to p3:active
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p2',
        agentId: 'p2-agent',
        content: 'P2 possibilities',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p3', 'p3-agent');

      // First recursion — succeeds (count goes to 1, limit is 1)
      const r1 = await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'first recursion',
        content: 'judgment 1',
      });
      expect(r1.success).toBe(true);

      // Complete the recalled p1 → p2 → p3 cycle
      // p1 is recalled (already has agent), so it's in p1:active
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 refined findings',
      });
      // p2 is recalled
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p2',
        agentId: 'p2-agent',
        content: 'P2 refined possibilities',
      });
      // p3 is recalled
      // Now try to recurse again — should hit limit (count would be 2, limit is 1)
      const r2 = await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'second recursion',
        content: 'judgment 2',
      });
      expect(r2.success).toBe(true);
      expect(r2.phase).toBe('recursion_limit');

      const state = db.prepare('SELECT status FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as { status: string };
      expect(state.status).toBe('recursion_limit');
    });
  });

  // -----------------------------------------------------------------------
  // Out-of-sequence rejection
  // -----------------------------------------------------------------------

  describe('out-of-sequence rejection', () => {
    beforeEach(async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
    });

    it('rejects submit during grounding phase', async () => {
      // Cycle is in p1:grounding, role_ack not yet called
      handlers.handlePhronesisRoleAck({ cycleId: CYCLE_ID, operation: 'p1' });
      // Still grounding (stage 1)
      const result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        content: 'premature content',
      });
      expect(result.success).toBe(false);
      expect((result as any).outOfSequence).toBe(true);
    });

    it('rejects grounding_complete for wrong operation', () => {
      handlers.handlePhronesisRoleAck({ cycleId: CYCLE_ID, operation: 'p1' });

      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: CYCLE_ID,
        operation: 'p2',
      });
      expect(result.success).toBe(false);
      expect((result as any).outOfSequence).toBe(true);
    });

    it('rejects submit after cycle is complete', async () => {
      // Run full cycle
      await completeGrounding(handlers, CYCLE_ID, 'p1');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p1', content: 'p1' });
      await completeGrounding(handlers, CYCLE_ID, 'p2');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p2', content: 'p2' });
      await completeGrounding(handlers, CYCLE_ID, 'p3');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p3', content: 'p3' });
      await completeGrounding(handlers, CYCLE_ID, 'p4');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p4', content: 'p4' });

      const result = await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p4',
        content: 'late submit',
      });
      expect(result.success).toBe(false);
      expect((result as any).outOfSequence).toBe(true);
    });

    it('rejects recurse from p1 (no prior operation)', async () => {
      await completeGrounding(handlers, CYCLE_ID, 'p1');

      const result = await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p1',
        target: 'p1',
        reason: 'test',
        content: 'test',
      });
      expect(result.success).toBe(false);
      expect((result as any).outOfSequence).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Mode constraints
  // -----------------------------------------------------------------------

  describe('mode constraints', () => {
    it('includes mode prohibition in P4 role_ack for recommend-only', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      // Advance through to p4:grounding
      await completeGrounding(handlers, CYCLE_ID, 'p1');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p1', content: 'p1' });
      await completeGrounding(handlers, CYCLE_ID, 'p2');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p2', content: 'p2' });
      await completeGrounding(handlers, CYCLE_ID, 'p3');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p3', content: 'p3' });

      // P4 role_ack
      const result = handlers.handlePhronesisRoleAck({
        cycleId: CYCLE_ID,
        operation: 'p4',
      });

      expect(result.success).toBe(true);
      expect(result.formatted).toContain('MODE CONSTRAINT');
      expect(result.formatted).toContain('HARD PROHIBITION');
      expect(result.formatted).toContain('recommend-only');
      expect(result.formatted).toContain('recommendation');
    });

    it('includes mode prohibition in P4 role_ack for decision-only', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-decision',
        task: TASK,
        mode: 'decision-only',
      });

      await completeGrounding(handlers, 'cycle-decision', 'p1');
      await handlers.handlePhronesisSubmit({ cycleId: 'cycle-decision', operation: 'p1', content: 'p1' });
      await completeGrounding(handlers, 'cycle-decision', 'p2');
      await handlers.handlePhronesisSubmit({ cycleId: 'cycle-decision', operation: 'p2', content: 'p2' });
      await completeGrounding(handlers, 'cycle-decision', 'p3');
      await handlers.handlePhronesisSubmit({ cycleId: 'cycle-decision', operation: 'p3', content: 'p3' });

      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'cycle-decision',
        operation: 'p4',
      });

      expect(result.success).toBe(true);
      expect(result.formatted).toContain('MODE CONSTRAINT');
      expect(result.formatted).toContain('decision');
    });

    it('does NOT include mode prohibition for decide-and-enact', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-enact',
        task: TASK,
        mode: 'decide-and-enact',
      });

      await completeGrounding(handlers, 'cycle-enact', 'p1');
      await handlers.handlePhronesisSubmit({ cycleId: 'cycle-enact', operation: 'p1', content: 'p1' });
      await completeGrounding(handlers, 'cycle-enact', 'p2');
      await handlers.handlePhronesisSubmit({ cycleId: 'cycle-enact', operation: 'p2', content: 'p2' });
      await completeGrounding(handlers, 'cycle-enact', 'p3');
      await handlers.handlePhronesisSubmit({ cycleId: 'cycle-enact', operation: 'p3', content: 'p3' });

      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'cycle-enact',
        operation: 'p4',
      });

      expect(result.success).toBe(true);
      // Should NOT contain mode constraint
      expect(result.formatted ?? '').not.toContain('MODE CONSTRAINT');
    });

    it('does NOT include mode prohibition for non-P4 operations', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      const result = handlers.handlePhronesisRoleAck({
        cycleId: CYCLE_ID,
        operation: 'p1',
      });

      expect(result.success).toBe(true);
      expect(result.formatted ?? '').not.toContain('MODE CONSTRAINT');
    });
  });

  // -----------------------------------------------------------------------
  // Abort
  // -----------------------------------------------------------------------

  describe('handlePhronesisAbort', () => {
    it('aborts an active cycle', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      const result = await handlers.handlePhronesisAbort({
        cycleId: CYCLE_ID,
        reason: 'User requested abort',
      });

      expect(result.success).toBe(true);
      expect(result.phase).toBe('aborted');

      const state = db.prepare('SELECT status FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as { status: string };
      expect(state.status).toBe('aborted');
    });

    it('rejects abort of already-terminal cycle', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      await handlers.handlePhronesisAbort({ cycleId: CYCLE_ID, reason: 'first abort' });

      const result = await handlers.handlePhronesisAbort({
        cycleId: CYCLE_ID,
        reason: 'second abort',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('terminal state');
    });

    it('rejects abort of nonexistent cycle', async () => {
      const result = await handlers.handlePhronesisAbort({
        cycleId: 'nonexistent',
        reason: 'test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cycle not found');
    });
  });

  // -----------------------------------------------------------------------
  // GetState
  // -----------------------------------------------------------------------

  describe('handlePhronesisGetState', () => {
    it('returns full cycle state with content summary', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p1');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 content',
      });

      const result = handlers.handlePhronesisGetState({ cycleId: CYCLE_ID });
      expect(result.success).toBe(true);

      const data = result.data as any;
      expect(data.id).toBe(CYCLE_ID);
      expect(data.mode).toBe('recommend-only');
      expect(data.task).toBe(TASK);
      expect(data.content).toHaveLength(1);
      expect(data.content[0].phase).toBe('p1');
      expect(data.models).toBeDefined();
    });

    it('returns error for nonexistent cycle', () => {
      const result = handlers.handlePhronesisGetState({ cycleId: 'nonexistent' });
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // ListCycles
  // -----------------------------------------------------------------------

  describe('handlePhronesisListCycles', () => {
    it('returns empty array when no cycles exist', () => {
      const result = handlers.handlePhronesisListCycles();
      expect(result.success).toBe(true);
      expect((result.cycles as any[]).length).toBe(0);
    });

    it('lists all cycles with summary info', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-a',
        task: 'Task A',
        mode: 'recommend-only',
      });
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-b',
        task: 'Task B',
        mode: 'decide-and-enact',
      });

      const result = handlers.handlePhronesisListCycles();
      expect(result.success).toBe(true);
      expect((result.cycles as any[]).length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Recall path (role_ack for recalled agents)
  // -----------------------------------------------------------------------

  describe('recall via role_ack', () => {
    it('acknowledges recall for existing agent in active phase', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      // Advance p1 through to completion
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });

      // Advance p2
      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p2',
        agentId: 'p2-agent',
        content: 'P2 possibilities',
      });

      // Advance p3, then recurse back to p1
      await completeGrounding(handlers, CYCLE_ID, 'p3', 'p3-agent');
      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'Need more data',
        content: 'judgment',
      });

      // Now p1 is in p1:active state for recall
      const ackResult = handlers.handlePhronesisRoleAck({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
      });

      expect(ackResult.success).toBe(true);
      expect(ackResult.formatted).toContain('Role acknowledged');
      expect(ackResult.formatted).toContain('phronesis_get_context');
    });

    it('rejects recall from wrong agent', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p2',
        agentId: 'p2-agent',
        content: 'P2 possibilities',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p3', 'p3-agent');
      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'test',
        content: 'judgment',
      });

      const ackResult = handlers.handlePhronesisRoleAck({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'wrong-agent',
      });

      expect(ackResult.success).toBe(false);
      expect(ackResult.error).toContain('Wrong agent');
    });
  });

  // -----------------------------------------------------------------------
  // WU-3: spawnAgent migration tests
  // -----------------------------------------------------------------------

  describe('spawnAgent migration (WU-3)', () => {
    it('phronesis spawn creates lifecycle records via spawnAgent', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      // Agent record created
      const agents = db.prepare(`SELECT * FROM agents WHERE birth_cause = 'phronesis_spawn'`).all() as any[];
      expect(agents.length).toBe(1);
      expect(agents[0].role).toBe('p1:research');
      expect(agents[0].status).toBe('spawned');
      expect(agents[0].title).toContain('DC:p1:research');

      // Initiative record created
      const initiatives = db.prepare(`SELECT * FROM initiatives WHERE type = 'phronesis_p1'`).all() as any[];
      expect(initiatives.length).toBe(1);
      expect(initiatives[0].mission).toContain(CYCLE_ID);
      expect(initiatives[0].mission).toContain('phronesis_role_ack');
    });

    it('phronesis spawn command has no shell-arg prompt', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      const spawnCall = (ctx.notifyRole as Mock).mock.calls.find((c: any[]) => c[1]?.type === 'spawn_visible')?.[1];
      expect(spawnCall).toBeDefined();
      // The command must not contain a positional shell-arg prompt
      expect(spawnCall.cmd).not.toContain("'Call ");
      expect(spawnCall.cmd).not.toContain('apm_bootstrap');
      // Verify command structure: should be just flags, no trailing quoted string
      expect(spawnCall.cmd).toMatch(/^pi --agent-id [a-f0-9-]+ --role p1/);
    });

    it('phronesis state updates still applied after spawnAgent', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      const state = db.prepare('SELECT current_agent_id, p1_agent_id FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as any;
      expect(state.current_agent_id).toBeTruthy();
      expect(state.p1_agent_id).toBeTruthy();
      expect(state.current_agent_id).toBe(state.p1_agent_id);
    });

    it('phronesis spawn env does NOT include PHRONESIS_CYCLE_ID and PHRONESIS_OPERATION (D016)', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      const spawnCall = (ctx.notifyRole as Mock).mock.calls.find((c: any[]) => c[1]?.type === 'spawn_visible')?.[1];
      expect(spawnCall).toBeDefined();
      expect(spawnCall.env).toBeDefined();
      // D016: context delivered via initiativeParams, not env vars
      expect(spawnCall.env).not.toHaveProperty('PHRONESIS_CYCLE_ID');
      expect(spawnCall.env).not.toHaveProperty('PHRONESIS_OPERATION');
    });

    it('phronesis spawn env does NOT include PHRONESIS_PASS (D016)', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      const spawnCall = (ctx.notifyRole as Mock).mock.calls.find((c: any[]) => c[1]?.type === 'spawn_visible')?.[1];
      expect(spawnCall).toBeDefined();
      // D016: context delivered via initiativeParams, not env vars
      expect(spawnCall.env).not.toHaveProperty('PHRONESIS_PASS');
    });

    it('phronesis spawn uses per-operation model from models config', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        models: { p1: 'claude-4-opus' },
      });

      const spawnCall = (ctx.notifyRole as Mock).mock.calls.find((c: any[]) => c[1]?.type === 'spawn_visible')?.[1];
      expect(spawnCall).toBeDefined();
      expect(spawnCall.model).toBe('claude-4-opus');
    });

    it('phronesis spawn uses per-operation provider from providers config', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        providers: { p1: 'deepinfra' },
      });

      const spawnCall = (ctx.notifyRole as Mock).mock.calls.find((c: any[]) => c[1]?.type === 'spawn_visible')?.[1];
      expect(spawnCall).toBeDefined();
      expect(spawnCall.cmd).toContain('--provider deepinfra');
    });

    it('subsequent phase spawn (p2) does NOT have PHRONESIS_* vars (D016)', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      (ctx.notifyRole as Mock).mockClear();

      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });

      const spawnCall = (ctx.notifyRole as Mock).mock.calls.find((c: any[]) => c[1]?.type === 'spawn_visible')?.[1];
      expect(spawnCall).toBeDefined();
      // D016: context delivered via initiativeParams, not env vars
      expect(spawnCall.env).not.toHaveProperty('PHRONESIS_CYCLE_ID');
      expect(spawnCall.env).not.toHaveProperty('PHRONESIS_OPERATION');
    });

    it('state current_agent_id updates for each phase spawn', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
      });

      const stateP1 = db.prepare('SELECT current_agent_id, p1_agent_id FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as any;
      const p1AgentId = stateP1.p1_agent_id;
      expect(p1AgentId).toBeTruthy();

      await completeGrounding(handlers, CYCLE_ID, 'p1', p1AgentId);
      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: p1AgentId,
        content: 'P1 findings',
      });

      const stateP2 = db.prepare('SELECT current_agent_id, p2_agent_id FROM phronesis_state WHERE id = ?').get(CYCLE_ID) as any;
      expect(stateP2.p2_agent_id).toBeTruthy();
      expect(stateP2.current_agent_id).toBe(stateP2.p2_agent_id);
      expect(stateP2.current_agent_id).not.toBe(p1AgentId);
    });
  });

  // -----------------------------------------------------------------------
  // Initiator-aware notification routing (AI-0031)
  // -----------------------------------------------------------------------

  describe('initiator-aware notification routing (delegated to injected notifyInitiator)', () => {
    const CREW_INITIATOR = 'agent-crew-initiator';

    // Register the crew initiator in census before each test via the handler API
    beforeEach(() => {
      const censusHandlers = createCensusHandlers(ctx);
      censusHandlers.handleRegister({
        id: CREW_INITIATOR,
        role: 'unitary',
        status: 'active',
      });
    });

    it('phase transition delegates to injected notifyInitiator with initiator ID', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        initiatorId: CREW_INITIATOR,
      });
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      mockNotifyInitiator.mockClear();

      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });

      expect(mockNotifyInitiator).toHaveBeenCalledWith(
        CREW_INITIATOR,
        expect.objectContaining({ type: 'phronesis:phase_transition' })
      );
    });

    it('cycle complete delegates to injected notifyInitiator with initiator ID', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        initiatorId: CREW_INITIATOR,
      });

      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p1', agentId: 'p1-agent', content: 'p1' });
      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p2', agentId: 'p2-agent', content: 'p2' });
      await completeGrounding(handlers, CYCLE_ID, 'p3', 'p3-agent');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p3', agentId: 'p3-agent', content: 'p3' });
      await completeGrounding(handlers, CYCLE_ID, 'p4', 'p4-agent');
      mockNotifyInitiator.mockClear();

      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p4', agentId: 'p4-agent', content: 'p4' });

      expect(mockNotifyInitiator).toHaveBeenCalledWith(
        CREW_INITIATOR,
        expect.objectContaining({ type: 'phronesis:complete' })
      );
    });

    it('recursion notification delegates to injected notifyInitiator with initiator ID', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        initiatorId: CREW_INITIATOR,
      });

      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p1', agentId: 'p1-agent', content: 'p1' });
      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p2', agentId: 'p2-agent', content: 'p2' });
      await completeGrounding(handlers, CYCLE_ID, 'p3', 'p3-agent');
      mockNotifyInitiator.mockClear();

      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID,
        operation: 'p3',
        agentId: 'p3-agent',
        target: 'p1',
        reason: 'needs more data',
        content: 'p3 judgment',
      });

      expect(mockNotifyInitiator).toHaveBeenCalledWith(
        CREW_INITIATOR,
        expect.objectContaining({ type: 'phronesis:recursion' })
      );
    });

    it('recursion limit delegates to injected notifyInitiator with initiator ID', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        initiatorId: CREW_INITIATOR,
        recursionLimit: 1,
      });

      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p1', agentId: 'p1-agent', content: 'p1' });
      await completeGrounding(handlers, CYCLE_ID, 'p2', 'p2-agent');
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p2', agentId: 'p2-agent', content: 'p2' });
      await completeGrounding(handlers, CYCLE_ID, 'p3', 'p3-agent');

      // First recursion (count → 1, within limit)
      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID, operation: 'p3', agentId: 'p3-agent',
        target: 'p1', reason: 'first', content: 'judgment 1',
      });

      // Drive back through p1 → p2 → p3 active again (recalled agents)
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p1', agentId: 'p1-agent', content: 'p1 v2' });
      await handlers.handlePhronesisSubmit({ cycleId: CYCLE_ID, operation: 'p2', agentId: 'p2-agent', content: 'p2 v2' });
      mockNotifyInitiator.mockClear();

      // Second recursion hits the limit
      await handlers.handlePhronesisRecurse({
        cycleId: CYCLE_ID, operation: 'p3', agentId: 'p3-agent',
        target: 'p1', reason: 'second', content: 'judgment 2',
      });

      expect(mockNotifyInitiator).toHaveBeenCalledWith(
        CREW_INITIATOR,
        expect.objectContaining({ type: 'phronesis:recursion_limit' })
      );
    });

    it('captain initiator delegates to injected notifyInitiator with captain ID', async () => {
      const censusHandlers = createCensusHandlers(ctx);
      censusHandlers.handleRegister({
        id: 'agent-captain-init',
        role: 'unitary',
        status: 'active',
      });

      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        initiatorId: 'agent-captain-init',
      });
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      mockNotifyInitiator.mockClear();

      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });

      // Now delegates to injected notifyInitiator — routing logic is in routing.ts
      expect(mockNotifyInitiator).toHaveBeenCalledWith(
        'agent-captain-init',
        expect.objectContaining({ type: 'phronesis:phase_transition' })
      );
    });

    it('retired initiator delegates to injected notifyInitiator with retired initiator ID', async () => {
      const censusHandlers = createCensusHandlers(ctx);
      censusHandlers.retireAgent(CREW_INITIATOR);

      await handlers.handlePhronesisInitiate({
        cycleId: CYCLE_ID,
        task: TASK,
        mode: 'recommend-only',
        initiatorId: CREW_INITIATOR,
      });
      await completeGrounding(handlers, CYCLE_ID, 'p1', 'p1-agent');
      mockNotifyInitiator.mockClear();

      await handlers.handlePhronesisSubmit({
        cycleId: CYCLE_ID,
        operation: 'p1',
        agentId: 'p1-agent',
        content: 'P1 findings',
      });

      // Delegates to injected notifyInitiator — routing module handles fallback
      expect(mockNotifyInitiator).toHaveBeenCalledWith(
        CREW_INITIATOR,
        expect.objectContaining({ type: 'phronesis:phase_transition' })
      );
    });
  });
});
