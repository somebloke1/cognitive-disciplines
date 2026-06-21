import type { APMContext } from '@noetic-pi/shared';
import { advance, loadCurriculum, type CurriculumContext } from './curriculum.js';
import { rejectOutOfSequence, type StateMachine } from './state-machine.js';
import { validatePayload, type PayloadSchema } from './validation.js';
import type {
  PhronesisGroundingCompletePayload,
  PhronesisOperation,
  PhronesisResult,
  PhronesisRoleAckPayload,
  PhronesisState,
} from './phronesis.js';

const PHRONESIS_GROUNDING_COMPLETE_SCHEMA: PayloadSchema = {
  cycleId:   { required: true, type: 'string' },
  operation: { required: true, type: 'string' },
  agentId:   { required: false, type: 'string' },
};

const PHRONESIS_ROLE_ACK_SCHEMA: PayloadSchema = {
  cycleId:   { required: true, type: 'string' },
  operation: { required: true, type: 'string' },
  agentId:   { required: false, type: 'string' },
};

/** Map operation to cognitional function label */
const OP_LABELS: Record<string, string> = {
  p1: 'Attention',
  p2: 'Intelligence',
  p3: 'Reasonableness',
  p4: 'Responsibility',
};

interface GroundingProtocolDeps {
  sm: Pick<StateMachine<PhronesisState>, 'getState' | 'updateState'>;
  cwd: string;
  notifyAgent: APMContext['notifyAgent'];
  notifyInitiator: (
    initiatorId: string | null | undefined,
    notification: Record<string, unknown>
  ) => Promise<void>;
  loadPromptFragment: APMContext['loadPromptFragment'];
  recordEvent: APMContext['recordEvent'];
  emitSignal: APMContext['emitSignal'];
  resolvePhronesisRoutingByAgentId: (agentId: string) => {
    cycleId: string;
    operation: PhronesisOperation | null;
  } | null;
  getPhaseString: (state: Pick<PhronesisState, 'operation' | 'sub_phase' | 'status'>) => string;
}

export interface PhronesisGroundingProtocolHandlers {
  handlePhronesisGroundingComplete: (
    payload: PhronesisGroundingCompletePayload
  ) => PhronesisResult;
  handlePhronesisRoleAck: (payload: PhronesisRoleAckPayload) => PhronesisResult;
}

