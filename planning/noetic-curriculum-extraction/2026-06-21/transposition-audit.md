# Noetic Curriculum Transposition Audit

## Purpose

Identify where the current `cognitive-cycle` plugin still under-transposes the
educational and behavior-reinforcing surface of the extracted noetic-pi
curricula, prompts, and APM harness.

This is not a request to paste raw noetic-pi material into the public plugin.
The public plugin should receive compressed specialist priming, artifact gates,
packet templates, and controller rules.

The target is a reasonable, balanced, and well-composed representation of the
source behavioral priming. The plugin should make agents feel and enact the
discipline of P1/P2/P3/P4, but it cannot and should not express the full source
curriculum in runtime instructions.

## Source Surfaces Reviewed

- `raw/method-prompts/phronesis-overview.md`
- `raw/method-prompts/phronesis-p1.md`
- `raw/method-prompts/phronesis-p2.md`
- `raw/method-prompts/phronesis-p3.md`
- `raw/method-prompts/phronesis-p4.md`
- `raw/method-prompts/phronesis-grounding-preamble.md`
- `raw/method-prompts/phronesis-fresh.md`
- `raw/method-prompts/phronesis-accumulated.md`
- `raw/method-curricula/differentiated-cognition.json`
- `raw/method-curricula/emergent-probabilistics.json`
- `raw/method-core/imperatives.md`
- `raw/method-core/constitution.md`
- `raw/apm-src/curriculum.ts`
- `raw/apm-src/phronesis-agent-lifecycle.ts`
- `raw/apm-src/phronesis-grounding-protocol.ts`
- `raw/apm-src/phronesis-progression-engine.ts`
- `raw/apm-src/phronesis-content-archive.ts`
- `raw/apm-tests/phronesis-flow.test.ts`
- `raw/apm-tests/ideal-conformance-phronesis/*.test.ts`

## Core Finding

The plugin has transposed the phase order, packet shape, same-phase integration
roles, and some acceptance gates. It has not yet fully transposed the source
curriculum's educational pressure: repeated operational characterization,
sufficiency/insufficiency examples, reflective grounding deliverables,
epistemic-horizon alignment, concrete developmental lenses, and immediate
submission/recall discipline.

The resulting skills are structurally correct but still lighter than the
noetic-pi curriculum. They tell agents what role they are playing, but only
partially shape how that role should feel, fail, and correct itself.

## Transposition Gaps

### 1. Characterizing Qualities Were Too Weak

Source evidence:

- `imperatives.md` names P1 Growth, P2 Fecund, P3 Selective, and P4
  Volitional as characters of the operations.
- `constitution.md` expands these into active characterization, proliferative
  intelligence, evidence-grounded selection, and declarative condition-setting.
- The phase prompts repeatedly say what the operation means before they tell the
  agent what to output.

Current plugin state:

- The skills named Growth, Fecundity, Selection, and Volition in scattered
  prose, but did not consistently make them the specialist's characterizing
  quality.

Required transposition:

- Each specialist primer should include a short `Characterizing Quality`
  section:
  - P1: Growth through high-fidelity attention.
  - P2: expansive Fecundity.
  - P3: narrowing Selection without premature closure.
  - P4: responsible Volition.
  - P1 curator: curatorial fidelity.
  - P2 integrator: ordered fecundity.
  - P3 dialectician: dialectical selectivity.
  - P4 evaluator: evaluative responsibility.

Status:

- Addressed in the current working tree for P1-P4, same-phase integration
  skills, and the shared primer as compressed behavioral priming.

### 2. Sufficiency And Insufficiency Examples Are Under-Represented

Source evidence:

- `phronesis-p1.md` defines sufficient P1 by whether another agent can use only
  the characterization to understand the data.
- `phronesis-p2.md` defines insufficient P2 as surface variants, ignored P1
  data, or disguised recommendation.
- `phronesis-p3.md` gives concrete signs for returning to P1 and P2.
- `phronesis-p4.md` contrasts concrete decision with vague endorsement.

Current plugin state:

