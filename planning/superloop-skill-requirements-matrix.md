# SuperLoop Skill Requirements Matrix

Source inputs:

- `planning/noetic-pi-p1-p4-codex-skills-plan.md`
- First independent review agent output from `019ee7da-dd2d-7133-a37d-1e76b11140fa`
- Existing global skills under `/home/dgk/.codex/skills/ep-*`
- noetic-pi phronesis sources identified in the planning artifact

## Completion Requirements

The SuperLoop goal is not complete until the current skill set satisfies each requirement below and validation evidence exists.

| ID | Requirement | Applies To | Current Finding | Required Evidence |
|----|-------------|------------|-----------------|-------------------|
| R1 | Preserve P1-P4 as disciplined cognitive operations, not decorative labels. | all skills | Basic phase boundaries exist, but soft-harness language is thin. | Each `SKILL.md` names the operation, forbidden role leakage, and sufficient output conditions. |
| R2 | Preserve deterministic-harness-vs-cognitive-judgment distinction. | all skills, especially full-cycle | Mostly implicit. | Explicit section naming soft harness conventions vs judgments the model must perform. |
| R3 | Define a shared packet / handoff contract. | all skills | Missing. | Shared reference file exists and every skill points to it or embeds its required fields. |
| R4 | Require cycle manifest fields: orienting question, implicit unknown, mode, source scope, recursion budget, owners, archive target. | `ep-cognitive-cycle` | Missing. | Orchestration skill requires a manifest before phase work. |
| R5 | Require accumulated record discipline. | all skills | Partial; phase-local only. | Skills require downstream phases to consume prior packets and preserve uncertainties/evidence anchors. |
| R6 | Require P1 source-grounded evidence with observation/inference/absence separation. | `ep-p1-attend` | Mostly present; typo and missing insufficiency risks. | P1 packet has evidence anchors, absences, uncertainty, insufficiency risks, and material for P2. |
| R7 | Require P2 3-7 structurally distinct grounded possibilities without ranking. | `ep-p2-inquire` | Mostly present. | P2 packet includes alternatives, assumptions, differentiating evidence, and handoff questions for P3. |
| R8 | Require P3 sufficiency gate and structured recursion/P4 handoff. | `ep-p3-judge` | Present but not packetized enough. | P3 output has either `Return to P1`, `Return to P2`, or `Advance to P4` packet with precise target and rationale. |
| R9 | Require P4 mode authority from manifest and grounding in accumulated P1/P2/P3, not only P3. | `ep-p4-decide` | Mode can be inferred late; grounding section names only P3. | P4 skill requires explicit mode when in a cycle and consumes accumulated record plus P3 judgment. |
| R10 | Support individual-agent use. | full-cycle + phase skills | Present. | Full-cycle describes single-agent loop with recursion budget and next P1 seed. |
| R11 | Support team use with controller-managed phase agents. | `ep-cognitive-cycle` | Missing. | Full-cycle describes spawning/assigning/merging phase-specialized subagents and validating packets. |
| R12 | Support legion-scale use. | `ep-cognitive-cycle` | Missing. | Full-cycle describes scope decomposition, parallel P1/P2, contradiction register, duplicate detection, per-scope budgets, and consolidation. |
| R13 | Define recursion ledger and stop conditions. | `ep-cognitive-cycle`, P3 | Thin. | Full-cycle requires ledger entries for recursion target, reason, pass, owner, outcome, and budget status. |
| R14 | Define anti-drift controls. | `ep-cognitive-cycle` | Missing. | Full-cycle requires evidence anchors, contradiction register, duplicate detection, archive, and controller merge authority. |
| R15 | Keep skill bodies concise and use references for shared detail. | all skills | Existing bodies are concise. | Shared packet reference added; SKILL files remain readable and under 500 lines. |
| R16 | Validate skill metadata. | all skills | Not yet run after edits. | `quick_validate.py` passes for all five skill folders. |
| R17 | Forward-test or dry-run the revised set. | skill set | Dry run added at `planning/dry-runs/2026-06-20-superloop-skill-dry-cycle.md`. | A dry cognitive-cycle exercise demonstrates manifest -> P1/P2/P3/P4 or explicit recursion. |

## Planned Skill Changes

### Shared Reference

Add `references/phronesis-packet-contract.md` to all five skill folders or to the full-cycle skill with copied links from phase skills. The reference should define:

- Cycle manifest fields.
- Common packet header.
- P1 packet.
- P2 packet.
- P3 recursion packet.
- P3 P4-handoff packet.
- P4 decision packet.
- Recursion ledger entry.
- Contradiction and duplicate registers for large-scale runs.

### `ep-p1-attend`

Patch goals:

- Fix output typo.
- Add explicit P1 packet fields from the shared contract.
- Add "Harness vs Judgment" section.
- Add "Risks of P1 insufficiency."
- Clarify that P1 may name candidate inferences but must not select or recommend.

### `ep-p2-inquire`

Patch goals:

- Add P2 packet fields.
- Require grounding in P1 evidence anchors.
- Clarify no ranking and no hidden favored option.
- Add duplicate/surface-variant check for team and legion-scale runs.

### `ep-p3-judge`

Patch goals:

- Add P3 packet output: `Return to P1`, `Return to P2`, or `Advance to P4`.
- Require explicit sufficiency judgment for P1 and P2.
- Add recursion ledger fields.
- Clarify that P3 can identify a missing possibility but should not perform P2's generative work.

### `ep-p4-decide`

Patch goals:

- Require explicit manifest mode when part of a cycle.
- Ground decision in accumulated P1/P2/P3 record.
- Add fatal-gap defect path back to P3/controller.
- Add P4 decision packet and next P1 seed fields.

### `ep-cognitive-cycle`

Patch goals:

- Become the soft harness and controller skill.
- Add cycle manifest.
- Add individual, team, and legion-scale workflows.
- Add phase-gate, packet validation, recursion ledger, archive convention, and stop conditions.
- Add anti-drift controls.
- Define when to spawn subagents and when to keep work local.

## Validation Plan

1. Inspect final files to confirm each planned change is present.
2. Run skill `quick_validate.py` on all five skill folders.
3. Run a dry-cycle exercise against a small synthetic codebase/prompt question without editing production files.
4. Spawn one independent reviewer after edits to check evidence fidelity and missing requirements.
5. Complete a requirement-by-requirement audit against this matrix before calling the goal complete.
