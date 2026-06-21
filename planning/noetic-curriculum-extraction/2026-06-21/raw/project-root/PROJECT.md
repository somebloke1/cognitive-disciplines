# Project Manifest: noetic-pi

**Last Updated:** 2026-04-17
**Version:** 0.3.0

---

## Purpose

noetic-pi is a **web terminal for pi coding agents**. It provides a browser-based interface for running pi agents as PTY processes, rendered via xterm.js over WebSocket. The project is **used for its own development** — agents run inside the application they are modifying.

noetic-pi is a self-developing operational environment. The APM (Agent Population Manager), phronesis cycles, EP audits, and succession protocol all run inside noetic-pi while being developed by agents running inside noetic-pi.

---

## Architecture

### Monorepo Structure

```
noetic-pi/
├── packages/
│   ├── apm/          # Agent Population Manager — TypeScript APM daemon
│   ├── server/       # Fastify HTTP/WebSocket server — PTY management, API
│   ├── shared/       # Shared types and protocol definitions
│   └── web/          # Vite + xterm.js browser client
├── .method_sources/  # Layer 0: Invariant source materials (never revised)
├── .method/          # Layers 1–2: Imperatives, constitution, prompt fragments
├── .pi/extensions/   # pi extensions (mesh, phronesis, succession, etc.)
├── ROOT_PROMPT.md    # Living operational directive
├── PROJECT.md        # This file
└── LOG.md            # Operational log
```

### Runtime Architecture

```
Browser (xterm.js)
  ↕ WebSocket (/agents/:id/pty)
Fastify Server (packages/server)
  ↕ TCP
APM (packages/apm)
  ↕ node-pty
pi agent processes (in PTYs)
```

The server manages PTY sessions; the APM manages agent lifecycle, orchestration (phronesis, succession, EP audits), and census. The browser connects to individual PTY sessions via WebSocket and receives real-time census/event updates via a Server-Sent Events stream.

### Key Design Decisions

