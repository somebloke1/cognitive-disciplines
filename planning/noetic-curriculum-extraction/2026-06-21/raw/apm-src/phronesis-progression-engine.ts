import path from 'node:path';
import type { APMContext } from '@noetic-pi/shared';
import type { LifecycleHandlers } from './lifecycle.js';
import { rejectOutOfSequence, type StateMachine } from './state-machine.js';
import { validatePayload, type PayloadSchema } from './validation.js';
import type {
  PhronesisOperation,
  PhronesisRecursePayload,
  PhronesisResult,
  PhronesisState,
  PhronesisSubPhase,
  PhronesisSubmitPayload,
} from './phronesis.js';

/** Map operation to the next operation in the forward path */
const NEXT_OPERATION: Record<string, string> = { p1: 'p2', p2: 'p3', p3: 'p4' };

const PHRONESIS_SUBMIT_SCHEMA: PayloadSchema = {
  cycleId:            { required: true, type: 'string' },
  operation:          { required: true, type: 'string' },
  content:            { required: true, type: 'string' },
  alignmentRationale: { required: false, type: 'string' },
  agentId:            { required: false, type: 'string' },
  pass:               { required: false, type: 'number' },
};

const PHRONESIS_RECURSE_SCHEMA: PayloadSchema = {
  cycleId:            { required: true, type: 'string' },
  target:             { required: true, type: 'string' },
  reason:             { required: true, type: 'string' },
  content:            { required: true, type: 'string' },
  operation:          { required: false, type: 'string' },
  agentId:            { required: false, type: 'string' },
  alignmentRationale: { required: false, type: 'string' },
};

interface PhronesisProgressionEngineDeps {
  db: APMContext['db'];
  cwd: string;
  sm: Pick<StateMachine<PhronesisState>, 'getState' | 'updateState'>;
  lifecycle: LifecycleHandlers;
  notifyAgent: APMContext['notifyAgent'];
  notifyInitiator: (
    initiatorId: string | null | undefined,
    notification: Record<string, unknown>
  ) => Promise<void>;
  recordEvent: APMContext['recordEvent'];
  emitSignal: APMContext['emitSignal'];
  captureSnapshot: APMContext['captureSnapshot'];
  resolvePhronesisRoutingByAgentId: (agentId: string) => {
    cycleId: string;
    operation: PhronesisOperation | null;
  } | null;
  getPhaseString: (state: Pick<PhronesisState, 'operation' | 'sub_phase' | 'status'>) => string;
  storePayload: (
    cycleId: string,
    phase: string,
    pass: number,
    agentId: string | null,
    payload: string,
    feedback: string | null,
    alignmentRationale?: string | null
  ) => void;
  getNextPass: (cycleId: string, operation: string) => number;
  writeArchive: (cycleId: string, state: PhronesisState) => string;
  retireAllPAgents: (state: PhronesisState, reason: string) => Promise<void>;
  initiateRecall: (
    cycleId: string,
    operation: string,
    targetAgentId: string,
    context: { fromOperation: string; fromAgent: string }
  ) => Promise<void>;
  spawnPAgent: (
    cycleId: string,
    operation: string,
    pass: number,
    state: PhronesisState
  ) => Promise<{ success: boolean; error?: string }>;
}

export interface PhronesisProgressionHandlers {
  handlePhronesisSubmit: (payload: PhronesisSubmitPayload) => Promise<PhronesisResult>;
  handlePhronesisRecurse: (payload: PhronesisRecursePayload) => Promise<PhronesisResult>;
}

