"""Reopen the source with Blender and verify its editable assets and pose-space drivers."""

import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reference_pose import reference_pose, turn

scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
meshes = [o for o in scene.objects if o.type == 'MESH' and o.get('cargoSection')]
body = next(o for o in meshes if o.vertex_groups.get('Island • Fitted tank, neck and midriff'))
assert len(rig.data.bones) == 72
assert rig.animation_data.action.name == 'Portrait | Three-quarter reference'
assert scene.camera.name == 'Reference | Three-Quarter'
assert all(len(f.vertices) == 4 for o in meshes for f in o.data.polygons)
images = [i for i in bpy.data.images if i.packed_file]
assert len(images) == 3 and all(tuple(i.size) == (4096, 2048) for i in images)
poses = [m.name for m in bpy.data.actions['Face | Twelve performance poses'].pose_markers]
assert len(poses) == 12 and all('Pose | ' + name in bpy.data.actions for name in poses)
assert len([g for o in meshes for g in o.vertex_groups if g.name.startswith('Island • Oval shell ')]) == 12
assert {g.name for g in body.vertex_groups if 'bound knit' in g.name} == {
    'Island • ' + n + ' | bound knit' for n in ('Scoop neckline', 'Left armhole', 'Right armhole')
}
rig.animation_data.action = None
for relaxed, pitch in [(True, 0), (True, 70), (True, 130), (False, 0), (False, -76)]:
    reference_pose(rig, False)
    if not relaxed:
        for bone in rig.pose.bones:
            bone.matrix_basis = Matrix.Identity(4)
    for side in ('L', 'R'):
        rig['ShoulderRelax.' + side] = 0.0
    turn(rig.pose.bones['chest'], Vector((1, 0, 0)), pitch)
    rig.update_tag()
    bpy.context.view_layer.update()
    chest = rig.pose.bones['chest']
    coords = (chest.matrix @ chest.bone.matrix_local.inverted()).inverted().to_3x3()
    for side, suffix in [('left', 'L'), ('right', 'R')]:
        elbow = rig.pose.bones['elbow-' + side].head
        shoulder = rig.pose.bones['shoulder-' + side].head
        v = (coords @ (elbow - shoulder)).normalized()
        expected = max(0, min(1, (0.64 - abs(v.x)) / 0.35)) * max(0, min(1, (-v.z - 0.6) / 0.27))
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        actual = evaluated.data.shape_keys.key_blocks['ShoulderRelax.' + suffix].value
        assert abs(actual - expected) < 0.003, (relaxed, pitch, side, actual, expected)
for keys in bpy.data.shape_keys:
    if keys.animation_data:
        assert all(f.driver.is_valid for f in keys.animation_data.drivers), keys.name
print(
    json.dumps(
        {
            'bones': len(rig.data.bones),
            'meshes': len(meshes),
            'quads': sum(len(o.data.polygons) for o in meshes),
            'materials': len({slot.material.name for o in meshes for slot in o.material_slots}),
            'packed': [i.name for i in images],
            'actions': len(bpy.data.actions),
            'expressions': poses,
            'cameras': [o.name for o in scene.objects if o.type == 'CAMERA'],
        }
    )
)
