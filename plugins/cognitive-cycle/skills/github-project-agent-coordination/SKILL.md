---
name: github-project-agent-coordination
description: Use when coordinating cognitive-disciplines work through GitHub issues, pull requests, or GitHub Project #7. Covers dashboard readback, issue/PR/project synchronization, project field semantics, workflow-owned versus agent-owned fields, and GraphQL budget-efficient ProjectV2 reads and mutations.
---

# GitHub Project Agent Coordination

Use GitHub Project #7, `cognitive-disciplines-project`, as the external
coordination dashboard for this repository. The board tracks issues, pull
requests, and durable roadmap items. It is not a replacement for issue bodies,
PR bodies, source files, governance records, evidence ledgers, or tests.

Project dashboard:

- <https://github.com/users/somebloke1/projects/7>
- Project id: `PVT_kwHOAB3SEM4BbPBG`
- Repository: `somebloke1/cognitive-disciplines`

## Core Rules

- Read Project #7 during goal re-entry before choosing or confirming the current
  subgoal when the work involves governance, issues, PRs, or dashboard state.
- Treat issues, PRs, repo files, tests, runtime probes, and governance artifacts
  as authoritative for substance.
- Use the project board for cross-object coordination, status visibility, and
  agent work selection.
- Respect configured GitHub Project workflows. Do not duplicate project items or
  fight workflow-owned status transitions.
- Update custom agent fields only after durable state changes, not for transient
  thoughts during a turn.
- Keep mutations idempotent: read the item and field IDs first, compute a local
  no-op-free plan, and update only intended fields.
- Use REST issue/PR APIs for substantive issue and PR state when Project fields
  are not needed.

## Field Semantics

Workflow-owned fields:

- `Status`: coarse lifecycle state. Leave normal issue/PR transitions to GitHub
  Project workflows unless repairing a proven miss.
- `Linked pull requests`, `Closed`, `Created`, `Updated`, `Repository`,
  `Labels`, `Milestone`, `Parent issue`, and `Sub-issues progress`: native
  GitHub relationships or timestamps. Maintain the source object, not a project
  field workaround.

Agent-owned fields:

- `Agent state`: agent-facing coordination state.
- `Agent owner`: stable lease owner such as `codex-thread:<id>` or
  `codex-agent:<id>`.
- `Lane`, `Priority`, `Risk`, `Effort`, `Complexity`, and `Dependency clues`:
  planning metadata for durable work selection and sequencing.

Do not infer that custom agent fields are current merely because `Status`
changed. Read them back before claiming a lease is retired or work is ready.

## Project Values

`Status` values:

- `Todo`: open item added to project, not actively underway.
- `In progress`: issue or PR is active, linked, reopened, or under review.
- `Done`: issue or PR is closed or merged.

`Agent state` values:

- `Candidate`: plausible future work, not selected now.
- `Ready`: prepared enough to pick up without broad rediscovery.
- `Active`: current SuperLoop/subgoal work.
- `Blocked`: cannot advance without approval, external state, or a concrete
  prerequisite.
- `Pre Review`: packaged but not yet under review.
- `In Review`: source or plan is in review, merge, or acceptance flow.
- `Done`: completed with durable evidence.
- `Deferred`: intentionally later-phase work.

`Lane` values are inherited from the project schema. For this repo, prefer:

- `Governance`: decisions, intentions, open questions, norms, and operating
  policy.
- `Coordination`: issue, PR, Project, and SuperLoop orchestration.
- `Evidence`: extraction bundles, research records, proof artifacts, and claim
  discipline.
- `Readiness`: acceptance gates and activation readiness.
- `Tool guidance`: skills, plugin guidance, and tool-use instructions.
- `Contract artifacts`: packet schemas, manifests, templates, and validation
  contracts.

Use other lane values only when they are a better fit than these.

## Configured Project Workflows

Verified with `gh api graphql` on 2026-06-21. GitHub exposes workflow names and
enabled state through the API, but not full internal rule details. Treat names as
authoritative evidence and rule effects as cautious inference unless verified in
the GitHub UI.

Enabled workflows:

- `Auto-add sub-issues to project`
- `Auto-close issue`
- `Item added to project`
- `Item closed`
- `Pull request linked to issue`
- `Pull request merged`

Operational consequences:

- When an issue or PR is added, expect `Status` to become `Todo`.
- When a PR links to an issue, expect issue/PR project state to move toward
  active work.
- When a PR merges or an item closes, expect `Status` to become `Done`.
- When `Status` is set to `Done`, the `Auto-close issue` workflow may close the
  issue.
