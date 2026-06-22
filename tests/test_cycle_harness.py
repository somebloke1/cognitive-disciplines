import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
INIT_SCRIPT = REPO_ROOT / "plugins" / "cognitive-cycle" / "scripts" / "init_cycle_run.py"
VALIDATE_SCRIPT = REPO_ROOT / "plugins" / "cognitive-cycle" / "scripts" / "validate_cycle_artifacts.py"
PLUGIN_SKILLS = REPO_ROOT / "plugins" / "cognitive-cycle" / "skills"


class CycleHarnessTests(unittest.TestCase):
    def p1_packet(self, cycle_id: str, model: str, **overrides):
        packet = {
            "packet_id": "p1-1",
            "cycle_id": cycle_id,
            "phase": "p1",
            "pass": 1,
            "owner": "p1-agent",
            "focal_emphasis": "single-agent",
            "agent_model": model,
            "orienting_question": "What should be decided?",
            "implicit_unknown": "Which evidence matters?",
            "source_scope": ["tests"],
            "input_packets": [],
            "evidence_anchors": [{"ref": "repo:tests/test_cycle_harness.py", "kind": "test"}],
            "uncertainties": [],
            "handoff_target": "p2",
            "semantic_review": {
                "status": "pending",
                "reviewer": "controller",
                "review_ref": "archive:semantic-reviews/p1-1.md",
            },
            "scope_and_sources_inspected": ["tests"],
            "observations": ["A packet exists for structural validation."],
            "relevant_absences": [],
            "inferences_and_uncertainties": [],
            "risks_of_p1_insufficiency": [],
            "material_for_p2": [],
        }
        packet.update(overrides)
        return packet

    def test_plugin_contains_curriculum_harness_references(self):
        references = REPO_ROOT / "plugins" / "cognitive-cycle" / "skills" / "full-cognitive-cycle" / "references"
        for name in (
            "curriculum-primers.md",
            "acceptance-gates.md",
            "controller-transition-matrix.md",
            "semantic-review-template.md",
            "harness-structural-contract.md",
            "path-authority.md",
        ):
            self.assertTrue((references / name).exists(), name)

    def test_publishable_plugin_excludes_development_coordination_skills(self):
        bundled_skills = {path.name for path in PLUGIN_SKILLS.iterdir() if path.is_dir()}
        self.assertNotIn("github-project-agent-coordination", bundled_skills)
        self.assertNotIn("graphql-efficiency-strategist", bundled_skills)

        manifest = json.loads((REPO_ROOT / "plugins" / "cognitive-cycle" / ".codex-plugin" / "plugin.json").read_text())
        manifest_text = json.dumps(manifest)
        for term in ("GitHub Project", "GraphQL efficiency", "project board"):
            self.assertNotIn(term, manifest_text)

    def test_init_creates_valid_empty_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-test",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--mode",
                    "recommend-only",
                    "--scale",
                    "team",
                    "--source-scope",
                    "tests",
                    "--recursion-budget",
                    "1",
                    "--agent-set",
                    "p1=a,b",
                    "--same-phase-differentiation",
                    "p1.a=contract evidence",
                    "--same-phase-differentiation",
                    "p1.b=boundary evidence",
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())

            self.assertTrue((archive / "manifest.json").exists())
            manifest = json.loads((archive / "manifest.json").read_text())
            self.assertEqual(manifest["agent_model_policy"]["selection_rule"], "latest-available-gpt-mini")
            self.assertEqual(manifest["agent_model_policy"]["selected_cognitive_cycle_agent"], "gpt-5.4-mini")
            self.assertTrue(manifest["agent_model_policy"]["user_selectable"])
            self.assertFalse(manifest["semantic_evaluation_policy"]["regex_semantic_evaluation_allowed"])
            self.assertEqual(manifest["path_authority"]["roots"]["plugin"]["portable"], True)
            self.assertEqual(
                manifest["same_phase_differentiation"]["p1"]["a"]["focal_emphasis"],
                "contract evidence",
            )

            subprocess.run([sys.executable, str(VALIDATE_SCRIPT), str(archive)], check=True)

    def test_init_selects_latest_available_mini_variant(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-latest-model",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--available-agent-model",
                    "gpt-5.4-mini",
                    "--available-agent-model",
                    "gpt-5.12-mini",
                    "--available-agent-model",
                    "gpt-5.5",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            manifest = json.loads((archive / "manifest.json").read_text())
            self.assertEqual(manifest["agent_model_policy"]["selected_cognitive_cycle_agent"], "gpt-5.12-mini")

    def test_init_records_user_selected_cycle_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-user-selected-model",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--available-agent-model",
                    "gpt-5.4-mini",
                    "--available-agent-model",
                    "gpt-5.5",
                    "--selected-agent-model",
                    "gpt-5.5",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            manifest = json.loads((archive / "manifest.json").read_text())
            self.assertEqual(manifest["agent_model_policy"]["selection_rule"], "user-selected")
            self.assertEqual(manifest["agent_model_policy"]["available_agent_models"], ["gpt-5.4-mini", "gpt-5.5"])
            self.assertEqual(manifest["agent_model_policy"]["selected_cognitive_cycle_agent"], "gpt-5.5")

            subprocess.run([sys.executable, str(VALIDATE_SCRIPT), str(archive)], check=True)

    def test_cli_model_options_override_environment_defaults(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = dict(os.environ)
            env["COGNITIVE_CYCLE_AVAILABLE_MODELS"] = "gpt-5.99-mini"
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-cli-models",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
                env=env,
            )
            archive = Path(result.stdout.strip())
            manifest = json.loads((archive / "manifest.json").read_text())
            self.assertEqual(manifest["agent_model_policy"]["available_agent_models"], ["gpt-5.4-mini"])
            self.assertEqual(manifest["agent_model_policy"]["selected_cognitive_cycle_agent"], "gpt-5.4-mini")

    def test_validator_rejects_wrong_cycle_agent_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-model-policy",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--repo-root",
                    str(REPO_ROOT),
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            packet = {
                "packet_id": "p1-1",
                "cycle_id": "cycle-model-policy",
                "phase": "p1",
                "pass": 1,
                "owner": "p1-agent",
                "focal_emphasis": "single-agent",
                "agent_model": "different-model",
                "orienting_question": "What should be decided?",
                "implicit_unknown": "Which evidence matters?",
                "source_scope": ["tests"],
                "input_packets": [],
                "evidence_anchors": [{"ref": "repo:tests/test_cycle_harness.py", "kind": "test"}],
                "uncertainties": [],
                "handoff_target": "p2",
                "semantic_review": {
                    "status": "pending",
                    "reviewer": "controller",
                    "review_ref": "semantic-reviews/p1-1.md",
                },
                "scope_and_sources_inspected": ["tests"],
                "observations": ["A packet exists for structural validation."],
                "relevant_absences": [],
                "inferences_and_uncertainties": [],
                "risks_of_p1_insufficiency": [],
                "material_for_p2": [],
            }
            (archive / "packets" / "p1-1.json").write_text(json.dumps(packet, indent=2) + "\n")

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("agent_model must match manifest.agent_model_policy.selected_cognitive_cycle_agent", "\n".join(report["errors"]))

    def test_validator_rejects_non_latest_selected_mini_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-non-latest-model",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--available-agent-model",
                    "gpt-5.4-mini",
                    "--available-agent-model",
                    "gpt-5.8-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            manifest_path = archive / "manifest.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["agent_model_policy"]["selected_cognitive_cycle_agent"] = "gpt-5.4-mini"
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("selected_cognitive_cycle_agent must be the latest", "\n".join(report["errors"]))

    def test_validator_rejects_bare_evidence_anchor_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-bare-anchor",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--repo-root",
                    str(REPO_ROOT),
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            packet = {
                "packet_id": "p1-1",
                "cycle_id": "cycle-bare-anchor",
                "phase": "p1",
                "pass": 1,
                "owner": "p1-agent",
                "focal_emphasis": "single-agent",
                "agent_model": "gpt-5.4-mini",
                "orienting_question": "What should be decided?",
                "implicit_unknown": "Which evidence matters?",
                "source_scope": ["tests"],
                "input_packets": [],
                "evidence_anchors": ["plugins/cognitive-cycle/skills/full-cognitive-cycle/SKILL.md"],
                "uncertainties": [],
                "handoff_target": "p2",
                "semantic_review": {
                    "status": "pending",
                    "reviewer": "controller",
                    "review_ref": "semantic-reviews/p1-1.md",
                },
                "scope_and_sources_inspected": ["tests"],
                "observations": ["A packet exists for structural validation."],
                "relevant_absences": [],
                "inferences_and_uncertainties": [],
                "risks_of_p1_insufficiency": [],
                "material_for_p2": [],
            }
            (archive / "packets" / "p1-1.json").write_text(json.dumps(packet, indent=2) + "\n")

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("must use a symbolic root", "\n".join(report["errors"]))

    def test_validator_rejects_malformed_symbolic_evidence_anchor_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-malformed-symbolic-anchor",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--repo-root",
                    str(REPO_ROOT),
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            packet = self.p1_packet(
                "cycle-malformed-symbolic-anchor",
                "gpt-5.4-mini",
                evidence_anchors=[
                    {"ref": "plugin:/home/dgk/workspace/cognitive-disciplines/plugins/cognitive-cycle/SKILL.md"}
                ],
            )
            (archive / "packets" / "p1-1.json").write_text(json.dumps(packet, indent=2) + "\n")

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("must use a relative path under the symbolic root", "\n".join(report["errors"]))

    def test_validator_rejects_absolute_source_scope(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-absolute-source-scope",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--source-scope",
                    "/home/dgk/workspace/cognitive-disciplines",
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("must use a symbolic root", "\n".join(report["errors"]))

    def test_validator_rejects_accepted_review_without_artifact(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-missing-review",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--repo-root",
                    str(REPO_ROOT),
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            packet = self.p1_packet(
                "cycle-missing-review",
                "gpt-5.4-mini",
                semantic_review={
                    "status": "accepted",
                    "reviewer": "controller",
                    "review_ref": "archive:semantic-reviews/p1-1.md",
                },
            )
            (archive / "packets" / "p1-1.json").write_text(json.dumps(packet, indent=2) + "\n")

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("must point to an existing review artifact", "\n".join(report["errors"]))

    def test_validator_rejects_review_artifact_with_wrong_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-wrong-review-model",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--repo-root",
                    str(REPO_ROOT),
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            (archive / "semantic-reviews" / "p1-1.md").write_text(
                "# Semantic Review\n\n- reviewer: controller\n- model: gpt-5.5\n"
            )
            packet = self.p1_packet(
                "cycle-wrong-review-model",
                "gpt-5.4-mini",
                semantic_review={
                    "status": "accepted",
                    "reviewer": "controller",
                    "review_ref": "archive:semantic-reviews/p1-1.md",
                },
            )
            (archive / "packets" / "p1-1.json").write_text(json.dumps(packet, indent=2) + "\n")

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("semantic review model must match", "\n".join(report["errors"]))

    def test_route_validation_requires_accepted_packets(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-route-stage",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--repo-root",
                    str(REPO_ROOT),
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())
            packet = self.p1_packet("cycle-route-stage", "gpt-5.4-mini")
            (archive / "packets" / "p1-1.json").write_text(json.dumps(packet, indent=2) + "\n")

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--stage", "route", "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("semantic_review.status must be accepted for route validation", "\n".join(report["errors"]))

    def test_validator_rejects_missing_same_phase_focal_emphasis(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-missing-diff",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--agent-set",
                    "p1=a,b",
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())

            result = subprocess.run(
                [sys.executable, str(VALIDATE_SCRIPT), str(archive), "--json"],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            report = json.loads(result.stdout)
            self.assertFalse(report["valid"])
            self.assertIn("same_phase_differentiation.p1", "\n".join(report["errors"]))

    def test_init_rejects_invalid_agent_set_phase(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(INIT_SCRIPT),
                    "--archive-root",
                    tmp,
                    "--cycle-id",
                    "cycle-invalid-agent-set",
                    "--orienting-question",
                    "What should be decided?",
                    "--implicit-unknown",
                    "Which evidence matters?",
                    "--agent-set",
                    "typo=a,b",
                    "--available-agent-model",
                    "gpt-5.4-mini",
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("agent set phase must be one of", result.stderr)


if __name__ == "__main__":
    unittest.main()
