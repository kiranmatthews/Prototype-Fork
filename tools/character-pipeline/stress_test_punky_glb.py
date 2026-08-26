#!/usr/bin/env python3
"""Render deterministic deformation stress poses for the web Punky Fox GLB.

Run with Blender 5.2+:
  blender --background --python stress_test_punky_glb.py -- INPUT_GLB OUTPUT_DIR REPORT_JSON

The poses are deliberately exaggerated. They are a deformation QA instrument,
not shipped gameplay animation.
"""

from __future__ import annotations

import bpy
import hashlib
import json
import math
from mathutils import Euler, Vector
from pathlib import Path
import sys


argv = sys.argv[sys.argv.index("--") + 1 :]
if len(argv) not in (3, 4):
    raise SystemExit("expected INPUT_GLB OUTPUT_DIR REPORT_JSON [POSES_COMMA_SEPARATED]")
source = Path(argv[0]).resolve()
output_dir = Path(argv[1]).resolve()
report_path = Path(argv[2]).resolve()
pose_filter = set(argv[3].split(",")) if len(argv) == 4 else None
output_dir.mkdir(parents=True, exist_ok=True)
report_path.parent.mkdir(parents=True, exist_ok=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    look_at(obj, Vector((0.0, 0.0, 0.95)))


def reset_pose(armature: bpy.types.Object) -> None:
    for bone in armature.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def rotate(armature: bpy.types.Object, name: str, degrees: tuple[float, float, float]) -> None:
    bone = armature.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"missing required stress-pose bone: {name}")
    bone.rotation_mode = "XYZ"
    bone.rotation_euler = Euler(tuple(math.radians(value) for value in degrees), "XYZ")


def pose_neutral(_armature: bpy.types.Object) -> None:
    return


def pose_shoulders(armature: bpy.types.Object) -> None:
    # Opposed extreme shoulder/elbow angles expose armpit and elbow collapse.
    rotate(armature, "LeftArm", (18, -12, 105))
    rotate(armature, "LeftForeArm", (0, -12, 105))
    rotate(armature, "RightArm", (-18, 12, -105))
    rotate(armature, "RightForeArm", (0, 12, -105))
    rotate(armature, "LeftHand", (0, 35, 12))
    rotate(armature, "RightHand", (0, -35, -12))


def pose_deep_squat(armature: bpy.types.Object) -> None:
    # Symmetric deep flexion approximates a compressed landing/ollie charge.
    rotate(armature, "Hips", (-10, 0, 0))
    rotate(armature, "LeftUpLeg", (58, 8, -5))
    rotate(armature, "RightUpLeg", (58, -8, 5))
    rotate(armature, "LeftLeg", (-102, 0, 0))
    rotate(armature, "RightLeg", (-102, 0, 0))
    rotate(armature, "LeftFoot", (42, 0, 0))
    rotate(armature, "RightFoot", (42, 0, 0))
    rotate(armature, "Spine02", (15, 0, 0))
    rotate(armature, "Spine01", (12, 0, 0))
    rotate(armature, "Spine", (8, 0, 0))
    rotate(armature, "LeftArm", (-25, 0, 18))
    rotate(armature, "RightArm", (-25, 0, -18))


def pose_twist(armature: bpy.types.Object) -> None:
    rotate(armature, "Hips", (0, 0, -12))
    rotate(armature, "Spine02", (0, 0, 20))
    rotate(armature, "Spine01", (0, 0, 18))
    rotate(armature, "Spine", (0, 0, 16))
    rotate(armature, "neck", (0, 0, -18))
    rotate(armature, "Head", (0, 0, -18))
    rotate(armature, "LeftArm", (20, 0, 32))
    rotate(armature, "RightArm", (-20, 0, -32))


def pose_secondary(armature: bpy.types.Object) -> None:
    rotate(armature, "Ear.L", (22, -18, 14))
    rotate(armature, "Ear.R", (-22, 18, -14))
    rotate(armature, "Ponytail.L", (-28, 18, 24))
    rotate(armature, "Ponytail.L.Tip", (-34, 12, 20))
    rotate(armature, "Ponytail.R", (28, -18, -24))
    rotate(armature, "Ponytail.R.Tip", (34, -12, -20))


def pose_secondary_runtime_limit(armature: bpy.types.Object) -> None:
    # Maximum amplitudes used by the runtime springs: lively, but below the
    # destructive authoring-only envelope above.
    rotate(armature, "Ear.L", (7, -5, 4))
    rotate(armature, "Ear.R", (-7, 5, -4))
    rotate(armature, "Ponytail.L", (-13, 8, 10))
    rotate(armature, "Ponytail.L.Tip", (-18, 6, 11))
    rotate(armature, "Ponytail.R", (13, -8, -10))
    rotate(armature, "Ponytail.R.Tip", (18, -6, -11))


