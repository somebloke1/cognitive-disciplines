/**
 * Tool Profile Resolver — maps agent roles to tool name arrays.
 *
 * Reads `.pi/tool-profiles.json` and resolves profiles via pattern matching
 * and inheritance. Completely fail-open: every error path returns null
 * (meaning all tools active, no pruning).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// =============================================================================
// Public Types
// =============================================================================

export interface ToolProfileResolver {
  resolveForRole(role: string): string[] | null;
  getStaticToolNames(): string[];
  invalidateCache(): void;
}

// =============================================================================
// Internal Types
// =============================================================================

interface ProfileConfig {
  profiles: Record<string, ProfileDef>;
  roleMap: Record<string, string>;
  staticTools?: string[];
}

interface ProfileDef {
  tools?: string[];
  extends?: string;
  add?: string[];
  remove?: string[];
  include?: 'all';
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Load and validate the tool-profiles.json config from disk.
 * Returns null on any error (missing file, parse error, validation failure).
 */
function loadConfig(cwd: string): ProfileConfig | null {
  try {
    const filePath = path.join(cwd, '.pi', 'tool-profiles.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Validate required structure
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.profiles !== 'object' ||
      parsed.profiles === null ||
      typeof parsed.roleMap !== 'object' ||
      parsed.roleMap === null
    ) {
      console.warn('[tool-profiles] Invalid config structure: missing profiles or roleMap');
      return null;
    }

    return parsed as ProfileConfig;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') {
      console.debug('[tool-profiles] No tool-profiles.json found — all tools active');
    } else {
      console.warn('[tool-profiles] Error loading config:', err);
    }
    return null;
  }
}

/**
 * Match a role string against the roleMap patterns in definition order.
 * Supports trailing * wildcard (e.g., `p1:*` matches `p1:research`).
 * Returns the matched profile name, or null if no match.
 */
function matchRole(role: string, roleMap: Record<string, string>): string | null {
  for (const [pattern, profileName] of Object.entries(roleMap)) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (role.startsWith(prefix)) {
        return profileName;
      }
    } else {
      if (role === pattern) {
        return profileName;
      }
    }
  }
  return null;
}

/**
 * Resolve a profile by name, handling extends/inheritance.
 * Returns the resolved tool list, or null for fail-open (include: 'all',
 * errors, circular refs, depth exceeded).
 */
function resolveProfile(
  profileName: string,
  profiles: Record<string, ProfileDef>,
  depth: number,
  visited: Set<string>,
): string[] | null {
  if (depth > 5) {
    console.warn(`[tool-profiles] Extends depth exceeded for profile "${profileName}"`);
    return null;
  }

  const def = profiles[profileName];
  if (!def) {
    console.warn(`[tool-profiles] Profile "${profileName}" not found`);
    return null;
  }

  if (visited.has(profileName)) {
    console.warn(`[tool-profiles] Circular extends detected at "${profileName}"`);
    return null;
  }
  visited.add(profileName);

  // include: 'all' means no pruning
  if (def.include === 'all') {
    return null;
  }

  if (def.extends) {
    // Inheritance path
    const parentTools = resolveProfile(def.extends, profiles, depth + 1, visited);
    if (parentTools === null) {
      // Parent failed open — cascade fail-open
      return null;
    }

    // Start with parent's tools
    let tools = [...parentTools];

    // Apply add
    if (def.add && Array.isArray(def.add)) {
      for (const t of def.add) {
        if (!tools.includes(t)) {
          tools.push(t);
        }
      }
    }

    // Apply remove
    if (def.remove && Array.isArray(def.remove)) {
      tools = tools.filter(t => !def.remove!.includes(t));
    }

    return tools;
  }

  if (def.tools && Array.isArray(def.tools)) {
    return [...def.tools];
  }

  // Neither tools nor extends — cannot resolve
  return null;
}

// =============================================================================
// Factory
// =============================================================================

export function createToolProfileResolver(cwd: string): ToolProfileResolver {
  // undefined = not yet loaded; null = load failed; ProfileConfig = loaded
  let cachedConfig: ProfileConfig | null | undefined = undefined;

  function ensureLoaded(): ProfileConfig | null {
    if (cachedConfig === undefined) {
      cachedConfig = loadConfig(cwd);
    }
    return cachedConfig ?? null;
  }

  return {
    resolveForRole(role: string): string[] | null {
      try {
        const config = ensureLoaded();
        if (!config) return null;

        const profileName = matchRole(role, config.roleMap);
        if (!profileName) return null;

        return resolveProfile(profileName, config.profiles, 0, new Set());
      } catch {
        return null;
      }
    },

    getStaticToolNames(): string[] {
      try {
        const config = ensureLoaded();
        if (!config) return [];
        return config.staticTools ?? [];
      } catch {
        return [];
      }
    },

    invalidateCache(): void {
      cachedConfig = undefined;
    },
  };
}
