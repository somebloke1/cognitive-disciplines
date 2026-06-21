/**
 * Phronesis Cycle State Machine Graph Definition
 *
 * Models the compound state machine R(P1→P2→P3→P4→R) with states encoded as
 * (operation, sub_phase, status) triples in the phronesis_state table.
 *
 * Source: packages/apm/src/phronesis.ts (~1566 lines)
 * See design.md §III for type definitions.
 *
 * 17 legal compound states, ~40+ transitions including:
 * - Forward path (P1→P2→P3→P4→complete)
 * - Grounding curriculum self-loops and completions
 * - Recursion paths (P2/P3/P4 → earlier operations)
 * - Recall shortcuts (existing agent skips grounding)
 * - Abort from any active state
 * - Failure on spawn errors
 */

import type {
  StateMachineGraph,
  StateNode,
  TransitionEdge,
  TransitionEffects,
  NotificationEffect,
  DBMutation,
  AgentLifecycleEffect,
  CorrelationIdEffect,
  EventCompletenessCell,
  CompletenessMatrix,
} from '../types.js';

// Per-domain string literal types for compile-time matrix enforcement (D013)
type PhronesisState =
  | 'initiated'
  | 'p1:grounding' | 'p1:active' | 'p1:complete'
  | 'p2:grounding' | 'p2:active' | 'p2:complete'
  | 'p3:grounding' | 'p3:active' | 'p3:complete'
  | 'p4:grounding' | 'p4:active' | 'p4:complete'
  | 'complete' | 'aborted' | 'failed' | 'recursion_limit';

type PhronesisEvent =
  | 'handlePhronesisInitiate'
  | 'handlePhronesisRoleAck'
  | 'handlePhronesisGroundingComplete'
  | 'handlePhronesisSubmit'
  | 'handlePhronesisRecurse'
  | 'handlePhronesisAbort';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: empty effects template
// ─────────────────────────────────────────────────────────────────────────────

