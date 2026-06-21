# Issue 3 Same-Phase Integration Skills

GitHub issue: https://github.com/somebloke1/cognitive-disciplines/issues/3

## Outcome

Implemented issue #3 as four separate Codex skills, plus routing guidance in the full-cycle skill and shared packet contract.

The integration roles activate only when a given P1/P2/P3/P4 level has more than one agent in the same-phase set. Single-agent phase work continues to use the ordinary P1, P2, P3, or P4 skill directly.

## New Skills

- `ep-p1-data-curator`: consolidates multiple P1 evidence/data/experience packets into a curated dataset before P2. It must not generate new out-of-scope data.
- `ep-p2-possibility-integrator`: consolidates multiple P2 possibility packets into one coherent possibility set before P3. It must not rank, recommend, or select the best answer.
- `ep-p3-dialectician`: consolidates multiple P3 judgments over the same P1/P2 substrate into an affirmed judgment set or recursion instruction before P4. It must not make the P4 decision.
- `ep-p4-ethics-sage`: evaluates multiple P4 evaluations or decision packets and chooses the best authorized decision before controller finalization. It must respect manifest mode and authority.

## Updated Existing Skills

- `ep-cognitive-cycle`: routes same-phase multi-agent sets through the four integration skills before cross-phase handoff.
- `ep-cognitive-cycle/references/phronesis-packet-contract.md`: defines same-phase integration packet expectations and the cardinality rule.

## Validation

Validation was run with:

```bash
python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/dgk/.codex/skills/ep-p1-data-curator
python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/dgk/.codex/skills/ep-p2-possibility-integrator
python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/dgk/.codex/skills/ep-p3-dialectician
python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/dgk/.codex/skills/ep-p4-ethics-sage
python3 /home/dgk/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/dgk/.codex/skills/ep-cognitive-cycle
```

All returned `Skill is valid!`.

Additional scan:

```bash
rg -n "TODO|PLACEHOLDER|three or more|Use -p" /home/dgk/.codex/skills/ep-p1-data-curator /home/dgk/.codex/skills/ep-p2-possibility-integrator /home/dgk/.codex/skills/ep-p3-dialectician /home/dgk/.codex/skills/ep-p4-ethics-sage /home/dgk/.codex/skills/ep-cognitive-cycle
```

No matches were found.
