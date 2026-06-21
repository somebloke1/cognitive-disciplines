# Cognitive Disciplines

Utilities and local workflow artifacts for the cognitive-disciplines project.

## Current contents

- `contextforge_project_init_plan.py`: generates a ContextForge project-init plan for a Codex project without applying it by default.
- `planning/`: research, SuperLoop controller records, dry runs, and team-run proof artifacts.
- `skills/`: repo-tracked Codex skill artifacts mirrored from the active local skill runtime.

## Usage

```bash
python3 contextforge_project_init_plan.py
```

## Skill Mirrors

The active local skills live under `/home/dgk/.codex/skills`. When a skill change is part of project work, mirror the changed skill files into `skills/` so GitHub issues have commit-backed artifacts.
