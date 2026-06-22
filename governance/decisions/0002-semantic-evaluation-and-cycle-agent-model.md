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

During plugin development, agents performing cognitive cycles must use the
latest available `gpt-*.*-mini` model variant. The controller must identify the
current available model set, select the highest-version GPT mini model, and
record the concrete model id used in the cycle manifest and packets.

This development constraint governs repository validation and forward tests.
The publishable runtime may present model options to end users and record a
user-selected model, provided the manifest preserves the presented option set,
the selection rule, and the exact selected model, and validators distinguish
development-constrained runs from user-selected runtime runs.

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
capabilities. Public runtime model choice is tracked separately so user-selected
runs remain inspectable without being mistaken for governed development forward
tests.

## Implications

- Validation scripts may reject malformed artifacts, missing fields, invalid
  phase transitions, and absent ledgers.
- Validation scripts must not claim semantic success from word matches,
  keyword counts, regex captures, or superficial label detection.
- Semantic review gates must be performed by an appropriate agent/model
  evaluator and should produce written review artifacts.
- Multi-agent cognitive-cycle tests must configure P1, P2, P3, P4, and
  same-phase integration agents with the latest available `gpt-*.*-mini`
  variant.
- Runtime tests may exercise explicit user-selected model plumbing, but those
  tests do not certify governed development-cycle semantic quality unless they
  use the latest available `gpt-*.*-mini` model variant.
- Non-cognitive structural automation may use ordinary deterministic tooling.
