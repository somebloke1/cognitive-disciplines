# Plan: Convert noetic-pi P1-P4 Cognitive Discipline into Codex Skills

Tracking: https://github.com/somebloke1/cognitive-disciplines/issues/1

## Scope and Constraint

This is a research and planning artifact only. It proposes reusable Codex skills modeled on the noetic-pi phronesis / differentiated-cognition pipeline, while preserving the difference between deterministic harness mechanics and language-model cognitive judgment.

The source project reviewed was `/home/dgk/workspace/noetic-pi`. The local target project is `/home/dgk/workspace/cognitive-disciplines`.

## Executive Finding

noetic-pi treats P1-P4 as a disciplined cognitive pattern, not as decorative phase labels. The method sources define the pattern as recursive cognition: P1 attends, P2 inquires, P3 judges and can recurse, and P4 decides in a mode-bounded way. The APM phronesis harness then objectifies that discipline as a stateful multi-agent pipeline: it creates a cycle, spawns role-specialized agents, gates each agent through grounding curriculum, forwards accumulated content, accepts atomic submissions, permits bounded recursion to earlier phases, records feedback and alignment rationales, enforces terminal states, and archives the full record.

Codex skills cannot directly reproduce noetic-pi's APM-level enforcement without a runtime service. They can, however, preserve the cognitive discipline by making each skill carry its own role boundaries, evidence contract, output shape, recursion triggers, and coordination protocol. A full-cognition orchestration skill should supply the "soft harness" that noetic-pi supplies deterministically: sequence control, handoff packets, sufficiency checks, and escalation when the controller should recurse or split work among agents.

## Evidence Reviewed

Foundational cognitive sources:

- `.method/imperatives.md` defines `R(P1 -> P2 -> P3 -> P4 -> R)` and gives each phase a distinct operation: high-fidelity attention, possibility generation, judgment, and responsible declaration.
- `.method/constitution.md` frames the pattern as a conditioned scheme of recurrence: later operations depend on earlier ones, and each operation conditions the next.
- `ROOT_PROMPT.md` maps P1-P4 to operational imperatives, explicitly says the pattern can be enacted through phronesis, and lists the root-facing differentiated-cognition tools.

Prompt and curriculum sources:

- `.method/prompts/phronesis-overview.md` explains the whole P1-P4 cycle, content flow, recursion, and APM responsibilities.
- `.method/prompts/phronesis-p1.md` gives P1 a strict "describe before interpreting" contract.
- `.method/prompts/phronesis-p2.md` requires 3-7 structurally distinct possibilities grounded in P1, with assumptions and differentiating evidence.
- `.method/prompts/phronesis-p3.md` makes P3 the critical pivot: judge evidence, recurse to P1 or P2 when insufficient, or advance to P4.
- `.method/prompts/phronesis-p4.md` makes P4 a mode-bounded decision operation: `recommend-only`, `decision-only`, or `decide-and-enact`.
- `.method/curricula/differentiated-cognition.json` supplies operation-specific grounding over emergent probability, emergent fidelity, and development.

APM harness sources:

- `packages/apm/src/phronesis.ts` defines the phronesis state and initiation path. It validates modes, assigns per-operation model tiers, records active disciplines, persists the cycle, and spawns P1.
- `packages/apm/src/phronesis-grounding-protocol.ts` gates each P-agent through role acknowledgment and grounding curriculum before active work. It rejects out-of-sequence calls and injects P4 mode constraints.
- `packages/apm/src/phronesis-progression-engine.ts` stores P-agent payloads, advances P1 -> P2 -> P3 -> P4, supports recall, permits recursion only from P2-P4 to prior operations, enforces a recursion limit, and completes/archive on P4 submission.
- `packages/apm/src/phronesis-agent-lifecycle.ts` gives P1-P4 role labels, spawns lifecycle-backed agents with structured initiative params, recalls existing agents, and retires P-agents on completion or abort.
- `packages/apm/src/phronesis-content-archive.ts` stores accumulated content in `phronesis_content`, formats prior outputs for later agents, computes pass numbers, writes `.phronesis` indexes, and writes terminal archives.
- `packages/apm/src/curriculum.ts` implements the generic curriculum harness, including epistemic-horizon fields `orientingQuestion` and `implicitUnknown`.
- `.pi/extensions/heuristic-discipline.ts` exposes the root-facing `apply_heuristic_discipline` tool, validates `discipline_type`, `orienting_question`, `implicit_unknown`, mode, model/provider overrides, and maps differentiated cognition to `phronesis_initiate`.
- `.pi/tool-profiles.json` gives P1-P4 agents the phronesis tool profile: `phronesis_role_ack`, `phronesis_grounding_complete`, `phronesis_get_context`, `phronesis_submit`, and `phronesis_recurse`.

