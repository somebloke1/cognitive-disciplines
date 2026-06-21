#!/usr/bin/env python3
"""Validate cognitive-cycle archive structure without judging semantics."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REQUIRED_MODEL = "gpt-5.x-mini"
VALID_MODES = {"recommend-only", "decision-only", "decide-and-enact"}
VALID_SCALES = {"individual", "team", "legion"}
VALID_PHASES = {
    "p1",
    "p2",
    "p3",
    "p4",
    "p1-data-curation",
    "p2-possibility-integration",
    "p3-dialectic",
    "p4-ethical-integration",
}
INTEGRATION_MIN_COUNTS = {
    "p1-data-curation": "p1",
    "p2-possibility-integration": "p2",
    "p3-dialectic": "p3",
    "p4-ethical-integration": "p4",
}
COMMON_PACKET_KEYS = {
    "packet_id",
    "cycle_id",
    "phase",
    "pass",
    "owner",
    "agent_model",
    "orienting_question",
    "implicit_unknown",
    "source_scope",
    "input_packets",
    "evidence_anchors",
    "uncertainties",
    "handoff_target",
    "semantic_review",
}
PHASE_KEYS = {
    "p1": {
        "scope_and_sources_inspected",
        "observations",
        "relevant_absences",
        "inferences_and_uncertainties",
        "risks_of_p1_insufficiency",
        "material_for_p2",
    },
    "p2": {
        "possibilities",
        "surface_variant_duplicate_check",
        "questions_for_p3",
    },
    "p3": {
        "outcome",
        "p1_sufficiency_finding",
        "p2_sufficiency_finding",
        "evaluations",
        "evidence_basis",
    },
    "p4": {
        "decision_or_recommendation",
        "mode_and_authority",
        "grounding",
        "commitments_and_next_actions",
        "foreclosed_alternatives",
        "residual_uncertainty",
        "reassessment_conditions",
        "new_p1_seed",
    },
    "p1-data-curation": {
        "integration_level",
        "peer_packets",
        "consolidation_method",
        "integrated_output",
        "preserved_minority_reports",
        "forbidden_work_check",
    },
    "p2-possibility-integration": {
        "integration_level",
        "peer_packets",
        "consolidation_method",
        "integrated_output",
        "preserved_minority_reports",
        "forbidden_work_check",
    },
    "p3-dialectic": {
        "integration_level",
        "peer_packets",
        "consolidation_method",
        "integrated_output",
        "preserved_minority_reports",
        "forbidden_work_check",
    },
    "p4-ethical-integration": {
        "integration_level",
        "peer_packets",
        "consolidation_method",
        "integrated_output",
        "preserved_minority_reports",
        "forbidden_work_check",
    },
}


def load_json(path: Path, errors: list[str]) -> Any | None:
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        errors.append(f"{path}: invalid JSON: {exc}")
    except OSError as exc:
        errors.append(f"{path}: cannot read: {exc}")
    return None


def require_keys(label: str, obj: dict[str, Any], keys: set[str], errors: list[str]) -> None:
    missing = sorted(key for key in keys if key not in obj)
    if missing:
        errors.append(f"{label}: missing keys: {', '.join(missing)}")


def validate_manifest(archive: Path, errors: list[str], warnings: list[str]) -> dict[str, Any] | None:
    manifest_path = archive / "manifest.json"
    manifest = load_json(manifest_path, errors)
    if not isinstance(manifest, dict):
        errors.append(f"{manifest_path}: manifest must be a JSON object")
        return None

    require_keys(
        str(manifest_path),
        manifest,
        {
            "cycle_id",
            "orienting_question",
            "implicit_unknown",
            "mode",
            "source_scope",
            "recursion_budget",
            "phase_owners",
            "archive_target",
            "scale",
            "agent_model_policy",
            "semantic_evaluation_policy",
        },
        errors,
    )

    if manifest.get("mode") not in VALID_MODES:
        errors.append(f"{manifest_path}: mode must be one of {sorted(VALID_MODES)}")
    if manifest.get("scale") not in VALID_SCALES:
        errors.append(f"{manifest_path}: scale must be one of {sorted(VALID_SCALES)}")
    if not isinstance(manifest.get("recursion_budget"), int) or manifest.get("recursion_budget") < 0:
        errors.append(f"{manifest_path}: recursion_budget must be a non-negative integer")

    model_policy = manifest.get("agent_model_policy")
    if not isinstance(model_policy, dict):
        errors.append(f"{manifest_path}: agent_model_policy must be an object")
    else:
        if model_policy.get("cognitive_cycle_agents") != REQUIRED_MODEL:
            errors.append(f"{manifest_path}: cognitive_cycle_agents must be {REQUIRED_MODEL}")
        if model_policy.get("exclusive") is not True:
            errors.append(f"{manifest_path}: agent_model_policy.exclusive must be true")

    semantic_policy = manifest.get("semantic_evaluation_policy")
    if not isinstance(semantic_policy, dict):
        errors.append(f"{manifest_path}: semantic_evaluation_policy must be an object")
    else:
        if semantic_policy.get("regex_semantic_evaluation_allowed") is not False:
            errors.append(f"{manifest_path}: regex_semantic_evaluation_allowed must be false")
        if semantic_policy.get("semantic_checks") != "agent_or_model_judgment":
            errors.append(f"{manifest_path}: semantic_checks must be agent_or_model_judgment")

    if not (archive / "packets").is_dir():
        errors.append(f"{archive / 'packets'}: missing packet directory")
    for path in (
        archive / "ledgers" / "recursions.jsonl",
        archive / "ledgers" / "decisions.jsonl",
        archive / "registers" / "contradictions.jsonl",
        archive / "registers" / "duplicates.jsonl",
        archive / "registers" / "open-uncertainties.jsonl",
    ):
        if not path.exists():
            warnings.append(f"{path}: expected ledger/register file is absent")

    return manifest


def validate_packet(path: Path, manifest: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    packet = load_json(path, errors)
    if not isinstance(packet, dict):
        errors.append(f"{path}: packet must be a JSON object")
        return

    require_keys(str(path), packet, COMMON_PACKET_KEYS, errors)
    phase = packet.get("phase")
    if phase not in VALID_PHASES:
        errors.append(f"{path}: invalid phase {phase!r}")
        return

    require_keys(str(path), packet, PHASE_KEYS[phase], errors)

    if packet.get("cycle_id") != manifest.get("cycle_id"):
        errors.append(f"{path}: cycle_id does not match manifest")
    if not isinstance(packet.get("pass"), int) or packet.get("pass") < 1:
        errors.append(f"{path}: pass must be a positive integer")
    if packet.get("agent_model") != REQUIRED_MODEL:
        errors.append(f"{path}: agent_model must be {REQUIRED_MODEL}")

    semantic_review = packet.get("semantic_review")
    if not isinstance(semantic_review, dict):
        errors.append(f"{path}: semantic_review must be an object")
    else:
        require_keys(str(path) + ":semantic_review", semantic_review, {"status", "reviewer", "review_ref"}, errors)
        if semantic_review.get("status") not in {"pending", "accepted", "rejected", "needs-repair"}:
            errors.append(f"{path}: semantic_review.status has an invalid value")

    if phase == "p3":
        outcome = packet.get("outcome")
        if outcome not in {"return-to-p1", "return-to-p2", "advance-to-p4"}:
            errors.append(f"{path}: P3 outcome must be return-to-p1, return-to-p2, or advance-to-p4")
        if outcome in {"return-to-p1", "return-to-p2"} and "recursion_instruction" not in packet:
            errors.append(f"{path}: returning P3 packets require recursion_instruction")
        if outcome == "advance-to-p4" and "p4_handoff" not in packet:
            errors.append(f"{path}: advance-to-p4 packets require p4_handoff")

    agent_sets = manifest.get("agent_sets")
    if phase in INTEGRATION_MIN_COUNTS:
        source_phase = INTEGRATION_MIN_COUNTS[phase]
        if isinstance(agent_sets, dict):
            peers = agent_sets.get(source_phase, [])
            if isinstance(peers, list) and len(peers) <= 1:
                errors.append(f"{path}: {phase} is only valid when manifest.agent_sets.{source_phase} has more than one agent")
        else:
            warnings.append(f"{path}: cannot prove integration cardinality because manifest.agent_sets is absent")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--json", action="store_true", help="emit a JSON report")
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []

    manifest = validate_manifest(args.archive, errors, warnings)
    if manifest is not None:
        for packet_path in sorted((args.archive / "packets").glob("*.json")):
            validate_packet(packet_path, manifest, errors, warnings)

    result = {
        "archive": str(args.archive),
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "note": "This validator checks structure only; semantic quality requires agent/model judgment.",
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("valid" if result["valid"] else "invalid")
        for warning in warnings:
            print(f"warning: {warning}")
        for error in errors:
            print(f"error: {error}", file=sys.stderr)

    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
