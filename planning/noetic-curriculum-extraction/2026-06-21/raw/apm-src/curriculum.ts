/**
 * Generic curriculum harness for heuristic disciplines.
 *
 * Loads JSON curriculum definitions from `.method/curricula/` and walks agents
 * through pre-tasking → tasking → post-tasking → complete sequences.
 *
 * Pure functions (no global state). Only `loadCurriculum` performs file I/O.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// =============================================================================
// Types
// =============================================================================

/** A single curriculum step as defined in the JSON file. */
export interface CurriculumStep {
  title: string;
  instruction: string | Record<string, string>;
  deliverable: string | Record<string, string>;
}

/** The full curriculum definition loaded from JSON. */
export interface CurriculumDefinition {
  pre_tasking: CurriculumStep[] | null;
  post_tasking: CurriculumStep[] | null;
}

/** Context needed by the harness to resolve templates and deliver steps. */
export interface CurriculumContext {
  disciplineType: string;
  operation?: string;
  task: string;
  orientingQuestion: string | null;
  implicitUnknown: string | null;
  cwd: string;
}

/** Result of advancing to the next step. */
export interface CurriculumAdvanceResult {
  phase: 'pre_tasking' | 'tasking' | 'post_tasking' | 'complete';
  stage: number;
  totalStages: number;
  instructions: string;
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Load a curriculum definition from `.method/curricula/{disciplineType}.json`.
 * Converts underscores to hyphens for the filename.
 * Returns null if the file does not exist.
 */
export function loadCurriculum(
  cwd: string,
  disciplineType: string,
): CurriculumDefinition | null {
  const filename = disciplineType.replace(/_/g, '-') + '.json';
  const filePath = path.join(cwd, '.method', 'curricula', filename);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as CurriculumDefinition;
  } catch {
    return null;
  }
}

/**
 * Determine the total number of internal stages (pre_tasking + 1 tasking + post_tasking).
 * Used for state machine progression.
 */
export function totalStages(def: CurriculumDefinition): number {
  const pre = def.pre_tasking?.length ?? 0;
  const post = def.post_tasking?.length ?? 0;
  return pre + 1 + post; // +1 for tasking boundary
}

/**
 * Determine the number of visible stages (pre_tasking + post_tasking).
 * Used for display to the agent. The tasking boundary (epistemic horizon) is
 * delivered alongside the first visible stage, not counted separately.
 */
export function visibleStages(def: CurriculumDefinition): number {
  const pre = def.pre_tasking?.length ?? 0;
  const post = def.post_tasking?.length ?? 0;
  return pre + post;
}

/**
 * Resolve the instruction/deliverable for a step, given the current operation.
 * - If the value is a string, return it directly.
 * - If it's a map, return the value for the current operation key.
 * - If the map doesn't contain the operation key, return null.
 */
export function resolveField(
  field: string | Record<string, string>,
  operation?: string,
): string | null {
  if (typeof field === 'string') {
    return field;
  }
  if (operation && operation in field) {
    return field[operation];
  }
  return null;
}

/**
 * Apply template variable substitution to a string.
 * Replaces ${task}, ${operation}, ${orienting_question}, ${implicit_unknown}.
 */
export function substituteTemplateVars(
  text: string,
  ctx: CurriculumContext,
): string {
  return text
    .replace(/\$\{task\}/g, ctx.task)
    .replace(/\$\{operation\}/g, ctx.operation ?? '')
    .replace(/\$\{orienting_question\}/g, ctx.orientingQuestion ?? '')
    .replace(/\$\{implicit_unknown\}/g, ctx.implicitUnknown ?? '');
}

/**
 * Assemble the epistemic horizon block for the tasking boundary.
 * Returns empty string if both parameters are null (backward compat).
 */