- **PTY session ID = APM agent ID**: Pre-generated UUID v4 IDs assigned before spawn ensure the browser tab and APM census share one identity (5a969b7)
- **Ordinal identity model**: Agents identified by structural position (ordinal) in a delegation tree, not by binary role. Root agent holds ordinal '0'. All non-root agents are 'unitary' with ordinal reflecting tree position (e.g., '0.1', '0.2.3'). Eliminates captain/crew distinction.
- **APM owns succession state; server executes spawn**: Clean architectural boundary — APM manages the state graph, server owns PTY execution (d6ad319)
- **HMR disabled**: `hmr: false` in Vite config preserves terminal sessions and WebSocket connections during self-development (5936b90)
- **Bidirectional persistent connections**: APM retains socket refs in ConnectionRegistry, pushes notifications down existing agent connections instead of opening reverse TCP sockets
- **apm-channel singleton**: Extensions communicate with APM via `getApmChannel()` (routed through agent-mesh's persistent connection), replacing the ephemeral per-request TCP pattern

---

## Current State

**Phase 2 + CodeGraph + Model Configuration + Signal Infrastructure + Ordinal Identity are complete, the implementation executor is operational, the Step 1 truth boundary plus Step 2 owned asset/workspace substrate are established through accepted waves, and the bounded Step 3/Step 5 native orchestration subset is now real.** Full server + web + APM + code index + model config UI + transaction-aware signals + condition evaluator + ordinal-based agent identity + an operational implementation executor. Public `orchestration_initialize`, `orchestration_start`, `orchestration_advance`, `orchestration_abort`, bounded `orchestration_abort_variant`, bounded manual/batch `orchestration_select`, and bounded manual/batch `orchestration_merge_variant` now operate over the existing executor/owned-workspace substrate. Managed variant worktrees are now the authoritative execution manifold: `variant_workspaces` carries continuity, host-prerequisite, runnable-workspace, boundary-attestation, and derived readiness truth for each variant. `runtimeContractState='runnable'` names only runnable-workspace closure, not full environment certification, while `readinessState` summarizes whether the authoritative workspace is `blocked`, `runnable`, or `attested`. Routine `orchestration_status` truth now includes continuity / host / runtime / boundary / readiness axes, actionability / continuation truth, and cleanup / disposition truth; `orchestration_diagnose` remains the exceptional investigation surface for identity/contract/inventory defects; and `orchestration_repair` remains the guarded corrective path. The bounded policy mode is `attested_worktree_boundary`: it attests managed-worktree execution and unsupported ambient dependencies truthfully, but it does not claim containerization, kernel confinement, or full workspace replication. Cleanup is visible but not automatic, and orchestration terminality does not imply cleanup completion. Planner orchestration enactment, callback/agent automation, incremental manual selection semantics, cleanup broadening, full replication, OS-level sandboxing, and control-plane extraction remain deferred.

### Test Counts

| Package | Tests | Status |
|---------|-------|--------|
| `@noetic-pi/apm` | 1,071 | ✅ All passing |
| `@noetic-pi/server` | 392 | ✅ All passing |
| `@noetic-pi/web` | 499 | ✅ All passing |
| `@noetic-pi/shared` | 38 | ✅ All passing |
| `@noetic-pi/codegraph` | 29 | ✅ All passing |
| `@noetic-pi/session-search` | 40 | ✅ All passing |
| **Total** | **2,069** | **✅** |

### Implemented

- **Phase 1:** Fastify server, PTY management (node-pty), auth (SharedSecretStrategy), WebSocket PTY streaming, ring buffer, HTTP agent lifecycle API
- **Phase 2:** APM integration, EventBus (APM → browser SSE), session persistence, xterm.js web client with sidebar, tab management, model selection
- **Async Architecture (Phases 1–9, 10a, 11):** Bidirectional persistent connections, unified CorrelationManager/ReconnectPolicy, registry-based routing, typed event vocabulary, apm-channel singleton for extensions. See `.working/async-architecture-design.md` (design) and `.working/async-implementation-plan.md` (implementation). Eliminated: per-agent TCP servers, apmPushServer, ephemeral sendToAPM pattern.
- **CodeGraph Backend:** Full code index — FalkorDB graph DB, 14 tree-sitter language parsers, 31 ci_* tools (index, query, analysis, management, watcher). Registered as APM backend, accessible via bridge extension. See `working/codegraph-implementation-procedure.md` and `working/backend-system-design.md` §6.
- **Succession:** Full live succession — APM manages state, server spawns visible PTY tab for successor, browser opens tab automatically. Ordinal transfer via atomic `checkAndPerformSwap()`, successor acquires ordinal '0', ancestor retired with subtree cascade.
- **Tooling:** All pi extensions present — phronesis, EP audit, succession, agent mesh, population manager, framework tools
- **APM-Mediated Planner Pipeline:** Fully APM-owned multi-phase plan generation with persistent SQLite state (`plan_pipelines`, `plan_phases`, `plan_iterations`), QA-remediation cycling (0-3 passes), gated/auto advance modes, sidebar visibility (`PL:` PROC labels), context routing, recovery on restart, and thin IPC extension (6 tools). Structurally equivalent to phronesis and EP audit modules. Phase 4 (orchestration) deferred. Prompt-composed model tier guidance is now dynamically sourced from configured policy tiers and includes provider in the assignment table. See `.working/planner/design.md` (design) and `.working/planner/implementation-procedure.md` (procedure).
- **Enhancement Cycle E:** Census model/title/provider columns, census:changed push notification via server registration in APM census, succession:spawn_visible enrichment via lifecycle.spawnAgent(), EventBus handlers, 7s polling timer eliminated. All 5 gaps (G1–G5) resolved.
- **Session Search Backend:** Full session indexing — Qwen 3.5-35B summarization, Snowflake Arctic Embed 2 embeddings, BM25 search, EP classification. 4 tools (session_search, session_browse, session_index, session_index_file). Registered as APM backend.
- **Codegraph Tiered Indexing:** Three-tier staleness detection — Tier 0 skip (~5ms when graph matches HEAD), Tier 1 file sync (~2-3s for <50 changed files), Tier 2 full re-index (~44s only when needed). Force parameter wired through 5 previously dead touchpoints. Succession no longer instructs ci_index --force.
- **Production Logging:** Three-tier logging (shared types → independent implementations → infrastructure). APM logger with correlation ID propagation, server pino bridge + launcher logger, browser logger. Cross-boundary correlation via `correlationId` bindings, `duration_ms` timing convention. See `.working/logging-design.md` and `.working/logging-implementation-procedure.md`.
- **Model Management:** Full programmatic model change protocol — web UI ModelPickerModal, server validation gate (`POST /agents/:id/model`), APM routing (`model_change_request/confirmed/rejected`), agent acknowledgment via pi extension (`pi.setModel()` + TUI refresh), census update + SSE push, provenance tracking (`selection_context` column). Semantic layer types (`model-layers.ts`), EP audit model inheritance, phronesis fallback cleanup. See `.working/model-management-design.md` and `.working/model-management-implementation-procedure.md`.
- **Ordinal Identity:** Agent identity based on structural ordinal position in a delegation tree, replacing the binary captain/crew role model. UUID v4 agent IDs, `ordinal` field (root='0', children='0.N', grandchildren='0.N.M'), `register_tree_node` for ordinal assignment, `computeOrdinal()` with monotonic indexing, `get_delegation_tree` recursive CTE, boot-time migrations (captain→ordinal:'0', crew→unitary), succession via atomic ordinal transfer, format-agnostic `isAgentId()`. Functional roles (p1–p4, auditor, server, unitary) replace binary captain/crew. See `.working/ordinal-identity-design-v3.md` (design) and `.working/ordinal-identity-implementation-procedure.md` (procedure).
- **Codegraph Fixes (Phases 1–2):** PYTHON_BUILTINS language guard, findByContent expanded to Variable/Interface/Module nodes, pnpm glob resolution for ci_add_package, IMPORTS MERGE key expansion (per-specifier edges), fuzzy module matching (ENDS WITH OR), FalkorDB DELETE+CREATE fallback for relationship MERGE, TypeScript import_clause field name fix, `.js` extension bridging for ESM. 11 new behavioral tests. See `.working/codegraph-fix/12a6bcfd/implementation-procedure.md`. Phases 3–4 (CALLS global fallback, fullName corruption, transitive closure depth) remain in AI-0032.
- **E-D Transaction-Aware Signal Wrapper:** `signal-wrapper.ts` — `createSignalWrapper(db)` returns `emitSignal()` and `drainSignals()`. Signals queued during transactions are drained post-commit via `runTransaction()` on `APMContext`. Migrated `register_tree_node`, `spawnAgent`, `setConditions`, `checkAndPerformSwap`, `checkAndComplete`. Zero direct `db.transaction` in lifecycle/succession. See `.working/e-d-queue-drain/b0ad0a95/implementation-procedure.md`.
- **E-B Condition Evaluator:** `condition-evaluator.ts` — signal queue, drain loop, DB-query-per-signal lookup, three-scope variable resolver (signal/agent/global), predicate matcher, three action executors (retire, spawn_replacement, tool). Signals drained post-commit are evaluated against registered conditions, firing actions automatically. See `.working/e-b-condition-eval/c36f6c91/implementation-procedure.md`.
- **Model Configuration (D009):** Replaced `model-probe.ts` network probing with direct pi module import (`packages/server/src/model-config.ts`). 6 bridge functions (`getScopedModels`, `getModelConfig`, `setEnabledModels`, `setDefaultModel`, `getCustomModelsJson`, `writeCustomModelsJson`), 7 new API endpoints, Model Configuration tab in Settings (3 sub-panels: Scoping, Custom Models, Defaults). `@sinclair/typebox` for schema validation, ModelsConfigSchema replicated locally (pi-mono must not be modified). See D009 decision record.
- **Bootstrap Timeout Cleanup:** Boot-time query retires zombie agents (spawned >60s ago, never bootstrapped) with `death_cause = 'bootstrap_timeout'`. Complements D005.
- **Plan Pipeline Cascade:** `retireAgentSQL` Step 7 — aborts plan_pipelines where `caller_id` matches retiring agent. Extended `RetirePreState` with `abortedPlanPipelineIds`.
- **Plan Notification Handlers:** Added `plan:pipeline_complete`, `plan:pipeline_escalated`, `plan:pipeline_aborted`, `plan:gate_waiting` to agent-mesh extension's `handleAPMNotification`.
- **Phronesis Archive Overwrite Fix:** Recalled agents used stale `PHRONESIS_PASS` env var; fix computes pass from DB via `getNextPass()`.
- **Implementation Executor:** Operational APM-owned executor for structured implementation procedures. Procedure JSON input defines WUs (work units) grouped into waves with complexity classification, binding imperatives, and missions. APM handles deterministic dispatch (wave sequencing, model selection, spawn/retire, QA gates, git commits via selective staging from WU `outputs[]`). Agents handle non-deterministic work (implementation, evaluation, escalation). QA per wave with structured per-WU attribution, remediation cycling, escalation on exhaustion. auto/gated advance modes. The Step 1 truth boundary is established, accepted Step 2 waves have added owned asset/workspace lifecycle substrate and state reporting around the executor, and the narrow Step 3 Tier 1 public subset now makes `orchestration_initialize`, `orchestration_start`, `orchestration_abort`, and bounded `orchestration_abort_variant` real over that substrate. Deferred mutators and planner orchestration enactment are still not complete. 7 tools: `initialize_implementer`, `implementation_start`, `implementation_advance`, `implementation_status`, `implementation_abort` (caller) + `implementation_submit`, `implementation_escalate` (working agents). 4 DB tables, `implement.ts` (2503 lines), `implement-tools.ts` extension. See `.working/implementer/spec.md` (spec v3) and `.working/implementer/ba147b94/implementation-procedure.md` (procedure).
- **Obs/Settings Rearchitecture:** Completed planned rearchitecture set `.plans/obs-settings-rearchitecture/286dc129/` via implementation `c5490e6a` (3 waves, 4 WUs). Observability now includes first-class Planning, Implementation, Differentiated Cognition, Emergent Probability, and Runtime Diagnostics tabs; archive download enabled across all tabs with graceful missing-artifact handling. Runtime diagnostics moved out of Settings into Obs. Added observability endpoints for planning/implementation archives and runtime/advanced-env payloads.
- **Self-development protocol:** HMR disabled, three-tier change protocol documented

---

## Pending Work

### Latest Operational Update (2026-05-01)
- Orchestration `583c45da` remains in manual `selection` with all three variants terminal/complete and **no winner selected, merged, or publication-ready basis accepted yet**:
  - v01 `8297f26c` / implementation `69e77326` / final commit `079574ee6666c9367dead4f4d52dd6db797d97e5`
  - v02 `e47979d6` / implementation `884674f2` / final commit `f20f19a34fbb62e4eb3f80a5482275203f80c310`
  - v03 `26fd4756` / implementation `fa1ab5c0` / final commit `759ccbc87134848379fdc6c446cf4f1e875f3766`
- The grounded comparison dossier at `.working/public-export-transposition/v02-closure-variant-comparison-dossier-2026-05-01.md` and three comparative inquiries over `583c45da` remained relevant background truth:
  - differentiated-cognition cycle `21082eff` → **recommend v02**
  - EP audit `13920060` → **recommend v02**
  - EP audit `d3e37eca` → **recommend v03**
- Real separate-directory export/transposition attempts have now been executed under `/home/dgk/workspace/public-export-attempts/2026-05-01-11a8de72/` for **v02**, **v03**, then **v01** as reserve/tiebreak. Detailed reports:
  - `.working/public-export-transposition/export-attempts/2026-05-01-v02-v03-first-run.md`
  - `.working/public-export-transposition/export-attempts/2026-05-01-normalization-and-v01-reserve.md`
- After normalization, the three exported candidates now converge on the same broad export-space pattern: governance seeds present, excluded residue absent, normalized external-pi smoke passes, normalized codegraph readiness passes, targeted preflight/build/test/typecheck pass, changed-mode checks pass after fresh export git init, and the same shared full governed-source codegraph line-cap failures remain. Publication/scope/doctrine holds also remain shared.
- An EP audit on next-phase governance (`6ff4c74a`) judged that comparison is now **saturated** and recommended the **split-basis path**: select a retained basis now, but explicitly distinguish **selection** from **merge** and **publication readiness**, then resolve the shared blockers on that selected basis only. The audit recommends **v02** as the retained basis. Report: `.ep-audit/6ff4c74a/report.md`.
- The immediate next-root work is therefore to work with the user on executing the operator checklist at `.working/public-export-transposition/export-attempts/selected-basis-execution-operator-checklist-2026-05-01.md`:
  1. record the selection-without-merge doctrine,
  2. manually select **v02** as retained basis,
  3. keep merge deferred,
  4. adjudicate shared publication/scope/doctrine and codegraph line-cap blockers on that single basis,
  5. rerun selected-basis export proof before reconsidering merge.
- The root coordinating branch remains `public-export-launch-prep-20260430`. The working tree remains intentionally dirty due to continuity artifacts (`LOG.md`, `.phronesis/index.md`, `.phronesis/11a8de72/`) plus intentional untracked runtime/evidence directories under `.working/implementer/**` and `.working/public-export-transposition/export-attempts/`; do not mistake that for completed selected-basis closure.
### Latest Operational Update (2026-04-30)
- The selected public-export improvement line is now the **twice-amended** planner package under `.working/public-export-transposition/v02-improvement-cycle-pipeline/11a601d6/`, generated from the selected-v02 closure materials and then tightened after direct root review plus differentiated-cognition cycle `02d95eee`.
- Current governing execution truth remains:
  - selected orchestration: `b118bbac`
  - selected variant: `df924a00`
  - selected implementation: `677cef66`
  - selected branch: `public-export-launch-prep-20260430--orch-b118bbac-v02`
  - selected tip: `6955600`
- The generated design/design-intentions package was judged sound in structure, but the original procedure needed bounded correction before execution. Two amendment passes have now been applied directly to `.working/public-export-transposition/v02-improvement-cycle-pipeline/11a601d6/implementation-procedure.json`.
- First amendment pass clarified and tightened:
  - Phase 1 as **post-selection truth-legibility**, not selection replay
  - WU2 selected-manifold proof expectations
  - WU4 external-pi authority-consumer semantics
  - WU8 diagnostic-mirror wording
- A five-vector review sweep was then run over the amended procedure:
  - substrate truth
  - Gate A authority truth
  - contract coherence
  - integrated readiness proof
  - boundedness / maintainability hardening
- Combined review judgment was **PASS-WITH-AMENDMENTS** overall, with the strongest remaining issue in readiness-proof closure: retained-feature proof was still too documentary, codegraph/FalkorDB `ready` could still be overclaimed without hard live proof, and final integrated receipt closure did not yet attest the post-hardening HEAD.
- Second amendment pass incorporated those findings by:
  - adding `WU9A` for executable retained-feature proof
  - tightening WU9 so `ready` requires a live FalkorDB/codegraph probe
  - strengthening WU10 receipt structure, dependency inputs, blocking-hold governance, and substrate-truth content
  - strengthening WU11/WU12 changed-file line-cap enforcement
  - adding final evidence-refresh wave `WU13` so the integrated readiness receipt is refreshed against the actual post-hardening HEAD
  - tightening `mergeState` semantics and explicit live-truth fixture requirements for the selected-manifold substrate pass
- Immediate next root work is **not** replanning. The next root should:
  1. perform one more direct review pass over the twice-amended `11a601d6` procedure,
  2. make any final bounded adjustments still required,
  3. then prepare the correct fresh execution manifold/environment for implementation launch from the selected-v02 baseline.

### Latest Operational Update (2026-04-28)
- Branch `planner-proc-compliance-r1` carried the zero-exception planner-procedure-total-compliance campaign through all ten bounded launches, this time under an explicitly enforced delegated internal cycle (`plan → implement → QA → remediate → return to QA`) with per-dispatch-set commit boundaries and no orchestrator self-execution.
- Accepted campaign commit spine on this branch is now:
  - `e8134a6` — `fix(apm): harden procedure json contract`
  - `5f36198` — `fix(apm): add planner prompt dependency manifest context`
  - `4863c24` — `fix(apm): align procedure production prompt truth`
  - `c9995c0` — `chore(campaign): record WU4 planning no-change`
  - `883bc1f` — `fix(apm): align implementer prompt runtime truth`
  - `aeb0b5b` — `fix(apm): persist dependency manifest provenance for WU5`
  - `cc4d72d` — `chore(campaign): record launch-06 planning no-change`
  - `c8dfeaa` — `fix(shared): align implementation status protocol vocabulary`
  - `cb0e89f` — `test(shared,server): align orchestration dependency summary contract`
  - `4fcce0a` — `feat(apm): project canonical implementation runtime truth`
  - `0c2431e` — `fix(apm): align diagnosis runtime truth projection`
  - `dcbe769` — `fix(apm): canonicalize diagnosis runtime truth fields`
  - `2b17afc` — `chore(campaign): record WU9 planning no-change`
  - `9812aa4` — `fix(apm): align orchestration contract projection`
  - `9ac81a6` — `fix(apm): retire planner prompt fallback residue`
  - `840bfff` — `test(apm): align runtime truth proof surfaces`
- WU1–WU10 all passed their bounded orchestrated QA. A first full-suite noetic validation after WU10 exposed four remaining APM proof-surface failures. A differentiated-cognition cycle (`1ae51bdb`) judged the runtime/shared/server implementation substantively correct and recommended a bounded proof-surface migration rather than further runtime/protocol expansion.
- That bounded closure pass was then implemented in `packages/apm/test/unit/implement.test.ts` and `packages/apm/test/state-machines/ideal-conformance/implementation/recovery.test.ts`, aligning those tests to the authoritative implemented contract: implementation-facing status/diagnose is snake_case, orchestration routine surfaces remain camelCase, `scope_chain` is compact scope literals, and lifecycle mismatch classification is expressed by bucket membership plus `actualKind` rather than universal enumerable `inventoryClass`.
- After that closure pass, full noetic validation excluding `pi-mono` was rerun green across builds and tests for `@noetic-pi/shared`, `@noetic-pi/apm`, `@noetic-pi/server`, `@noetic-pi/web`, `@noetic-pi/codegraph`, and `@noetic-pi/session-search`.
- Campaign doctrine documents under `.working/planner-procedure-total-compliance/agentic-campaign/` were also strengthened so future launches explicitly require delegated subagents for planning / implementation / QA / remediation, forbid orchestrator self-execution, and require a commit boundary after every completed dispatch set.
- Immediate next root work after restart/succession should be lightweight system-confidence testing: invoke one trivial differentiated-cognition cycle and one trivial EP audit discipline invocation to verify those rebuilt/restarted surfaces still operate normally from the now-green baseline.

### Latest Operational Update (2026-04-27, later session)
- The post-AI-0120 baseline was merged forward into local `main`, preserving the branch-preferred decomposed `packages/shared/src/apm-protocol/` family while retiring the stale monolithic `packages/shared/src/apm-protocol.ts` path from the active line. Local `main` was then pushed to `origin/main` at `be2e639`.
- Two differentiated-cognition cycles completed and materially updated current judgment:
  - `0fd89b02` judged `planner-quality-hardening` to be substantially realized and transformed; the surviving relevant remainder is narrow migration cleanup plus forward continuity at the planner→implementer/orchestration seam, not revival of the historical package as such.
  - `b9d0c561` judged that APM-starting tool surfaces need a unified initiation-surface doctrine: preserve legitimate initiation species, but eliminate ad hoc plurality of initiation semantics across root-facing initiation flows.
- A new working package now exists at `.working/apm-initiation-doctrine/`, containing a requirements spec plus copied phronesis artifacts for the initiation-surface doctrine effort.
- A bounded investigation agent then reviewed whether planner-generated implementation procedures currently satisfy implementation/orchestration consumer expectations. Consolidated judgment: the seam is only partially coherent. Typed `dependency_roles` and launch-required continuity are now structurally real, but planner-authored procedure standards still outrun parser enforcement; top-level governing/source authority is not yet execution-authoritative; planner-generated binding imperatives can still misstate runtime tool semantics; shared protocol/runtime payload names still drift; and planner prompt plumbing still carries compatibility residue.
- From that investigation, a new zero-exception working package now exists at `.working/planner-procedure-total-compliance/`. Its governing high-level spec makes explicit that planner-generated implementation-procedure output must reach total, complete, exception-free compliance with implementation and orchestration expectations, and that any remaining compatibility gap — explicit or implicit — means failure.
- That package was then run through a full planner pipeline `a5a58607` (`design_intentions`, `design`, `implementation_procedure`, QA=3), producing a bounded ten-WU corrective package under `.working/planner-procedure-total-compliance/pipeline/a5a58607/`.
- The completed planner package was subsequently transposed into a manual root-dispatched orchestrator campaign under `.working/planner-procedure-total-compliance/agentic-campaign/`, following the established root → orchestrator → internal planning / implementation / QA / remediation cycle grammar from earlier campaign precedents. The immediate next root should review `launch-01`, prepare materials and git state for orchestration, and then launch the bounded orchestrator for WU1.

### Latest Operational Update (2026-04-27)
- The fresh AI-0120 relaunch line was carried through comparison, manual selection, and merge completion. After direct comparison of the three complete variants from orchestration `41e2da62`, variant `5ad5bd53` / implementation `8314bf9a` was judged strongest because it alone demonstrably repaired changed-mode rename handling for legacy over-limit files while still completing the full package successfully.
- Variant `5ad5bd53` was manually selected and merged. Orchestration `41e2da62` is now complete with merge commit `7d27ae7f2c6024ba635f6572dca3100803d878db` (`merge(orchestration): accept AI-0120 line-cap variant 5ad5bd53`) on branch `ai-0120-line-cap-relaunch-20260427-r2`.
- Full recursive validation was then checked at the user’s request. `pnpm -r build` remains blocked by the known `pi-mono` root-recursive toolchain boundary (`tsgo: not found` in `pi-mono` package builds). Re-run `pnpm -r test` converged to a single remaining `pi-mono/packages/coding-agent` failure in `test/tools.test.ts` around `executeBash` full-output persistence on line-count truncation; this was judged unrelated upstream `pi-mono` surface and is intentionally left unfixed here.
- The immediate next root should work with the user to choose the next initiative/effort from the updated baseline rather than continue AI-0120 execution work.
- The bounded eight-launch controller/verifier repair campaign under `.working/controller-verifier-fix-campaign/` completed successfully on branch `ai-0120-line-cap-exec-r1`. All eight launch orchestrators reported success, landing: amendment-grammar repair (`b90a194`), resolver-plane separation (`39ae43d`), ordinary submit verifier-plane execution (`0851920`), the exact ignored proof-artifact regression flip (`c0ef895`), sibling/operator/status alignment (`2ef2f0e`), resolved deliverable-plane staging/commit alignment (`11d1547`, with follow-up campaign-ledger commit `36837de`), prompt truthfulness alignment (`b35dd19`), and final bounded no-change cross-surface proof (`43de1e0`).
- The repaired controller truth was revalidated green at the end of the campaign: `pnpm --filter @noetic-pi/apm exec vitest run test/unit/implement.test.ts test/integration/implementation-corrective-package.test.ts test/integration/variant-execution-context.test.ts test/unit/implementer-prompts.test.ts`, `pnpm --filter @noetic-pi/server exec vitest run src/apm-client.test.ts`, and `pnpm --filter @noetic-pi/apm exec tsc --noEmit` all passed.
- A bounded readiness review was then performed against `.working/ai-0120-line-cap-governance/corrective-relaunch/a305b6dc/implementation-procedure.json`. All declared `dependency_roles.launch_required` paths currently exist, and the controller/process blocker that trapped prior AI-0120 runs is now judged repaired.
- Clean-launch preparation was completed afterward: retained forensic/runtime residue was archived out of the live baseline, the checkout was restored to a truthful clean launch state, and the bounded readiness checks were rerun green before relaunch.
- AI-0120 was then relaunched through orchestration `cb80bddc` from branch `ai-0120-line-cap-relaunch-20260427` after additional launch-legality repairs to the procedure: retired `inputs[]` carrier removed and illegal root-surface `launch_required` paths reclassified out of launch-gating truth.
- The relaunched orchestration did not yield a mergeable winner and is now aborted. Variant `521bd9a3` / implementation `4e640708` entered illegal Wave 1 active limbo after WU1 and WU2 completed, with WU3 left active but no runnable worker, no QA actor, and no lawful continuation. Variants `30fe4b5f` / implementation `b0e18b87` and `07b9efa9` / implementation `4f64bc8d` both committed Wave 1 successfully (`af7bc8ff4cd25a7e631bcf471d56a658f25a8c97`, `90a30ed3f619b8094dd2232bab6a8a245c6409b2`) and then independently reproduced the exact WU4 ignored-path verifier trap on `scripts/__tests__/fixtures/full-scope/repo-pass/dist/generated.js`.
- For both WU4-blocked variants, bounded `wu_completion_override` guidance was delivered to preserve the artifact on disk while removing it from verifier-owned completion truth, but ordinary `implementation_submit` still rejected the same exact ignored path as `unmodified`. Current judgment: the remaining blocker is again controller/process-side rather than package-authoring-side.
- The current operator request for the successor root is not to continue this aborted orchestration, but to re-prepare the corrective relaunch procedure/environment/worktree from a grounded fresh state and then launch a new orchestration intentionally. The next root should treat `cb80bddc` as forensic evidence, preserve its archived QA/evidence residue, re-verify launch legality and environment truth, and only then relaunch.

### Latest Operational Update (2026-04-26)
- A fresh AI-0120 relaunch attempt on branch `ai-0120-line-cap-exec-r1` first corrected the remaining future-produced and illegal root-surface `launch_required` misclassifications in the regenerated procedure (`77cee22`, `215f5a9`). With those fixes in place, native orchestration launch legality was repaired: orchestration `8518c653` reached active execution and Wave 1 committed successfully as implementation `9816ac8f` / commit `503e076783d76161dcb4c0000dd90abbff52dc1e`.
- The substantive blocker then recurred exactly where earlier runs pointed: controller-side owned-output verification still rejects the gitignored proof artifact `scripts/__tests__/fixtures/full-scope/repo-pass/dist/generated.js` as `unmodified` even when the file exists on disk at the required path and has been rewritten during the WU. A lower-level implementation run (`f50e9f5e`) had already shown that persisted `wu_completion_override` / authorized-overlay guidance does not actually narrow the active verifier-owned output set for this case. The orchestrated rerun reproduced the same defect on WU4 after launch legality was repaired, confirming that the remaining blocker is controller/verifier-side rather than procedure-side. Both implementations were aborted as non-productively blocked.
- A differentiated-cognition cycle (`d51c7565`) then judged the general correction: make each WU’s resolved effective contract the sole executable truth across verification, staging, status, and authorization, and explicitly separate repository-owned outputs from verifier-only proof artifacts. The immediate next root should do a light investigation, dispatch one or more deep-investigation agents, and compose the results into a corrective plan rather than relaunching AI-0120 again unchanged.
- That investigation has now been completed. The current governing package is a manual root-dispatched orchestrator campaign under `.working/controller-verifier-fix-campaign/`, adapted from the earlier dependency-ontology seam campaign form. It includes a controller-fix implementation procedure plus bounded launch packages `launch-01` through `launch-08` for amendment grammar, resolver semantics, verifier-plane submit execution, exact ignored proof-artifact regression proof, sibling/operator/status alignment, staging/commit alignment, prompt truthfulness, and final cross-surface proof.
- The launch package was independently reviewed and then tightened for execution readiness: launch prompts now carry explicit orchestrator routing/scope discipline, concrete validation commands, governing-material reads, live git-status checks, per-pass commit discipline, and required completion payloads. The next root should verify final readiness and then manually dispatch the orchestrator for `launch-01` rather than relaunching AI-0120 directly.
- Separately, a bounded root-agent-facing interface fix landed in `.pi/extensions/heuristic-discipline.ts` with direct tests in `.pi/tests/heuristic-discipline.test.ts` (`4f641eb`): `apply_heuristic_discipline` argument failures now return concise operator-facing recovery specs that cite only missing/invalid arguments plus relevant optional arguments and accepted value sets, instead of surfacing raw repeated schema-constant diagnostics.
- The dependency-ontology seam redesign package under `.working/dependency-ontology-seam/` was carried through a bounded six-launch orchestrated campaign (`launch-01` through `launch-06`) using delegated planning / implementation / QA / remediation loops. All six bounded units passed: parser typed dependency-role support, governing-source/persistence substrate, planner authoring/diagnostics alignment, implementer prompt + continuity retargeting, shared protocol/status/diagnose/tool alignment, and final conformance proof.
- The transposed campaign package at `.working/dependency-ontology-seam/agentic-campaign/` is now a validated operating pattern for this effort type. Campaign discipline was tightened during execution so every implementation/remediation pass must run the full declared validation surface for its unit before reporting completion.
- After the seam campaign landed, noetic validation excluding `pi-mono` tests was rerun green across builds and tests for `@noetic-pi/shared`, `@noetic-pi/apm`, `@noetic-pi/server`, `@noetic-pi/web`, `@noetic-pi/codegraph`, and `@noetic-pi/session-search`.
- The AI-0120 corrective relaunch procedure at `.working/ai-0120-line-cap-governance/corrective-relaunch/a305b6dc/implementation-procedure.json` was then updated in place through a bounded `gpt-5.4@openai-codex` multi-agent pass rather than a replan. The update added typed `dependency_roles` across WUs, remediated misclassified role semantics to preserve narrow launch-required truth, removed untracked `.working/.../design*.md` dependence from mission authority, and aligned top-level/WU wording so dependency roles are authoritative while mission prose remains advisory. The resulting judgment from that bounded update is `readyForLaunch: true`, assuming the next root copies/materializes the procedure into the intended working subtree before execution.
- A further bounded prompt-surface correction landed in `packages/apm/src/implementer/implementer-prompts.ts` with focused regression coverage in `packages/apm/test/unit/implementer-prompts.test.ts`: QA and remediation prompts now render typed dependency-role sections explicitly and state that dependency roles + WU contract are authoritative while mission prose remains advisory, bringing those prompt surfaces into parity with working-agent prompts.
- A follow-up audit confirmed that the old flat `inputs[]` carrier is still a live migration dependency across parser normalization, launch continuity fallback, prompt fallback, runtime summaries, planner diagnostics, tests, and committed fixture procedures. This is now understood as active migration debt / ambiguity risk rather than reassuring “compatibility.” The next root’s user-directed continuation is to dispatch `gpt-5.4@openai-codex` agents one per step for steps 1–4 of retiring that dual-carrier ambiguity.

### Latest Operational Update (2026-04-25, later session)
- A later follow-on session revisited recurrent implementation/orchestration continuity failures and confirmed a structural seam defect: planner-produced procedures still compress heterogeneous dependency truths into flat work-unit inputs and mission references that orchestration continuity interprets as hard launch requirements. Differentiated-cognition cycle `9ebb7edc` concluded that the correct mid-level remedy is a shared typed dependency-role ontology separating launch-required branch-materialized inputs, governing/contextual references, and future-produced execution dependencies. Decision `D022` records this direction, and a successor planning handoff package now exists at `.working/dependency-ontology-seam/README.md`.
- AI-0120 corrective relaunch pipeline `a305b6dc` completed after bounded root remediation of its design-intentions and design artifacts. The resulting implementation procedure was then launched through orchestration twice: first as `61a0a94e`, which failed immediately on continuity-legality because the generated procedure still declared illegal/transient or future-produced required inputs; then as `f47c7d8a` after a bounded launch-legality patch that cleared `work_units[].inputs[]`. That second launch started successfully but still reproduced the deeper seam problem at mission-execution time when workers escalated on missing non-materialized `.working/.../design*.md` references, confirming that the defect is not procedure-specific but structural. Per user direction, orchestration `f47c7d8a` was aborted rather than further patched ad hoc.
- AI-0120 governance work was advanced under `.working/ai-0120-line-cap-governance/`: requirements were written, planner pipeline `05d0756e` completed, a constructive differentiated-cognition review (`056ddc37`) produced amendment guidance for the generated implementation procedure, and the procedure was amended accordingly before launch.
- A follow-on differentiated-cognition cycle (`4b9c5f7c`, decide-and-enact) intended to enact relaunch amendments aborted at P4 startup. Investigation found a refactor-related sentinel regression: the cycle had been launched with `models:{p4:"default"}, providers:{p4:"default"}`, and recent heuristic-discipline / phronesis / model-resolution behavior propagated those literals as an actual model/provider pair instead of interpreting them as “use configured default.”
- A bounded fix for that sentinel regression is now in the working tree: `.pi/extensions/heuristic-discipline.ts`, `packages/apm/src/phronesis.ts`, and `packages/apm/src/model-resolution.ts` now normalize/ignore literal `"default"` override values so configured defaults win; targeted tests/typecheck were run green in `@noetic-pi/apm` (`test/unit/model-resolution.test.ts`, `test/unit/phronesis.test.ts`, and `tsc --noEmit`).
- AI-0120 was then launched through orchestration `a40c0dab` from branch `ai-0120-line-cap-governance-r2` with 3 variants and `qaIterations=4`. The first launch attempt exposed a continuity-legality defect in the generated procedure’s required-input contract; the procedure was corrected and relaunched successfully.
- The relaunched orchestration did not yield a mergeable winner:
  - variant / implementation `93075e61` was aborted after repeated controller/verifier failure to honor a bounded WU4 output-drop amendment for intentionally ignored fixture path `scripts/__tests__/fixtures/full-scope/repo-pass/dist/generated.js`
  - variant / implementation `35d2a83e` was aborted after entering illegal active limbo with no runnable WU agent, no live QA agent, and no lawful continuation
  - variant / implementation `f4a18278` exhausted QA on Wave 1 governance truthfulness around command-surface claims, ultimately failing because `packages/AGENTS.md` continued to prescribe canonical checker commands before they actually existed in `package.json`
- Orchestration `a40c0dab` is now aborted as exhausted. The next bounded work should not resume that orchestration; it should prepare a corrective relaunch package that addresses (1) the Wave 1 command-surface truth mismatch and (2) the ignored-output verifier trap without depending on controller-side amendment application.
- Additional active continuity recorded this session:
  - `AI-0121` — investigate prompting/enforcement strategies for non-pestering sub-agent coordination
  - `AI-0122` — investigate whether deterministic APM controls plus UI surfaces could eventually replace the root-agent role in bounded operator workflows
  - `AI-0123` — under selected conditions, prefer quiet waiting over repeated status polling when no corrective action is available
- The next root should first perform tests on all tools and trivial-case validation of all pipelines before selecting the next candidate intention/work line.

### Latest Operational Update (2026-04-25)
- The ordered one-component-per-file queue was advanced through items 1–12 on branch `implement-file-slicing`, with bounded orchestrator campaigns completing successfully for:
  - `packages/apm/src/ep-audit.ts` → `670` with `packages/apm/src/ep-audit-grounding.ts` (`453`) and `packages/apm/src/ep-audit-recovery.ts` (`210`)
  - `packages/apm/src/index.ts` → `636` with `packages/apm/src/apm-message-router.ts` (`549`)
  - `packages/apm/src/plan-prompts.ts` → `532` with `packages/apm/src/planner/production-phase-prompts.ts` (`628`)
  - `packages/server/src/http-routes.ts` → `691` with `packages/server/src/http-routes-tool-profiles.ts`, `packages/server/src/http-routes-observability.ts`, and `packages/server/src/http-routes-model-management.ts`
  - `packages/web/src/sidebar.ts` → `773` with six extracted section/chrome files
  - `packages/web/src/main.ts` → `622` with seven extracted coordinator/composition files
  - `packages/server/src/apm-client.ts` → `570` with `packages/server/src/apm-client-orchestration.ts` (`303`)
  - `packages/server/src/launcher.ts` → `486` with `packages/server/src/launcher-apm-integration.ts` (`412`)
  - `packages/web/src/settings.ts` → `755` with `packages/web/src/settings-model-config-section.ts` (`761`), `packages/web/src/settings-tool-profiles-section.ts` (`335`), and `packages/web/src/settings-sessions-section.ts` (`144`)
  - `packages/web/src/modals.ts` → `397` with `packages/web/src/model-dropdown-helper.ts` (`134`) and `packages/web/src/spawn-modal.ts` (`477`)
  - `packages/web/src/observability.ts` → `709` with `packages/web/src/observability-inquiry-panels.ts` (`254`)
  - `packages/codegraph/src/graph/builder.ts` → `746` with five extracted graph-maintenance/linker/discovery files
- A follow-on validation sweep found APM test-surface drift after decomposition in `packages/apm/test/state-machines/__tests__/handler-correspondence.test.ts` and `packages/apm/test/unit/comms-integrity.test.ts`; those tests were updated to aggregate the decomposed EP-audit and message-router source families truthfully, clearing the remaining red APM suite.
- Requested noetic-pi validation is now green across builds and tests for `@noetic-pi/apm`, `@noetic-pi/shared`, `@noetic-pi/server`, `@noetic-pi/web`, `@noetic-pi/codegraph`, and `@noetic-pi/session-search`.
- One-component-per-file campaigns have now brought several previously oversized noetic-pi product files into compliance, including `packages/apm/src/implement.ts` (`793`), `packages/apm/src/plan.ts` (`779`), `packages/apm/src/db.ts` (`653`), `packages/apm/src/phronesis.ts` (`673`), `packages/apm/src/census.ts` (`741`), `packages/apm/src/succession.ts` (`739`), `packages/apm/src/implementer/implementation-case-history.ts` (`447`), `packages/apm/src/implementer/orchestration-runtime.ts` (`773`), `packages/apm/src/implementer/runtime-truth.ts` (`654`), and `packages/apm/src/implementer/variant-workspace.ts` (`367`).
- `packages/shared/src/apm-protocol.ts` was decomposed into the `packages/shared/src/apm-protocol/` family and then coherently consolidated so the family-root composition surface now lives at `packages/shared/src/apm-protocol/index.ts` (`739`). A parallel final-consolidation judgment on `packages/apm/src/plan.ts` correctly chose **not** to relocate `plan.ts`, judging it to remain the truthful public planner runtime/composition surface.
- The earlier immediate blocker was validation drift: a noetic-pi-only build/test sweep showed builds green while tests failed in `packages/apm/test/state-machines/__tests__/source-conformance.test.ts` and related source-conformance/state-machine expectation surfaces.
- That blocker has now been repaired without product-runtime changes by updating the conformance/communications-integrity tests to aggregate truthful source-family ownership across decomposed APM surfaces rather than assuming monolithic ownership in `implement.ts`, `plan.ts`, `phronesis.ts`, and `succession.ts`.
- The repaired noetic-pi validation surface is now green across builds and tests for the noetic packages: `@noetic-pi/apm`, `@noetic-pi/shared`, `@noetic-pi/server`, `@noetic-pi/web`, `@noetic-pi/codegraph`, and `@noetic-pi/session-search`.
- Continuity package for resumed refactoring remains `.working/one-component-per-file/LESSONS-AND-CONTINUITY.md` together with:
  - `.working/one-component-per-file/initial-brief.md`
  - `.working/one-component-per-file/component-cycle-protocol.md`
  - `.working/one-component-per-file/orchestrator-prompt-template.md`
  - `.working/one-component-per-file/orchestrator-mode-source-file.md`
- The currently ordered remaining oversized product-source targets selected by the user are:
  1. `packages/apm/src/ep-audit.ts`
  2. `packages/apm/src/index.ts`
  3. `packages/apm/src/plan-prompts.ts`
  4. `packages/server/src/http-routes.ts`
  5. `packages/web/src/sidebar.ts`
  6. `packages/web/src/main.ts`
- The next root should begin item 1 by dispatching a bounded orchestrator campaign for `packages/apm/src/ep-audit.ts`, with subagents using model `gpt-5.3-codex` per the governing one-component-per-file instructions.
- Separate project-analysis inquiries on `~/workspace/saeproj` completed this session:
  - EP audit `709c158b` → `.ep-audit/709c158b/report.md`
  - differentiated cognition cycle `d1d520e2` → `.phronesis/d1d520e2/`

### Latest Operational Update (2026-04-23)
- PR `#1` for `implement-file-slicing` was merged into `main`, but the user then reaffirmed a durable project rule: in-scope product source files must stay at or below `800` physical lines, counted exactly as stored with no semantic reinterpretation. When a change would push an in-scope product source file over the cap, the expected response is split/refactor rather than informal acceptance. Because legacy oversized governed files still remain in the repository, the present institutional gate is changed-file-only; unchanged oversized backlog may remain while work proceeds, and non-worsening is transitional backlog handling, not evidence of full-repository adequacy. A broader full-repository enforcement path remains future-only.
- Current post-merge boundary violations in the live codebase are:
  - `packages/apm/src/implement.ts` — 6091 lines
  - `packages/apm/src/implementer/orchestration-runtime.ts` — 2801 lines
  - `packages/apm/src/implementer/implementation-case-history.ts` — 2714 lines
  - `packages/apm/src/implementer/runtime-truth.ts` — 1737 lines
  - `packages/apm/src/implementer/variant-workspace.ts` — 1089 lines
  - `packages/apm/src/lifecycle.ts` — 932 lines
- A fresh post-restart orchestration verification sweep (`99955edc`) was run against branch `implement-file-slicing` and exercised worker → QA → remediation → terminal transitions successfully across three variants, with coherent `implementation_status`, `orchestration_status`, and `orchestration_diagnose` truth surfaces. That verification increased confidence in runtime seam integrity, but it did not cure the line-cap boundary failure.
- Strict boundary correction has now begun from the current live codebase. The first corrective slice is landed locally:
  - extracted implementer-specific spawn/retire helpers from `packages/apm/src/lifecycle.ts` into `packages/apm/src/lifecycle-implementer-agents.ts`
  - extracted prompt builders from `packages/apm/src/implement.ts` into `packages/apm/src/implementer/implementer-prompts.ts`
  - extracted orchestration topology creation into `packages/apm/src/implementer/orchestration-topology.ts`
  - rewired `implement.ts` / `lifecycle.ts` accordingly
- Post-slice line counts from that first correction:
  - `packages/apm/src/lifecycle.ts` — 695 (now within boundary)
  - `packages/apm/src/implement.ts` — 5699 (still over)
- Validation passed for the first corrective slice:
  - `pnpm --filter @noetic-pi/apm exec tsc --noEmit`
  - `cd packages/apm && pnpm exec vitest run test/unit/lifecycle.test.ts test/unit/implement.test.ts`
- Immediate next work is not discretionary cleanup but **strict enforcement of the <=800 physical-line boundary on changed in-scope product source files** through iterative plan → implement → QA cycles, using bounded, well-scaled work units. This is the current institutional gate while legacy oversized backlog remains; on QA failure, the next plan step becomes remediation planning; on QA success, the next plan step allocates the next bounded slice. Broader full-repository enforcement is a future path only, not present truth.

### Latest Operational Update (2026-04-22)
- User redirected the `implement.ts` redistribution effort away from executor/orchestration salvage and onto manual root-performed copy-and-strip on branch `implement-file-slicing`, using the committed fixture package under `packages/apm/test/fixtures/implement-file-slicing-mechanical/` as an informal guide rather than as a live truth surface that must still be mechanically satisfied end-to-end.
- The prior orchestration evidence remains governing forensic context only:
  - parent orchestration `36b859f4` is aborted
  - surviving forensic worktree remains `/home/dgk/workspace/.noetic-pi-worktrees/36b859f4/variant-1`
  - Waves 1–5 landed there, but Wave 6 remained blocked by the authority/manifold contradiction around `variant-workspace`
- Manual copy-and-strip in the root checkout has now progressed through Phases 1–6 without commits:
  - Phase 1 moved leaf helpers into `execution-path-policy.ts`, `required-input-ledger.ts`, `routing.ts`, `model-resolution.ts`, and `procedure-json.ts`
  - Phase 2 moved workspace-authority / merge-plan helpers into `workspace-authority-audit.ts` and `git-workspace.ts`
  - Phase 3 moved the variant-workspace substrate into `packages/apm/src/implementer/variant-workspace.ts`
  - Phase 4 moved pending-interaction / stalled-wave-legality helpers into `packages/apm/src/implementer/stalled-wave-legality.ts`
  - Phase 5 moved the case-history foundation substrate into `packages/apm/src/implementer/implementation-case-history.ts`
  - Phase 6 moved the case-history settlement / lineage / adjudication / amendment-persistence tail into `packages/apm/src/implementer/implementation-case-history.ts`
- Phase 3 truthfully confirmed the same structural fact that blocked executor Wave 6: `variant-workspace` is not a pure standalone top-level extraction island under rigid frozen mechanical authority. The manual path therefore accepted a bounded closure-aware access seam (`createVariantWorkspaceAccess(...)`) instead of treating that reality as a fresh blocker.
- The same bounded seam pattern is now also present where needed in later manual phases:
  - `createStalledWaveLegalityAccess(...)` for the Phase 4 legality/pending-interaction substrate
  - `createImplementationCaseHistoryAccess(...)` for the Phase 6 settlement/lineage tail
- Validation rerun green on the manual slicing surface:
  - Phase 1: targeted leaf-helper/unit surface + `pnpm --filter @noetic-pi/apm exec tsc --noEmit`
  - Phase 2: targeted workspace-authority/git-workspace surface + `pnpm --filter @noetic-pi/apm exec tsc --noEmit`
  - Phase 3: `test/unit/variant-workspace.test.ts`, `test/unit/implement.test.ts`, `test/integration/variant-execution-context.test.ts` + `pnpm --filter @noetic-pi/apm exec tsc --noEmit`
  - Phase 4: `test/unit/stalled-wave-legality.test.ts`, `test/unit/implement.test.ts` + `pnpm --filter @noetic-pi/apm exec tsc --noEmit`
  - Phase 5: `test/unit/implementation-case-history.test.ts`, `test/unit/implement.test.ts` + `pnpm --filter @noetic-pi/apm exec tsc --noEmit`
  - Phase 6: `test/unit/implementation-case-history.test.ts`, `test/unit/implement.test.ts`, `test/integration/implementation-orchestration-flow.test.ts` + `pnpm --filter @noetic-pi/apm exec tsc --noEmit`
- Immediate next work for the successor: continue manual Phase 7 by moving the git execution/verification helpers into `packages/apm/src/implementer/git-workspace.ts`, the lifecycle spawn/retire helpers into `packages/apm/src/lifecycle.ts`, and further stripping `packages/apm/src/implement.ts`, still without committing unless the user explicitly requests it.

### Latest Operational Update (2026-04-20)
- Runtime-truth corrective planner package under `.working/orchestration-runtime-investigation/planning/3c786017/` was first executed via the lower-level implementation pipeline as implementation `840eb1ac` on branch `runtime-truth-corrective-impl`.
- Waves 1 and 2 of that first run committed successfully:
  - Wave 1 commit `d631b8f8190efba63db205dce706f2844d97ed42`
  - Wave 2 commit `1afc17486cd240e3166607684ef10db2d77f7e85`
- Wave 3/WU5 exposed a real controller defect rather than only a package issue: operator guidance through `implementation_advance` could authorize bounded extra proof files in prose, but the controller had no implemented path to accept that override and ordinary `implementation_submit` continued to hard-reject the files.
- Fix committed on `runtime-truth-corrective-impl`:
  - `fa9fb26` — `fix(apm): support controller wu override acceptance`
- The fix adds a controller-side `wu_completion_override` JSON envelope on `wu_escalation` so `handleImplementationAdvance()` can complete the WU via shared submission logic with bounded additional allowed outputs instead of only forwarding guidance text to the agent.
- The first live implementation run `840eb1ac` was then aborted after restart-time recovery had already drifted the stuck WU5 remediation into wave-level limbo (`wave_failure_escalation`) and `recovery_failed`, making clean relaunch preferable to further live repair.
- Additional runtime-control-plane hardening landed after restart diagnostics showed the server actor was being retired too early during boot and therefore could miss visible-spawn succession notifications.
- Fix committed on `runtime-truth-corrective-impl`:
  - `311e986` — `fix(apm): protect server boot lifecycle`
- This fix (1) excludes `noetic-server` from generic bootstrap-timeout cleanup and (2) performs bounded stale-server singleton cleanup during APM init before the launcher re-registers the current server actor.
- A fresh lower-level implementation relaunch then executed successfully as implementation `aa0d2955` on branch `runtime-truth-corrective-impl-relaunch`.
- Accepted wave commits from the successful relaunch:
  - Wave 1: `0c3a59eba83424ae7f3ed586d811eba1b9fe1dc3`
  - Wave 2: `d824a00d80d7b302471f461595037247ed97f234`
  - Wave 3: `af2017b3ce5b8d61eabe1185714f92c0b6a5aaae`
  - Wave 4: `3abeeefa14ca9fa86b477ad3f6dbf0644eb44e2e`
  - Wave 5: `6b0d62cb4c8978ed81110803074e78c18ad07848`
  - Wave 6: `b52044912be3ada0ef03122a1026437e9abcadf2`
  - Wave 7: `2cc977bb4374e68683d618feb6d6370faa416c25`
  - Wave 8: `78144ce429bc7ff457c1046e22ee9836198269e6`
- Wave 4 required bounded manual operator remediation after QA exhaustion on WU6; the repaired tree was then re-entered into QA and the wave committed successfully.
- Wave 8 required bounded WU guidance to finish proof-surface truthfulness cleanup inside owned test files; it then committed successfully and the implementation completed.
- Full noetic validation/build surfaces were rerun green on the completed branch across APM, shared, server, web, codegraph, and session-search packages.
- A fresh follow-on planning spec draft was written at `.working/runtime-truth-followon-spec/README.md`, but a differentiated-cognition review judged it useful as a draft synthesis only and not yet ready to serve as the governing follow-on spec without revision.
- Immediate next work for the successor: review active/unhonored intentions with the user and select the next bounded work item from the now-updated baseline.
- Follow-on bounded planning package for the residual AI-0114 operator-surface gap was authored under `.working/ai-0114-summary-runtime-truth/3a1c4e9b/` and refined through planner pipeline `dfda23e2`, yielding:
  - `.working/ai-0114-summary-runtime-truth/3a1c4e9b/pipeline/dfda23e2/design.md`
  - `.working/ai-0114-summary-runtime-truth/3a1c4e9b/pipeline/dfda23e2/implementation-procedure.json`
- To make orchestration continuity-legal, the governing materials were promoted into committed fixture space under:
  - `packages/apm/test/fixtures/ai-0114-summary-runtime-truth/`
- Native orchestration `2ac8b905` then ran with 3 variants from branch `ai-0114-summary-impl-r2` with `qaIterations=3`.
- Variant outcomes:
  - `46bc4e41` / implementation `cceb80d6` — completed successfully through all 5 waves
  - `0497acab` / implementation `99ab8e0e` — failed terminal after QA-exhaustion blocker on WU8
  - `1375aa72` / implementation `f5d7b7bc` — failed terminal after QA-exhaustion blocker on WU8
- The successful variant branch `ai-0114-summary-impl-r2--orch-2ac8b905-v01` was validated green across shared, server, APM, web, codegraph, and session-search builds/tests/typechecks from its authoritative worktree.
- After a user-performed APM rebuild/restart, selection truth persisted correctly, variant `46bc4e41` was manually selected, and orchestration `2ac8b905` merged successfully as:
  - merge commit `15d5eb400872020b6aeb4abcde3479ac3f28244a`
- The lingering failed implementations (`99ab8e0e`, `f5d7b7bc`) were then explicitly aborted to clear stale IMPLEMENTATION-surface residue after merge.
- New active intention recorded from this run: **AI-0115** — separate controller/process blockers from product-code blockers by coupling bounded remediation guidance to verifier truth and by preventing shared-worktree overlap from dead-ending otherwise-complete WU submissions.
- Seeded follow-up working area:
  - `.working/orchestration-followup-controller-contract-mismatch/README.md`

### Latest Operational Update (2026-04-19)
- Succession `2026-04-19-succession-001` completed and the root agent worked the user-led messaging investigation directly instead of assuming the transport path in advance.
- Investigation state materially advanced from generic root-delivery suspicion to a more specific working problem statement: **stale root persistence** inside a load-sensitive control plane.
- A large multi-agent investigation sweep plus corrected-provider follow-up and replacement passes reviewed noetic-pi and pi-mono surfaces across routing, connection registry, recovery, server PTY/event/store paths, extension/APM channels, and pi-mono startup/auth/provider/session infrastructure.
- Consolidated investigation artifacts written this session:
  - `.working/hang-investigation-ranked-leads-2026-04-18.md`
  - `.working/hang-investigation-top-5-vectors-2026-04-18.md`
- Differentiated-cognition cycle `e5617854` completed over the top five vectors. Archive:
  - `.phronesis/e5617854/`
- Current governing judgment from that cycle and the subsequent log review:
  - the strongest lead is now **stale root persistence / missing stale-root auto-recovery**, coupled with control-plane/root transport fragility and amplified by heavy census/signal churn
  - server-side synchronous PTY/WebSocket/session-store pressure and pi-mono startup/auth/provider/session contention remain important secondary amplifiers
- A targeted APM log review (`.pi-agents/apm.log` plus rotations and `census-audit.log`) found:
  - repeated `notifyRole: no active agent with role 'root'`
  - repeated `handleRegister: rejecting registration for retired agent` for a long-retired prior root id
  - continued APM heartbeats/get_census/dispatch around many root-missing warnings, weakening the theory of a full APM freeze for many incidents
  - very high census/status churn, strengthening the control-plane amplification hypothesis
- During succession `2026-04-19-succession-002`, the stale-root investigation was deepened and evidence was consolidated under:
  - `.working/investigation/README.md`
  - `.working/investigation/stale-root-direct-evidence.md`
  - `.working/investigation/session-019da3fe-0cbf-direct-evidence.md`
  - `.working/investigation/session-019da3fe-0cbd-census-churn.md`
  - `.working/investigation/deep-dive-report-abstract.md`
  - `.working/investigation/claude-bridge-vs-standard-provider-test-plan.md`
- Strongest direct evidence now comes from transcript `.sessions/2026-04-19T04-27-08-863Z_019da3fe-0cbf-77e7-88ca-0ec9c70c0255.jsonl`, where a scout (`claude-bridge` / `claude-sonnet-4-6`) explicitly recognized a live request from a retired `stale-root` agent as concrete evidence that:
  - the retired agent’s PTY survived,
  - it reconnected after APM restart with preserved identity,
  - it ignored structured registration rejection due to missing success validation,
  - and it remained operational enough to request a report.
- Current best judgment after that evidence review:
  - primary cause family remains registration/state handling around stale-root persistence,
  - census/status churn remains an important amplifier,
  - `claude-bridge` mediation is now an explicit open amplifier question but not the current leading cause.
- The immediate next work for the successor should be to work with the user on a **response plan** grounded in the consolidated evidence package, preserving the distinction between:
  - stale-root persistence / recovery suppression
  - transport/routing fragility
  - server-side synchronous pressure
  - pi-mono amplifiers
  - possible bridge-mediated amplification
- The corrected Layer 1 planning package under `.working/codegraph-validation-plan/dbcf52ef/layer-1-parser-conformance/planning/` remains available for later user-directed return after the stale-root investigation.

### Latest Operational Update (2026-04-18)
- Successor root agent from succession `2026-04-18-succession-002` advanced the codegraph validation track and prepared a handoff package for the next root agent.
- `@noetic-pi/codegraph` now has a real multi-language parser import suite at `packages/codegraph/src/languages/__tests__/parser-imports.test.ts`, and the immediate parser defects surfaced by that suite were corrected in:
  - `packages/codegraph/src/languages/javascript.ts` (JavaScript `import_clause` extraction aligned with the existing TypeScript pattern)
  - `packages/codegraph/src/languages/go.ts` (Go import extraction corrected over `import_spec_list` / alias-bearing `import_spec` structure)
- Current focused codegraph validation truth on this branch:
  - `pnpm --filter @noetic-pi/codegraph test` ✅ (`47/47`)
  - `pnpm --filter @noetic-pi/codegraph build` ✅
- A differentiated-cognition cycle on external validation architectures completed and was materialized into a working package at `.working/codegraph-validation-plan/dbcf52ef/`, including:
  - per-layer plan directories `layer-1` through `layer-6`
  - `IMPLEMENTATION-SEQUENCING.md`
  - copied phronesis archive artifacts under `phronesis-archive/`
- Governing judgment from cycle `dbcf52ef`: adopt a layered validation architecture for `@noetic-pi/codegraph`, ordered as parser conformance → graph-semantic extraction fixtures → SCIP/LSIF structural sanity → selective LSP behavioral checks → thin local adjudication corpus → deferred retrieval/qrels evaluation.
- Additional external research gathered this session:
  - generalized validation-manifold survey across tree-sitter corpus tests, SCIP/LSIF, LSP harnesses, expected-query-result frameworks, and adjacent benchmark corpora
  - opencode architecture review showing strong LSP + watcher + ripgrep/fuzzysort integration, but no persisted codegraph backend comparable to noetic-pi/codegraph
- Immediate next work is live succession `2026-04-18-succession-003`: the next root agent should work with the user on invoking a design-intentions / design / procedure pipeline for the **first item** in `.working/codegraph-validation-plan/dbcf52ef/IMPLEMENTATION-SEQUENCING.md`.
- Important caution at handoff: the current worktree also contains large unrelated filesystem deletions under `.phronesis/` and `.working/implementer/` that were already present during succession prep and were not intentionally enacted as part of this session’s codegraph work; the successor should treat that residue carefully.

### Earlier Operational Update (2026-04-18)
- Successor root agent from succession `2026-04-17-succession-002` validated the merged `orchestration-process-improvement-impl-r2` branch truth and repaired two verification-surface issues truthfully:
  - server launcher signal listeners now unregister on shutdown (`a1dd4c3`)
  - APM handler/source correspondence drift was corrected by renaming the fail-fast internal helper out of the handler namespace (`a1dd4c3`)
  - broader noetic package validation was recorded at `902eecc`
- Current noetic-pi package truth on this branch (excluding `pi-mono`) was revalidated green across tests, builds, and typechecks before launching the next package.
- A current-state audit of the worktree-based variant manifold was completed through:
  - differentiated cognition cycle `7d4c715e`
  - EP audit `f5a7e6e9`
- Joint judgment of those audits: the branch has completed the **worktree-authority transition** but not yet the **hermetic-authority transition**. The chosen direction is to preserve authoritative managed worktrees and harden them into bounded hermetic enforcement rather than switching to full replicated workspaces.
- Governing spec written and committed:
  - `.working/implementation-pipeline/hermetic-worktree-enforcement-spec.md`
  - commit `f977c82` — `plans: commit hermetic worktree enforcement package`
- Planner pipeline `a576a2a8` generated a full design-intentions / design / implementation-procedure package for hermetic worktree enforcement under:
  - `.working/implementation-pipeline/hermetic-worktree-enforcement-plan/a576a2a8/`
- A Claude review agent judged the package `READY` after corrections tightening WU complexity, continuity-gate proof obligations, illegal transient-input semantics, and bounded host-prerequisite scope.
- Native orchestration `758f7b71` was launched with **3 variants** from committed base branch `hermetic-worktree-enforcement-impl-r1` after aborting an invalid first start attempt that referenced nonexistent branch `hermetic-worktree-enforcement-impl-r2`.
- The three completed variant branches were compared directly on fidelity, boundedness, and final contract coherence. Variant `a9610336` (`v02`) was judged strongest because it preserved the orthogonal continuity / host-prerequisite / runtime / boundary / readiness contract most coherently across shared/APM/server/docs surfaces while avoiding older boundary-attestation naming drift retained by the other variants.
- Orchestration `758f7b71` has now been manually selected and merged:
  - selected variant: `a9610336`
  - merged variant: `a9610336`
  - merge commit: `db18f59579d23d6eb5b7fd8a67b1386c9297f49a`
  - parent orchestration status: `complete`
- Post-merge validation on `hermetic-worktree-enforcement-impl-r1` found all noetic-pi package builds green and all noetic-pi package tests green (excluding `pi-mono`) after a bounded follow-up fix for two stale APM integration fixtures:
  - commit `5597c68` — `test(apm): align resume fixtures with hermetic contract`
  - the failing WU7 resume cases in `packages/apm/test/integration/variant-execution-context.test.ts` were judged stale expectations rather than a product regression; fixtures now seed the full continuity/host/boundary/readiness closure required by the merged hermetic contract.
- Local package state was also corrected so Claude bridge testing can be used again in future sessions:
  - `.pi/settings.json` now retains `npm:pi-claude-bridge`
  - `pi-claude-cli` was removed from the active package list
- Immediate next work is live succession `2026-04-18-succession-002`: the next root agent should work with the user on **AI-0084** (comprehensive parser import tests) and prefer a pipeline target that does not directly modify the implementation/orchestration pipeline itself.

### Latest Operational Update (2026-04-13)
- Sandbox implementation `693a790d` on orchestration branch `planner-quality-hardening-impl-r2--orch-8ad632b2-v01` was completed through all 6 waves after operator-guided recovery interventions.
- Postmortem written: `.working/adult-galaxy-run/postmortem-implementation-693a790d.md`.
- Diff-cog cycle `9160937f` (gpt-5.4, recommend-only) completed with staged corrective ordering (Stage 0 then Stage 1 then Stage 2 hardening).
- Unified Stage 0 + Stage 1 planning package generated via pipeline `e0b6ad14`:
  - `.working/stage0-stage1-corrective/plan-9160937f/e0b6ad14/design-intentions.md`
  - `.working/stage0-stage1-corrective/plan-9160937f/e0b6ad14/design.md`
  - `.working/stage0-stage1-corrective/plan-9160937f/e0b6ad14/implementation-procedure.json`
- Intention `AI-0110` recorded to execute that Stage 0 + Stage 1 corrective set as one coherent program.


### Codegraph Phases 3–4 (AI-0032)
CALLS global fallback fix, fullName corruption, transitive closure depth limits. Phases 1–2 complete.

### Comprehensive Language Parser Testing (AI-0062)
Test all 14 tree-sitter language parsers. The `import_clause` bug found in TypeScript likely exists in JavaScript parser too.

### Planner→Orchestrator Bridge Continuity (AI-0112)
Future bridge work is no longer framed merely as planner Phase 4 auto-dispatch. The governing requirement is now artifact continuity: if a planner-produced implementation procedure names files as required inputs, the APM planner→orchestrator bridge must guarantee those artifacts are available inside each managed variant worktree before agents start. Acceptable approaches include requiring those artifacts to be committed on the launch branch before orchestration or explicitly provisioning declared artifacts into worktrees under authoritative APM control. Any future `include_orchestration` / bridge implementation should be evaluated against this stronger continuity requirement first.

### Planner Quality Evolution Canonical Design Target (new)
Canonical design statement authored at `.working/planner/canonical-design-target-statement.md` from EP audit `ffc2322f` and DC cycle `204e4fcb`. Next work should stay design-abstraction-first and address the three approved hardening targets: (1) truthful latest-artifact identity threading into QA/remediation prompts, (2) structured QA issue persistence with unresolved/resolved lifecycle, and (4) machine-computed decomposition diagnostics as explicit QA inputs.

### Implementation Executor bridge-mode git validation relaxation + relaunch (active)
A first implementation run of planner-quality hardening (`implementationId: 3b85701c`) reached Wave 1 QA PASS and then escalated at commit stage (`commit_failure_escalation`) without concrete reason text exposed in the escalation payload. Branch was returned to pre-run state (`planner-quality-hardening-impl` reset to `8f317a1`) and run aborted per operator direction.

Immediate next work:
1. Apply narrow bridge relaxations in `packages/apm/src/implement.ts` (and related implementer tests) to reduce branch-mode git fragility while preserving bounded ownership checks:
   - path-allowlist-oriented output verification,
   - softer pre-commit no-change guard behavior,
   - better commit-failure diagnostics/retry handling,
   - explicit tolerance for executor-owned `.working/implementer/<implementationId>/` artifacts.
2. Keep direct scope; no orchestration/worktree redesign in this patch.
3. Re-launch the same planner-quality implementation procedure using the current config-backed runtime model policy for implementation/remediation and QA, with `qaIterations=3`, after patch validation.

### Implementation Pipeline Staged Completion — Step 4 bounded manual selection/merge subset complete (new)
Current-family orchestration capability records now live under:
- `.working/implementation-pipeline/orchestration-capability-current.md`
- `.working/implementation-pipeline/orchestration-logical-flow-current.md`

Step 1 truthfulness execution is complete on branch `planner-quality-hardening-impl-r2`: fail-closed variant worktree identity, truthful Tier 0 orchestration capability envelopes, planner orchestration gating, tool/record alignment, and public-handler integration proof landed through the accepted Wave 1–6 execution derived from `.working/implementation-pipeline/step_1/planning/927ae826/implementation-procedure.json`.

Step 2 sovereign owned asset lifecycle is complete through the accepted waves landed from `.working/implementation-pipeline/step_2/planning/db60158d/`, under governing spec `.working/implementation-pipeline/step_2/variant-owned-worktree-asset-lifecycle-spec.md`. Accepted work covers authoritative `variant_workspaces` persistence/migration, shared/server asset-state contracts, deterministic managed worktree provisioning primitives, runtime rebasing onto authoritative workspace rows for execution authority, public asset-state/status surfacing, and guarded owned-asset cleanup/reconciliation semantics on Tier 0 inspect/diagnose/repair surfaces. This establishes the owned workspace substrate required for truthful state reporting and bounded public orchestration authority.

Step 3 planning was generated under `.working/implementation-pipeline/step_3/planning/a71ae182/` from the governing spec `.working/implementation-pipeline/step_3/native-orchestration-tier1-spec.md`, and manual root orchestration completed the bounded Tier 1 lifecycle subset on `planner-quality-hardening-impl-r2`: `orchestration_initialize` creates a pre-start topology, `orchestration_start` delegates into the existing activation spine, `orchestration_abort` terminalizes the whole bounded manifold without cleanup, and `orchestration_abort_variant` terminalizes exactly one variant without replacement/select/merge side effects.

Step 4 planning was generated under `.working/implementation-pipeline/step_4/planning/8e7360b0/` from the governing spec `.working/implementation-pipeline/step_4/manual-selection-merge-tier1-spec.md`. Manual root orchestration has now accepted all Step 4 waves on the same branch:
- Wave 1 (`23872dd`) — merge-persistence/shared-contract/pure-eligibility foundations
- Wave 2 (`1348e82`) — select/merge contract plumbing and public-surface alignment
- Wave 3 (`86a4352`) — `orchestration_select` publicly real for bounded manual batch selection
- Wave 4 (`470a31d`) — merge authority / branch-lock / bounded git helper substrate
- Wave 5 (`8dd90aa`) — `orchestration_merge_variant` publicly real
- Wave 6 (`96a579f`) — planner/advance boundary defense plus end-to-end integration/conformance proof

Current truthful state is therefore:
- real now: `orchestration_initialize`, `orchestration_start`, `orchestration_advance`, `orchestration_abort`, `orchestration_abort_variant`, `orchestration_select`, `orchestration_merge_variant`
- still deferred: planner `includeOrchestration` enactment, callback/agent selection automation, incremental manual selection semantics, cleanup broadening, and control-plane extraction

Step 5 is now complete on `planner-quality-hardening-impl-r2` through the accepted waves landed from `.working/implementation-pipeline/step_5/planning/542de123/`:
- Wave 1 (`49b43d4`) — pending-interaction persistence substrate + abort cleanup foundation
- Wave 2 (`bfa923d`) — orchestration continuation helper substrate
- Wave 3 (`a3d0b59`) — bounded continuation generation
- Wave 4 (`85e097a`) — real bounded `orchestration_advance`
- Wave 5 (`b137742`) — truth-surface alignment
- Wave 6 (`cdcb4e2`) — integration / conformance proof

Step 5 completion truth is:
- `orchestration_advance` is now real as bounded continuation-resolution
- planner still does not dispatch orchestration
- `advance_mode` remains inert at orchestration level
- no callback/agent automation, incremental selection semantics, cleanup broadening, or control-plane extraction were introduced

The next immediate work is still **not** planner/orchestrator coupling. Live native orchestration validation was attempted with the trivial 3-variant wording procedure at `.working/orchestration-validation/plan-wording-smoke/procedure.json`, and that run revealed a real spatial defect: variant worktrees were provisioned correctly, but variant-bound agents executed in the main repository root instead of their assigned worktrees. That bounded Step 6 correction has now been landed manually from the execution-governing remediated procedure under `.working/implementation-pipeline/step_6/planning/5bb3a072/implementation-procedure-remediated.json` through accepted Wave 1–5 checkpoints:
- `b937cf9` — Wave 1 cwd transport substrate
- `b9c6ed9` — Wave 2 spawn-time workspace binding + bounded tests
- `94ff246` — Wave 3 verification workspace alignment
- `d20093d` — Wave 4 unit-test proof
- `3b33565` — Wave 5 integration proof

Current truthful state is that the in-repo Step 6 implementation proof package is complete. A separate live rerun of `.working/orchestration-validation/plan-wording-smoke/procedure.json` has now been attempted through native orchestration `e7bfbb8c` on `planner-quality-hardening-impl-r4`.

Observed live truth from that rerun:
- variant/worktree isolation succeeded across three variant worktrees
- the earlier runnable-contract carrier had overclaimed readiness by treating a narrower runtime-contract verdict as stronger closure than the launch gate had actually proven
- all three variants then failed at the same worktree-local verification substrate step: package/tooling resolution inside the isolated worktrees was not runnable for the required planner `pnpm` / `tsc` / `vitest` checks
- the orchestration was aborted to preserve that as the truthful outcome rather than forcing adjudicated continuation

Follow-up work on `planner-quality-hardening-impl-r4` has now landed as commit `e58b610` (`fix(apm): harden variant runtime truth and abort closure`):
- variant runtime profile / runtime-contract truth was tightened so variant preparation is no longer a no-op, shared build artifacts are part of validation truth, and the supported planner verification surface can be reproduced successfully inside a prepared variant worktree
- current status/diagnose truth now pivots on authoritative continuity, host prerequisite, runnable-workspace, boundary-attestation, and readiness axes rather than a single overclaimed runtime-contract success label
- orchestration-abort actionability closure was hardened so residual escalated implementations can be terminalized while preserving escalation/QA evidence

However, a new correctness issue was then exposed during live cleanup after APM rebuild/reload:
- manually aborting the three residual implementations (`5939ac6b`, `b62fd635`, `d055be70`) did clear implementation pending interactions and sidebar residue
- but it also appears to have rewritten preserved orchestration/variant truth for `e7bfbb8c`
- current observed state after those implementation aborts is:
  - orchestration `e7bfbb8c` reports `status='selection'`
  - variants report `status='aborted'`
  - whereas the prior preserved truthful result had been parent orchestration aborted with variants failed

The next remaining obligation is therefore now centered on this correctness issue: determine whether `implementation_abort` is over-synchronizing parent orchestration/variant state when closing residual variant-bound implementations, and restore a design that clears sidebar/actionability residue without mutating historical orchestration outcome truth.

### Worktree-substrate package validated for future use (new)
The generated package under `.working/implementation-pipeline/worktree-substrate-best-practices/ffb4b214/` was amended, re-reviewed, and manually executed through Waves 1–7 on branch `planner-quality-hardening-impl-r2`. It is now treated as a validated governing artifact for future use rather than something to launch again immediately. Checkpoint chain:
- `fde5c68` — Wave 1 runtime profile + workspace schema
- `790458d` — Wave 2 bootstrap/helper/policy layer
- `a895be0` — Wave 3 runnable-workspace gate
- `b53a31c` — Wave 4 runtime-contract truth surfaces
- `5e33ae6` — Wave 5 cleanup eligibility policy
- `a470612` — Wave 6 cross-package proof coverage
- `8e1805d` — Wave 7 real worktree closure proof
Separate forward fix retained distinctly:
- `111d22c` — `fix(shared): tree-shake-safe node:* imports in runtime-profile`

### Succession preflight validation boundary fix (new)
Succession preflight no longer uses root-recursive `pnpm test` as the handoff gate. The canonical targeted validation surface is now encoded in `packages/apm/src/test-gate.ts` and checked by succession preflight instead:
- `pnpm --filter @noetic-pi/shared build`
- `pnpm --filter @noetic-pi/shared test`
- `pnpm --filter @noetic-pi/server test`
- `pnpm --filter @noetic-pi/server typecheck`
- `pnpm --filter @noetic-pi/apm exec tsc --noEmit`
This reflects current project evolution: `pi-mono/packages/*` participates in workspace dependency/bootstrap resolution, but `pi-mono` still behaves as its own toolchain root for full build/test ownership.

### Validation-boundary follow-up (new)
Even after the succession-preflight fix, two repo-level follow-ups remain open:
1. root-recursive `pnpm -r build` overreaches the true toolchain boundary after workspace extension because `tsgo` is only available under `pi-mono/node_modules/.bin`
2. `pi-mono/packages/tui` currently has a failing test (`debounces @ autocomplete while typing`) that is branch-relevant and should be investigated separately

### Stage 0 + Stage 1 corrective package generated (new)
A unified corrective planning package for cycle `9160937f` is now generated at:
- `.working/stage0-stage1-corrective/plan-9160937f/e0b6ad14/design-intentions.md`
- `.working/stage0-stage1-corrective/plan-9160937f/e0b6ad14/design.md`
- `.working/stage0-stage1-corrective/plan-9160937f/e0b6ad14/implementation-procedure.json`

Intention recorded: `AI-0110` (Stage 0 + Stage 1 as one coherent program).

Immediate next work is decision-level, not execution-level:
1. successor reviews generated package for scope/fidelity,
2. successor and user choose execution mode (pipeline vs manual orchestration),
3. only then launch implementation against the generated procedure.

### Session Re-Index (AI-0057)
Run `session_index({ reset: true })` after classification schema reform (dropped `cognitional_mode`, added `session_texture`).

---

## Foundational Layer Structure

| Layer | Content | Location |
|-------|---------|----------|
| 0 | Source materials (invariant) | `.method_sources/` |
| 1 | Articulated invariants | `.method/imperatives.md` |
| 2 | Operational constitution | `.method/constitution.md` |
| 3 | Agent directive | `ROOT_PROMPT.md` |
| 4 | Operational record | `LOG.md`, `PROJECT.md`, tool-managed records |
| 5 | Prompt fragments | `.method/prompts/` |
| 6 | Session initialization | Re-entry protocol |

**Principle:** Later layers cannot function unless earlier layers are present and functioning.

---

## Self-Development Constraints

This project is used for its own development. Three tiers of change govern agent behaviour during development:

| Tier | Scope | Restart |
|------|-------|---------|
| 1 | `packages/web/src/` | Browser refresh (user-discretion) — session survives |
| 2 | `packages/server/src/` | Auto via tsx --watch — **session disrupted** |
| 3 | `packages/apm/src/` | Rebuild + full restart (user-only) — **session disrupted** |

Full protocol: `.method/prompts/self-development-protocol.md`

**Immutable norm:** APM restart is a user-only operation.

---

## Conventions

- `pnpm test --filter @noetic-pi/<pkg>` — run tests for a package
- `pnpm --filter @noetic-pi/<pkg> typecheck` — TypeScript check
- `pnpm --filter @noetic-pi/<pkg> build` — compile (APM: required before restart)
- Git operations via raw bash — no structured git tools in this environment
- All file I/O via `Read`/`Edit`/`Write` tools — not bash cat/echo/sed
- Operational records (questions, intentions, decisions) via tools only — do not edit backing files directly

---

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 0.1.0 | 2026-03-16 | — | Initial instance |
| — | 2026-03-24 | Feature | Ordinal identity system — replaces captain/crew with ordinal-based delegation tree |
| 0.2.0 | 2026-03-26 | Feature | Codegraph fixes, E-D signal wrapper, E-B condition evaluator, D009 model configuration, bootstrap timeout cleanup, plan cascade/notification fixes |
| 0.3.0 | 2026-03-27 | Feature | Implementation executor — APM-owned orchestration of structured implementation procedures |
