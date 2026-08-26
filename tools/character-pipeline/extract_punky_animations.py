#!/usr/bin/env python3
"""Bake the canonical Punky Fox FBX motions into the production web GLB.

This script runs inside Blender 5.2+ and emits one GLB containing the existing
mesh/skin plus a compact, 30 Hz, root-motion-free animation library.  It never
copies an animation-source mesh into the output.

Example:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python tools/character-pipeline/extract_punky_animations.py -- \
    --base-glb work/roo-character/punky-fox-web.glb \
    --character-root "/path/to/Assets/Game/Art/Characters/PunkyFox" \
    --meshy-root "/path/to/Assets/MeshyImports" \
    --out-glb work/roo-character/punky-fox-animated.glb \
    --report work/roo-character/punky-animation-report.json

The source FBXs remain external owner-supplied Meshy evidence.  Their exact
hashes are pinned below so a silent source replacement cannot alter a build.
"""

from __future__ import annotations

import argparse
from bisect import bisect_right
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import tempfile
from typing import Any, Iterable, Sequence

import bpy


GLB_MAGIC = b"glTF"
GLB_VERSION = 2
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
FLOAT_COMPONENT = 5126
TYPE_WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
CORE_BONES = {
    "Hips",
    "LeftUpLeg",
    "LeftLeg",
    "LeftFoot",
    "LeftToeBase",
    "RightUpLeg",
    "RightLeg",
    "RightFoot",
    "RightToeBase",
    "Spine02",
    "Spine01",
    "Spine",
    "LeftShoulder",
    "LeftArm",
    "LeftForeArm",
    "LeftHand",
    "neck",
    "Head",
    "RightShoulder",
    "RightArm",
    "RightForeArm",
    "RightHand",
}
SECONDARY_BONES = {
    "Ponytail.L",
    "Ponytail.L.Tip",
    "Ponytail.R",
    "Ponytail.R.Tip",
    "Ear.L",
    "Ear.R",
}
REMOVED_HELPERS = {"head_end", "headfront"}


@dataclass(frozen=True)
class ClipSpec:
    name: str
    semantic: str
    relative_path: str | None
    meshy_glob: str | None
    sha256: str
    loop: bool
    translation_policy: str
    crop_start: float | None = None
    crop_end: float | None = None


CLIPS = (
    ClipSpec(
        "idle",
        "idle-breathe",
        None,
        "**/Meshy_AI_Punky_Fox_Pop_biped_Animation_Idle_11_frame_rate_60_*/*.fbx",
        "bdf452683a0dfc2800d50991368724a637c9e43218cc128c5b103dc3b1d5f6a1",
        True,
        "detrend-planar",
    ),
    ClipSpec(
        "walk",
        "foot-locomotion-walk",
        "Source/PunkyFox_Walk.fbx",
        None,
        "587a950aba13027a2a830500e014ae2bf4a9ed4abb0eba482980c3e9b0d3c8e5",
        True,
        "detrend-planar",
    ),
    ClipSpec(
        "run",
        "foot-locomotion-run",
        None,
        "**/Meshy_AI_Punky_Fox_Pop_biped_Animation_run_fast_3_inplace_frame_rate_60_*/*.fbx",
        "4db2b1f18721cd09e40a588e4fc18e54f51862447abf6807aac16475a81eaaf0",
        True,
        "detrend-planar",
    ),
    ClipSpec(
        "jump",
        "squash-stretch-jump",
        "Source/PunkyFox_Animation_Squash Stretch Jump_frame_rate_60.fbx",
        None,
        "675dc447a127f29f0028d43bb883e2c2e68c9a48996c5cb7b89fe1b8a7a41dd5",
        False,
        "detrend-planar",
    ),
    ClipSpec(
        "spin",
        "spin-follow-through",
        None,
        "**/Meshy_AI_Punky_Fox_Pop_biped_Animation_Axe_Spin_Attack_frame_rate_60_*/*.fbx",
        "fbf299b1c7954e44cfa1c2a973c31e88695f08e29908acc90529337d47225fbe",
        False,
        "lock-pelvis",
    ),
    ClipSpec(
        "slide",
        "low-slide",
        None,
        "**/Meshy_AI_Punky_Fox_Pop_biped_Animation_slide_light_frame_rate_60_*/*.fbx",
        "498a682de59e7d4187351d79e2d488f45e27f98dc22eee80d4fb2d315b185f0e",
        False,
        "detrend-planar",
        21.0 / 60.0,
        42.0 / 60.0,
    ),
    ClipSpec(
        "crawl",
        "crawl-loop",
        None,
        "**/Meshy_AI_Punky_Fox_Pop_biped_Animation_Crawl_and_Look_Back_frame_rate_60_*/*.fbx",
        "430b0b16801a90b1cba1e0a565d1591028555d9708edbb353a48f7ae36642cbe",
        True,
        "detrend-planar",
        219.0 / 60.0,
        271.0 / 60.0,
    ),
    ClipSpec(
        "fall",
        "airborne-fall-loop",
        None,
        "**/Meshy_AI_Punky_Fox_Pop_biped_Animation_Fall1_frame_rate_60_*/*.fbx",
        "74c2f207701731eff6ab4669626bd536a340b828776701f8f4ce227c4f2eeacf",
        True,
        "lock-pelvis",
    ),
    ClipSpec(
        "bail",
        "run-jump-roll-recovery",
        "Source/PunkyFox_Animation_Run Jump and Roll_frame_rate_60.fbx",
        None,
        "81bba279be71780092419f813a79c3bd3e0d5bb21ab8407f31adc6342542aadc",
        False,
        "detrend-planar",
        150.0 / 60.0,
        200.0 / 60.0,
    ),
    ClipSpec(
        "death",
        "terminal-fall",
        None,
        "**/Meshy_AI_Punky_Fox_Pop_biped_Animation_Dead_frame_rate_60_*/*.fbx",
        "806e0b6e5307cae5242fc1601d0e5a7da18406e6f2a07879e75a88b19bdd1071",
        False,
        "lock-pelvis",
    ),
)


