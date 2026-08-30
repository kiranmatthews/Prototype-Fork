#!/usr/bin/env python3
"""Bake the owner-supplied Meshy courtyard FBX into a tiny web GLB.

Run with Blender, not system Python:

  blender --background --factory-startup \
    --python tools/bake-meshy-courtyard.py -- SOURCE.fbx BASE_COLOR.png OUTPUT.glb

Gameplay collision remains code-authored. This asset is presentation only, so
the web bake intentionally drops the 4K normal and 2K metallic/roughness maps,
shrinks base color to 512 px JPEG, and lightly decimates the already-low-poly
mesh while retaining the recognizable bridge/courtyard silhouette.
"""

from __future__ import annotations

import os
from pathlib import Path
import json
import struct
import sys
import tempfile

def arguments() -> tuple[Path, Path, Path]:
    try:
        marker = sys.argv.index("--")
        source, base_color, output = sys.argv[marker + 1 : marker + 4]
    except (ValueError, IndexError):
        raise SystemExit("expected SOURCE.fbx BASE_COLOR.png OUTPUT.glb after --")
    return Path(source), Path(base_color), Path(output)


def clear_scene() -> None:
    import bpy

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for value in list(block):
            block.remove(value)


def canonicalize_glb(output: Path) -> None:
    """Remove exporter/temp-path variance and enforce Unity's backface culling."""
    blob = output.read_bytes()
    magic, version, _ = struct.unpack_from("<4sII", blob, 0)
    if magic != b"glTF" or version != 2:
        raise RuntimeError("expected a GLB 2.0 asset")
    json_length, json_type = struct.unpack_from("<II", blob, 12)
    if json_type != 0x4E4F534A:
        raise RuntimeError("GLB begins without a JSON chunk")
    json_start = 20
    json_end = json_start + json_length
    document = json.loads(blob[json_start:json_end].decode("utf-8"))
    document.setdefault("asset", {})["copyright"] = (
        "Ancient Stone Courtyard — model created with Meshy — CC BY 4.0"
    )
    if document.get("images"):
        document["images"][0]["name"] = "AncientStoneCourtyard_BaseColor_512"
    for material in document.get("materials", []):
        material.pop("doubleSided", None)  # glTF default false, matching Unity _Cull:2
    encoded = json.dumps(document, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    tail = blob[json_end:]
    rebuilt = (
        struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(encoded) + len(tail))
        + struct.pack("<II", len(encoded), 0x4E4F534A)
        + encoded
        + tail
    )
    output.write_bytes(rebuilt)


def main() -> None:
    import bpy
    from mathutils import Matrix, Vector

    source, base_color, output = arguments()
    if not source.is_file() or not base_color.is_file():
        raise SystemExit("Meshy FBX or base-color source is missing")
    output.parent.mkdir(parents=True, exist_ok=True)
    clear_scene()

    bpy.ops.import_scene.fbx(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("FBX contains no mesh")
    subject = max(meshes, key=lambda obj: len(obj.data.polygons))
    for obj in list(bpy.context.scene.objects):
        if obj != subject:
            bpy.data.objects.remove(obj, do_unlink=True)
    subject.name = "AncientStoneCourtyard_Meshy"
    subject.data.name = "AncientStoneCourtyard_Meshy_Geometry"
    bpy.context.view_layer.objects.active = subject
    subject.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    source_triangles = len(subject.data.polygons)
    if source_triangles > 900:
        modifier = subject.modifiers.new("Web silhouette decimation", "DECIMATE")
        modifier.ratio = 0.78
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    # Export a stable bottom-centred unit model. Runtime applies Unity's 11.52m
    # fitted maximum dimension and the alternating module pitch.
    bounds = [subject.matrix_world @ Vector(corner) for corner in subject.bound_box]
    minimum = Vector((min(p.x for p in bounds), min(p.y for p in bounds), min(p.z for p in bounds)))
    maximum = Vector((max(p.x for p in bounds), max(p.y for p in bounds), max(p.z for p in bounds)))
    centre_bottom = Vector(((minimum.x + maximum.x) * 0.5, (minimum.y + maximum.y) * 0.5, minimum.z))
    subject.data.transform(Matrix.Translation(-centre_bottom))
    dimensions = maximum - minimum
    maximum_dimension = max(dimensions)
    subject.data.transform(Matrix.Scale(1.0 / maximum_dimension, 4))
    subject.data.update()

    # Re-encode one small color map; stone response comes from scalar PBR
    # values. The source normal/metal/roughness maps account for most of the
    # 41MB handoff and add little at the model's on-screen size.
    image = bpy.data.images.load(str(base_color), check_existing=False)
    image.scale(512, 512)
    descriptor, temporary_jpeg = tempfile.mkstemp(suffix=".jpg")
    os.close(descriptor)
    try:
        image.filepath_raw = temporary_jpeg
        image.file_format = "JPEG"
        image.save()
        web_image = bpy.data.images.load(temporary_jpeg, check_existing=False)
        web_image.name = "AncientStoneCourtyard_BaseColor_512"

        material = bpy.data.materials.new("AncientStoneCourtyard_Web")
        material.use_nodes = True
        nodes = material.node_tree.nodes
        nodes.clear()
        output_node = nodes.new("ShaderNodeOutputMaterial")
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = web_image
        texture.interpolation = "Linear"
        shader.inputs["Roughness"].default_value = 0.82
        shader.inputs["Metallic"].default_value = 0.04
        material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
        material.node_tree.links.new(shader.outputs["BSDF"], output_node.inputs["Surface"])
        subject.data.materials.clear()
        subject.data.materials.append(material)

        for polygon in subject.data.polygons:
            polygon.use_smooth = True

        bpy.ops.object.select_all(action="DESELECT")
        subject.select_set(True)
        bpy.context.view_layer.objects.active = subject
        bpy.ops.export_scene.gltf(
            filepath=str(output),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_texcoords=True,
            export_normals=True,
            export_tangents=False,
            export_materials="EXPORT",
            export_image_format="JPEG",
            export_jpeg_quality=52,
            export_cameras=False,
            export_lights=False,
            export_animations=False,
        )
        canonicalize_glb(output)
    finally:
        if os.path.exists(temporary_jpeg):
            os.remove(temporary_jpeg)

    print(
        "MESHY_WEB_BAKE",
        {
            "source_triangles": source_triangles,
            "web_triangles": len(subject.data.polygons),
            "source_dimensions": tuple(round(value, 5) for value in dimensions),
            "bytes": output.stat().st_size,
            "output": str(output),
        },
    )


if __name__ == "__main__":
    if "--canonicalize-only" in sys.argv:
        index = sys.argv.index("--canonicalize-only")
        canonicalize_glb(Path(sys.argv[index + 1]))
    else:
        main()
