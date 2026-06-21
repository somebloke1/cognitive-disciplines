/**
 * Phronesis — Multi-agent cognitional cycle orchestration.
 *
 * Enacts R(P1 → P2 → P3 → P4 → R) through functionally specialized agents.
 * APM manages spawning, content forwarding, recursion routing, and archive output.
 *
 * Phase graph:
 *   initiated → p1:grounding → p1:active → p1:complete →
 *               p2:grounding → p2:active → p2:complete →
 *               p3:grounding → p3:active → p3:complete →
 *                 → [advance] → p4:grounding → p4:active → p4:complete → complete
 *                 → [recurse:p1] → p1:active (recall, no regrounding)
 *                 → [recurse:p2] → p2:active (recall, no regrounding)
 *   P2–P4 can recurse to any prior operation. Recalled agents skip grounding.
 *
 * Terminal states: aborted, failed, recursion_limit
 *
 * Uses shared StateMachine for state access/mutation.
 *
 * Ported from pi2/src/apm/phronesis.js to TypeScript with:
 * - pane_id → pty_pid
 * - tmuxCmd → process.kill / killProcess via spawn module
 * - console.log → ctx.log
 */

import { StateMachine } from './state-machine.js';
import type { APMContext } from '@noetic-pi/shared';
import type { LifecycleHandlers } from './lifecycle.js';
import { isAgentOperational } from './census.js';
import { resolveModel } from './model-resolution.js';
import { createPhronesisGroundingProtocolHandlers } from './phronesis-grounding-protocol.js';
import { createPhronesisAgentLifecycleHandlers } from './phronesis-agent-lifecycle.js';
import { createPhronesisContentArchiveHandlers } from './phronesis-content-archive.js';
import { createPhronesisProgressionHandlers } from './phronesis-progression-engine.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maps phronesis operations to model policy tiers */
const ROLE_TIER_MAP: Record<string, string> = {
  p1: 'complex',
  p2: 'standard',
  p3: 'complex',
  p4: 'standard',
};

function normalizeDefaultOverrides(
  overrides?: Partial<Record<PhronesisOperation, string>>
): Partial<Record<PhronesisOperation, string>> {
  if (!overrides) return {};

  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== 'default')
  ) as Partial<Record<PhronesisOperation, string>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Valid phronesis cycle modes */
export type PhronesisMode = 'recommend-only' | 'decision-only' | 'decide-and-enact';

/** Valid P-operations */
export type PhronesisOperation = 'p1' | 'p2' | 'p3' | 'p4';

/** Valid sub-phase labels within an active operation */
export type PhronesisSubPhase = 'grounding' | 'active' | 'complete';

/** Valid cycle-level status values */
export type PhronesisStatus = 'active' | 'complete' | 'aborted' | 'failed' | 'recursion_limit';

/** Row shape from phronesis_state table */
export interface PhronesisState {
  [key: string]: unknown;
  id: string;
  operation: PhronesisOperation | null;
  sub_phase: PhronesisSubPhase | null;
  status: PhronesisStatus;
  mode: PhronesisMode;
  task: string;
  initiator_id: string | null;
  current_agent_id: string | null;
  current_pty_pid: number | null;
  parent_cycle_id: string | null;
  recursion_count: number;
  recursion_limit: number;
  models: string;
  providers: string;
  timestamps: string | Record<string, string>;
  updated_at: string | null;
  p1_agent_id: string | null;
  p2_agent_id: string | null;
  p3_agent_id: string | null;
  p4_agent_id: string | null;
  grounding_stage: number;
  orienting_question: string | null;
  implicit_unknown: string | null;
}

/** Content row from phronesis_content table */
export interface PhronesisContentRow {
  id?: number;
  cycle_id: string;
  phase: string;
  pass: number;
  agent_id: string | null;
  payload: string;
  feedback: string | null;
  timestamp: string;
}

