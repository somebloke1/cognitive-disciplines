# Open Question 0002: gpt-5.x-mini Forward-Test Availability

## Status

Open.

## Question

How should the controller run fresh-context behavioral validation of the
installed cognitive-cycle plugin when cognitive-cycle agents are required to use
`gpt-5.x-mini` only, but the currently exposed subagent model override list does
not include `gpt-5.x-mini`?

## Context

The plugin is installed and enabled locally as `cognitive-cycle@personal`.
Structural validation passed for both the repo source and installed cache.

However, a behavioral forward test of `ep-cognitive-cycle` would itself be a
cognitive-cycle run. Under decision 0002, agents performing cognitive cycles
must use `gpt-5.x-mini` only. The available subagent model override list exposed
in this thread did not include that model, so a compliant subagent-based
forward test was not run.

## Linked Tracking

- GitHub issue: https://github.com/somebloke1/cognitive-disciplines/issues/7
- PR carrying current scaffold: https://github.com/somebloke1/cognitive-disciplines/pull/6

## Candidate Resolutions

- Expose `gpt-5.x-mini` as an available subagent model override.
- Run the forward test in a future Codex environment where the installed plugin
  and required model are both available.
- Define a non-agent deterministic smoke test as a separate structural check,
  while keeping semantic/cognitive forward testing pending.

## Non-Resolution

Do not substitute a different model and claim the result validates the
model-constrained cognitive-cycle behavior.