export function createPhronesisProgressionHandlers(
  deps: PhronesisProgressionEngineDeps
): PhronesisProgressionHandlers {
  const {
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
  } = deps;

  /** Handle a P-agent submitting its payload. */
  async function handlePhronesisSubmit(payload: PhronesisSubmitPayload): Promise<PhronesisResult> {
    let resolvedPayload: PhronesisSubmitPayload = { ...payload };
    if ((!resolvedPayload.cycleId || !resolvedPayload.operation) && resolvedPayload.agentId) {
      const resolved = resolvePhronesisRoutingByAgentId(resolvedPayload.agentId);
      if (resolved) {
        resolvedPayload = {
          ...resolvedPayload,
          cycleId: resolvedPayload.cycleId ?? resolved.cycleId,
          operation: resolvedPayload.operation ?? resolved.operation ?? undefined,
        };
      }
    }

    const { cycleId, operation, pass, agentId, content, alignmentRationale } = resolvedPayload;

    // D015: Validate payload structure via shared validation
    const vr = validatePayload<PhronesisSubmitPayload>(
      resolvedPayload,
      PHRONESIS_SUBMIT_SCHEMA,
      { notifyAgent, handler: 'handlePhronesisSubmit' },
      agentId,
    );
    if (!vr.valid) return { success: false, error: vr.error };
    if (!cycleId || !operation) {
      return { success: false, error: 'Missing required fields: cycleId, operation' };
    }

    try {
      const state = sm.getState(cycleId);
      if (!state) return { success: false, error: 'Cycle not found' };

      // D015: reject if agentId is provided, matches current_agent_id, but pX_agent_id is null.
      // This means the agent was set as current without going through spawnPAgent (which registers
      // both current_agent_id AND pX_agent_id). Blocks rogue submissions and enforces schema.
      if (agentId && state.current_agent_id === agentId && !state[`${operation}_agent_id` as keyof PhronesisState]) {
        void notifyAgent(agentId, {
          type: 'apm:retry_prompt',
          handler: 'handlePhronesisSubmit',
          schema: PHRONESIS_SUBMIT_SCHEMA,
          error: `Agent ${agentId} is not registered for operation ${operation}. Initiate via phronesis_initiate first.`,
        });
        return { success: false, error: `Agent ${agentId} is not registered for operation ${operation}` };
      }

      const phaseValid = state.operation === operation && state.sub_phase === 'active';
      if (!phaseValid) {
        let explanation: string;
        if (state.sub_phase === 'grounding') {
          explanation = `${(state.operation ?? '').toUpperCase()} is still in grounding phase. Complete the grounding curriculum with phronesis_grounding_complete before submitting.`;
        } else if (state.sub_phase === 'complete') {
          const nextOp = NEXT_OPERATION[state.operation ?? ''];
          explanation = nextOp
            ? `${(state.operation ?? '').toUpperCase()} already submitted. The APM is spawning ${nextOp.toUpperCase()} — wait for that agent to be spawned.`
            : `${(state.operation ?? '').toUpperCase()} already complete.`;
        } else if (state.status !== 'active') {
          explanation = `Cycle is in terminal state '${state.status}'. No further submissions are accepted.`;
        } else {
          explanation = `Only the active ${(state.operation ?? '').toUpperCase()} agent should submit. This cycle expects a submission from ${(state.operation ?? '').toUpperCase()}, not ${operation.toUpperCase()}.`;
        }
        return rejectOutOfSequence('phronesis_submit', getPhaseString(state), `${operation}:active`, explanation);
      }

      const now = new Date().toISOString();
      // Always compute pass from DB — agent-provided pass is unreliable for
      // recalled agents (pass context is set at spawn, not updated on recall).
      const passNum = getNextPass(cycleId, operation);

      storePayload(cycleId, operation, passNum, agentId ?? null, content, null, alignmentRationale ?? null);

      sm.updateState(cycleId, {
        operation: operation,
        sub_phase: 'complete',
        status: 'active',
        current_agent_id: agentId || null,
        [`${operation}_agent_id`]: agentId || null,
        timestamps: { [`${operation}_pass${passNum}_complete`]: now },
      } as Partial<PhronesisState>);

      recordEvent(agentId || 'apm', `phronesis_${operation}_complete`, {
        cycleId,
        pass: passNum,
      });
      emitSignal('phronesis:phase_complete', agentId || null, { cycleId, operation, pass: passNum });

      // Complete the lifecycle initiative for the submitting agent
      // F3: always emit lifecycle:initiative_completed signal (even without formal initiative)
      if (lifecycle && agentId) {
        try {
          const init = lifecycle.getCurrentInitiative(agentId);
          if (init) {
            lifecycle.completeInitiative(init.id, 'completed');
          }
          emitSignal('lifecycle:initiative_completed', agentId, {
            agentId, initiativeId: init?.id ?? null, initiativeType: init?.type ?? null, outcome: 'completed',
          });
        } catch { /* non-fatal */ }
      }

      // Route to next operation
      if (operation === 'p4') {
        const updatedState = sm.updateState(cycleId, {
          operation: null,
          sub_phase: null,
          status: 'complete',
          current_agent_id: null,  // D014: clear current agent on terminal state
          timestamps: { complete: now },
        } as Partial<PhronesisState>)!;

        const archivePath = writeArchive(cycleId, updatedState);
        captureSnapshot('phronesis:complete', { cycleId, mode: state.mode });
        emitSignal('phronesis:complete', state.initiator_id || null, { cycleId, outcome: 'complete' });

        // Verification bundle: epistemic params + P4 alignment rationale
        const p4Content = db.prepare(
          `SELECT alignment_rationale FROM phronesis_content
           WHERE cycle_id = ? AND phase = 'p4' ORDER BY pass DESC LIMIT 1`
        ).get(cycleId) as { alignment_rationale: string | null } | undefined;

        await notifyInitiator(state.initiator_id, {
          type: 'phronesis:complete',
          category: 'phronesis',
          cycleId,
          archivePath: path.relative(cwd, archivePath),
          message: `Phronesis cycle ${cycleId} complete. Archive: ${path.relative(cwd, archivePath)}/`,
          // Verification bundle
          orientingQuestion: state.orienting_question ?? null,
          implicitUnknown: state.implicit_unknown ?? null,
          alignmentRationale: p4Content?.alignment_rationale ?? null,
        });

        await retireAllPAgents(updatedState, 'cycle complete');

        return { success: true, phase: 'complete', archivePath: path.relative(cwd, archivePath) };
      }

      // Spawn next P-agent
      const nextOp = NEXT_OPERATION[operation];
      const nextPass = getNextPass(cycleId, nextOp);

      sm.updateState(cycleId, {
        operation: nextOp as PhronesisOperation,
        sub_phase: 'grounding',
        status: 'active',
        grounding_stage: 0,
        timestamps: { [`${nextOp}_pass${nextPass}_started`]: now },
      } as Partial<PhronesisState>);

      // F7: determine nextAgentId BEFORE notification so toPhase reflects actual target state
      const refreshedState = sm.getState(cycleId)!;
      const nextAgentId = refreshedState[`${nextOp}_agent_id` as keyof PhronesisState] as
        | string
        | null;

      await notifyInitiator(state.initiator_id, {
        type: 'phronesis:phase_transition',
        category: 'phronesis',
        cycleId,
        fromPhase: `${operation}:complete`,
        toPhase: nextAgentId ? `${nextOp}:active` : `${nextOp}:grounding`,
        pass: nextPass,
        message: `Phronesis cycle ${cycleId}: ${operation.toUpperCase()} complete → ${nextOp.toUpperCase()} pass ${nextPass} beginning.`,
      });

      if (nextAgentId) {
        sm.updateState(cycleId, {
          operation: nextOp as PhronesisOperation,
          sub_phase: 'active',
          status: 'active',
          grounding_stage: 0,
        } as Partial<PhronesisState>);

        await initiateRecall(cycleId, nextOp, nextAgentId, {
          fromOperation: operation,
          fromAgent: content.slice(0, 500),
        });

        return { success: true, phase: `${nextOp}:active`, operation: nextOp, pass: nextPass };
      } else {
        const spawnResult = await spawnPAgent(cycleId, nextOp, nextPass, refreshedState);
        if (!spawnResult.success) {
          sm.updateState(cycleId, { operation: null, sub_phase: null, status: 'failed' } as Partial<PhronesisState>);
          return {
            success: false,
            error: `Failed to spawn ${nextOp.toUpperCase()} agent: ${spawnResult.error}`,
          };
        }
        return {
          success: true,
          phase: `${nextOp}:grounding`,
          operation: nextOp,
          pass: nextPass,
        };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** Handle P2–P4 recursion — return to an earlier operation. */
  async function handlePhronesisRecurse(payload: PhronesisRecursePayload): Promise<PhronesisResult> {
    let resolvedPayload: PhronesisRecursePayload = { ...payload };
    if ((!resolvedPayload.cycleId || !resolvedPayload.operation) && resolvedPayload.agentId) {
      const resolved = resolvePhronesisRoutingByAgentId(resolvedPayload.agentId);
      if (resolved) {
        resolvedPayload = {
          ...resolvedPayload,
          cycleId: resolvedPayload.cycleId ?? resolved.cycleId,
          operation: resolvedPayload.operation ?? resolved.operation ?? undefined,
        };
      }
    }

    const { cycleId, operation, agentId, target, reason, content, alignmentRationale } = resolvedPayload;

    // D015: Validate payload structure via shared validation
    const vr = validatePayload<PhronesisRecursePayload>(
      resolvedPayload,
      PHRONESIS_RECURSE_SCHEMA,
      { notifyAgent, handler: 'handlePhronesisRecurse' },
      agentId,
    );
    if (!vr.valid) return { success: false, error: vr.error };
    if (!cycleId || !operation) {
      return { success: false, error: 'Missing required fields: cycleId, operation' };
    }

    try {
      const state = sm.getState(cycleId);
      if (!state) return { success: false, error: 'Cycle not found' };

      // D015: reject if agentId matches current_agent_id but pX_agent_id is null (unregistered).
      if (agentId && state.current_agent_id === agentId && !state[`${operation}_agent_id` as keyof PhronesisState]) {
        void notifyAgent(agentId, {
          type: 'apm:retry_prompt',
          handler: 'handlePhronesisRecurse',
          schema: PHRONESIS_RECURSE_SCHEMA,
          error: `Agent ${agentId} is not registered for operation ${operation}.`,
        });
        return { success: false, error: `Agent ${agentId} is not registered for operation ${operation}` };
      }

      // Phase validation
      const canRecurse = state.status === 'active' &&
        state.sub_phase === 'active' &&
        state.operation !== null &&
        ['p2', 'p3', 'p4'].includes(state.operation);
      if (!canRecurse) {
        let explanation: string;
        if (state.sub_phase === 'grounding') {
          explanation = 'Complete grounding before recursing.';
        } else if (state.operation === 'p1' && state.sub_phase === 'active') {
          explanation = 'P1 cannot recurse — there is no prior operation to return to.';
        } else if (state.sub_phase === 'complete') {
          explanation = `${(state.operation ?? '').toUpperCase()} has already submitted. Use phronesis_recurse before submitting — phronesis_recurse carries your payload atomically (do not call phronesis_submit separately).`;
        } else if (state.status !== 'active') {
          explanation = `Cycle is in terminal state '${state.status}'. No further operations are accepted.`;
        } else {
          explanation = `Recursion is only valid from an active P2, P3, or P4 phase. Current phase: '${getPhaseString(state)}'.`;
        }
        return rejectOutOfSequence(
          'phronesis_recurse',
          getPhaseString(state),
          'p2:active|p3:active|p4:active',
          explanation
        );
      }

      // Order validation
      const opOrder: Record<string, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
      if (!opOrder[target] || !opOrder[operation]) {
        return { success: false, error: `Invalid operation or target: ${operation} → ${target}` };
      }
      if (opOrder[target] >= opOrder[operation]) {
        return {
          success: false,
          error: `Can only recurse to a prior operation. ${operation.toUpperCase()} cannot recurse to ${target.toUpperCase()}.`,
        };
      }

      // Check circuit breaker
      const newCount = state.recursion_count + 1;
      if (newCount > state.recursion_limit) {
        const now = new Date().toISOString();
        const passNum = getNextPass(cycleId, operation);

        storePayload(cycleId, operation, passNum, agentId ?? null, content, reason, alignmentRationale ?? null);

        const updatedState = sm.updateState(cycleId, {
          operation: null,
          sub_phase: null,
          status: 'recursion_limit',
          current_agent_id: null,  // D014: clear current agent on terminal state
          recursion_count: newCount,
          [`${operation}_agent_id`]: agentId || null,
          timestamps: { recursion_limit_reached: now },
        } as Partial<PhronesisState>)!;

        const archivePath = writeArchive(cycleId, updatedState);

        await notifyInitiator(state.initiator_id, {
          type: 'phronesis:recursion_limit',
          category: 'phronesis',
          cycleId,
          archivePath: path.relative(cwd, archivePath),
          message: `Phronesis cycle ${cycleId} hit recursion limit (${state.recursion_limit}). Manual intervention needed. Partial archive: ${path.relative(cwd, archivePath)}/`,
        });

        await retireAllPAgents(updatedState, 'recursion limit reached');

        return {
          success: true,
          phase: 'recursion_limit',
          archivePath: path.relative(cwd, archivePath),
          message: 'Recursion limit reached — cycle stopped. Partial archive written.',
        };
      }

      const now = new Date().toISOString();

      // Store the recursing agent's payload with feedback
      const recursingPass = getNextPass(cycleId, operation);
      storePayload(cycleId, operation, recursingPass, agentId ?? null, content, reason, alignmentRationale ?? null);

      const targetPass = getNextPass(cycleId, target);

      // Determine phase for target
      const existingTargetAgentId = state[`${target}_agent_id` as keyof PhronesisState] as
        | string
        | null;
      let targetSubPhase: PhronesisSubPhase;
      const groundingStageUpdate: Partial<PhronesisState> = {};
      if (existingTargetAgentId) {
        targetSubPhase = 'active';
      } else {
        targetSubPhase = 'grounding';
        groundingStageUpdate.grounding_stage = 0;
      }

      sm.updateState(cycleId, {
        operation: target,
        sub_phase: targetSubPhase,
        status: 'active',
        recursion_count: newCount,
        current_agent_id: null,
        [`${operation}_agent_id`]: agentId || null,
        ...groundingStageUpdate,
        timestamps: {
          [`${operation}_pass${recursingPass}_complete`]: now,
          [`recurse_${newCount}_to_${target}`]: now,
          [`${target}_pass${targetPass}_started`]: now,
        },
      } as Partial<PhronesisState>);

      recordEvent(agentId || 'apm', 'phronesis_recurse', {
        cycleId,
        target,
        reason: reason.slice(0, 200),
        recursionCount: newCount,
      });
      emitSignal('phronesis:recursed', agentId || null, { cycleId, fromOperation: operation, toOperation: target, pass: newCount });

      await notifyInitiator(state.initiator_id, {
        type: 'phronesis:recursion',
        category: 'phronesis',
        cycleId,
        target,
        reason,
        recursionCount: newCount,
        recursionLimit: state.recursion_limit,
        message: `Phronesis cycle ${cycleId}: recursion ${newCount}/${state.recursion_limit} — returning to ${target.toUpperCase()}. Reason: ${reason}`,
      });

      const refreshedState = sm.getState(cycleId)!;

      if (existingTargetAgentId) {
        await initiateRecall(cycleId, target, existingTargetAgentId, {
          fromOperation: operation,
          fromAgent: content.slice(0, 500),
        });
      } else {
        const spawnResult = await spawnPAgent(cycleId, target, targetPass, refreshedState);
        if (!spawnResult.success) {
          sm.updateState(cycleId, { operation: null, sub_phase: null, status: 'failed' } as Partial<PhronesisState>);
          return {
            success: false,
            error: `Failed to spawn ${target.toUpperCase()} agent: ${spawnResult.error}`,
          };
        }
      }

      return {
        success: true,
        phase: `${target}:${targetSubPhase}`,
        operation: target,
        pass: targetPass,
        recursionCount: newCount,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  return {
    handlePhronesisSubmit,
    handlePhronesisRecurse,
  };
}
