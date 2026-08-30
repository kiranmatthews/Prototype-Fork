"""Bake Unity's normalized skateboard-truck prefab transform into a web GLB.

Run with Blender, for example:
  blender --background --python tools/skateboard/export_truck.py -- INPUT.fbx OUTPUT.glb
"""

from __future__ import annotations

import math
import os
import sys

import bpy


def args_after_separator() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def main() -> None:
    args = args_after_separator()
    if len(args) != 2:
        raise SystemExit("expected INPUT.fbx and OUTPUT.glb after --")
    source, destination = map(os.path.abspath, args)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=source)

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"no meshes imported from {source}")
    # The source archive also contains Blender's default cube. The authored
    # truck is the dense mesh and is selected by polygon count, not name.
    truck = max(meshes, key=lambda obj: len(obj.data.polygons))
    for obj in list(bpy.context.scene.objects):
        if obj is not truck:
            bpy.data.objects.remove(obj, do_unlink=True)

    truck.name = "SkateboardTruck_Normalized"
    truck.data.name = "SkateboardTruck_Normalized_Mesh"
    truck.data.materials.clear()
    # This is exactly the reusable Unity prefab child transform. The runtime
    # presentation applies replacementTruckScale (2.2098 by default) outside
    # it, so the exported mesh keeps that tuning control meaningful.
    truck.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    truck.location = (0.0, -0.03539066, 0.0)
    truck.scale = (0.24, 0.24, 0.24)
    bpy.context.view_layer.objects.active = truck
    truck.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    os.makedirs(os.path.dirname(destination), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=destination,
        export_format="GLB",
        use_selection=True,
        export_materials="NONE",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )


if __name__ == "__main__":
    main()
