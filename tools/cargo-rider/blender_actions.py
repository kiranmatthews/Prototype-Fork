"""Editable examples sampled from the running player. The GLB remains a reusable rest rig."""

import json
from pathlib import Path
from mathutils import Matrix


def install_actions(bpy, rig, rest, work):
    animation = rig.animation_data_create()
    change_basis = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    inverse_basis = change_basis.inverted()

    def matrix(values):
        return Matrix([values[i : i + 4] for i in range(0, 16, 4)]).transposed()

    rest_inverse = {name: matrix(data['matrix']).inverted() for name, data in rest.items()}
    sample_file = work / 'player-actions.json'
    actions = json.loads(sample_file.read_text()) if sample_file.is_file() else []
    for sample in actions:
        label = sample['id'].split('.')[-1].replace('basic-', '').title()
        action = bpy.data.actions.new('Bone Man | ' + label)
        action.use_fake_user = True
        action.asset_mark()
        animation.action = action
        previous = {}
        bones = [rig.pose.bones[n] for n in sample['bones']]
        for frame, matrices in enumerate(sample['frames'], 1):
            transforms = {
                bone.name: change_basis
                @ matrix(values)
                @ rest_inverse[bone.name]
                @ inverse_basis
                @ bone.bone.matrix_local
                for bone, values in zip(bones, matrices)
            }
            for bone in bones:
                name = bone.name
                parent = bone.parent
                basis = bone.bone.matrix_local.inverted()
                if parent:
                    basis = basis @ parent.bone.matrix_local @ transforms[parent.name].inverted_safe()
                basis = basis @ transforms[name]
                loc, quat, scale = basis.decompose()
                if name in previous:
                    quat.make_compatible(previous[name])
                previous[name] = quat.copy()
                bone.rotation_mode = 'QUATERNION'
                bone.location, bone.rotation_quaternion, bone.scale = loc, quat, scale
                for prop in ['location', 'rotation_quaternion', 'scale']:
                    bone.keyframe_insert(data_path=prop, frame=frame, group=name)
        animation.action = None
        for bone in bones:
            bone.matrix_basis = Matrix.Identity(4)
    take = bpy.data.actions.new('Face | Glance, wink and grin')
    take.use_fake_user = True
    take.asset_mark()
    animation.action = take
    tracks = {
        'LookLeft': [(1, 0), (10, 0), (18, 0.78), (35, 0.65), (48, 0), (83, 0)],
        'BrowUp.R': [(1, 0), (12, 0), (24, 0.80), (38, 0.75), (54, 0.15), (75, 0)],
        'Smile.R': [(1, 0), (15, 0.1), (27, 0.68), (39, 0.64), (58, 0)],
        'Blink.L': [(1, 0), (22, 0), (25, 1), (31, 1), (36, 0), (57, 0), (60, 1), (64, 0)],
        'Blink.R': [(1, 0), (56, 0), (60, 1), (64, 0)],
        'Smile': [(1, 0), (31, 0), (43, 0.65), (52, 0.86), (68, 0.35), (83, 0)],
        'JawOpen': [(1, 0), (30, 0), (42, 0.56), (48, 0.72), (61, 0.37), (75, 0)],
        'Pucker': [(1, 0), (66, 0), (71, 0.16), (77, 0)],
    }
    for name, keys in tracks.items():
        for frame, value in keys:
            rig[name] = value
            rig.keyframe_insert(data_path='["' + name + '"]', frame=frame, group='Face')
    animation.action = None
    for name in tracks:
        rig[name] = 0.0
    presets = json.loads(
        (Path(__file__).resolve().parents[2] / 'src/character/cargoRiderExpressions.json').read_text()
    )
    channels = [name for name in rig.keys() if isinstance(rig[name], float)]

    # One keyed asset per sign-off drawing, and one stepped-through reel. Explicit
    # zeros let animators blend from any other pose without retaining old shapes.
    def face_keys(frame, pose_name):
        for channel in channels:
            weight = presets.get(pose_name, {}).get(
                channel, float(channel in ('IrisFit.' + pose_name, 'MaskFit.' + pose_name))
            )
            rig[channel] = weight
            rig.keyframe_insert(
                data_path='["' + channel + '"]',
                frame=frame,
                group='Eyes • fit' if channel.startswith('IrisFit.') else 'Face',
            )

    for name in presets:
        pose = bpy.data.actions.new('Pose | ' + name.capitalize())
        pose.asset_mark()
        pose.use_fake_user = True
        animation.action = pose
        face_keys(1, name)
    reel = bpy.data.actions.new('Face | Twelve performance poses')
    reel.asset_mark()
    reel.use_fake_user = True
    animation.action = reel
    face_keys(1, '')
    for i, name in enumerate(presets):
        start = 9 + i * 16
        face_keys(start, name)
        face_keys(start + 7, name)
        reel.pose_markers.new(name.capitalize()).frame = start
    face_keys(201, '')
    animation.action = None
    for channel in channels:
        rig[channel] = 0.0
    from reference_pose import reference_pose

    ref = bpy.data.actions.new('Portrait | Three-quarter reference')
    ref.asset_mark()
    ref.use_fake_user = True
    animation.action = ref
    reference_pose(rig, True)
    for name in channels:
        rig.keyframe_insert(data_path='["' + name + '"]', frame=1, group='Portrait')
    for bone in rig.pose.bones:
        if bone.name in ('head', 'neck', 'chest') or bone.name.startswith(('shoulder-', 'clavicle-')):
            bone.keyframe_insert(data_path='rotation_quaternion', frame=1, group=bone.name)
            bone.keyframe_insert(data_path='location', frame=1, group=bone.name)
    animation.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    for name in channels:
        rig[name] = 0.0
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 201
    bpy.context.scene.frame_set(1)