- Do not assume built-in workflows update `Agent state`, `Agent owner`,
  `Lane`, `Priority`, or other custom fields.

## Dashboard To Issue/PR Flow

Use dashboard state to select and coordinate work:

1. Read Project #7 item list and fields.
2. Select items by `Status`, `Agent state`, `Lane`, priority, and dependencies.
3. Open the native issue or PR for substance.
4. Update the issue/PR body or comments for durable evidence, decisions, and
   acceptance criteria.
5. Use project fields only for coordination metadata.

If a project item is a roadmap draft, promote it to a real issue only when it
has selected bounded work, acceptance criteria, and an evidence plan.

## Issue/PR To Dashboard Flow

Use native GitHub objects as the source of lifecycle truth:

1. Create or update the issue/PR with the substantive work.
2. Let project workflows add native items and update workflow-owned `Status`
   where possible.
3. Add the issue/PR to Project #7 manually only if workflow auto-add does not
   apply or is not configured.
4. Set custom fields manually when they express durable agent coordination.
5. After merge or close, read back custom fields and clear or mark them done if
   needed.

## GraphQL Budget Discipline

GitHub Project v2 reads and writes are GraphQL-backed. Repeated broad
`gh project field-list`, `gh project item-list --limit 100`, per-field
`item-edit`, and full-board readback loops can exhaust the hourly GraphQL budget
before useful work is done.

Use this rate-aware pattern:

- Cache the Project ID, item IDs, field IDs, and single-select option IDs for
  the current session or goal turn.
- Refresh field IDs only when missing, stale, or after the project schema
  changed.
- At re-entry, take at most one project snapshot unless board work is the
  current subgoal.
- Prefer filtered reads such as `gh project item-list 7 --owner somebloke1
  --query '-status:Done'` over full-board scans.
- Use REST-backed issue/PR reads for substance:
  `gh api repos/somebloke1/cognitive-disciplines/issues?state=open&per_page=100`.
- Compute updates locally and skip no-op mutations.
- For one or two field updates, `gh project item-edit` is acceptable.
- For larger multi-item or multi-field updates, use a direct aliased GraphQL
  mutation batch after computing a no-op-free plan.
- Treat aliased mutation batches as efficiency tactics, not transactions; each
  alias can succeed or fail independently.
- Use bounded mutation batches, typically 5-10 aliases.
- Avoid concurrent Project mutation runs.
- Avoid per-item readback; do one targeted readback for changed item IDs.
- When reading Project pages directly through GraphQL, follow `pageInfo` cursors
  until `hasNextPage` is false. Do not assume one `first:100` page is complete.
- Treat `REDACTED` item content as a permission/readback limitation, not as an
  absent item.
- GitHub Project v2 items cannot be added and field-updated in the same API
  call. Add the item first, then update fields.
- Use `gh api rate_limit --jq '{core:.resources.core, graphql:.resources.graphql}'`
  or `query { rateLimit { cost remaining resetAt } }` when budget evidence is
  needed.
- If remaining GraphQL budget is low, preserve the pending Project action in the
  goal or issue and continue source/test work that does not require Project
  mutation.

Example aliased mutation shape:

```graphql
mutation {
  i4: updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHOAB3SEM4BbPBG"
    itemId: "PROJECT_ITEM_ID"
    fieldId: "FIELD_ID"
    value: { singleSelectOptionId: "OPTION_ID" }
    clientMutationId: "agent-state-4-active"
  }) { projectV2Item { id } }
}
```

## Useful Commands

```sh
gh project view 7 --owner somebloke1 --format json
gh project field-list 7 --owner somebloke1 --format json
gh project item-list 7 --owner somebloke1 --format json --limit 100
gh project item-list 7 --owner somebloke1 --format json --query '-status:Done' --limit 80
gh api repos/somebloke1/cognitive-disciplines/issues?state=open\&per_page=100
gh api rate_limit --jq '{core:.resources.core, graphql:.resources.graphql}'
```

To update a single-select value, resolve the project ID, item ID, field ID, and
option ID from readback, then run:

```sh
gh project item-edit \
  --project-id PVT_kwHOAB3SEM4BbPBG \
  --id PROJECT_ITEM_ID \
  --field-id FIELD_ID \
  --single-select-option-id OPTION_ID
```

## Current Project #7 Snapshot

Last verified on 2026-06-21:

- Issue #4 is on Project #7.
- Issue #4 has `Status: In progress`, `Lane: Governance`,
  `Priority: high`, `Risk: Med`, `Effort: Medium`, and
  `Agent state: Active`.
- No repository GitHub Actions workflows exist yet under `.github/workflows`.
