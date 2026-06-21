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

## Validation Evidence

Source plugin validation:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle
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

Installed plugin readback:

```text
cognitive-cycle@personal  installed, enabled  0.1.0+codex.20260621163125  /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle
```