Proof / regression sources:

- `packages/apm/test/integration/phronesis-flow.test.ts` covers initiation, grounding, submit, phase transitions, full-cycle completion, accumulated content retrieval, recursion, recursion limit, out-of-sequence rejection, mode constraints, lifecycle spawn records, and structured context delivery rather than environment variables.
- `packages/apm/test/state-machines/graphs/phronesis.ts` models the legal state graph with compound states, terminal states, grounding self-loops, forward path, recursion paths, abort, and failure.
- `packages/apm/test/unit/curriculum.test.ts` pins curriculum stage semantics and epistemic-horizon construction.

## Deterministic Harness Mechanics vs Cognitive Judgment

Deterministic mechanics in noetic-pi:

- Persist cycle identity, operation, sub-phase, status, recursion count, timestamps, model/provider selections, current agent, and content rows.
- Validate payload shapes and reject out-of-sequence calls.
- Route P1 -> P2 -> P3 -> P4, or P2/P3/P4 -> prior operation when recursion is requested.
- Deliver grounding curriculum before active operation.
- Supply accumulated prior content to every later pass.
- Enforce mode constraints for P4.
- Enforce recursion limit and terminal states.
- Spawn, recall, notify, retire, and archive agents.

Language-model cognitive judgment:

- P1 decides what evidence is relevant enough to characterize and how to separate observation from inference.
- P2 decides which possibilities are structurally distinct, which assumptions matter, and what evidence could differentiate them.
- P3 decides whether P1/P2 are sufficient, which possibilities survive evidentiary judgment, and whether recursion is required.
- P4 decides the responsible declaration under the selected mode, including commitments, foreclosures, uncertainty, and next P1 seed.

The proposed Codex skills should not pretend to enforce what only a runtime harness can enforce. They should instead encode cognitive contracts, output schemas, handoff discipline, and controller checklists so a single Codex agent, a small team, or a large agent population can approximate the harness faithfully.

## Proposed Skill Set

### 1. `ep-p1-attend`

Purpose: Characterize what is given with high fidelity.

Core contract:

- Read source materials before interpretation.
- Separate observation, absence, inference, uncertainty, and source gaps.
- Preserve concrete evidence: files, commands, outputs, traces, dates, constraints, and contradictions.
- Avoid ranking, recommendation, or solution design except as explicitly marked inference to hand off to P2.

Expected output:

- Given data map.
- Source/evidence inventory.
- Absences and unknowns.
- Candidate significance signals for P2.
- Risks of P1 insufficiency.

### 2. `ep-p2-inquire`

Purpose: Generate grounded, structurally distinct possibilities.

Core contract:

- Use P1 output as input authority.
- Generate 3-7 genuine alternatives, not surface variants.
- State assumptions for each possibility.
- Identify differentiating evidence that would let P3 judge or recurse.
- Do not rank or recommend.

Expected output:

- Possibility set with names.
- Grounding evidence from P1.
- Assumptions and differentiators.
- Uncomfortable or disruptive options.
- Missing possibility signals.

### 3. `ep-p3-judge`

Purpose: Judge sufficiency, truth, and whether recursion is required.

Core contract:

- Weigh evidence, not preference.
- Test P1 sufficiency and P2 diversity before selecting.
- Return to P1 for missing evidence or P2 for missing alternatives with precise instructions.
- Advance only when a responsible P4 decision can be grounded.

Expected output:

- Sufficiency verdict for P1 and P2.
- Evaluation of each possibility.
- Selected and rejected possibilities with evidence.
- Recursion packet if required: target, reason, required work, payload so far.
- P4 handoff if sufficient.

### 4. `ep-p4-decide`

Purpose: Declare the responsible course under explicit authority mode.

Core contract:

- Respect mode: `recommend-only`, `decision-only`, or `decide-and-enact`.
- Decide from the accumulated record and P3 judgment.
- Name commitments, foreclosed alternatives, residual uncertainty, and next P1 seed.
- Do not relitigate P3 unless a serious defect appears; if one does, return a defect notice rather than quietly overriding.

Expected output:

- Decision or recommendation.
- Grounding in P1/P2/P3.
- Commitments and non-goals.
- Residual uncertainty and reversal conditions.
- Next-cycle P1 seed.

