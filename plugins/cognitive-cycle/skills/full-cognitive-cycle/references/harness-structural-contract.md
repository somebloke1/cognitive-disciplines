# Harness Structural Contract

Use this reference when a cycle needs durable local artifacts, team routing, or
legion-scale repeated passes.

## Archive Shape

Initialize a run archive with:

```bash
python3 <PLUGIN_ROOT>/scripts/init_cycle_run.py \
  --cycle-id <id> \
  --orienting-question "<question>" \
  --implicit-unknown "<unknown>" \
  --mode recommend-only \
  --scale team \
  --source-scope repo:docs/architecture.md \
  --recursion-budget 2 \
  --available-agent-model gpt-5.4-mini \
  --available-agent-model gpt-5.5
```

If the user selects one of the presented models, also pass
`--selected-agent-model <model-id>`. If no `--available-agent-model` arguments
are supplied, the initializer uses `COGNITIVE_CYCLE_AVAILABLE_MODELS`.

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

Before phase work begins, the controller presents available model options to the
user. The manifest records those candidates and the selected concrete model id
under `agent_model_policy`, with `user_selectable: true` and `exclusive: true`.
Packets and semantic reviews must record that selected concrete model id.

If the user does not select a model, the initializer defaults to the latest
available `gpt-*.*-mini` model and records `selection_rule:
latest-available-gpt-mini`. If the user selects a model, the initializer records
`selection_rule: user-selected` and the selected model must be one of the
presented options.

## Path Authority

The manifest records symbolic-root path authority under `path_authority`.
Public packet references should use symbolic refs such as `plugin:...`,
`repo:...` and `archive:...`. Use `skill:...` in durable packets only when the
manifest declares a `skill` root. Runtime manifests may include resolved
absolute paths for auditability, but packets should keep symbolic refs as the
portable authority.

## Structural Validation

Validate an archive with:

```bash
python3 <PLUGIN_ROOT>/scripts/validate_cycle_artifacts.py <archive>
```

The validator checks deterministic structure only:

- required manifest keys;
- valid mode and scale values;
- required packet headers;
- phase-specific packet fields;
- P3 outcome legality;
- same-phase integration cardinality when `manifest.agent_sets` is present;
- required model-policy fields;
- packet model equality with the manifest-selected cycle model;
- required path-authority fields;
- symbolic source-scope and evidence-anchor shape;
- semantic-review reference shape, existence for non-pending reviews, and
  selected model match when a review artifact exists;
- same-phase focal-emphasis fields;
- route/complete-stage acceptance requirements when requested.

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
packet `semantic_review.review_ref` using `archive:semantic-reviews/<file>.md`.
A review artifact should state:

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
- `focal_emphasis`
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