- Acceptance gates contain reject/accept bullets, but the phase skills do not
  sufficiently internalize the source prompt's educational examples.

Required transposition:

- Add compressed `Sufficient When` / `Insufficient When` blocks to each phase
  skill, using source-derived examples.
- Keep this as semantic guidance for agents, not deterministic regex checks.

### 3. Grounding Was Collapsed From Staged Curriculum Into A Generic Note

Source evidence:

- APM requires `phronesis_role_ack` before grounding.
- `phronesis-grounding-preamble.md` tells agents they will progress through
  staged grounding.
- `curriculum.ts` enforces tasking and post-tasking stages.
- `differentiated-cognition.json` gives each phase operation-specific
  reflection prompts over three source documents.
- `emergent-probabilistics.json` gives longer pre-tasking source stages for EP
  audit work.

Current plugin state:

- `curriculum-primers.md` requires a grounding note, but not a staged grounding
  artifact with stage-specific reflection deliverables.

Required transposition:

- Add a compact `Grounding Artifact` template:
  - role acknowledged;
  - characterizing quality restated;
  - orienting question and implicit unknown restated;
  - source/material scope acknowledged;
  - operation-specific reflection completed;
  - forbidden work acknowledged;
  - expected packet and handoff named.
- For source-heavy work, require three short stage reflections:
  - invariant operation/character;
  - emergent probability or domain-theory lens;
  - development/condition-setting lens.

### 4. Epistemic Horizon Alignment Is Too Thin

Source evidence:

- `curriculum.ts` assembles an `EPISTEMIC HORIZON` block with orienting question
  and implicit unknown.
- It instructs every finding, possibility, judgment, or decision to be evaluated
  against whether it resolves the implicit unknown.
- Submissions carry an alignment rationale.

Current plugin state:

- Manifest and packet headers include `orienting_question` and
  `implicit_unknown`.
- Gates reject missing/misaddressed values, but packets do not require an
  explicit alignment rationale in every phase.

Required transposition:

- Add `epistemic_alignment` or `alignment_rationale` to packet expectations:
  how this packet advances the orienting question and implicit unknown.
- Add this to semantic review: reject packets that mention the horizon but do
  not orient their actual content toward it.

### 5. Accumulated Context Retrieval Is Not Forceful Enough

Source evidence:

- `phronesis-overview.md` says each agent receives all prior output, labeled and
  ordered, and nothing is discarded.
- `phronesis-content-archive.ts` formats accumulated content by phase/pass.
- Recall agents are told to call `phronesis_get_context` before working.

Current plugin state:

- The full-cycle skill tells downstream agents to read accumulated packets, and
  the archive scripts preserve packets.
- Phase skills still sometimes read as if the immediately prior packet is
  enough.

Required transposition:

- Strengthen each phase's input rule:
  - P2 reads accepted P1 and any prior recursion feedback.
  - P3 reads the whole P1/P2 accumulated record.
  - P4 reads all P1/P2/P3 packets and recursion feedback, not just P3 handoff.
  - Same-phase integrators inventory every peer packet before integrating.

### 6. Recursion Discipline Needs More Source-Derived Behavioral Pressure

Source evidence:

- `phronesis-p3.md` says default posture is skepticism, not endorsement.
- It says most non-trivial cycles require at least one return.
- It defines return-to-P1 and return-to-P2 conditions concretely.
- `phronesis-progression-engine.ts` enforces recursion only from P2-P4 to prior
  operations, rejects P1 recursion, rejects forward recursion, and stops at
  recursion limit.

Current plugin state:

- Recursion fields and transition matrix exist.
- P3 skill has some recursion triggers, but the "default skepticism" and
  concrete return signs need more force in phase priming and semantic gates.

Required transposition:

- Add source-derived return signs to P3 gate:
  - key orienting terms absent from P1;
  - P1 claims without evidence anchors;
  - P2 outputs map to a familiar taxonomy rather than P1-specific data;
  - no disruptive/high-risk possibility when the evidence warrants one.
