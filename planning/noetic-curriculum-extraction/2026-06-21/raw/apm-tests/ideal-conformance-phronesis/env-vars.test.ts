/**
 * Phronesis D016 env-var elimination tests.
 *
 * Decision: D016 (Environment Variable Elimination)
 *
 * Forbidden env vars for phronesis domain:
 *   - PHRONESIS_CYCLE_ID
 *   - PHRONESIS_OPERATION
 *
 * These are set at phronesis.ts:520-521 in the spawnPAgent function's envVars
 * object and passed to lifecycle.spawnAgent({ env: envVars }). The ideal graph
 * mandates that agents read these from their initiative/mission payload instead.
 *
 * Source: packages/apm/src/phronesis.ts (lines 520-521)
 * Ideal:  .working/state-machine-audits/ideal/phronesis.ts (F5)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers/db-setup.js';
import { createTestContext } from '../helpers/mock-context.js';
import { createSpawnCapture, FORBIDDEN_ENV_VARS } from '../helpers/spawn-capture.js';
import { createNotificationCapture } from '../helpers/notification-capture.js';
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
       ?, ?, 0, ?, ?, ?, ?, ?,
       'test question', 'test unknown', datetime('now'))`
  ).run(
    cycleId,
    state.operation, state.sub_phase, state.status,
    state.recursion_count ?? 0, state.recursion_limit ?? 5,
    state.current_agent_id ?? null,
    state.p1_agent_id ?? null, state.p2_agent_id ?? null,
    state.p3_agent_id ?? null, state.p4_agent_id ?? null,
  );
}

function createMockLifecycle(spawnCaptures?: any[]) {
  return {
    spawnAgent: vi.fn().mockImplementation(async (opts: any) => {
      if (spawnCaptures) spawnCaptures.push(opts);
      return { agentId: opts.agentId || 'spawned-agent', initiativeId: 'init-001' };
    }),
    getCurrentInitiative: vi.fn().mockReturnValue(null),
    completeInitiative: vi.fn(),
    createAgentRecord: vi.fn(),
    getAgentRecord: vi.fn().mockReturnValue(null),
    updateAgent: vi.fn(),
  } as unknown as LifecycleHandlers;
}

// =============================================================================

describe('Phronesis D016 env-var elimination — forbidden env vars', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it('D016-phronesis-initiate: PHRONESIS_CYCLE_ID must not be set in spawn env', async () => {
    const spawnCaptures: any[] = [];
    const lifecycle = createMockLifecycle(spawnCaptures);
    const notifCapture = createNotificationCapture();
    const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
    const handlers = createPhronesisHandlers(ctx, {
      lifecycle,
      routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
    });

    await handlers.handlePhronesisInitiate({
      cycleId: 'cycle-d016-1',
      task: 'test task',
      mode: 'recommend-only',
    });

    expect(spawnCaptures.length).toBeGreaterThan(0);
    for (const spawn of spawnCaptures) {
      expect(
        spawn.env,
        'D016: PHRONESIS_CYCLE_ID must not appear in spawn env',
      ).not.toHaveProperty('PHRONESIS_CYCLE_ID');
    }
  });

  it('D016-phronesis-initiate: PHRONESIS_OPERATION must not be set in spawn env', async () => {
    const spawnCaptures: any[] = [];
    const lifecycle = createMockLifecycle(spawnCaptures);
    const notifCapture = createNotificationCapture();
    const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
    const handlers = createPhronesisHandlers(ctx, {
      lifecycle,
      routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
    });

    await handlers.handlePhronesisInitiate({
      cycleId: 'cycle-d016-2',
      task: 'test task',
      mode: 'recommend-only',
    });

    expect(spawnCaptures.length).toBeGreaterThan(0);
    for (const spawn of spawnCaptures) {
      expect(
        spawn.env,
        'D016: PHRONESIS_OPERATION must not appear in spawn env',
      ).not.toHaveProperty('PHRONESIS_OPERATION');
    }
  });

  it('D016-phronesis-submit-routing: spawned next-op agent must not have forbidden env vars', async () => {
    const spawnCaptures: any[] = [];
    const lifecycle = createMockLifecycle(spawnCaptures);
    const notifCapture = createNotificationCapture();
    const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
    const handlers = createPhronesisHandlers(ctx, {
      lifecycle,
      routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
    });

    setupPhronesisState(db, 'cycle-d016-3', {
      operation: 'p1', sub_phase: 'active', status: 'active',
      current_agent_id: 'agent-p1', p1_agent_id: 'agent-p1',
    });

    await handlers.handlePhronesisSubmit({
      cycleId: 'cycle-d016-3',
      operation: 'p1',
      agentId: 'agent-p1',
      content: 'findings',
    });

    // Spawns P2 agent — check env vars
    const p2Spawn = spawnCaptures.find(s =>
      s.role?.includes('p2') || s.initiativeType?.includes('p2')
    );
    if (p2Spawn?.env) {
      for (const forbidden of FORBIDDEN_ENV_VARS.phronesis) {
        expect(
          p2Spawn.env,
          `D016: ${forbidden} must not appear in P2 spawn env`,
        ).not.toHaveProperty(forbidden);
      }
    }
  });

  it('D016-phronesis-recurse-spawn: recursion spawn must not have forbidden env vars', async () => {
    const spawnCaptures: any[] = [];
    const lifecycle = createMockLifecycle(spawnCaptures);
    const notifCapture = createNotificationCapture();
    const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
    const handlers = createPhronesisHandlers(ctx, {
      lifecycle,
      routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
    });

    setupPhronesisState(db, 'cycle-d016-4', {
      operation: 'p3', sub_phase: 'active', status: 'active',
      current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
      recursion_count: 0, recursion_limit: 5,
    });

    await handlers.handlePhronesisRecurse({
      cycleId: 'cycle-d016-4',
      operation: 'p3',
      agentId: 'agent-p3',
      target: 'p1',
      reason: 'need more data',
      content: 'judgment',
    });

    // Spawns fresh P1 agent — check env vars
    for (const spawn of spawnCaptures) {
      for (const forbidden of FORBIDDEN_ENV_VARS.phronesis) {
        expect(
          spawn.env,
          `D016: ${forbidden} must not appear in recursion spawn env`,
        ).not.toHaveProperty(forbidden);
      }
    }
  });

  it('D016-phronesis-context-delivery: phronesis agent receives cycleId and operation via structured mechanism', async () => {
    // D016 positive test (design §III.F.2): context must be available to the agent
    // via a structured mechanism (initiative params, prompt text), not just env vars.
    // For phronesis, the agent should receive cycle_id and operation in its
    // initiativeParams or mission/prompt text.
    const spawnCaptures: any[] = [];
    const lifecycle = createMockLifecycle(spawnCaptures);
    const notifCapture = createNotificationCapture();
    const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
    const handlers = createPhronesisHandlers(ctx, {
      lifecycle,
      routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
    });

    const cycleId = 'cycle-d016-context';
    await handlers.handlePhronesisInitiate({
      cycleId,
      task: 'test task',
      mode: 'recommend-only',
    });

    expect(spawnCaptures.length).toBeGreaterThan(0);

    // The phronesis agent must receive cycleId via structured delivery
    // (initiativeParams, prompt text, or bootstrap payload) — not solely env vars
    const spawn = spawnCaptures[0];
    const hasContextInParams = spawn.initiativeParams?.cycle_id === cycleId
      || spawn.initiativeParams?.cycleId === cycleId;
    const hasContextInPrompt = (spawn.prompt || spawn.mission || '').includes(cycleId);
    const hasContextInEnv = spawn.env?.PHRONESIS_CYCLE_ID === cycleId;

    // Context must be available via structured mechanism (params or prompt)
    // It's acceptable if it's ALSO in env vars, but it must exist in structured form
    expect(
      hasContextInParams || hasContextInPrompt,
      `Phronesis agent must receive cycleId (${cycleId}) via structured delivery (initiativeParams or prompt), not only env vars`,
    ).toBe(true);
  });

  it('D016-phronesis-operation-delivery: phronesis agent receives operation via structured mechanism', async () => {
    // D016 positive: operation context must also be delivered structurally
    const spawnCaptures: any[] = [];
    const lifecycle = createMockLifecycle(spawnCaptures);
    const notifCapture = createNotificationCapture();
    const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
    const handlers = createPhronesisHandlers(ctx, {
      lifecycle,
      routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
    });

    await handlers.handlePhronesisInitiate({
      cycleId: 'cycle-d016-op',
      task: 'test task',
      mode: 'recommend-only',
    });

    expect(spawnCaptures.length).toBeGreaterThan(0);

    const spawn = spawnCaptures[0];
    const hasOperationInParams = spawn.initiativeParams?.operation === 'p1';
    const hasOperationInPrompt = (spawn.prompt || spawn.mission || '').includes('p1');

    expect(
      hasOperationInParams || hasOperationInPrompt,
      'Phronesis agent must receive operation (p1) via structured delivery (initiativeParams or prompt)',
    ).toBe(true);
  });

  it('D016-phronesis-all-forbidden: comprehensive check against FORBIDDEN_ENV_VARS', async () => {
    const spawnCaptures: any[] = [];
    const lifecycle = createMockLifecycle(spawnCaptures);
    const notifCapture = createNotificationCapture();
    const ctx = createTestContext(db, { notifyAgent: notifCapture.mockNotifyAgent });
    const handlers = createPhronesisHandlers(ctx, {
      lifecycle,
      routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
    });

    await handlers.handlePhronesisInitiate({
      cycleId: 'cycle-d016-all',
      task: 'test task',
      mode: 'recommend-only',
    });

    // Check all spawns against the full forbidden list
    for (const spawn of spawnCaptures) {
      for (const v of FORBIDDEN_ENV_VARS.phronesis) {
        expect(
          spawn.env,
          `D016: env var ${v} must not be set on any phronesis spawn`,
        ).not.toHaveProperty(v);
      }
    }
  });
});
