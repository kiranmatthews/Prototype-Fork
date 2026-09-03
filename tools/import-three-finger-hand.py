#!/usr/bin/env python3
"""Bake Andy Cuccaro's CC BY three-finger hand into a compact web GLB.

Run inside Blender (embedded scripts disabled):

  Blender --background --disable-autoexec SOURCE.blend \
    --python tools/import-three-finger-hand.py -- OUTPUT.glb

The source is a generated Rigify arm with 118 bones. The browser asset keeps
only one rigid palm/root plus the twelve deforming digit bones already exposed
by CharacterIR. Palm and forearm weights are folded into the root; digit
weights are capped and normalized to four influences for portable glTF skinning.
The materials have no textures, so unused UV sets and constant vertex-color
layers are excluded without changing the rendered surface.
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Matrix


SOURCE_MESH = "Mano"
SOURCE_ARMATURE = "rig"
SUBDIVISION_LEVEL = 2

DIGIT_BONES = (
    ("DEF-f_index.01.L", "finger-index-proximal"),
    ("DEF-f_index.02.L", "finger-index-middle"),
    ("DEF-f_index.03.L", "finger-index-distal"),
    ("DEF-f_middle.01.L", "finger-middle-proximal"),
    ("DEF-f_middle.02.L", "finger-middle-middle"),
    ("DEF-f_middle.03.L", "finger-middle-distal"),
    ("DEF-f_pinky.01.L", "finger-outer-proximal"),
    ("DEF-f_pinky.02.L", "finger-outer-middle"),
    ("DEF-f_pinky.03.L", "finger-outer-distal"),
    ("DEF-thumb.01.L", "thumb-metacarpal"),
    ("DEF-thumb.02.L", "thumb-proximal"),
    ("DEF-thumb.03.L", "thumb-distal"),
)

PARENT_BASE = {
    "finger-index-middle": "finger-index-proximal",
    "finger-index-distal": "finger-index-middle",
    "finger-middle-middle": "finger-middle-proximal",
    "finger-middle-distal": "finger-middle-middle",
    "finger-outer-middle": "finger-outer-proximal",
    "finger-outer-distal": "finger-outer-middle",
    "thumb-proximal": "thumb-metacarpal",
    "thumb-distal": "thumb-proximal",
}


def output_path() -> Path:
    if "--" not in sys.argv:
        raise RuntimeError("expected OUTPUT.glb after --")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if len(args) != 1:
        raise RuntimeError("expected exactly one OUTPUT.glb argument")
    target = Path(args[0]).expanduser().resolve()
    if target.suffix.lower() != ".glb":
        raise RuntimeError("output must end in .glb")
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def source_objects() -> tuple[bpy.types.Object, bpy.types.Object]:
    mesh = bpy.data.objects.get(SOURCE_MESH)
    armature = bpy.data.objects.get(SOURCE_ARMATURE)
    if mesh is None or mesh.type != "MESH":
        raise RuntimeError(f"source mesh {SOURCE_MESH!r} was not found")
    if armature is None or armature.type != "ARMATURE":
        raise RuntimeError(f"source armature {SOURCE_ARMATURE!r} was not found")
    missing = [name for name, _ in DIGIT_BONES if armature.data.bones.get(name) is None]
    if missing:
        raise RuntimeError(f"source armature is missing digit bones: {missing}")
    return mesh, armature


def evaluated_surface_copy(source: bpy.types.Object) -> bpy.types.Object:
    copy = source.copy()
    copy.data = source.data.copy()
    copy.name = "artist-hand-source-surface"
    bpy.context.collection.objects.link(copy)

    for modifier in tuple(copy.modifiers):
        if modifier.type == "ARMATURE":
            copy.modifiers.remove(modifier)
        elif modifier.type == "SUBSURF":
            modifier.levels = SUBDIVISION_LEVEL
            modifier.render_levels = SUBDIVISION_LEVEL

    bpy.ops.object.select_all(action="DESELECT")
    copy.select_set(True)
    bpy.context.view_layer.objects.active = copy
    for modifier in tuple(copy.modifiers):
        if modifier.type == "SUBSURF":
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        else:
            copy.modifiers.remove(modifier)
    return copy


def collect_weights(source: bpy.types.Object) -> list[dict[str, float]]:
    source_names = {group.index: group.name for group in source.vertex_groups}
    digit_names = {old: new for old, new in DIGIT_BONES}
    weights: list[dict[str, float]] = []
    for vertex in source.data.vertices:
        row: dict[str, float] = {}
        for membership in vertex.groups:
            if membership.weight <= 1e-8:
                continue
            old_name = source_names[membership.group]
            target = digit_names.get(old_name, "artist-hand-root")
            row[target] = row.get(target, 0.0) + membership.weight
        if not row:
            row["artist-hand-root"] = 1.0
        kept = sorted(row.items(), key=lambda item: item[1], reverse=True)[:4]
        total = sum(weight for _, weight in kept)
        weights.append({name: weight / total for name, weight in kept})
    return weights


def replace_weights(mesh: bpy.types.Object, weights: list[dict[str, float]], side: str) -> None:
    while mesh.vertex_groups:
        mesh.vertex_groups.remove(mesh.vertex_groups[0])
    names = ["artist-hand-root", *(new for _, new in DIGIT_BONES)]
    groups = {
        name: mesh.vertex_groups.new(name=f"{name}-{side}")
        for name in names
    }
    for index, row in enumerate(weights):
        for base_name, weight in row.items():
            groups[base_name].add((index,), weight, "REPLACE")


def make_armature(
    source: bpy.types.Object,
    side: str,
    transform: Matrix,
) -> bpy.types.Object:
    data = bpy.data.armatures.new(f"artist-hand-armature-{side}")
    armature = bpy.data.objects.new(f"artist-hand-armature-{side}", data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    source_root = source.data.bones["DEF-hand.L"]
    root = data.edit_bones.new(f"artist-hand-root-{side}")
    root.head = source_root.head_local
    root.tail = source_root.tail_local
    root.roll = source_root.matrix_local.to_euler("XYZ").y

    created: dict[str, bpy.types.EditBone] = {}
    for source_name, base_name in DIGIT_BONES:
        source_bone = source.data.bones[source_name]
        target = data.edit_bones.new(f"{base_name}-{side}")
        target.head = source_bone.head_local
        target.tail = source_bone.tail_local
        # matrix_local carries the authored roll more reliably than guessing
        # its sign from the head/tail vector.
        target.matrix = source_bone.matrix_local
        target.length = source_bone.length
        created[base_name] = target

    for _, base_name in DIGIT_BONES:
        parent_base = PARENT_BASE.get(base_name)
        created[base_name].parent = created[parent_base] if parent_base else root
        created[base_name].use_connect = parent_base is not None

    bpy.ops.object.mode_set(mode="OBJECT")
    data.transform(transform)
    return armature


def build_side(
    source_mesh: bpy.types.Object,
    source_armature: bpy.types.Object,
    weights: list[dict[str, float]],
    side: str,
    transform: Matrix,
) -> tuple[bpy.types.Object, bpy.types.Object, bpy.types.Object]:
    root = bpy.data.objects.new(f"artist-hand-{side}", None)
    bpy.context.collection.objects.link(root)
    root["source"] = "Andy Cuccaro Three Fingers Hand Rig"
    root["license"] = "CC-BY-4.0"

    mesh = source_mesh.copy()
    mesh.data = source_mesh.data.copy()
    mesh.name = f"artist-hand-surface-{side}"
    mesh.data.name = f"artist-hand-surface-{side}"
    bpy.context.collection.objects.link(mesh)
    mesh.data.transform(transform)
    if transform.determinant() < 0:
        mesh.data.flip_normals()
    replace_weights(mesh, weights, side)

    armature = make_armature(source_armature, side, transform)
    armature.parent = root
    mesh.parent = armature
    modifier = mesh.modifiers.new(name="artist-hand-skin", type="ARMATURE")
    modifier.object = armature

    for polygon in mesh.data.polygons:
        polygon.use_smooth = True
    return root, armature, mesh


def validate_side(side: str, armature: bpy.types.Object, mesh: bpy.types.Object) -> None:
    expected = {f"artist-hand-root-{side}", *(f"{name}-{side}" for _, name in DIGIT_BONES)}
    actual = {bone.name for bone in armature.data.bones}
    if actual != expected:
        raise RuntimeError(f"{side} armature mismatch: {sorted(actual ^ expected)}")
    if len(mesh.data.vertices) < 5000:
        raise RuntimeError(f"{side} subdivision was not applied ({len(mesh.data.vertices)} vertices)")
    for vertex in mesh.data.vertices:
        positive = [group for group in vertex.groups if group.weight > 1e-7]
        if not positive or len(positive) > 4:
            raise RuntimeError(f"{side} vertex {vertex.index} has {len(positive)} influences")
        if abs(sum(group.weight for group in positive) - 1.0) > 2e-4:
            raise RuntimeError(f"{side} vertex {vertex.index} weights are not normalized")


def main() -> None:
    target = output_path()
    source_mesh, source_armature = source_objects()
    baked = evaluated_surface_copy(source_mesh)
    weights = collect_weights(baked)

    # Blender source +Z is exported as glTF +Y. Rotate it to -Z before export
    # so the finished glTF fingers point down local -Y like the player wrists.
    orient = Matrix.Rotation(math.pi, 4, "X")
    mirror_x = Matrix.Scale(-1.0, 4, (1.0, 0.0, 0.0))
    built = [
        build_side(baked, source_armature, weights, "left", orient),
        build_side(baked, source_armature, weights, "right", mirror_x @ orient),
    ]
    for root, armature, mesh in built:
        validate_side(root.name.rsplit("-", 1)[-1], armature, mesh)

    bpy.ops.object.select_all(action="DESELECT")
    for triple in built:
        for obj in triple:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.fspath(target),
        check_existing=False,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_texcoords=False,
        export_skins=True,
        export_all_influences=False,
        export_influence_nb=4,
        export_animations=False,
        export_morph=False,
        export_materials="EXPORT",
        export_vertex_color="NONE",
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_apply=False,
        export_leaf_bone=False,
        export_def_bones=False,
        export_copyright="Hand Rig by Andy Cuccaro · CC BY 4.0",
    )
    print(
        "EXPORTED",
        target,
        "bytes=",
        target.stat().st_size,
        "vertices_per_hand=",
        len(built[0][2].data.vertices),
        "bones_per_hand=",
        len(built[0][1].data.bones),
    )


if __name__ == "__main__":
    main()
