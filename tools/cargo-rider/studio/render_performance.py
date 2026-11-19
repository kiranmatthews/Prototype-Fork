"""Render the saved neutral rig, its native facial takes and a time-accurate Kling study."""

import bpy
import json, math, sys
from mathutils import Matrix, Vector
from pathlib import Path

args = sys.argv[sys.argv.index("--") + 1 :]
out = Path(args[0])
out.mkdir(parents=True, exist_ok=True)
kind = args[1] if len(args) > 1 else "stills"
here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
from actions import name_for

sheet = json.loads((here.parents[2] / "src/character/cargoRiderTakes.json").read_text())
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.get("rigSource"))
camera = bpy.data.objects["Character portrait"]
scene.camera = camera
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_percentage = 100
scene.cycles.use_denoising = True
scene.render.film_transparent = False


def frame_view(angle, height=1.763, scale=0.994, depth=0.022):
    target = Vector((0, -depth, height))
    a = math.radians(angle)
    camera.location = target + Vector((4 * math.sin(a), -4 * math.cos(a), 0.055))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = scale
    scene.camera = camera


def clear():
    rig.animation_data.action = None
    for b in rig.pose.bones:
        b.matrix_basis = Matrix.Identity(4)
    for k in rig.keys():
        if isinstance(rig[k], float):
            rig[k] = 0.0
    rig.update_tag()
    bpy.context.view_layer.update()


def pose(name, frame):
    clear()
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    scene.frame_set(frame + 1)


def render(name):
    scene.render.filepath = str(out / (name + ".png"))
    bpy.ops.render.render(write_still=True)


if kind == "stills":
    scene.cycles.samples = 15
    scene.render.resolution_x = scene.render.resolution_y = 860
    clear()
    for angle, name in [(0, "neutral"), (-27, "three-quarter"), (90, "profile"), (180, "back")]:
        frame_view(angle)
        render(name)
    frame_view(12, 1.13, 2.28, 0)
    render("body")
    pose("Portrait | Reference smile", 0)
    frame_view(-26, 1.748, 0.914, 0.012)
    render("portrait")
    scene.render.film_transparent = True
    render("hud")
    scene.render.film_transparent = False
    for name, take in sheet["takes"].items():
        pose(name_for(name), take["apex"])
        frame_view(-10, 1.716, 0.81)
        render(name)
    for fr in [10, 13, 17, 20, 148, 239, 287]:
        pose(name_for("kling1910"), fr)
        frame_view(0, 1.704, 0.675, 0.056)
        render("kling-" + str(fr))
elif kind == "turnaround":
    scene.cycles.samples = 22
    scene.render.resolution_x = scene.render.resolution_y = 920
    scene.render.film_transparent = True
    pose("Portrait | Reference smile", 0)
    for angle, name in [(-26, "three-quarter"), (180, "rear"), (90, "profile")]:
        if name == "profile":
            pose("Portrait | Profile glance", 0)
        frame_view(angle, 1.752, 0.963, 0.012)
        render(name)
elif kind == "portrait":
    scene.cycles.samples = 20
    scene.render.resolution_x = scene.render.resolution_y = 860
    pose("Portrait | Reference smile", 0)
    frame_view(-26, 1.748, 0.914, 0.012)
    render("portrait")
    scene.render.film_transparent = True
    render("hud")
elif kind == "motion":
    scene.cycles.samples = 6
    scene.render.resolution_x = 576
    scene.render.resolution_y = 624
    pose(name_for("kling1910"), 0)
    frame_view(0, 1.755, 1.02, 0.018)
    scene.render.use_persistent_data = True
    for frame in range(sheet["takes"]["kling1910"]["frames"]):
        scene.frame_set(frame + 1)
        render("%04d" % frame)
else:
    raise ValueError(kind)
