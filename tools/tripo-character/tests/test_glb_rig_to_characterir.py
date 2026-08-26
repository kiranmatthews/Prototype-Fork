from __future__ import annotations

import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest


TOOL_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = TOOL_DIR.parents[1]
SCRIPT = TOOL_DIR / "glb_rig_to_characterir.py"
VALIDATOR = REPO_ROOT / "vendor" / "img2threejs" / "forge" / "stage5_rig" / "validate_rig_payload.py"


def make_fixture(path: Path, *, scale_animation: bool = False) -> None:
    binary = bytearray()
    views = []
    accessors = []

    def add_accessor(rows, component_type, value_type, fmt, *, normalized=False):
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        for row in rows:
            binary.extend(struct.pack("<" + fmt * len(row), *row))
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(binary) - offset})
        accessor = {
            "bufferView": len(views) - 1,
            "byteOffset": 0,
            "componentType": component_type,
            "count": len(rows),
            "type": value_type,
        }
        if normalized:
            accessor["normalized"] = True
        accessors.append(accessor)
        return len(accessors) - 1

    position = add_accessor(
        [(-0.1, 0.0, 0.0), (0.1, 0.0, 0.0), (-0.1, 1.0, 0.0), (0.1, 1.0, 0.0)],
        5126,
        "VEC3",
        "f",
    )
    joints = add_accessor(
        [(0, 1, 0, 0), (0, 1, 0, 0), (1, 2, 0, 0), (1, 2, 0, 0)],
        5121,
        "VEC4",
        "B",
    )
    weights = add_accessor(
        [(255, 0, 0, 0), (128, 127, 0, 0), (128, 127, 0, 0), (0, 255, 0, 0)],
        5121,
        "VEC4",
        "B",
        normalized=True,
    )
    times = add_accessor([(0.0,), (1.0,)], 5126, "SCALAR", "f")
    rotations = add_accessor(
        [(0.0, 0.0, 0.0, 1.0), (0.70710677, 0.0, 0.0, 0.70710677)],
        5126,
        "VEC4",
        "f",
    )
    samplers = [{"input": times, "output": rotations, "interpolation": "LINEAR"}]
    channels = [{"sampler": 0, "target": {"node": 1, "path": "rotation"}}]
    if scale_animation:
        scales = add_accessor([(1.0, 1.0, 1.0), (1.1, 1.0, 1.0)], 5126, "VEC3", "f")
        samplers.append({"input": times, "output": scales, "interpolation": "LINEAR"})
        channels.append({"sampler": 1, "target": {"node": 1, "path": "scale"}})

    document = {
        "asset": {"version": "2.0", "generator": "test-fixture"},
        "scene": 0,
        "scenes": [{"nodes": [0, 3]}],
        "nodes": [
            {"name": "mixamorig:Hips", "translation": [0, 0.1, 0], "children": [1]},
            {"name": "mixamorig:Spine", "translation": [0, 0.5, 0], "children": [2]},
            {"name": "mixamorigHead", "translation": [0, 0.5, 0]},
            {"name": "FixtureMesh", "mesh": 0, "skin": 0},
        ],
        "meshes": [
            {
                "primitives": [
                    {"attributes": {"POSITION": position, "JOINTS_0": joints, "WEIGHTS_0": weights}}
                ]
            }
        ],
        "skins": [{"name": "FixtureSkin", "joints": [0, 1, 2], "skeleton": 0}],
        "animations": [{"name": "FixtureMotion", "samplers": samplers, "channels": channels}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": accessors,
    }
    json_chunk = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    binary.extend(b"\x00" * ((4 - len(binary) % 4) % 4))
    length = 12 + 8 + len(json_chunk) + 8 + len(binary)
    glb = bytearray(b"glTF")
    glb.extend(struct.pack("<II", 2, length))
    glb.extend(struct.pack("<II", len(json_chunk), 0x4E4F534A))
    glb.extend(json_chunk)
    glb.extend(struct.pack("<II", len(binary), 0x004E4942))
    glb.extend(binary)
    path.write_bytes(glb)


class GlbRigAdapterTests(unittest.TestCase):
    def test_fixture_extracts_and_passes_img2threejs_payload_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = root / "fixture.glb"
            output = root / "out"
            make_fixture(fixture)
            run = subprocess.run(
                [sys.executable, str(SCRIPT), str(fixture), "--out-dir", str(output)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            payload = json.loads((output / "rig-payload.json").read_text())
            seed = json.loads((output / "characterir-authoring-seed.json").read_text())
            report = json.loads((output / "glb-rig-report.json").read_text())
            self.assertEqual(payload["names"], ["pelvis", "spine", "head"])
            self.assertEqual(payload["parents"], [None, 0, 1])
            self.assertEqual(len(payload["skinIndex"]), 4)
            self.assertEqual(seed["kind"], "characterir-authoring-seed")
            self.assertEqual(seed["animationEvidence"][0]["channels"][0]["property"], "rotation-quaternion")
            self.assertEqual(report["unmappedJoints"], [])

            validate = subprocess.run(
                [sys.executable, str(VALIDATOR), "--payload", str(output / "rig-payload.json")],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(validate.returncode, 0, validate.stderr + validate.stdout)
            self.assertTrue(json.loads(validate.stdout)["passed"])

    def test_scale_animation_channel_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = root / "fixture-scale.glb"
            make_fixture(fixture, scale_animation=True)
            run = subprocess.run(
                [sys.executable, str(SCRIPT), str(fixture), "--out-dir", str(root / "out")],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(run.returncode, 2)
            self.assertIn("scale animation channels", run.stderr)

    def test_non_glb_input_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = root / "not.glb"
            fixture.write_bytes(b"not a glb")
            run = subprocess.run(
                [sys.executable, str(SCRIPT), str(fixture), "--out-dir", str(root / "out")],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(run.returncode, 2)
            self.assertIn("missing glTF magic", run.stderr)


if __name__ == "__main__":
    unittest.main()
