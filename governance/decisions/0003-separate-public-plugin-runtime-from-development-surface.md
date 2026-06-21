# Decision 0003: Separate Public Plugin Runtime From Development Surface

## Status

Accepted.

## Decision

The publishable `cognitive-cycle` plugin must contain only the reusable
cognitive-cycle runtime: P1-P4 skills, same-phase integration skills, packet
contracts, curriculum-compressed priming references, semantic review templates,
and structural harness scripts.

Repository-development artifacts remain in the repository but must not be
bundled as public plugin runtime content. This includes `AGENTS.md`, local
governance ledgers, GitHub Project coordination skills, GraphQL dashboard
efficiency guidance, planning extraction records, issue/PR operating notes, and
other materials whose purpose is to develop this repository rather than operate
a generic cognitive cycle.

## Rationale

The plugin is intended to be reusable agent-cognition infrastructure. Shipping
repo-specific coordination guidance would blur the boundary between:

- deterministic harness mechanics and reusable cognitive discipline;
- project-local development governance and public runtime behavior;
- generic multi-agent P1-P4 orchestration and this repository's GitHub Project
  workflow.

Keeping the runtime pure makes the plugin easier to publish, install, audit, and
use outside this repository.

## Implications

- Development-only skills may remain under root `skills/` when they support this
  repository's project work.
- The plugin bundle under `plugins/cognitive-cycle/` must not include
  repository-specific GitHub Project or GraphQL coordination skills.
- Manifest metadata must describe only bundled public runtime capabilities.
- Tests should guard against accidental reintroduction of development-only
  coordination skills into the publishable plugin package.
