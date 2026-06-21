# Curriculum Primers

Use these primers before assigning or performing phase work. They are compressed
from the extracted curriculum and harness reports; do not import raw source
material into runtime prompts.

## Shared Priming Rule

Each phase agent should produce a brief grounding note before active work:

- role accepted;
- orienting question restated;
- implicit unknown restated;
- source scope acknowledged;
- forbidden work acknowledged;
- expected packet and handoff named.

During development, cognitive-cycle agents use `gpt-5.x-mini` only.

## P1 Attend

Stance: patient attention to what is given.

Required source relation:

- inspect primary evidence first;
- separate direct observation, relevant absence, inference, and uncertainty;
- preserve anomalies and tensions instead of resolving them prematurely;
- cite evidence anchors precisely enough for downstream inspection.

Forbidden work:

- no solving;
- no ranking;
- no recommendations;
- no hidden interpretation as fact.

Failure modes:

- generic summary without source inventory;
- observations mixed with inferences;
- negative search space omitted;
- implicit unknown ignored.

Strong pattern:

- source coverage table;
- observations grouped by anchor;
- relevant absences with inspected scope;
- unresolved tensions;
- risks of insufficient attention;
- candidate significance signals for P2.

## P2 Inquire

Stance: fecund possibility generation from P1 evidence.

Required source relation:

- every possibility must name its P1 grounding;
- possibilities must differ structurally, not merely by wording;
- assumptions and differentiating evidence must be explicit.

Forbidden work:

- no ranking;
- no selection;
- no recommendation;
- no ungrounded taxonomy detached from P1.

Failure modes:

- fewer than three or more than seven possibilities without controller approval;
- surface variants;
- missing assumptions;
- no differentiating test;
- all possibilities are comfortable restatements.

Strong pattern:

- 3-7 named possibilities;
- each possibility has core claim, P1 grounding, assumptions, consequences, and differentiating test;
- duplicate/surface-variant check;
- live questions for P3.

## P3 Judge

Stance: skeptical sufficiency and selection before decision.

Required source relation:

- explicitly test P1 adequacy;
- explicitly test P2 adequacy;
- evaluate every possibility;
- decide the legal route: return to P1, return to P2, or advance to P4.

Forbidden work:

- no final decision;
- no skipping sufficiency findings;
- no vague "needs more work" recursion;
- no advancing because a possibility sounds plausible.

Failure modes:

- missing P1/P2 sufficiency verdicts;
- no possibility-by-possibility judgment;
- recursion without target, reason, required work, and budget status;
- P4 decision smuggled into judgment.

Strong pattern:

- P1 sufficiency finding;
- P2 sufficiency finding;
- affirmed/rejected/inconclusive judgment for each possibility;
- exact recursion instruction or P4 handoff;
- residual uncertainty preserved.

## P4 Decide

Stance: responsible declaration within explicit authority.

Required source relation:

- read accumulated P1/P2/P3 packets, not only P3 summary;
- respect manifest mode;
- state what the decision creates and forecloses;
- create the next P1 seed.

Forbidden work:

- no exceeding mode;
- no relitigating the whole cycle when P3 is sufficient;
- no decision over fatal gaps;
- no vague endorsement.

Failure modes:

- authority mode absent;
- grounding cites only a thin summary;
- no foreclosed alternatives;
- no reassessment conditions;
- no residual uncertainty;
- no next P1 seed.

Strong pattern:

- concrete decision or recommendation;
- mode and authority;
- accumulated-record grounding;
- commitments and next actions;
- foreclosed alternatives;
- residual uncertainty and reassessment conditions;
- new P1 seed.

## Same-Phase Integrators

Use only when a given level has more than one agent in the set.

P1 Data Curator:

- consolidate peer evidence into one curated dataset;
- no new data beyond the curated set;
- preserve contradictions, absences, and minority observations.

P2 Possibility Integrator:

- consolidate three or more possibility sets into one coherent set;
- remove duplicates and surface variants;
- no ranking or recommendation.

P3 Dialectician:

- compare judgments over the same P1/P2 substrate;
- affirm best-supported judgments or route recursion;
- no P4 decision.

P4 Ethics Sage:

- compare multiple P4 evaluations;
- decide the best authorized decision within mode;
- no enactment beyond authority.
