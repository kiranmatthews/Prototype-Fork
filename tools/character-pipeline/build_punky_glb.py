#!/usr/bin/env python3
"""Build the high-fidelity web Punky Fox GLB from the canonical owner-supplied FBX.

Run with Blender 5.2+:
  blender --background --python build_punky_glb.py -- SOURCE_FBX TEXTURE_DIR OUT_GLB REPORT_JSON
"""

import bpy
import bmesh
from array import array
from collections import Counter
import hashlib
import json
import math
from mathutils import Vector
from mathutils.kdtree import KDTree
from pathlib import Path
import sys


argv = sys.argv[sys.argv.index("--") + 1 :]
if len(argv) != 4:
    raise SystemExit("expected SOURCE_FBX TEXTURE_DIR OUT_GLB REPORT_JSON")
source = Path(argv[0]).resolve()
texture_dir = Path(argv[1]).resolve()
output = Path(argv[2]).resolve()
report_path = Path(argv[3]).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
report_path.parent.mkdir(parents=True, exist_ok=True)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def finite_vector(values):
    return all(math.isfinite(float(value)) for value in values)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source), use_anim=False)
mesh_obj = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
mesh = mesh_obj.data

# The running game owns motion. The bind GLB ships no one-frame scale clip.
for obj in bpy.context.scene.objects:
    obj.animation_data_clear()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

# Load the web-tier base color for deterministic semantic color sampling.
base_color_path = texture_dir / "punky-basecolor-2k.png"
normal_path = texture_dir / "punky-normal-2k.png"
metallic_path = texture_dir / "punky-metallic-1k.png"
roughness_path = texture_dir / "punky-roughness-1k.png"
for path in (base_color_path, normal_path, metallic_path, roughness_path):
    if not path.is_file():
        raise RuntimeError(f"missing prepared texture: {path}")
sample_image = bpy.data.images.load(str(base_color_path), check_existing=True)
width, height = sample_image.size
pixels = array("f", [0.0]) * (width * height * 4)
sample_image.pixels.foreach_get(pixels)

uv_layer = mesh.uv_layers.active
if uv_layer is None:
    raise RuntimeError("canonical mesh has no active UV layer")
uv_sum = [[0.0, 0.0, 0] for _ in mesh.vertices]
for loop in mesh.loops:
    uv = uv_layer.data[loop.index].uv
    row = uv_sum[loop.vertex_index]
    row[0] += uv.x
    row[1] += uv.y
    row[2] += 1


def linear_to_srgb(value):
    return 12.92 * value if value <= 0.0031308 else 1.055 * value ** (1.0 / 2.4) - 0.055


def vertex_color(index):
    u, v, count = uv_sum[index]
    if count == 0:
        return (0.0, 0.0, 0.0)
    u = (u / count) % 1.0
    v = (v / count) % 1.0
    x = min(width - 1, max(0, int(u * (width - 1) + 0.5)))
    y = min(height - 1, max(0, int(v * (height - 1) + 0.5)))
    offset = (y * width + x) * 4
    return tuple(linear_to_srgb(max(0.0, min(1.0, pixels[offset + channel]))) for channel in range(3))


world_positions = [mesh_obj.matrix_world @ vertex.co for vertex in mesh.vertices]
colors = [vertex_color(vertex.index) for vertex in mesh.vertices]

def is_blonde(color):
    r, g, b = color
    return r > 0.68 and g > 0.48 and b < 0.62 and (r - g) < 0.38


def is_orange(color):
    r, g, b = color
    return r > 0.65 and 0.12 < g < 0.68 and b < 0.42 and (r - g) > 0.22


hair_seeds = {
    index
    for index, (point, color) in enumerate(zip(world_positions, colors))
    if point.z > 1.22 and abs(point.x) > 0.115 and point.y > -0.035 and is_blonde(color)
}
ear_seeds = {
    index
    for index, (point, color) in enumerate(zip(world_positions, colors))
    if point.z > 1.50 and abs(point.x) > 0.040 and is_orange(color)
}
tail_vertices = {index for index, (point, color) in enumerate(zip(world_positions, colors)) if point.z < 1.0 and abs(point.x) < 0.20 and point.y > 0.035 and is_orange(color)}
outer_hair_seeds = {
    index
    for index, point in enumerate(world_positions)
    if point.z > 1.12 and abs(point.x) > 0.235 and point.y > -0.055
}