/** Payload for handlePhronesisInitiate */
export interface PhronesisInitiatePayload {
  cycleId: string;
  task: string;
  mode: PhronesisMode;
  recursionLimit?: number;
  initiatorId?: string;
  models?: Partial<Record<PhronesisOperation, string>>;
  providers?: Partial<Record<PhronesisOperation, string>>;
  orientingQuestion?: string;
  implicitUnknown?: string;
}

/** Payload for handlePhronesisSubmit */
export interface PhronesisSubmitPayload {
  cycleId?: string;
  operation?: PhronesisOperation;
  pass?: number;
  agentId?: string;
  content: string;
  alignmentRationale?: string;
}

/** Payload for handlePhronesisRecurse */
export interface PhronesisRecursePayload {
  cycleId?: string;
  operation?: PhronesisOperation;
  agentId?: string;
  target: PhronesisOperation;
  reason: string;
  content: string;
  alignmentRationale?: string;
}

/** Payload for grounding complete */
export interface PhronesisGroundingCompletePayload {
  cycleId?: string;
  operation?: PhronesisOperation;
  agentId?: string;
}

/** Payload for role ack */
export interface PhronesisRoleAckPayload {
  cycleId?: string;
  operation?: PhronesisOperation;
  agentId?: string;
}

/** Payload for abort */
export interface PhronesisAbortPayload {
  cycleId: string;
  agentId?: string;
  reason?: string;
}

/** Payload for get state / get content / get formatted content */
export interface PhronesisCyclePayload {
  cycleId?: string;
  agentId?: string;
}

