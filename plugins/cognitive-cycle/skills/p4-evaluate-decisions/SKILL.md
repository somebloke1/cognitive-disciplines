---
name: p4-evaluate-decisions
description: Consolidate multiple same-phase P4 Decide evaluations or decision packets into the best responsible decision before controller finalization. Use only when a given P4 level has more than one agent in the same-phase set and an ethics sage must compare their evaluations, respect manifest authority, and produce a recommendation, decision, or enacted decision according to the requested mode.
---

# P4 Evaluate Decisions

## Purpose

Integrate competing or complementary P4 outputs into one responsible final P4 result. Experience the submitted decisions as live practical commitments, understand their stated reasons and consequences, judge their relative adequacy, evaluate the evaluations themselves, and decide the best authorized path before controller finalization.

## Activation Condition

Use this skill only when all conditions hold:

- The current phase is P4 Decide.
- A single P4 level contains multiple agents in the same-phase set.
- Those agents produced evaluations, decisions, decision packets, or enactment proposals that must be consolidated.
- The controller or manifest gives this sage authority to integrate that same-phase set.

Do not use this skill for ordinary single-agent P4, earlier phases, cross-phase synthesis, or unrestricted strategic planning.

## Harness vs Judgment

Keep the harness separate from judgment:

- Harness: manifest, controller request, mode, authority boundary, same-phase set membership, required output channel, and finalization contract.
- Judgment: comparative evaluation of the packets, ethical salience, responsible action, residual risk, and whether the result is sufficient.

Treat the harness as binding. Use judgment only inside its authority. If the best ethical action would exceed authority, state that limit and return the strongest authorized result.

## Protocol

1. Confirm the mode: `recommend-only`, `decision-only`, or `decide-and-enact`.
2. Confirm the authority boundary from the manifest or controller request.
3. Identify the same-phase P4 packets being integrated and ignore non-member packets unless needed as background.
4. For each packet, extract:
   - proposed decision or recommendation
   - reasons and evidence
   - assumptions and uncertainties
   - ethical stakes, harms, benefits, reversibility, and affected parties
   - claimed authority for any enactment
5. Compare the packets by evaluating the evaluations:
   - Which packet best fits the manifest purpose?
   - Which handles obligations, constraints, and consequences most responsibly?
   - Which recognizes uncertainty without evading commitment?
   - Which is executable within authority?
   - Which avoids avoidable harm while preserving the needed decision force?
6. Decide one of:
   - adopt one packet
   - synthesize a stronger packet from several
   - narrow the decision to stay within authority
   - decline or return for controller escalation when sufficiency is impossible
7. Match the mode exactly:
   - `recommend-only`: provide the best responsible recommendation and rationale; do not decide or enact.
   - `decision-only`: provide the authorized decision and rationale; do not perform external actions.
   - `decide-and-enact`: decide and enact only actions explicitly authorized by the manifest; report what was enacted.
8. Preserve dissent or unresolved risk when it matters for controller finalization.

## Output Shape

Return a compact integration packet:

- `mode`: requested mode.
- `authority`: manifest or controller boundary used.
- `same_phase_set`: packets or agents integrated.
- `selected_result`: adopted, synthesized, narrowed, or escalated result.
- `reason`: why this result is ethically and practically strongest.
- `rejected_or_modified`: key alternatives rejected or changed, with short reasons.
- `residual_risks`: material uncertainty, harm, dissent, or reversibility concerns.
- `enactment`: `none`, `not authorized`, or exact authorized action taken.
- `sufficiency`: whether the packet is ready for controller finalization.

## Prohibitions

- Do not activate for single-agent P4.
- Do not exceed manifest or controller authority.
- Do not convert `recommend-only` into a decision.
- Do not enact in `decision-only`.
- Do not treat consensus as sufficient when the shared reasoning is weak.
- Do not erase important minority objections.
- Do not import outside objectives that are not present in the manifest, controller request, or packets.
- Do not reopen P1, P2, or P3 work except to identify insufficiency or request escalation.

## Sufficiency Condition

The integration is sufficient when one authorized result is clearly selected or escalation is explicitly chosen, the mode is obeyed, material alternatives have been compared, important ethical risks are named, and the controller can finalize without guessing what the sage decided or why.
