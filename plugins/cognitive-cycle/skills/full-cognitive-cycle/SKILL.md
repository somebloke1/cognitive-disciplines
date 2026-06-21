---
name: full-cognitive-cycle
description: Run a complete emergent-probability P1-P4 cognitive cycle for audits, source-material investigations, proposal evaluations, architecture decisions, prompt/curriculum design, and disciplined cognitive-cycle work. Use when Codex is asked to perform a full EP audit, combine P1/P2/P3/P4, preserve cognitive discipline, or produce a responsible decision from staged grounding.
---

# Full Cognitive Cycle

## Purpose

Use this skill to run the full recursive cycle: P1 Attend -> P2 Inquire -> P3 Judge -> P4 Decide -> new P1 seed. The cycle is not a checklist. Each operation has a distinct job, and P3 owns recursion when evidence or alternatives are insufficient.

Read [references/ep-discipline.md](references/ep-discipline.md) before running source-grounded EP audit or curriculum-derived cognitive-cycle work.
Use [references/cognitive-cycle-packet-contract.md](references/cognitive-cycle-packet-contract.md) for team, legion-scale, or any cycle that needs durable handoffs.
Use [references/harness-structural-contract.md](references/harness-structural-contract.md) when creating or validating durable run archives.
Use [references/curriculum-primers.md](references/curriculum-primers.md) before assigning specialist phase work.
Use [references/acceptance-gates.md](references/acceptance-gates.md) and [references/controller-transition-matrix.md](references/controller-transition-matrix.md) when accepting, rejecting, repairing, or routing packets.

## SuperLoop Stance

Operate as a patient controller. Treat the cycle as iterative research and refinement:

1. Establish a manifest.
2. Prime the phase with the relevant curriculum primer.
3. Require a grounding note before active work.
4. Run the next bounded phase.
5. Validate the packet structurally and semantically.
6. Integrate the accumulated record.
7. Recurse when P3 requires it.
8. Stop only when P4 can responsibly decide or the recursion budget is exhausted.

Do not rush from first evidence to edits. A phase is complete only when its packet is strong enough for the next operation.

## Harness vs Judgment

Soft harness responsibilities:

- Maintain the cycle manifest.
- Preserve phase order and accumulated packets.
- Assign phase owners or subagents.
- Require role acknowledgment and grounding before active work.
- Enforce mode, recursion budget, packet validation, archive convention, and stop conditions.
- Keep contradiction, duplicate, uncertainty, and decision registers for large runs.
- Route same-phase multi-agent sets through the required integration skill before cross-phase handoff.

Cognitive judgment responsibilities:

- P1 decides what evidence is relevant and how to characterize it.
- P2 decides which possibilities are structurally distinct.
- P3 decides sufficiency, selection, and recursion.
- P4 decides the responsible declaration within authority.

Do not confuse harness compliance with cognitive adequacy. A well-formed packet can still be weak.

During development, cognitive-cycle phase agents and same-phase integration
agents must use the latest available `gpt-*.*-mini` model variant. Identify the
current available model set, select the highest-version GPT mini model, and
record the concrete model id in the manifest and packets.

Do not evaluate language-model generated semantics with regex, pattern matching,
keyword counts, or superficial label checks. Deterministic checks may validate
structure. Agent/model judgment must evaluate meaning, relevance, sufficiency,
and decision quality.

## Cycle Manifest

Before phase work, establish:

- `cycle_id`
- `orienting_question`
- `implicit_unknown`
- `mode`: `recommend-only`, `decision-only`, or `decide-and-enact`
- `source_scope`
- `recursion_budget`
- `phase_owners`
- `archive_target`, if any
- `scale`: `individual`, `team`, or `legion`

If the user has not specified mode, default to `recommend-only` unless they explicitly authorized implementation or direct action. In a cycle, pass the manifest mode through to P4; do not infer authority late.

For durable runs, initialize an archive with
`plugins/cognitive-cycle/scripts/init_cycle_run.py` and validate structure with
`plugins/cognitive-cycle/scripts/validate_cycle_artifacts.py`. Treat validation
success as structural evidence only; semantic acceptance still requires a review
artifact from an agent/model evaluator.

## Grounding

When the task concerns source curricula or EP audit source materials, ground before interpreting the mission:

1. Read authoritative theory, source curricula, or domain references when present.
2. Read operating instructions, constitutions, root prompts, role definitions, or policy files that govern the work.
3. Read task-specific prompts, rubrics, harness definitions, packet schemas, and acceptance criteria.
4. Read project or material state records needed by the task: logs, prior reports, run archives, working directories, tests, schemas, source files, and unresolved issue records.

This mirrors the EP auditor discipline: authoritative materials first, mission-specific interpretation second.

## Cycle

### P1 Attend

Characterize what is given. Separate observation, absence, inference, and uncertainty. For EP work, map functioning schemes, conditioning relationships, defenses, breakdowns, blind alleys, emergence candidates, proposal substrate, and trajectory. Produce a P1 packet with risks of P1 insufficiency.

### P2 Inquire

Generate 3-7 structurally distinct possibilities grounded in P1. Include assumptions, differentiating evidence, and a surface-variant check. Do not rank or recommend. Produce a P2 packet.

### P3 Judge

