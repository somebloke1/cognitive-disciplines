#!/usr/bin/env python3
"""Initialize a durable cognitive-cycle run archive."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


VALID_MODES = {"recommend-only", "decision-only", "decide-and-enact"}
VALID_SCALES = {"individual", "team", "legion"}
VALID_AGENT_SET_PHASES = {"p1", "p2", "p3", "p4"}
DEFAULT_AVAILABLE_MODELS = tuple(
    model.strip()
    for model in os.environ.get("COGNITIVE_CYCLE_AVAILABLE_MODELS", "").split(",")
    if model.strip()
)
PLUGIN_ROOT = Path(__file__).resolve().parents[1]


def parse_agent_set(value: str) -> tuple[str, list[str]]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("agent sets must use phase=a,b,c")
    phase, raw_agents = value.split("=", 1)
    agents = [agent.strip() for agent in raw_agents.split(",") if agent.strip()]
    phase = phase.strip()
    if not phase or not agents:
        raise argparse.ArgumentTypeError("agent sets require a phase and at least one agent")
    if phase not in VALID_AGENT_SET_PHASES:
        raise argparse.ArgumentTypeError(f"agent set phase must be one of {sorted(VALID_AGENT_SET_PHASES)}")
    return phase, agents


def parse_same_phase_differentiation(value: str) -> tuple[str, str, str]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("same-phase differentiation must use phase.agent=focal-emphasis")
    raw_phase_agent, focal_emphasis = value.split("=", 1)
    if "." not in raw_phase_agent:
        raise argparse.ArgumentTypeError("same-phase differentiation must use phase.agent=focal-emphasis")
    phase, agent = raw_phase_agent.split(".", 1)
    phase = phase.strip()
    agent = agent.strip()
    focal_emphasis = focal_emphasis.strip()
    if not phase or not agent or not focal_emphasis:
        raise argparse.ArgumentTypeError("same-phase differentiation requires phase, agent, and focal emphasis")
    if phase not in VALID_AGENT_SET_PHASES:
        raise argparse.ArgumentTypeError(
            f"same-phase differentiation phase must be one of {sorted(VALID_AGENT_SET_PHASES)}"
        )
    return phase, agent, focal_emphasis


def parse_gpt_mini_version(model: str) -> tuple[int, ...] | None:
    prefix = "gpt-"
    suffix = "-mini"
    if not model.startswith(prefix) or not model.endswith(suffix):
        return None
    version = model[len(prefix):-len(suffix)]
    if "." not in version:
        return None
    parts: list[int] = []
    for raw_part in version.split("."):
        if not raw_part.isdigit():
            return None
        parts.append(int(raw_part))
    return tuple(parts)


def select_latest_gpt_mini(models: list[str]) -> str:
    candidates = []
    for model in models:
        version = parse_gpt_mini_version(model)
        if version is not None:
            candidates.append((version, model))
    if not candidates:
        raise SystemExit("no available gpt-*.*-mini model found")
    candidates.sort(key=lambda item: item[0])
    return candidates[-1][1]


def select_cycle_model(models: list[str], selected_model: str | None) -> tuple[str, str]:
    if selected_model is None:
        return select_latest_gpt_mini(models), "latest-available-gpt-mini"
    if selected_model not in models:
        raise SystemExit("--selected-agent-model must match one of the provided --available-agent-model values")
    return selected_model, "user-selected"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive-root", default="cycle-runs")
    parser.add_argument("--cycle-id", required=True)
    parser.add_argument("--orienting-question", required=True)
    parser.add_argument("--implicit-unknown", required=True)
    parser.add_argument("--mode", choices=sorted(VALID_MODES), default="recommend-only")
    parser.add_argument("--scale", choices=sorted(VALID_SCALES), default="individual")
    parser.add_argument("--source-scope", action="append", default=[])
    parser.add_argument("--recursion-budget", type=int, default=0)
    parser.add_argument("--phase-owner", action="append", default=[])
    parser.add_argument("--agent-set", type=parse_agent_set, action="append", default=[])
    parser.add_argument(
        "--same-phase-differentiation",
        type=parse_same_phase_differentiation,
        action="append",
        default=[],
        help="Required for multi-agent phases. Use phase.agent=focal-emphasis; repeat for each peer.",
    )
    parser.add_argument(
        "--repo-root",
        help="Optional task repository root to expose as repo: in path_authority.",
    )
    parser.add_argument(
        "--available-agent-model",
        action="append",
        default=None,
        help="Currently available model id to present as a user-selectable cycle option; repeat for each option.",
    )
    parser.add_argument(
        "--selected-agent-model",
        help="Concrete model id selected by the user for the cycle. Defaults to the latest available gpt-*.*-mini.",
    )
    args = parser.parse_args()

    if args.recursion_budget < 0:
        raise SystemExit("--recursion-budget must be non-negative")

    archive = Path(args.archive_root).expanduser() / args.cycle_id
    archive = archive.resolve(strict=False)
    packets = archive / "packets"
    ledgers = archive / "ledgers"
    registers = archive / "registers"
    reviews = archive / "semantic-reviews"

    for directory in (archive, packets, ledgers, registers, reviews):
        directory.mkdir(parents=True, exist_ok=True)

    agent_sets = {phase: agents for phase, agents in args.agent_set}
    same_phase_differentiation: dict[str, dict[str, dict[str, str]]] = {}
    for phase, agent, focal_emphasis in args.same_phase_differentiation:
        same_phase_differentiation.setdefault(phase, {})[agent] = {
            "focal_emphasis": focal_emphasis,
        }

    available_agent_models = args.available_agent_model or list(DEFAULT_AVAILABLE_MODELS)
    if not available_agent_models:
        raise SystemExit("provide current models with --available-agent-model or COGNITIVE_CYCLE_AVAILABLE_MODELS")
    selected_agent_model, selection_rule = select_cycle_model(available_agent_models, args.selected_agent_model)
    path_roots = {
        "plugin": {
            "description": "Installed cognitive-cycle plugin root",
            "runtime_path": str(PLUGIN_ROOT.resolve(strict=False)),
            "portable": True,
        },
        "archive": {
            "description": "Current cycle archive root",
            "runtime_path": str(archive),
            "portable": False,
        },
    }
    if args.repo_root:
        path_roots["repo"] = {
            "description": "Task repository root supplied by the controller",
            "runtime_path": str(Path(args.repo_root).expanduser().resolve(strict=False)),
            "portable": False,
        }

    manifest = {
        "cycle_id": args.cycle_id,
        "orienting_question": args.orienting_question,
        "implicit_unknown": args.implicit_unknown,
        "mode": args.mode,
        "source_scope": args.source_scope,
        "recursion_budget": args.recursion_budget,
        "phase_owners": args.phase_owner,
        "archive_target": str(archive),
        "scale": args.scale,
        "agent_sets": agent_sets,
        "same_phase_differentiation": same_phase_differentiation,
        "path_authority": {
            "roots": path_roots,
            "rules": {
                "bare_relative_paths_allowed": False,
                "substitute_similar_roots_allowed": False,
                "public_artifacts_prefer_symbolic_refs": True,
            },
        },
        "agent_model_policy": {
            "selection_rule": selection_rule,
            "available_agent_models": available_agent_models,
            "selected_cognitive_cycle_agent": selected_agent_model,
            "user_selectable": True,
            "exclusive": True,
        },
        "semantic_evaluation_policy": {
            "structural_checks": "deterministic",
            "semantic_checks": "agent_or_model_judgment",
            "regex_semantic_evaluation_allowed": False,
            "json_structure_deterministic_semantics_model_judged": True,
        },
    }

    (archive / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    for name in (
        "recursions.jsonl",
        "decisions.jsonl",
        "archive-index.jsonl",
    ):
        (ledgers / name).touch()

    for name in (
        "contradictions.jsonl",
        "duplicates.jsonl",
        "open-uncertainties.jsonl",
        "scope-decomposition.jsonl",
    ):
        (registers / name).touch()

    print(archive)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
