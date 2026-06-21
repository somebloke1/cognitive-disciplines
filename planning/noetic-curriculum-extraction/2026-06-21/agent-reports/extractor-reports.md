# Extractor Reports

This file preserves the controller-level summaries from the three extraction
agents dispatched on 2026-06-21. The agents were instructed to inspect
`/home/dgk/workspace/noetic-pi` and report what should be copied for review and
processing. The controller copied the raw files into this bundle separately.

## Extractor A: Curriculum And Prompt Materials

Scope:

- `/home/dgk/workspace/noetic-pi/.method/curricula/`
- `/home/dgk/workspace/noetic-pi/.method/prompts/`

Must-copy files identified:

- `.method/curricula/differentiated-cognition.json`
- `.method/curricula/emergent-probabilistics.json`
- `.method/prompts/phronesis-overview.md`
- `.method/prompts/phronesis-grounding-preamble.md`
- `.method/prompts/phronesis-fresh.md`
- `.method/prompts/phronesis-p1.md`
- `.method/prompts/phronesis-p2.md`
- `.method/prompts/phronesis-p3.md`
- `.method/prompts/phronesis-p4.md`
- `.method/prompts/phronesis-accumulated.md`
- `.method/prompts/phronesis-task.md`
- `.method/prompts/curriculum.md`
- `.method/prompts/ep-audit-task.md`
- `.method/prompts/ep-audit-prospective-task.md`
- `.method/prompts/twelve-properties.md`
- `.method/prompts/mesh-operations.md`
- `.method/prompts/sub-agent-task.md`

Behavior-reinforcing findings:

- `phronesis-fresh.md` and `phronesis-grounding-preamble.md` create staged grounding before action.
- `differentiated-cognition.json` is the strongest source for compressed P1/P2/P3/P4 specialist priming.
- `phronesis-p1.md` reinforces observation before interpretation.
- `phronesis-p2.md` reinforces grounded alternatives, assumptions, differentiating evidence, and no ranking.
- `phronesis-p3.md` is the strongest recursion and sufficiency source.
- `phronesis-p4.md` enforces mode-bounded decision, implications, foreclosures, and uncertainty.
- EP audit prompts force scheme mapping, dependencies, blind alleys, breakdowns, trajectory, and verdict.

Candidate compressed modules:

- P1: evidence tables, source coverage, present/absent observations, anomaly preservation, observation/inference separation.
- P2: three to seven grounded alternatives, assumptions, uncomfortable possibilities, and differentiating tests.
- P3: skeptical sufficiency judgment, evaluation of each possibility, explicit route among P1 recursion, P2 recursion, or P4 advance.
- P4: authority-bound decision, accumulated-record grounding, consequences, foreclosures, residual uncertainty, and next P1 seed.
- Integrators: same operation discipline applied to same-phase consolidation without later-phase leakage.

Naive-copy risks:

- Raw curriculum references noetic-pi tools and project context not present in `cognitive-disciplines`.
- Copying JSON alone would create broken references and weak imitation.
- P3 recursion must become an acceptance gate, not just prose guidance.

## Extractor B: Theory, Imperatives, And Operational Doctrine

Scope:

- `.method_sources/`
- `.method/imperatives.md`
- `.method/constitution.md`
- `.method/emergent-properties.md`
- `.method/model-management-participation.md`
- `ROOT_PROMPT.md`

Must-copy files identified:

- `.method_sources/emergent_fidelity.txt`
- `.method_sources/emergent_probability.txt`
- `.method_sources/notion_of_development.txt`
- `.method/imperatives.md`
- `.method/constitution.md`
- `.method/emergent-properties.md`
- `ROOT_PROMPT.md`
- `.method/prompts/phronesis-overview.md`
- `.method/prompts/phronesis-p1.md`
- `.method/prompts/phronesis-p2.md`
- `.method/prompts/phronesis-p3.md`
- `.method/prompts/phronesis-p4.md`
- `.method/prompts/phronesis-grounding-preamble.md`
- `.method/prompts/phronesis-fresh.md`
- `.method/prompts/phronesis-accumulated.md`
- `.method/curricula/differentiated-cognition.json`
- `.method/curricula/emergent-probabilistics.json`
- `packages/apm/src/curriculum.ts`
- `packages/apm/src/prompts.ts`
- `packages/apm/src/phronesis-progression-engine.ts`

