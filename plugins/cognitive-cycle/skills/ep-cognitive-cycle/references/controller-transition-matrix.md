# Controller Transition Matrix

Use this matrix to keep the cycle ordered. It is adapted from the extracted APM
harness mechanics: staged grounding, active/submitted states, legal recursion,
ordered archive, and terminal cleanup.

## States

- `manifested`: cycle manifest exists.
- `grounding`: phase agent has accepted role and is reading primer/context.
- `active`: phase agent may produce work.
- `submitted`: packet returned to controller.
- `accepted`: packet passed structure and semantic review.
- `repair`: packet rejected with exact repair instructions.
- `recurse`: P3 routed the cycle to P1 or P2.
- `complete`: P4 accepted within mode, or controller stops on exhausted budget.

## Legal Forward Path

| From | Event | To | Requirement |
| --- | --- | --- | --- |
| none | create manifest | manifested | orienting question, implicit unknown, mode, scope, budget |
| manifested | assign P1 | grounding | P1 primer and packet contract supplied |
| grounding | grounding note accepted | active | role, forbidden work, source scope acknowledged |
| active | submit packet | submitted | packet references manifest and model policy |
| submitted | structural + semantic accept | accepted | review artifact or controller note exists |
| accepted P1 | assign P2 | grounding | P1 packet supplied |
| accepted P2 | assign P3 | grounding | P1 and P2 packets supplied |
| accepted P3 advance | assign P4 | grounding | P4 handoff supplied |
| accepted P4 | finalize | complete | decision ledger and new P1 seed recorded |

## Same-Phase Multi-Agent Path

When a phase has more than one peer agent:

| Peer Phase | Integration Skill | Downstream Packet |
| --- | --- | --- |
| multiple P1 | `ep-p1-data-curator` | curated P1 dataset |
| multiple P2 | `ep-p2-possibility-integrator` | integrated P2 possibility set |
| multiple P3 | `ep-p3-dialectician` | affirmed P3 judgment or recursion |
| multiple P4 | `ep-p4-ethics-sage` | best authorized P4 decision |

Do not run same-phase integration when cardinality is one.

## Legal Recursion

P3 may route to:

- P1 when evidence is inadequate;
- P2 when evidence is adequate but possibilities are weak;
- P4 when P1 and P2 are sufficient.

Required recursion payload:

- source phase;
- target phase;
- reason;
- required work;
- evidence or possibility gap;
- prior packet ids;
- budget before and after;
- downstream rerun policy.

P4 may return a defect notice to the controller when the accumulated record has a
fatal gap, but P4 should not independently restart the cycle without controller
approval.

## Illegal Events

Reject:

- submit while still in grounding;
- submit by an agent not registered for the phase;
- P2 before accepted P1;
- P3 before accepted P1 and P2;
- P4 before accepted P3 handoff;
- same-phase integration with one peer packet;
- recursion without budget status;
- terminal edits after complete unless a new cycle is opened.

## Archive Rule

Archive accepted packets in phase/pass order. Downstream agents should receive
the accumulated archive, not only the immediately prior summary.