def pose_head_x_positive(armature: bpy.types.Object) -> None:
    rotate(armature, "Head", (12, 0, 0))


def pose_head_x_negative(armature: bpy.types.Object) -> None:
    rotate(armature, "Head", (-12, 0, 0))


def pose_skate_silhouette(armature: bpy.types.Object) -> None:
    rotate(armature, "Hips", (-7, 7, -9))
    rotate(armature, "Spine02", (12, -7, 7))
    rotate(armature, "Spine01", (10, -6, 6))
    rotate(armature, "Spine", (7, -5, 5))
    rotate(armature, "LeftUpLeg", (36, 8, -8))
    rotate(armature, "RightUpLeg", (25, -9, 10))
    rotate(armature, "LeftLeg", (-62, 0, 0))
    rotate(armature, "RightLeg", (-48, 0, 0))
    rotate(armature, "LeftFoot", (24, 0, -8))
    rotate(armature, "RightFoot", (18, 0, 8))
    rotate(armature, "LeftArm", (-12, 30, 58))
    rotate(armature, "LeftForeArm", (8, -12, 48))
    rotate(armature, "RightArm", (16, -32, -70))
    rotate(armature, "RightForeArm", (-8, 14, -46))
    rotate(armature, "neck", (0, 5, -4))
    rotate(armature, "Head", (0, 7, 6))
    pose_secondary(armature)


POSES = {
    "neutral": pose_neutral,
    "shoulder-elbow-extremes": pose_shoulders,
    "deep-squat": pose_deep_squat,
    "torso-twist": pose_twist,
    "secondary-extremes": pose_secondary,
    "secondary-runtime-limit": pose_secondary_runtime_limit,
    "head-x-positive": pose_head_x_positive,
    "head-x-negative": pose_head_x_negative,
    "skate-silhouette": pose_skate_silhouette,
}
if pose_filter is not None:
    unknown = pose_filter - POSES.keys()
    if unknown:
        raise RuntimeError("unknown pose filter values: " + ", ".join(sorted(unknown)))
    POSES = {name: pose for name, pose in POSES.items() if name in pose_filter}
ANGLES = (0, 40, 90)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
skinned = [
    obj
    for obj in bpy.context.scene.objects
    if obj.type == "MESH" and any(modifier.type == "ARMATURE" for modifier in obj.modifiers)
]
if len(skinned) != 1:
    raise RuntimeError(f"expected one mesh, found {len(skinned)}")
mesh_obj = skinned[0]

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 540
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = False
scene.render.image_settings.color_depth = "8"
scene.view_settings.look = "AgX - Medium High Contrast"
if scene.world is None:
    scene.world = bpy.data.worlds.new("QA World")
scene.world.color = (0.025, 0.028, 0.04)

# Ground/shadow receiver.
bpy.ops.mesh.primitive_plane_add(size=10, location=(0.0, 0.0, -0.002))
ground = bpy.context.object
ground.name = "QA Ground"
ground_material = bpy.data.materials.new("QA Ground")
ground_material.diffuse_color = (0.035, 0.042, 0.06, 1.0)
ground.data.materials.append(ground_material)

camera_data = bpy.data.cameras.new("QA Camera")
camera = bpy.data.objects.new("QA Camera", camera_data)
bpy.context.collection.objects.link(camera)
scene.camera = camera
camera.data.lens = 58

add_area("Key", (3.2, -4.2, 4.2), 760.0, 3.2)
add_area("Fill", (-3.8, -1.5, 2.6), 440.0, 3.6)
add_area("Rim", (1.4, 3.8, 3.5), 620.0, 2.5)

renders = []
for pose_name, apply_pose in POSES.items():
    reset_pose(armature)
    apply_pose(armature)
    bpy.context.view_layer.update()
    for angle in ANGLES:
        theta = math.radians(angle)
        target = Vector((0.0, 0.0, 0.91))
        camera.location = Vector((3.05 * math.sin(theta), -3.05 * math.cos(theta), 1.18))
        look_at(camera, target)
        path = output_dir / f"{pose_name}-{angle:03d}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        renders.append({"pose": pose_name, "angleDegrees": angle, "path": str(path), "bytes": path.stat().st_size, "sha256": sha256(path)})

report = {
    "schemaVersion": 1,
    "kind": "deformation-stress-review-evidence",
    "source": {"path": str(source), "bytes": source.stat().st_size, "sha256": sha256(source)},
    "mesh": {"name": mesh_obj.name, "vertices": len(mesh_obj.data.vertices), "polygons": len(mesh_obj.data.polygons)},
    "rig": {"name": armature.name, "bones": [bone.name for bone in armature.data.bones]},
    "poses": list(POSES),
    "anglesDegrees": list(ANGLES),
    "renders": renders,
    "reviewBoundary": "Rendered evidence only; a human/AI visual pass must record deformation findings separately.",
}
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": "success", "renderCount": len(renders), "report": str(report_path)}, indent=2))