@dataclass
class Track:
    node_name: str
    path: str
    times: list[float]
    values: list[tuple[float, ...]]
    interpolation: str


def parse_args() -> argparse.Namespace:
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-glb", required=True, type=Path)
    parser.add_argument("--character-root", required=True, type=Path)
    parser.add_argument("--meshy-root", required=True, type=Path)
    parser.add_argument("--out-glb", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--fps", type=int, default=30)
    return parser.parse_args(raw)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_source(spec: ClipSpec, character_root: Path, meshy_root: Path) -> Path:
    if spec.relative_path:
        candidates = [character_root / spec.relative_path]
    elif spec.meshy_glob:
        candidates = sorted(path for path in meshy_root.glob(spec.meshy_glob) if path.is_file())
    else:
        raise RuntimeError(f"clip {spec.name} has no source selector")
    if len(candidates) != 1 or not candidates[0].is_file():
        raise RuntimeError(
            f"clip {spec.name} expected exactly one source, found {len(candidates)}: "
            + ", ".join(str(path) for path in candidates)
        )
    actual = sha256(candidates[0])
    if actual != spec.sha256:
        raise RuntimeError(
            f"source hash changed for {spec.name}: expected {spec.sha256}, found {actual}"
        )
    return candidates[0].resolve()


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    payload = path.read_bytes()
    if len(payload) < 20:
        raise RuntimeError(f"truncated GLB: {path}")
    magic, version, total = struct.unpack_from("<4sII", payload, 0)
    if magic != GLB_MAGIC or version != GLB_VERSION or total != len(payload):
        raise RuntimeError(f"invalid GLB header: {path}")
    offset = 12
    document = None
    binary = b""
    while offset < len(payload):
        length, kind = struct.unpack_from("<II", payload, offset)
        offset += 8
        chunk = payload[offset : offset + length]
        offset += length
        if kind == JSON_CHUNK:
            document = json.loads(chunk.rstrip(b" \t\r\n\x00"))
        elif kind == BIN_CHUNK:
            binary = bytes(chunk)
    if document is None:
        raise RuntimeError(f"GLB has no JSON chunk: {path}")
    if len(document.get("buffers", [])) != 1:
        raise RuntimeError("the pipeline expects one embedded GLB buffer")
    declared = int(document["buffers"][0].get("byteLength", 0))
    if declared > len(binary) or len(binary) - declared > 3:
        raise RuntimeError(f"GLB buffer length mismatch: declared {declared}, chunk {len(binary)}")
    return document, binary[:declared]


def write_glb(path: Path, document: dict[str, Any], binary: bytes) -> None:
    document["buffers"][0]["byteLength"] = len(binary)
    encoded = json.dumps(
        document,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    padded_binary = binary + b"\x00" * ((-len(binary)) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(padded_binary)
    payload = bytearray(struct.pack("<4sII", GLB_MAGIC, GLB_VERSION, total))
    payload += struct.pack("<II", len(encoded), JSON_CHUNK)
    payload += encoded
    payload += struct.pack("<II", len(padded_binary), BIN_CHUNK)
    payload += padded_binary
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def read_accessor(
    document: dict[str, Any], binary: bytes, accessor_index: int
) -> list[tuple[float, ...]]:
    accessor = document["accessors"][accessor_index]
    if accessor.get("componentType") != FLOAT_COMPONENT:
        raise RuntimeError(f"animation accessor {accessor_index} is not FLOAT")
    if "sparse" in accessor:
        raise RuntimeError(f"sparse animation accessor {accessor_index} is unsupported")
    width = TYPE_WIDTH.get(accessor.get("type"))
    if width is None:
        raise RuntimeError(f"unsupported accessor type: {accessor.get('type')}")
    view = document["bufferViews"][accessor["bufferView"]]
    if int(view.get("buffer", 0)) != 0:
        raise RuntimeError("external animation buffers are unsupported")
    packed = width * 4
    stride = int(view.get("byteStride", packed))
    if stride < packed:
        raise RuntimeError("invalid animation bufferView stride")
    offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    count = int(accessor["count"])
    fmt = "<" + "f" * width
    result = []
    for index in range(count):
        values = tuple(float(value) for value in struct.unpack_from(fmt, binary, offset + index * stride))
        if not all(math.isfinite(value) for value in values):
            raise RuntimeError(f"non-finite animation value in accessor {accessor_index}")
        result.append(values)
    return result


def node_name_map(document: dict[str, Any]) -> dict[str, int]:
    result: dict[str, int] = {}
    for index, node in enumerate(document.get("nodes", [])):
        name = node.get("name")
        if not name:
            continue
        if name in result:
            raise RuntimeError(f"duplicate GLB node name: {name}")
        result[name] = index
    return result


def canonical_node_name(name: str) -> str:
    # FBX exporters occasionally preserve a namespace before a colon.  The
    # canonical web rig deliberately uses the terminal semantic bone name.
    return name.rsplit(":", 1)[-1]


def extract_tracks(document: dict[str, Any], binary: bytes) -> tuple[list[Track], str]:
    animations = document.get("animations", [])
    if len(animations) != 1:
        raise RuntimeError(f"expected one exported source action, found {len(animations)}")
    animation = animations[0]
    tracks: list[Track] = []
    for channel in animation.get("channels", []):
        target = channel["target"]
        path = target["path"]
        if path == "weights":
            continue
        source_name = document["nodes"][target["node"]].get("name", "")
        node_name = canonical_node_name(source_name)
        sampler = animation["samplers"][channel["sampler"]]
        times_raw = read_accessor(document, binary, sampler["input"])
        values = read_accessor(document, binary, sampler["output"])
        times = [value[0] for value in times_raw]
        if len(times) != len(values) or not times:
            raise RuntimeError(f"unaligned source track {node_name}.{path}")
        if any(right <= left for left, right in zip(times, times[1:])):
            raise RuntimeError(f"non-monotonic source track {node_name}.{path}")
        interpolation = sampler.get("interpolation", "LINEAR")
        if interpolation not in {"LINEAR", "STEP"}:
            raise RuntimeError(
                f"unsupported source interpolation {interpolation} on {node_name}.{path}"
            )
        tracks.append(Track(node_name, path, times, values, interpolation))
    return tracks, animation.get("name", "")


def reset_and_export_source(source: Path, clip_name: str, destination: Path) -> dict[str, Any]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 60
    scene.render.fps_base = 1.0
    bpy.ops.import_scene.fbx(
        filepath=str(source),
        use_anim=True,
        ignore_leaf_bones=False,
        automatic_bone_orientation=False,
    )
    armatures = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    animated = [
        obj
        for obj in armatures
        if obj.animation_data is not None and obj.animation_data.action is not None
    ]
    if len(animated) != 1:
        details = [
            {
                "name": obj.name,
                "action": getattr(getattr(obj.animation_data, "action", None), "name", None),
            }
            for obj in armatures
        ]
        raise RuntimeError(
            f"{source.name}: expected one animated armature, found {len(animated)}: {details}"
        )
    armature = animated[0]
    action = armature.animation_data.action
    original_action_name = action.name
    action.name = clip_name
    action_range = tuple(float(value) for value in action.frame_range)
    scene.frame_start = math.floor(action_range[0])
    scene.frame_end = math.ceil(action_range[1])
    for obj in scene.objects:
        obj.select_set(False)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_skins=True,
        export_def_bones=True,
        export_animations=True,
        export_animation_mode="ACTIVE_ACTIONS",
        export_force_sampling=True,
        export_bake_animation=True,
        export_frame_range=True,
        export_frame_step=1,
        export_anim_slide_to_zero=True,
        export_optimize_animation_size=False,
        export_optimize_animation_keep_anim_armature=True,
        export_optimize_animation_keep_anim_object=True,
        export_rest_position_armature=True,
        export_anim_single_armature=True,
        export_materials="NONE",
        export_cameras=False,
        export_lights=False,
        export_morph=False,
        export_extras=False,
        export_apply=False,
    )
    if not destination.is_file():
        raise RuntimeError(f"Blender did not export {destination}")
    return {
        "armature": armature.name,
        "action": original_action_name,
        "actionFrameRange": list(action_range),
        "sceneFrameRange": [scene.frame_start, scene.frame_end],
    }


def quat_normalize(value: Sequence[float]) -> tuple[float, float, float, float]:
    length = math.sqrt(sum(component * component for component in value))
    if length <= 1e-12:
        raise RuntimeError("zero-length source quaternion")
    return tuple(float(component / length) for component in value)  # type: ignore[return-value]


def quat_slerp(
    left: Sequence[float], right: Sequence[float], amount: float
) -> tuple[float, float, float, float]:
    a = quat_normalize(left)
    b = quat_normalize(right)
    dot = sum(a[index] * b[index] for index in range(4))
    if dot < 0.0:
        b = tuple(-component for component in b)
        dot = -dot
    dot = min(1.0, max(-1.0, dot))
    if dot > 0.9995:
        return quat_normalize(
            tuple(a[index] + amount * (b[index] - a[index]) for index in range(4))
        )
    angle = math.acos(dot)
    sine = math.sin(angle)
    left_weight = math.sin((1.0 - amount) * angle) / sine
    right_weight = math.sin(amount * angle) / sine
    return quat_normalize(
        tuple(left_weight * a[index] + right_weight * b[index] for index in range(4))
    )


def sample(track: Track, time: float) -> tuple[float, ...]:
    if time <= track.times[0]:
        return track.values[0]
    if time >= track.times[-1]:
        return track.values[-1]
    right = bisect_right(track.times, time)
    left = right - 1
    start = track.times[left]
    end = track.times[right]
    amount = (time - start) / (end - start)
    if track.interpolation == "STEP":
        return track.values[left]
    if track.path == "rotation":
        return quat_slerp(track.values[left], track.values[right], amount)
    return tuple(
        track.values[left][index]
        + amount * (track.values[right][index] - track.values[left][index])
        for index in range(len(track.values[left]))
    )


def fixed_times(duration: float, fps: int) -> list[float]:
    if duration <= 0.0:
        raise RuntimeError(f"animation duration must be positive, got {duration}")
    frame_count = max(1, int(math.floor(duration * fps + 1e-6)))
    result = [index / fps for index in range(frame_count + 1)]
    if result[-1] < duration - 1e-7:
        result.append(duration)
    else:
        result[-1] = duration
    return result


def node_trs(node: dict[str, Any]) -> dict[str, tuple[float, ...]]:
    return {
        "translation": tuple(float(value) for value in node.get("translation", (0.0, 0.0, 0.0))),
        "rotation": tuple(float(value) for value in node.get("rotation", (0.0, 0.0, 0.0, 1.0))),
        "scale": tuple(float(value) for value in node.get("scale", (1.0, 1.0, 1.0))),
    }


def quaternion_difference_degrees(left: Sequence[float], right: Sequence[float]) -> float:
    a = quat_normalize(left)
    b = quat_normalize(right)
    dot = min(1.0, abs(sum(a[index] * b[index] for index in range(4))))
    return math.degrees(2.0 * math.acos(dot))


def rest_compatibility(
    source_document: dict[str, Any],
    target_document: dict[str, Any],
    target_names: dict[str, int],
) -> dict[str, Any]:
    source_names = node_name_map(source_document)
    normalized_source: dict[str, int] = {}
    for raw_name, index in source_names.items():
        normalized = canonical_node_name(raw_name)
        if normalized in normalized_source:
            raise RuntimeError(f"duplicate normalized source node name: {normalized}")
        normalized_source[normalized] = index
    shared = sorted(CORE_BONES.intersection(normalized_source).intersection(target_names))
    if set(shared) != CORE_BONES:
        raise RuntimeError(
            "source skeleton is missing core bones: " + ", ".join(sorted(CORE_BONES - set(shared)))
        )
    translation_errors = []
    rotation_errors = []
    scale_errors = []
    per_bone = {}
    for name in shared:
        source = node_trs(source_document["nodes"][normalized_source[name]])
        target = node_trs(target_document["nodes"][target_names[name]])
        translation = math.sqrt(
            sum((source["translation"][index] - target["translation"][index]) ** 2 for index in range(3))
        )
        rotation = quaternion_difference_degrees(source["rotation"], target["rotation"])
        scale = max(abs(source["scale"][index] - target["scale"][index]) for index in range(3))
        translation_errors.append(translation)
        rotation_errors.append(rotation)
        scale_errors.append(scale)
        per_bone[name] = {
            "translation": translation,
            "rotationDegrees": rotation,
            "scale": scale,
        }
    return {
        "sharedCoreBones": len(shared),
        "maxTranslation": max(translation_errors, default=0.0),
        "maxRotationDegrees": max(rotation_errors, default=0.0),
        "maxScale": max(scale_errors, default=0.0),
        "worstTranslationBone": max(per_bone, key=lambda name: per_bone[name]["translation"]),
        "worstRotationBone": max(per_bone, key=lambda name: per_bone[name]["rotationDegrees"]),
    }


def process_clip(
    spec: ClipSpec,
    source_document: dict[str, Any],
    source_binary: bytes,
    target_document: dict[str, Any],
    target_names: dict[str, int],
    fps: int,
) -> tuple[list[Track], dict[str, Any]]:
    source_tracks, source_action = extract_tracks(source_document, source_binary)
    admitted_with_scale = [
        track
        for track in source_tracks
        if track.node_name in CORE_BONES and track.node_name in target_names
    ]
    scale_tracks = [track for track in admitted_with_scale if track.path == "scale"]
    animated_scale_tracks = []
    max_constant_scale_offset = 0.0
    for track in scale_tracks:
        baseline = track.values[0]
        variation = max(
            abs(value[index] - baseline[index])
            for value in track.values
            for index in range(len(value))
        )
        max_constant_scale_offset = max(
            max_constant_scale_offset,
            max(abs(value - 1.0) for value in baseline),
        )
        if variation > 2e-5:
            animated_scale_tracks.append((track.node_name, variation))
    if animated_scale_tracks:
        raise RuntimeError(
            f"clip {spec.name} contains unsafe animated bone scale: {animated_scale_tracks}"
        )
    # Unity's production builder applies the same rule.  Meshy FBXs can carry
    # a constant skeleton-size correction (the walk Hips track is 1.17647),
    # but the canonical web bind already owns scale.  Retaining those tracks
    # would resize the mesh and is rejected by the CharacterIR evidence adapter.
    admitted = [track for track in admitted_with_scale if track.path != "scale"]
    dropped_nodes = sorted(
        {
            track.node_name
            for track in source_tracks
            if track.node_name not in CORE_BONES or track.node_name not in target_names
        }
    )
    if not admitted:
        raise RuntimeError(f"clip {spec.name} contains no compatible tracks")
    source_start = min(track.times[0] for track in admitted)
    source_end = max(track.times[-1] for track in admitted)
    start = source_start + (spec.crop_start or 0.0)
    end = source_start + spec.crop_end if spec.crop_end is not None else source_end
    if start < source_start - 1e-5 or end > source_end + 1e-4 or end <= start:
        raise RuntimeError(
            f"clip {spec.name} crop [{start}, {end}] exceeds source [{source_start}, {source_end}]"
        )
    duration = end - start
    output_times = fixed_times(duration, fps)
    processed = [
        Track(
            track.node_name,
            track.path,
            list(output_times),
            [sample(track, start + time) for time in output_times],
            "LINEAR",
        )
        for track in admitted
    ]
    by_key = {(track.node_name, track.path): track for track in processed}
    hips = by_key.get(("Hips", "translation"))
    if hips is None:
        raise RuntimeError(f"clip {spec.name} has no Hips translation track")
    target_hips = node_trs(target_document["nodes"][target_names["Hips"]])["translation"]
    before = {
        "start": list(hips.values[0]),
        "end": list(hips.values[-1]),
        "planarEndDisplacement": math.hypot(
            hips.values[-1][0] - hips.values[0][0],
            hips.values[-1][2] - hips.values[0][2],
        ),
        "verticalRange": max(value[1] for value in hips.values)
        - min(value[1] for value in hips.values),
    }
    if spec.translation_policy == "lock-pelvis":
        hips.values = [tuple(target_hips) for _time in hips.times]
    elif spec.translation_policy == "detrend-planar":
        initial = hips.values[0]
        final = hips.values[-1]
        adjusted = []
        for time, value in zip(hips.times, hips.values):
            progress = time / duration
            row = list(value)
            for axis in (0, 2):
                trend = initial[axis] + progress * (final[axis] - initial[axis])
                row[axis] = target_hips[axis] + value[axis] - trend
            adjusted.append(tuple(row))
        hips.values = adjusted
    else:
        raise RuntimeError(f"unknown translation policy: {spec.translation_policy}")
    after = {
        "start": list(hips.values[0]),
        "end": list(hips.values[-1]),
        "planarEndDisplacement": math.hypot(
            hips.values[-1][0] - hips.values[0][0],
            hips.values[-1][2] - hips.values[0][2],
        ),
        "verticalRange": max(value[1] for value in hips.values)
        - min(value[1] for value in hips.values),
    }
    if after["planarEndDisplacement"] > 1e-5:
        raise RuntimeError(
            f"clip {spec.name} retained planar root travel: {after['planarEndDisplacement']}"
        )
    # Quaternion continuity is explicit: adjacent signs are kept in one
    # hemisphere so Three.js cannot take a long interpolation path.
    for track in processed:
        if track.path != "rotation":
            continue
        continuous = []
        for value in track.values:
            normalized = quat_normalize(value)
            if continuous and sum(continuous[-1][index] * normalized[index] for index in range(4)) < 0:
                normalized = tuple(-component for component in normalized)
            continuous.append(normalized)
        track.values = continuous
    animated_bones = sorted({track.node_name for track in processed})
    if not CORE_BONES.issubset(animated_bones):
        raise RuntimeError(
            f"clip {spec.name} did not animate every core bone: "
            + ", ".join(sorted(CORE_BONES - set(animated_bones)))
        )
    return processed, {
        "sourceAction": source_action,
        "sourceTimeRange": [source_start, source_end],
        "sampledSourceRange": [start, end],
        "duration": duration,
        "sampleCount": len(output_times),
        "channelCount": len(processed),
        "animatedBoneCount": len(animated_bones),
        "animatedBones": animated_bones,
        "droppedSourceNodes": dropped_nodes,
        "droppedConstantScaleTrackCount": len(scale_tracks),
        "maxDroppedConstantScaleOffsetFromOne": max_constant_scale_offset,
        "rootMotionBefore": before,
        "rootMotionAfter": after,
    }


def append_float_accessor(
    document: dict[str, Any],
    binary: bytearray,
    rows: Sequence[Sequence[float]],
    accessor_type: str,
    target: int | None = None,
    include_bounds: bool = False,
) -> int:
    width = TYPE_WIDTH[accessor_type]
    if not rows or any(len(row) != width for row in rows):
        raise RuntimeError(f"invalid {accessor_type} animation rows")
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    for row in rows:
        if not all(math.isfinite(float(value)) for value in row):
            raise RuntimeError("refusing to write non-finite animation data")
        binary.extend(struct.pack("<" + "f" * width, *row))
    view: dict[str, Any] = {
        "buffer": 0,
        "byteOffset": offset,
        "byteLength": len(binary) - offset,
    }
    if target is not None:
        view["target"] = target
    view_index = len(document.setdefault("bufferViews", []))
    document["bufferViews"].append(view)
    accessor: dict[str, Any] = {
        "bufferView": view_index,
        "componentType": FLOAT_COMPONENT,
        "count": len(rows),
        "type": accessor_type,
    }
    if include_bounds:
        accessor["min"] = [min(row[index] for row in rows) for index in range(width)]
        accessor["max"] = [max(row[index] for row in rows) for index in range(width)]
    accessor_index = len(document.setdefault("accessors", []))
    document["accessors"].append(accessor)
    return accessor_index


def append_animation(
    document: dict[str, Any], binary: bytearray, spec: ClipSpec, tracks: list[Track]
) -> None:
    if not tracks:
        raise RuntimeError(f"cannot append empty animation {spec.name}")
    timeline = tracks[0].times
    if any(track.times != timeline for track in tracks):
        raise RuntimeError(f"clip {spec.name} tracks do not share one timeline")
    time_accessor = append_float_accessor(
        document,
        binary,
        [(value,) for value in timeline],
        "SCALAR",
        include_bounds=True,
    )
    names = node_name_map(document)
    samplers = []
    channels = []
    path_type = {"translation": "VEC3", "rotation": "VEC4", "scale": "VEC3"}
    for track in sorted(tracks, key=lambda value: (names[value.node_name], value.path)):
        output_accessor = append_float_accessor(
            document,
            binary,
            track.values,
            path_type[track.path],
        )
        sampler_index = len(samplers)
        samplers.append(
            {
                "input": time_accessor,
                "interpolation": "LINEAR",
                "output": output_accessor,
            }
        )
        channels.append(
            {
                "sampler": sampler_index,
                "target": {"node": names[track.node_name], "path": track.path},
            }
        )
    document.setdefault("animations", []).append(
        {
            "name": spec.name,
            "samplers": samplers,
            "channels": channels,
            "extras": {
                "semantic": spec.semantic,
                "loop": spec.loop,
                "sampleRate": tracks[0].times and round(1.0 / (tracks[0].times[1] - tracks[0].times[0]))
                if len(tracks[0].times) > 1 and tracks[0].times[1] > 0
                else None,
                "rootMotion": spec.translation_policy,
            },
        }
    )


def triangle_count(document: dict[str, Any]) -> int:
    total = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if int(primitive.get("mode", 4)) != 4:
                continue
            if "indices" in primitive:
                total += int(document["accessors"][primitive["indices"]]["count"]) // 3
            else:
                position = primitive.get("attributes", {}).get("POSITION")
                if position is not None:
                    total += int(document["accessors"][position]["count"]) // 3
    return total


def validate_output(
    document: dict[str, Any], binary: bytes, mesh_count: int, skin_joints: int
) -> dict[str, Any]:
    errors = []
    if len(document.get("meshes", [])) != mesh_count:
        errors.append("animation build changed mesh count")
    if len(document.get("skins", [])) != 1:
        errors.append("expected exactly one skin")
    elif len(document["skins"][0].get("joints", [])) != skin_joints:
        errors.append("animation build changed skin joint count")
    names = [animation.get("name") for animation in document.get("animations", [])]
    expected = [spec.name for spec in CLIPS]
    if names != expected:
        errors.append(f"animation order/name mismatch: {names}")
    target_names = node_name_map(document)
    for animation in document.get("animations", []):
        seen = set()
        for channel in animation.get("channels", []):
            target = channel["target"]
            name = document["nodes"][target["node"]].get("name")
            path = target["path"]
            key = (name, path)
            if key in seen:
                errors.append(f"duplicate track {animation.get('name')}:{name}.{path}")
            seen.add(key)
            if name == "Armature":
                errors.append(f"root object channel leaked into {animation.get('name')}")
            if path == "scale":
                errors.append(f"unsafe scale channel leaked into {animation.get('name')}:{name}")
            sampler = animation["samplers"][channel["sampler"]]
            times = [value[0] for value in read_accessor(document, binary, sampler["input"])]
            values = read_accessor(document, binary, sampler["output"])
            if len(times) != len(values) or any(right <= left for left, right in zip(times, times[1:])):
                errors.append(f"invalid sampler timeline in {animation.get('name')}")
            if path == "rotation":
                error = max(abs(math.sqrt(sum(value * value for value in row)) - 1.0) for row in values)
                if error > 2e-5:
                    errors.append(
                        f"non-unit quaternions in {animation.get('name')}:{name} ({error})"
                    )
    if not SECONDARY_BONES.issubset(target_names):
        errors.append("secondary hair/ear bones are missing")
    if any(helper in target_names for helper in REMOVED_HELPERS):
        errors.append("removed helper bones reappeared")
    triangles = triangle_count(document)
    if triangles >= 100000:
        errors.append(f"triangle ceiling exceeded: {triangles}")
    if errors:
        raise RuntimeError("output validation failed:\n- " + "\n- ".join(errors))
    return {
        "meshCountUnchanged": True,
        "skinJointCount": skin_joints,
        "triangleCount": triangles,
        "triangleCeiling": 100000,
        "animationNames": names,
        "rootObjectChannels": 0,
        "scaleChannels": 0,
        "secondaryBonesHeldAtBind": sorted(SECONDARY_BONES),
        "removedHelpersAbsent": sorted(REMOVED_HELPERS),
        "finiteUnitQuaternionTracks": True,
    }


def main() -> None:
    args = parse_args()
    if bpy.app.version < (5, 2, 0):
        raise RuntimeError(f"Blender 5.2+ is required, found {bpy.app.version_string}")
    if args.fps <= 0 or args.fps > 60 or 60 % args.fps != 0:
        raise RuntimeError("--fps must be a positive divisor of 60 no greater than 60")
    base_path = args.base_glb.resolve()
    if not base_path.is_file():
        raise RuntimeError(f"base GLB is missing: {base_path}")
    base_document, base_binary = read_glb(base_path)
    if base_document.get("animations"):
        raise RuntimeError("base GLB must be animation-free")
    target_names = node_name_map(base_document)
    missing_target = sorted((CORE_BONES | SECONDARY_BONES) - set(target_names))
    if missing_target:
        raise RuntimeError("base GLB is missing required bones: " + ", ".join(missing_target))
    if len(base_document.get("skins", [])) != 1:
        raise RuntimeError("base GLB must contain one skin")
    skin_joint_count = len(base_document["skins"][0].get("joints", []))
    if skin_joint_count != 28:
        raise RuntimeError(f"expected the rebuilt 28-bone skin, found {skin_joint_count}")
    mesh_count = len(base_document.get("meshes", []))
    sources = {
        spec.name: resolve_source(spec, args.character_root.resolve(), args.meshy_root.resolve())
        for spec in CLIPS
    }
    output_document = json.loads(json.dumps(base_document))
    output_binary = bytearray(base_binary)
    clip_reports = []
    with tempfile.TemporaryDirectory(prefix="punky-animation-") as temporary:
        temporary_root = Path(temporary)
        for index, spec in enumerate(CLIPS):
            source = sources[spec.name]
            source_glb = temporary_root / f"{index:02d}-{spec.name}.glb"
            blender_source = reset_and_export_source(source, spec.name, source_glb)
            source_document, source_binary = read_glb(source_glb)
            compatibility = rest_compatibility(source_document, base_document, target_names)
            tracks, details = process_clip(
                spec,
                source_document,
                source_binary,
                base_document,
                target_names,
                args.fps,
            )
            append_animation(output_document, output_binary, spec, tracks)
            clip_reports.append(
                {
                    "name": spec.name,
                    "semantic": spec.semantic,
                    "loop": spec.loop,
                    "sampleRate": args.fps,
                    "translationPolicy": spec.translation_policy,
                    "source": {
                        "path": str(source),
                        "bytes": source.stat().st_size,
                        "sha256": spec.sha256,
                    },
                    "blenderImport": blender_source,
                    "restCompatibility": compatibility,
                    **details,
                }
            )
            print(
                json.dumps(
                    {
                        "clip": spec.name,
                        "duration": details["duration"],
                        "samples": details["sampleCount"],
                        "channels": details["channelCount"],
                    }
                )
            )
    args.out_glb = args.out_glb.resolve()
    args.report = args.report.resolve()
    write_glb(args.out_glb, output_document, bytes(output_binary))
    verified_document, verified_binary = read_glb(args.out_glb)
    validation = validate_output(
        verified_document,
        verified_binary,
        mesh_count,
        skin_joint_count,
    )
    report = {
        "schemaVersion": 1,
        "generator": {
            "script": "tools/character-pipeline/extract_punky_animations.py",
            "blenderVersion": bpy.app.version_string,
            "sampleRate": args.fps,
        },
        "base": {
            "path": str(base_path),
            "bytes": base_path.stat().st_size,
            "sha256": sha256(base_path),
            "meshCount": mesh_count,
            "skinJointCount": skin_joint_count,
        },
        "clips": clip_reports,
        "output": {
            "path": str(args.out_glb),
            "bytes": args.out_glb.stat().st_size,
            "sha256": sha256(args.out_glb),
            "animationCount": len(verified_document.get("animations", [])),
            "animationBufferBytes": len(verified_binary) - len(base_binary),
        },
        "validation": validation,
        "notes": [
            "The output contains one copy of the canonical mesh and one 28-joint skin.",
            "World movement remains simulation-authored; Armature object tracks are excluded.",
            "Planar pelvis travel is detrended or the pelvis is locked according to clip semantics.",
            "The six secondary ponytail/ear joints stay at bind for runtime additive motion.",
            "All motion sources are owner-supplied Meshy FBXs and are provenance-pinned by SHA-256.",
        ],
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": "success", **report["output"], "validation": validation}, indent=2))


if __name__ == "__main__":
    main()
