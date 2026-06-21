# Harness Structural Contract

Use this reference when a cycle needs durable local artifacts, team routing, or
legion-scale repeated passes.

## Archive Shape

Initialize a run archive with:

```bash
python3 plugins/cognitive-cycle/scripts/init_cycle_run.py \
  --cycle-id <id> \
  --orienting-question "<question>" \
  --implicit-unknown "<unknown>" \
  --mode recommend-only \
  --scale team \
  --source-scope <path-or-url> \
  --recursion-budget 2
```

The script creates:

- `manifest.json`
- `packets/`
- `ledgers/recursions.jsonl`
- `ledgers/decisions.jsonl`
- `ledgers/archive-index.jsonl`
- `registers/contradictions.jsonl`
- `registers/duplicates.jsonl`
- `registers/open-uncertainties.jsonl`
- `registers/scope-decomposition.jsonl`
- `semantic-reviews/`

## Model Policy

During development, all agents performing cognitive-cycle phases or same-phase
integration must use:

```text
gpt-5.x-mini
```

The manifest records this as `agent_model_policy.cognitive_cycle_agents` with
`exclusive: true`. Packets must record `agent_model: "gpt-5.x-mini"`.

## Structural Validation

Validate an archive with:

```bash
python3 plugins/cognitive-cycle/scripts/validate_cycle_artifacts.py <archive>
```

The validator checks deterministic structure only:

- required manifest keys;
- valid mode and scale values;
- required packet headers;
- phase-specific packet fields;
- P3 outcome legality;
- same-phase integration cardinality when `manifest.agent_sets` is present;
- required model-policy fields;
- presence and status shape of semantic-review references.

It does not evaluate whether a P1 packet attended well, a P2 packet generated
genuine alternatives, a P3 packet judged responsibly, or a P4 packet made the
right decision.

## Semantic Evaluation Boundary

Regex, keyword matching, and pattern matching are unsuitable for evaluating
language-model generated semantics. Use them only for structural checks.

For structured JSON, validate the JSON shape deterministically and evaluate the
meaning with model or agent judgment. A packet can be structurally valid and
semantically weak.

Semantic review artifacts should live under `semantic-reviews/` and be linked by
packet `semantic_review.review_ref`. A review artifact should state:

- reviewer;
- model;
- packet or packet set reviewed;
- semantic judgment;
- repair requirements or acceptance rationale;
- residual risk.

## Packet JSON Profile

When a durable archive is required, write each packet as JSON under `packets/`.
Every packet must include:

- `packet_id`
- `cycle_id`
- `phase`
- `pass`
- `owner`
- `agent_model`
- `orienting_question`
- `implicit_unknown`
- `source_scope`
- `input_packets`
- `evidence_anchors`
- `uncertainties`
- `handoff_target`
- `semantic_review`

Use the phase sections in
[cognitive-cycle-packet-contract.md](cognitive-cycle-packet-contract.md) for the
phase-specific fields.
