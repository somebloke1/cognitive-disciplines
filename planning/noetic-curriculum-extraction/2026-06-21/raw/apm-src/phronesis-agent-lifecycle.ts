import crypto from 'node:crypto';
import type { APMContext, SpawnResult } from '@noetic-pi/shared';
import type { LifecycleHandlers } from './lifecycle.js';
import type { PhronesisOperation, PhronesisState } from './phronesis.js';

/** Descriptive role labels for phronesis agents (displayed in UI census/tabs). */
const OPERATION_ROLE_LABEL: Record<PhronesisOperation, string> = {
  p1: 'p1:research',
  p2: 'p2:ideate',
  p3: 'p3:judge',
  p4: 'p4:decide',
};

interface ModelResolutionResult {
  model: string;
  provider: string;
}

type ResolveModelFn = (params: {
  callerModel?: string;
  callerProvider?: string;
  role: string;
  roleTierMap: Record<string, string>;
  config: APMContext['config'];
}) => ModelResolutionResult;

export interface PhronesisAgentLifecycleDeps {
  ctx: Pick<
    APMContext,
    'db' | 'notifyAgent' | 'recordEvent' | 'log' | 'retireDescendants' | 'retireAgent' | 'config'
  >;
  sm: {
    updateState: (id: string, patch: Partial<PhronesisState>) => PhronesisState | null;
  };
  lifecycle: LifecycleHandlers;
  getNextPass: (cycleId: string, operation: string) => number;
  resolveModel: ResolveModelFn;
  roleTierMap: Record<string, string>;
}

export interface PhronesisAgentLifecycleHandlers {
  killPAgentProcess: (agentId: string | null, ptyPid: number | null, label: string) => void;
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
  ) => Promise<SpawnResult>;
}