# The original helper bone owns an arbitrary half of the head. Fold it back into Head;
# secondary hair/ear groups are assigned explicitly below.
head_group = mesh_obj.vertex_groups.get("Head")
head_end_group = mesh_obj.vertex_groups.get("head_end")
if head_group is None or head_end_group is None:
    raise RuntimeError("canonical Head/head_end groups are missing")
for vertex in mesh.vertices:
    helper_weight = next((entry.weight for entry in vertex.groups if entry.group == head_end_group.index), 0.0)
    if helper_weight <= 0:
        continue
    head_weight = next((entry.weight for entry in vertex.groups if entry.group == head_group.index), 0.0)
    head_group.add([vertex.index], head_weight + helper_weight, "REPLACE")
    head_end_group.remove([vertex.index])


def group_weight(vertex, group):
    return next((entry.weight for entry in vertex.groups if entry.group == group.index), 0.0)


head_domain = {vertex.index for vertex in mesh.vertices if group_weight(vertex, head_group) > 0.08}


def create_bone(name, parent_name, head_world, tail_world):
    bone = armature.data.edit_bones.new(name)
    inverse = armature.matrix_world.inverted()
    bone.head = inverse @ Vector(head_world)
    bone.tail = inverse @ Vector(tail_world)
    bone.parent = armature.data.edit_bones[parent_name]
    bone.use_connect = False
    bone.use_deform = True
    return bone


def side_bounds(indices):
    points = [world_positions[index] for index in indices]
    if not points:
        return None
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    center = sum(points, Vector()) / len(points)
    return minimum, maximum, center


hair_by_side = {
    "L": {index for index in hair_seeds | outer_hair_seeds if world_positions[index].x > 0},
    "R": {index for index in hair_seeds | outer_hair_seeds if world_positions[index].x < 0},
}
ear_by_side = {
    "L": {index for index in ear_seeds if world_positions[index].x > 0},
    "R": {index for index in ear_seeds if world_positions[index].x < 0},
}

bpy.context.view_layer.objects.active = armature
armature.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for helper_name in ("head_end", "headfront"):
    helper = armature.data.edit_bones.get(helper_name)
    if helper is not None:
        armature.data.edit_bones.remove(helper)
for side, sign in (("L", 1.0), ("R", -1.0)):
    bounds = side_bounds(hair_by_side[side])
    if bounds:
        minimum, maximum, center = bounds
        root_head = (sign * 0.115, center.y, max(1.47, min(1.58, center.z + 0.04)))
        root_tail = (sign * max(0.19, abs(center.x) * 0.72), center.y, center.z)
        tip_tail = (sign * max(abs(maximum.x if sign > 0 else minimum.x) * 0.98, 0.27), center.y, max(minimum.z + 0.035, 1.22))
        create_bone(f"Ponytail.{side}", "Head", root_head, root_tail)
        create_bone(f"Ponytail.{side}.Tip", f"Ponytail.{side}", root_tail, tip_tail)
    ear_bounds = side_bounds(ear_by_side[side])
    if ear_bounds:
        minimum, maximum, center = ear_bounds
        head = (sign * max(0.055, min(abs(center.x), 0.13)), center.y, max(1.48, minimum.z + 0.02))
        tail = (sign * max(abs(center.x), 0.10), center.y, maximum.z)
        create_bone(f"Ear.{side}", "Head", head, tail)
bpy.ops.object.mode_set(mode="OBJECT")


def smoothstep(value):
    t = max(0.0, min(1.0, value))
    return t * t * (3.0 - 2.0 * t)


def make_tree(indices):
    tree = KDTree(len(indices))
    for slot, index in enumerate(sorted(indices)):
        tree.insert(world_positions[index], slot)
    tree.balance()
    return tree


