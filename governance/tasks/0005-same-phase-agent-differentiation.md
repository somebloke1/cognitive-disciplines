# Task 0005: Same-Phase Agent Differentiation

## Status

Completed.

## Scope

Represent the requirement that multi-agent P1/P2/P3/P4 sets should not be
assigned as interchangeable peers. Same-phase agents need differentiated focal
instructions, and same-phase integration roles need to preserve and evaluate
those differentiated contributions before cross-phase handoff.

## Requirement

- P1 agents should vary by attentional coverage: data source, tool pathway,
  evidence type, absence, contradiction, provenance, or boundary condition.
- P2 agents should vary by creative and formulative impetus: architecture,
  process, failure mode, emergence path, conservative formulation, disruptive
  formulation, or boundary expansion.
- P2 integration should balance the field without arbitrarily truncating
  authentic creative lines.
- P3 agents should be implicitly adversarial, testing sufficiency and warrants
  from differentiated judgment postures.
- The P3 dialectician should reconcile and select from competing judgments
  without averaging away meaningful disagreement.
- P4 agents should vary by value emphasis within authority.
- The P4 ethics sage should evaluate the values themselves, compare priority
  orderings, and determine the best authorized course.

## Implemented Artifacts

- Added `same-phase-differentiation.md` as the controller reference for
  differentiated multi-agent assignment.
- Updated `full-cognitive-cycle` team and legion orchestration guidance.
- Updated the packet contract with `same_phase_differentiation`,
  `focal_emphasis`, `peer_focal_emphases`, and `differentiation_account`.
- Updated the shared curriculum primer with same-phase differentiation
  guidance.
- Strengthened P1 curator, P2 integrator, P3 dialectician, and P4 ethics sage
  skill bodies with preservation/evaluation duties.

## Validation

Completed in the implementing turn:

- Source plugin validation.
- Harness unit tests.
- Skill quick validation.
- Personal plugin reinstall and installed-cache readback.

Commands:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle

python3 -m unittest tests/test_cycle_harness.py

python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  plugins/cognitive-cycle/skills/<skill-name>
```

Result before reinstall: source plugin validation passed, harness tests passed,
and all 9 public skills quick-validated.

Personal plugin reinstall:

```bash
python3 /home/dgk/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py \
  /home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle

cp -a plugins/cognitive-cycle/. /home/dgk/.codex/plugins/cognitive-cycle

codex plugin add cognitive-cycle@personal --json
```

Installed version:

```text
0.1.0+codex.20260621170626
```

Installed-cache readback confirmed:

- `same-phase-differentiation.md` is present.
- `same_phase_differentiation`, `focal_emphasis`,
  `peer_focal_emphases`, and `differentiation_account` are present in the
  packet contract.
- Full-cycle orchestration includes P1 attentional, P2 formulative, P3
  adversarial, and P4 value-emphasis differentiation.