Assess P1 and P2 sufficiency, then either:

- Return to P1 with exact missing-evidence instructions.
- Return to P2 with exact missing-possibility instructions.
- Advance to P4 with grounded selections and rejections.

Use recursion when the implicit unknown is not addressed, authoritative sources were missed, alternatives are derivative, or judgment would be premature. Record each recursion in the recursion ledger. If advancing, produce a P4 handoff packet.

### P4 Decide

Respect the manifest mode: `recommend-only`, `decision-only`, or `decide-and-enact`. Read the accumulated P1/P2/P3 record, not only the P3 summary. Declare the responsible course, the EP proposal verdict if applicable (`emerge-now`, `defer`, `block`), commitments, foreclosed alternatives, residual uncertainty, reassessment conditions, and the new P1 seed created by the decision.

## Individual Use

For one-agent cycles:

1. Keep the manifest in working memory or a local note.
2. Produce P1/P2/P3/P4 packets in order.
3. When P3 recurses, deepen only the target phase and then rerun downstream phases affected by the new packet.
4. Preserve the accumulated record in the final answer or archive target.

## Team Use

Use subagents only when the user asked for delegation or parallel agent work and the work can be split cleanly.

Controller protocol:

1. Assign P1 to evidence characterization with source scope and packet contract.
2. If more than one P1 agent produced packets, run `p1-curate-evidence` to consolidate the P1 set before P2. Skip this for a single P1 agent.
3. Assign P2 only after a single P1 packet or curated P1 dataset exists.
4. If more than one P2 agent produced packets, run `p2-integrate-possibilities` to consolidate the P2 set before P3. Skip this for a single P2 agent.
5. Assign P3 with P1 and P2 packets; require exactly one outcome: return to P1, return to P2, or advance to P4.
6. If more than one P3 agent judged the same substrate, run `p3-reconcile-judgments` to consolidate the P3 judgments before P4. Skip this for a single P3 agent.
7. Assign P4 only with manifest, accumulated record, and P3 handoff.
8. If more than one P4 agent produced evaluations, run `p4-evaluate-decisions` to decide the best authorized decision before controller finalization. Skip this for a single P4 agent.
9. Validate each returned packet before routing it forward.
10. Merge outputs by evidence anchors and preserve minority reports when genuine uncertainty remains.

Do not let subagents bypass the phase order. Do not ask P4 to decide from a summary when full packets are available.
Same-phase integration roles consolidate peer outputs at one level; they do not authorize later-phase work early.

## Legion-Scale Use

For many agents or repeated cycles over a codebase/material set:

1. Decompose the source scope into strata, modules, documents, or problem slices.
2. Run parallel P1 passes on disjoint scopes.
3. When a scope has multiple P1 packets, route them through `p1-curate-evidence` before P2.
4. Build an accumulated packet index and contradiction register.
5. Run P2 passes per scope or across related scopes; check duplicates and surface variants.
6. When a scope has multiple P2 packets, route them through `p2-integrate-possibilities` before P3.
7. Run P3 passes to judge sufficiency, reconcile contradictions, select paths, and route recursion.
8. When a scope has multiple P3 packets over the same possibilities, route them through `p3-reconcile-judgments` before P4.
9. Run P4 decisions only for scopes with sufficient P3 handoffs.
10. When a scope has multiple P4 evaluations, route them through `p4-evaluate-decisions` before controller finalization.
11. Feed each P4 new P1 seed into the next cycle.

Maintain:

- Scope decomposition map.
- Accumulated packet index.
- Recursion ledger.
- Contradiction register.
- Duplicate / surface-variant register.
- Open uncertainty register.
- Decision ledger.
- Archive index.

Controller authority includes splitting scopes, merging compatible packets, stopping unproductive recursion, and preserving unresolved minority reports for later cycles.

## Stop Conditions

Stop or pause the cycle when:

- P4 has produced a responsible decision within mode.
- Recursion budget is exhausted.
- P3 identifies missing evidence that cannot be gathered in the current environment.
- The controller detects drift, duplicated work, or contradictory packets that require consolidation before more agents are spawned.
- The user changes scope or authority.

## EP Audit Output

For EP audit reports, cover both retrospective and prospective aspects in one inquiry:

- Existing schemes and health: `generating`, `stable`, `stagnant`, `brittle`, `dead`.
- Conditioning links and strength: `strict` or `loose`.
- Defenses and robustness: `strong`, `adequate`, `weak`, `missing`.
- Emergence possibilities and probability: `high`, `medium`, `low`.
- Trajectory: `advancing`, `stable`, `declining`, `stuck`.
- Blind alleys, breakdown vulnerabilities, priorities, and forward-binding intentions.
- If a proposal exists: dependencies, enabled downstream schemes, retirement candidates, emergence schedule, and recommendation.

## Discipline Checks

- P1 describes before interpreting.
- P2 multiplies before selecting.
- P3 judges and recurses before deciding.
- P4 declares within mode and creates the next evidentiary horizon.
- Every EP claim is tied to source evidence or explicitly marked as inference.
- Every team/legion handoff uses a packet contract or clearly states why a lightweight handoff is sufficient.
- Completion is proven against the manifest and accumulated record, not assumed from a plausible final answer.
- Structural validation cannot prove semantic adequacy.
