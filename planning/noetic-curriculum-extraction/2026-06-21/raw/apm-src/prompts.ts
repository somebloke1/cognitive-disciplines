/**
 * Prompt fragment loading and assembly.
 *
 * Templates compose markdown fragments from .method/prompts/ into complete
 * initial prompts for spawned agents.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { APMContext, Logger } from '@noetic-pi/shared';

export interface PromptHandlers {
  loadPromptFragment(name: string): string | null;
  substituteVars(text: string, params: Record<string, string | number>): string;
  assemblePrompt(
    template: string,
    params?: Record<string, string | number>
  ): string | null;
  assemblePhronesisPrompt(
    cycleId: string,
    operation: string,
    pass: number
  ): string;
  validatePromptFragments(): void;
}

/**
 * Create prompt handler functions for a given APM context.
 *
 * @param ctx - Context with cwd and log
 * @returns Object containing all prompt handler functions
 */
export function createPromptHandlers(
  ctx: Pick<APMContext, 'cwd' | 'log'>
): PromptHandlers {
  const { cwd, log } = ctx;

  /**
   * Load a prompt fragment from .method/prompts/{name}.md
   * Returns the file content or null if not found.
   */
  function loadPromptFragment(name: string): string | null {
    const fragmentPath = path.join(cwd, '.method', 'prompts', `${name}.md`);
    try {
      return fs.readFileSync(fragmentPath, 'utf-8');
    } catch (err) {
      log.error(`Failed to load prompt fragment '${name}'`, {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Simple variable substitution in prompt text.
   * Replaces ${VAR_NAME} with values from params object.
   */
  function substituteVars(
    text: string,
    params: Record<string, string | number>
  ): string {
    return text.replace(/\$\{([A-Z_]+)\}/g, (match, varName) => {
      return params[varName] !== undefined ? String(params[varName]) : match;
    });
  }

  /**
   * Assemble a prompt from template name and parameters.
   *
   * Supported templates:
   *   - "succession": curriculum + succession-task (params: SUCCESSION_ID, BRIEFING)
   *   - "sub-agent":  curriculum + mesh-operations + sub-agent-task (params: TASK, RESPOND_TO)
   *
   * Returns the assembled prompt string, or null if fragments are missing.
   */
  function assemblePrompt(
    template: string,
    params: Record<string, string | number> = {}
  ): string | null {
    const fragments: Record<string, string[]> = {
      // NOTE: The 'succession' template is NOT used by the succession spawn path.
      // Succession delivery now uses the bootstrap protocol: the APM pre-creates
      // an initiative with the full briefing in its mission field, which is
      // delivered to the successor agent via TCP at startup (not via shell args).
      // This template is retained for reference but is not called during succession.
      'succession': ['curriculum', 'succession-task'],
      'sub-agent': ['curriculum', 'mesh-operations', 'sub-agent-task'],
    };

    const fragmentNames = fragments[template];
    if (!fragmentNames) {
      log.error(`Unknown prompt template: ${template}`);
      return null;
    }

    const parts: string[] = [];
    for (const name of fragmentNames) {
      const content = loadPromptFragment(name);
      if (!content) {
        log.error(
          `Missing prompt fragment '${name}' for template '${template}'`
        );
        return null;
      }
      parts.push(substituteVars(content, params));
    }

    return parts.join('\n\n---\n\n');
  }

  /**
   * Validate that all required prompt fragments exist at startup.
   * Logs warnings for missing fragments.
   */
  function validatePromptFragments(): void {
    // Phronesis fragments (phronesis-overview, phronesis-p1..p4, phronesis-fresh,
    // phronesis-grounding-preamble, phronesis-task, phronesis-accumulated) are
    // no longer embedded in spawn commands. They are delivered via the
    // phronesis_role_ack protocol response. They remain on disk for reference
    // but are not required to exist for the APM to function.
    const requiredFragments = [
      'curriculum',
      'succession-task',
      'twelve-properties',
      'ep-audit-task',
      'mesh-operations',
      'sub-agent-task',
    ];
    const promptDir = path.join(cwd, '.method', 'prompts');
    let missing = 0;

    for (const name of requiredFragments) {
      const fragmentPath = path.join(promptDir, `${name}.md`);
      if (!fs.existsSync(fragmentPath)) {
        log.warn(
          `Missing prompt fragment: .method/prompts/${name}.md`
        );
        missing++;
      }
    }

    if (missing === 0) {
      log.info(`Prompt fragments validated: ${requiredFragments.length} fragments OK`);
    } else {
      log.warn(
        `${missing} prompt fragment(s) missing — template-based spawning may fail`
      );
    }
  }

  /**
   * Assemble a phronesis bootstrap prompt for a P-agent.
   *
   * The spawn command carries only a minimal bootstrap — enough for the agent
   * to identify itself and call phronesis_role_ack. Architecturally, the full
   * curriculum is delivered lazily via the role_ack protocol response, not at
   * spawn time.
   *
   * Symmetric with EP audit's staged curriculum delivery:
   *   ep_audit_register → APM responds with Stage 1
   *   phronesis_role_ack → APM responds with Stage 1 (+ full curriculum context)
   *
   * @param cycleId - Phronesis cycle identifier
   * @param operation - p1 | p2 | p3 | p4
   * @param pass - Pass number
   * @returns Minimal bootstrap prompt
   */
  function assemblePhronesisPrompt(
    cycleId: string,
    operation: string,
    pass: number
  ): string {
    return `You are a phronesis agent.\nCycle: ${cycleId} | Operation: ${operation.toUpperCase()} | Pass: ${pass}\nCall \`phronesis_role_ack\` now to begin your curriculum.`;
  }

  return {
    loadPromptFragment,
    substituteVars,
    assemblePrompt,
    assemblePhronesisPrompt,
    validatePromptFragments,
  };
}
