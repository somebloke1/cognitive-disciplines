/**
 * Unit tests for curriculum.ts — generic curriculum harness.
 *
 * Tests cover:
 * - loadCurriculum: valid load, missing file, underscore-to-hyphen conversion
 * - totalStages: various pre/post combinations
 * - resolveField: string, map-with-key, map-without-key
 * - substituteTemplateVars: all four template variables
 * - assembleEpistemicHorizon: both null, one null, both present
 * - advance: full stage counter semantics across all phases
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
  loadCurriculum,
  totalStages,
  resolveField,
  substituteTemplateVars,
  assembleEpistemicHorizon,
  advance,
} from '../../src/curriculum.js';
import type {
  CurriculumDefinition,
  CurriculumContext,
  CurriculumStep,
  CurriculumAdvanceResult,
} from '../../src/curriculum.js';

// =============================================================================
// Helpers
// =============================================================================

/** Project root — navigate up from test/unit/ to repo root */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function makeCtx(overrides: Partial<CurriculumContext> = {}): CurriculumContext {
  return {
    disciplineType: 'differentiated_cognition',
    task: 'Evaluate the architecture',
    orientingQuestion: 'What is the right structure?',
    implicitUnknown: 'The structural form that resolves complexity',
    cwd: PROJECT_ROOT,
    ...overrides,
  };
}

function makeDef(overrides: Partial<CurriculumDefinition> = {}): CurriculumDefinition {
  return {
    pre_tasking: null,
    post_tasking: null,
    ...overrides,
  };
}

function makeStep(overrides: Partial<CurriculumStep> = {}): CurriculumStep {
  return {
    title: 'Test Step',
    instruction: 'Do the thing',
    deliverable: 'The result',
    ...overrides,
  };
}

// =============================================================================
// loadCurriculum
// =============================================================================

describe('loadCurriculum', () => {
  it('loads differentiated-cognition.json via underscore-to-hyphen conversion', () => {
    const def = loadCurriculum(PROJECT_ROOT, 'differentiated_cognition');
    expect(def).not.toBeNull();
    expect(def!.pre_tasking).toBeNull();
    expect(def!.post_tasking).toBeInstanceOf(Array);
    expect(def!.post_tasking!.length).toBe(3);
  });

  it('loads emergent-probabilistics.json via underscore-to-hyphen conversion', () => {
    const def = loadCurriculum(PROJECT_ROOT, 'emergent_probabilistics');
    expect(def).not.toBeNull();
    expect(def!.pre_tasking).toBeInstanceOf(Array);
    expect(def!.pre_tasking!.length).toBe(7);
    expect(def!.post_tasking).toBeNull();
  });

  it('returns null for non-existent curriculum file', () => {
    const def = loadCurriculum(PROJECT_ROOT, 'nonexistent_discipline');
    expect(def).toBeNull();
  });

  it('returns null for empty cwd with no curricula directory', () => {
    const def = loadCurriculum('/tmp/definitely-not-a-project', 'anything');
    expect(def).toBeNull();
  });

  it('correctly converts multiple underscores to hyphens', () => {
    // This won't find a file, but tests the conversion logic
    const def = loadCurriculum(PROJECT_ROOT, 'foo_bar_baz');
    expect(def).toBeNull();
    // The function should have looked for foo-bar-baz.json
  });
});

// =============================================================================
// totalStages
// =============================================================================

describe('totalStages', () => {
  it('returns 1 when both pre_tasking and post_tasking are null (tasking only)', () => {
    expect(totalStages(makeDef())).toBe(1);
  });

  it('counts pre_tasking + 1 tasking + post_tasking', () => {
    const def = makeDef({
      pre_tasking: [makeStep(), makeStep()],
      post_tasking: [makeStep(), makeStep(), makeStep()],
    });
    expect(totalStages(def)).toBe(6); // 2 + 1 + 3
  });

  it('counts correctly with only pre_tasking', () => {
    const def = makeDef({
      pre_tasking: [makeStep(), makeStep(), makeStep()],
    });
    expect(totalStages(def)).toBe(4); // 3 + 1 + 0
  });

  it('counts correctly with only post_tasking', () => {
    const def = makeDef({
      post_tasking: [makeStep(), makeStep()],
    });
    expect(totalStages(def)).toBe(3); // 0 + 1 + 2
  });

  it('returns correct count for real differentiated-cognition fixture', () => {
    const def = loadCurriculum(PROJECT_ROOT, 'differentiated_cognition')!;
    expect(totalStages(def)).toBe(4); // 0 pre + 1 tasking + 3 post
  });

  it('returns correct count for real emergent-probabilistics fixture', () => {
    const def = loadCurriculum(PROJECT_ROOT, 'emergent_probabilistics')!;
    expect(totalStages(def)).toBe(8); // 7 pre + 1 tasking + 0 post
  });
});

