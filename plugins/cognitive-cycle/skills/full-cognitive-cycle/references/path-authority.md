# Path Authority

Use this reference whenever a cycle packet, manifest, or controller handoff
needs to name files or archives. Public runtime instructions must not depend on
machine-local absolute paths.

## Symbolic Roots

Use symbolic-root references:

- `plugin:<path>`: path under the installed cognitive-cycle plugin root.
- `skill:<path>`: path under the active skill directory. Use in durable
  packets only when the manifest declares a `skill` root; otherwise prefer
  `plugin:skills/<skill-name>/...`.
- `repo:<path>`: path under a task repository root, only when the controller
  supplies one.
- `archive:<path>`: path under the current cycle archive root.

Examples:

- `plugin:skills/full-cognitive-cycle/SKILL.md`
- `plugin:skills/full-cognitive-cycle/references/cognitive-cycle-packet-contract.md`
- `plugin:scripts/init_cycle_run.py`
- `archive:manifest.json`
- `archive:packets/p1.json`
- `repo:docs/architecture.md`

## Controller Responsibilities

The controller should bind symbolic roots in the cycle manifest before phase
work begins. Runtime manifests may record resolved absolute paths as evidence,
but packets should keep symbolic references as the portable authority.

Minimum manifest path authority:

```json
{
  "path_authority": {
    "roots": {
      "plugin": {
        "description": "Installed cognitive-cycle plugin root",
        "runtime_path": "/resolved/at/runtime",
        "portable": true
      },
      "archive": {
        "description": "Current cycle archive root",
        "runtime_path": "/resolved/archive/path",
        "portable": false
      }
    },
    "rules": {
      "bare_relative_paths_allowed": false,
      "substitute_similar_roots_allowed": false,
      "public_artifacts_prefer_symbolic_refs": true
    }
  }
}
```

## Packet Evidence Anchors

Prefer structured evidence anchors:

```json
{
  "ref": "plugin:skills/full-cognitive-cycle/SKILL.md",
  "resolved_path": "/resolved/at/runtime/skills/full-cognitive-cycle/SKILL.md",
  "kind": "skill",
  "note": "phase controller instructions"
}
```

`ref` is the portable authority. `resolved_path` is runtime evidence only.
Even when a symbolic root has `portable: true`, its `runtime_path` is not
portable authority and should not be copied into public packet references.

Non-file evidence can use non-path refs such as:

- `command:python3 plugin:scripts/validate_cycle_artifacts.py archive:.`
- `url:https://example.invalid/source`
- `observation:subagent-returned-focal-emphasis-single-agent`

## Prohibitions

- Do not use bare relative paths such as `plugins/cognitive-cycle/...`.
- Do not substitute a similar root when a symbolic reference is missing.
- Do not use user-machine paths in public instructions.
- Do not treat a root alias as globally available unless the manifest supplies
  it or the skill loader defines it.

If a symbolic path cannot be resolved, report the missing reference and stop or
route repair. Do not silently try a different plugin copy, repository checkout,
or ledger convention.
