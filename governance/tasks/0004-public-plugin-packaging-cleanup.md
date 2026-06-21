# Task 0004: Public Plugin Packaging Cleanup

## Status

Completed.

## GitHub

- Issue: https://github.com/somebloke1/cognitive-disciplines/issues/8

## Scope

Clean the publishable `cognitive-cycle` plugin bundle so it excludes
development-only repository coordination content while preserving that content
as root-level development guidance where appropriate.

## Acceptance

- Plugin bundle contains only reusable cognitive-cycle skills and supporting
  scripts/references.
- Plugin manifest does not advertise GitHub Project coordination or GraphQL
  efficiency as bundled capabilities.
- Regression tests prevent the development-only coordination skills from being
  bundled accidentally.
- Source plugin and installed cache validate.
- `cognitive-cycle@personal` is installed and enabled from this repository's
  local marketplace.

## Completed Work

- Removed development-only GitHub Project and GraphQL coordination skills from
  `plugins/cognitive-cycle/`.
- Kept those development skills available at the repository root under
  `skills/`, where they remain project-development guidance rather than public
  plugin runtime.
- Updated plugin metadata to describe only P1-P4 cognition, same-phase
  integration roles, packet contracts, semantic review templates, and structural
  validation.
- Generalized source-grounding language so public skills preserve the discipline
  without requiring a private source-tree convention.
- Added a regression test that rejects accidental bundling of the development
  coordination skills.
- Reinstalled the plugin from the repo-local `personal` marketplace.
- Corrected the local Desktop Personal marketplace setup after verification
  showed the CLI marketplace named `personal` had been pointing at the repo
  root instead of the documented home personal marketplace.
- Renamed the publishable plugin skill IDs from terse `ep-*` names to
  phase-action names that render clearly in the Desktop skill list:
  `full-cognitive-cycle`, `p1-attend-to-evidence`,
  `p1-curate-evidence`, `p2-inquire-possibilities`,
  `p2-integrate-possibilities`, `p3-judge-sufficiency`,
  `p3-reconcile-judgments`, `p4-decide-responsibly`, and
  `p4-evaluate-decisions`.

## Validation Evidence

Source plugin validation:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle
```

Result: passed.

Skill-name presentation correction:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py \
  /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle
rm -rf /home/dgk/.codex/plugins/cognitive-cycle
cp -a /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle \
  /home/dgk/.codex/plugins/cognitive-cycle
codex plugin add cognitive-cycle@personal --json
```

Corrected installed version:

```text
0.1.0+codex.20260621164433
```

Corrected installed skill IDs:

```text
full-cognitive-cycle
p1-attend-to-evidence
p1-curate-evidence
p2-inquire-possibilities
p2-integrate-possibilities
p3-judge-sufficiency
p3-reconcile-judgments
p4-decide-responsibly
p4-evaluate-decisions
```

Installed cache validation after renaming:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /home/dgk/.codex/plugins/cache/personal/cognitive-cycle/0.1.0+codex.20260621164433
```

Result: passed.

Harness tests:

```bash
python3 -m unittest tests/test_cycle_harness.py
```

Result: 6 tests passed.

Source and installed bundled skill validation:

```bash
for skill in plugins/cognitive-cycle/skills/*; do \
  python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill" || exit 1; \
done

for skill in /home/dgk/.codex/plugins/cache/personal/cognitive-cycle/0.1.0+codex.20260621163125/skills/*; do \
  python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill" || exit 1; \
done
```

Result: all 9 bundled skills passed in source and installed cache.

Installed plugin validation:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /home/dgk/.codex/plugins/cache/personal/cognitive-cycle/0.1.0+codex.20260621163125
```

Result: passed.

Initial repo-root plugin readback before Desktop Personal correction:

```text
cognitive-cycle@personal  installed, enabled  0.1.0+codex.20260621163125  /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle
```

Desktop Personal marketplace correction:

```bash
mkdir -p /home/dgk/.agents/plugins /home/dgk/.codex/plugins
cp -a /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle \
  /home/dgk/.codex/plugins/cognitive-cycle
codex plugin marketplace remove personal --json
codex plugin add cognitive-cycle@personal --json
```

Home personal marketplace:

```text
/home/dgk/.agents/plugins/marketplace.json
```

Corrected marketplace readback:

```json
{
  "name": "personal",
  "root": "/home/dgk"
}
```

Corrected installed plugin readback:

```json
{
  "pluginId": "cognitive-cycle@personal",
  "version": "0.1.0+codex.20260621163125",
  "installed": true,
  "enabled": true,
  "source": {
    "source": "local",
    "path": "/home/dgk/.codex/plugins/cognitive-cycle"
  }
}
```

Installed cache validation after correction:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /home/dgk/.codex/plugins/cache/personal/cognitive-cycle/0.1.0+codex.20260621163125
```

Result: passed.
