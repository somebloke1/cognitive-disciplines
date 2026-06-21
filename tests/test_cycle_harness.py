import json
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
    def test_plugin_contains_curriculum_harness_references(self):
        references = REPO_ROOT / "plugins" / "cognitive-cycle" / "skills" / "ep-cognitive-cycle" / "references"
        for name in (
            "curriculum-primers.md",
            "acceptance-gates.md",
            "controller-transition-matrix.md",
            "semantic-review-template.md",
            "harness-structural-contract.md",
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
            self.assertFalse(manifest["semantic_evaluation_policy"]["regex_semantic_evaluation_allowed"])

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
                "agent_model": "different-model",
                "orienting_question": "What should be decided?",
                "implicit_unknown": "Which evidence matters?",
                "source_scope": ["tests"],
                "input_packets": [],
                "evidence_anchors": ["tests/test_cycle_harness.py"],
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
            self.assertIn("agent_model must be a concrete gpt-*.*-mini model id", "\n".join(report["errors"]))

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


if __name__ == "__main__":
    unittest.main()
