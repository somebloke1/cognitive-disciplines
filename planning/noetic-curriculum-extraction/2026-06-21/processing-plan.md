# Processing Plan: Curriculum-Primed Cognitive Skills

## Diagnosis

The current skills are weak because they primarily encode labels, role
boundaries, and packet sections. noetic-pi's stronger behavior comes from a
combination of curriculum and harness:

- staged grounding before active work;
- operation-specific curriculum over shared source materials;
- role acknowledgment and active/submitted state;
- accumulated context retrieval;
- recursion legality and limits;
- ordered content archive;
- tests for illegal transitions and validation behavior.

Codex skills cannot enforce all of this deterministically, but they can require
written artifacts and controller acceptance gates that approximate the same
pressure.

## Required New Artifacts

Add a repo-local curriculum layer:

- `curriculum/primers/p1-attend.md`
- `curriculum/primers/p2-inquire.md`
- `curriculum/primers/p3-judge.md`
- `curriculum/primers/p4-decide.md`
- `curriculum/primers/p1-data-curator.md`
- `curriculum/primers/p2-possibility-integrator.md`
- `curriculum/primers/p3-dialectician.md`
- `curriculum/primers/p4-ethics-sage.md`
- `curriculum/acceptance-gates.md`
- `curriculum/controller-transition-matrix.md`
- `curriculum/packet-templates/`

Each primer should be short enough for practical use but strong enough to alter
behavior. It should include:

- role stance;
- forbidden work;
- required source relation;
- failure modes;
- acceptance checklist;
- one weak-output counterexample;
- one strong-output pattern.

## Phase Priming Targets

### P1 Attend

Sources to compress:

- `raw/method-prompts/phronesis-p1.md`
- `raw/method-curricula/differentiated-cognition.json`
- `raw/method-core/imperatives.md`
- `raw/method-sources/emergent_fidelity.txt`

Behavior to enforce:

- describe before interpreting;
- separate observation, absence, inference, and uncertainty;
- preserve anomalies and tensions;
- cite source anchors;
- do not solve, rank, or recommend.

Acceptance gate:

- reject if no evidence table;
- reject if observations and inferences are mixed;
- reject if relevant absences are omitted;
- reject if packet does not address the implicit unknown.

### P2 Inquire

Sources to compress:

- `raw/method-prompts/phronesis-p2.md`
- `raw/method-curricula/differentiated-cognition.json`
- `raw/method-prompts/twelve-properties.md`

Behavior to enforce:

- generate structurally distinct possibilities;
- ground every possibility in P1 evidence;
- include assumptions and differentiating tests;
- include at least one uncomfortable or non-obvious possibility when warranted;
- do not rank or decide.

Acceptance gate:

- reject if possibilities are surface variants;
- reject if fewer than three or more than seven without controller approval;
- reject if differentiating evidence is missing;
- reject if any possibility is ungrounded in P1.

### P3 Judge

Sources to compress:

- `raw/method-prompts/phronesis-p3.md`
- `raw/apm-src/phronesis-progression-engine.ts`
- `raw/apm-tests/phronesis-flow.test.ts`
- `raw/apm-tests/ideal-conformance-phronesis/transitions.test.ts`

Behavior to enforce:

- default to skeptical sufficiency judgment;
- explicitly test P1 and P2 adequacy;
- select exactly one route: return to P1, return to P2, or advance to P4;
- issue precise recursion instructions when evidence or possibilities are thin;
- do not make P4's final decision.

Acceptance gate:

- reject if no explicit P1 and P2 sufficiency verdicts;
- reject if no possibility-by-possibility evaluation;
- reject if it advances without explaining why recursion is unnecessary;
- reject if it decides instead of handing off to P4.

### P4 Decide

Sources to compress:

- `raw/method-prompts/phronesis-p4.md`
- `raw/method-prompts/phronesis-accumulated.md`
- `raw/apm-src/phronesis-content-archive.ts`

Behavior to enforce:

- decide only within mode authority;
- read accumulated P1/P2/P3 record, not only summaries;
- state commitments, foreclosures, residual uncertainty, and reassessment conditions;
- produce the next P1 seed;
- return a defect notice if the record is fatally insufficient.

Acceptance gate:

- reject if authority mode is absent;
- reject if grounding cites only P3 summary when full packets exist;
- reject if no foreclosed alternatives or reassessment conditions are named;
- reject if no next P1 seed is created.

## Same-Phase Integrator Priming

Integrator primers should inherit phase discipline while adding consolidation
constraints:

- P1 data curator: consolidate evidence only; no new data beyond curated set.
- P2 possibility integrator: consolidate possibilities; no ranking.
- P3 dialectician: evaluate judgments; produce recursion or P4 handoff; no decision.
- P4 ethics sage: evaluate decisions within authority; no enactment beyond mode.

Acceptance gates:

- reject if integrator performs later-phase work;
- reject if peer packets are not inventoried;
- reject if conflicts or minority reports are silently erased;
- reject if same-phase cardinality is one.

## Controller Procedure

For each phase:

1. Create or update manifest.
2. Provide the relevant primer and packet template.
3. Require a grounding note before accepting phase work.
4. Validate packet against acceptance gate.
5. Reject and request repair if gate fails.
6. Archive accepted packet before downstream routing.

For multi-agent phases:

1. Archive each peer packet separately.
2. Run the required same-phase integrator only when cardinality is greater than one.
3. Archive the integrated packet.
4. Route only the integrated packet downstream, preserving links to peer packets.

## Next Implementation Task

Open a feature request to convert this extraction bundle into curriculum-primed
skills and controller artifacts. The issue should explicitly require:

- compressed primers;
- packet templates;
- acceptance gates;
- controller transition matrix;
- one repeat test on a disputed question with written artifacts;
- comparison against the weak `0^0` run.
