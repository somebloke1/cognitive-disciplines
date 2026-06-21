# Task 0002: Plugin Scaffold And Install Verification

## Status

Completed.

## Supersession Note

Task 0004 narrows the publishable plugin bundle. The root repository may still
keep development-only GitHub Project and GraphQL coordination skills, but those
skills are no longer part of the public `plugins/cognitive-cycle` package.

## Scope

Transform the governed baseline into an initial repo-local Codex plugin that is
valid, installable, and behaviorally stronger than phase labels alone.

## Completed Work

- Added governance decision `0002-semantic-evaluation-and-cycle-agent-model`.
- Scaffolded repo-local plugin `plugins/cognitive-cycle`.
- Added repo-local marketplace `.agents/plugins/marketplace.json`.
- Packaged the cognitive-cycle skill set:
  - `ep-cognitive-cycle`
  - `ep-p1-attend`
  - `ep-p2-inquire`
  - `ep-p3-judge`
  - `ep-p4-decide`
  - `ep-p1-data-curator`
  - `ep-p2-possibility-integrator`
  - `ep-p3-dialectician`
  - `ep-p4-ethics-sage`
  - `github-project-agent-coordination`
  - `graphql-efficiency-strategist`
- Added structural harness scripts:
  - `plugins/cognitive-cycle/scripts/init_cycle_run.py`
  - `plugins/cognitive-cycle/scripts/validate_cycle_artifacts.py`
- Added compressed curriculum and harness references:
  - `curriculum-primers.md`
  - `acceptance-gates.md`
  - `controller-transition-matrix.md`
  - `semantic-review-template.md`
  - `harness-structural-contract.md`
- Installed the plugin locally from the repo marketplace as
  `cognitive-cycle@personal`.

## Validation Evidence

Repo plugin validation:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle
```

Result: passed.

Repo bundled skill validation:

```bash
for skill in plugins/cognitive-cycle/skills/*; do \
  python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill" || exit 1; \
done
```

Result: all 11 skills passed.

Harness tests:

```bash
python3 -m unittest tests/test_cycle_harness.py
```

Result: 3 tests passed.

Installed plugin validation:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /home/dgk/.codex/plugins/cache/personal/cognitive-cycle/0.1.0
```

Result: passed.

Installed plugin readback:

```text
cognitive-cycle@personal  installed, enabled  0.1.0
```

## Semantic Boundary

The validator checks structure only. It does not claim semantic adequacy from
regex or pattern matching. Semantic acceptance requires agent/model review using
the packaged acceptance gates and semantic review template.

## Remaining Work

This task proves the initial plugin is installable and structurally valid. It
does not finish the full objective. Remaining work includes forward-testing the
installed skill in a fresh thread, adding richer dry-run artifacts, and deciding
whether to split the current broad PR into separate reviewable PRs.