// =============================================================================
// resolveField
// =============================================================================

describe('resolveField', () => {
  it('returns the string directly when field is a string', () => {
    expect(resolveField('hello world')).toBe('hello world');
  });

  it('returns the string even when operation is provided', () => {
    expect(resolveField('hello world', 'p1')).toBe('hello world');
  });

  it('returns the keyed value when field is a map and key exists', () => {
    const field = { p1: 'attend', p2: 'understand', p3: 'judge', p4: 'decide' };
    expect(resolveField(field, 'p1')).toBe('attend');
    expect(resolveField(field, 'p3')).toBe('judge');
  });

  it('returns null when field is a map and key does not exist', () => {
    const field = { p1: 'attend', p2: 'understand' };
    expect(resolveField(field, 'p4')).toBeNull();
  });

  it('returns null when field is a map and no operation is provided', () => {
    const field = { p1: 'attend', p2: 'understand' };
    expect(resolveField(field)).toBeNull();
  });

  it('returns null when field is a map with undefined operation', () => {
    const field = { p1: 'attend' };
    expect(resolveField(field, undefined)).toBeNull();
  });
});

// =============================================================================
// substituteTemplateVars
// =============================================================================

describe('substituteTemplateVars', () => {
  it('replaces ${task}', () => {
    const result = substituteTemplateVars('The task is: ${task}', makeCtx());
    expect(result).toBe('The task is: Evaluate the architecture');
  });

  it('replaces ${operation}', () => {
    const result = substituteTemplateVars('Op: ${operation}', makeCtx({ operation: 'p2' }));
    expect(result).toBe('Op: p2');
  });

  it('replaces ${orienting_question}', () => {
    const result = substituteTemplateVars('Q: ${orienting_question}', makeCtx());
    expect(result).toBe('Q: What is the right structure?');
  });

  it('replaces ${implicit_unknown}', () => {
    const result = substituteTemplateVars('U: ${implicit_unknown}', makeCtx());
    expect(result).toBe('U: The structural form that resolves complexity');
  });

  it('replaces multiple variables in one string', () => {
    const text = '${task} via ${operation}: ${orienting_question} → ${implicit_unknown}';
    const result = substituteTemplateVars(text, makeCtx({ operation: 'p1' }));
    expect(result).toBe(
      'Evaluate the architecture via p1: What is the right structure? → The structural form that resolves complexity',
    );
  });

  it('replaces with empty string when operation is undefined', () => {
    const result = substituteTemplateVars('Op: [${operation}]', makeCtx());
    expect(result).toBe('Op: []');
  });

  it('replaces with empty string when orientingQuestion is null', () => {
    const result = substituteTemplateVars(
      'Q: [${orienting_question}]',
      makeCtx({ orientingQuestion: null }),
    );
    expect(result).toBe('Q: []');
  });

  it('replaces with empty string when implicitUnknown is null', () => {
    const result = substituteTemplateVars(
      'U: [${implicit_unknown}]',
      makeCtx({ implicitUnknown: null }),
    );
    expect(result).toBe('U: []');
  });

  it('handles multiple occurrences of the same variable', () => {
    const result = substituteTemplateVars('${task} and ${task}', makeCtx());
    expect(result).toBe('Evaluate the architecture and Evaluate the architecture');
  });
});

// =============================================================================
// assembleEpistemicHorizon
// =============================================================================

describe('assembleEpistemicHorizon', () => {
  it('returns empty string when both params are null', () => {
    expect(assembleEpistemicHorizon(null, null)).toBe('');
  });

  it('includes orienting question when provided', () => {
    const result = assembleEpistemicHorizon('What is X?', null);
    expect(result).toContain('=== EPISTEMIC HORIZON ===');
    expect(result).toContain('ORIENTING QUESTION: What is X?');
    expect(result).not.toContain('IMPLICIT UNKNOWN:');
    expect(result).toContain('=========================');
  });

  it('includes implicit unknown when provided', () => {
    const result = assembleEpistemicHorizon(null, 'The shape of Y');
    expect(result).toContain('=== EPISTEMIC HORIZON ===');
    expect(result).not.toContain('ORIENTING QUESTION:');
    expect(result).toContain('IMPLICIT UNKNOWN: The shape of Y');
    expect(result).toContain('=========================');
  });

  it('includes both when both are provided', () => {
    const result = assembleEpistemicHorizon('What is X?', 'The shape of Y');
    expect(result).toContain('ORIENTING QUESTION: What is X?');
    expect(result).toContain('IMPLICIT UNKNOWN: The shape of Y');
    expect(result).toContain('heuristic_alignment_rationale');
  });

  it('contains the alignment instruction text', () => {
    const result = assembleEpistemicHorizon('Q', 'U');
    expect(result).toContain(
      'Your inquiry is grounded by the Orienting Question.',
    );
    expect(result).toContain('heuristic_alignment_rationale parameter.');
  });
});