secondary_groups = {
    name: mesh_obj.vertex_groups.get(name) or mesh_obj.vertex_groups.new(name=name)
    for name in (
        "Ponytail.L",
        "Ponytail.L.Tip",
        "Ponytail.R",
        "Ponytail.R.Tip",
        "Ear.L",
        "Ear.R",
    )
}
secondary_fields = {}
for side, sign in (("L", 1.0), ("R", -1.0)):
    hair_indices = hair_by_side[side]
    ear_indices = ear_by_side[side]
    hair_bounds = side_bounds(hair_indices)
    ear_bounds = side_bounds(ear_indices)
    if hair_bounds is None or ear_bounds is None:
        raise RuntimeError(f"secondary seed region is empty on side {side}")
    hair_minimum, hair_maximum, hair_center = hair_bounds
    ear_minimum, ear_maximum, _ear_center = ear_bounds
    hair_root = Vector((sign * 0.115, hair_center.y, max(1.47, min(1.58, hair_center.z + 0.04))))
    hair_reach = max((world_positions[index] - hair_root).length for index in hair_indices)
    secondary_fields[side] = {
        "hairTree": make_tree(hair_indices),
        "earTree": make_tree(ear_indices),
        "hairRoot": hair_root,
        "hairReach": max(0.001, hair_reach),
        "earMinimum": ear_minimum,
        "earSpan": max(0.001, ear_maximum.z - ear_minimum.z),
    }


hair_vertices = set()
ear_vertices = set()
for index in sorted(head_domain):
    point = world_positions[index]
    side = "L" if point.x >= 0 else "R"
    field = secondary_fields[side]
    hair_distance = field["hairTree"].find(point)[2]
    ear_distance = field["earTree"].find(point)[2]
    hair_proximity = 1.0 - smoothstep((hair_distance - 0.002) / 0.052)
    ear_proximity = 1.0 - smoothstep((ear_distance - 0.001) / 0.036)
    # Proximity is smooth in geometric space, so vertices split by UV/tangent
    # export receive identical weights and the deformation surface stays closed.
    hair_attachment = smoothstep(((point - field["hairRoot"]).length - 0.012) / 0.13)
    hair_total = 0.88 * hair_proximity * hair_attachment
    ear_height = smoothstep(((point.z - field["earMinimum"].z) / field["earSpan"] - 0.02) / 0.72)
    ear_total = 0.80 * ear_proximity * ear_height
    combined = hair_total + ear_total
    if combined > 0.92:
        scale = 0.92 / combined
        hair_total *= scale
        ear_total *= scale
        combined = 0.92
    if combined <= 1e-4:
        continue
    tip_fraction = smoothstep(((point - field["hairRoot"]).length / field["hairReach"] - 0.42) / 0.46)
    weights = {
        f"Ponytail.{side}": hair_total * (1.0 - tip_fraction),
        f"Ponytail.{side}.Tip": hair_total * tip_fraction,
        f"Ear.{side}": ear_total,
    }
    for membership in list(mesh.vertices[index].groups):
        mesh_obj.vertex_groups[membership.group].remove([index])
    head_group.add([index], 1.0 - combined, "REPLACE")
    for name, weight in weights.items():
        if weight > 1e-6:
            secondary_groups[name].add([index], weight, "REPLACE")
    if hair_total > 1e-4:
        hair_vertices.add(index)
    if ear_total > 1e-4:
        ear_vertices.add(index)

# Remove only unambiguous orange tail-brush faces. Boundary faces stay to avoid opening the body.
tail_faces = [polygon.index for polygon in mesh.polygons if len(polygon.vertices) >= 3 and all(index in tail_vertices for index in polygon.vertices)]
if len(tail_faces) > 5000:
    raise RuntimeError(f"tail classifier over-reached ({len(tail_faces)} faces)")
