"""Front-view animation controls, in local X/Z, beside the character in Blender."""

import math
import bpy

TRAVEL = 0.036
# A path can receive a positive and a negative local-axis mapping independently.
PADS = [
    ("Gaze", 0, 0, ("LookRight", "LookLeft"), ("LookDown", "LookUp")),
    ("Jaw", 1, 0, ("JawSide.R", "JawSide.L"), ("JawOpen", "JawForward")),
    ("Lid R", 0, 1, (None, "Squint.R"), ("Blink.R", "EyeWide.R")),
    ("Lid L", 1, 1, ("Squint.L", None), ("Blink.L", "EyeWide.L")),
    ("Brow R", 0, 2, (None, "BrowAngle.R"), ("BrowDown.R", "BrowUp.R")),
    ("Brow L", 1, 2, ("BrowAngle.L", None), ("BrowDown.L", "BrowUp.L")),
    ("Corner R", 0, 3, ("CheekPuff.R", "LipRaise.R"), ("Frown.R", "Smile.R")),
    ("Corner L", 1, 3, ("LipRaise.L", "CheekPuff.L"), ("Frown.L", "Smile.L")),
    ("Lips", 0, 4, ("Funnel", "Pucker"), ("LowerLipDrop", "LipPress")),
    ("Tongue", 1, 4, (None, None), ("TongueOut", "TongueCurl")),
    ("Pupils", 0, 5, ("CrossEyes", "WallEyes"), (None, "IrisPin")),
    ("Cheeks", 1, 5, ("CheekLift.R", "CheekLift.L"), (None, "Smile")),
]


def build(rig, objects):
    collection = bpy.data.collections.new("Facial controls | move handles in front view")
    bpy.context.scene.collection.children.link(collection)
    collection.hide_render = True

    def link(name, data, parent=None):
        obj = bpy.data.objects.new(name, data)
        collection.objects.link(obj)
        if parent:
            obj.parent = parent
        return obj

    def wire(name, points, parent, closed=True, bevel=0.0008):
        data = bpy.data.curves.new(name, "CURVE")
        data.dimensions = "3D"
        data.bevel_depth = bevel
        data.bevel_resolution = 1
        spline = data.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for point, (x, z) in zip(spline.points, points):
            point.co = (x, 0, z, 1)
        spline.use_cyclic_u = closed
        return link(name, data, parent)

    holder = link("Face controls | board", None)
    holder.empty_display_size = 0.006
    holder.location = (0.70, -0.05, 2.02)
    bindings = {}
    for title, col, row, horizontal, vertical in PADS:
        pad = link("Pad | " + title, None, holder)
        pad.empty_display_size = 0.001
        pad.location = (col * 0.118, 0, -row * 0.116)
        box = wire(
            "Travel | " + title,
            [(-TRAVEL, -TRAVEL), (TRAVEL, -TRAVEL), (TRAVEL, TRAVEL), (-TRAVEL, TRAVEL)],
            pad,
        )
        box.hide_select = True
        box.color = (0.30, 0.41, 0.48, 1)
        label = bpy.data.curves.new(title, "FONT")
        label.body = title
        label.size = 0.016
        label.align_x = "CENTER"
        text = link("Label | " + title, label, pad)
        text.location = (0, 0, -0.055)
        text.rotation_euler.x = math.pi / 2
        text.hide_select = True
        handle = wire(
            "Control | " + title,
            [
                (0.008 * math.cos(i * math.pi / 8), 0.008 * math.sin(i * math.pi / 8))
                for i in range(16)
            ],
            pad,
            bevel=0.0024,
        )
        handle.show_in_front = True
        handle.color = (0.72, 0.32, 0.91, 1)
        handle.lock_location = (False, True, False)
        handle.lock_rotation = (True, True, True)
        handle.lock_scale = (True, True, True)
        limits = handle.constraints.new("LIMIT_LOCATION")
        limits.owner_space = "LOCAL"
        limits.use_transform_limit = True
        for axis in ("x", "y", "z"):
            setattr(limits, "use_min_" + axis, True)
            setattr(limits, "use_max_" + axis, True)
            setattr(limits, "min_" + axis, -TRAVEL if axis != "y" else 0)
            setattr(limits, "max_" + axis, TRAVEL if axis != "y" else 0)
        for axis, pair in [("X", horizontal), ("Z", vertical)]:
            for sign, channel in zip((-1, 1), pair):
                if channel:
                    bindings[channel] = (handle, axis, sign)
    for obj in objects:
        keys = obj.data.shape_keys
        if not keys or not keys.animation_data:
            continue
        for fc in keys.animation_data.drivers:
            channel = fc.data_path.split('"')[1]
            if channel.startswith("LidAngle."):
                handle, axis, sign = bindings["Blink" + channel[-2:]]
                drv = fc.driver
                v = drv.variables.new()
                v.type = "TRANSFORMS"
                v.name = "lidHandle"
                target = v.targets[0]
                target.id = handle
                target.transform_space = "LOCAL_SPACE"
                target.transform_type = "LOC_" + axis
                drv.expression = f"tilt*(1-min(1,max(0,closure{sign/TRAVEL:+.8f}*lidHandle)))"
                continue
            arc = channel.startswith("LidArc.")
            raw = "Blink" + channel[-2:] if arc else channel
            if raw not in bindings:
                continue
            handle, axis, sign = bindings[raw]
            driver = fc.driver
            driver.type = "SCRIPTED"
            driver.variables[0].name = "weight"
            var = driver.variables.new()
            var.name = "knob"
            var.type = "TRANSFORMS"
            target = var.targets[0]
            target.id = handle
            target.transform_space = "LOCAL_SPACE"
            target.transform_type = "LOC_" + axis
            amount = f"min(1,max(0,weight{sign/TRAVEL:+.8f}*knob))"
            driver.expression = f"4*{amount}*(1-{amount})" if arc else amount
    return holder
