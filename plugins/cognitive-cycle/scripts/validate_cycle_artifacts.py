#!/usr/bin/env python3
"""Validate cognitive-cycle archive structure without judging semantics."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path, PurePosixPath
from typing import Any


MODEL_SELECTION_RULES = {"latest-available-gpt-mini", "user-selected"}
VALID_MODES = {"recommend-only", "decision-only", "decide-and-enact"}
VALID_SCALES = {"individual", "team", "legion"}
VALID_AGENT_SET_PHASES = {"p1", "p2", "p3", "p4"}
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
    "focal_emphasis",
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
        "peer_focal_emphases",
        "consolidation_method",
        "integrated_output",
        "preserved_minority_reports",
        "differentiation_account",
        "forbidden_work_check",
    },
    "p2-possibility-integration": {
        "integration_level",
        "peer_packets",
        "peer_focal_emphases",
        "consolidation_method",
        "integrated_output",
        "preserved_minority_reports",
        "differentiation_account",
        "forbidden_work_check",
    },
    "p3-dialectic": {
        "integration_level",
        "peer_packets",
        "peer_focal_emphases",
        "consolidation_method",
        "integrated_output",
        "preserved_minority_reports",
        "differentiation_account",
        "forbidden_work_check",
    },
    "p4-ethical-integration": {
        "integration_level",
        "peer_packets",
        "peer_focal_emphases",
        "consolidation_method",
        "integrated_output",
        "preserved_minority_reports",
        "differentiation_account",
        "forbidden_work_check",
    },
}
SYMBOLIC_REF_PREFIXES = ("plugin:", "skill:", "repo:", "archive:")
SYMBOLIC_REF_ROOTS = {"plugin", "skill", "repo", "archive"}
NON_PATH_REF_PREFIXES = ("command:", "url:", "observation:", "record:")
PATHLIKE_SUFFIXES = (".md", ".txt", ".json", ".jsonl", ".yaml", ".yml", ".py", ".toml")


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


def looks_like_bare_path(value: str) -> bool:
    if value.startswith(("/", "./", "../", "~")):
        return True
    if "\\" in value:
        return True
    first = value.split()[0] if value.split() else value
    if "/" in first and not first.startswith(("http://", "https://")):
        return True
    return " " not in first and first.endswith(PATHLIKE_SUFFIXES)


def split_symbolic_ref(ref: str) -> tuple[str, str] | None:
    if ":" not in ref:
        return None
    prefix, suffix = ref.split(":", 1)
    if prefix not in SYMBOLIC_REF_ROOTS:
        return None
    return prefix, suffix


def validate_symbolic_suffix(label: str, prefix: str, suffix: str, errors: list[str]) -> None:
    if not suffix:
        errors.append(f"{label}: symbolic ref {prefix}: must include a non-empty relative path")
        return
    if suffix.startswith(("/", "~", "./", "../")):
        errors.append(f"{label}: symbolic ref {prefix}:{suffix} must use a relative path under the symbolic root")
    if "\\" in suffix:
        errors.append(f"{label}: symbolic ref {prefix}:{suffix} must use POSIX '/' separators")
    if ":" in PurePosixPath(suffix).parts[0]:
        errors.append(f"{label}: symbolic ref {prefix}:{suffix} must not contain a drive-letter path")
    parts = PurePosixPath(suffix).parts
    if "." in parts or ".." in parts:
        errors.append(f"{label}: symbolic ref {prefix}:{suffix} must not contain '.' or '..' path segments")
    if prefix == "plugin" and suffix.startswith("plugins/cognitive-cycle/"):
        errors.append(f"{label}: plugin: refs must be relative to the plugin root, not plugins/cognitive-cycle/")


def resolve_symbolic_path(ref: str, manifest: dict[str, Any]) -> Path | None:
    split = split_symbolic_ref(ref)
    if split is None:
        return None
    prefix, suffix = split
    roots = manifest.get("path_authority", {}).get("roots", {})
    if not isinstance(roots, dict):
        return None
    root = roots.get(prefix)
    if not isinstance(root, dict):
        return None
    runtime_path = root.get("runtime_path")
    if not isinstance(runtime_path, str) or not runtime_path:
        return None
    if not suffix or suffix.startswith(("/", "~", "./", "../")) or "\\" in suffix:
        return None
    parts = PurePosixPath(suffix).parts
    if "." in parts or ".." in parts:
        return None
    return (Path(runtime_path).expanduser() / Path(*parts)).resolve(strict=False)


def validate_symbolic_ref(label: str, value: Any, manifest: dict[str, Any], errors: list[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label}: evidence ref must be a non-empty string")
        return

    ref = value.strip()
    split = split_symbolic_ref(ref)
    if split is not None:
        prefix, suffix = split
        roots = manifest.get("path_authority", {}).get("roots", {})
        if isinstance(roots, dict) and prefix not in roots:
            errors.append(f"{label}: symbolic root {prefix!r} is not declared in manifest.path_authority.roots")
        validate_symbolic_suffix(label, prefix, suffix, errors)
        return

    if ref.startswith(("http://", "https://", "url:", "observation:", "record:")):
        return

    if ref.startswith("command:"):
        command = ref.split(":", 1)[1]
        if " /" in command or command.startswith("/") or " ~" in command or command.startswith("~"):
            errors.append(f"{label}: command ref must not contain bare absolute or home-relative paths")
        return

    if looks_like_bare_path(ref):
        errors.append(
            f"{label}: bare or absolute path {ref!r} must use a symbolic root such as plugin:, repo:, skill:, or archive:"
        )


def validate_evidence_anchors(path: Path, packet: dict[str, Any], manifest: dict[str, Any], errors: list[str]) -> None:
    anchors = packet.get("evidence_anchors")
    if not isinstance(anchors, list):
        errors.append(f"{path}: evidence_anchors must be a list")
        return

    for index, anchor in enumerate(anchors):
        label = f"{path}:evidence_anchors[{index}]"
        if isinstance(anchor, str):
            validate_symbolic_ref(label, anchor, manifest, errors)
        elif isinstance(anchor, dict):
            require_keys(label, anchor, {"ref"}, errors)
            ref = anchor.get("ref")
            validate_symbolic_ref(label + ".ref", ref, manifest, errors)
            resolved_path = anchor.get("resolved_path")
            if resolved_path is not None and not isinstance(resolved_path, str):
                errors.append(f"{label}.resolved_path: must be a string when present")
            elif isinstance(resolved_path, str) and isinstance(ref, str):
                expected = resolve_symbolic_path(ref, manifest)
                if expected is not None:
                    actual = Path(resolved_path).expanduser().resolve(strict=False)
                    if actual != expected:
                        errors.append(f"{label}.resolved_path: does not match resolved symbolic ref {ref!r}")
        else:
            errors.append(f"{label}: anchor must be a string or object")


def validate_ref_list(label: str, values: Any, manifest: dict[str, Any], errors: list[str]) -> None:
    if not isinstance(values, list):
        errors.append(f"{label}: must be a list")
        return
    for index, value in enumerate(values):
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{label}[{index}]: must be a non-empty string")
            continue
        validate_symbolic_ref(f"{label}[{index}]", value, manifest, errors)


def validate_path_authority(archive: Path, manifest: dict[str, Any], errors: list[str]) -> None:
    path_authority = manifest.get("path_authority")
    if not isinstance(path_authority, dict):
        errors.append(f"{archive / 'manifest.json'}: path_authority must be an object")
        return

    roots = path_authority.get("roots")
    rules = path_authority.get("rules")
    if not isinstance(roots, dict):
        errors.append(f"{archive / 'manifest.json'}: path_authority.roots must be an object")
        return
    if not isinstance(rules, dict):
        errors.append(f"{archive / 'manifest.json'}: path_authority.rules must be an object")
        return

    for root_name in ("plugin", "archive"):
        root = roots.get(root_name)
        if not isinstance(root, dict):
            errors.append(f"{archive / 'manifest.json'}: path_authority.roots.{root_name} must be an object")
            continue
        require_keys(
            f"{archive / 'manifest.json'}:path_authority.roots.{root_name}",
            root,
            {"description", "runtime_path", "portable"},
            errors,
        )
        runtime_path = root.get("runtime_path")
        if not isinstance(runtime_path, str) or not runtime_path.strip():
            errors.append(f"{archive / 'manifest.json'}: path_authority.roots.{root_name}.runtime_path must be a non-empty string")
        elif not Path(runtime_path).expanduser().is_absolute():
            errors.append(f"{archive / 'manifest.json'}: path_authority.roots.{root_name}.runtime_path must be absolute")
        if not isinstance(root.get("portable"), bool):
            errors.append(f"{archive / 'manifest.json'}: path_authority.roots.{root_name}.portable must be boolean")

    if rules.get("bare_relative_paths_allowed") is not False:
        errors.append(f"{archive / 'manifest.json'}: path_authority.rules.bare_relative_paths_allowed must be false")
    if rules.get("substitute_similar_roots_allowed") is not False:
        errors.append(f"{archive / 'manifest.json'}: path_authority.rules.substitute_similar_roots_allowed must be false")
    if rules.get("public_artifacts_prefer_symbolic_refs") is not True:
        errors.append(f"{archive / 'manifest.json'}: path_authority.rules.public_artifacts_prefer_symbolic_refs must be true")


def validate_same_phase_differentiation(archive: Path, manifest: dict[str, Any], errors: list[str]) -> None:
    agent_sets = manifest.get("agent_sets")
    if not isinstance(agent_sets, dict):
        return
    for phase, agents in agent_sets.items():
        if phase not in VALID_AGENT_SET_PHASES:
            errors.append(f"{archive / 'manifest.json'}: manifest.agent_sets contains invalid phase {phase!r}")
        if not isinstance(agents, list) or not agents:
            errors.append(f"{archive / 'manifest.json'}: manifest.agent_sets.{phase} must be a non-empty list")
        elif any(not isinstance(agent, str) or not agent.strip() for agent in agents):
            errors.append(f"{archive / 'manifest.json'}: manifest.agent_sets.{phase} must contain non-empty agent names")
    differentiation = manifest.get("same_phase_differentiation")
    if differentiation is None:
        differentiation = {}
    if not isinstance(differentiation, dict):
        errors.append(f"{archive / 'manifest.json'}: same_phase_differentiation must be an object")
        return

    for phase, agents in agent_sets.items():
        if phase not in VALID_AGENT_SET_PHASES or not isinstance(agents, list) or len(agents) <= 1:
            continue
        phase_map = differentiation.get(phase)
        if not isinstance(phase_map, dict):
            errors.append(
                f"{archive / 'manifest.json'}: same_phase_differentiation.{phase} is required when manifest.agent_sets.{phase} has more than one agent"
            )
            continue
        for agent in agents:
            agent_entry = phase_map.get(agent)
            if not isinstance(agent_entry, dict):
                errors.append(
                    f"{archive / 'manifest.json'}: same_phase_differentiation.{phase}.{agent} must be an object"
                )
                continue
            focal_emphasis = agent_entry.get("focal_emphasis")
            if not isinstance(focal_emphasis, str) or not focal_emphasis.strip():
                errors.append(
                    f"{archive / 'manifest.json'}: same_phase_differentiation.{phase}.{agent}.focal_emphasis must be a non-empty string"
                )


def is_gpt_mini_model(value: Any) -> bool:
    return parse_gpt_mini_version(value) is not None if isinstance(value, str) else False


def is_concrete_model_id(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


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


def select_latest_gpt_mini(models: list[str]) -> str | None:
    candidates = []
    for model in models:
        version = parse_gpt_mini_version(model)
        if version is not None:
            candidates.append((version, model))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    return candidates[-1][1]


def selected_cycle_model(manifest: dict[str, Any]) -> Any:
    model_policy = manifest.get("agent_model_policy")
    if not isinstance(model_policy, dict):
        return None
    return model_policy.get("selected_cognitive_cycle_agent")


def require_string(label: str, value: Any, errors: list[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label}: must be a non-empty string")


def require_list(label: str, value: Any, errors: list[str]) -> None:
    if not isinstance(value, list):
        errors.append(f"{label}: must be a list")


def validate_review_ref(label: str, value: Any, manifest: dict[str, Any], errors: list[str]) -> Path | None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label}: must be a non-empty string")
        return None
    if value.startswith("semantic-reviews/"):
        parts = PurePosixPath(value).parts
        if "." in parts or ".." in parts:
            errors.append(f"{label}: must not contain '.' or '..' path segments")
            return None
        roots = manifest.get("path_authority", {}).get("roots", {})
        archive_root = roots.get("archive") if isinstance(roots, dict) else None
        runtime_path = archive_root.get("runtime_path") if isinstance(archive_root, dict) else None
        if isinstance(runtime_path, str) and runtime_path:
            return (Path(runtime_path).expanduser() / Path(*parts)).resolve(strict=False)
        return None
    validate_symbolic_ref(label, value, manifest, errors)
    if value.startswith("archive:"):
        return resolve_symbolic_path(value, manifest)
    return None


def extract_review_model(path: Path) -> str | None:
    try:
        for line in path.read_text().splitlines():
            stripped = line.strip()
            if stripped.startswith("- model:"):
                return stripped.split(":", 1)[1].strip()
            if stripped.startswith("model:"):
                return stripped.split(":", 1)[1].strip()
    except OSError:
        return None
    return None


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
            "path_authority",
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
    validate_ref_list(f"{manifest_path}:source_scope", manifest.get("source_scope"), manifest, errors)
    if not isinstance(manifest.get("phase_owners"), list):
        errors.append(f"{manifest_path}: phase_owners must be a list")
    if "agent_sets" in manifest and not isinstance(manifest.get("agent_sets"), dict):
        errors.append(f"{manifest_path}: agent_sets must be an object when present")

    validate_path_authority(archive, manifest, errors)
    validate_same_phase_differentiation(archive, manifest, errors)

    model_policy = manifest.get("agent_model_policy")
    if not isinstance(model_policy, dict):
        errors.append(f"{manifest_path}: agent_model_policy must be an object")
    else:
        selection_rule = model_policy.get("selection_rule")
        if selection_rule not in MODEL_SELECTION_RULES:
            errors.append(f"{manifest_path}: selection_rule must be one of {sorted(MODEL_SELECTION_RULES)}")
        selected = model_policy.get("selected_cognitive_cycle_agent")
        if not is_concrete_model_id(selected):
            errors.append(f"{manifest_path}: selected_cognitive_cycle_agent must be a concrete model id")
        available = model_policy.get("available_agent_models")
        if not isinstance(available, list) or not available:
            errors.append(f"{manifest_path}: available_agent_models must be a non-empty list")
        elif any(not is_concrete_model_id(model) for model in available):
            errors.append(f"{manifest_path}: available_agent_models must contain concrete model ids")
        elif selected not in available:
            errors.append(f"{manifest_path}: selected_cognitive_cycle_agent must come from available_agent_models")
        elif selection_rule == "latest-available-gpt-mini" and selected != select_latest_gpt_mini(available):
            errors.append(f"{manifest_path}: selected_cognitive_cycle_agent must be the latest gpt-*.*-mini in available_agent_models")
        if model_policy.get("user_selectable") is not True:
            errors.append(f"{manifest_path}: agent_model_policy.user_selectable must be true")
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


def validate_packet(
    path: Path,
    manifest: dict[str, Any],
    errors: list[str],
    warnings: list[str],
    stage: str,
) -> None:
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
    require_string(f"{path}:packet_id", packet.get("packet_id"), errors)
    require_string(f"{path}:owner", packet.get("owner"), errors)
    validate_ref_list(f"{path}:source_scope", packet.get("source_scope"), manifest, errors)
    require_list(f"{path}:input_packets", packet.get("input_packets"), errors)
    require_list(f"{path}:uncertainties", packet.get("uncertainties"), errors)
    require_string(f"{path}:handoff_target", packet.get("handoff_target"), errors)
    focal_emphasis = packet.get("focal_emphasis")
    if not isinstance(focal_emphasis, str) or not focal_emphasis.strip():
        errors.append(f"{path}: focal_emphasis must be a non-empty string")
    packet_model = packet.get("agent_model")
    if not is_concrete_model_id(packet_model):
        errors.append(f"{path}: agent_model must be a concrete model id")
    elif packet_model != selected_cycle_model(manifest):
        errors.append(f"{path}: agent_model must match manifest.agent_model_policy.selected_cognitive_cycle_agent")

    validate_evidence_anchors(path, packet, manifest, errors)

    semantic_review = packet.get("semantic_review")
    if not isinstance(semantic_review, dict):
        errors.append(f"{path}: semantic_review must be an object")
    else:
        require_keys(str(path) + ":semantic_review", semantic_review, {"status", "reviewer", "review_ref"}, errors)
        status = semantic_review.get("status")
        require_string(str(path) + ":semantic_review.reviewer", semantic_review.get("reviewer"), errors)
        review_path = validate_review_ref(
            str(path) + ":semantic_review.review_ref",
            semantic_review.get("review_ref"),
            manifest,
            errors,
        )
        if status not in {"pending", "accepted", "rejected", "needs-repair"}:
            errors.append(f"{path}: semantic_review.status has an invalid value")
        if stage in {"route", "complete"} and status != "accepted":
            errors.append(f"{path}: semantic_review.status must be accepted for {stage} validation")
        if status in {"accepted", "rejected", "needs-repair"}:
            if review_path is None or not review_path.exists():
                errors.append(f"{path}: semantic_review.review_ref must point to an existing review artifact")
            else:
                review_model = extract_review_model(review_path)
                if review_model != selected_cycle_model(manifest):
                    errors.append(f"{path}: semantic review model must match manifest.agent_model_policy.selected_cognitive_cycle_agent")

    if phase == "p1":
        for key in (
            "scope_and_sources_inspected",
            "observations",
            "relevant_absences",
            "inferences_and_uncertainties",
            "risks_of_p1_insufficiency",
            "material_for_p2",
        ):
            require_list(f"{path}:{key}", packet.get(key), errors)
    elif phase == "p2":
        require_list(f"{path}:possibilities", packet.get("possibilities"), errors)
        require_list(f"{path}:questions_for_p3", packet.get("questions_for_p3"), errors)
    elif phase == "p3":
        require_list(f"{path}:evaluations", packet.get("evaluations"), errors)
        require_list(f"{path}:evidence_basis", packet.get("evidence_basis"), errors)
    elif phase == "p4":
        for key in ("grounding", "commitments_and_next_actions", "foreclosed_alternatives"):
            require_list(f"{path}:{key}", packet.get(key), errors)
    elif phase in INTEGRATION_MIN_COUNTS:
        require_list(f"{path}:peer_packets", packet.get("peer_packets"), errors)
        if not isinstance(packet.get("peer_focal_emphases"), dict):
            errors.append(f"{path}:peer_focal_emphases must be an object")

    if phase == "p3":
        outcome = packet.get("outcome")
        if outcome not in {"return-to-p1", "return-to-p2", "advance-to-p4"}:
            errors.append(f"{path}: P3 outcome must be return-to-p1, return-to-p2, or advance-to-p4")
        if outcome in {"return-to-p1", "return-to-p2"} and "recursion_instruction" not in packet:
            errors.append(f"{path}: returning P3 packets require recursion_instruction")
        if outcome == "advance-to-p4" and "p4_handoff" not in packet:
            errors.append(f"{path}: advance-to-p4 packets require p4_handoff")

    agent_sets = manifest.get("agent_sets")
    if phase in {"p1", "p2", "p3", "p4"} and isinstance(agent_sets, dict):
        peers = agent_sets.get(phase, [])
        if isinstance(peers, list) and len(peers) > 1 and packet.get("focal_emphasis") == "single-agent":
            errors.append(f"{path}: focal_emphasis cannot be single-agent when manifest.agent_sets.{phase} has more than one agent")

    if phase in INTEGRATION_MIN_COUNTS:
        source_phase = INTEGRATION_MIN_COUNTS[phase]
        if isinstance(agent_sets, dict):
            peers = agent_sets.get(source_phase, [])
            if isinstance(peers, list) and len(peers) <= 1:
                errors.append(f"{path}: {phase} is only valid when manifest.agent_sets.{source_phase} has more than one agent")
            peer_focal_emphases = packet.get("peer_focal_emphases")
            if isinstance(peers, list) and len(peers) > 1:
                if not isinstance(peer_focal_emphases, dict):
                    errors.append(f"{path}: peer_focal_emphases must be an object for same-phase integration packets")
                else:
                    missing = [peer for peer in peers if peer not in peer_focal_emphases]
                    if missing:
                        errors.append(f"{path}: peer_focal_emphases missing peers: {', '.join(missing)}")
        else:
            warnings.append(f"{path}: cannot prove integration cardinality because manifest.agent_sets is absent")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--json", action="store_true", help="emit a JSON report")
    parser.add_argument(
        "--stage",
        choices=("init", "route", "complete"),
        default="init",
        help="Validation strictness: init allows empty archives; route/complete require accepted reviewed packets.",
    )
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []

    manifest = validate_manifest(args.archive, errors, warnings)
    if manifest is not None:
        packet_paths = sorted((args.archive / "packets").glob("*.json"))
        if args.stage in {"route", "complete"} and not packet_paths:
            errors.append(f"{args.archive / 'packets'}: {args.stage} validation requires at least one packet")
        if args.stage == "complete":
            phases = set()
            for packet_path in packet_paths:
                packet = load_json(packet_path, errors)
                if isinstance(packet, dict) and isinstance(packet.get("phase"), str):
                    phases.add(packet["phase"])
            missing_phases = sorted({"p1", "p2", "p3", "p4"} - phases)
            if missing_phases:
                errors.append(f"{args.archive / 'packets'}: complete validation missing phases: {', '.join(missing_phases)}")
        for packet_path in packet_paths:
            validate_packet(packet_path, manifest, errors, warnings, args.stage)

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