export function createPhronesisGroundingProtocolHandlers(
  deps: GroundingProtocolDeps
): PhronesisGroundingProtocolHandlers {
  const {
    sm,
    cwd,
    notifyAgent,
    notifyInitiator,
    loadPromptFragment,
    recordEvent,
    emitSignal,
    resolvePhronesisRoutingByAgentId,
    getPhaseString,
  } = deps;

  /** Handle a P-agent completing a grounding curriculum stage. */
  function handlePhronesisGroundingComplete(
    payload: PhronesisGroundingCompletePayload
  ): PhronesisResult {
    let resolvedPayload: PhronesisGroundingCompletePayload = { ...payload };
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
    const { cycleId, operation, agentId } = resolvedPayload;

    // D015: Validate payload structure via shared validation
    const gcRetryTarget = resolvedPayload.agentId || (resolvedPayload.cycleId ? sm.getState(resolvedPayload.cycleId)?.current_agent_id ?? null : null);
    const gcVr = validatePayload<PhronesisGroundingCompletePayload>(
      resolvedPayload,
      PHRONESIS_GROUNDING_COMPLETE_SCHEMA,
      { notifyAgent, handler: 'handlePhronesisGroundingComplete' },
      gcRetryTarget ?? undefined,
    );
    if (!gcVr.valid) {
      // Fallback: if no agent target was found, notify initiator
      if (!gcRetryTarget) {
        void notifyInitiator(null, {
          type: 'apm:retry_prompt',
          handler: 'handlePhronesisGroundingComplete',
          schema: PHRONESIS_GROUNDING_COMPLETE_SCHEMA,
          error: gcVr.error,
        });
      }
      return { success: false, error: gcVr.error };
    }
    if (!cycleId || !operation) {
      return { success: false, error: 'Missing required fields: cycleId, operation' };
    }

    // D015: Post-validation — operation must be a valid p1-p4 value
    if (!['p1', 'p2', 'p3', 'p4'].includes(operation as string)) {
      const retryPayload = {
        type: 'apm:retry_prompt',
        handler: 'handlePhronesisGroundingComplete',
        schema: PHRONESIS_GROUNDING_COMPLETE_SCHEMA,
        error: `Invalid operation type: expected p1|p2|p3|p4, got ${JSON.stringify(operation)}`,
      };
      const retryTarget = agentId || (sm.getState(cycleId)?.current_agent_id ?? null);
      if (retryTarget) void notifyAgent(retryTarget, retryPayload);
      else void notifyInitiator(null, retryPayload);
      return { success: false, error: `Invalid operation: ${JSON.stringify(operation)}` };
    }

    try {
      const state = sm.getState(cycleId);
      if (!state) return { success: false, error: 'Cycle not found' };

      const phaseValid = state.operation === operation && state.sub_phase === 'grounding';
      if (!phaseValid) {
        let explanation: string;
        if (state.operation === operation && state.sub_phase === 'active') {
          explanation = 'Grounding is already complete. Proceed with your operation.';
        } else if (state.sub_phase === 'grounding' && state.operation !== operation) {
          explanation = `A different operation (${(state.operation ?? '').toUpperCase()}) is currently in grounding. Only that agent should call grounding_complete.`;
        } else {
          explanation = `Grounding completion is not valid in phase '${getPhaseString(state)}'.`;
        }
        return rejectOutOfSequence(
          'phronesis_grounding_complete',
          getPhaseString(state),
          `${operation}:grounding`,
          explanation
        );
      }

      const currentStage = state.grounding_stage || 0;
      const now = new Date().toISOString();

      // Guard: Stage 1 is delivered via phronesis_role_ack
      if (currentStage === 0) {
        return {
          success: false,
          error:
            'Stage 1 has not yet been delivered. Call `phronesis_role_ack` first to receive your curriculum.',
        };
      }

      // Load curriculum and advance
      const def = loadCurriculum(cwd, 'differentiated_cognition');
      if (!def) {
        return { success: false, error: 'Failed to load curriculum for differentiated_cognition' };
      }

      const currCtx: CurriculumContext = {
        disciplineType: 'differentiated_cognition',
        operation,
        task: state.task,
        orientingQuestion: state.orienting_question ?? null,
        implicitUnknown: state.implicit_unknown ?? null,
        cwd,
      };

      const advanceStage = currentStage + 1;
      const advResult = advance(def, advanceStage, currCtx);

      if (advResult.phase === 'post_tasking') {
        const newStage = currentStage + 1;

        sm.updateState(cycleId, {
          grounding_stage: newStage,
          timestamps: { [`${operation}_grounding_stage_${currentStage}_complete`]: now },
        } as Partial<PhronesisState>);

        return {
          success: true,
          phase: `${operation}:grounding`,
          stage: advResult.stage,
          totalStages: advResult.totalStages,
          instructions: advResult.instructions,
        };
      } else {
        // phase === 'complete' — all stages done, transition to :active
        sm.updateState(cycleId, {
          operation: operation as PhronesisOperation,
          sub_phase: 'active',
          status: 'active',
          grounding_stage: 0,
          timestamps: {
            [`${operation}_grounding_stage_${currentStage}_complete`]: now,
            [`${operation}_grounding_complete`]: now,
          },
        } as Partial<PhronesisState>);

        recordEvent(agentId || 'apm', `phronesis_${operation}_grounding_complete`, { cycleId });
        emitSignal('phronesis:grounding_complete', agentId || null, { cycleId, operation, stage: currentStage });

        return {
          success: true,
          phase: `${operation}:active`,
          stage: advResult.stage,
          totalStages: advResult.totalStages,
          groundingComplete: true,
          instructions:
            '**Grounding complete — you are now in your ACTIVE operational phase.**\n\n' +
            'Do NOT call `phronesis_grounding_complete` again.\n\n' +
            'Call `phronesis_get_context` to receive the accumulated content from prior operations, ' +
            'then perform your analysis and submit with `phronesis_submit`.',
        };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** Handle a P-agent calling phronesis_role_ack. */
  function handlePhronesisRoleAck(payload: PhronesisRoleAckPayload): PhronesisResult {
    let resolvedPayload: PhronesisRoleAckPayload = { ...payload };
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
    const { cycleId, operation, agentId } = resolvedPayload;

    // D015: Validate payload structure via shared validation
    const raRetryTarget = resolvedPayload.agentId || (resolvedPayload.cycleId ? sm.getState(resolvedPayload.cycleId)?.current_agent_id ?? null : null);
    const raVr = validatePayload<PhronesisRoleAckPayload>(
      resolvedPayload,
      PHRONESIS_ROLE_ACK_SCHEMA,
      { notifyAgent, handler: 'handlePhronesisRoleAck' },
      raRetryTarget ?? undefined,
    );
    if (!raVr.valid) {
      // Fallback: if no agent target was found, notify initiator
      if (!raRetryTarget) {
        void notifyInitiator(null, {
          type: 'apm:retry_prompt',
          handler: 'handlePhronesisRoleAck',
          schema: PHRONESIS_ROLE_ACK_SCHEMA,
          error: raVr.error,
        });
      }
      return { success: false, error: raVr.error };
    }
    if (!cycleId || !operation) {
      return { success: false, error: 'Missing required fields: cycleId, operation' };
    }

    // D015: Post-validation — operation must be a valid p1-p4 value
    if (!['p1', 'p2', 'p3', 'p4'].includes(operation as string)) {
      const retryPayload = {
        type: 'apm:retry_prompt',
        handler: 'handlePhronesisRoleAck',
        schema: PHRONESIS_ROLE_ACK_SCHEMA,
        error: `Invalid operation type: expected p1|p2|p3|p4, got ${JSON.stringify(operation)}`,
      };
      const retryTarget = agentId || (sm.getState(cycleId)?.current_agent_id ?? null);
      if (retryTarget) void notifyAgent(retryTarget, retryPayload);
      else void notifyInitiator(null, retryPayload);
      return { success: false, error: `Invalid operation: ${JSON.stringify(operation)}` };
    }

    try {
      const state = sm.getState(cycleId);
      if (!state) return { success: false, error: 'Cycle not found' };

      // Path 1: Fresh spawn — deliver Stage 1 grounding via curriculum harness
      if (state.operation === operation && state.sub_phase === 'grounding' && state.grounding_stage === 0) {
        // Load curriculum
        const def = loadCurriculum(cwd, 'differentiated_cognition');
        if (!def) {
          return { success: false, error: 'Failed to load curriculum for differentiated_cognition' };
        }

        const currCtx: CurriculumContext = {
          disciplineType: 'differentiated_cognition',
          operation,
          task: state.task,
          orientingQuestion: state.orienting_question ?? null,
          implicitUnknown: state.implicit_unknown ?? null,
          cwd,
        };

        // advance(0) → tasking boundary (epistemic horizon); advance(1) → first post_tasking step
        const taskingResult = advance(def, 0, currCtx);
        const firstStepResult = advance(def, 1, currCtx);

        // Load prompt fragments (preserved unchanged — identity/role context, NOT curriculum)
        const overview = loadPromptFragment('phronesis-overview');
        const opFragment = loadPromptFragment(`phronesis-${operation}`);
        const groundingPreamble = loadPromptFragment('phronesis-grounding-preamble');

        const now = new Date().toISOString();
        sm.updateState(cycleId, {
          grounding_stage: 1,
          timestamps: { [`${operation}_role_ack`]: now },
        } as Partial<PhronesisState>);

        const parts: string[] = [];
        parts.push(
          `**Role acknowledged.** You are **${operation.toUpperCase()} (${OP_LABELS[operation] || operation})** for cycle \`${cycleId}\`.\n\n**Task:** ${state.task}`
        );
        if (overview) parts.push(overview);
        if (opFragment) parts.push(opFragment);

        // Assemble grounding section: preamble + epistemic horizon + first curriculum step
        const epistemicHorizon = taskingResult.instructions; // empty string if both params null
        const groundingSection =
          (groundingPreamble ? groundingPreamble + '\n\n' : '') +
          (epistemicHorizon ? epistemicHorizon + '\n\n' : '') +
          firstStepResult.instructions;
        parts.push(groundingSection);

        const fresh = loadPromptFragment('phronesis-fresh');
        if (fresh) parts.push(fresh);

        // Mode constraint for P4 (preserved unchanged)
        if (operation === 'p4' && state.mode && state.mode !== 'decide-and-enact') {
          parts.push(
            `# MODE CONSTRAINT — HARD PROHIBITION\n\n` +
              `**This cycle is in \`${state.mode}\` mode.**\n\n` +
              `You are **absolutely prohibited** from using the following tools or performing the following actions:\n\n` +
              `- \`write\` — Do not create or overwrite any files\n` +
              `- \`edit\` — Do not modify any files\n` +
              `- \`bash\` — Do not execute commands that modify project state (no \`git commit\`, \`git push\`, \`rm\`, \`mv\`, \`cp\`, \`mkdir\`, file redirection, etc.)\n` +
              `- Do not use any tool or command to make changes to the repository, filesystem, or project state\n\n` +
              `**Violation of this constraint is a governance failure regardless of how clearly the judgment points toward action.**\n\n` +
              `Your entire output is text. Describe what should be done; do not do it. ` +
              `Submit your ${state.mode === 'recommend-only' ? 'recommendation' : 'decision'} via \`phronesis_submit\` and nothing else.`
          );
        }

        return {
          success: true,
          stage: firstStepResult.stage,
          totalStages: firstStepResult.totalStages,
          formatted: parts.join('\n\n---\n\n'),
        };
      }

      // Path 2: Recall — agent already grounded
      if (state.operation === operation && state.sub_phase === 'active') {
        const expectedAgentId = state[`${operation}_agent_id` as keyof PhronesisState] as
          | string
          | null;
        if (expectedAgentId && agentId && expectedAgentId !== agentId) {
          return {
            success: false,
            error: `Wrong agent. Expected ${expectedAgentId} for ${operation}, got ${agentId}`,
          };
        }

        return {
          success: true,
          formatted: `**Role acknowledged.** You are ${operation.toUpperCase()} for cycle ${cycleId}.

Call \`phronesis_get_context\` to receive the full accumulated content from all prior passes, then perform your operation in light of the recall request.`,
        };
      }

      // Neither path
      return {
        success: false,
        error:
          `Role acknowledgement not valid in phase '${getPhaseString(state)}' (grounding_stage=${state.grounding_stage}). ` +
          `Expected '${operation}:grounding' (grounding_stage=0) or '${operation}:active' (recall). Current phase: '${getPhaseString(state)}'.`,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  return {
    handlePhronesisGroundingComplete,
    handlePhronesisRoleAck,
  };
}
