import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
INIT_SCRIPT = REPO_ROOT / "plugins" / "cognitive-cycle" / "scripts" / "init_cycle_run.py"
VALIDATE_SCRIPT = REPO_ROOT / "plugins" / "cognitive-cycle" / "scripts" / "validate_cycle_artifacts.py"


class CycleHarnessTests(unittest.TestCase):
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
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            archive = Path(result.stdout.strip())

            self.assertTrue((archive / "manifest.json").exists())
            manifest = json.loads((archive / "manifest.json").read_text())
            self.assertEqual(manifest["agent_model_policy"]["cognitive_cycle_agents"], "gpt-5.x-mini")
            self.assertFalse(manifest["semantic_evaluation_policy"]["regex_semantic_evaluation_allowed"])

            subprocess.run([sys.executable, str(VALIDATE_SCRIPT), str(archive)], check=True)

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
            self.assertIn("agent_model must be gpt-5.x-mini", "\n".join(report["errors"]))


if __name__ == "__main__":
    unittest.main()
