/**
 * Phronesis lifecycle integration tests — Phase 2 WU6.
 *
 * Tests that phronesis spawn pre-creates agents + initiatives records,
 * emits lifecycle signals, and completes/aborts initiatives correctly.
 * Also verifies backward compatibility when lifecycle is unavailable.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createMockLogger } from '@noetic-pi/shared/testing';
import { SCHEMA, runMigrations } from '../../src/db.js';
import { createPhronesisHandlers, type PhronesisHandlers } from '../../src/phronesis.js';
import { createLifecycleHandlers, type LifecycleHandlers } from '../../src/lifecycle.js';
import type { APMContext } from '@noetic-pi/shared';
import { defaultConfig } from '@noetic-pi/shared';

// =============================================================================
// Test Helpers
// =============================================================================

interface SignalCall {
  name: string;
  agentId: string | null;
  payload: Record<string, unknown>;
}

function createTestContext(db: Database.Database, signals?: SignalCall[]): APMContext {
  return {
    db,
    cwd: '/tmp/test-project',
    config: defaultConfig,
    recordEvent: vi.fn(),
    emitSignal: vi.fn((name: string, agentId: string | null, payload: Record<string, unknown>) => {
      signals?.push({ name, agentId, payload });
    }),
    runTransaction: <T>(fn: () => T): T => db.transaction(fn).immediate(),
    notifyRole: vi.fn().mockResolvedValue(undefined),
    notifyAgent: vi.fn().mockResolvedValue(undefined),
    handleSpawn: vi.fn(),
    retireAgent: vi.fn(),
    assemblePhronesisPrompt: () => 'You are a P-agent...',
    loadPromptFragment: () => null,
    captureSnapshot: () => {},
    log: createMockLogger(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Phronesis lifecycle pre-creation (WU6)', () => {
  let db: Database.Database;
  let ctx: APMContext;
  let signals: SignalCall[];
  let lifecycle: LifecycleHandlers;
  let handlers: PhronesisHandlers;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
    runMigrations(db);
    signals = [];
    ctx = createTestContext(db, signals);
    lifecycle = createLifecycleHandlers(ctx);
    handlers = createPhronesisHandlers(ctx, { lifecycle, routing: { notifyInitiator: vi.fn().mockResolvedValue(true) } });
  });

  // ===========================================================================
  // Spawn pre-creation
  // ===========================================================================

  describe('phronesis spawn creates lifecycle records', () => {
    it('creates agents table record with birth_cause = phronesis_spawn', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-00001111',
        task: 'Test task',
        mode: 'recommend-only',
        initiatorId: 'agent-captain1',
      });

      // The initiate call spawns P1 — find the agent it created
      const agents = db.prepare(`SELECT * FROM agents WHERE birth_cause = 'phronesis_spawn'`).all() as any[];
      expect(agents.length).toBe(1);
      expect(agents[0].role).toBe('p1:research');
      expect(agents[0].status).toBe('spawned');
      expect(agents[0].birth_cause).toBe('phronesis_spawn');
      expect(agents[0].title).toContain('DC:p1:research');
    });

    it('creates initiatives table record with type = phronesis_p1', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-00002222',
        task: 'Test task',
        mode: 'recommend-only',
        initiatorId: 'agent-captain1',
      });

      const inits = db.prepare(`SELECT * FROM initiatives WHERE type = 'phronesis_p1'`).all() as any[];
      expect(inits.length).toBe(1);
      expect(inits[0].mission).toContain('cycle-00002222');
      expect(inits[0].mission).toContain('phronesis_role_ack');
      const params = JSON.parse(inits[0].params);
      expect(params.cycle_id).toBe('cycle-00002222');
      expect(params.operation).toBe('p1');
    });

    it('emits lifecycle:initiative_assigned signal', async () => {
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-00003333',
        task: 'Test task',
        mode: 'recommend-only',
        initiatorId: 'agent-captain1',
      });

      const signal = signals.find(s => s.name === 'lifecycle:initiative_assigned');
      expect(signal).toBeDefined();
      expect(signal!.payload.initiativeType).toBe('phronesis_p1');
      expect(signal!.payload.sequence).toBe(1);
    });
  });

  // ===========================================================================
  // Submit completes initiative
  // ===========================================================================

  describe('phronesis submit completes initiative', () => {
    let cycleId: string;
    let p1AgentId: string;

    beforeEach(async () => {
      cycleId = 'cycle-submit01';
      await handlers.handlePhronesisInitiate({
        cycleId,
        task: 'Test task',
        mode: 'recommend-only',
        initiatorId: 'agent-captain1',
      });

      // Get the spawned P1 agent ID
      const state = db.prepare(`SELECT current_agent_id FROM phronesis_state WHERE id = ?`).get(cycleId) as any;
      p1AgentId = state.current_agent_id;

      // Advance to p1:active by completing grounding
      db.prepare(`UPDATE phronesis_state SET operation = 'p1', sub_phase = 'active', grounding_stage = 0 WHERE id = ?`).run(cycleId);

      signals.length = 0;
    });

    it('completes initiative with outcome = completed on submit', async () => {
      await handlers.handlePhronesisSubmit({
        cycleId,
        operation: 'p1',
        agentId: p1AgentId,
        content: 'P1 findings here',
      });

      const row = db.prepare(
        `SELECT outcome, completed_at FROM initiatives WHERE agent_id = ?`
      ).get(p1AgentId) as { outcome: string; completed_at: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.outcome).toBe('completed');
      expect(row!.completed_at).not.toBeNull();
    });

    it('emits lifecycle:initiative_completed signal on submit', async () => {
      await handlers.handlePhronesisSubmit({
        cycleId,
        operation: 'p1',
        agentId: p1AgentId,
        content: 'P1 findings here',
      });

      const signal = signals.find(s => s.name === 'lifecycle:initiative_completed');
      expect(signal).toBeDefined();
      expect(signal!.agentId).toBe(p1AgentId);
      expect(signal!.payload.outcome).toBe('completed');
      expect(signal!.payload.initiativeType).toBe('phronesis_p1');
    });
  });

  // ===========================================================================
  // Abort marks initiative aborted
  // ===========================================================================

  describe('phronesis abort marks initiative aborted', () => {
    let cycleId: string;
    let p1AgentId: string;

    beforeEach(async () => {
      cycleId = 'cycle-abort001';
      await handlers.handlePhronesisInitiate({
        cycleId,
        task: 'Test task',
        mode: 'recommend-only',
        initiatorId: 'agent-captain1',
      });

      const state = db.prepare(`SELECT current_agent_id FROM phronesis_state WHERE id = ?`).get(cycleId) as any;
      p1AgentId = state.current_agent_id;

      // Advance to p1:active
      db.prepare(`UPDATE phronesis_state SET operation = 'p1', sub_phase = 'active', grounding_stage = 0 WHERE id = ?`).run(cycleId);

      signals.length = 0;
    });

    it('completes initiative with outcome = aborted on abort', async () => {
      await handlers.handlePhronesisAbort({
        cycleId,
        reason: 'test abort',
      });

      const row = db.prepare(
        `SELECT outcome, completed_at FROM initiatives WHERE agent_id = ?`
      ).get(p1AgentId) as { outcome: string; completed_at: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.outcome).toBe('aborted');
    });

    it('emits lifecycle:initiative_completed with outcome = aborted', async () => {
      await handlers.handlePhronesisAbort({
        cycleId,
        reason: 'test abort',
      });

      const signal = signals.find(s => s.name === 'lifecycle:initiative_completed');
      expect(signal).toBeDefined();
      expect(signal!.agentId).toBe(p1AgentId);
      expect(signal!.payload.outcome).toBe('aborted');
    });
  });

  // ===========================================================================
  // Lifecycle failure propagates (WU-3: no longer non-fatal)
  // ===========================================================================

  describe('lifecycle failure propagates to spawn', () => {
    it('spawn fails when lifecycle.spawnAgent throws', async () => {
      const brokenLifecycle: LifecycleHandlers = {
        ...lifecycle,
        spawnAgent: vi.fn().mockRejectedValue(new Error('DB is full')),
      };
      const handlersWithBroken = createPhronesisHandlers(ctx, { lifecycle: brokenLifecycle, routing: { notifyInitiator: vi.fn().mockResolvedValue(true) } });

      const result = await handlersWithBroken.handlePhronesisInitiate({
        cycleId: 'cycle-fail0001',
        task: 'Test task',
        mode: 'recommend-only',
        initiatorId: 'agent-captain1',
      });

      // With spawnAgent(), lifecycle failure is fatal — spawn fails
      expect(result.success).toBe(false);
      expect(result.error).toContain('DB is full');
    });
  });
});
