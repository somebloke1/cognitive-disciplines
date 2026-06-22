---
name: p4-decide-responsibly
description: Make responsible P4 decisions from P3 judgments for emergent-probability audits, disciplined cognitive cycles, proposal evaluations, architecture investigations, and any task that asks Codex to "decide", "declare", "recommend", "enact", or perform the P4/Volition operation after judgment.
---

# P4 Decide Responsibly

## Purpose

Use this skill to perform P4: responsibility as Volition. Your job is to turn P3's grounded judgment into a concrete declaration, recommendation, or action that creates conditions for further development.

For a compact source-grounding summary, read [references/ep-discipline.md](references/ep-discipline.md) when the task concerns EP audit or curriculum-derived cognitive-cycle source materials.

For team, legion-scale, or full-cycle work, use the shared packet contract at [../full-cognitive-cycle/references/cognitive-cycle-packet-contract.md](../full-cognitive-cycle/references/cognitive-cycle-packet-contract.md). P4 emits a P4 decision packet and a new P1 seed.

## Characterizing Quality

Your characterizing quality is responsible Volition. Commit within the manifest
authority. A P4 decision should declare what is to be done, what is foreclosed,
what consequences are accepted, what uncertainty remains, and what new
conditions the decision creates for the next P1.

## Modes

Respect the authorized mode exactly:

- `recommend-only`: produce counsel; do not modify state.
- `decision-only`: declare the decision and record it if requested/available; do not implement.
- `decide-and-enact`: decide and perform the authorized changes, then verify them.

When part of a cycle, take mode from the cycle manifest rather than inferring it late. If no mode is supplied outside a cycle, default to `recommend-only` unless the user explicitly asked for implementation or direct action.

## Harness vs Judgment

The soft harness supplies mode, accumulated record, P3 handoff, archive target, and packet shape. P4 judgment decides the responsible declaration, commitments, foreclosures, residual uncertainty, and next evidentiary horizon. A valid P4 packet is not responsible if it exceeds authority or ignores unresolved fatal gaps.

## Protocol

1. Read the accumulated P1/P2/P3 record.
   - Preserve evidence anchors and unresolved uncertainty from earlier packets.
   - Treat P3 as the governing judgment, but do not let a thin P3 summary erase P1/P2 evidence.

2. Check for fatal gaps.
   - If the accumulated record cannot support a responsible decision, return a defect notice to the controller naming the missing P1/P2/P3 work.
   - Do not quietly decide around a fatal gap.

3. Read P3 as the selection judgment.
   - Do not relitigate the whole cycle.
   - If P3 contains an obvious fatal gap, name it and convert the decision to a bounded recommendation for recursion or further evidence.

4. Declare the decision.
   - Be concrete enough that another agent can act without ambiguity.
   - Name the selected path, rejected paths, commitments, constraints, and next actions.

5. Apply the EP verdict form when a proposal is under review.
   - `emerge-now`: conditions are met; proceed.
   - `defer`: conditions are partial; specify what must change and when to reassess.
   - `block`: conditions are absent or the proposal would damage the current manifold.

6. Name what the decision creates and forecloses.
   - New schemes or conditions created.
   - Schemes retired, displaced, or left untouched.
   - Residual uncertainties and how they should be monitored.
   - The next P1 seed: what future evidence should be attended to after the decision acts.

## Output Shape

When a durable manifest/archive exists, return or write a JSON packet matching
the validator keys: common header fields plus `decision_or_recommendation`,
`mode_and_authority`, `grounding`, `commitments_and_next_actions`,
`foreclosed_alternatives`, `residual_uncertainty`, `reassessment_conditions`,
and `new_p1_seed`. Use the manifest mode exactly.

For conversational/non-archive use, use sections like:

- Decision
- Mode and Authority
- Grounding in Accumulated P1/P2/P3 Record
- EP Verdict, if applicable
- Commitments and Next Actions
- Foreclosed Alternatives
- Residual Uncertainty
- Reassessment Conditions
- New P1 Seed

## Discipline

P4 is not vague endorsement. It is a constitutive declaration. Do not exceed mode, do not hide uncertainty, and do not substitute your own analysis for P3's judgment. In short: do not exceed mode.
