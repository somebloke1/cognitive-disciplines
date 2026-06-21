# Acceptance Gates

Use these gates before routing a packet downstream. Gates are semantic review
prompts for agents, plus structural checks where appropriate. Do not implement
semantic gates with regex or keyword matching.

## Controller Gate Procedure

1. Check structural validity with the packet contract or validator.
2. Read the packet as the next downstream phase would read it.
3. Apply the relevant semantic gate.
4. Accept, reject for repair, or recurse with exact instructions.
5. Archive the review artifact under `semantic-reviews/` when using a durable
   archive.

Structural success does not imply semantic acceptance.

## Shared Gate

Reject or repair when:

- orienting question or implicit unknown is missing or not addressed;
- source scope is not acknowledged;
- packet exceeds phase authority;
- evidence anchors are too vague for downstream inspection;
- uncertainties are erased;
- handoff target is missing.

## P1 Gate

Accept only when:

- inspected sources are inventoried;
- observations, absences, inferences, and uncertainties are separated;
- relevant negative space is named;
- anomalies or tensions are preserved;
- risks of P1 insufficiency are explicit;
- material for P2 is suggestive but not a recommendation.

Reject when:

- the packet starts solving before attending;
- relevant absences are omitted;
- direct observation and interpretation are fused;
- evidence anchors are absent or generic.

## P2 Gate

Accept only when:

- there are 3-7 structurally distinct possibilities unless the controller
  authorized another count;
- every possibility is grounded in P1;
- assumptions and differentiating tests are present;
- duplicate/surface-variant check is explicit;
- P2 does not rank, select, or recommend.

Reject when:

- possibilities are wording variants;
- a possibility has no P1 anchor;
- all possibilities share the same underlying mechanism;
- differentiating evidence is missing.

## P3 Gate

Accept only when:

- P1 sufficiency is judged;
- P2 sufficiency is judged;
- each possibility is affirmed, rejected, or held inconclusive;
- the packet chooses exactly one legal route;
- recursion instructions include target, reason, required work, gap, prior
  packet references, and budget status;
- P4 handoff is present when advancing.

Reject when:

- P3 makes the final decision;
- P3 advances without explaining why recursion is unnecessary;
- recursion is vague;
- P1/P2 sufficiency is assumed rather than judged.

## P4 Gate

Accept only when:

- mode and authority are explicit;
- grounding uses the accumulated P1/P2/P3 record;
- the decision or recommendation is concrete;
- commitments, foreclosed alternatives, residual uncertainty, and reassessment
  conditions are named;
- a new P1 seed is created.

Reject when:

- authority is absent or exceeded;
- fatal gaps are ignored;
- the output is a vague endorsement;
- the next evidentiary horizon is missing.

## Integration Gates

Accept same-phase integration only when same-level cardinality is greater than
one.

Reject when:

- the integrator performs a later phase;
- peer packets are not inventoried;
- conflicts or minority reports are erased;
- the integrated output lacks a clear handoff target;
- cardinality is one.

## Semantic Review Template

Use [semantic-review-template.md](semantic-review-template.md) for written review
artifacts. The review should explain the judgment; it should not merely say a
packet contains the expected headings.
