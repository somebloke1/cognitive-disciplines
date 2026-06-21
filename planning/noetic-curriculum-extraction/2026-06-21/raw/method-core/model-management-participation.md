# Model Management Participation Declaration (DI-4.1)

New subsystems that assign or manage model selection must declare:

1. **Selection strategy** — one of: cli-flag, settings-default,
   user-interactive, api-request, inherited-from-initiator, fallback
2. **Fallback chain** — explicit, with reasons
3. **Semantic layer** — identity / available / reachable
4. **DI-2.2 compliance** — configurable (a), declared fallback (b),
   availability check (c), observable (d). Non-compliant: issue ref + migration path.

## Current Subsystem Declarations

| Subsystem | Strategy | Fallback | Layer | DI-2.2 | Migration |
|-----------|----------|----------|-------|--------|-----------|
| TUI selector | user-interactive | 5-level priority chain | available | ✅ all | — |
| Web UI | api-request | none | reachable (via /models) | ⚠️ (c) | Phase 7 |
| Phronesis | inherited-from-initiator | configurable default | identity (census) | ⚠️ (b)(c) | Phase 4 |
| EP audit | inherited-from-initiator | pi default resolution | identity (census) | ⚠️ (b)(c) | Phase 2 |
| Succession | cli-flag | pi default resolution | identity | ⚠️ (b)(c) | TBD |
| Free spawn | inherited-from-initiator | pi default resolution | identity | ⚠️ (b)(c)(d) | TBD |
| `agent_spawn` tool | inherited-from-initiator | currentCtx.model | available | ⚠️ (c) | TBD |
| `mom` | hardcoded | none | identity | ❌ all | Issue #63 |

## Notes on Columns

- **Strategy:** The primary source of model selection for this subsystem
- **Fallback:** What happens if the primary strategy yields no model
- **Layer:** Which semantic layer (Identity/Available/Reachable) the subsystem operates on
- **DI-2.2:** Compliance with uniform minimum capability standard:
  - (a) Configurable selection
  - (b) Declared fallback chain
  - (c) Availability check
  - (d) Observable current model
- **Migration:** Phase where compliance gaps are addressed, or "—" if fully compliant

## Compliance Path

Subsystems marked with ⚠️ are scheduled for compliance improvements in subsequent phases. See `.working/model-management-design.md` §6 (Migration Path) for the complete phase sequence.

The `mom` subsystem (hardcoded Claude Sonnet 4.5) requires special attention due to its zero compliance. Issue #63 tracks the refactor required to align with DI-4.1 and DI-2.2.

## Future Subsystem Declaration

When adding a new subsystem that selects or manages models:

1. Add a row to the table above
2. Specify selection strategy (from the list above, or new value if justified)
3. Specify fallback chain with rationale
4. Specify semantic layer (must be one of: identity, available, reachable)
5. Assess DI-2.2 compliance (all four points required for ✅)
6. If non-compliant, issue a GitHub issue and link it in the Migration column
7. Document the declaration in a comment in your subsystem code
