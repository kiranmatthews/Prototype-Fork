#!/usr/bin/env python3
"""Capture reference-framed material and map-stripped Punky Fox review views."""

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
    raise SystemExit("expected INPUT_GLB OUTPUT_DIR REPORT_JSON")
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
    look_at(obj, Vector((0.0, 0.0, 0.95)))


def render(path: Path) -> dict:
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": sha256(path)}


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
mesh_obj = next(
    obj
    for obj in bpy.context.scene.objects
    if obj.type == "MESH" and any(modifier.type == "ARMATURE" for modifier in obj.modifiers)
)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 640
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"

world = bpy.data.worlds.new("Review World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.73, 0.70, 0.72, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.75
scene.world = world

bpy.ops.mesh.primitive_plane_add(size=200, location=(0.0, 0.0, -0.003))
ground = bpy.context.object
ground.name = "Seamless review ground"
ground_material = bpy.data.materials.new("Seamless review ground")
ground_material.diffuse_color = (0.73, 0.70, 0.72, 1.0)
ground_material.use_nodes = True
ground_bsdf = ground_material.node_tree.nodes.get("Principled BSDF")
ground_bsdf.inputs["Base Color"].default_value = (0.73, 0.70, 0.72, 1.0)
ground_bsdf.inputs["Roughness"].default_value = 0.86
ground.data.materials.append(ground_material)

camera_data = bpy.data.cameras.new("Review Camera")
camera = bpy.data.objects.new("Review Camera", camera_data)
bpy.context.collection.objects.link(camera)
scene.camera = camera
camera.data.lens = 61

area_light("Key", (3.0, -4.0, 4.4), 640.0, 3.4)
area_light("Fill", (-3.2, -2.3, 2.8), 370.0, 3.8)
area_light("Rim", (2.4, 3.5, 3.4), 520.0, 2.7)

target = Vector((0.0, 0.0, 0.91))
views = []
for angle in (0, 40, 90):
    theta = math.radians(angle)
    camera.location = Vector((3.18 * math.sin(theta), -3.18 * math.cos(theta), 1.14))
    look_at(camera, target)
    evidence = render(output_dir / f"material-{angle:03d}.png")
    evidence["angleDegrees"] = angle
    evidence["kind"] = "material"
    views.append(evidence)

# A uniform diagnostic background gives the deterministic segmenter an
# unambiguous silhouette. This is not the beauty/review frame.
ground.hide_render = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.010, 0.010, 0.010, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.25
camera.location = Vector((0.0, -3.18, 1.14))
look_at(camera, target)
evidence = render(output_dir / "diagnostic-000.png")
evidence["angleDegrees"] = 0
evidence["kind"] = "diagnostic-material"
views.append(evidence)

# Tier-1 blockout evidence uses the exact same camera, but removes every texture
# and material response so the diagnostic can judge geometry without PBR maps.
stripped = bpy.data.materials.new("Map-stripped silhouette")
stripped.use_nodes = True
stripped_bsdf = stripped.node_tree.nodes.get("Principled BSDF")
stripped_bsdf.inputs["Base Color"].default_value = (0.62, 0.67, 0.74, 1.0)
stripped_bsdf.inputs["Metallic"].default_value = 0.0
stripped_bsdf.inputs["Roughness"].default_value = 0.82
mesh_obj.data.materials.clear()
mesh_obj.data.materials.append(stripped)
camera.location = Vector((0.0, -3.18, 1.14))
look_at(camera, target)
evidence = render(output_dir / "map-stripped-000.png")
evidence["angleDegrees"] = 0
evidence["kind"] = "map-stripped"
views.append(evidence)

report = {
    "schemaVersion": 1,
    "kind": "fixed-review-capture",
    "source": {"path": str(source), "bytes": source.stat().st_size, "sha256": sha256(source)},
    "camera": {"lensMm": camera.data.lens, "target": list(target), "radius": 3.18},
    "resolution": [scene.render.resolution_x, scene.render.resolution_y],
    "views": views,
}
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": "success", "report": str(report_path), "viewCount": len(views)}, indent=2))
