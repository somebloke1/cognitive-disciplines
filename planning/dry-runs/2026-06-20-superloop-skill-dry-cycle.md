# Dry Cognitive-Cycle Exercise

Date: 2026-06-20

Purpose: validate R17 from `planning/superloop-skill-requirements-matrix.md` against the revised P1/P2/P3/P4/full-cycle skills.

## Synthetic Task

Evaluate this tiny proposal:

> A project has one flaky shell script, `scripts/build.sh`, that sometimes fails because it assumes `node_modules` already exists. Proposal: add `npm install` at the top of the script.

No production files were edited. This dry run exercises manifest -> P1 packet -> P2 packet -> P3 handoff -> P4 decision/new P1 seed.

## Cycle Manifest

- `cycle_id`: dry-2026-06-20-build-script
- `orienting_question`: What is the responsible way to handle the build script's missing dependency assumption?
- `implicit_unknown`: Whether the right correction is inside the script, outside the script as a prerequisite, or in a documented/validated workflow boundary.
- `mode`: recommend-only
- `source_scope`: synthetic prompt only
- `recursion_budget`: 1
- `phase_owners`: controller-owned single-agent dry run
- `archive_target`: `planning/dry-runs/2026-06-20-superloop-skill-dry-cycle.md`
- `scale`: individual

## P1 Packet

- `cycle_id`: dry-2026-06-20-build-script
- `phase`: p1
- `pass`: 1
- `owner`: controller
- `input_packets`: none
- `evidence_anchors`: synthetic task text above
- `handoff_target`: P2

### Scope and Sources Inspected

Only the synthetic prompt was inspected.

### Observations

- There is a shell script named `scripts/build.sh`.
- The script sometimes fails.
- The failure is attributed to assuming `node_modules` already exists.
- The proposal is to add `npm install` at the top of the script.
- No package manager, lockfile, CI behavior, caching policy, or project size is specified.

### Relevant Absences

- No evidence says whether `npm ci`, `npm install`, `pnpm install`, or another installer is canonical.
- No evidence says whether the script runs in CI, local development, release, or all contexts.
- No evidence says whether install side effects are acceptable during build.
- No evidence gives the actual script content.

### Inferences and Uncertainties

- The failure may be a missing precondition rather than a build-script responsibility.
- Adding install may make the script slower, less deterministic, or unexpectedly stateful.
- The correct boundary depends on workflow context not present in the prompt.

### Risks of P1 Insufficiency

- The actual script and package manager are not inspected.
- The runtime context is unknown.
- The proposal cannot be fully judged without dependency-management policy.

### Material for P2

P2 should consider fixes inside the script, outside the script, and at the workflow/documentation boundary.

## P2 Packet

- `cycle_id`: dry-2026-06-20-build-script
- `phase`: p2
- `pass`: 1
- `owner`: controller
- `input_packets`: P1 pass 1
- `evidence_anchors`: P1 observations and absences
- `handoff_target`: P3

### Possibility 1: Script Self-Heals by Installing Dependencies

Core claim: add dependency installation to `scripts/build.sh`.

Grounding in P1: the script fails when `node_modules` is missing, and the proposal directly addresses that absence.

Assumptions: install command is known, network access is acceptable, and build scripts may mutate dependency state.

Consequences if true: fewer local failures, but slower and less deterministic builds.

Differentiating evidence: actual package manager, CI policy, lockfile, and whether build is allowed to perform installs.

### Possibility 2: Script Fails Fast with a Clear Prerequisite Error

Core claim: keep dependency installation outside the build script, but check for dependencies and emit a precise recovery message.

Grounding in P1: missing `node_modules` is a precondition failure; source context does not prove installs belong inside the build.

Assumptions: dependency setup is a separate workflow step.

Consequences if true: faster deterministic builds and better operator feedback, but the user still must run setup.

Differentiating evidence: project conventions, README scripts, CI pipeline order.

### Possibility 3: Move Dependency Setup to Orchestration