export function createPhronesisAgentLifecycleHandlers(
  deps: PhronesisAgentLifecycleDeps
): PhronesisAgentLifecycleHandlers {
  const { ctx, sm, lifecycle, getNextPass, resolveModel, roleTierMap } = deps;
  const { db, notifyAgent, recordEvent, log } = ctx;

  /**
   * Kill a P-agent's PTY process and retire it in the census after submission.
   *
   * This is a structural defense: after the APM processes a submission, the
   * submitting agent's process is killed directly and the agent is immediately
   * retired in the census. The agent has no say — this prevents post-submission
   * tool use.
   *
   * Process kill is fire-and-forget: the process may already be gone.
   * Census retirement always executes regardless.
   */
  function killPAgentProcess(agentId: string | null, ptyPid: number | null, label: string): void {
    if (agentId) {
      // Retire all spawned sub-agents (descendants) before retiring the agent itself.
      // P-agents may spawn research sub-agents via agent_spawn; those are tracked in
      // census via ancestor_id but not in phronesis state, so they'd otherwise be orphaned.
      ctx.retireDescendants(agentId, 'parent_retired');

      try {
        ctx.retireAgent(agentId, 'initiative_complete');
        log.info(`killPAgentProcess(${label}): retired agent ${agentId} via retireAgent`);
      } catch (err) {
        log.error(`killPAgentProcess(${label}): error retiring ${agentId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (ptyPid) {
      try {
        process.kill(ptyPid, 'SIGTERM');
        log.info(`killPAgentProcess(${label}): killed process ${ptyPid}`);
      } catch (err) {
        log.debug(
          `killPAgentProcess(${label}): process kill failed for ${ptyPid} (likely already gone)`,
          {
            error: err instanceof Error ? err.message : String(err),
          }
        );
      }
    }
  }

  /**
   * Three-step lifecycle for all P-agents when cycle ends.
   * 1. Retire in census (stops routing immediately)
   * 2. Send graceful shutdown notification
   * 3. Kill process (defensive fallback)
   */
  async function retireAllPAgents(state: PhronesisState, reason: string): Promise<void> {
    const now = new Date().toISOString();

    for (const op of ['p1', 'p2', 'p3', 'p4'] as const) {
      const agentId = state[`${op}_agent_id`];
      if (!agentId) continue;

      // Step 1: Get pty_pid before retirement (retirement clears it)
      let ptyPid: number | null = null;
      try {
        const row = db.prepare('SELECT pty_pid FROM census WHERE id = ?').get(agentId) as
          | { pty_pid: number | null }
          | undefined;
        ptyPid = row?.pty_pid ?? null;
      } catch {
        /* ignore */
      }

      // Step 2: Retire via canonical path (cleans up operations, emits events)
      try {
        ctx.retireAgent(agentId, 'initiative_complete');
        log.info(`retireAllPAgents: retired ${op} agent ${agentId}`);
      } catch (err) {
        log.error(`retireAllPAgents: error retiring ${agentId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Step 3: Graceful shutdown notification
      try {
        await notifyAgent(agentId, {
          type: 'shutdown',
          category: 'system',
          reason: reason || 'Phronesis cycle ended',
        });
      } catch (err) {
        log.debug(`retireAllPAgents: notification failed for ${agentId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Step 4: Kill process (defensive — agent may already be closing)
      if (ptyPid) {
        try {
          process.kill(ptyPid, 'SIGTERM');
          log.info(`retireAllPAgents: killed process ${ptyPid} for ${op} agent`);
        } catch (killErr) {
          log.debug(`retireAllPAgents: process kill failed for ${agentId} (likely already gone)`, {
            error: killErr instanceof Error ? killErr.message : String(killErr),
          });
        }
      }
    }
  }

  /**
   * Initiate a recall for a persistent P-agent.
   *
   * Instead of spawning a new agent, sends a notification to an existing agent
   * that was previously used for this operation. The agent acknowledges via
   * phronesis_role_ack, then fetches context and performs its operation again.
   */
  async function initiateRecall(
    cycleId: string,
    operation: string,
    targetAgentId: string,
    context: { fromOperation: string; fromAgent: string }
  ): Promise<void> {
    const { fromOperation, fromAgent } = context;

    const roleReminders: Record<string, string> = {
      p1: 'You are the P1 agent. Your operation is attention — characterizing data with high fidelity. Your question is: What is given?',
      p2: 'You are the P2 agent. Your operation is intelligence — multiplying possibilities for higher operations. Your question is: What could it be?',
      p3: 'You are the P3 agent. Your operation is reasonableness — judging what is true from among possibilities. Your question is: Is it true?',
      p4: 'You are the P4 agent. Your operation is responsibility — deliberating, deciding, and declaring. Your question is: What am I to do?',
    };

    const pass = getNextPass(cycleId, operation);

    sm.updateState(cycleId, {
      updated_at: new Date().toISOString(),
    } as Partial<PhronesisState>);

    await notifyAgent(targetAgentId, {
      type: 'phronesis:recall',
      category: 'phronesis',
      cycleId,
      operation,
      pass,
      fromOperation: fromOperation || 'unknown',
      fromAgent: fromAgent || '',
      roleReminder: roleReminders[operation] || `You are the ${operation.toUpperCase()} agent.`,
      instruction: 'Acknowledge your operational role and readiness by calling `phronesis_role_ack()`.',
    });

    recordEvent('apm', `phronesis_recall_${operation}`, {
      cycleId,
      targetAgentId,
      fromOperation,
      pass,
    });
  }

  /**
   * Spawn a P-agent for a given operation.
   *
   * The spawn command carries only a minimal bootstrap — enough for the agent
   * to identify itself and call phronesis_role_ack. The full curriculum is
   * delivered via the phronesis_role_ack response.
   */
  async function spawnPAgent(
    cycleId: string,
    operation: string,
    pass: number,
    state: PhronesisState
  ): Promise<SpawnResult> {
    // Resolve per-operation model
    let agentModels: Record<string, string> = {};
    try {
      agentModels = JSON.parse(state.models || '{}');
    } catch {
      /* empty */
    }

    // Resolve per-operation provider
    let agentProviders: Record<string, string> = {};
    try {
      agentProviders = JSON.parse(state.providers || '{}');
    } catch {
      /* empty */
    }

    if (!agentModels[operation]) {
      log.info('Phronesis operation using config-derived model', {
        cycleId,
        operation,
        source: 'config_tier',
        selectionContext: {
          layer: 'config_tier',
          source: roleTierMap[operation] || 'default',
          authority: 'phronesis',
          timestamp: Date.now(),
        },
      });
    }

    const resolved = resolveModel({
      callerModel: agentModels[operation],
      callerProvider: agentProviders[operation],
      role: operation,
      roleTierMap: roleTierMap,
      config: ctx.config,
    });

    const agentId = crypto.randomUUID();
    const envVars: Record<string, string> = {
      AGENT_ID: agentId,
    };

    try {
      await lifecycle.spawnAgent({
        agentId,
        role: OPERATION_ROLE_LABEL[operation as PhronesisOperation],
        birthCause: 'phronesis_spawn',
        title: `DC:${OPERATION_ROLE_LABEL[operation as PhronesisOperation]} [${cycleId.slice(-8)}]`,
        mission: `You are a phronesis agent. Cycle: ${cycleId} | Operation: ${operation.toUpperCase()} | Pass: ${pass}. Call \`phronesis_role_ack\` now to begin your curriculum.`,
        initiativeType: `phronesis_${operation}`,
        initiativeParams: { cycle_id: cycleId, operation, pass },
        model: resolved.model,
        provider: resolved.provider,
        ancestorId: state.initiator_id ?? undefined,
        env: envVars,
      });
    } catch (spawnErr) {
      log.error(`spawnPAgent: lifecycle.spawnAgent failed for ${operation}`, {
        cycleId,
        operation,
        error: spawnErr instanceof Error ? spawnErr.message : String(spawnErr),
      });
      return { success: false, error: String(spawnErr) };
    }

    // State update remains in caller (not part of spawnAgent's responsibility)
    sm.updateState(cycleId, {
      current_agent_id: agentId,
      current_pty_pid: null,
      [`${operation}_agent_id`]: agentId,
    } as Partial<PhronesisState>);

    recordEvent('apm', `phronesis_spawn_${operation}`, {
      cycleId,
      operation,
      pass,
      agentId,
    });

    return { success: true, ptyPid: undefined };
  }

  return {
    killPAgentProcess,
    retireAllPAgents,
    initiateRecall,
    spawnPAgent,
  };
}