function emptyEffects(): TransitionEffects {
  return {
    notifications: [],
    signals: [],
    dbMutations: [],
    agentLifecycle: [],
    correlationIds: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification templates
// ─────────────────────────────────────────────────────────────────────────────

const phaseTransitionNotification: NotificationEffect = {
  type: 'phronesis:phase_transition',
  router: 'notifyInitiator',
  mandatory: true,
  payloadKeys: ['cycleId', 'fromPhase', 'toPhase', 'pass', 'message'],
  correlationIdBehavior: 'none',
  deliveryGuarantee: 'fire-and-forget',
  deliveryFailureConsequence: 'silent',
};

const completeNotification: NotificationEffect = {
  type: 'phronesis:complete',
  router: 'notifyInitiator',
  mandatory: true,
  payloadKeys: ['cycleId', 'archivePath', 'message', 'orientingQuestion', 'implicitUnknown', 'alignmentRationale'],
  correlationIdBehavior: 'none',
  deliveryGuarantee: 'fire-and-forget',
  deliveryFailureConsequence: 'silent',
};

const recallNotification: NotificationEffect = {
  type: 'phronesis:recall',
  router: 'notifyAgent',
  mandatory: true,
  payloadKeys: ['cycleId', 'operation', 'pass', 'fromOperation', 'fromAgent', 'roleReminder', 'instruction'],
  correlationIdBehavior: 'none',
  deliveryGuarantee: 'fire-and-forget',
  deliveryFailureConsequence: 'stuck-agent',
};

const recursionNotification: NotificationEffect = {
  type: 'phronesis:recursion',
  router: 'notifyInitiator',
  mandatory: true,
  payloadKeys: ['cycleId', 'target', 'reason', 'recursionCount', 'recursionLimit', 'message'],
  correlationIdBehavior: 'none',
  deliveryGuarantee: 'fire-and-forget',
  deliveryFailureConsequence: 'silent',
};

const recursionLimitNotification: NotificationEffect = {
  type: 'phronesis:recursion_limit',
  router: 'notifyInitiator',
  mandatory: true,
  payloadKeys: ['cycleId', 'archivePath', 'message'],
  correlationIdBehavior: 'none',
  deliveryGuarantee: 'fire-and-forget',
  deliveryFailureConsequence: 'silent',
};

const shutdownNotification: NotificationEffect = {
  type: 'shutdown',
  router: 'notifyAgent',
  mandatory: true,
  payloadKeys: ['reason'],
  correlationIdBehavior: 'none',
  deliveryGuarantee: 'fire-and-forget',
  deliveryFailureConsequence: 'silent',
};

// ─────────────────────────────────────────────────────────────────────────────
// DB Mutation templates
// ─────────────────────────────────────────────────────────────────────────────

const insertCycleRow: DBMutation = {
  table: 'phronesis_state',
  operation: 'INSERT',
  description: 'Create phronesis_state row with initial values',
};

const updatePhronesisState: DBMutation = {
  table: 'phronesis_state',
  operation: 'UPDATE',
  columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'],
  description: 'Update compound state columns in phronesis_state',
};

const updateGroundingStage: DBMutation = {
  table: 'phronesis_state',
  operation: 'UPDATE',
  columns: ['grounding_stage', 'timestamps', 'updated_at'],
  description: 'Increment grounding_stage in phronesis_state',
};

const insertContent: DBMutation = {
  table: 'phronesis_content',
  operation: 'INSERT',
  description: 'Store P-agent payload in phronesis_content',
};

const updateRecursionCount: DBMutation = {
  table: 'phronesis_state',
  operation: 'UPDATE',
  columns: ['operation', 'sub_phase', 'status', 'recursion_count', 'timestamps', 'updated_at'],
  description: 'Update compound state and increment recursion_count',
};

// ─────────────────────────────────────────────────────────────────────────────
// States (17 legal compound states)
// ─────────────────────────────────────────────────────────────────────────────

const states: StateNode[] = [
  // 1. initiated — cycle just created, P1 about to spawn
  {
    id: 'initiated',
    authority: 'db-persisted',
    terminal: false,
    description: 'Cycle created, P1 agent about to be spawned',
    invariants: ['operation=null', 'sub_phase=null', 'status=active'],
  },

  // 2-4. P1 compound states
  {
    id: 'p1:grounding',
    authority: 'db-persisted',
    terminal: false,
    description: 'P1 agent in grounding curriculum phase',
    invariants: ['operation=p1', 'sub_phase=grounding', 'status=active'],
  },
  {
    id: 'p1:active',
    authority: 'db-persisted',
    terminal: false,
    description: 'P1 agent performing attention operation',
    invariants: ['operation=p1', 'sub_phase=active', 'status=active'],
  },
  {
    id: 'p1:complete',
    authority: 'db-persisted',
    terminal: false,
    description: 'P1 payload submitted, routing to P2',
    invariants: ['operation=p1', 'sub_phase=complete', 'status=active'],
  },

  // 5-7. P2 compound states
  {
    id: 'p2:grounding',
    authority: 'db-persisted',
    terminal: false,
    description: 'P2 agent in grounding curriculum phase',
    invariants: ['operation=p2', 'sub_phase=grounding', 'status=active'],
  },
  {
    id: 'p2:active',
    authority: 'db-persisted',
    terminal: false,
    description: 'P2 agent performing intelligence operation',
    invariants: ['operation=p2', 'sub_phase=active', 'status=active'],
  },
  {
    id: 'p2:complete',
    authority: 'db-persisted',
    terminal: false,
    description: 'P2 payload submitted, routing to P3',
    invariants: ['operation=p2', 'sub_phase=complete', 'status=active'],
  },

  // 8-10. P3 compound states
  {
    id: 'p3:grounding',
    authority: 'db-persisted',
    terminal: false,
    description: 'P3 agent in grounding curriculum phase',
    invariants: ['operation=p3', 'sub_phase=grounding', 'status=active'],
  },
  {
    id: 'p3:active',
    authority: 'db-persisted',
    terminal: false,
    description: 'P3 agent performing reasonableness operation',
    invariants: ['operation=p3', 'sub_phase=active', 'status=active'],
  },
  {
    id: 'p3:complete',
    authority: 'db-persisted',
    terminal: false,
    description: 'P3 payload submitted, routing to P4',
    invariants: ['operation=p3', 'sub_phase=complete', 'status=active'],
  },

  // 11-13. P4 compound states
  {
    id: 'p4:grounding',
    authority: 'db-persisted',
    terminal: false,
    description: 'P4 agent in grounding curriculum phase',
    invariants: ['operation=p4', 'sub_phase=grounding', 'status=active'],
  },
  {
    id: 'p4:active',
    authority: 'db-persisted',
    terminal: false,
    description: 'P4 agent performing responsibility operation',
    invariants: ['operation=p4', 'sub_phase=active', 'status=active'],
  },
  {
    id: 'p4:complete',
    authority: 'db-persisted',
    terminal: false,
    description: 'P4 payload submitted, cycle completing',
    invariants: ['operation=p4', 'sub_phase=complete', 'status=active'],
  },

  // 14-17. Terminal states
  {
    id: 'complete',
    authority: 'db-persisted',
    terminal: true,
    description: 'Cycle successfully completed with all P-operations done',
    invariants: ['operation=null', 'sub_phase=null', 'status=complete'],
  },
  {
    id: 'aborted',
    authority: 'db-persisted',
    terminal: true,
    description: 'Cycle aborted by user or system',
    invariants: ['operation=null', 'sub_phase=null', 'status=aborted'],
  },
  {
    id: 'failed',
    authority: 'db-persisted',
    terminal: true,
    description: 'Cycle failed due to agent spawn failure',
    invariants: ['operation=null', 'sub_phase=null', 'status=failed'],
  },
  {
    id: 'recursion_limit',
    authority: 'db-persisted',
    terminal: true,
    description: 'Cycle stopped after exceeding recursion limit',
    invariants: ['operation=null', 'sub_phase=null', 'status=recursion_limit'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Transitions
// ─────────────────────────────────────────────────────────────────────────────

const transitions: TransitionEdge[] = [
  // =========================================================================
  // Forward Path: Initiation
  // =========================================================================

  // T1: initiated -> p1:grounding (normal path with grounding curriculum)
  // Source: handlePhronesisInitiate, line ~675
  // After INSERT, sets operation='p1', sub_phase='grounding', grounding_stage=0, then spawnPAgent
  {
    id: 'initiate-to-p1-grounding',
    from: 'initiated',
    to: 'p1:grounding',
    trigger: 'handlePhronesisInitiate',
    guards: ['valid cycleId, task, mode', 'no active cycle for initiator', 'spawnPAgent succeeds', 'grounding curriculum exists'],
    effects: {
      notifications: [{ ...phaseTransitionNotification }],
      signals: ['phronesis:initiated'],
      dbMutations: [
        insertCycleRow,
        { ...updatePhronesisState, description: 'Set operation=p1, sub_phase=grounding, status=active, grounding_stage=0' },
      ],
      agentLifecycle: [{ action: 'spawn', role: 'p1:research', description: 'Spawn P1 agent via spawnPAgent' }],
      correlationIds: [{ action: 'create', storageTable: 'env_vars' }],
    },
    isRecoveryPath: false,
    description: 'Initiate phronesis cycle, spawn P1 agent into grounding phase',
  },

  // T2: initiated -> failed (spawn failure)
  // Source: handlePhronesisInitiate, spawnResult.success check
  {
    id: 'initiate-spawn-failure',
    from: 'initiated',
    to: 'failed',
    trigger: 'handlePhronesisInitiate',
    guards: ['valid cycleId, task, mode', 'spawnPAgent fails'],
    effects: {
      notifications: [],
      signals: ['phronesis:initiated'],
      dbMutations: [
        insertCycleRow,
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status'], description: 'Set operation=null, sub_phase=null, status=failed' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Initiation fails due to P1 spawn failure',
  },

  // =========================================================================
  // Grounding Curriculum: Role Ack (initial acknowledgment)
  // =========================================================================

  // T3: p1:grounding -> p1:grounding (role ack delivers first curriculum stage)
  // Source: handlePhronesisRoleAck, line ~1251, Path 1: Fresh spawn
  // Guards: sub_phase='grounding', grounding_stage=0
  // Effect: grounding_stage set to 1
  {
    id: 'p1-grounding-role-ack',
    from: 'p1:grounding',
    to: 'p1:grounding',
    trigger: 'handlePhronesisRoleAck',
    guards: ['operation=p1', 'sub_phase=grounding', 'grounding_stage=0'],
    effects: {
      notifications: [],
      signals: [],
      dbMutations: [{ ...updateGroundingStage, description: 'Set grounding_stage=1, record role_ack timestamp' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P1 agent acknowledges role, receives first curriculum stage (self-loop)',
  },

  // T4-T6: Same role ack pattern for P2, P3, P4
  {
    id: 'p2-grounding-role-ack',
    from: 'p2:grounding',
    to: 'p2:grounding',
    trigger: 'handlePhronesisRoleAck',
    guards: ['operation=p2', 'sub_phase=grounding', 'grounding_stage=0'],
    effects: {
      notifications: [],
      signals: [],
      dbMutations: [{ ...updateGroundingStage, description: 'Set grounding_stage=1, record role_ack timestamp' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 agent acknowledges role, receives first curriculum stage (self-loop)',
  },
  {
    id: 'p3-grounding-role-ack',
    from: 'p3:grounding',
    to: 'p3:grounding',
    trigger: 'handlePhronesisRoleAck',
    guards: ['operation=p3', 'sub_phase=grounding', 'grounding_stage=0'],
    effects: {
      notifications: [],
      signals: [],
      dbMutations: [{ ...updateGroundingStage, description: 'Set grounding_stage=1, record role_ack timestamp' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 agent acknowledges role, receives first curriculum stage (self-loop)',
  },
  {
    id: 'p4-grounding-role-ack',
    from: 'p4:grounding',
    to: 'p4:grounding',
    trigger: 'handlePhronesisRoleAck',
    guards: ['operation=p4', 'sub_phase=grounding', 'grounding_stage=0'],
    effects: {
      notifications: [],
      signals: [],
      dbMutations: [{ ...updateGroundingStage, description: 'Set grounding_stage=1, record role_ack timestamp' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 agent acknowledges role, receives first curriculum stage (self-loop)',
  },

  // =========================================================================
  // Grounding Curriculum: Stage Advance (self-loop)
  // =========================================================================

  // T7: pN:grounding -> pN:grounding (advance to next curriculum stage)
  // Source: handlePhronesisGroundingComplete, line ~1140
  // Guards: grounding_stage > 0, more stages remain (advResult.phase === 'post_tasking')
  {
    id: 'p1-grounding-stage-advance',
    from: 'p1:grounding',
    to: 'p1:grounding',
    trigger: 'handlePhronesisGroundingComplete',
    guards: ['operation=p1', 'sub_phase=grounding', 'grounding_stage>0', 'more curriculum stages remain'],
    effects: {
      notifications: [],
      signals: [],
      dbMutations: [{ ...updateGroundingStage, description: 'Increment grounding_stage' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P1 completes a grounding stage, advances to next stage (self-loop)',
  },
  {
    id: 'p2-grounding-stage-advance',
    from: 'p2:grounding',
    to: 'p2:grounding',
    trigger: 'handlePhronesisGroundingComplete',
    guards: ['operation=p2', 'sub_phase=grounding', 'grounding_stage>0', 'more curriculum stages remain'],
    effects: {
      notifications: [],
      signals: [],
      dbMutations: [{ ...updateGroundingStage, description: 'Increment grounding_stage' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 completes a grounding stage, advances to next stage (self-loop)',
  },
  {
    id: 'p3-grounding-stage-advance',
    from: 'p3:grounding',
    to: 'p3:grounding',
    trigger: 'handlePhronesisGroundingComplete',
    guards: ['operation=p3', 'sub_phase=grounding', 'grounding_stage>0', 'more curriculum stages remain'],
    effects: {
      notifications: [],
      signals: [],
      dbMutations: [{ ...updateGroundingStage, description: 'Increment grounding_stage' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 completes a grounding stage, advances to next stage (self-loop)',
  },
  {
    id: 'p4-grounding-stage-advance',
    from: 'p4:grounding',
    to: 'p4:grounding',
    trigger: 'handlePhronesisGroundingComplete',
    guards: ['operation=p4', 'sub_phase=grounding', 'grounding_stage>0', 'more curriculum stages remain'],
    effects: {
      notifications: [],
      signals: [],
      dbMutations: [{ ...updateGroundingStage, description: 'Increment grounding_stage' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 completes a grounding stage, advances to next stage (self-loop)',
  },

  // =========================================================================
  // Grounding Curriculum: Completion (grounding -> active)
  // =========================================================================

  // T11: pN:grounding -> pN:active (final grounding stage complete)
  // Source: handlePhronesisGroundingComplete, advResult.phase === 'complete'
  {
    id: 'p1-grounding-complete',
    from: 'p1:grounding',
    to: 'p1:active',
    trigger: 'handlePhronesisGroundingComplete',
    guards: ['operation=p1', 'sub_phase=grounding', 'grounding_stage>0', 'final curriculum stage'],
    effects: {
      notifications: [],
      signals: ['phronesis:grounding_complete'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['sub_phase', 'grounding_stage', 'timestamps', 'updated_at'], description: 'Set sub_phase=active, grounding_stage=0' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P1 completes all grounding stages, transitions to active operation',
  },
  {
    id: 'p2-grounding-complete',
    from: 'p2:grounding',
    to: 'p2:active',
    trigger: 'handlePhronesisGroundingComplete',
    guards: ['operation=p2', 'sub_phase=grounding', 'grounding_stage>0', 'final curriculum stage'],
    effects: {
      notifications: [],
      signals: ['phronesis:grounding_complete'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['sub_phase', 'grounding_stage', 'timestamps', 'updated_at'], description: 'Set sub_phase=active, grounding_stage=0' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 completes all grounding stages, transitions to active operation',
  },
  {
    id: 'p3-grounding-complete',
    from: 'p3:grounding',
    to: 'p3:active',
    trigger: 'handlePhronesisGroundingComplete',
    guards: ['operation=p3', 'sub_phase=grounding', 'grounding_stage>0', 'final curriculum stage'],
    effects: {
      notifications: [],
      signals: ['phronesis:grounding_complete'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['sub_phase', 'grounding_stage', 'timestamps', 'updated_at'], description: 'Set sub_phase=active, grounding_stage=0' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 completes all grounding stages, transitions to active operation',
  },
  {
    id: 'p4-grounding-complete',
    from: 'p4:grounding',
    to: 'p4:active',
    trigger: 'handlePhronesisGroundingComplete',
    guards: ['operation=p4', 'sub_phase=grounding', 'grounding_stage>0', 'final curriculum stage'],
    effects: {
      notifications: [],
      signals: ['phronesis:grounding_complete'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['sub_phase', 'grounding_stage', 'timestamps', 'updated_at'], description: 'Set sub_phase=active, grounding_stage=0' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 completes all grounding stages, transitions to active operation',
  },

  // =========================================================================
  // Forward Path: Submission (active -> complete)
  // =========================================================================

  // T15: pN:active -> pN:complete (P-agent submits payload)
  // Source: handlePhronesisSubmit, line ~805
  {
    id: 'p1-submit',
    from: 'p1:active',
    to: 'p1:complete',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p1', 'sub_phase=active'],
    effects: {
      notifications: [],
      signals: ['phronesis:phase_complete'],
      dbMutations: [
        insertContent,
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['sub_phase', 'current_agent_id', 'p1_agent_id', 'timestamps', 'updated_at'], description: 'Set sub_phase=complete' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P1 submits attention findings, transitions to complete',
  },
  {
    id: 'p2-submit',
    from: 'p2:active',
    to: 'p2:complete',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p2', 'sub_phase=active'],
    effects: {
      notifications: [],
      signals: ['phronesis:phase_complete'],
      dbMutations: [
        insertContent,
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['sub_phase', 'current_agent_id', 'p2_agent_id', 'timestamps', 'updated_at'], description: 'Set sub_phase=complete' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 submits intelligence possibilities, transitions to complete',
  },
  {
    id: 'p3-submit',
    from: 'p3:active',
    to: 'p3:complete',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p3', 'sub_phase=active'],
    effects: {
      notifications: [],
      signals: ['phronesis:phase_complete'],
      dbMutations: [
        insertContent,
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['sub_phase', 'current_agent_id', 'p3_agent_id', 'timestamps', 'updated_at'], description: 'Set sub_phase=complete' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 submits reasonableness judgment, transitions to complete',
  },
  {
    id: 'p4-submit',
    from: 'p4:active',
    to: 'p4:complete',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p4', 'sub_phase=active'],
    effects: {
      notifications: [],
      signals: ['phronesis:phase_complete'],
      dbMutations: [
        insertContent,
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['sub_phase', 'current_agent_id', 'p4_agent_id', 'timestamps', 'updated_at'], description: 'Set sub_phase=complete' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 submits responsibility decision, transitions to complete',
  },

  // =========================================================================
  // Forward Path: Routing to Next Operation (complete -> next grounding/active)
  // =========================================================================

  // T19: p1:complete -> p2:grounding (fresh spawn, no existing P2 agent)
  // Source: handlePhronesisSubmit, after pN:complete, spawnPAgent for next op
  {
    id: 'p1-complete-to-p2-grounding',
    from: 'p1:complete',
    to: 'p2:grounding',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p1', 'no existing p2 agent (p2_agent_id is null)'],
    effects: {
      notifications: [{ ...phaseTransitionNotification }],
      signals: [],
      dbMutations: [{ ...updatePhronesisState, description: 'Set operation=p2, sub_phase=grounding, grounding_stage=0' }],
      agentLifecycle: [{ action: 'spawn', role: 'p2:ideate', description: 'Spawn P2 agent via spawnPAgent' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P1 complete → spawn fresh P2 agent into grounding',
  },

  // T20: p1:complete -> p2:active (recall existing P2 agent)
  // Source: handlePhronesisSubmit, initiateRecall path
  {
    id: 'p1-complete-to-p2-recall',
    from: 'p1:complete',
    to: 'p2:active',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p1', 'existing p2 agent (p2_agent_id is set)'],
    effects: {
      notifications: [
        { ...phaseTransitionNotification },
        { ...recallNotification },
      ],
      signals: [],
      dbMutations: [{ ...updatePhronesisState, description: 'Set operation=p2, sub_phase=active (skip grounding)' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P1 complete → recall existing P2 agent (skip grounding)',
  },

  // T21: p2:complete -> p3:grounding (fresh spawn)
  {
    id: 'p2-complete-to-p3-grounding',
    from: 'p2:complete',
    to: 'p3:grounding',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p2', 'no existing p3 agent (p3_agent_id is null)'],
    effects: {
      notifications: [{ ...phaseTransitionNotification }],
      signals: [],
      dbMutations: [{ ...updatePhronesisState, description: 'Set operation=p3, sub_phase=grounding, grounding_stage=0' }],
      agentLifecycle: [{ action: 'spawn', role: 'p3:judge', description: 'Spawn P3 agent via spawnPAgent' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 complete → spawn fresh P3 agent into grounding',
  },

  // T22: p2:complete -> p3:active (recall)
  {
    id: 'p2-complete-to-p3-recall',
    from: 'p2:complete',
    to: 'p3:active',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p2', 'existing p3 agent (p3_agent_id is set)'],
    effects: {
      notifications: [
        { ...phaseTransitionNotification },
        { ...recallNotification },
      ],
      signals: [],
      dbMutations: [{ ...updatePhronesisState, description: 'Set operation=p3, sub_phase=active (skip grounding)' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 complete → recall existing P3 agent (skip grounding)',
  },

  // T23: p3:complete -> p4:grounding (fresh spawn)
  {
    id: 'p3-complete-to-p4-grounding',
    from: 'p3:complete',
    to: 'p4:grounding',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p3', 'no existing p4 agent (p4_agent_id is null)'],
    effects: {
      notifications: [{ ...phaseTransitionNotification }],
      signals: [],
      dbMutations: [{ ...updatePhronesisState, description: 'Set operation=p4, sub_phase=grounding, grounding_stage=0' }],
      agentLifecycle: [{ action: 'spawn', role: 'p4:decide', description: 'Spawn P4 agent via spawnPAgent' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 complete → spawn fresh P4 agent into grounding',
  },

  // T24: p3:complete -> p4:active (recall)
  {
    id: 'p3-complete-to-p4-recall',
    from: 'p3:complete',
    to: 'p4:active',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p3', 'existing p4 agent (p4_agent_id is set)'],
    effects: {
      notifications: [
        { ...phaseTransitionNotification },
        { ...recallNotification },
      ],
      signals: [],
      dbMutations: [{ ...updatePhronesisState, description: 'Set operation=p4, sub_phase=active (skip grounding)' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 complete → recall existing P4 agent (skip grounding)',
  },

  // T25: p4:complete -> complete (cycle finishes)
  // Source: handlePhronesisSubmit, operation === 'p4' branch
  // Note: p4:active -> p4:complete and p4:complete -> complete happen within same handler call
  // but are modeled as the p4-submit transition (p4:active -> p4:complete) followed by this.
  {
    id: 'p4-complete-to-complete',
    from: 'p4:complete',
    to: 'complete',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p4'],
    effects: {
      notifications: [
        { ...completeNotification },
        { ...shutdownNotification },
      ],
      signals: ['phronesis:complete'],
      dbMutations: [
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=complete' },
      ],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 complete → cycle complete, archive written, all agents retired',
  },

  // =========================================================================
  // Forward Path: Spawn Failure during Routing
  // =========================================================================

  // T26-T28: pN:complete -> failed (spawn failure for next operation)
  // Source: handlePhronesisSubmit, spawnResult.success check after routing
  {
    id: 'p1-complete-spawn-failure',
    from: 'p1:complete',
    to: 'failed',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p1', 'no existing p2 agent', 'spawnPAgent for p2 fails'],
    effects: {
      notifications: [{ ...phaseTransitionNotification }],
      signals: [],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status'], description: 'Set operation=null, sub_phase=null, status=failed' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 spawn fails after P1 completion',
  },
  {
    id: 'p2-complete-spawn-failure',
    from: 'p2:complete',
    to: 'failed',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p2', 'no existing p3 agent', 'spawnPAgent for p3 fails'],
    effects: {
      notifications: [{ ...phaseTransitionNotification }],
      signals: [],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status'], description: 'Set operation=null, sub_phase=null, status=failed' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 spawn fails after P2 completion',
  },
  {
    id: 'p3-complete-spawn-failure',
    from: 'p3:complete',
    to: 'failed',
    trigger: 'handlePhronesisSubmit',
    guards: ['operation=p3', 'no existing p4 agent', 'spawnPAgent for p4 fails'],
    effects: {
      notifications: [{ ...phaseTransitionNotification }],
      signals: [],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status'], description: 'Set operation=null, sub_phase=null, status=failed' }],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 spawn fails after P3 completion',
  },

  // =========================================================================
  // Recall: Role Ack for Recalled Agents
  // =========================================================================

  // T29-T32: pN:active -> pN:active (recalled agent acknowledges role)
  // Source: handlePhronesisRoleAck, Path 2: Recall — agent already grounded
  // This is a no-op in terms of DB state but validates the agent
  {
    id: 'p1-active-recall-ack',
    from: 'p1:active',
    to: 'p1:active',
    trigger: 'handlePhronesisRoleAck',
    guards: ['operation=p1', 'sub_phase=active', 'agent matches p1_agent_id'],
    effects: emptyEffects(),
    isRecoveryPath: false,
    description: 'Recalled P1 agent acknowledges role (no state change, self-loop)',
  },
  {
    id: 'p2-active-recall-ack',
    from: 'p2:active',
    to: 'p2:active',
    trigger: 'handlePhronesisRoleAck',
    guards: ['operation=p2', 'sub_phase=active', 'agent matches p2_agent_id'],
    effects: emptyEffects(),
    isRecoveryPath: false,
    description: 'Recalled P2 agent acknowledges role (no state change, self-loop)',
  },
  {
    id: 'p3-active-recall-ack',
    from: 'p3:active',
    to: 'p3:active',
    trigger: 'handlePhronesisRoleAck',
    guards: ['operation=p3', 'sub_phase=active', 'agent matches p3_agent_id'],
    effects: emptyEffects(),
    isRecoveryPath: false,
    description: 'Recalled P3 agent acknowledges role (no state change, self-loop)',
  },
  {
    id: 'p4-active-recall-ack',
    from: 'p4:active',
    to: 'p4:active',
    trigger: 'handlePhronesisRoleAck',
    guards: ['operation=p4', 'sub_phase=active', 'agent matches p4_agent_id'],
    effects: emptyEffects(),
    isRecoveryPath: false,
    description: 'Recalled P4 agent acknowledges role (no state change, self-loop)',
  },

  // =========================================================================
  // Recursion Paths: P2 -> earlier operations
  // =========================================================================

  // T33: p2:active -> p1:grounding (fresh spawn, no existing P1 agent)
  // Source: handlePhronesisRecurse, line ~968
  {
    id: 'p2-recurse-to-p1-grounding',
    from: 'p2:active',
    to: 'p1:grounding',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p2', 'sub_phase=active', 'target=p1', 'no existing p1 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p1, sub_phase=grounding, increment recursion_count' },
      ],
      agentLifecycle: [{ action: 'spawn', role: 'p1:research', description: 'Spawn fresh P1 agent for recursion' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 recurses to P1 — fresh spawn into grounding',
  },

  // T34: p2:active -> p1:active (recall existing P1 agent)
  {
    id: 'p2-recurse-to-p1-recall',
    from: 'p2:active',
    to: 'p1:active',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p2', 'sub_phase=active', 'target=p1', 'existing p1 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [
        { ...recursionNotification },
        { ...recallNotification },
      ],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p1, sub_phase=active, increment recursion_count' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 recurses to P1 — recall existing agent (skip grounding)',
  },

  // =========================================================================
  // Recursion Paths: P3 -> earlier operations
  // =========================================================================

  // T35: p3:active -> p1:grounding (fresh spawn)
  {
    id: 'p3-recurse-to-p1-grounding',
    from: 'p3:active',
    to: 'p1:grounding',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p3', 'sub_phase=active', 'target=p1', 'no existing p1 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p1, sub_phase=grounding, increment recursion_count' },
      ],
      agentLifecycle: [{ action: 'spawn', role: 'p1:research', description: 'Spawn fresh P1 agent for recursion' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 recurses to P1 — fresh spawn into grounding',
  },

  // T36: p3:active -> p1:active (recall)
  {
    id: 'p3-recurse-to-p1-recall',
    from: 'p3:active',
    to: 'p1:active',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p3', 'sub_phase=active', 'target=p1', 'existing p1 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [
        { ...recursionNotification },
        { ...recallNotification },
      ],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p1, sub_phase=active, increment recursion_count' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 recurses to P1 — recall existing agent (skip grounding)',
  },

  // T37: p3:active -> p2:grounding (fresh spawn)
  {
    id: 'p3-recurse-to-p2-grounding',
    from: 'p3:active',
    to: 'p2:grounding',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p3', 'sub_phase=active', 'target=p2', 'no existing p2 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p2, sub_phase=grounding, increment recursion_count' },
      ],
      agentLifecycle: [{ action: 'spawn', role: 'p2:ideate', description: 'Spawn fresh P2 agent for recursion' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 recurses to P2 — fresh spawn into grounding',
  },

  // T38: p3:active -> p2:active (recall)
  {
    id: 'p3-recurse-to-p2-recall',
    from: 'p3:active',
    to: 'p2:active',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p3', 'sub_phase=active', 'target=p2', 'existing p2 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [
        { ...recursionNotification },
        { ...recallNotification },
      ],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p2, sub_phase=active, increment recursion_count' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 recurses to P2 — recall existing agent (skip grounding)',
  },

  // =========================================================================
  // Recursion Paths: P4 -> earlier operations
  // =========================================================================

  // T39: p4:active -> p1:grounding (fresh spawn)
  {
    id: 'p4-recurse-to-p1-grounding',
    from: 'p4:active',
    to: 'p1:grounding',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p4', 'sub_phase=active', 'target=p1', 'no existing p1 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p1, sub_phase=grounding, increment recursion_count' },
      ],
      agentLifecycle: [{ action: 'spawn', role: 'p1:research', description: 'Spawn fresh P1 agent for recursion' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 recurses to P1 — fresh spawn into grounding',
  },

  // T40: p4:active -> p1:active (recall)
  {
    id: 'p4-recurse-to-p1-recall',
    from: 'p4:active',
    to: 'p1:active',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p4', 'sub_phase=active', 'target=p1', 'existing p1 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [
        { ...recursionNotification },
        { ...recallNotification },
      ],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p1, sub_phase=active, increment recursion_count' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 recurses to P1 — recall existing agent (skip grounding)',
  },

  // T41: p4:active -> p2:grounding (fresh spawn)
  {
    id: 'p4-recurse-to-p2-grounding',
    from: 'p4:active',
    to: 'p2:grounding',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p4', 'sub_phase=active', 'target=p2', 'no existing p2 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p2, sub_phase=grounding, increment recursion_count' },
      ],
      agentLifecycle: [{ action: 'spawn', role: 'p2:ideate', description: 'Spawn fresh P2 agent for recursion' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 recurses to P2 — fresh spawn into grounding',
  },

  // T42: p4:active -> p2:active (recall)
  {
    id: 'p4-recurse-to-p2-recall',
    from: 'p4:active',
    to: 'p2:active',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p4', 'sub_phase=active', 'target=p2', 'existing p2 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [
        { ...recursionNotification },
        { ...recallNotification },
      ],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p2, sub_phase=active, increment recursion_count' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 recurses to P2 — recall existing agent (skip grounding)',
  },

  // T43: p4:active -> p3:grounding (fresh spawn)
  {
    id: 'p4-recurse-to-p3-grounding',
    from: 'p4:active',
    to: 'p3:grounding',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p4', 'sub_phase=active', 'target=p3', 'no existing p3 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p3, sub_phase=grounding, increment recursion_count' },
      ],
      agentLifecycle: [{ action: 'spawn', role: 'p3:judge', description: 'Spawn fresh P3 agent for recursion' }],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 recurses to P3 — fresh spawn into grounding',
  },

  // T44: p4:active -> p3:active (recall)
  {
    id: 'p4-recurse-to-p3-recall',
    from: 'p4:active',
    to: 'p3:active',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p4', 'sub_phase=active', 'target=p3', 'existing p3 agent', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [
        { ...recursionNotification },
        { ...recallNotification },
      ],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount, description: 'Set operation=p3, sub_phase=active, increment recursion_count' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 recurses to P3 — recall existing agent (skip grounding)',
  },

  // =========================================================================
  // Recursion Limit
  // =========================================================================

  // T45: p2:active -> recursion_limit
  {
    id: 'p2-recursion-limit',
    from: 'p2:active',
    to: 'recursion_limit',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p2', 'sub_phase=active', 'recursion_count > recursion_limit'],
    effects: {
      notifications: [
        { ...recursionLimitNotification },
        { ...shutdownNotification },
      ],
      signals: [],
      dbMutations: [
        insertContent,
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'recursion_count', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=recursion_limit' },
      ],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P2 recursion exceeds limit — cycle stopped, partial archive written',
  },

  // T46: p3:active -> recursion_limit
  {
    id: 'p3-recursion-limit',
    from: 'p3:active',
    to: 'recursion_limit',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p3', 'sub_phase=active', 'recursion_count > recursion_limit'],
    effects: {
      notifications: [
        { ...recursionLimitNotification },
        { ...shutdownNotification },
      ],
      signals: [],
      dbMutations: [
        insertContent,
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'recursion_count', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=recursion_limit' },
      ],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P3 recursion exceeds limit — cycle stopped, partial archive written',
  },

  // T47: p4:active -> recursion_limit
  {
    id: 'p4-recursion-limit',
    from: 'p4:active',
    to: 'recursion_limit',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p4', 'sub_phase=active', 'recursion_count > recursion_limit'],
    effects: {
      notifications: [
        { ...recursionLimitNotification },
        { ...shutdownNotification },
      ],
      signals: [],
      dbMutations: [
        insertContent,
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'recursion_count', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=recursion_limit' },
      ],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'P4 recursion exceeds limit — cycle stopped, partial archive written',
  },

  // =========================================================================
  // Recursion Spawn Failure
  // =========================================================================

  // T48-T53: pN:active -> failed (spawn failure during recursion)
  // Source: handlePhronesisRecurse, spawnResult.success check
  {
    id: 'p2-recurse-spawn-failure',
    from: 'p2:active',
    to: 'failed',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p2', 'sub_phase=active', 'target requires fresh spawn', 'spawnPAgent fails', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount },
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status'], description: 'Set operation=null, sub_phase=null, status=failed' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Spawn failure during P2 recursion',
  },
  {
    id: 'p3-recurse-spawn-failure',
    from: 'p3:active',
    to: 'failed',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p3', 'sub_phase=active', 'target requires fresh spawn', 'spawnPAgent fails', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount },
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status'], description: 'Set operation=null, sub_phase=null, status=failed' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Spawn failure during P3 recursion',
  },
  {
    id: 'p4-recurse-spawn-failure',
    from: 'p4:active',
    to: 'failed',
    trigger: 'handlePhronesisRecurse',
    guards: ['operation=p4', 'sub_phase=active', 'target requires fresh spawn', 'spawnPAgent fails', 'recursion_count <= recursion_limit'],
    effects: {
      notifications: [{ ...recursionNotification }],
      signals: ['phronesis:recursed'],
      dbMutations: [
        insertContent,
        { ...updateRecursionCount },
        { table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status'], description: 'Set operation=null, sub_phase=null, status=failed' },
      ],
      agentLifecycle: [],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Spawn failure during P4 recursion',
  },

  // =========================================================================
  // Abort: Any active state -> aborted
  // =========================================================================

  // Source: handlePhronesisAbort, line ~1369
  // Guards: status === 'active' (not terminal)
  // All non-terminal states have status='active', so all 13 non-terminal states can abort

  {
    id: 'abort-from-initiated',
    from: 'initiated',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from initiated state',
  },
  {
    id: 'abort-from-p1-grounding',
    from: 'p1:grounding',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P1 grounding',
  },
  {
    id: 'abort-from-p1-active',
    from: 'p1:active',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P1 active',
  },
  {
    id: 'abort-from-p1-complete',
    from: 'p1:complete',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P1 complete',
  },
  {
    id: 'abort-from-p2-grounding',
    from: 'p2:grounding',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P2 grounding',
  },
  {
    id: 'abort-from-p2-active',
    from: 'p2:active',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P2 active',
  },
  {
    id: 'abort-from-p2-complete',
    from: 'p2:complete',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P2 complete',
  },
  {
    id: 'abort-from-p3-grounding',
    from: 'p3:grounding',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P3 grounding',
  },
  {
    id: 'abort-from-p3-active',
    from: 'p3:active',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P3 active',
  },
  {
    id: 'abort-from-p3-complete',
    from: 'p3:complete',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P3 complete',
  },
  {
    id: 'abort-from-p4-grounding',
    from: 'p4:grounding',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P4 grounding',
  },
  {
    id: 'abort-from-p4-active',
    from: 'p4:active',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P4 active',
  },
  {
    id: 'abort-from-p4-complete',
    from: 'p4:complete',
    to: 'aborted',
    trigger: 'handlePhronesisAbort',
    guards: ['status=active'],
    effects: {
      notifications: [{ ...shutdownNotification }],
      signals: ['phronesis:aborted'],
      dbMutations: [{ table: 'phronesis_state', operation: 'UPDATE', columns: ['operation', 'sub_phase', 'status', 'timestamps', 'updated_at'], description: 'Set operation=null, sub_phase=null, status=aborted via sm.transition' }],
      agentLifecycle: [
        { action: 'retire', description: 'Retire all P-agents via retireAllPAgents' },
        { action: 'kill', description: 'Kill all P-agent processes (defensive)' },
      ],
      correlationIds: [],
    },
    isRecoveryPath: false,
    description: 'Abort cycle from P4 complete',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Graph Export
// ─────────────────────────────────────────────────────────────────────────────

export const phronesisGraph: StateMachineGraph = {
  name: 'phronesis',
  table: 'phronesis_state',
  stateColumn: ['operation', 'sub_phase', 'status'],
  states,
  transitions,
  initialState: 'initiated',
  terminalStates: ['complete', 'aborted', 'failed', 'recursion_limit'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Completeness Matrix: 17 states × 6 events = 102 cells
// ─────────────────────────────────────────────────────────────────────────────

export const phronesisCompletenessMatrix = {
  // ── initiated ──
  initiated: {
    handlePhronesisInitiate: {
      state: 'initiated',
      event: 'handlePhronesisInitiate',
      behavior: 'transition',
      transitionId: 'initiate-to-p1-grounding',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'initiated',
      event: 'handlePhronesisRoleAck',
      behavior: 'rejection',
      rejectionMechanism: 'Phase mismatch: role_ack not valid in initiated state',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'initiated',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: Grounding completion not valid in initiated state',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'initiated',
      event: 'handlePhronesisSubmit',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: no active operation yet',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'initiated',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: no active operation yet',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'initiated',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-initiated',
    } as EventCompletenessCell,
  },

  // ── p1:grounding ──
  'p1:grounding': {
    handlePhronesisInitiate: {
      state: 'p1:grounding',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p1:grounding',
      event: 'handlePhronesisRoleAck',
      behavior: 'transition',
      transitionId: 'p1-grounding-role-ack',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p1:grounding',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'transition',
      transitionId: 'p1-grounding-stage-advance',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p1:grounding',
      event: 'handlePhronesisSubmit',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: still in grounding phase, complete grounding first',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p1:grounding',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: complete grounding before recursing',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p1:grounding',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p1-grounding',
    } as EventCompletenessCell,
  },

  // ── p1:active ──
  'p1:active': {
    handlePhronesisInitiate: {
      state: 'p1:active',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p1:active',
      event: 'handlePhronesisRoleAck',
      behavior: 'transition',
      transitionId: 'p1-active-recall-ack',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p1:active',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: grounding already complete, proceed with operation',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p1:active',
      event: 'handlePhronesisSubmit',
      behavior: 'transition',
      transitionId: 'p1-submit',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p1:active',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: P1 cannot recurse — no prior operation',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p1:active',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p1-active',
    } as EventCompletenessCell,
  },

  // ── p1:complete ──
  'p1:complete': {
    handlePhronesisInitiate: {
      state: 'p1:complete',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p1:complete',
      event: 'handlePhronesisRoleAck',
      behavior: 'rejection',
      rejectionMechanism: 'Phase mismatch: role_ack not valid in complete sub-phase',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p1:complete',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: Grounding completion not valid in complete sub-phase',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p1:complete',
      event: 'handlePhronesisSubmit',
      behavior: 'transition',
      transitionId: 'p1-complete-to-p2-grounding',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p1:complete',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: operation already submitted',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p1:complete',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p1-complete',
    } as EventCompletenessCell,
  },

  // ── p2:grounding ──
  'p2:grounding': {
    handlePhronesisInitiate: {
      state: 'p2:grounding',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p2:grounding',
      event: 'handlePhronesisRoleAck',
      behavior: 'transition',
      transitionId: 'p2-grounding-role-ack',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p2:grounding',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'transition',
      transitionId: 'p2-grounding-stage-advance',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p2:grounding',
      event: 'handlePhronesisSubmit',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: still in grounding phase, complete grounding first',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p2:grounding',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: complete grounding before recursing',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p2:grounding',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p2-grounding',
    } as EventCompletenessCell,
  },

  // ── p2:active ──
  'p2:active': {
    handlePhronesisInitiate: {
      state: 'p2:active',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p2:active',
      event: 'handlePhronesisRoleAck',
      behavior: 'transition',
      transitionId: 'p2-active-recall-ack',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p2:active',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: grounding already complete, proceed with operation',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p2:active',
      event: 'handlePhronesisSubmit',
      behavior: 'transition',
      transitionId: 'p2-submit',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p2:active',
      event: 'handlePhronesisRecurse',
      behavior: 'transition',
      transitionId: 'p2-recurse-to-p1-grounding',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p2:active',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p2-active',
    } as EventCompletenessCell,
  },

  // ── p2:complete ──
  'p2:complete': {
    handlePhronesisInitiate: {
      state: 'p2:complete',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p2:complete',
      event: 'handlePhronesisRoleAck',
      behavior: 'rejection',
      rejectionMechanism: 'Phase mismatch: role_ack not valid in complete sub-phase',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p2:complete',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: Grounding completion not valid in complete sub-phase',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p2:complete',
      event: 'handlePhronesisSubmit',
      behavior: 'transition',
      transitionId: 'p2-complete-to-p3-grounding',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p2:complete',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: operation already submitted',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p2:complete',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p2-complete',
    } as EventCompletenessCell,
  },

  // ── p3:grounding ──
  'p3:grounding': {
    handlePhronesisInitiate: {
      state: 'p3:grounding',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p3:grounding',
      event: 'handlePhronesisRoleAck',
      behavior: 'transition',
      transitionId: 'p3-grounding-role-ack',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p3:grounding',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'transition',
      transitionId: 'p3-grounding-stage-advance',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p3:grounding',
      event: 'handlePhronesisSubmit',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: still in grounding phase, complete grounding first',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p3:grounding',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: complete grounding before recursing',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p3:grounding',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p3-grounding',
    } as EventCompletenessCell,
  },

  // ── p3:active ──
  'p3:active': {
    handlePhronesisInitiate: {
      state: 'p3:active',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p3:active',
      event: 'handlePhronesisRoleAck',
      behavior: 'transition',
      transitionId: 'p3-active-recall-ack',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p3:active',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: grounding already complete, proceed with operation',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p3:active',
      event: 'handlePhronesisSubmit',
      behavior: 'transition',
      transitionId: 'p3-submit',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p3:active',
      event: 'handlePhronesisRecurse',
      behavior: 'transition',
      transitionId: 'p3-recurse-to-p1-grounding',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p3:active',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p3-active',
    } as EventCompletenessCell,
  },

  // ── p3:complete ──
  'p3:complete': {
    handlePhronesisInitiate: {
      state: 'p3:complete',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p3:complete',
      event: 'handlePhronesisRoleAck',
      behavior: 'rejection',
      rejectionMechanism: 'Phase mismatch: role_ack not valid in complete sub-phase',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p3:complete',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: Grounding completion not valid in complete sub-phase',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p3:complete',
      event: 'handlePhronesisSubmit',
      behavior: 'transition',
      transitionId: 'p3-complete-to-p4-grounding',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p3:complete',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: operation already submitted',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p3:complete',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p3-complete',
    } as EventCompletenessCell,
  },

  // ── p4:grounding ──
  'p4:grounding': {
    handlePhronesisInitiate: {
      state: 'p4:grounding',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p4:grounding',
      event: 'handlePhronesisRoleAck',
      behavior: 'transition',
      transitionId: 'p4-grounding-role-ack',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p4:grounding',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'transition',
      transitionId: 'p4-grounding-stage-advance',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p4:grounding',
      event: 'handlePhronesisSubmit',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: still in grounding phase, complete grounding first',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p4:grounding',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: complete grounding before recursing',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p4:grounding',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p4-grounding',
    } as EventCompletenessCell,
  },

  // ── p4:active ──
  'p4:active': {
    handlePhronesisInitiate: {
      state: 'p4:active',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p4:active',
      event: 'handlePhronesisRoleAck',
      behavior: 'transition',
      transitionId: 'p4-active-recall-ack',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p4:active',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: grounding already complete, proceed with operation',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p4:active',
      event: 'handlePhronesisSubmit',
      behavior: 'transition',
      transitionId: 'p4-submit',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p4:active',
      event: 'handlePhronesisRecurse',
      behavior: 'transition',
      transitionId: 'p4-recurse-to-p1-grounding',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p4:active',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p4-active',
    } as EventCompletenessCell,
  },

  // ── p4:complete ──
  'p4:complete': {
    handlePhronesisInitiate: {
      state: 'p4:complete',
      event: 'handlePhronesisInitiate',
      behavior: 'rejection',
      rejectionMechanism: 'handlePhronesisInitiate only valid from initiated state',
    } as EventCompletenessCell,
    handlePhronesisRoleAck: {
      state: 'p4:complete',
      event: 'handlePhronesisRoleAck',
      behavior: 'rejection',
      rejectionMechanism: 'Phase mismatch: role_ack not valid in complete sub-phase',
    } as EventCompletenessCell,
    handlePhronesisGroundingComplete: {
      state: 'p4:complete',
      event: 'handlePhronesisGroundingComplete',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: Grounding completion not valid in complete sub-phase',
    } as EventCompletenessCell,
    handlePhronesisSubmit: {
      state: 'p4:complete',
      event: 'handlePhronesisSubmit',
      behavior: 'transition',
      transitionId: 'p4-complete-to-complete',
    } as EventCompletenessCell,
    handlePhronesisRecurse: {
      state: 'p4:complete',
      event: 'handlePhronesisRecurse',
      behavior: 'rejection',
      rejectionMechanism: 'rejectOutOfSequence: operation already submitted',
    } as EventCompletenessCell,
    handlePhronesisAbort: {
      state: 'p4:complete',
      event: 'handlePhronesisAbort',
      behavior: 'transition',
      transitionId: 'abort-from-p4-complete',
    } as EventCompletenessCell,
  },

  // ── Terminal states: all events ignored (4 states × 6 events = 24 cells) ──

  complete: {
    handlePhronesisInitiate: { state: 'complete', event: 'handlePhronesisInitiate', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisRoleAck: { state: 'complete', event: 'handlePhronesisRoleAck', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisGroundingComplete: { state: 'complete', event: 'handlePhronesisGroundingComplete', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisSubmit: { state: 'complete', event: 'handlePhronesisSubmit', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisRecurse: { state: 'complete', event: 'handlePhronesisRecurse', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisAbort: { state: 'complete', event: 'handlePhronesisAbort', behavior: 'ignore' } as EventCompletenessCell,
  },

  aborted: {
    handlePhronesisInitiate: { state: 'aborted', event: 'handlePhronesisInitiate', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisRoleAck: { state: 'aborted', event: 'handlePhronesisRoleAck', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisGroundingComplete: { state: 'aborted', event: 'handlePhronesisGroundingComplete', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisSubmit: { state: 'aborted', event: 'handlePhronesisSubmit', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisRecurse: { state: 'aborted', event: 'handlePhronesisRecurse', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisAbort: { state: 'aborted', event: 'handlePhronesisAbort', behavior: 'ignore' } as EventCompletenessCell,
  },

  failed: {
    handlePhronesisInitiate: { state: 'failed', event: 'handlePhronesisInitiate', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisRoleAck: { state: 'failed', event: 'handlePhronesisRoleAck', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisGroundingComplete: { state: 'failed', event: 'handlePhronesisGroundingComplete', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisSubmit: { state: 'failed', event: 'handlePhronesisSubmit', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisRecurse: { state: 'failed', event: 'handlePhronesisRecurse', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisAbort: { state: 'failed', event: 'handlePhronesisAbort', behavior: 'ignore' } as EventCompletenessCell,
  },

  recursion_limit: {
    handlePhronesisInitiate: { state: 'recursion_limit', event: 'handlePhronesisInitiate', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisRoleAck: { state: 'recursion_limit', event: 'handlePhronesisRoleAck', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisGroundingComplete: { state: 'recursion_limit', event: 'handlePhronesisGroundingComplete', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisSubmit: { state: 'recursion_limit', event: 'handlePhronesisSubmit', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisRecurse: { state: 'recursion_limit', event: 'handlePhronesisRecurse', behavior: 'ignore' } as EventCompletenessCell,
    handlePhronesisAbort: { state: 'recursion_limit', event: 'handlePhronesisAbort', behavior: 'ignore' } as EventCompletenessCell,
  },
} satisfies CompletenessMatrix<PhronesisState, PhronesisEvent>;