- Keep legality deterministic and meaning semantic.

### 7. Developmental Lenses Are Present But Too Optional

Source evidence:

- `differentiated-cognition.json` gives operation-specific prompts using
  emergent probability, emergent fidelity, and notion of development.
- Concepts include schemes of recurrence, conditioned series, blind alleys,
  breakdowns, scotosis, operator/integrator, correspondence, limitation,
  transcendence, genuineness, and next-cycle manifold modification.

Current plugin state:

- The EP audit output section mentions many terms.
- Ordinary phase skills do not require agents to use these lenses when the task
  is source-heavy, architectural, developmental, or EP-audit-like.

Required transposition:

- Add a routing rule:
  - Use the developmental lenses when the task concerns architectures, agent
    frameworks, curricula, codebase evolution, governance, proposals, or
    repeated-cycle transformation.
  - Do not force the lenses on trivial tasks.
- Add phase-specific lens prompts in compressed form.

### 8. Immediate Submission / No Conversational Hedging Was Not Transposed

Source evidence:

- P1, P2, and P4 prompts say to submit immediately when complete and not ask
  whether the work is sufficient.
- APM kills or retires submitting agents after submission to prevent
  post-submission tool use.

Current plugin state:

- Codex skills cannot kill the agent or enforce tool-only submission.
- The plugin does not yet give an equivalent behavioral rule.

Required transposition:

- Add a controller rule:
  - Phase agents return one packet and stop.
  - They do not ask the controller whether to continue unless blocked by missing
    authority/source access.
  - Repair/recurse is a controller/P3 decision, not the producing phase's
    conversational negotiation.

### 9. Mode Constraint Is Strong In Harness But Softer In Plugin

Source evidence:

- P4 role acknowledgment injects a hard prohibition block for recommend-only and
  decision-only modes.
- Tests verify the mode prohibition appears for P4 and not for earlier phases.

Current plugin state:

- P4 skill and gates mention mode/authority.
- The hard prohibition wording has not been transposed into the controller
  transition and P4 packet/gate with enough force.

Required transposition:

- Add explicit P4 mode prohibition language:
  - recommend-only: no file edits, commands that modify state, commits, pushes,
    or enactment.
  - decision-only: may record decision only if authorized; no implementation.
  - decide-and-enact: only actions explicitly authorized by manifest.

### 10. Test-Derived Harness Invariants Are Not Fully Mirrored

Source evidence:

- Tests cover role acknowledgment, grounding stage order, submit rejection
  during grounding, wrong-operation rejection, recursion legality, terminal
  containment, recovery, and schema retries.

Current plugin state:

- The Python validator covers archive structure, packet shape, phase-specific
  fields, P3 outcome legality, same-phase cardinality, model policy, and
  semantic-review references.
- It does not check grounding artifacts, alignment rationales, or controller
  transition ledgers.

Required transposition:

- Extend archive/validator support for:
  - grounding artifacts;
  - `alignment_rationale` fields;
  - transition ledger entries;
  - explicit terminal state records.

## Recommended Implementation Order

1. Keep the current characterizing-quality edits and add matching sections to
   same-phase integration skill bodies.
2. Add a shared `grounding-artifact-template.md` reference and require it in the
   full-cycle controller protocol.
3. Extend packet contract and validator with `alignment_rationale` /
   `epistemic_alignment`.
4. Strengthen P3 acceptance gates with source-derived return signs.
5. Add P4 hard mode-prohibition language to the P4 skill, P4 gate, and
   controller transition matrix.
6. Add compact `Sufficient When` / `Insufficient When` blocks to P1-P4 skills.
7. Add validator support for grounding artifacts and transition ledger entries.

## Boundary

Do not turn source phrases into superficial labels. The value of the noetic-pi
curriculum is that it repeatedly conditions behavior before action: role,
quality, source relation, sufficiency, failure modes, and legal transition. The
plugin should transpose those pressures into compact public skills and durable
artifacts while preserving the distinction between deterministic harness
mechanics and language-model cognitive judgment.
