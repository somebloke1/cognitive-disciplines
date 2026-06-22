# Operating Norms For The Cognitive Cycle Plugin Effort

## Governance First

Every major implementation pass should be grounded in:

- an accepted decision;
- an active intention;
- a task record;
- resolved or explicitly carried open questions;
- a GitHub issue or PR when the work is externally visible.

## Artifact-First Development

The plugin must be developed from durable artifacts, not transient chat state.
Use written manifests, packet templates, acceptance gates, controller ledgers,
and verification records.

## Harness Before Prompting

The noetic-pi extraction showed that behavior reinforcement came from curriculum
plus harness mechanics. The plugin should therefore implement:

- staged role priming;
- required grounding artifacts;
- phase legality;
- ordered packet archives;
- acceptance/rejection gates;
- recursion contracts;
- downstream routing rules.

Prompt text alone is not enough.

## Semantic Evaluation Boundary

Pattern matching, regex, keyword counts, and superficial label checks may only
verify structure. They must not be used to evaluate the meaning or quality of
language-model generated cognitive work.

Semantic acceptance requires model or agent judgment. For structured JSON,
validate structure deterministically and evaluate the contents semantically.

Agents performing cognitive cycles during development must use the latest
available `gpt-*.*-mini` model variant. The controller must identify the current
available model set and record the selected concrete model id.
Published runtime cycles may record a user-selected model when the user is
choosing from presented options; do not treat those user-selected runtime runs
as governed development forward tests unless they still use the latest available
GPT mini variant.

## GitHub Surface

Use GitHub issues and the `cognitive-disciplines-project` project board for
externally visible tracking. Use PRs for implementation milestones once commits
need review or integration.

## Research Surfaces

Use Context7 or web_search when current external documentation, plugin-format
details, library behavior, or API behavior is needed. Record research artifacts
when the result affects plugin design.

## Completion Discipline

Do not mark the persistent goal complete until current evidence proves:

- governance norms are established and committed;
- the cognitive discipline is transformed into a Codex plugin;
- plugin structure is valid;
- plugin behavior is harnessed by artifacts and acceptance gates;
- tests or validation runs cover the required behavior;
- GitHub issue/PR/project tracking reflects the work.
