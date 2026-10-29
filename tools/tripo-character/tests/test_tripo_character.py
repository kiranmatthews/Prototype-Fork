from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


TOOL_DIR = Path(__file__).resolve().parents[1]
SCRIPT = TOOL_DIR / "tripo_character.py"


def load_module():
    spec = importlib.util.spec_from_file_location("tripo_character", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load tripo_character.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TripoCharacterWorkflowTests(unittest.TestCase):
    def test_json_parser_uses_final_nonempty_line(self):
        module = load_module()
        self.assertEqual(module.parse_json_stdout("\n{\"status\":\"success\"}\n", "fixture"), {"status": "success"})

    def test_result_file_basenames_resolve_under_output_dir(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            model = root / "model.glb"
            model.write_bytes(b"glTF")
            self.assertEqual(
                module.files_in_result({"output_dir": str(root), "files": ["model.glb"]}),
                [model.resolve()],
            )

    def test_dry_run_builds_the_documented_four_stage_pipeline(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "hero.png"
            image.write_bytes(b"\x89PNG\r\n\x1a\nfixture")
            output = root / "output"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "generate",
                    "--image",
                    str(image),
                    "--name",
                    "Hero Fixture",
                    "--out",
                    str(output),
                    "--dry-run",
                ],
                cwd=TOOL_DIR.parents[1],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            plan = json.loads(result.stdout)
            self.assertRegex(plan["cliVersion"], r"^\d+\.\d+\.\d+")
            self.assertEqual(plan["rigModel"], "v1.0-20240301")
            self.assertEqual(plan["rigSpec"], "mixamo")
            self.assertEqual(list(plan["commands"]), ["generate", "rigCheck", "rig", "retarget"])
            self.assertIn("preset:biped:victory_celebration", plan["animations"])
            self.assertNotIn("TRIPO_API_KEY", json.dumps(plan))
            self.assertIn("toy", plan["commands"]["generate"])
            self.assertTrue((output / "workflow-manifest.json").is_file())

    def test_review_resume_never_repeats_paid_generation(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "hero.png"
            image.write_bytes(b"fixture")
            model = root / "model.glb"
            model.write_bytes(b"glTF")
            command = ["generate", "--image", str(image), "--out", str(root / "output")]
            results = [{"status": "success", "model_file": str(model)},
                       {"status": "success", "riggable": True},
                       {"status": "success", "model_file": str(model)},
                       {"status": "success", "model_file": str(model)}]
            with patch.object(module, "cli_version", return_value="0.8.0"), \
                 patch.object(module, "run_tripo", side_effect=results) as run, \
                 patch.object(module, "run_probe"), patch.object(module, "run_character_seed"):
                module.main([*command, "--stop-after", "generate"])
                self.assertEqual(run.call_count, 1)
                with self.assertRaisesRegex(module.WorkflowError, "already contains"):
                    module.main(command)
                with self.assertRaisesRegex(module.WorkflowError, "differs"):
                    module.main([*command, "--resume", "--face-limit", "4000"])
                module.main([*command, "--resume"])
                self.assertEqual(run.call_count, 4)
                self.assertEqual([c.kwargs["label"] for c in run.call_args_list],
                                 ["generate", "rigCheck", "rig", "retarget"])
                self.assertEqual(run.call_args_list[2].kwargs["stdin_payload"], results[0])
                self.assertEqual(run.call_args_list[3].kwargs["stdin_payload"], results[2])

    def test_unknown_submission_outcome_cannot_be_retried_automatically(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "hero.png"
            image.write_bytes(b"fixture")
            command = ["generate", "--image", str(image), "--out", str(root / "output")]
            with patch.object(module, "cli_version", return_value="0.8.0"), \
                 patch.object(module, "run_tripo", side_effect=module.WorkflowError("network")) as run:
                with self.assertRaisesRegex(module.WorkflowError, "network"):
                    module.main(command)
                with self.assertRaisesRegex(module.WorkflowError, "unknown outcome"):
                    module.main([*command, "--resume"])
                self.assertEqual(run.call_count, 1)

    def test_cli_summary_requires_completed_gate_result_before_paid_rig(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "hero.png"
            image.write_bytes(b"fixture")
            results = [{"status":"success", "task_id":"surface"},
                       {"status":"success", "task_id":"check"},
                       {"status":"success", "output":{"riggable":False, "rig_type":"biped"}}]
            with patch.object(module, "cli_version", return_value="0.8.0"), \
                 patch.object(module, "run_tripo", side_effect=results) as run:
                with self.assertRaisesRegex(module.WorkflowError, "not confirmed"):
                    module.main(["generate", "--image", str(image), "--out", str(root / "output")])
                self.assertEqual([c.kwargs["label"] for c in run.call_args_list],
                                 ["generate", "rigCheck", "rig-check-result"])

    def test_p1_face_limit_fails_before_any_network_request(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / "hero.png"
            image.write_bytes(b"fixture")
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "generate",
                    "--image",
                    str(image),
                    "--face-limit",
                    "49",
                    "--dry-run",
                ],
                cwd=TOOL_DIR.parents[1],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("between 50 and 20,000", result.stderr)


if __name__ == "__main__":
    unittest.main()
