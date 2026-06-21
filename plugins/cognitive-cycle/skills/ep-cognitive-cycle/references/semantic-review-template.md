# Semantic Review Template

Use this template when reviewing a packet or integrated packet. This is a model
or agent judgment artifact, not a deterministic structural check.

```markdown
# Semantic Review: <packet-id-or-set>

## Reviewer

- reviewer:
- model: gpt-5.x-mini
- date:
- cycle_id:
- packet(s):

## Review Scope

- phase:
- orienting question:
- implicit unknown:
- source scope:

## Semantic Judgment

Accepted, rejected, or needs repair:

## Reasons

- Evidence relevance:
- Phase discipline:
- Grounding quality:
- Sufficiency for handoff:
- Uncertainty handling:
- Authority/mode handling, if applicable:

## Repair Requirements

List exact changes required before downstream routing.

## Residual Risk

Name what remains uncertain even after acceptance.
```

Do not use this template as a heading checklist. The reviewer must explain why
the packet is or is not adequate for the next cognitive operation.
