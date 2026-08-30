"""Extract the production Whirlwind Vixen mesh as a material-free web GLB.

Run with Blender:
  blender --background --python tools/spin-effects/export_spin_model.py -- INPUT.fbx OUTPUT.glb
"""

from __future__ import annotations

import os
import sys

import bpy


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit("expected INPUT.fbx and OUTPUT.glb after --")
    source, destination = map(os.path.abspath, args)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=source)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"no mesh imported from {source}")
    # The archive contains Blender's default cube. Production is the dense
    # 91,530-triangle sculpture, selected by polygon count rather than name.
    model = max(meshes, key=lambda obj: len(obj.data.polygons))
    for obj in list(bpy.context.scene.objects):
        if obj is not model:
            bpy.data.objects.remove(obj, do_unlink=True)
    model.name = "WhirlwindVixen020205"
    model.data.name = "WhirlwindVixen020205_Mesh"
    model.data.materials.clear()
    bpy.context.view_layer.objects.active = model
    model.select_set(True)
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=destination,
        export_format="GLB",
        use_selection=True,
        export_materials="NONE",
        export_normals=False,
        export_tangents=False,
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )


if __name__ == "__main__":
    main()