export function assembleEpistemicHorizon(
  orientingQuestion: string | null,
  implicitUnknown: string | null,
): string {
  if (!orientingQuestion && !implicitUnknown) return '';

  const parts = ['=== EPISTEMIC HORIZON ==='];
  if (orientingQuestion) parts.push(`ORIENTING QUESTION: ${orientingQuestion}`);
  if (implicitUnknown) parts.push(`IMPLICIT UNKNOWN: ${implicitUnknown}`);
  parts.push('');
  parts.push(
    'Your inquiry is grounded by the Orienting Question. Every finding, possibility, ' +
    'judgment, or decision you produce must be evaluated against whether it resolves ' +
    'the Implicit Unknown. When you submit your work, you must articulate this ' +
    'alignment explicitly via the heuristic_alignment_rationale parameter.',
  );
  parts.push('=========================');
  return parts.join('\n');
}

/**
 * Given the current stage counter, advance to the next step.
 *
 * Stage counter semantics:
 *   Stage 0..N-1:  pre_tasking steps (if defined)
 *   Stage N:       tasking boundary (epistemic horizon + operational instructions)
 *   Stage N+1..M-1: post_tasking steps (if defined)
 *   Stage M:       complete
 *
 * If pre_tasking is null, stage 0 = tasking boundary.
 * If post_tasking is null, after tasking → complete.
 */
export function advance(
  def: CurriculumDefinition,
  currentStage: number,
  ctx: CurriculumContext,
): CurriculumAdvanceResult {
  const preCount = def.pre_tasking?.length ?? 0;
  const postCount = def.post_tasking?.length ?? 0;
  const total = totalStages(def);
  const visible = visibleStages(def);
  const taskingIndex = preCount; // tasking boundary is right after pre_tasking

  // Pre-tasking phase
  if (currentStage < taskingIndex) {
    const step = def.pre_tasking![currentStage];
    const instruction = resolveField(step.instruction, ctx.operation);
    const deliverable = resolveField(step.deliverable, ctx.operation);

    // Display stage: 1-indexed position in pre_tasking
    const displayStage = currentStage + 1;

    const parts: string[] = [];
    parts.push(`## Stage ${displayStage} of ${visible}: ${step.title}`);
    if (instruction) parts.push(substituteTemplateVars(instruction, ctx));
    if (deliverable) {
      parts.push('');
      parts.push('**Deliverable:**');
      parts.push(substituteTemplateVars(deliverable, ctx));
    }

    return {
      phase: 'pre_tasking',
      stage: currentStage,
      totalStages: total,
      instructions: parts.join('\n'),
    };
  }

  // Tasking boundary
  if (currentStage === taskingIndex) {
    const horizon = assembleEpistemicHorizon(
      ctx.orientingQuestion,
      ctx.implicitUnknown,
    );

    return {
      phase: 'tasking',
      stage: currentStage,
      totalStages: total,
      instructions: horizon,
    };
  }

  // Post-tasking phase
  const postIndex = currentStage - taskingIndex - 1;
  if (postIndex < postCount) {
    const step = def.post_tasking![postIndex];
    const instruction = resolveField(step.instruction, ctx.operation);
    const deliverable = resolveField(step.deliverable, ctx.operation);

    // Display stage: after all pre_tasking stages (preCount) + 1-indexed position in post_tasking
    const displayStage = preCount + postIndex + 1;

    const parts: string[] = [];
    parts.push(`## Stage ${displayStage} of ${visible}: ${step.title}`);
    if (instruction) parts.push(substituteTemplateVars(instruction, ctx));
    if (deliverable) {
      parts.push('');
      parts.push('**Deliverable:**');
      parts.push(substituteTemplateVars(deliverable, ctx));
    }

    return {
      phase: 'post_tasking',
      stage: currentStage,
      totalStages: total,
      instructions: parts.join('\n'),
    };
  }

  // Complete
  return {
    phase: 'complete',
    stage: currentStage,
    totalStages: total,
    instructions: '',
  };
}
