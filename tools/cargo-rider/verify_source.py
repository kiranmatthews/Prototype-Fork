"""Reopen the saved production rig and verify bind geometry, controls, curves and occlusion."""

import json
from pathlib import Path
import sys
import numpy as np
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE / "studio"), str(HERE)]
from animation_export import sample
from actions import name_for
from reference_pose import turn

scene = bpy.context.scene
rig = next(o for o in scene.objects if o.get("rigSource"))
assert rig.animation_data.action is None and scene.frame_current == 1
assert scene.camera.name == "Character portrait"
assert all(abs(rig[k]) < 1e-7 for k in rig.keys() if isinstance(rig[k], float))
rests = json.loads((HERE / "calibration.json").read_text())
# Bone Man also measures the optional independent tail socket in the player.
del rests["tail-root"]
assert len(rig.data.bones) == len(rests) == 72
for name, defn in rests.items():
    b = rig.data.bones[name]
    assert (b.parent.name if b.parent else None) == defn["parent"], name
    assert np.max(np.abs(np.array(b["boneManRest"]) - defn["matrix"])) < 1e-6, name
meshes = [o for o in scene.objects if o.type == "MESH" and o.get("cargoSection")]
triangles = sum(len(f.vertices) - 2 for o in meshes for f in o.data.polygons)
assert 0 < triangles <= 150000
for o in meshes:
    assert o.parent == rig and any(m.type == "ARMATURE" and m.object == rig for m in o.modifiers)
    for v in o.data.vertices:
        assert 1 <= len(v.groups) <= 4 and abs(sum(g.weight for g in v.groups) - 1) < 1e-5, o.name
        assert all(o.vertex_groups[g.group].name in rig.data.bones for g in v.groups)
imgs = [i for i in bpy.data.images if i.packed_file]
assert all(
    i.packed_file
    for m in meshes
    for s in m.material_slots
    for n in s.material.node_tree.nodes
    if n.type == "TEX_IMAGE"
    for i in [n.image]
)
assert all(
    any(
        i.name.startswith(key + " | " + kind) and min(i.size) >= (2048 if kind == "color" else 1536)
        for i in imgs
    )
    for key in ["Body", "Bust", "Neutral"]
    for kind in ["color", "normal", "rough"]
)
assert len([o for o in scene.objects if o.name.startswith("Control | ")]) == 12
body = next(o for o in meshes if o.name.startswith("Knit,"))
face = next(o for o in meshes if o.name.startswith("Face | neutral"))
assert face.data.uv_layers and face.data.color_attributes.get("Cheek undertone")
assert "MaskFit.puffer" in face.data.shape_keys.key_blocks
assert len([a for a in bpy.data.actions if a.name.startswith("Bone Man |")]) == 5
sheet = json.loads((HERE.parents[1] / "src/character/cargoRiderTakes.json").read_text())
assert len([a for a in bpy.data.actions if a.get("cargoTake")]) == len(sheet["takes"]) == 17


def update():
    rig.update_tag()
    bpy.context.view_layer.update()


def neutral():
    rig.animation_data.action = None
    for k in rig.keys():
        if isinstance(rig[k], float):
            rig[k] = 0.0
    for b in rig.pose.bones:
        b.matrix_basis = Matrix.Identity(4)
    update()


frames_checked = 0
for key, take in sheet["takes"].items():
    act = bpy.data.actions[name_for(key)]
    assert (
        act.get("cargoTake") == key and act.asset_data and int(act.frame_end) == take["frames"] + 1
    )
    assert [(m.frame - 1, m.name) for m in act.pose_markers] == [tuple(x) for x in take["markers"]]
    bag = act.layers[0].strips[0].channelbags[0]
    curves = {fc.data_path: fc for fc in bag.fcurves if fc.data_path.startswith('["')}
    frames = np.arange(take["frames"] + 1)
    frames_checked += len(frames)
    for name, pts in take["tracks"].items():
        fc = curves['["' + name + '"]']
        expected = sample(pts, frames)
        observed = np.array([fc.evaluate(float(frame + 1)) for frame in frames])
        assert np.max(abs(expected - observed)) < 0.00003, (key, name)
        assert max(abs(observed[0]), abs(observed[-1])) < 1e-6, (key, name)
    rig.animation_data.action = act
    rig.animation_data.action_slot = act.slots[0]
    scene.frame_set(take["apex"] + 1)
    for name, pts in take["tracks"].items():
        expected = float(sample(pts, np.array([take["apex"]]))[0])
        assert abs(rig[name] - expected) < 0.0001, (key, name)
    scene.frame_set(take["frames"] + 1)
    assert all(abs(rig[k]) < 1e-5 for k in take["tracks"])
    neutral()
