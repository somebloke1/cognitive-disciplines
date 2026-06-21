---
name: graphql-efficiency-strategist
description: Use when designing, reviewing, or executing GraphQL queries and mutations where efficiency, rate limits, pagination, GitHub ProjectV2 coordination, or dashboard synchronization matters. Covers query shaping, field minimization, connection pagination, no-op suppression, batching, rate-limit evidence, and safe GraphQL mutation planning.
---

# GraphQL Efficiency Strategist

Use this skill before broad GraphQL reads, repeated dashboard scans, large
mutation runs, GitHub ProjectV2 automation, or any task where GraphQL budget,
secondary rate limits, latency, or over-fetching could distort the work.

## Core Stance

GraphQL efficiency is not just fewer requests. It is fewer better-shaped
requests with explicit evidence that the data needed for the decision was
actually retrieved.

Prefer:

- narrow fields over generic object dumps;
- server-side filtering over client-side filtering after broad reads;
- paginated completeness over assuming the first page is complete;
- REST or native APIs for resource state when GraphQL-specific fields are not
  needed;
- no-op-free mutation plans over blind updates;
- bounded batches over unbounded fan-out;
- targeted readback over full-board refreshes.

## Before Querying

Establish:

- the decision the query must support;
- the minimum object types and fields needed;
- whether REST or another API is cheaper and more direct;
- whether the result can be scoped by owner, repository, label, status, date,
  query string, or known IDs;
- expected cardinality and pagination needs;
- current rate-limit evidence if the operation may be large.

Do not run broad exploratory GraphQL queries when a narrow read can answer the
same question.

## Query Shaping

Use this pattern:

1. Ask for IDs and stable keys first.
2. Add only fields needed for the current decision.
3. Keep nested connections shallow.
4. Page every connection that can exceed the requested `first` count.
5. Include `pageInfo { hasNextPage endCursor }` on each paginated connection.
6. Keep page sizes smaller when the query touches many nested connections.
7. Treat `REDACTED`, null, or missing content as a permission/readback limit, not
   as proof that the item does not exist.

Avoid:

- requesting `body`, comments, reviews, labels, project fields, and timelines in
  one query unless all are necessary;
- nested `first:100` connections under other `first:100` connections;
- repeating schema/field discovery in every loop iteration;
- querying full project boards when a single item or status slice is needed.

## Pagination Discipline

For each connection:

- request `nodes` only when edge metadata is unnecessary;
- request `edges` only when cursor-per-edge metadata is needed;
- continue until `hasNextPage` is false;
- preserve cursors in local artifacts when a long read may need continuation;
- do not claim complete coverage from one page unless the total count is known
  and fits the requested page size.

## Rate-Limit Evidence

When budget matters, capture explicit evidence:

```sh
gh api rate_limit --jq '{core:.resources.core, graphql:.resources.graphql}'
gh api graphql -f 'query=query { rateLimit { cost remaining resetAt } }'
```

Use the evidence to decide whether to:

- proceed;
- reduce fields or page size;
- use REST for substantive issue/PR reads;
- defer dashboard mutation and continue source work;
- split mutation batches.

Do not use rate-limit avoidance as an excuse to skip required evidence. Reduce
query shape first.

## Mutation Planning

Before mutating:

1. Read the current state for the specific objects to be changed.
2. Resolve required IDs once: project ID, item IDs, field IDs, option IDs, node
   IDs, or repository IDs.
3. Compute desired state locally.
4. Suppress no-op mutations.
5. Build a bounded mutation plan.
6. Apply only after the plan is reviewed or the user has already authorized that
   class of mutation.
7. Read back only changed items.

Aliased mutation batches are useful for several independent updates:

```graphql
mutation {
  i1: updateProjectV2ItemFieldValue(input: {
    projectId: "PROJECT_ID"
    itemId: "ITEM_ID"
    fieldId: "FIELD_ID"
    value: { singleSelectOptionId: "OPTION_ID" }
    clientMutationId: "set-item-state"
  }) { projectV2Item { id } }
}
```

Treat aliases as efficiency, not transactionality. Each alias can fail or
succeed independently.

Use bounded batches, usually 5-10 aliases, when mutating project fields. Avoid
concurrent mutation jobs against the same dashboard.

## GitHub ProjectV2 Rules

For GitHub ProjectV2 work:

- Cache project ID, field IDs, item IDs, and single-select option IDs for the
  current session.
- Refresh schema IDs only when missing, stale, or after a project schema change.
- Use `gh project item-list --query` to narrow dashboard reads.
- Use REST issue/PR APIs for issue/PR substance when Project fields are not
  needed.
- Add project items and update fields in separate calls; GitHub ProjectV2 items
  cannot be added and field-updated in the same API call.
- Do not update native issue properties through project fields. Labels,
  assignees, milestones, issue state, PR state, and linked PR relationships
  belong to GitHub issues/PRs.
- Do not assume project workflows update custom coordination fields; read those
  fields back explicitly.

Useful commands:

```sh
gh project view PROJECT_NUMBER --owner OWNER --format json
gh project field-list PROJECT_NUMBER --owner OWNER --format json
gh project item-list PROJECT_NUMBER --owner OWNER --format json --query '-status:Done' --limit 80
gh api repos/OWNER/REPO/issues?state=open\&per_page=100
```

## Dashboard Synchronization Pattern

Dashboard to issue/PR:

1. Read a filtered dashboard slice.
2. Select items by durable fields such as status, lane, priority, owner, or
   dependency clues.
3. Open the issue or PR for substance.
4. Record durable evidence in the issue/PR or repo artifact.
5. Mutate project fields only for coordination metadata.

Issue/PR to dashboard:

1. Create or update the native issue/PR first.
2. Let configured project workflows add or move native items where possible.
3. Add the item manually only if workflow auto-add is absent or missed.
4. Update custom fields only after a durable state change.
5. Read back changed custom fields before claiming synchronization.

## Anti-Patterns

- Full-board readback after every small update.
- Per-field `item-edit` loops without a local no-op plan.
- Querying the same schema and option IDs repeatedly inside one turn.
- Treating GraphQL aliases as an atomic transaction.
- Using Project fields as substitutes for issue labels or PR links.
- Ignoring pagination because the first page looked plausible.
- String-parsing generated prose to decide semantic project state.
- Running dashboard mutations while the substantive issue/PR evidence is stale.

## Output Checklist

When asked for a GraphQL efficiency plan, return:

- decision to support;
- query/mutation scope;
- API choice: GraphQL, REST, CLI, or mixed;
- fields and connections to request;
- pagination strategy;
- rate-limit evidence needed;
- mutation plan and no-op suppression rule;
- readback strategy;
- residual risks or permissions limits.