Concepts to compress:

- P1: describe before interpreting, observe versus infer, include relevant absences, preserve anomalies.
- P2: generate structurally distinct possibilities, ground each possibility in P1, include assumptions and uncomfortable alternatives.
- P3: default skepticism, sufficiency judgment, precise repair instructions, premature closure as primary failure.
- P4: decide within explicit authority, state what the decision creates and forecloses, do not relitigate P3.
- All phases: accumulated content must deepen rather than repeat.
- Controller: enforce grounding stages, active/submitted legality, recursion limits, and alignment to orienting question plus implicit unknown.
- EP lens: scheme identification, conditioned-series mapping, survival assessment, blind-alley detection, breakdown vulnerability, development path, scale/time reasoning.
- Development lens: operator versus integrator, principle of correspondence, limitation/transcendence/genuineness, scotosis/arrested development.

Naive-copy risks:

- Long theoretical material should become operational checks, not doctrinal preambles.
- noetic-pi tool names must be translated into Codex workflow terms.
- `ROOT_PROMPT.md` contains project-specific records and tools; extract general discipline only.
- `DDAM-algorithm-specification.md` is better treated as an example of mature, exact P4 artifacting than as general curriculum.

## Extractor C: APM Harness And Behavior-Reinforcing Tests

Scope:

- `packages/apm/src/phronesis*.ts`
- `packages/apm/src/curriculum.ts`
- `packages/apm/src/tool-profiles.ts`
- phronesis tests and state-machine files under `packages/apm/test/`

Must-copy files identified:

- `packages/apm/src/phronesis.ts`
- `packages/apm/src/curriculum.ts`
- `packages/apm/src/phronesis-grounding-protocol.ts`
- `packages/apm/src/phronesis-progression-engine.ts`
- `packages/apm/src/phronesis-agent-lifecycle.ts`
- `packages/apm/src/phronesis-content-archive.ts`
- `packages/apm/src/tool-profiles.ts`
- `packages/apm/src/prompts.ts`
- `packages/apm/test/unit/curriculum.test.ts`
- `packages/apm/test/unit/phronesis.test.ts`
- `packages/apm/test/unit/phronesis-lifecycle.test.ts`
- `packages/apm/test/integration/phronesis-flow.test.ts`
- `packages/apm/test/state-machines/graphs/phronesis.ts`
- `packages/apm/test/state-machines/ideal-conformance/phronesis/*.test.ts`

Mechanics to emulate:

- Mandatory role acknowledgment before operation work.
- Staged grounding before active work.
- Operation-specific curriculum over shared source texts.
- Epistemic horizon bound to `orientingQuestion`, `implicitUnknown`, and `alignmentRationale`.
- Structural blocking of submit while grounding is incomplete.
- Recursion only from P2-P4 to earlier operations, carrying content plus reason atomically.
- Accumulated content persisted and re-served in phase/pass order.
- Recall agents acknowledge role and fetch accumulated context.
- Terminal states clear current agent and retire P-agents.
- State-machine tests define legal and illegal event/state behavior.

Missing gates in current skills:

- No mandatory specialist curriculum priming before phase work.
- No controller-enforced `role_ack -> staged_grounding -> active` transition.
- No required source-reading artifact per grounding stage.
- No acceptance test against orienting question and implicit unknown.
- No structural rejection for premature submit, shallow packet, missing alignment rationale, or skipped context retrieval.
- No typed event/state matrix for legal versus illegal controller actions.
- No persistent ordered archive as required downstream substrate.
- No retry prompt with schema when packet structure fails.
- No hard recursion contract requiring target, reason, content, and downstream rerun policy.

Bottom line:

The next implementation should build an artifact-first harness around the copied
curriculum: staged priming packets, acceptance gates, ordered archives, legal
transition matrix, and controller rejection/repair behavior.
