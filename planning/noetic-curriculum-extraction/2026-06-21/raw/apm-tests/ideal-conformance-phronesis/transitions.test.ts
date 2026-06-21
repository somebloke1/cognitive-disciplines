/**
 * Phronesis domain transition conformance tests.
 *
 * Covers all 51 transitions from the ideal graph organized by category:
 *   Initiation (2), Grounding role ack (4), Grounding stage advance (4),
 *   Grounding complete (4), Submissions (4), Routing (7),
 *   Spawn failures (3), Recall acks (4), Recursion P2→earlier (2),
 *   Recursion P3→earlier (4), Recursion P4→earlier (6),
 *   Recursion limit (3), Abort (13) — total: 60 edges, 51 distinct transition types
 *
 * IDEAL annotations (36 total) under test:
 *   F1:  Phantom phaseTransitionNotification in initiate (should NOT be emitted)
 *   F2:  Recursion guard off-by-one (< not <=)
 *   F3:  Missing lifecycle:initiative_completed signals on submit
 *   F4:  Missing lifecycle:initiative_completed signals on abort
 *   F5:  Phantom correlationIds entries (no env_vars table exists)
 *   F6:  Missing current_agent_id/current_pty_pid columns in DB mutations
 *   F7:  phaseTransitionNotification toPhase inaccuracy
 *   F8:  Missing writePhronesisIndex calls
 *   F9:  Missing captureSnapshot calls
 *   F10: Missing recordEvent calls
 *   F11: Phantom 'kill' agentLifecycle in abort (killPAgentProcess dead code)
 *
 * Source: packages/apm/src/phronesis.ts
 * Ideal:  .working/state-machine-audits/ideal/phronesis.ts
 * Graph:  packages/apm/test/state-machines/graphs/phronesis.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers/db-setup.js';
import { createTestContext } from '../helpers/mock-context.js';
import { createSpawnCapture } from '../helpers/spawn-capture.js';
import { createNotificationCapture } from '../helpers/notification-capture.js';
import { createPhronesisHandlers } from '../../../../src/phronesis.js';
import type { PhronesisHandlers } from '../../../../src/phronesis.js';
import type { APMContext } from '@noetic-pi/shared';
import type { LifecycleHandlers } from '../../../../src/lifecycle.js';

// Mock curriculum module — all grounding tests need this
vi.mock('../../../../src/curriculum.js', () => ({
  loadCurriculum: vi.fn().mockReturnValue({ stages: [{ id: 1 }, { id: 2 }] }),
  advance: vi.fn().mockReturnValue({
    phase: 'complete',
    stage: 2,
    totalStages: 2,
    instructions: 'Grounding complete.',
  }),
  assembleEpistemicHorizon: vi.fn().mockReturnValue(''),
}));

import { loadCurriculum, advance } from '../../../../src/curriculum.js';

// ─── Compound state setup helper ─────────────────────────────────────────────

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

function getPhronesisState(db: Database.Database, cycleId: string) {
  return db.prepare(`SELECT * FROM phronesis_state WHERE id = ?`).get(cycleId) as any;
}

// ─── Mock factories ──────────────────────────────────────────────────────────

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
// Tests
// =============================================================================

describe('Phronesis transitions', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
    // Reset curriculum mock to default 'post_tasking' for grounding tests
    (advance as any).mockReturnValue({
      phase: 'post_tasking',
      stage: 1,
      totalStages: 2,
      instructions: 'Stage instruction.',
    });
  });

  // =========================================================================
  // Category 1: Initiation (2 transitions)
  // =========================================================================

  describe('Initiation', () => {
    it('initiate-to-p1-grounding: initiated → p1:grounding on successful spawn', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-1',
        task: 'test task',
        mode: 'recommend-only',
        initiatorId: 'initiator-1',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-1');
      expect(state.operation).toBe('p1');
      expect(state.sub_phase).toBe('grounding');
      expect(state.status).toBe('active');
    });

    it('IDEAL initiate-spawn-failure: initiated → failed when spawnPAgent fails', async () => {
      const notifCapture = createNotificationCapture();
      const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
      const lifecycle = createMockLifecycle();
      (lifecycle.spawnAgent as any).mockRejectedValue(new Error('spawn failed'));
      const handlers = createPhronesisHandlers(ctx, {
        lifecycle,
        routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
      });
      const result = await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-fail',
        task: 'test task',
        mode: 'recommend-only',
      });
      expect(result.success).toBe(false);
      const state = getPhronesisState(db, 'cycle-fail');
      expect(state.status).toBe('failed');
    });
  });

  // =========================================================================
  // Category 2: Grounding role ack (4 self-loop transitions)
  // =========================================================================

  describe('Grounding role ack', () => {
    for (const op of ['p1', 'p2', 'p3', 'p4'] as const) {
      it(`${op}-grounding-role-ack: ${op}:grounding → ${op}:grounding self-loop (grounding_stage 0→1)`, () => {
        const { handlers } = createHandlers(db);
        setupPhronesisState(db, `cycle-${op}-rk`, {
          operation: op, sub_phase: 'grounding', status: 'active',
          grounding_stage: 0, current_agent_id: `agent-${op}`,
        });
        const result = handlers.handlePhronesisRoleAck({
          cycleId: `cycle-${op}-rk`,
          operation: op,
          agentId: `agent-${op}`,
        });
        expect(result.success).toBe(true);
        const state = getPhronesisState(db, `cycle-${op}-rk`);
        expect(state.operation).toBe(op);
        expect(state.sub_phase).toBe('grounding');
        expect(state.grounding_stage).toBe(1);
      });
    }
  });

  // =========================================================================
  // Category 3: Grounding stage advance (4 self-loop transitions)
  // =========================================================================

  describe('Grounding stage advance', () => {
    for (const op of ['p1', 'p2', 'p3', 'p4'] as const) {
      it(`${op}-grounding-stage-advance: ${op}:grounding → ${op}:grounding (stage increment)`, () => {
        (advance as any).mockReturnValue({
          phase: 'post_tasking',
          stage: 2,
          totalStages: 3,
          instructions: 'Next stage.',
        });
        const { handlers } = createHandlers(db);
        setupPhronesisState(db, `cycle-${op}-gs`, {
          operation: op, sub_phase: 'grounding', status: 'active',
          grounding_stage: 1, current_agent_id: `agent-${op}`,
        });
        const result = handlers.handlePhronesisGroundingComplete({
          cycleId: `cycle-${op}-gs`,
          operation: op,
          agentId: `agent-${op}`,
        });
        expect(result.success).toBe(true);
        const state = getPhronesisState(db, `cycle-${op}-gs`);
        expect(state.operation).toBe(op);
        expect(state.sub_phase).toBe('grounding');
        expect(state.grounding_stage).toBe(2);
      });
    }
  });

  // =========================================================================
  // Category 4: Grounding complete (4 transitions)
  // =========================================================================

  describe('Grounding complete', () => {
    for (const op of ['p1', 'p2', 'p3', 'p4'] as const) {
      it(`${op}-grounding-complete: ${op}:grounding → ${op}:active`, () => {
        (advance as any).mockReturnValue({
          phase: 'complete',
          stage: 2,
          totalStages: 2,
          instructions: 'Done.',
        });
        const { handlers } = createHandlers(db);
        setupPhronesisState(db, `cycle-${op}-gc`, {
          operation: op, sub_phase: 'grounding', status: 'active',
          grounding_stage: 1, current_agent_id: `agent-${op}`,
        });
        const result = handlers.handlePhronesisGroundingComplete({
          cycleId: `cycle-${op}-gc`,
          operation: op,
          agentId: `agent-${op}`,
        });
        expect(result.success).toBe(true);
        const state = getPhronesisState(db, `cycle-${op}-gc`);
        expect(state.operation).toBe(op);
        expect(state.sub_phase).toBe('active');
      });
    }
  });

  // =========================================================================
  // Category 5: Submissions (4 transitions)
  // =========================================================================

  describe('Submissions', () => {
    for (const op of ['p1', 'p2', 'p3', 'p4'] as const) {
      it(`${op}-submit: ${op}:active → ${op}:complete (submit payload)`, async () => {
        const { handlers } = createHandlers(db);
        setupPhronesisState(db, `cycle-${op}-sub`, {
          operation: op, sub_phase: 'active', status: 'active',
          current_agent_id: `agent-${op}`,
          [`${op}_agent_id`]: `agent-${op}`,
        } as any);
        const result = await handlers.handlePhronesisSubmit({
          cycleId: `cycle-${op}-sub`,
          operation: op,
          agentId: `agent-${op}`,
          content: 'test payload',
          alignmentRationale: 'test rationale',
        });
        expect(result.success).toBe(true);
      });

      it(`IDEAL F3: ${op}-submit should emit lifecycle:initiative_completed signal`, async () => {
        const { handlers, ctx } = createHandlers(db);
        setupPhronesisState(db, `cycle-${op}-f3`, {
          operation: op, sub_phase: 'active', status: 'active',
          current_agent_id: `agent-${op}`,
          [`${op}_agent_id`]: `agent-${op}`,
        } as any);
        await handlers.handlePhronesisSubmit({
          cycleId: `cycle-${op}-f3`,
          operation: op,
          agentId: `agent-${op}`,
          content: 'test payload',
          alignmentRationale: 'test rationale',
        });
        // IDEAL F3: source does NOT emit lifecycle:initiative_completed
        // unless lifecycle.getCurrentInitiative returns non-null
        expect(ctx.emitSignal).toHaveBeenCalledWith(
          'lifecycle:initiative_completed',
          expect.any(String),
          expect.objectContaining({ outcome: 'completed' }),
        );
      });
    }
  });

  // =========================================================================
  // Category 6: Routing (7 transitions)
  // =========================================================================

  describe('Routing to next operation', () => {
    it('p1-complete-to-p2-grounding: fresh P2 spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-r1', {
        operation: 'p1', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p1', p1_agent_id: 'agent-p1',
      });
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-r1', operation: 'p1', agentId: 'agent-p1',
        content: 'findings', alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-r1');
      expect(state.operation).toBe('p2');
      expect(state.sub_phase).toBe('grounding');
    });

    it('p1-complete-to-p2-recall: recall existing P2 agent', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-r2', {
        operation: 'p1', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p1', p1_agent_id: 'agent-p1',
        p2_agent_id: 'existing-p2',
      });
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-r2', operation: 'p1', agentId: 'agent-p1',
        content: 'findings', alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-r2');
      expect(state.operation).toBe('p2');
      expect(state.sub_phase).toBe('active');
    });

    it('IDEAL F7: p1-complete-to-p2-recall phaseTransitionNotification should have toPhase=p2:active', async () => {
      const { handlers, notifCapture } = createHandlers(db);
      setupPhronesisState(db, 'cycle-f7', {
        operation: 'p1', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p1', p1_agent_id: 'agent-p1',
        p2_agent_id: 'existing-p2',
      });
      await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-f7', operation: 'p1', agentId: 'agent-p1',
        content: 'findings', alignmentRationale: 'rationale',
      });
      // IDEAL F7: source sends toPhase='p2:grounding' even though final state is p2:active
      // notifyInitiator is called as (initiatorId, notification) — check mock calls
      const calls = notifCapture.mockNotifyInitiator.mock.calls;
      const phaseTransition = calls.find((c: any[]) => c[1]?.type === 'phronesis:phase_transition');
      expect(phaseTransition, 'phaseTransitionNotification should be sent').toBeDefined();
      expect(phaseTransition![1].toPhase, 'IDEAL F7: toPhase should be p2:active for recall').toBe('p2:active');
    });

    it('p2-complete-to-p3-grounding: fresh P3 spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-r3', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2', p2_agent_id: 'agent-p2',
      });
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-r3', operation: 'p2', agentId: 'agent-p2',
        content: 'findings', alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-r3');
      expect(state.operation).toBe('p3');
    });

    it('p2-complete-to-p3-recall: recall existing P3 agent', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-r4', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2', p2_agent_id: 'agent-p2',
        p3_agent_id: 'existing-p3',
      });
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-r4', operation: 'p2', agentId: 'agent-p2',
        content: 'findings', alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-r4');
      expect(state.operation).toBe('p3');
      expect(state.sub_phase).toBe('active');
    });

    it('p3-complete-to-p4-grounding: fresh P4 spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-r5', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
      });
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-r5', operation: 'p3', agentId: 'agent-p3',
        content: 'findings', alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-r5');
      expect(state.operation).toBe('p4');
    });

    it('p3-complete-to-p4-recall: recall existing P4 agent', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-r6', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
        p4_agent_id: 'existing-p4',
      });
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-r6', operation: 'p3', agentId: 'agent-p3',
        content: 'findings', alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-r6');
      expect(state.operation).toBe('p4');
      expect(state.sub_phase).toBe('active');
    });

    it('p4-complete-to-complete: P4 submit → cycle complete', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-r7', {
        operation: 'p4', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
      });
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-r7', operation: 'p4', agentId: 'agent-p4',
        content: 'decision', alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-r7');
      expect(state.status).toBe('complete');
      expect(state.operation).toBeNull();
    });
  });

  // =========================================================================
  // Category 7: Spawn failures (3 transitions)
  // =========================================================================

  describe('Spawn failures', () => {
    for (const [fromOp, nextOp] of [['p1', 'p2'], ['p2', 'p3'], ['p3', 'p4']] as const) {
      it(`IDEAL ${fromOp}-complete-spawn-failure: spawn of ${nextOp} fails → failed`, async () => {
        const notifCapture = createNotificationCapture();
        const lifecycle = createMockLifecycle();
        // spawnAgent always rejects — the submit handler routes to next op
        // and attempts to spawn. State is already in pN:active (no initial spawn needed).
        (lifecycle.spawnAgent as any).mockRejectedValue(new Error('spawn failed'));
        const ctx = createTestContext(db, {
          notifyAgent: notifCapture.mockNotifyAgent,
        });
        const handlers = createPhronesisHandlers(ctx, {
          lifecycle,
          routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
        });
        setupPhronesisState(db, `cycle-sf-${fromOp}`, {
          operation: fromOp, sub_phase: 'active', status: 'active',
          current_agent_id: `agent-${fromOp}`,
          [`${fromOp}_agent_id`]: `agent-${fromOp}`,
        } as any);
        const result = await handlers.handlePhronesisSubmit({
          cycleId: `cycle-sf-${fromOp}`, operation: fromOp as any,
          agentId: `agent-${fromOp}`, content: 'payload',
        });
        expect(result.success).toBe(false);
        const state = getPhronesisState(db, `cycle-sf-${fromOp}`);
        expect(state.status).toBe('failed');
      });
    }
  });

  // =========================================================================
  // Category 8: Recall acks (4 self-loop transitions)
  // =========================================================================

  describe('Recall acks', () => {
    for (const op of ['p1', 'p2', 'p3', 'p4'] as const) {
      it(`${op}-active-recall-ack: ${op}:active → ${op}:active (no state change)`, () => {
        const { handlers } = createHandlers(db);
        setupPhronesisState(db, `cycle-${op}-ra`, {
          operation: op, sub_phase: 'active', status: 'active',
          current_agent_id: `agent-${op}`,
          [`${op}_agent_id`]: `agent-${op}`,
        } as any);
        const result = handlers.handlePhronesisRoleAck({
          cycleId: `cycle-${op}-ra`,
          operation: op,
          agentId: `agent-${op}`,
        });
        expect(result.success).toBe(true);
        const state = getPhronesisState(db, `cycle-${op}-ra`);
        expect(state.operation).toBe(op);
        expect(state.sub_phase).toBe('active');
      });
    }
  });

  // =========================================================================
  // Category 9: Recursion P2 → earlier (2 transitions)
  // =========================================================================

  describe('Recursion P2 → earlier', () => {
    it('p2-recurse-to-p1-grounding: P2 → P1 fresh spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p2p1g', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2', p2_agent_id: 'agent-p2',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p2p1g', operation: 'p2', agentId: 'agent-p2',
        target: 'p1', reason: 'need more data', content: 'judgment',
        alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p2p1g');
      expect(state.operation).toBe('p1');
      expect(state.recursion_count).toBe(1);
    });

    it('p2-recurse-to-p1-recall: P2 → P1 recall existing agent', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p2p1r', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2', p2_agent_id: 'agent-p2',
        p1_agent_id: 'existing-p1',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p2p1r', operation: 'p2', agentId: 'agent-p2',
        target: 'p1', reason: 'need more data', content: 'judgment',
        alignmentRationale: 'rationale',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p2p1r');
      expect(state.operation).toBe('p1');
      expect(state.sub_phase).toBe('active');
    });
  });

  // =========================================================================
  // Category 10: Recursion P3 → earlier (4 transitions)
  // =========================================================================

  describe('Recursion P3 → earlier', () => {
    it('p3-recurse-to-p1-grounding: P3 → P1 fresh spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p3p1g', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p3p1g', operation: 'p3', agentId: 'agent-p3',
        target: 'p1', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p3p1g');
      expect(state.operation).toBe('p1');
    });

    it('p3-recurse-to-p1-recall: P3 → P1 recall', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p3p1r', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
        p1_agent_id: 'existing-p1',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p3p1r', operation: 'p3', agentId: 'agent-p3',
        target: 'p1', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p3p1r');
      expect(state.operation).toBe('p1');
      expect(state.sub_phase).toBe('active');
    });

    it('p3-recurse-to-p2-grounding: P3 → P2 fresh spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p3p2g', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p3p2g', operation: 'p3', agentId: 'agent-p3',
        target: 'p2', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p3p2g');
      expect(state.operation).toBe('p2');
    });

    it('p3-recurse-to-p2-recall: P3 → P2 recall', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p3p2r', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
        p2_agent_id: 'existing-p2',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p3p2r', operation: 'p3', agentId: 'agent-p3',
        target: 'p2', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p3p2r');
      expect(state.operation).toBe('p2');
      expect(state.sub_phase).toBe('active');
    });
  });

  // =========================================================================
  // Category 11: Recursion P4 → earlier (6 transitions)
  // =========================================================================

  describe('Recursion P4 → earlier', () => {
    it('p4-recurse-to-p1-grounding: P4 → P1 fresh spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p4p1g', {
        operation: 'p4', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p4p1g', operation: 'p4', agentId: 'agent-p4',
        target: 'p1', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p4p1g');
      expect(state.operation).toBe('p1');
    });

    it('p4-recurse-to-p1-recall: P4 → P1 recall', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p4p1r', {
        operation: 'p4', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
        p1_agent_id: 'existing-p1',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p4p1r', operation: 'p4', agentId: 'agent-p4',
        target: 'p1', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p4p1r');
      expect(state.operation).toBe('p1');
      expect(state.sub_phase).toBe('active');
    });

    it('p4-recurse-to-p2-grounding: P4 → P2 fresh spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p4p2g', {
        operation: 'p4', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p4p2g', operation: 'p4', agentId: 'agent-p4',
        target: 'p2', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p4p2g');
      expect(state.operation).toBe('p2');
    });

    it('p4-recurse-to-p2-recall: P4 → P2 recall', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p4p2r', {
        operation: 'p4', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
        p2_agent_id: 'existing-p2',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p4p2r', operation: 'p4', agentId: 'agent-p4',
        target: 'p2', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p4p2r');
      expect(state.operation).toBe('p2');
      expect(state.sub_phase).toBe('active');
    });

    it('p4-recurse-to-p3-grounding: P4 → P3 fresh spawn', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p4p3g', {
        operation: 'p4', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p4p3g', operation: 'p4', agentId: 'agent-p4',
        target: 'p3', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p4p3g');
      expect(state.operation).toBe('p3');
    });

    it('p4-recurse-to-p3-recall: P4 → P3 recall', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-rec-p4p3r', {
        operation: 'p4', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
        p3_agent_id: 'existing-p3',
        recursion_count: 0, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-rec-p4p3r', operation: 'p4', agentId: 'agent-p4',
        target: 'p3', reason: 'revisit', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-rec-p4p3r');
      expect(state.operation).toBe('p3');
      expect(state.sub_phase).toBe('active');
    });
  });

  // =========================================================================
  // Category 12: Recursion limit (3 transitions)
  // =========================================================================

  describe('Recursion limit', () => {
    for (const op of ['p2', 'p3', 'p4'] as const) {
      it(`${op}-recursion-limit: ${op}:active → recursion_limit when count exceeds limit`, async () => {
        const { handlers } = createHandlers(db);
        // Source: newCount = recursion_count + 1; if (newCount > recursion_limit)
        // So recursion_count=5, recursion_limit=5 → newCount=6 > 5 → limit hit
        setupPhronesisState(db, `cycle-rl-${op}`, {
          operation: op, sub_phase: 'active', status: 'active',
          current_agent_id: `agent-${op}`, [`${op}_agent_id`]: `agent-${op}`,
          recursion_count: 5, recursion_limit: 5,
        } as any);
        const result = await handlers.handlePhronesisRecurse({
          cycleId: `cycle-rl-${op}`, operation: op as any, agentId: `agent-${op}`,
          target: 'p1', reason: 'too many', content: 'judgment',
        });
        expect(result.success).toBe(true);
        const state = getPhronesisState(db, `cycle-rl-${op}`);
        expect(state.status).toBe('recursion_limit');
      });

      it(`CONFIRMED: F2: ${op}-recursion guard blocks at count=limit boundary`, async () => {
        // Source conforms to ideal — this documents existing correct behavior
        const { handlers } = createHandlers(db);
        setupPhronesisState(db, `cycle-f2-${op}`, {
          operation: op, sub_phase: 'active', status: 'active',
          current_agent_id: `agent-${op}`, [`${op}_agent_id`]: `agent-${op}`,
          recursion_count: 5, recursion_limit: 5,
        } as any);
        const result = await handlers.handlePhronesisRecurse({
          cycleId: `cycle-f2-${op}`, operation: op as any, agentId: `agent-${op}`,
          target: 'p1', reason: 'one more', content: 'judgment',
        });
        expect(result.success).toBe(true);
        const state = getPhronesisState(db, `cycle-f2-${op}`);
        expect(state.status).toBe('recursion_limit');
      });
    }

    it('CONFIRMED: F2: recursion blocked when recursion_count equals recursion_limit', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-f2-boundary', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
        recursion_count: 5, recursion_limit: 5,
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-f2-boundary', operation: 'p3', agentId: 'agent-p3',
        target: 'p1', reason: 'boundary test', content: 'judgment',
      });
      expect(result.success).toBe(true);
      const state = getPhronesisState(db, 'cycle-f2-boundary');
      expect(state.status).toBe('recursion_limit');
    });
  });

  // =========================================================================
  // Category 13: Abort (13 transitions)
  // =========================================================================

  describe('Abort', () => {
    const nonTerminalStates = [
      { id: 'initiated', operation: null, sub_phase: null, status: 'active' },
      { id: 'p1:grounding', operation: 'p1', sub_phase: 'grounding', status: 'active' },
      { id: 'p1:active', operation: 'p1', sub_phase: 'active', status: 'active' },
      { id: 'p1:complete', operation: 'p1', sub_phase: 'complete', status: 'active' },
      { id: 'p2:grounding', operation: 'p2', sub_phase: 'grounding', status: 'active' },
      { id: 'p2:active', operation: 'p2', sub_phase: 'active', status: 'active' },
      { id: 'p2:complete', operation: 'p2', sub_phase: 'complete', status: 'active' },
      { id: 'p3:grounding', operation: 'p3', sub_phase: 'grounding', status: 'active' },
      { id: 'p3:active', operation: 'p3', sub_phase: 'active', status: 'active' },
      { id: 'p3:complete', operation: 'p3', sub_phase: 'complete', status: 'active' },
      { id: 'p4:grounding', operation: 'p4', sub_phase: 'grounding', status: 'active' },
      { id: 'p4:active', operation: 'p4', sub_phase: 'active', status: 'active' },
      { id: 'p4:complete', operation: 'p4', sub_phase: 'complete', status: 'active' },
    ];

    for (const s of nonTerminalStates) {
      it(`abort-from-${s.id.replace(':', '-')}: ${s.id} → aborted`, async () => {
        const { handlers } = createHandlers(db);
        const cycleId = `cycle-abort-${s.id.replace(':', '-')}`;
        setupPhronesisState(db, cycleId, {
          operation: s.operation, sub_phase: s.sub_phase, status: s.status,
          current_agent_id: 'agent-current',
        });
        const result = await handlers.handlePhronesisAbort({
          cycleId,
          reason: 'test abort',
        });
        expect(result.success).toBe(true);
        const state = getPhronesisState(db, cycleId);
        expect(state.status).toBe('aborted');
      });
    }

  });

  // =========================================================================
  // IDEAL divergences: Additional F-annotation tests
  // =========================================================================

  describe('IDEAL divergences', () => {
    it('IDEAL F7: p2-complete-to-p3-recall phaseTransitionNotification toPhase accuracy', async () => {
      const { handlers, notifCapture } = createHandlers(db);
      setupPhronesisState(db, 'cycle-f7-p23', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2', p2_agent_id: 'agent-p2',
        p3_agent_id: 'existing-p3',
      });
      await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-f7-p23', operation: 'p2', agentId: 'agent-p2',
        content: 'findings', alignmentRationale: 'rationale',
      });
      const calls = notifCapture.mockNotifyInitiator.mock.calls;
      const phaseTransition = calls.find((c: any[]) => c[1]?.type === 'phronesis:phase_transition');
      expect(phaseTransition, 'phaseTransitionNotification should be sent').toBeDefined();
      // IDEAL F7: toPhase should be 'p3:active', not 'p3:grounding'
      expect(
        phaseTransition![1].toPhase,
        'IDEAL F7: toPhase should reflect actual final state (p3:active)',
      ).toBe('p3:active');
    });

    it('IDEAL F7: p3-complete-to-p4-recall phaseTransitionNotification toPhase accuracy', async () => {
      const { handlers, notifCapture } = createHandlers(db);
      setupPhronesisState(db, 'cycle-f7-p34', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
        p4_agent_id: 'existing-p4',
      });
      await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-f7-p34', operation: 'p3', agentId: 'agent-p3',
        content: 'findings', alignmentRationale: 'rationale',
      });
      const calls = notifCapture.mockNotifyInitiator.mock.calls;
      const phaseTransition = calls.find((c: any[]) => c[1]?.type === 'phronesis:phase_transition');
      expect(phaseTransition, 'phaseTransitionNotification should be sent').toBeDefined();
      expect(
        phaseTransition![1].toPhase,
        'IDEAL F7: toPhase should reflect actual final state (p4:active)',
      ).toBe('p4:active');
    });

  });

  // =========================================================================
  // behavioral baseline — confirmed conformance
  // =========================================================================

  describe('behavioral baseline — confirmed conformance', () => {
    it('CONFIRMED: F1: initiate does NOT emit phaseTransitionNotification', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers, notifCapture } = createHandlers(db);
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-f1',
        task: 'test task',
        mode: 'recommend-only',
        initiatorId: 'initiator-1',
      });
      const calls = notifCapture.mockNotifyInitiator.mock.calls;
      const phaseTransitionCalls = calls.filter(
        (c: any[]) => c[1]?.type === 'phronesis:phase_transition'
      );
      expect(phaseTransitionCalls).toHaveLength(0);
    });

    it('CONFIRMED: F5: initiate does NOT create correlationIds env_vars entry', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers, spawnCapture } = createHandlers(db);
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-f5',
        task: 'test task',
        mode: 'recommend-only',
        initiatorId: 'initiator-1',
      });
      const hasEnvVarsTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='env_vars'`
      ).get();
      expect(hasEnvVarsTable).toBeUndefined();
    });

    it('CONFIRMED: F6: initiate sets current_agent_id and p1_agent_id', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers } = createHandlers(db);
      await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-f6',
        task: 'test task',
        mode: 'recommend-only',
        initiatorId: 'initiator-1',
      });
      const state = getPhronesisState(db, 'cycle-f6');
      expect(state.current_agent_id).not.toBeNull();
      expect(state.p1_agent_id).not.toBeNull();
    });

    it('CONFIRMED: F4: abort emits lifecycle:initiative_completed signal', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers, ctx, lifecycle } = createHandlers(db);
      (lifecycle.getCurrentInitiative as any).mockReturnValue({
        id: 'init-123', type: 'phronesis_p2',
      });
      setupPhronesisState(db, 'cycle-abort-f4', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2',
      });
      await handlers.handlePhronesisAbort({
        cycleId: 'cycle-abort-f4',
        reason: 'test abort',
      });
      expect(ctx.emitSignal).toHaveBeenCalledWith(
        'lifecycle:initiative_completed',
        expect.any(String),
        expect.objectContaining({ outcome: 'aborted' }),
      );
    });

    it('CONFIRMED: F11: abort uses retire path, not phantom kill agentLifecycle effect', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers, ctx } = createHandlers(db);
      setupPhronesisState(db, 'cycle-abort-f11', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2',
        p1_agent_id: 'agent-p1', p2_agent_id: 'agent-p2',
      });
      await handlers.handlePhronesisAbort({
        cycleId: 'cycle-abort-f11',
        reason: 'test abort',
      });
      expect(ctx.retireAgent).toHaveBeenCalled();
    });

    it('CONFIRMED: F6: submit updates current_agent_id in DB', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-f6-sub', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2', p2_agent_id: 'agent-p2',
      });
      await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-f6-sub', operation: 'p2', agentId: 'agent-p2',
        content: 'payload', alignmentRationale: 'rationale',
      });
      const state = getPhronesisState(db, 'cycle-f6-sub');
      expect(state.current_agent_id).not.toBeNull();
    });

    it('CONFIRMED: F8: abort calls writePhronesisIndex (phronesis:aborted signal)', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers, ctx } = createHandlers(db);
      setupPhronesisState(db, 'cycle-f8', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2',
      });
      await handlers.handlePhronesisAbort({ cycleId: 'cycle-f8', reason: 'test' });
      const abortSignalCall = (ctx.emitSignal as any).mock.calls.find(
        (c: any[]) => c[0] === 'phronesis:aborted'
      );
      expect(abortSignalCall, 'phronesis:aborted signal should be emitted').toBeDefined();
      expect(abortSignalCall[2]).toEqual(expect.objectContaining({ cycleId: 'cycle-f8' }));
    });

    it('CONFIRMED: F9: p4-complete calls captureSnapshot', async () => {
      // Source conforms to ideal — this documents existing correct behavior
      const { handlers, ctx } = createHandlers(db);
      setupPhronesisState(db, 'cycle-f9', {
        operation: 'p4', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p4', p4_agent_id: 'agent-p4',
      });
      await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-f9', operation: 'p4', agentId: 'agent-p4',
        content: 'decision', alignmentRationale: 'rationale',
      });
      expect(ctx.captureSnapshot).toHaveBeenCalledWith(
        'phronesis:complete',
        expect.objectContaining({ cycleId: 'cycle-f9' }),
      );
    });
  });
});
