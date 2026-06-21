# Cognitive Cycle Packet Contract

Use this contract when a P1-P4 cognitive cycle needs durable handoffs, team coordination, or legion-scale decomposition. It is a soft Codex harness: it gives structure and validation checkpoints, but the language model still performs the cognitive judgments.

## Harness vs Judgment

Harness conventions:

- Cycle manifest.
- Phase order.
- Packet shapes.
- Accumulated record.
- Recursion budget and ledger.
- Mode authority.
- Archive target.
- Controller merge rules.

Cognitive judgments:

- P1 relevance and evidence fidelity.
- P2 structural distinctness and generative adequacy.
- P3 sufficiency, selection, and recursion judgment.
- P4 responsible declaration within authority.

Do not confuse a valid packet with a valid judgment. Packet validity only proves the handoff is inspectable.

## Cycle Manifest

Every full cycle should establish:

- `cycle_id`: stable local identifier.
- `orienting_question`: the question that grounds the inquiry.
- `implicit_unknown`: the shape of the missing insight the cycle is trying to resolve.
- `mode`: `recommend-only`, `decision-only`, or `decide-and-enact`.
- `source_scope`: files, repos, logs, prompts, docs, tools, or external sources in bounds.
- `recursion_budget`: total allowed recursions and any per-scope limits.
- `phase_owners`: single agent, named subagents, or controller-owned phases.
- `archive_target`: where accumulated packets and decisions will be recorded, if any.
- `scale`: `individual`, `team`, or `legion`.

## Common Packet Header

Every phase packet should start with:

- `cycle_id`
- `phase`: `p1`, `p2`, `p3`, or `p4`
- `pass`: positive integer
- `owner`: agent or controller identity when known
- `orienting_question`
- `implicit_unknown`
- `source_scope`
- `input_packets`: packet ids or summaries consumed
- `evidence_anchors`: concrete paths, commands, outputs, URLs, records, or observations
- `uncertainties`
- `handoff_target`

## P1 Packet

Required sections:

- Scope and sources inspected.
- Observations, separated from inference.
- Relevant absences and negative search results.
- Contradictions or unresolved tensions.
- Source/evidence inventory.
- Risks of P1 insufficiency.
- Candidate significance signals for P2.

P1 must not select, recommend, or decide.

## P2 Packet

Required sections:

- 3-7 structurally distinct possibilities.
- Grounding in P1 evidence anchors for each possibility.
- Assumptions for each possibility.
- Consequences if true.
- Differentiating evidence or tests.
- Surface-variant / duplicate check.
- Questions or tensions for P3.

P2 must not rank, select, or recommend.

## P3 Packet

P3 must choose exactly one outcome:

- `Return to P1`
- `Return to P2`
- `Advance to P4`

Required sections:

- P1 sufficiency finding.
- P2 sufficiency finding.
- Evaluation of each possibility.
- Affirmed, rejected, and inconclusive judgments.
- Evidence basis.
- Recursion instruction if returning.
- P4 handoff if advancing.

Recursion instruction fields:

- `target_phase`
- `reason`
- `required_work`
- `evidence_gap_or_possibility_gap`
- `prior_packet_ids`
- `budget_status`

P3 must not make the final P4 commitment.

## P4 Packet

Required sections:

- Decision or recommendation.
- Mode and authority.
- Grounding in accumulated P1/P2/P3 record.
- Commitments and next actions.
- Foreclosed alternatives.
- Residual uncertainty.
- Reversal or reassessment conditions.
- New P1 seed.

P4 may return a defect notice to the controller only when the accumulated record has a fatal gap that makes decision irresponsible.

## Recursion Ledger Entry

Record each recursion as:

- `cycle_id`
- `from_phase`
- `target_phase`
- `from_pass`
- `target_pass`
- `reason`
- `required_work`
- `budget_before`
- `budget_after`
- `owner`
- `outcome`

## Team and Legion Registers

For team and legion-scale runs, the controller should maintain:

- Accumulated packet index.
- Scope decomposition map.
- Contradiction register.
- Duplicate / surface-variant register.
- Open uncertainty register.
- Decision ledger.
- Archive index.

Controller authority includes splitting scopes, merging compatible packets, returning weak packets for repair, stopping unproductive recursion, and preserving minority reports when evidence remains genuinely contested.

## Same-Phase Integration Packets

Use same-phase integration only when a given level has more than one agent in the set. Do not insert these roles into ordinary single-agent P1, P2, P3, or P4 cycles.

The four integration roles are separate skills:

- `p1-curate-evidence`: consolidate multiple P1 packets into one curated dataset for P2.
- `p2-integrate-possibilities`: consolidate multiple P2 packets into one coherent possibility set for P3.
- `p3-reconcile-judgments`: consolidate multiple P3 judgments over the same possibilities into one affirmed judgment set or recursion instruction for P4/controller.
- `p4-evaluate-decisions`: evaluate multiple P4 evaluations and decide the best authorized decision for controller finalization.

Each same-phase integration packet should include:

- Common packet header.
- `integration_level`: `p1-data-curation`, `p2-possibility-integration`, `p3-dialectic`, or `p4-ethical-integration`.
- `peer_packets`: packet ids or summaries integrated.
- `consolidation_method`: how duplicates, conflicts, minority reports, and uncertainty were handled.
- `integrated_output`: curated dataset, coherent possibility set, affirmed judgment set, or best authorized decision.
- `preserved_minority_reports`: contested evidence, possibilities, judgments, or evaluations that should not be erased.
- `forbidden_work_check`: confirmation that the integrator did not generate out-of-scope data or perform a later phase prematurely.
- `handoff_target`: next phase or controller finalization.

Same-phase integration is both harness and judgment. The harness detects cardinality greater than one and routes to the proper skill. The integrator judges consolidation quality within its level without bypassing phase order.
