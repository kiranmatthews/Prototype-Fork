"""Build the artist-editable Blender character and the direct Bone Man runtime surface.

blender --background <rig-source.blend> --python assemble.py -- <prepared-drafts> <output> [preview]
"""

import bpy
import json
import math
import sys
from pathlib import Path
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent)]
import geometry
import fit_body
import hair
from material import Library
from pigment_morph import write_color_morphs, install_source_shader

root = HERE.parents[2]
args = sys.argv[sys.argv.index("--") + 1 :]
work, out = map(Path, args[:2])
out.mkdir(parents=True, exist_ok=True)
mode = args[2] if len(args) > 2 else "full"
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == "ARMATURE" and o.get("rigSource"))
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
for key in list(rig.keys()):
    if isinstance(rig[key], float):
        del rig[key]
for action in list(bpy.data.actions):
    if action.name.startswith(("Face |", "Pose |", "Portrait |")):
        bpy.data.actions.remove(action)
for group in list(bpy.data.collections):
    if group.name.startswith("Facial controls |"):
        for obj in list(group.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(group)
rig.update_tag()
for obj in list(scene.objects):
    if obj.get("cargoSection"):
        bpy.data.objects.remove(obj, do_unlink=True)
for group in list(bpy.data.collections):
    if group.name.startswith("Cargo Roo | character surfaces") and not group.objects:
        bpy.data.collections.remove(group)
bpy.data.orphans_purge(do_recursive=True)
scene.frame_set(1)
scene.render.engine = "CYCLES"
scene.cycles.use_denoising = True
scene.cycles.samples = 14
bpy.context.preferences.filepaths.save_version = 0
rest = json.loads((HERE.parent / "calibration.json").read_text())
presets = json.loads((root / "src/character/cargoRiderExpressions.json").read_text())
sheet = json.loads((root / "src/character/cargoRiderTakes.json").read_text())
lib = Library(work)
objects = []
summary = {}
rig["facialRest"] = (
    "Frontal neutral sculpt, relaxed lips, level brows and centered gaze. All facial sliders zero."
)
rig["surfaceSource"] = "generative-assist"
rig["smartMeshComponents"] = {
    "neutral": "8476f9bd-b5b0-4b33-9c99-5ce1dcef8a0d",
    "coiffure": "d5924dc5-8b39-4f70-8d31-974e1a02af90",
    "wardrobe": "5fead724-66d0-4511-9591-63125916b590",
}
collection = bpy.data.collections.new("Cargo Roo | character surfaces")
scene.collection.children.link(collection)


def xyz(v):
    return np.column_stack((v[:, 0], -v[:, 2], v[:, 1])).astype("f4")


def put(name, section, p, faces, uv, weights, mat, targets=None, tint=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(xyz(p).tolist(), [], faces.tolist())
    mesh.update()
    if len(uv):
        uvl = mesh.uv_layers.new(name="Pigment UV")
        tex = uv.copy()
        tex[:, :, 1] = 1 - tex[:, :, 1]
        uvl.uv.foreach_set("vector", tex.astype("f4").ravel())
    mesh.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["cargoSection"] = section
    obj.parent = rig
    mesh.materials.append(mat)
    if isinstance(weights, str):
        group = obj.vertex_groups.new(name=weights)
        group.add(list(range(len(p))), 1.0, "REPLACE")
    else:
        groups = {}
        for i, ws in enumerate(weights):
            for key, value in ws.items():
                if key not in groups:
                    groups[key] = obj.vertex_groups.new(name=key)
                groups[key].add([i], float(value), "REPLACE")
    if tint is not None:
        color = mesh.color_attributes.new(
            name="Cheek undertone", type="FLOAT_COLOR", domain="POINT"
        )
        color.data.foreach_set("color", tint.astype("f4").ravel())
        mesh.color_attributes.active_color = color
        obj["cargoCheekUndertone"] = True
    mod = obj.modifiers.new(name="Bone Man skin", type="ARMATURE")
    mod.object = rig
    used = {}
    if targets:
        used = {k: np.array(delta) for k, delta in targets.items() if np.max(np.abs(delta)) > 1e-7}
        for pose, tracks in presets.items():
            delta = sum(
                (
                    used[k]
                    * value
                    * (1 - tracks.get("Blink" + k[-2:], 0.0) if k.startswith("LidAngle.") else 1)
                    for k, value in tracks.items()
                    if k in used
                ),
                start=np.zeros_like(p),
            )
            for suffix in (".L", ".R"):
                blink = tracks.get("Blink" + suffix, 0.0)
                if "LidArc" + suffix in used:
                    delta += used["LidArc" + suffix] * 4 * blink * (1 - blink)
            for key in ("IrisFit." + pose, "MaskFit." + pose):
                if key in used:
                    delta += used[key]
            if np.max(np.abs(delta)) > 1e-7:
                used["Pose." + pose] = delta
        if used:
            obj.shape_key_add(name="Basis", from_mix=False)
        for key, delta in used.items():
            block = obj.shape_key_add(name=key, from_mix=False)
            block.data.foreach_set("co", xyz(p + delta).ravel())
            if key not in rig:
                rig[key] = 0.0
                rig.id_properties_ui(key).update(
                    min=0.0, max=1.0, description="Cargo Roo animated sculpt"
                )
            driver = block.driver_add("value").driver
            driver.type = "AVERAGE"
            v = driver.variables.new()
            v.name = "control"
            v.targets[0].id = rig
            v.targets[0].data_path = '["' + key + '"]'
            if key.startswith("LidArc."):
                v.targets[0].data_path = '["Blink' + key[-2:] + '"]'
                v.name = "closure"
                driver.type = "SCRIPTED"
                driver.expression = "4*closure*(1-closure)"
            if key.startswith("LidAngle."):
                v.name = "tilt"
                driver.type = "SCRIPTED"
                blink = driver.variables.new()
                blink.name = "closure"
                blink.targets[0].id = rig
                blink.targets[0].data_path = '["Blink' + key[-2:] + '"]'
                driver.expression = "tilt*(1-closure)"
    objects.append(obj)
    summary[name] = {"triangles": len(faces), "vertices": len(p), "targets": len(used)}
    return obj


def physique():
    dat = np.load(work / "body.npz")
    all_ids = np.unique(dat["group"])
    pieces = [
        ("Knit, shoulder, hands and cargo trousers", [0], "Wardrobe", 0.57, 0.29, 0.03, 0.09, 0.53),
        ("White stitched court shoes", [1, 2], "Wardrobe", 0.46, 0.34, 0.09, 0.02, 0.72),
        (
            "Glazed cowries and knots",
            list(np.unique(dat["group"][(dat["group"] > 0) & (dat["pos"][:, 1] > 0.93)])),
            "Wardrobe",
            0.28,
            0.46,
            0.31,
            0.02,
            0.55,
        ),
    ]
    seen = set(i for _, ids, *_ in pieces for i in ids)
    pieces.append(
        (
            "Drawcord, pocket flaps, nails and bracelets",
            [int(i) for i in all_ids if i not in seen],
            "Wardrobe",
            0.44,
            0.36,
            0.09,
            0.02,
            0.66,
        )
    )
    for name, ids, section, rough, spec, coat, sheen, strength in pieces:
        if name.startswith("Glazed"):
            continue
        p, f, uv, g = geometry.isolate(dat, ids)
        # Keep the source's continuous deltoid, fingers and ring-style trouser folds.
        if name.startswith("Knit"):
            p, f, uv, g = geometry.clip_height(p, f, uv, g, 0.964, False)
            center = p[f].mean(axis=1)
            moving = (
                (center[:, 1] > 0.72)
                | ((center[:, 1] > 0.48) & (abs(center[:, 0]) > 0.20))
                | (center[:, 1] < 0.150)
            )
            p, f, uv, g = geometry.refine(p, f, uv, g, moving)
        v, ws = fit_body.fit(p, g, rest)
        mat = lib.make(name, "body", rough, spec, coat, sheen, strength)
        keys = {}
        if name.startswith("Knit"):
            for s, suffix in [(1, "L"), (-1, "R")]:
                x = s * v[:, 0]
                h = v[:, 1]
                d = v[:, 2]
                t = np.exp(
                    -(((x - 0.205) / 0.074) ** 2) - ((h - 1.390) / 0.081) ** 2 - (d / 0.12) ** 2
                )
                t *= fit_body.ease((x - 0.078) / 0.07)
                keys["ShoulderRelax." + suffix] = np.column_stack(
                    (s * 0.014 * t, 0.004 * t, -0.002 * t)
                )
        if keys:
            from tank_back import build as fit_tank_back

            back, keep = fit_tank_back(put, lib, v, f, ws, keys)
            shoulder_drivers(back)
            lower_ring = v[abs(p[:, 1] - 0.964) < 1e-7]
            uv = uv[keep]
            indices, remap = np.unique(f[keep], return_inverse=True)
            f = remap.reshape(-1, 3)
            v = v[indices]
            ws = [ws[i] for i in indices]
            keys = {key: delta[indices] for key, delta in keys.items()}
        obj = put(name, section, v, f, uv, ws, mat, keys)
        if keys:
            shoulder_drivers(obj)
    return lower_ring


def shoulder_drivers(obj):
    for suffix, side in [("L", "left"), ("R", "right")]:
        path = 'key_blocks["ShoulderRelax.' + suffix + '"].value'
        driver = next(
            fc.driver for fc in obj.data.shape_keys.animation_data.drivers if fc.data_path == path
        )
        driver.type = "SCRIPTED"
        driver.variables[0].name = "manual"
        for prefix, bone in [("s", "shoulder-"), ("e", "elbow-")]:
            target = bpy.data.objects[bone + side + " • chest space"]
            for axis in "xyz":
                var = driver.variables.new()
                var.name = prefix + axis
                var.type = "TRANSFORMS"
                t = var.targets[0]
                t.id = target
                t.transform_type = "LOC_" + axis.upper()
                t.transform_space = "LOCAL_SPACE"
        length = "max(.001,sqrt((ex-sx)**2+(ey-sy)**2+(ez-sz)**2))"
        driver.expression = (
            "max(manual,min(1,max(0,(.64-sqrt((ex-sx)**2)/"
            + length
            + ")/.35))*min(1,max(0,((sz-ez)/"
            + length
            + "-.6)/.27)))"
        )


def coiffure():
    dat = np.load(work / "bust.npz")
    for name, ids, sty in [
        ("Curtain fringe and crown tuft", [1, 19], "gold"),
        ("Combed back cap", [5], "gold"),
        ("Right ponytail", [2], "gold"),
        ("Left ponytail", [3], "gold"),
        ("Violet double hair elastics", [6, 7], "tie"),
        ("Long cupped ears", [8, 9], "ear"),
    ]:
        p, f, uv, g = geometry.isolate(dat, ids)
        v = hair.register(hair.fit(p), g)
        if ids == [5]:
            # Register the lower crown to the new nape. The center ends below
            # the sides, where the brushed locks meet in the reference's V.
            x, y, z = v.T.copy()
            rear = fit_body.ease((0.065 - z) / 0.14)
            lower = 1 - fit_body.ease((y - 1.652) / 0.247)
            medial = np.exp(-(((x - 0.012) / 0.105) ** 2))
            v[:, 1] -= (0.039 + 0.023 * medial) * lower
            v[:, 0] += (x - 0.012) * (0.044 + 0.039 * lower) * rear
            v[:, 2] -= rear * (0.010 + 0.032 * lower)
            course = (y - 0.45 * abs(x - 0.012) - 1.60) / 0.044
            wave = np.cos(2 * np.pi * course)
            v[:, 2] -= 0.0044 * rear * wave * (0.44 + 0.56 * lower)
        if 1 in ids:
            temple = fit_body.ease((abs(v[:, 0]) - 0.052) / 0.082) * (
                1 - fit_body.ease((v[:, 1] - 1.76) / 0.159)
            )
            v[:, 2] -= 0.078 * temple
            v[:, 0] += 0.008 * np.sign(v[:, 0]) * temple
            # Sweep the side fringe behind the lateral canthus at eye height.
            clear = fit_body.ease((abs(v[:, 0]) - 0.064) / 0.073) * np.exp(
                -(((v[:, 1] - 1.746) / 0.087) ** 4)
            )
            v[:, 2] -= 0.045 * clear
        mat = (
            lib.make("Champagne blonde | directional locks", "bust", 0.43, 0.38, 0.12, 0.105, 0.76)
            if sty == "gold"
            else (
                lib.make("Violet ribbed elastics", "bust", 0.48, 0.32, 0.10, 0.12, 0.72)
                if sty == "tie"
                else lib.make("Warm velvet | pinnae", "bust", 0.52, 0.29, 0.02, 0.10, 0.62)
            )
        )
        if sty == "gold":
            bs = mat.node_tree.nodes.get("Principled BSDF")
            bs.inputs["Anisotropic"].default_value = 0.34
        # Both ponytails have separate local sculpt channels. Their base follows the head presentation node.
        ws = "head-presentation"
        if sty == "ear":
            ws = []
            for co, idx in zip(v, g):
                s = "left" if idx == 9 else "right"
                amount = float(fit_body.ease((co[1] - 1.895) / 0.10)) * 0.83
                ws.append({"head-presentation": 1 - amount, "ear-" + s: amount})
        put(name, "Ears and hair", v, f, uv, ws, mat, hair.shapes(p, g))


lower_neck = physique()
coiffure()
import cowries

cowries.build(put, lib)
if mode != "body":
    import facial

    upper_neck = facial.build(put, lib, work, rest)
    from collar import bridge

    v, f = bridge(lower_neck, upper_neck)
    neck_mat = lib.make(
        "Tawny pelt | neck", None, 0.57, 0.28, 0, 0.065, color=(0.775, 0.151, 0.0023)
    )
    put("Neck | continuous collar transition", "Wardrobe", v, f, [], "neck", neck_mat)
triangles = sum(len(o.data.polygons) for o in objects)
assert triangles <= 150000, triangles
if mode != "body":
    import actions, face_board

    actions.write_actions(rig, sheet)
    face_board.build(rig, objects)
summary["total"] = triangles
(out / "build.json").write_text(json.dumps(summary, indent=2))
bpy.context.view_layer.update()
for obj in bpy.context.selected_objects:
    obj.select_set(False)
rig.select_set(True)
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
if mode in ("full", "asset"):
    options = dict(
        filepath=str(out / "cargo-roo.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_extras=True,
        export_yup=True,
        export_skins=True,
        export_morph=True,
        export_morph_normal=True,
        export_normals=True,
        export_all_influences=False,
        export_texcoords=True,
        export_vertex_color="ACTIVE",
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_def_bones=False,
        export_try_sparse_sk=True,
        export_try_omit_sparse_sk=True,
    )
    bpy.ops.export_scene.gltf(**options)
    write_color_morphs(out / "cargo-roo.glb")
    from animation_export import add_animations

    add_animations(out / "cargo-roo.glb", sheet)
    for obj in objects:
        if obj.get("cargoCheekUndertone"):
            install_source_shader(obj.data.materials[0], rig)
for obj in objects:
    obj.select_set(False)
studio_cam = bpy.data.objects.get("Character portrait")
scene.camera = studio_cam


def camera(angle, center, scale):
    angle = math.radians(angle)
    target = Vector(center)
    cam = studio_cam
    cam.location = target + Vector((4 * math.sin(angle), -4 * math.cos(angle), 0.07))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = scale
    scene.camera = cam


def render(name):
    scene.render.filepath = str(out / (name + ".png"))
    bpy.ops.render.render(write_still=True)


bpy.data.objects["Studio ground"].hide_render = True
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.resolution_x = scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = -0.37
for title, loc, power, size, color in [
    ("Key softbox", (-1.7, -2.1, 3.9), 143, 1.7, (1, 0.951, 0.875)),
    ("Cool fill", (1.9, -1.7, 2.55), 52, 2.1, (0.86, 0.92, 1)),
    ("Rim", (1.2, 1.6, 3.3), 123, 1.7, (1, 0.88, 0.72)),
    ("Portrait bounce", (-0.12, -2.0, 0.65), 25, 2.0, (1, 0.90, 0.80)),
]:
    light = bpy.data.objects[title]
    light.location = loc
    light.data.energy = power
    light.data.size = size
    light.data.color = color
    light.rotation_euler = (
        (Vector((0, 0, 1.65)) - light.location).to_track_quat("-Z", "Y").to_euler()
    )
bg = scene.world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.43, 0.42, 0.45, 1)
bg.inputs[1].default_value = 0.47
for title in ("Portrait bounce", "Cool fill"):
    lamp = bpy.data.objects.get(title)
    if lamp:
        lamp.data.energy *= 1.28
camera(0, (0, -0.008, 1.76), 1.017)
if mode in ("full", "asset"):
    bpy.ops.file.pack_all()
    scene.render.filepath = "//portrait.png"
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "Cargo Roo.blend"), compress=True)
if mode not in ("export", "asset"):
    for angle, c, scale, name in [
        (0, (0, 0, 1.76), 1.02, "neutral-front"),
        (-24, (0, 0, 1.76), 1.02, "neutral-three-quarter"),
        (90, (0, 0, 1.76), 1.02, "neutral-profile"),
        (180, (0, 0, 1.76), 1.02, "neutral-back"),
        (10, (0, 0, 1.17), 2.20, "fullbody"),
    ]:
        camera(angle, c, scale)
        render(name)
    if mode != "body":
        for preset in ["smug", "cackle", "yikes", "puffer", "raspberry"]:
            rig["Pose." + preset] = 1.0
            rig.update_tag()
            bpy.context.view_layer.update()
            camera(-12, (0, -0.018, 1.76), 0.96)
            render(preset)
            rig["Pose." + preset] = 0.0
            rig.update_tag()
            bpy.context.view_layer.update()
print("BUILT", triangles, "triangles", len(objects), "meshes")