### 5. `ep-cognitive-cycle`

Purpose: Orchestrate P1 -> P2 -> P3 -> P4 as a complete cognitive discipline for a single agent or a team.

Core contract:

- Establish orienting question, implicit unknown, mode, sources, and recursion budget.
- Run P1/P2/P3/P4 in order.
- Preserve accumulated content and handoff packets.
- Enforce phase boundaries in-process: no P2 before P1, no P4 before P3, no decision without mode.
- When using subagents, assign phase-specialized tasks and require structured outputs matching the phase contracts.
- Track recursion explicitly and stop when budget or evidence exhaustion makes continuation irresponsible.

Expected output:

- Cycle manifest.
- Accumulated P1/P2/P3/P4 record.
- Recursion ledger.
- Final decision/recommendation plus next P1 seed.

## Use Models

### Individual-Agent Use

One Codex agent adopts the full cognitive discipline internally:

1. Establish `orienting_question`, `implicit_unknown`, mode, source list, and recursion budget.
2. Run `ep-p1-attend` and write a P1 packet.
3. Run `ep-p2-inquire` only from the P1 packet.
4. Run `ep-p3-judge` over P1 and P2.
5. If P3 recurses, deepen P1 or P2 and repeat.
6. Run `ep-p4-decide` when P3 advances.
7. Return final answer with next P1 seed.

This is useful for code reviews, architecture decisions, roadmap audits, proposal evaluation, and prompt/curriculum design where premature closure is a real risk.

### Team Use

Multiple agents specialize across roles:

- P1 agent: source-grounded evidence collection and characterization.
- P2 agent: possibility generation from P1 only.
- P3 agent: independent sufficiency and evidence judgment.
- P4 agent: decision/recommendation under mode.
- Controller: manages source packets, handoffs, recursion budget, and final integration.

Recommended coordination protocol:

- Controller creates a cycle manifest with orienting question, implicit unknown, mode, and evidence scope.
- P1 returns a structured P1 packet.
- P2 receives only task context plus P1 packet.
- P3 receives P1/P2 packets and either returns a recursion packet or a P4 handoff.
- Controller handles recursion by reassigning P1/P2 with P3's exact feedback.
- P4 receives the complete accumulated record and P3 handoff.

This preserves noetic-pi's "each agent focuses on one operation" benefit without needing APM.

### Legion-Scale Use

Many agents apply the skills over repeated cycles to transform a codebase or evolve target material:

- Decompose the target into scopes or strata.
- Run many P1 agents in parallel on disjoint evidence scopes.
- Run P2 agents to propose alternate transformations per scope and cross-scope.
- Run P3 agents to judge sufficiency, reconcile contradictions, detect blind alleys, and select or recurse.
- Run P4 agents to produce bounded decisions, implementation packages, or next-cycle seeds.
- Controller maintains a global cycle ledger: evidence packets, possibility catalog, judgment matrix, decision ledger, and unresolved recursive asks.
- Repeat cycles until the target material has advanced or the controller judges diminishing returns.

Legion-scale use needs stronger anti-drift controls than single-agent use:

- Stable packet schemas.
- Strict source citations.
- Duplicate-detection across P2 alternatives.
- Contradiction registers.
- Recursion budget per scope and global budget.
- Controller authority to stop, merge, or split cycles.
- Final archive of each cycle so downstream cycles have real records, not vague memory.

## Recommended Multi-Agent Work Breakdown to Create the Skills

### Controller Agent

Owns skill architecture and integration.

Tasks:

- Define shared terminology and file layout for all five skills.
- Specify common packet formats.
- Decide how skills reference one another without circular ambiguity.
- Ensure the distinction between harness mechanics and cognitive judgment remains explicit.
- Review every skill for consistency with noetic-pi evidence.

### Worker A: P1/P2 Skill Author

Owns `ep-p1-attend` and `ep-p2-inquire`.

Tasks:

- Extract role boundaries from `phronesis-p1.md`, `phronesis-p2.md`, method sources, and curriculum.
- Write skill instructions for evidence characterization and possibility generation.
- Include examples of acceptable and unacceptable outputs.
- Add handoff packet schemas from P1 to P2 and P2 to P3.

### Worker B: P3/P4 Skill Author

Owns `ep-p3-judge` and `ep-p4-decide`.

Tasks:

- Extract judgment and decision rules from `phronesis-p3.md`, `phronesis-p4.md`, and APM recursion/mode behavior.
- Write recursion rules, sufficiency checks, mode constraints, and decision packet schemas.
- Include patterns for `recommend-only`, `decision-only`, and `decide-and-enact`.
- Include explicit safeguards against P4 relitigating P3.

### Worker C: Orchestration Skill Author

Owns `ep-cognitive-cycle`.

Tasks:

- Translate noetic-pi APM mechanics into a Codex-soft harness: manifest, phase order, accumulated context, recursion ledger, budget, and archive format.
- Define single-agent, team, and legion-scale workflows.
- Specify when to spawn subagents, when to keep work local, and how to merge packets.
- Include failure modes and stop conditions.

### Worker D: Evidence and Validation Reviewer

Owns traceability and quality.

Tasks:

- Verify every skill claim against noetic-pi files listed above.
- Check that P1-P4 remain cognitive operations rather than names pasted onto generic prompts.
- Validate sample cycle outputs against the proposed packet schemas.
- Produce a final review matrix mapping noetic-pi evidence to skill rules.

### Optional Worker E: Test/Fixture Designer

Owns examples.

Tasks:

- Build small synthetic tasks that exercise recursion, P2 insufficiency, P1 evidence gaps, and P4 mode constraints.
- Create before/after examples showing the skills preventing premature closure.
- Propose a lightweight manual validation checklist for future Codex runs.

## Skill Design Decisions for the Controller

1. Where should these skills live: personal Codex skills, repo-local project skills, or both?
2. Should skill names keep the `ep-` prefix even for differentiated cognition, or should they use `p1-attend`, `p2-inquire`, etc.?
3. Should the orchestration skill always read method/theory references, or only when noetic-pi / EP audit work is in scope?
4. What packet schema should be required: Markdown sections only, JSON frontmatter plus Markdown, or pure JSON?
5. How strict should P3 recursion be in ordinary Codex use when tool-call turns are expensive?
6. Should P4 `decide-and-enact` be allowed inside the skill, or should Codex require explicit user authorization before enactment?
7. How should a controller archive cycle outputs in projects that do not have `.phronesis/`?
8. How should subagent outputs be cited and merged when multiple P1 agents characterize overlapping evidence?
9. Should a full-cognition cycle skill invoke individual P1-P4 skills by name, or inline enough instructions to be self-contained?
10. How should the skills prevent "ceremonial P1-P4" where an agent writes headers but does not change its reasoning behavior?

## Risks and Ambiguities

- Runtime enforcement gap: Codex skills cannot kill agents, reject invalid tool calls, persist DB state, or enforce terminal states the way APM can.
- Role leakage: P1 may interpret, P2 may recommend, P3 may invent, or P4 may rejudge unless skill instructions are sharp.
- Prompt bloat: importing too much noetic-pi theory can make skills heavy and less usable.
- Over-recursion: P3's high sufficiency bar can become non-terminating without a practical recursion budget.
- Under-recursion: Codex may advance prematurely because no deterministic harness forces a P3 gate.
- Mode ambiguity: Codex normally can edit files; P4 mode must explicitly bind whether action is allowed.
- Team coordination cost: small tasks may not justify multi-agent overhead.
- Legion-scale drift: many agents can amplify inconsistent interpretations unless packet schemas and controller review are strong.
- Evidence dilution: downstream phases must receive actual P1/P2/P3 packets, not summaries that strip uncertainty and source ties.
- Existing skill overlap: this repository or user environment may already contain early P1-P4 skills; implementation should audit and either replace, refine, or consolidate them rather than duplicate names blindly.

## Initial Implementation Recommendation

Build the five skills in two passes:

1. Evidence-faithful pass: create concise but explicit `SKILL.md` files for P1, P2, P3, P4, and full-cycle orchestration using the noetic-pi contracts above. Keep the first version text-only and controller-driven; do not add scripts until repeated use reveals stable automation needs.
2. Validation pass: run two dry cycles, one single-agent and one team-style, against a small codebase question. Confirm that P1 describes before interpreting, P2 multiplies before selecting, P3 recurses or advances with evidence, and P4 respects mode.

The next delegation should be:

- Controller: create shared packet schema and directory plan.
- Worker A: draft P1 and P2.
- Worker B: draft P3 and P4.
- Worker C: draft full-cycle orchestration.
- Worker D: review evidence fidelity and run a dry-cycle validation.

The first implementation should remain conservative: reproduce the discipline and handoff grammar before attempting scripts, persistent ledgers, or automation.
