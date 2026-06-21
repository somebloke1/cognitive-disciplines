# Decision 0002: Semantic Evaluation And Cycle-Agent Model

## Status

Accepted.

## Decision

Language-model generated content must not be evaluated semantically by pattern
matching, regexes, or similar string heuristics.

Deterministic pattern checks are suitable only for structural constraints such
as required files, manifest keys, packet fields, JSON schema shape, archival
paths, phase names, and controller ledger presence.

When a model generates structured JSON, deterministic checks may validate the
JSON structure. The meaning, quality, relevance, sufficiency, judgment, prose,
and responsible decision content inside that JSON still require model or agent
evaluation.

During plugin development, agents performing cognitive cycles must use
`gpt-5.x-mini` and only `gpt-5.x-mini`.

## Rationale

The cognitive-cycle plugin exists to discipline language-model cognition, not to
simulate semantic judgment with brittle text matching. Regex-based evaluation can
prove that a packet has a field, but it cannot prove that the packet attends to
the evidence, generates materially different possibilities, judges sufficiency,
or makes a responsible decision.

The harness should therefore separate:

- deterministic mechanics: structure, sequence, schema, archives, transition
  legality, recursion budget, and presence checks;
- cognitive judgment: relevance, possibility quality, sufficiency, contradiction
  handling, ethical responsibility, and final decision quality.

The model constraint keeps cognitive-cycle agent behavior consistent during
development and prevents results from becoming an uncontrolled mixture of model
capabilities.

## Implications

- Validation scripts may reject malformed artifacts, missing fields, invalid
  phase transitions, and absent ledgers.
- Validation scripts must not claim semantic success from word matches,
  keyword counts, regex captures, or superficial label detection.
- Semantic review gates must be performed by an appropriate agent/model
  evaluator and should produce written review artifacts.
- Multi-agent cognitive-cycle tests must configure P1, P2, P3, P4, and
  same-phase integration agents with `gpt-5.x-mini`.
- Non-cognitive structural automation may use ordinary deterministic tooling.
