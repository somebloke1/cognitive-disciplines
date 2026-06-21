---
name: ep-p3-judge
description: Judge P1 evidence and P2 possibilities for emergent-probability audits, disciplined cognitive cycles, proposal evaluations, architecture investigations, and any task that asks Codex to "judge", "select", "assess sufficiency", "recurse", or perform the P3/Selection operation before a decision.
---

# EP P3 Judge

## Purpose

Use this skill to perform P3: reasonableness as Selection. Your job is to judge whether the evidence and possibilities are sufficient, select what is best supported, and decide whether the cycle must recurse to P1 or P2 before P4 can responsibly decide.

For a compact source-grounding summary, read [references/ep-discipline.md](references/ep-discipline.md) when the task concerns EP audit or curriculum-derived cognitive-cycle source materials.

For team, legion-scale, or full-cycle work, use the shared packet contract at [../ep-cognitive-cycle/references/cognitive-cycle-packet-contract.md](../ep-cognitive-cycle/references/cognitive-cycle-packet-contract.md). P3 emits either a recursion packet or a P4 handoff packet.

## Inputs

Use the P1 characterization and P2 possibilities. If either is missing, explicitly say whether you can judge from the available substrate or whether the correct result is recursion.

## Harness vs Judgment

The soft harness supplies accumulated packets, recursion budget, phase order, and output shapes. P3 judgment decides whether P1 evidence and P2 possibilities are sufficient, which possibilities survive evidence, and whether recursion is required. A controller can route a recursion packet, but P3 must make the sufficiency judgment.

## Protocol

1. Test P1 sufficiency.
   - Are the authoritative sources inspected?
   - Are key terms from the orienting question present in the evidence?
   - Are observations distinguished from inferences?
   - Are absences and contradictions named?
   - Does the evidence address the implicit unknown?

2. Test P2 sufficiency.
   - Are there 3-7 structurally distinct possibilities?
   - Are they grounded in P1 rather than generic taxonomy?
   - Do they include non-obvious or uncomfortable alternatives where appropriate?
   - Are assumptions explicit?

3. Judge each possibility.
   - Affirm, reject, or hold as inconclusive.
   - Ground the judgment in specific evidence.
   - For EP audits, assess scheme health, conditioning strength, survival/emergence probability, breakdown risk, blind-alley risk, and proposal/substrate correspondence.

4. Choose one of three outcomes.
   - Return to P1 when the data is inadequate. Specify exactly what must be inspected or characterized.
   - Return to P2 when the data is adequate but the possibilities are narrow, derivative, or missing a live alternative.
   - Advance to P4 when evidence and possibilities are sufficient for responsible decision.

5. Packetize the outcome.
   - If returning, include `target_phase`, `reason`, `required_work`, `evidence_gap_or_possibility_gap`, `prior_packet_ids`, and `budget_status`.
   - If advancing, include the selected judgment, rejected alternatives, residual uncertainties, and exact decision basis for P4.
   - In team or legion-scale runs, update or request updates to the contradiction, duplicate, and uncertainty registers.

## Output Shape

Use one of these headings:

- `Return to P1`
- `Return to P2`
- `Advance to P4`

Then include:

- Sufficiency finding
- Evaluations of each possibility
- Selected/affirmed judgment
- Rejected or inconclusive alternatives and why
- Exact recursion instruction if returning
- Decision basis for P4 if advancing
- Recursion ledger entry, if returning
- P4 handoff packet, if advancing

## Discipline

Default to skeptical sufficiency, not endorsement. P3 may be the only barrier against premature closure. Do not generate new major possibilities unless naming a P2 gap. Do not make the final commitment; that belongs to P4.
