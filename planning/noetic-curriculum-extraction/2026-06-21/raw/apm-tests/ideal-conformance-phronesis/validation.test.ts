/**
 * Phronesis D015 handler validation tests.
 *
 * Decision: D015 (Malformed Payload Handling)
 *
 * Tests that each handler properly validates its input payload and
 * returns appropriate error responses for malformed inputs.
 *
 * Handlers tested:
 *   - handlePhronesisSubmit: requires cycleId, operation, content
 *   - handlePhronesisRecurse: requires cycleId, target, reason, content
 *   - handlePhronesisRoleAck: requires cycleId, operation
 *   - handlePhronesisGroundingComplete: requires cycleId, operation
 *   - handlePhronesisInitiate: requires cycleId, task, mode
 *   - handlePhronesisAbort: no required fields (cycleId optional for lookup)
 *
 * Source: packages/apm/src/phronesis.ts
 * Ideal:  .working/state-machine-audits/ideal/phronesis.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers/db-setup.js';
import { createTestContext } from '../helpers/mock-context.js';
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
  grounding_stage?: number;
  current_agent_id?: string | null;
}) {
  db.prepare(
    `INSERT INTO phronesis_state
      (id, operation, sub_phase, status, mode, task, initiator_id,
       recursion_count, recursion_limit, grounding_stage,
       current_agent_id, p1_agent_id, p2_agent_id, p3_agent_id, p4_agent_id,
       orienting_question, implicit_unknown, updated_at)
     VALUES (?, ?, ?, ?, 'recommend-only', 'test task', 'initiator-1',
       ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'test question', 'test unknown',
       datetime('now'))`
  ).run(
    cycleId,
    state.operation, state.sub_phase, state.status,
    state.recursion_count ?? 0, state.recursion_limit ?? 5,
    state.grounding_stage ?? 0,
    state.current_agent_id ?? null,
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

function createHandlers(db: Database.Database) {
  const notifCapture = createNotificationCapture();
  const ctx = createTestContext(db, {
    notifyAgent: notifCapture.mockNotifyAgent,
  });
  const lifecycle = createMockLifecycle();
  const handlers = createPhronesisHandlers(ctx, {
    lifecycle,
    routing: { notifyInitiator: notifCapture.mockNotifyInitiator },
  });
  return { handlers, notifCapture };
}

// =============================================================================

describe('Phronesis D015 validation — malformed payload handling', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  // ─── handlePhronesisSubmit ──────────────────────────────────────────────────

  describe('handlePhronesisSubmit validation', () => {
    it('D015-phronesis-submit: missing cycleId should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisSubmit({
        cycleId: '',
        operation: 'p1',
        content: 'payload',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('D015-phronesis-submit: missing operation should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-val-1',
        operation: '' as any,
        content: 'payload',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-submit: missing content should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-val-2',
        operation: 'p1',
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-submit: non-existent cycle should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'nonexistent-cycle',
        operation: 'p1',
        content: 'payload',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('D015-phronesis-submit: wrong phase should reject out of sequence', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-val-phase', {
        operation: 'p1', sub_phase: 'grounding', status: 'active',
        grounding_stage: 1,
      });
      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-val-phase',
        operation: 'p1',
        content: 'payload',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── handlePhronesisRecurse ─────────────────────────────────────────────────

  describe('handlePhronesisRecurse validation', () => {
    it('D015-phronesis-recurse: missing target should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-1',
        operation: 'p2',
        target: '' as any,
        reason: 'test',
        content: 'payload',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-recurse: missing reason should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-1',
        operation: 'p2',
        target: 'p1',
        reason: '',
        content: 'payload',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-recurse: missing content should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-1',
        operation: 'p2',
        target: 'p1',
        reason: 'test',
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-recurse: P1 cannot recurse (SI-1)', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-val-si1', {
        operation: 'p1', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p1',
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-val-si1',
        operation: 'p1',
        target: 'p1' as any,
        reason: 'impossible',
        content: 'payload',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-recurse: cannot recurse to same or later operation (SI-2)', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-val-si2', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2',
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-val-si2',
        operation: 'p2',
        target: 'p3',
        reason: 'forward recursion',
        content: 'payload',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-recurse: cannot recurse from grounding phase', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-val-ground', {
        operation: 'p2', sub_phase: 'grounding', status: 'active',
        grounding_stage: 1, current_agent_id: 'agent-p2',
      });
      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-val-ground',
        operation: 'p2',
        target: 'p1',
        reason: 'test',
        content: 'payload',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── handlePhronesisRoleAck ─────────────────────────────────────────────────

  describe('handlePhronesisRoleAck validation', () => {
    it('D015-phronesis-role-ack: missing cycleId should return error', () => {
      const { handlers } = createHandlers(db);
      const result = handlers.handlePhronesisRoleAck({
        cycleId: '',
        operation: 'p1',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-role-ack: missing operation should return error', () => {
      const { handlers } = createHandlers(db);
      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'cycle-1',
        operation: '' as any,
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-role-ack: non-existent cycle should return error', () => {
      const { handlers } = createHandlers(db);
      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'nonexistent',
        operation: 'p1',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-role-ack: wrong agent for recall should return error', () => {
      const { handlers } = createHandlers(db);
      // Set up p1:active with a specific agent
      db.prepare(
        `INSERT INTO phronesis_state
          (id, operation, sub_phase, status, mode, task, initiator_id,
           recursion_count, recursion_limit, grounding_stage,
           current_agent_id, p1_agent_id, p2_agent_id, p3_agent_id, p4_agent_id,
           orienting_question, implicit_unknown, updated_at)
         VALUES ('cycle-wrong-agent', 'p1', 'active', 'active', 'recommend-only', 'test', 'init-1',
           0, 5, 0, 'expected-agent', 'expected-agent', NULL, NULL, NULL,
           'q', 'u', datetime('now'))`
      ).run();
      const result = handlers.handlePhronesisRoleAck({
        cycleId: 'cycle-wrong-agent',
        operation: 'p1',
        agentId: 'wrong-agent',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── handlePhronesisGroundingComplete ───────────────────────────────────────

  describe('handlePhronesisGroundingComplete validation', () => {
    it('D015-phronesis-grounding-complete: missing cycleId should return error', () => {
      const { handlers } = createHandlers(db);
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: '',
        operation: 'p1',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-grounding-complete: missing operation should return error', () => {
      const { handlers } = createHandlers(db);
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-1',
        operation: '' as any,
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-grounding-complete: stage 0 should require role_ack first', () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-gc-stage0', {
        operation: 'p1', sub_phase: 'grounding', status: 'active',
        grounding_stage: 0,
      });
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-gc-stage0',
        operation: 'p1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('role_ack');
    });

    it('D015-phronesis-grounding-complete: already active should reject', () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-gc-active', {
        operation: 'p1', sub_phase: 'active', status: 'active',
      });
      const result = handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-gc-active',
        operation: 'p1',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── handlePhronesisInitiate ────────────────────────────────────────────────

  describe('handlePhronesisInitiate validation', () => {
    it('D015-phronesis-initiate: missing cycleId should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisInitiate({
        cycleId: '',
        task: 'test',
        mode: 'recommend-only',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-initiate: missing task should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-val-init',
        task: '',
        mode: 'recommend-only',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-initiate: invalid mode should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisInitiate({
        cycleId: 'cycle-val-mode',
        task: 'test',
        mode: 'invalid-mode' as any,
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-initiate: duplicate active cycle should succeed with activeDisciplines info', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'existing-cycle', {
        operation: 'p1', sub_phase: 'active', status: 'active',
      });
      // Concurrent cycles are now allowed — initiating with same initiator should succeed
      // and return activeDisciplines listing the existing cycle
      const result = await handlers.handlePhronesisInitiate({
        cycleId: 'new-cycle',
        task: 'test',
        mode: 'recommend-only',
        initiatorId: 'initiator-1',
      });
      expect(result.success).toBe(true);
      expect((result as { activeDisciplines?: unknown[] }).activeDisciplines).toBeDefined();
      expect((result as { activeDisciplines?: { id: string }[] }).activeDisciplines).toContainEqual(
        expect.objectContaining({ id: 'existing-cycle' }),
      );
    });
  });

  // ─── D015(b): Retry notification with schema info ────────────────────────────

  describe('D015(b): Retry notification with schema info', () => {
    it('D015-phronesis-submit-retry: missing content should trigger retry notification with schema', async () => {
      const { handlers, notifCapture } = createHandlers(db);
      setupPhronesisState(db, 'cycle-retry-submit', {
        operation: 'p1', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p1',
      });

      await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-retry-submit',
        operation: 'p1',
        agentId: 'agent-p1',
        content: '',
      });

      // D015(b): malformed payload must trigger apm:retry_prompt with schema information
      // WILL FAIL: no retry notification mechanism exists in source
      notifCapture.assertRetryNotification('handlePhronesisSubmit');
    });

    it('D015-phronesis-recurse-retry: wrong types should trigger retry notification with schema', async () => {
      const { handlers, notifCapture } = createHandlers(db);
      setupPhronesisState(db, 'cycle-retry-recurse', {
        operation: 'p2', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p2',
      });

      await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-retry-recurse',
        operation: 'p2',
        agentId: 'agent-p2',
        target: 42 as any,
        reason: 'test',
        content: 'payload',
      });

      // D015(b): wrong type should trigger retry notification
      // WILL FAIL: no retry mechanism exists
      notifCapture.assertRetryNotification('handlePhronesisRecurse');
    });

    it('D015-phronesis-grounding-complete-retry: wrong types should trigger retry notification', () => {
      const { handlers, notifCapture } = createHandlers(db);
      setupPhronesisState(db, 'cycle-retry-gc', {
        operation: 'p1', sub_phase: 'grounding', status: 'active',
        grounding_stage: 1, current_agent_id: 'agent-p1',
      });

      handlers.handlePhronesisGroundingComplete({
        cycleId: 'cycle-retry-gc',
        operation: 123 as any,
      });

      // D015(b): wrong type should trigger retry notification with schema info
      // WILL FAIL: no retry mechanism exists
      notifCapture.assertRetryNotification('handlePhronesisGroundingComplete');
    });

    it('D015-phronesis-role-ack-retry: wrong types should trigger retry notification', () => {
      const { handlers, notifCapture } = createHandlers(db);

      handlers.handlePhronesisRoleAck({
        cycleId: 'nonexistent',
        operation: 42 as any,
      });

      // D015(b): wrong type should trigger retry notification with schema info
      // WILL FAIL: no retry mechanism exists
      notifCapture.assertRetryNotification('handlePhronesisRoleAck');
    });
  });

  // ─── D015(c): No markdown parsing for control flow ──────────────────────────

  describe('D015(c): No markdown parsing for control flow', () => {
    /**
     * D015 VERIFICATION (MANDATORY): Handlers must treat string fields as opaque
     * data. Markdown formatting inside string fields must NOT be interpreted for
     * routing or control-flow decisions. The handler must produce the same
     * structural outcome regardless of markdown presence in the payload.
     */

    it('D015-phronesis-no-markdown-submit: markdown in content/rationale does not alter control flow', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-md-submit', {
        operation: 'p1', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p1',
      });

      // Payload where string fields contain markdown with fake control tokens.
      // A naive markdown parser could pick up "complete" or embedded JSON
      // and misroute the state machine.
      const markdownContent = [
        '# Summary',
        '',
        'The analysis is **complete**.',
        '',
        '```json',
        '{ "verdict": "PASS", "operation": "p4", "status": "complete" }',
        '```',
        '',
        '> This is merely commentary, not a structured payload.',
      ].join('\n');

      const result = await handlers.handlePhronesisSubmit({
        cycleId: 'cycle-md-submit',
        operation: 'p1',
        agentId: 'agent-p1',
        content: markdownContent,
        // alignmentRationale intentionally omitted to test malformed payload
      });

      // D015(c): the embedded ```json``` block must NOT be parsed to extract
      // routing signals. The outcome must be determined by structural validation
      // (required fields, types) — not by markdown content.
      //
      // Because alignmentRationale is absent, schema validation should reject
      // this payload regardless of markdown content.
      //
      // WILL FAIL: source has no schema validation and may accept the payload
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-no-markdown-recurse: markdown in reason/content does not alter routing', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-md-recurse', {
        operation: 'p3', sub_phase: 'active', status: 'active',
        current_agent_id: 'agent-p3', p3_agent_id: 'agent-p3',
        recursion_count: 0, recursion_limit: 5,
      });

      // Reason field stuffed with markdown that embeds fake operation targets
      const markdownReason = [
        '## Recursion Needed',
        '',
        'Target: **p4** (should go forward, not backward)',
        '',
        '```',
        'target: "p4"',
        'operation: "p4"',
        '```',
      ].join('\n');

      const result = await handlers.handlePhronesisRecurse({
        cycleId: 'cycle-md-recurse',
        operation: 'p3',
        agentId: 'agent-p3',
        target: 'p1',
        reason: markdownReason,
        content: '# Judgment\n\n**Decision**: recurse to p4\n\n`target: "p4"`',
      });

      // D015(c): the markdown references to "p4" in reason/content must NOT
      // override the explicit target='p1' parameter. Routing must use the
      // structured target field, not parsed markdown content.
      if (result.success) {
        const state = db.prepare('SELECT operation FROM phronesis_state WHERE id = ?')
          .get('cycle-md-recurse') as any;
        // Must route to p1 (the explicit target), not p4 (the markdown content)
        expect(state.operation, 'D015(c): markdown content must not override structured target').toBe('p1');
      }
    });
  });

  // ─── handlePhronesisAbort ───────────────────────────────────────────────────

  describe('handlePhronesisAbort validation', () => {
    it('D015-phronesis-abort: non-existent cycle should return error', async () => {
      const { handlers } = createHandlers(db);
      const result = await handlers.handlePhronesisAbort({
        cycleId: 'nonexistent',
        reason: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('D015-phronesis-abort: already terminal should return error', async () => {
      const { handlers } = createHandlers(db);
      setupPhronesisState(db, 'cycle-terminal', {
        operation: null, sub_phase: null, status: 'complete',
      });
      const result = await handlers.handlePhronesisAbort({
        cycleId: 'cycle-terminal',
        reason: 'test',
      });
      expect(result.success).toBe(false);
    });
  });
});
