from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


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
            self.assertEqual(plan["cliVersion"], "0.2.1")
            self.assertEqual(plan["rigModel"], "v1.0-20240301")
            self.assertEqual(plan["rigSpec"], "mixamo")
            self.assertEqual(list(plan["commands"]), ["generate", "rigCheck", "rig", "retarget"])
            self.assertIn("preset:biped:victory_celebration", plan["animations"])
            self.assertNotIn("TRIPO_API_KEY", json.dumps(plan))
            self.assertTrue((output / "workflow-manifest.json").is_file())

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
