# Open Question 0001: Plugin Format And Installation Target

- `status`: open
- `date`: 2026-06-21

## Question

What exact Codex plugin structure, manifest schema, and installation target
should this project use for the full-fledged cognitive cycle plugin?

## Why It Matters

The current repository contains skills and planning artifacts, but a full plugin
requires a valid plugin layout and manifest. Before implementation, the
controller must verify the current Codex plugin format rather than infer it from
memory.

## Research Path

- Inspect local bundled plugin examples.
- Use the `plugin-creator` skill when creating the plugin scaffold.
- Use Context7 or web_search if current plugin documentation is needed.
