#!/usr/bin/env python3
"""Initialize a durable cognitive-cycle run archive."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


VALID_MODES = {"recommend-only", "decision-only", "decide-and-enact"}
VALID_SCALES = {"individual", "team", "legion"}
DEFAULT_AVAILABLE_MODELS = tuple(
    model.strip()
    for model in os.environ.get("COGNITIVE_CYCLE_AVAILABLE_MODELS", "").split(",")
    if model.strip()
)


def parse_agent_set(value: str) -> tuple[str, list[str]]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("agent sets must use phase=a,b,c")
    phase, raw_agents = value.split("=", 1)
    agents = [agent.strip() for agent in raw_agents.split(",") if agent.strip()]
    if not phase.strip() or not agents:
        raise argparse.ArgumentTypeError("agent sets require a phase and at least one agent")
    return phase.strip(), agents


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
        "--available-agent-model",
        action="append",
        default=list(DEFAULT_AVAILABLE_MODELS),
        help="Currently available model id; repeat to let the harness select the latest gpt-*.*-mini dynamically.",
    )
    args = parser.parse_args()

    if args.recursion_budget < 0:
        raise SystemExit("--recursion-budget must be non-negative")

    archive = Path(args.archive_root) / args.cycle_id
    packets = archive / "packets"
    ledgers = archive / "ledgers"
    registers = archive / "registers"
    reviews = archive / "semantic-reviews"

    for directory in (archive, packets, ledgers, registers, reviews):
        directory.mkdir(parents=True, exist_ok=True)

    agent_sets = {phase: agents for phase, agents in args.agent_set}
    if not args.available_agent_model:
        raise SystemExit("provide current models with --available-agent-model or COGNITIVE_CYCLE_AVAILABLE_MODELS")
    selected_agent_model = select_latest_gpt_mini(args.available_agent_model)
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
        "agent_model_policy": {
            "selection_rule": "latest-available-gpt-mini",
            "available_agent_models": args.available_agent_model,
            "selected_cognitive_cycle_agent": selected_agent_model,
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