# Verify the physical picker against the driven geometry, including the rolling full-blink corrective.
knob = bpy.data.objects["Control | Lid L"]
knob.location.z = -0.018
bpy.context.view_layer.update()
lid = bpy.data.objects["Upper moving eyelid .L"]


def weight(obj, key):
    return (
        obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        .data.shape_keys.key_blocks[key]
        .value
    )


assert abs(weight(lid, "Blink.L") - 0.5) < 1e-4
assert abs(weight(lid, "LidArc.L") - 1) < 1e-4
knob.location.z = 0
bpy.context.view_layer.update()
# Sample the pixels' sight lines in object space. Start from actual exposed eyeball surface at rest.
eyes = {o.name for o in meshes if o.name.startswith("Eye • ")}


def hits(samples):
    dg = bpy.context.evaluated_depsgraph_get()
    seen = []
    for x, z in samples:
        hit, pt, normal, idx, obj, matrix = scene.ray_cast(
            dg, Vector((x, -0.8, z)), Vector((0, 1, 0)), distance=1.25
        )
        if hit and obj.name in eyes:
            seen.append((x, z))
    return seen


samples = [(x, z) for x in np.linspace(-0.162, 0.162, 127) for z in np.linspace(1.646, 1.780, 62)]
open_eyes = hits(samples)
assert len(open_eyes) > 450, len(open_eyes)
rig["Blink.L"] = rig["Blink.R"] = 0.5
update()
half = len(hits(open_eyes))
rig["Blink.L"] = rig["Blink.R"] = 1.0
update()
closed = hits(open_eyes)
assert 0.14 < half / len(open_eyes) < 0.86, (half, len(open_eyes))
assert len(closed) < len(open_eyes) * 0.006, (len(closed), len(open_eyes), closed[:10])
neutral()


def from_rear(x, z):
    result = scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), Vector((x, 1, z)), Vector((0, -1, 0)), distance=1.55
    )
    return result[4].name if result[0] else ""


rear = [
    from_rear(x, z) for x in np.linspace(-0.061, 0.061, 11) for z in np.linspace(1.655, 1.855, 19)
]
assert all(name == "Combed back cap" for name in rear), {
    name: rear.count(name) for name in set(rear)
}
assert all(
    from_rear(x, z) == "Tank | fitted bound back"
    for x in (-0.075, -0.035, 0, 0.035, 0.075)
    for z in (1.325, 1.37, 1.42)
)
oral = bpy.data.objects["Continuous oral vestibule and palate"]
rings = (len(oral.data.vertices) - 1) // 5


def mouth_gap():
    coords = np.array(
        [
            p.co[:]
            for p in oral.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices[:rings]
        ]
    )
    center = coords[abs(coords[:, 0]) < 0.019]
    return float(np.ptp(center[:, 2]))


seal = mouth_gap()
rig["JawOpen"] = 0.8
update()
opened = mouth_gap()
assert seal < 0.009 and opened - seal > 0.044, (seal, opened)
neutral()
for pitch in [0, 65, 120, -70]:
    turn(rig.pose.bones["chest"], Vector((1, 0, 0)), pitch)
    update()
    chest = rig.pose.bones["chest"]
    chest_space = (chest.matrix @ chest.bone.matrix_local.inverted()).inverted().to_3x3()
    for side, suffix in [("left", "L"), ("right", "R")]:
        v = (
            chest_space
            @ (rig.pose.bones["elbow-" + side].head - rig.pose.bones["shoulder-" + side].head)
        ).normalized()
        expected = max(0, min(1, (0.64 - abs(v.x)) / 0.35)) * max(0, min(1, (-v.z - 0.6) / 0.27))
        assert abs(weight(body, "ShoulderRelax." + suffix) - expected) < 0.003
for key in bpy.data.shape_keys:
    if key.animation_data:
        assert all(fc.driver.is_valid for fc in key.animation_data.drivers), key.name
print(
    json.dumps(
        dict(
            bones=len(rests),
            triangles=triangles,
            meshes=len(meshes),
            materials=len({s.material for o in meshes for s in o.material_slots}),
            sources=len(imgs),
            handles=12,
            actions=len(bpy.data.actions),
            frames=frames_checked,
            neutralEyeRays=len(open_eyes),
            halfBlinkRays=half,
            closedEyeRays=len(closed),
            crownRays=len(rear),
            restLipGap=seal,
            openLipGap=opened,
        )
    )
)