Core claim: fix the caller workflow, CI job, or package script so install/setup occurs before build.

Grounding in P1: runtime context is unknown; the failure may be outside the script.

Assumptions: there is an orchestrating workflow where prerequisites can be enforced.

Consequences if true: cleaner separation of setup/build, but more surfaces may need updates.

Differentiating evidence: CI config, package.json scripts, dev onboarding docs.

### Surface-Variant / Duplicate Check

Possibility 2 and 3 are related but distinct: one changes script guard behavior; the other changes caller workflow.

### Questions for P3

Should recommendation proceed from limited evidence, or recurse to P1 for actual script/package-manager context?

## P3 Packet

- `cycle_id`: dry-2026-06-20-build-script
- `phase`: p3
- `pass`: 1
- `owner`: controller
- `input_packets`: P1 pass 1, P2 pass 1
- `evidence_anchors`: synthetic task, P1 absences, P2 differentiators
- `handoff_target`: P4

## Advance to P4

### P1 Sufficiency Finding

P1 is sufficient for a recommend-only dry run because the task is synthetic and the goal is not to patch a real script. It would be insufficient for implementation.

### P2 Sufficiency Finding

P2 is sufficient: it presents three structurally distinct options: install inside script, fail-fast script guard, and external workflow correction.

### Evaluations

- Possibility 1 addresses the symptom directly but assumes stateful/network behavior is acceptable inside build.
- Possibility 2 best fits the known evidence because it preserves build determinism while making the missing precondition explicit.
- Possibility 3 may be necessary in a real project, but the prompt gives no actual orchestration surface.

### Selected Judgment

For recommend-only mode and limited evidence, Possibility 2 is best supported.

### Rejected or Inconclusive Alternatives

- Possibility 1 is rejected as the default recommendation because it risks hiding a setup boundary inside build.
- Possibility 3 remains inconclusive pending workflow evidence.

### P4 Handoff Packet

Recommend a fail-fast prerequisite check in `scripts/build.sh` plus a workflow/docs review before adding install behavior. Do not implement in this dry run.

## P4 Packet

- `cycle_id`: dry-2026-06-20-build-script
- `phase`: p4
- `pass`: 1
- `owner`: controller
- `input_packets`: P1 pass 1, P2 pass 1, P3 pass 1
- `evidence_anchors`: accumulated dry-run packets
- `handoff_target`: final / next P1 seed

### Decision

Recommend against adding `npm install` directly at the top of `scripts/build.sh` as the default fix. Recommend a fail-fast dependency check with a clear message, plus a follow-up inspection of the real package manager and caller workflow.

### Mode and Authority

Mode is `recommend-only`; no files are modified.

### Grounding in Accumulated P1/P2/P3 Record

P1 showed missing `node_modules` is the observed failure condition but also showed no evidence about package manager, CI, or whether build may mutate dependency state. P2 generated three alternatives. P3 judged the fail-fast boundary as best supported under limited evidence.

### Commitments and Next Actions

- If implemented later, check dependency presence before build work starts.
- Emit the exact setup command only after verifying the package manager and lockfile.
- Inspect CI/package scripts before deciding whether workflow setup also needs correction.

### Foreclosed Alternatives

Do not make build silently run dependency installation without first proving that stateful install behavior is acceptable in all build contexts.

### Residual Uncertainty

The actual script, package manager, and workflow are unknown.

### Reassessment Conditions

Reassess if evidence shows this script is intentionally a one-command bootstrap script, or if project policy requires build to self-install dependencies.

### New P1 Seed

Inspect `scripts/build.sh`, package manager files, `package.json` scripts, CI configuration, and README setup instructions to determine the real dependency boundary.

## Dry-Run Validation Notes

- Manifest present: yes.
- P1 packet present: yes.
- P2 packet present: yes.
- P3 `Advance to P4` handoff present: yes.
- P4 decision and new P1 seed present: yes.
- No production files edited: yes.
