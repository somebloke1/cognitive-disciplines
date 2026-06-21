# GitHub Project Dashboard

## Dashboard

- Project: `cognitive-disciplines-project`
- URL: https://github.com/users/somebloke1/projects/7
- Project number: `7`
- Project id: `PVT_kwHOAB3SEM4BbPBG`
- Repository: `somebloke1/cognitive-disciplines`

This dashboard is the external coordination surface for governed plugin work.
Issues and PRs remain the source of substantive requirements, discussion,
evidence, and review. The Project board coordinates cross-object state.

## Current Workflows

Verified with `gh api graphql` and `gh project` on 2026-06-21. GitHub exposes
workflow names and enabled state through the API, but not the full internal rule
body. Treat the workflow names as observed evidence and the behavior below as
cautious operational interpretation unless confirmed in the GitHub UI.

Enabled workflows:

- `Auto-add sub-issues to project`
- `Auto-close issue`
- `Item added to project`
- `Item closed`
- `Pull request linked to issue`
- `Pull request merged`

There are no repository GitHub Actions workflows in `.github/workflows` at this
time.

## Field Ownership

Workflow-owned or native fields:

- `Status`
- `Title`
- `Assignees`
- `Labels`
- `Linked pull requests`
- `Milestone`
- `Repository`
- `Reviewers`
- `Parent issue`
- `Sub-issues progress`
- `Created`
- `Updated`
- `Closed`

Agent-owned coordination fields:

- `Agent state`
- `Agent owner`
- `Lane`
- `Priority`
- `Risk`
- `Effort`
- `Complexity`
- `Dependency clues`

Do not assume the built-in workflows update agent-owned fields. Read those
fields back before claiming a lease is cleared, work is ready, or an item is
fully done.

## Dashboard To Issue/PR Flow

Use this flow when selecting work from the dashboard:

1. Read Project #7, preferably with a filtered query rather than a full board
   scan.
2. Select candidate items by `Status`, `Agent state`, `Lane`, priority, risk,
   and dependency clues.
3. Open the native issue or PR for the substantive requirement.
4. Record durable evidence in the issue, PR, or repo artifact.
5. Mutate Project fields only for coordination metadata.

Project fields should not become a second issue body.

## Issue/PR To Dashboard Flow

Use this flow when work begins from an issue, PR, or local repo task:

1. Create or update the native issue/PR first.
2. Let configured Project workflows add or move items where possible.
3. Manually add the issue/PR to Project #7 only when auto-add does not apply or
   has missed the item.
4. Set agent-owned fields only after durable state changes.
5. After close or merge, read back agent-owned fields and clear or mark them
   done if needed.

## Current Baseline Item

Issue #4 records the first decision and intention for the persistent plugin
goal:

- https://github.com/somebloke1/cognitive-disciplines/issues/4
- `Status`: `In progress`
- `Lane`: `Governance`
- `Priority`: `high`
- `Risk`: `Med`
- `Effort`: `Medium`
- `Agent state`: `Active`

## GraphQL Discipline

ProjectV2 reads and writes are GraphQL-backed. Use
`skills/graphql-efficiency-strategist` and
`skills/github-project-agent-coordination` before broad dashboard scans,
multi-field updates, or automation work.

Baseline rules:

- Cache project, item, field, and option IDs within a work session.
- Use REST issue/PR APIs for substantive issue and PR state.
- Suppress no-op mutations.
- Prefer targeted readback of changed items over full-board refresh.
- Use bounded aliased GraphQL mutation batches only for larger update sets.
- If GraphQL budget is low, preserve the intended Project action in issue or
  goal state and continue source work that does not need dashboard mutation.
