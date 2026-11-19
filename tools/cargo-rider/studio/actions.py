"""Editable facial actions authored in frames on the new neutral head."""

import bpy
import numpy as np
from mathutils import Matrix, Vector

PREFIX = "Face | "
TITLES = {"kling1910": "Kling 1910", "idle": "Attentive idle"}


def name_for(key):
    return PREFIX + TITLES.get(key, key.capitalize())


def group_for(channel):
    if channel.startswith(("Look", "Cross", "Wall", "Iris")):
        return "Gaze"
    if channel.startswith(("Blink", "Eye", "Squint")):
        return "Eyelids"
    if channel.startswith("Brow"):
        return "Brows"
    if channel.startswith(("Ear", "Pony", "Hair")):
        return "Ears and hair"
    if channel.startswith(("Jaw", "Teeth", "Tongue")):
        return "Jaw and tongue"
    return "Lips and cheeks"


def make_action(rig, name, last):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    act.asset_mark()
    slot = act.slots.new("OBJECT", rig.name)
    layer = act.layers.new("Performance")
    strip = layer.strips.new(type="KEYFRAME")
    bag = strip.channelbags.new(slot)
    act.use_frame_range = True
    act.frame_start = 1
    act.frame_end = max(2, last + 1)
    return act, bag


def add_curve(bag, channel, points):
    curve = bag.fcurves.new(data_path='["' + channel + '"]', index=0, group_name=group_for(channel))
    keys = curve.keyframe_points
    keys.add(len(points))
    for i, (frame, value) in enumerate(points):
        # Horizontal endpoint handles, one third of the neighboring interval,
        # yield the same cubic Hermite interpolation as the in-game sampler.
        x = frame + 1
        previous = points[max(0, i - 1)][0]
        following = points[min(len(points) - 1, i + 1)][0]
        k = keys[i]
        k.co = (x, value)
        k.interpolation = "BEZIER"
        k.handle_left_type = k.handle_right_type = "FREE"
        k.handle_left = (x - (frame - previous) / 3, value)
        k.handle_right = (x + (following - frame) / 3, value)
    curve.update()


def register_portrait_views(portrait):
    """Match the independent eyelines of the supplied front and profile drawings."""

    def set_still(action, values):
        bag = action.layers[0].strips[0].channelbags[0]
        for channel, value in values.items():
            fc = next(f for f in bag.fcurves if f.data_path == '["' + channel + '"]')
            for point in fc.keyframe_points:
                point.co.y = value
                point.handle_left.y = value
                point.handle_right.y = value
            fc.update()

    set_still(
        portrait, {"LidAngle.L": 0.43, "LidAngle.R": 0.29, "Squint.L": 0.14, "Squint.R": 0.065}
    )
    profile = portrait.copy()
    profile.name = "Portrait | Profile glance"
    profile.use_fake_user = True
    set_still(
        profile,
        {"LookRight": 0.0, "LookLeft": 0.77, "LookDown": 0.0, "LidAngle.L": 0.23, "Squint.L": 0.10},
    )


def write_actions(rig, sheet):
    active = set().union(*(take["tracks"] for take in sheet["takes"].values()))
    unknown = active - set(rig.keys())
    if unknown:
        raise ValueError("Unbound facial animation controls: " + ", ".join(sorted(unknown)))
    # Author the inactive channels at neutral too. Switching actions in the
    # Action Editor must clear the last take's tongue, gaze and unilateral shapes.
    channels = sorted(
        k
        for k in rig.keys()
        if isinstance(rig[k], float) and not k.startswith(("ShoulderRelax.", "LidArc.", "Pose."))
    )
    for name, take in sheet["takes"].items():
        act, bag = make_action(rig, name_for(name), take["frames"])
        act["cargoTake"] = name
        act["neutralAtEnds"] = True
        for channel in channels:
            add_curve(bag, channel, take["tracks"].get(channel, [(0, 0.0)]))
        if "head" in take:
            from animation_export import head_quaternions

            bone = rig.pose.bones["head"]
            basis = bone.bone.matrix_local.to_quaternion()
            frames = np.arange(take["frames"] + 1)
            qs = [
                basis.inverted() @ q @ basis for q in head_quaternions(take["head"], frames, True)
            ]
            for axis in range(4):
                fc = bag.fcurves.new(
                    data_path='pose.bones["head"].rotation_quaternion',
                    index=axis,
                    group_name="Head acting",
                )
                fc.keyframe_points.add(len(frames))
                for f, point in enumerate(fc.keyframe_points):
                    point.co = (f + 1, qs[f][axis])
                    point.interpolation = "LINEAR"
                fc.update()
        for frame, label in take["markers"]:
            act.pose_markers.new(label).frame = frame + 1
    from reference_pose import turn

    portrait = {
        "BrowAngle.L": 0.87,
        "BrowAngle.R": 0.72,
        "BrowUp.R": 0.22,
        "Smile.R": 0.55,
        "Smile.L": 0.14,
        "CheekLift.R": 0.21,
        "LookRight": 0.39,
        "LookDown": 0.055,
        "JawOpen": 0.015,
        "LipPress": 0.065,
        "EarFold.L": 0.12,
        "EarFold.R": 0.20,
        "EarStretch.R": 0.12,
    }
    act, bag = make_action(rig, "Portrait | Reference smile", 1)
    for channel in channels:
        add_curve(bag, channel, [(0, portrait.get(channel, 0.0))])
    rig.animation_data.action = act
    rig.animation_data.action_slot = act.slots[0]
    for side, sign in [("left", 1), ("right", -1)]:
        collar = rig.pose.bones["clavicle-" + side]
        shoulder = rig.pose.bones["shoulder-" + side]
        turn(collar, Vector((0, 1, 0)), sign * 14)
        turn(shoulder, Vector((0, 1, 0)), sign * 16)
        collar.location = collar.bone.matrix_local.to_quaternion().inverted() @ Vector(
            (-sign * 0.031, 0.023, 0.006)
        )
    turn(rig.pose.bones["chest"], Vector((0, 0, 1)), 12)
    turn(rig.pose.bones["neck"], Vector((0, 0, 1)), -13)
    turn(rig.pose.bones["head"], Vector((0, 1, 0)), 2.4)
    for bone in rig.pose.bones:
        if bone.name in ("head", "neck", "chest") or bone.name.startswith(
            ("clavicle-", "shoulder-")
        ):
            for path in ("rotation_quaternion", "location"):
                bone.keyframe_insert(data_path=path, frame=1, group=bone.name)
    register_portrait_views(act)
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    for channel in rig.keys():
        if isinstance(rig[channel], float):
            rig[channel] = 0.0
    scene = bpy.context.scene
    scene.render.fps = sheet["fps"]
    scene.frame_start = 1
    scene.frame_end = sheet["takes"]["kling1910"]["frames"] + 1
    scene.frame_set(1)
    rig.update_tag()