// =============================================================================
// advance — Stage Counter Semantics
// =============================================================================

describe('advance', () => {
  describe('with null pre_tasking and null post_tasking (tasking only)', () => {
    const def = makeDef();

    it('stage 0 is the tasking boundary', () => {
      const result = advance(def, 0, makeCtx());
      expect(result.phase).toBe('tasking');
      expect(result.stage).toBe(0);
      expect(result.totalStages).toBe(1);
    });

    it('stage 1 is complete', () => {
      const result = advance(def, 1, makeCtx());
      expect(result.phase).toBe('complete');
      expect(result.stage).toBe(1);
      expect(result.totalStages).toBe(1);
      expect(result.instructions).toBe('');
    });
  });

  describe('with pre_tasking only (no post_tasking)', () => {
    const def = makeDef({
      pre_tasking: [
        makeStep({ title: 'First', instruction: 'Read A', deliverable: 'Reflect on A' }),
        makeStep({ title: 'Second', instruction: 'Read B', deliverable: 'Reflect on B' }),
      ],
    });

    it('stage 0 is first pre_tasking step', () => {
      const result = advance(def, 0, makeCtx());
      expect(result.phase).toBe('pre_tasking');
      expect(result.stage).toBe(0);
      expect(result.totalStages).toBe(3);
      // Display shows "Stage 1 of 2" (visible stages only, no +1 for tasking)
      expect(result.instructions).toContain('Stage 1 of 2: First');
      expect(result.instructions).toContain('Read A');
      expect(result.instructions).toContain('Reflect on A');
    });

    it('stage 1 is second pre_tasking step', () => {
      const result = advance(def, 1, makeCtx());
      expect(result.phase).toBe('pre_tasking');
      expect(result.stage).toBe(1);
      // Display shows "Stage 2 of 2" (visible stages only)
      expect(result.instructions).toContain('Stage 2 of 2: Second');
    });

    it('stage 2 is tasking boundary', () => {
      const result = advance(def, 2, makeCtx());
      expect(result.phase).toBe('tasking');
      expect(result.stage).toBe(2);
    });

    it('stage 3 is complete (no post_tasking)', () => {
      const result = advance(def, 3, makeCtx());
      expect(result.phase).toBe('complete');
    });
  });

  describe('with post_tasking only (no pre_tasking)', () => {
    const def = makeDef({
      post_tasking: [
        makeStep({ title: 'Post1', instruction: 'Do X', deliverable: 'Result X' }),
        makeStep({ title: 'Post2', instruction: 'Do Y', deliverable: 'Result Y' }),
      ],
    });

    it('stage 0 is tasking boundary (pre_tasking is null)', () => {
      const result = advance(def, 0, makeCtx());
      expect(result.phase).toBe('tasking');
      expect(result.stage).toBe(0);
      expect(result.totalStages).toBe(3);
    });

    it('stage 1 is first post_tasking step', () => {
      const result = advance(def, 1, makeCtx());
      expect(result.phase).toBe('post_tasking');
      expect(result.stage).toBe(1);
      // Display shows "Stage 1 of 2" (visible stages only, no pre_tasking so preCount=0)
      expect(result.instructions).toContain('Stage 1 of 2: Post1');
    });

    it('stage 2 is second post_tasking step', () => {
      const result = advance(def, 2, makeCtx());
      expect(result.phase).toBe('post_tasking');
      expect(result.stage).toBe(2);
      // Display shows "Stage 2 of 2"
      expect(result.instructions).toContain('Stage 2 of 2: Post2');
    });

    it('stage 3 is complete', () => {
      const result = advance(def, 3, makeCtx());
      expect(result.phase).toBe('complete');
    });
  });

  describe('with both pre_tasking and post_tasking', () => {
    const def = makeDef({
      pre_tasking: [
        makeStep({ title: 'Pre1' }),
      ],
      post_tasking: [
        makeStep({ title: 'Post1' }),
        makeStep({ title: 'Post2' }),
      ],
    });

    it('stage 0 is pre_tasking', () => {
      const result = advance(def, 0, makeCtx());
      expect(result.phase).toBe('pre_tasking');
      expect(result.totalStages).toBe(4); // 1 pre + 1 tasking + 2 post
    });

    it('stage 1 is tasking', () => {
      const result = advance(def, 1, makeCtx());
      expect(result.phase).toBe('tasking');
    });

    it('stage 2 is first post_tasking', () => {
      const result = advance(def, 2, makeCtx());
      expect(result.phase).toBe('post_tasking');
      expect(result.instructions).toContain('Post1');
    });

    it('stage 3 is second post_tasking', () => {
      const result = advance(def, 3, makeCtx());
      expect(result.phase).toBe('post_tasking');
      expect(result.instructions).toContain('Post2');
    });

    it('stage 4 is complete', () => {
      const result = advance(def, 4, makeCtx());
      expect(result.phase).toBe('complete');
    });
  });

  describe('with operation-keyed fields', () => {
    const def = makeDef({
      post_tasking: [
        makeStep({
          title: 'Keyed Step',
          instruction: 'Read the doc',
          deliverable: { p1: 'Attend to it', p3: 'Judge it' },
        }),
      ],
    });

    it('resolves keyed deliverable for matching operation', () => {
      const result = advance(def, 1, makeCtx({ operation: 'p1' }));
      expect(result.phase).toBe('post_tasking');
      expect(result.instructions).toContain('Attend to it');
      expect(result.instructions).not.toContain('Judge it');
    });

    it('resolves keyed deliverable for different operation', () => {
      const result = advance(def, 1, makeCtx({ operation: 'p3' }));
      expect(result.instructions).toContain('Judge it');
    });

    it('omits deliverable when operation not in map', () => {
      const result = advance(def, 1, makeCtx({ operation: 'p2' }));
      expect(result.instructions).toContain('Read the doc');
      expect(result.instructions).not.toContain('Deliverable');
    });
  });

  describe('template variable substitution in steps', () => {
    const def = makeDef({
      pre_tasking: [
        makeStep({
          title: 'Template Step',
          instruction: 'Task: ${task}, Op: ${operation}',
          deliverable: 'Q: ${orienting_question}, U: ${implicit_unknown}',
        }),
      ],
    });

    it('substitutes all template variables in instructions', () => {
      const ctx = makeCtx({ operation: 'p2' });
      const result = advance(def, 0, ctx);
      expect(result.instructions).toContain('Task: Evaluate the architecture, Op: p2');
      expect(result.instructions).toContain('Q: What is the right structure?');
      expect(result.instructions).toContain('U: The structural form that resolves complexity');
    });
  });

  describe('epistemic horizon at tasking boundary', () => {
    const def = makeDef();

    it('includes epistemic horizon when both params provided', () => {
      const result = advance(def, 0, makeCtx());
      expect(result.phase).toBe('tasking');
      expect(result.instructions).toContain('=== EPISTEMIC HORIZON ===');
      expect(result.instructions).toContain('ORIENTING QUESTION:');
      expect(result.instructions).toContain('IMPLICIT UNKNOWN:');
    });

    it('returns empty instructions at tasking when both params are null', () => {
      const result = advance(def, 0, makeCtx({
        orientingQuestion: null,
        implicitUnknown: null,
      }));
      expect(result.phase).toBe('tasking');
      expect(result.instructions).toBe('');
    });
  });

  describe('real fixture: differentiated-cognition', () => {
    it('walks through tasking → post_tasking(3) → complete', () => {
      const def = loadCurriculum(PROJECT_ROOT, 'differentiated_cognition')!;
      const ctx = makeCtx({ operation: 'p1' });

      // Stage 0: tasking (no pre_tasking)
      const s0 = advance(def, 0, ctx);
      expect(s0.phase).toBe('tasking');
      expect(s0.totalStages).toBe(4);

      // Stage 1: first post_tasking (Emergent Probability)
      const s1 = advance(def, 1, ctx);
      expect(s1.phase).toBe('post_tasking');
      expect(s1.instructions).toContain('Emergent Probability');

      // Stage 2: second post_tasking (Emergent Fidelity)
      const s2 = advance(def, 2, ctx);
      expect(s2.phase).toBe('post_tasking');
      expect(s2.instructions).toContain('Emergent Fidelity');

      // Stage 3: third post_tasking (Notion of Development)
      const s3 = advance(def, 3, ctx);
      expect(s3.phase).toBe('post_tasking');
      expect(s3.instructions).toContain('Notion of Development');

      // Stage 4: complete
      const s4 = advance(def, 4, ctx);
      expect(s4.phase).toBe('complete');
    });
  });

  describe('real fixture: emergent-probabilistics', () => {
    it('walks through pre_tasking(7) → tasking → complete', () => {
      const def = loadCurriculum(PROJECT_ROOT, 'emergent_probabilistics')!;
      const ctx = makeCtx({ disciplineType: 'emergent_probabilistics' });

      // Stages 0–6: pre_tasking
      for (let i = 0; i < 7; i++) {
        const result = advance(def, i, ctx);
        expect(result.phase).toBe('pre_tasking');
        expect(result.totalStages).toBe(8);
      }

      // Stage 7: tasking
      const tasking = advance(def, 7, ctx);
      expect(tasking.phase).toBe('tasking');

      // Stage 8: complete (no post_tasking)
      const complete = advance(def, 8, ctx);
      expect(complete.phase).toBe('complete');
    });
  });
});