/** Generic success/error result */
export interface PhronesisResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Handlers returned by createPhronesisHandlers */
export interface PhronesisHandlers {
  handlePhronesisInitiate: (payload: PhronesisInitiatePayload) => Promise<PhronesisResult>;
  handlePhronesisSubmit: (payload: PhronesisSubmitPayload) => Promise<PhronesisResult>;
  handlePhronesisRecurse: (payload: PhronesisRecursePayload) => Promise<PhronesisResult>;
  handlePhronesisGroundingComplete: (payload: PhronesisGroundingCompletePayload) => PhronesisResult;
  handlePhronesisRoleAck: (payload: PhronesisRoleAckPayload) => PhronesisResult;
  handlePhronesisAbort: (payload: PhronesisAbortPayload) => Promise<PhronesisResult>;
  handlePhronesisGetState: (payload: PhronesisCyclePayload) => PhronesisResult;
  handlePhronesisGetContent: (payload: PhronesisCyclePayload) => PhronesisResult;
  handlePhronesisGetFormattedContent: (payload: PhronesisCyclePayload) => PhronesisResult;
  handlePhronesisListCycles: () => PhronesisResult;
  handlePhronesisRecovery: (payload?: { cycleId?: string }) => Promise<PhronesisResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/** Dependencies injected into phronesis handlers. */
export interface PhronesisDeps {
  lifecycle: LifecycleHandlers;
  routing: Pick<import('./routing.js').RoutingHandlers, 'notifyInitiator'>;
}

/**
 * Synthesize a backward-compatible compound phase string from structured fields.
 * Used for API responses and display strings.
 */
function getPhaseString(state: Pick<PhronesisState, 'operation' | 'sub_phase' | 'status'>): string {
  if (state.operation !== null && state.sub_phase !== null) {
    return `${state.operation}:${state.sub_phase}`;
  }
  return state.status === 'active' ? 'initiated' : state.status;
}

export function createPhronesisHandlers(ctx: APMContext, deps: PhronesisDeps): PhronesisHandlers {
  const {
    db,
    cwd,
    recordEvent,
    emitSignal,
    notifyRole,
    notifyAgent,
    loadPromptFragment,
    captureSnapshot = (() => {}) as APMContext['captureSnapshot'],
    log,
  } = ctx;
  const lifecycle = deps.lifecycle;
  const { notifyInitiator: _injectedNotifyInitiator } = deps.routing;

  const sm = new StateMachine<PhronesisState>({
    db,
    table: 'phronesis_state',
    recordEvent,
    trackUpdatedAt: true,
  });

  function inferOperationForAgent(state: PhronesisState, agentId: string): PhronesisOperation | null {
    if (state.current_agent_id === agentId && state.operation) {
      return state.operation;
    }
    for (const op of ['p1', 'p2', 'p3', 'p4'] as const) {
      if (state[`${op}_agent_id`] === agentId) {
        return op;
      }
    }
    return null;
  }

  function resolvePhronesisRoutingByAgentId(agentId: string): {
    cycleId: string;
    operation: PhronesisOperation | null;
  } | null {
    const row = db.prepare(
      `SELECT * FROM phronesis_state
       WHERE status = 'active'
         AND (current_agent_id = ? OR p1_agent_id = ? OR p2_agent_id = ? OR p3_agent_id = ? OR p4_agent_id = ?)
       ORDER BY updated_at DESC
       LIMIT 1`
    ).get(agentId, agentId, agentId, agentId, agentId) as PhronesisState | undefined;

    if (!row) return null;

    return {
      cycleId: row.id,
      operation: inferOperationForAgent(row, agentId),
    };
  }

  // =========================================================================
  // Initiator-aware notification (delegated to injected routing handler)
  // =========================================================================

  /**
   * Route a notification to the cycle's initiator or fall back to root.
   * Uses the injected `notifyInitiator` from the routing module via DI.
   */
  async function notifyInitiator(
    initiatorId: string | null | undefined,
    notification: Record<string, unknown>
  ): Promise<void> {
    await _injectedNotifyInitiator(initiatorId ?? null, notification);
  }

  const {
    storePayload,
    getNextPass,
    writePhronesisIndex,
    writeArchive,
    handlePhronesisGetState,
    handlePhronesisGetContent,
    handlePhronesisGetFormattedContent,
    handlePhronesisListCycles,
  } = createPhronesisContentArchiveHandlers({
    db,
    cwd,
    sm,
    getPhaseString,
    resolvePhronesisRoutingByAgentId,
  });

  const { killPAgentProcess, retireAllPAgents, initiateRecall, spawnPAgent } =
    createPhronesisAgentLifecycleHandlers({
      ctx,
      sm,
      lifecycle,
      getNextPass,
      resolveModel,
      roleTierMap: ROLE_TIER_MAP,
    });

  // =========================================================================
  // Handlers
  // =========================================================================

  /** Initiate a phronesis cycle. */
  async function handlePhronesisInitiate(payload: PhronesisInitiatePayload): Promise<PhronesisResult> {
    const { cycleId, task, mode, recursionLimit, initiatorId, models, providers,
            orientingQuestion, implicitUnknown } = payload;

    if (!cycleId || !task || !mode) {
      return { success: false, error: 'Missing required fields: cycleId, task, mode' };
    }

    const validModes: PhronesisMode[] = ['recommend-only', 'decision-only', 'decide-and-enact'];
    if (!validModes.includes(mode)) {
      return {
        success: false,
        error: `Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`,
      };
    }

    // Resolve per-operation defaults from config tiers
    const defaultModels: Record<string, string> = {};
    const defaultProviders: Record<string, string> = {};
    for (const op of ['p1', 'p2', 'p3', 'p4']) {
      const resolved = resolveModel({
        role: op,
        roleTierMap: ROLE_TIER_MAP,
        config: ctx.config,
      });
      defaultModels[op] = resolved.model;
      defaultProviders[op] = resolved.provider;
    }

    // Per-call overrides spread on top after normalizing away the explicit
    // sentinel string "default" so configured defaults remain authoritative.
    Object.assign(defaultModels, normalizeDefaultOverrides(models));
    Object.assign(defaultProviders, normalizeDefaultOverrides(providers));

    // Query active disciplines for this initiator (informational, not blocking)
    let activeDisciplines: Array<{ id: string; type: string; operation: string | null; orienting_question: string | null; updated_at: string }> = [];
    if (initiatorId) {
      try {
        const activePhronesis = db
          .prepare(
            `SELECT id, operation, orienting_question, updated_at FROM phronesis_state
             WHERE initiator_id = ? AND status = 'active'`
          )
          .all(initiatorId) as Array<{ id: string; operation: string | null; orienting_question: string | null; updated_at: string }>;
        for (const row of activePhronesis) {
          activeDisciplines.push({ id: row.id, type: 'differentiated_cognition', operation: row.operation, orienting_question: row.orienting_question, updated_at: row.updated_at });
        }
        const activeEpAudits = db
          .prepare(
            `SELECT id, phase as operation, orienting_question, updated_at FROM ep_audit_state
             WHERE initiator_id = ? AND phase NOT IN ('complete', 'aborted')`
          )
          .all(initiatorId) as Array<{ id: string; operation: string | null; orienting_question: string | null; updated_at: string }>;
        for (const row of activeEpAudits) {
          activeDisciplines.push({ id: row.id, type: 'emergent_probabilistics', operation: row.operation, orienting_question: row.orienting_question, updated_at: row.updated_at });
        }
      } catch {
        /* best-effort */
      }
    }

    try {
      const now = new Date().toISOString();
      const limit = recursionLimit != null ? recursionLimit : 5;

      db.prepare(
        `INSERT INTO phronesis_state (id, operation, sub_phase, status, mode, task, initiator_id, recursion_count, recursion_limit, timestamps, models, providers, updated_at, orienting_question, implicit_unknown)
         VALUES (?, NULL, NULL, 'active', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        cycleId,
        mode,
        task,
        initiatorId || null,
        limit,
        JSON.stringify({ initiated: now }),
        JSON.stringify(defaultModels),
        JSON.stringify(defaultProviders),
        now,
        orientingQuestion ?? null,
        implicitUnknown ?? null
      );

      recordEvent(initiatorId || 'apm', 'phronesis_initiated', {
        cycleId,
        mode,
        task: task.slice(0, 100),
      });
      emitSignal('phronesis:initiated', initiatorId || null, { cycleId, task: task.slice(0, 200), mode });

      // Spawn P1 agent
      const state = sm.getState(cycleId)!;
      sm.updateState(cycleId, {
        operation: 'p1',
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 0,
        timestamps: { p1_started: now },
      } as Partial<PhronesisState>);

      const spawnResult = await spawnPAgent(cycleId, 'p1', 1, state);
      if (!spawnResult.success) {
        sm.updateState(cycleId, { operation: null, sub_phase: null, status: 'failed' } as Partial<PhronesisState>);
        return { success: false, error: `Failed to spawn P1 agent: ${spawnResult.error}` };
      }

      captureSnapshot('phronesis:initiated', { cycleId, mode, task: task.slice(0, 80) });

      writePhronesisIndex();

      return {
        success: true,
        cycleId,
        phase: 'p1:grounding',
        message:
          'Phronesis cycle initiated. P1 (attention) agent spawned and in grounding phase. The agent will progress through the curriculum before beginning its operation. You will receive phase-transition notifications at each handoff. Use phronesis_status for on-demand detail. Full archive written at completion.',
        ...(activeDisciplines.length > 0 ? { activeDisciplines } : {}),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  const { handlePhronesisSubmit, handlePhronesisRecurse } =
    createPhronesisProgressionHandlers({
      db,
      cwd,
      sm,
      lifecycle,
      notifyAgent,
      notifyInitiator,
      recordEvent,
      emitSignal,
      captureSnapshot,
      resolvePhronesisRoutingByAgentId,
      getPhaseString,
      storePayload,
      getNextPass,
      writeArchive,
      retireAllPAgents,
      initiateRecall,
      spawnPAgent,
    });

  const {
    handlePhronesisGroundingComplete,
    handlePhronesisRoleAck,
  } = createPhronesisGroundingProtocolHandlers({
    sm,
    cwd,
    notifyAgent,
    notifyInitiator,
    loadPromptFragment,
    recordEvent,
    emitSignal,
    resolvePhronesisRoutingByAgentId,
    getPhaseString,
  });

  /** Abort a phronesis cycle. */
  async function handlePhronesisAbort(payload: PhronesisAbortPayload): Promise<PhronesisResult> {
    const { cycleId, agentId, reason } = payload;

    try {
      const state = sm.getState(cycleId);
      if (!state) return { success: false, error: 'Cycle not found' };

      if (state.status !== 'active') {
        return { success: false, error: `Cycle already in terminal state: ${state.status}` };
      }

      const now = new Date().toISOString();
      sm.transition(
        cycleId,
        agentId || 'apm',
        'phronesis_aborted',
        {
          operation: null,
          sub_phase: null,
          status: 'aborted',
          current_agent_id: null,  // D014: clear current agent on terminal state
          timestamps: { aborted: now },
        } as Partial<PhronesisState>,
        { reason }
      );
      emitSignal('phronesis:aborted', agentId || null, { cycleId, reason: reason ?? 'unknown' });

      // Abort the lifecycle initiative for the current agent
      if (lifecycle && state.current_agent_id) {
        try {
          const init = lifecycle.getCurrentInitiative(state.current_agent_id);
          if (init) {
            lifecycle.completeInitiative(init.id, 'aborted');
            emitSignal('lifecycle:initiative_completed', state.current_agent_id, {
              agentId: state.current_agent_id, initiativeId: init.id, initiativeType: init.type, outcome: 'aborted',
            });
          }
        } catch { /* non-fatal */ }
      }

      await retireAllPAgents(state, 'cycle aborted');

      writePhronesisIndex();

      return { success: true, phase: 'aborted' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Recovery handler for dead phronesis agents.
   *
   * Checks liveness of the current P-agent for active cycles using
   * isAgentOperational(). When an agent is confirmed dead, aborts the cycle
   * and notifies the initiator. Cycles with a live agent are left untouched.
   *
   * When called with a specific cycleId, checks only that cycle.
   * When called without arguments, scans all active cycles.
   */
  async function handlePhronesisRecovery(payload?: { cycleId?: string }): Promise<PhronesisResult> {
    try {
      if (payload?.cycleId) {
        // Single-cycle path
        const state = sm.getState(payload.cycleId);
        if (!state) return { success: false, error: 'Cycle not found' };
        if (state.status !== 'active') {
          return { success: true, cycleId: payload.cycleId, status: state.status, idle: false };
        }

        // Check if current agent is operational
        if (state.current_agent_id && !isAgentOperational(state.current_agent_id, db)) {
          // Agent is dead — abort cycle and notify
          const deadAgentId = state.current_agent_id;
          const deadOperation = state.operation;

          // Get pty_pid for kill
          const censusRow = db.prepare('SELECT pty_pid FROM census WHERE id = ?').get(deadAgentId) as { pty_pid: number | null } | undefined;
          killPAgentProcess(deadAgentId, censusRow?.pty_pid ?? null, `recovery:${deadOperation}`);

          // Abort the cycle
          const now = new Date().toISOString();
          sm.transition(
            payload.cycleId,
            'apm',
            'phronesis_recovery_aborted',
            {
              operation: null,
              sub_phase: null,
              status: 'aborted',
              current_agent_id: null,
              timestamps: { aborted: now },
            } as Partial<PhronesisState>,
            { reason: `Agent ${deadAgentId} confirmed dead during recovery` }
          );
          emitSignal('phronesis:aborted', null, { cycleId: payload.cycleId, reason: 'agent_dead_recovery' });

          // Notify initiator
          await notifyInitiator(state.initiator_id, {
            type: 'phronesis:recovery_aborted',
            cycleId: payload.cycleId,
            operation: deadOperation,
            deadAgentId,
            reason: `Agent ${deadAgentId} was confirmed dead during ${deadOperation} operation. Cycle has been aborted. Re-initiate if needed.`,
          });

          // Retire remaining agents
          await retireAllPAgents(state, 'recovery abort — agent dead');
          writePhronesisIndex();

          recordEvent('apm', 'phronesis_recovery_aborted', { cycleId: payload.cycleId, operation: deadOperation, deadAgentId });

          return { success: true, cycleId: payload.cycleId, status: 'aborted', recovered: true };
        }

        // Agent is alive (or no current agent) — leave untouched
        return {
          success: true,
          cycleId: payload.cycleId,
          currentAgentId: state.current_agent_id,
          operation: state.operation,
          idle: state.current_agent_id !== null,
        };
      }

      // Full scan path — check all active cycles
      const activeCycles = db
        .prepare(`SELECT id, operation, current_agent_id, updated_at FROM phronesis_state WHERE status = 'active'`)
        .all() as Array<{ id: string; operation: string | null; current_agent_id: string | null; updated_at: string | null }>;

      let abortedCount = 0;
      const abortedCycles: Array<{ cycleId: string; operation: string | null; deadAgentId: string }> = [];

      for (const c of activeCycles) {
        if (c.current_agent_id && !isAgentOperational(c.current_agent_id, db)) {
          // Dead agent — abort and notify
          const state = sm.getState(c.id);
          if (!state) continue;

          const censusRow = db.prepare('SELECT pty_pid FROM census WHERE id = ?').get(c.current_agent_id) as { pty_pid: number | null } | undefined;
          killPAgentProcess(c.current_agent_id, censusRow?.pty_pid ?? null, `recovery:${c.operation}`);

          const now = new Date().toISOString();
          sm.transition(
            c.id,
            'apm',
            'phronesis_recovery_aborted',
            {
              operation: null,
              sub_phase: null,
              status: 'aborted',
              current_agent_id: null,
              timestamps: { aborted: now },
            } as Partial<PhronesisState>,
            { reason: `Agent ${c.current_agent_id} confirmed dead during recovery scan` }
          );
          emitSignal('phronesis:aborted', null, { cycleId: c.id, reason: 'agent_dead_recovery' });

          await notifyInitiator(state.initiator_id, {
            type: 'phronesis:recovery_aborted',
            cycleId: c.id,
            operation: c.operation,
            deadAgentId: c.current_agent_id,
            reason: `Agent ${c.current_agent_id} was confirmed dead during ${c.operation} operation. Cycle has been aborted.`,
          });

          await retireAllPAgents(state, 'recovery abort — agent dead');

          abortedCount++;
          abortedCycles.push({ cycleId: c.id, operation: c.operation, deadAgentId: c.current_agent_id });
        }
      }

      writePhronesisIndex();

      recordEvent('apm', 'phronesis_recovery_scan', {
        activeCycles: activeCycles.length,
        abortedCount,
        abortedCycles,
      });

      return {
        success: true,
        scanned: activeCycles.length,
        abortedCount,
        abortedCycles,
        idleDetected: activeCycles.filter(c => c.current_agent_id !== null).length - abortedCount,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  return {
    handlePhronesisInitiate,
    handlePhronesisSubmit,
    handlePhronesisRecurse,
    handlePhronesisGroundingComplete,
    handlePhronesisRoleAck,
    handlePhronesisAbort,
    handlePhronesisGetState,
    handlePhronesisGetContent,
    handlePhronesisGetFormattedContent,
    handlePhronesisListCycles,
    handlePhronesisRecovery,
  };
}
