#!/usr/bin/env python3
"""Render representative frames from every embedded Punky Fox animation clip."""

from __future__ import annotations

import bpy
import hashlib
import json
import math
from mathutils import Vector
from pathlib import Path
import sys


argv = sys.argv[sys.argv.index("--") + 1 :]
if len(argv) != 3:
    raise SystemExit("expected ANIMATED_GLB OUTPUT_DIR REPORT_JSON")
source = Path(argv[0]).resolve()
output_dir = Path(argv[1]).resolve()
report_path = Path(argv[2]).resolve()
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


def area_light(name: str, location, energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    look_at(obj, Vector((0.0, 0.0, 0.9)))


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
mesh_obj = next(
    obj
    for obj in bpy.context.scene.objects
    if obj.type == "MESH" and any(modifier.type == "ARMATURE" for modifier in obj.modifiers)
)
actions = {action.name: action for action in bpy.data.actions if action.name in {"idle", "walk", "run", "jump", "spin", "slide", "crawl", "fall", "bail", "death"}}
missing = sorted({"idle", "walk", "run", "jump", "spin", "slide", "crawl", "fall", "bail", "death"} - actions.keys())
if missing:
    raise RuntimeError(f"animated GLB is missing actions: {', '.join(missing)}")

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 360
scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
world = bpy.data.worlds.new("Animation Review World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.06, 0.075, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
scene.world = world

camera_data = bpy.data.cameras.new("Animation Review Camera")
camera = bpy.data.objects.new("Animation Review Camera", camera_data)
bpy.context.collection.objects.link(camera)
scene.camera = camera
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.35
camera.location = (0.0, -4.0, 1.0)
look_at(camera, Vector((0.0, 0.0, 0.92)))
area_light("Key", (3.2, -4.2, 4.2), 680.0, 3.0)
area_light("Fill", (-3.4, -2.0, 2.7), 360.0, 3.8)
area_light("Rim", (2.0, 3.8, 3.3), 520.0, 2.6)

if armature.animation_data is None:
    armature.animation_data_create()

records = []
fractions = (0.0, 0.33, 0.66, 0.95)
for name in ("idle", "walk", "run", "jump", "spin", "slide", "crawl", "fall", "bail", "death"):
    action = actions[name]
    armature.animation_data.action = action
    start, end = map(float, action.frame_range)
    for sample_index, fraction in enumerate(fractions):
        frame = start + (end - start) * fraction
        scene.frame_set(int(math.floor(frame)), subframe=frame - math.floor(frame))
        bpy.context.view_layer.update()
        path = output_dir / f"{name}-{sample_index}-{fraction:.2f}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        bounds = bpy.context.evaluated_depsgraph_get()
        evaluated = mesh_obj.evaluated_get(bounds)
        corners = [evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box]
        record = {
            "clip": name,
            "sample": sample_index,
            "fraction": fraction,
            "frame": frame,
            "path": str(path),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "bounds": {
                "min": [min(point[axis] for point in corners) for axis in range(3)],
                "max": [max(point[axis] for point in corners) for axis in range(3)],
            },
        }
        records.append(record)

report = {
    "schemaVersion": 1,
    "kind": "embedded-animation-visual-evidence",
    "source": {"path": str(source), "bytes": source.stat().st_size, "sha256": sha256(source)},
    "clips": list(actions),
    "samplesPerClip": len(fractions),
    "renders": records,
    "reviewBoundary": "Representative still frames only; browser transition timing and interactivity are reviewed separately.",
}
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": "success", "clipCount": len(actions), "renderCount": len(records), "report": str(report_path)}, indent=2))
