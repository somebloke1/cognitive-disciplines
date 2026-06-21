/**
 * Phronesis D014 terminal state containment tests.
 *
 * Decision: D014 (Agent Lifecycle Containment)
 * Terminal states: complete, aborted, failed, recursion_limit
 *
 * Postconditions:
 *   - current_agent_id should be null after terminal state
 *   - All P-agents should be retired after abort/complete
 *   - No dangling agent references
 *
 * Source: packages/apm/src/phronesis.ts
 * Ideal:  .working/state-machine-audits/ideal/phronesis.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers/db-setup.js';
import { createTestContext } from '../helpers/mock-context.js';
import { createSpawnCapture } from '../helpers/spawn-capture.js';
import { createNotificationCapture } from '../helpers/notification-capture.js';
import { assertPhronesisPostconditions } from '../helpers/postcondition-assert.js';
import { createPhronesisHandlers } from '../../../../src/phronesis.js';
import type { LifecycleHandlers } from '../../../../src/lifecycle.js';
import type { APMContext } from '@noetic-pi/shared';

vi.mock('../../../../src/curriculum.js', () => ({
  loadCurriculum: vi.fn().mockReturnValue({ stages: [{ id: 1 }] }),
  advance: vi.fn().mockReturnValue({
    phase: 'complete', stage: 1, totalStages: 1, instructions: 'Done.',
  }),
  assembleEpistemicHorizon: vi.fn().mockReturnValue(''),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupPhronesisState(db: Database.Database, cycleId: string, state: {
  operation: string | null;
  sub_phase: string | null;
  status: string;
  recursion_count?: number;
  recursion_limit?: number;
  grounding_stage?: number;
  current_agent_id?: string | null;
  p1_agent_id?: string | null;
  p2_agent_id?: string | null;
  p3_agent_id?: string | null;
  p4_agent_id?: string | null;
}) {
  db.prepare(
    `INSERT INTO phronesis_state
      (id, operation, sub_phase, status, mode, task, initiator_id,
       recursion_count, recursion_limit, grounding_stage,
       current_agent_id, p1_agent_id, p2_agent_id, p3_agent_id, p4_agent_id,
       orienting_question, implicit_unknown, updated_at)
     VALUES (?, ?, ?, ?, 'recommend-only', 'test task', 'initiator-1',
       ?, ?, ?, ?, ?, ?, ?, ?, 'test question', 'test unknown',
       datetime('now'))`
  ).run(
    cycleId,
    state.operation, state.sub_phase, state.status,
    state.recursion_count ?? 0, state.recursion_limit ?? 5,
    state.grounding_stage ?? 0,
    state.current_agent_id ?? null,
    state.p1_agent_id ?? null, state.p2_agent_id ?? null,
    state.p3_agent_id ?? null, state.p4_agent_id ?? null,
  );
}

function createMockLifecycle(): LifecycleHandlers {
  return {
    spawnAgent: vi.fn().mockResolvedValue({ agentId: 'spawned-agent', initiativeId: 'init-001' }),
    getCurrentInitiative: vi.fn().mockReturnValue(null),
    completeInitiative: vi.fn(),
    createAgentRecord: vi.fn(),
    getAgentRecord: vi.fn().mockReturnValue(null),
    updateAgent: vi.fn(),
  } as unknown as LifecycleHandlers;
}

function createHandlers(db: Database.Database, overrides?: Partial<APMContext>) {
  const spawnCapture = createSpawnCapture();
  const notifCapture = createNotificationCapture();
  const ctx = createTestContext(db, {
    handleSpawn: spawnCapture.mockHandleSpawn,
    notifyAgent: notifCapture.mockNotifyAgent,
    ...overrides,
  });
  const lifecycle = createMockLifecycle();
  const handlers = createPhronesisHandlers(ctx, {
    lifecycle,
    routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
  });
  return { handlers, ctx, spawnCapture, notifCapture, lifecycle };
}

// =============================================================================

describe('Phronesis D014 containment — terminal state postconditions', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it('D014-phronesis-complete: current_agent_id null after P4 completion', async () => {
    const { handlers } = createHandlers(db);
    setupPhronesisState(db, 'cycle-d014-complete', {
      operation: 'p4', sub_phase: 'active', status: 'active',
      current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
      p1_agent_id: 'agent-p1', p2_agent_id: 'agent-p2', p3_agent_id: 'agent-p3',
    });
    await handlers.handlePhronesisSubmit({
      cycleId: 'cycle-d014-complete', operation: 'p4', agentId: 'agent-p4',
      content: 'final decision', alignmentRationale: 'rationale',
    });
    assertPhronesisPostconditions(db, 'cycle-d014-complete');
  });

  it('D014-phronesis-aborted: all P-agents retired after abort', async () => {
    const { handlers, ctx } = createHandlers(db);
    setupPhronesisState(db, 'cycle-d014-abort', {
      operation: 'p3', sub_phase: 'active', status: 'active',
      current_agent_id: 'agent-p3',
      p1_agent_id: 'agent-p1', p2_agent_id: 'agent-p2', p3_agent_id: 'agent-p3',
    });
    await handlers.handlePhronesisAbort({
      cycleId: 'cycle-d014-abort', reason: 'test abort',
    });
    assertPhronesisPostconditions(db, 'cycle-d014-abort');
    // All agents should have been retired
    expect(ctx.retireAgent).toHaveBeenCalled();
  });

  it('D014-phronesis-failed: no agents after spawn failure', async () => {
    const lifecycle = createMockLifecycle();
    (lifecycle.spawnAgent as any).mockRejectedValue(new Error('spawn failed'));
    const notifCapture = createNotificationCapture();
    const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
    const handlers = createPhronesisHandlers(ctx, {
      lifecycle,
      routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
    });
    await handlers.handlePhronesisInitiate({
      cycleId: 'cycle-d014-failed',
      task: 'test task', mode: 'recommend-only',
    });
    assertPhronesisPostconditions(db, 'cycle-d014-failed');
  });

  it('D014-phronesis-recursion-limit: current agent retired at limit', async () => {
    const { handlers } = createHandlers(db);
    setupPhronesisState(db, 'cycle-d014-rl', {
      operation: 'p3', sub_phase: 'active', status: 'active',
      current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
      p1_agent_id: 'agent-p1', p2_agent_id: 'agent-p2',
      recursion_count: 5, recursion_limit: 5,
    });
    await handlers.handlePhronesisRecurse({
      cycleId: 'cycle-d014-rl', operation: 'p3', agentId: 'agent-p3',
      target: 'p1', reason: 'too many', content: 'judgment',
    });
    assertPhronesisPostconditions(db, 'cycle-d014-rl');
  });

  it('D014-phronesis-complete: retireAllPAgents called on completion', async () => {
    const { handlers, ctx } = createHandlers(db);
    setupPhronesisState(db, 'cycle-d014-retire', {
      operation: 'p4', sub_phase: 'active', status: 'active',
      current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
      p1_agent_id: 'agent-p1', p2_agent_id: 'agent-p2', p3_agent_id: 'agent-p3',
    });
    await handlers.handlePhronesisSubmit({
      cycleId: 'cycle-d014-retire', operation: 'p4', agentId: 'agent-p4',
      content: 'decision', alignmentRationale: 'rationale',
    });
    // retireAllPAgents should retire each P-agent
    expect(ctx.retireAgent).toHaveBeenCalled();
  });

  it('D014-phronesis-aborted: terminal states reject further triggers', async () => {
    const { handlers } = createHandlers(db);
    setupPhronesisState(db, 'cycle-d014-reject', {
      operation: null, sub_phase: null, status: 'aborted',
    });
    const result = await handlers.handlePhronesisAbort({
      cycleId: 'cycle-d014-reject', reason: 'double abort',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('terminal');
  });

  // ─── D014(c): Idle/stuck agent detection ────────────────────────────────────

  it('D014-phronesis-idle: recovery should detect live agents exceeding activity timeout', () => {
    // D014 requires idle/stuck agent detection — not just dead-agent detection.
    // An agent that is alive but has not communicated for a threshold period
    // should be detected and handled.
    //
    // Setup: cycle in active phase with agent registered (active but idle)
    setupPhronesisState(db, 'cycle-d014-idle', {
      operation: 'p2', sub_phase: 'active', status: 'active',
      current_agent_id: 'agent-idle-p2', p2_agent_id: 'agent-idle-p2',
    });

    const { handlers } = createHandlers(db);

    // D014 requires the existence of a mechanism to detect and handle idle agents.
    // The recovery handler should be callable and should surface idle agents.
    //
    // WILL FAIL: no handlePhronesisRecovery or idle detection mechanism exists
    const recovery = (handlers as any).handlePhronesisRecovery;
    expect(
      recovery,
      'D014: A recovery mechanism must exist to detect idle/stuck phronesis agents',
    ).toBeDefined();
  });
});
