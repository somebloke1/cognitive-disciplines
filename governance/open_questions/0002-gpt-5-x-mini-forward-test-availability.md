# Open Question 0002: Dynamic Mini-Model Forward-Test Availability

## Status

Answered for the current subagent surface.

## Question

How should the controller run fresh-context behavioral validation of the
installed cognitive-cycle plugin while dynamically selecting the latest
available `gpt-*.*-mini` model variant from the current subagent surface?

## Context

The plugin is installed and enabled locally as `cognitive-cycle@personal`.
Structural validation passed for both the repo source and installed cache.

However, a behavioral forward test of `ep-cognitive-cycle` would itself be a
cognitive-cycle run. Under decision 0002, agents performing cognitive cycles
must use the latest available `gpt-*.*-mini` model variant. The controller must
identify the current available model set and record the selected concrete model
id in the archive.

## Linked Tracking

- GitHub issue: https://github.com/somebloke1/cognitive-disciplines/issues/7
- PR carrying current scaffold: https://github.com/somebloke1/cognitive-disciplines/pull/6

## Candidate Resolutions

- Identify the latest `gpt-*.*-mini` model from the current subagent model list.
- Run the forward test using that selected concrete model id.
- Define a non-agent deterministic smoke test as a separate structural check,
  while keeping semantic/cognitive forward testing pending.

## Resolution

The controller identified the current available subagent model set as:

- `gpt-5.5`
- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5.3-codex-spark`

The only model matching `gpt-*.*-mini` was `gpt-5.4-mini`, so it was selected as
the latest available mini variant for this surface.

A fresh-context worker was dispatched with `model: gpt-5.4-mini`. It produced a
durable forward-test archive at:

`planning/forward-tests/2026-06-21-gpt-mini-forward-test/`

The archive records the available model set and selected concrete model in
`manifest.json`, includes P1/P2/P3/P4 packets, and validates structurally with:

```bash
python3 plugins/cognitive-cycle/scripts/validate_cycle_artifacts.py \
  planning/forward-tests/2026-06-21-gpt-mini-forward-test --json
```

Result: valid.

## Non-Resolution

Do not substitute a non-mini model and claim the result validates the
model-constrained cognitive-cycle behavior.
