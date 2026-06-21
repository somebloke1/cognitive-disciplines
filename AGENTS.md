# Cognitive Disciplines Agent Guide

## Governing Context

This repository is being developed into a full-fledged Codex plugin for a
harnessed P1-P4 cognitive cycle. Work must proceed from the governed baseline
rather than ad hoc edits.

Before major work, read:

- @governance/mission.md
- @governance/README.md
- @governance/decisions/0001-operate-as-governed-plugin-controller.md
- @governance/decisions/0002-semantic-evaluation-and-cycle-agent-model.md
- @governance/intentions/0001-develop-practices-and-norms-first.md
- @governance/operating-norms.md
- @governance/github-project-dashboard.md
- @governance/open_questions/0001-plugin-format-and-installation-target.md
- @governance/open_questions/0002-gpt-5-x-mini-forward-test-availability.md
- @governance/tasks/0002-plugin-scaffold-and-install.md
- @governance/tasks/0003-gpt-mini-forward-test.md

## GitHub Project Surface

Use GitHub Project #7 as the external coordination dashboard:

- @skills/github-project-agent-coordination/SKILL.md
- @skills/graphql-efficiency-strategist/SKILL.md

Issues and PRs are authoritative for substantive work. The dashboard is for
coordination state, lane, priority, risk, effort, ownership, and dependencies.

## Curriculum And Harness Evidence

The noetic curriculum/harness extraction is the evidence base for strengthening
the plugin beyond superficial prompt labels:

- @planning/noetic-curriculum-extraction/2026-06-21/README.md
- @planning/noetic-curriculum-extraction/2026-06-21/processing-plan.md
- @planning/noetic-curriculum-extraction/2026-06-21/agent-reports/extractor-reports.md

Do not paste raw source wholesale into runtime instructions. Compress it into
specialist priming, staged grounding artifacts, packet templates, acceptance
gates, recursion contracts, and controller transition rules.

## Development Order

1. Preserve governance and project tracking.
2. Resolve the plugin format and installation target.
3. Scaffold a valid Codex plugin.
4. Package the cognitive cycle skills and resources.
5. Add artifact-first harness mechanics.
6. Validate with skill checks and at least one dry run that rejects or repairs
   weak packets.
7. Commit, push, and open PRs for reviewable milestones.

## Local Discipline

- Do not mark work complete from plausible prose; verify from current files,
  commands, tests, GitHub issue/PR state, and project dashboard readback.
- Keep deterministic harness mechanics separate from language-model cognitive
  judgment.
- Never use regex or pattern matching to evaluate language-model semantics.
  Structural checks may be deterministic; semantic checks require agent/model
  judgment. For structured JSON, validate structure deterministically and judge
  meaning separately.
- During development, agents performing cognitive cycles must use the latest
  available `gpt-*.*-mini` model variant. Identify the current available model
  set, select the highest-version GPT mini model, and record the concrete model
  id in the manifest and packets.
- Use Context7 or web_search when current external documentation or API behavior
  matters.
- Avoid broad GitHub Project GraphQL scans; use targeted reads, cached IDs, and
  no-op-free mutations.