if tail_faces:
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[index] for index in tail_faces], context="FACES")
    orphaned = [vertex for vertex in bm.verts if not vertex.link_faces]
    if orphaned:
        bmesh.ops.delete(bm, geom=orphaned, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

# Standard WebGL/glTF path: retain the strongest four influences and renormalize.
before_counts = Counter()
dropped_mass = 0.0
max_dropped_mass = 0.0
for vertex in mesh.vertices:
    weighted = []
    for membership in vertex.groups:
        if membership.weight > 1e-8:
            weighted.append((membership.weight, mesh_obj.vertex_groups[membership.group].name))
    before_counts[len(weighted)] += 1
    weighted.sort(reverse=True)
    kept = weighted[:4]
    discarded = weighted[4:]
    discarded_sum = sum(weight for weight, _name in discarded)
    dropped_mass += discarded_sum
    max_dropped_mass = max(max_dropped_mass, discarded_sum)
    for _weight, name in discarded:
        mesh_obj.vertex_groups[name].remove([vertex.index])
    total = sum(weight for weight, _name in kept)
    if total <= 1e-12:
        raise RuntimeError(f"vertex {vertex.index} has zero skin weight")
    for weight, name in kept:
        mesh_obj.vertex_groups[name].add([vertex.index], weight / total, "REPLACE")

armature["punkyRigVersion"] = "web-v1"
armature["secondaryBones"] = ["Ponytail.L", "Ponytail.L.Tip", "Ponytail.R", "Ponytail.R.Tip", "Ear.L", "Ear.R"]
armature["tailPolicy"] = "source-tail-faces-removed; runtime procedural tail"

# Rebuild one glTF-compatible PBR material around the prepared texture tier.
material = mesh_obj.material_slots[0].material if mesh_obj.material_slots else None
if material is None:
    material = bpy.data.materials.new("PunkyFox_Web")
    mesh_obj.data.materials.append(material)
material.name = "PunkyFox_Web"
material.use_nodes = True
nodes = material.node_tree.nodes
links = material.node_tree.links
nodes.clear()
output_node = nodes.new("ShaderNodeOutputMaterial")
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
links.new(bsdf.outputs["BSDF"], output_node.inputs["Surface"])
bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
bsdf.inputs["Metallic"].default_value = 0.0
bsdf.inputs["Roughness"].default_value = 0.65


def texture_node(path, colorspace):
    node = nodes.new("ShaderNodeTexImage")
    node.image = bpy.data.images.load(str(path), check_existing=True)
    node.image.colorspace_settings.name = colorspace
    return node


base = texture_node(base_color_path, "sRGB")
normal_tex = texture_node(normal_path, "Non-Color")
metal = texture_node(metallic_path, "Non-Color")
rough = texture_node(roughness_path, "Non-Color")
normal = nodes.new("ShaderNodeNormalMap")
normal.inputs["Strength"].default_value = 0.8
links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
links.new(metal.outputs["Color"], bsdf.inputs["Metallic"])
links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
links.new(normal_tex.outputs["Color"], normal.inputs["Color"])
links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])

for obj in bpy.context.selected_objects:
    obj.select_set(False)
armature.select_set(True)
mesh_obj.select_set(True)
bpy.context.view_layer.objects.active = armature

export_options = {
    "filepath": str(output),
    "export_format": "GLB",
    "use_selection": True,
    "export_yup": True,
    "export_skins": True,
    "export_all_influences": False,
    "export_animations": False,
    "export_materials": "EXPORT",
    "export_image_format": "AUTO",
    "export_texcoords": True,
    "export_normals": True,
    "export_tangents": True,
    "export_extras": True,
    "export_apply": False,
}
bpy.ops.export_scene.gltf(**export_options)

triangle_count = sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)
report = {
    "schemaVersion": 1,
    "source": {"path": str(source), "sha256": sha256(source)},
    "output": {"path": str(output), "bytes": output.stat().st_size, "sha256": sha256(output)},
    "mesh": {"vertices": len(mesh.vertices), "triangles": triangle_count, "triangleCeiling": 100000},
    "rig": {
        "bones": len(armature.data.bones),
        "secondaryBones": list(armature["secondaryBones"]),
        "influenceCountsBefore": dict(sorted(before_counts.items())),
        "maxInfluencesAfter": 4,
        "totalDroppedWeight": dropped_mass,
        "maxDroppedWeightPerVertex": max_dropped_mass,
    },
    "semanticSelection": {
        "hairVertices": len(hair_vertices),
        "hairSeedVertices": len(hair_seeds),
        "earVertices": len(ear_vertices),
        "earSeedVertices": len(ear_seeds),
        "tailCandidateVertices": len(tail_vertices),
        "tailFacesRemoved": len(tail_faces),
    },
    "textures": {
        path.name: {"bytes": path.stat().st_size, "sha256": sha256(path)}
        for path in (base_color_path, normal_path, metallic_path, roughness_path)
    },
    "animationCount": 0,
    "notes": [
        "The canonical source is an external owner-supplied Meshy asset, not code-only geometry.",
        "The game remains authoritative for root motion and the procedural tail.",
        "Secondary hair/ear bone motion is authored additively at runtime and must pass deformation review.",
    ],
}
if triangle_count >= 100000:
    raise RuntimeError(f"triangle budget failed: {triangle_count}")
if len(armature.data.bones) < 28:
    raise RuntimeError("secondary rig bones were not created")
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": "success", **report}, indent=2))
