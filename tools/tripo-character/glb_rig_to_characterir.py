#!/usr/bin/env python3
"""Extract a Tripo/Mixamo GLB rig into img2threejs validation artifacts.

This is an evidence adapter, not a generic auto-rigger and not a complete
CharacterIR compiler. It preserves the source skeleton, packed skin weights,
and animation channels, maps only explicit Mixamo aliases, and fails on input
that would otherwise be silently misrepresented.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
from typing import Any, Optional


COMPONENTS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_WIDTH = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}

MIXAMO_ALIASES = {
    "hips": "pelvis",
    "spine": "spine",
    "spine1": "chest",
    "spine2": "upper-chest",
    "neck": "neck",
    "head": "head",
    "leftshoulder": "left-clavicle",
    "leftarm": "left-shoulder",
    "leftforearm": "left-elbow",
    "lefthand": "left-hand",
    "rightshoulder": "right-clavicle",
    "rightarm": "right-shoulder",
    "rightforearm": "right-elbow",
    "righthand": "right-hand",
    "leftupleg": "left-hip",
    "leftleg": "left-knee",
    "leftfoot": "left-ankle",
    "lefttoebase": "left-toes",
    "rightupleg": "right-hip",
    "rightleg": "right-knee",
    "rightfoot": "right-ankle",
    "righttoebase": "right-toes",
}


class AdapterError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise AdapterError("input is not a GLB 2.0 file (missing glTF magic)")
    version, declared = struct.unpack_from("<II", data, 4)
    if version != 2:
        raise AdapterError(f"unsupported GLB version {version}")
    if declared != len(data):
        raise AdapterError(f"GLB declared length {declared} does not match {len(data)} bytes")
    offset = 12
    document: Optional[dict[str, Any]] = None
    binary = b""
    while offset + 8 <= len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset : offset + length]
        offset += length
        if len(payload) != length:
            raise AdapterError("truncated GLB chunk")
        if kind == 0x4E4F534A:
            document = json.loads(payload.rstrip(b" \t\r\n\x00").decode("utf-8"))
        elif kind == 0x004E4942:
            binary = payload
    if not isinstance(document, dict):
        raise AdapterError("GLB has no JSON chunk")
    if not binary:
        raise AdapterError("GLB has no BIN chunk")
    return document, binary


def normalize_component(value: float, component_type: int) -> float:
    if component_type == 5120:
        return max(-1.0, value / 127.0)
    if component_type == 5121:
        return value / 255.0
    if component_type == 5122:
        return max(-1.0, value / 32767.0)
    if component_type == 5123:
        return value / 65535.0
    if component_type == 5125:
        return value / 4294967295.0
    return float(value)


def decode_accessor(
    document: dict[str, Any], binary: bytes, index: int, *, normalized: bool = True
) -> list[list[float]]:
    accessors = document.get("accessors", [])
    views = document.get("bufferViews", [])
    if not 0 <= index < len(accessors):
        raise AdapterError(f"accessor index out of range: {index}")
    accessor = accessors[index]
    if "sparse" in accessor:
        raise AdapterError(f"sparse accessor {index} is not supported")
    view_index = accessor.get("bufferView")
    if not isinstance(view_index, int) or not 0 <= view_index < len(views):
        raise AdapterError(f"accessor {index} has no readable bufferView")
    view = views[view_index]
    if view.get("buffer", 0) != 0:
        raise AdapterError("external glTF buffers are not supported in GLB mode")
    component_type = accessor.get("componentType")
    if component_type not in COMPONENTS:
        raise AdapterError(f"unsupported accessor component type {component_type}")
    value_type = accessor.get("type")
    width = TYPE_WIDTH.get(value_type)
    if width is None:
        raise AdapterError(f"unsupported accessor type {value_type}")
    count = accessor.get("count")
    if not isinstance(count, int) or count < 0:
        raise AdapterError(f"accessor {index} has invalid count")
    code, size = COMPONENTS[component_type]
    packed = width * size
    stride = view.get("byteStride", packed)
    if not isinstance(stride, int) or stride < packed:
        raise AdapterError(f"bufferView {view_index} has invalid byteStride")
    start = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    end = start + (count - 1) * stride + packed if count else start
    if start < 0 or end > len(binary):
        raise AdapterError(f"accessor {index} reads outside the BIN chunk")
    rows: list[list[float]] = []
    use_normalization = bool(accessor.get("normalized")) and normalized
    for item in range(count):
        values = struct.unpack_from("<" + code * width, binary, start + item * stride)
        rows.append(
            [
                normalize_component(float(value), component_type)
                if use_normalization
                else float(value)
                for value in values
            ]
        )
    return rows


def identity() -> list[list[float]]:
    return [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]]


def multiply(left: list[list[float]], right: list[list[float]]) -> list[list[float]]:
    return [
        [sum(left[row][k] * right[k][column] for k in range(4)) for column in range(4)]
        for row in range(4)
    ]


def inverse(matrix: list[list[float]]) -> list[list[float]]:
    augmented = [row[:] + eye for row, eye in zip(matrix, identity())]
    for column in range(4):
        pivot = max(range(column, 4), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-12:
            raise AdapterError("joint transform matrix is singular")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        scale = augmented[column][column]
        augmented[column] = [value / scale for value in augmented[column]]
        for row in range(4):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [
                value - factor * source
                for value, source in zip(augmented[row], augmented[column])
            ]
    return [row[4:] for row in augmented]


def node_matrix(node: dict[str, Any]) -> list[list[float]]:
    raw = node.get("matrix")
    if isinstance(raw, list):
        if len(raw) != 16 or not all(isinstance(value, (int, float)) for value in raw):
            raise AdapterError("node matrix must contain 16 finite numbers")
        # glTF stores matrices column-major; the payload validator consumes row-major.
        return [[float(raw[column * 4 + row]) for column in range(4)] for row in range(4)]
    translation = node.get("translation", [0.0, 0.0, 0.0])
    rotation = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    scale = node.get("scale", [1.0, 1.0, 1.0])
    if len(translation) != 3 or len(rotation) != 4 or len(scale) != 3:
        raise AdapterError("node TRS has the wrong tuple length")
    tx, ty, tz = map(float, translation)
    x, y, z, w = map(float, rotation)
    sx, sy, sz = map(float, scale)
    length = math.sqrt(x * x + y * y + z * z + w * w)
    if length <= 1e-12:
        raise AdapterError("node quaternion has zero length")
    x, y, z, w = x / length, y / length, z / length, w / length
    xx, yy, zz = x * x, y * y, z * z
    xy, xz, yz = x * y, x * z, y * z
    xw, yw, zw = x * w, y * w, z * w
    return [
        [(1 - 2 * (yy + zz)) * sx, (2 * (xy - zw)) * sy, (2 * (xz + yw)) * sz, tx],
        [(2 * (xy + zw)) * sx, (1 - 2 * (xx + zz)) * sy, (2 * (yz - xw)) * sz, ty],
        [(2 * (xz - yw)) * sx, (2 * (yz + xw)) * sy, (1 - 2 * (xx + yy)) * sz, tz],
        [0.0, 0.0, 0.0, 1.0],
    ]


def matrix_quaternion(matrix: list[list[float]]) -> list[float]:
    # Remove column scale before extracting the rotation.
    scales = [math.sqrt(sum(matrix[row][column] ** 2 for row in range(3))) for column in range(3)]
    if any(scale <= 1e-12 for scale in scales):
        raise AdapterError("joint transform contains zero scale")
    m = [[matrix[row][column] / scales[column] for column in range(3)] for row in range(3)]
    trace = m[0][0] + m[1][1] + m[2][2]
    if trace > 0:
        s = math.sqrt(trace + 1.0) * 2
        w = 0.25 * s
        x = (m[2][1] - m[1][2]) / s
        y = (m[0][2] - m[2][0]) / s
        z = (m[1][0] - m[0][1]) / s
    elif m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2
        w = (m[2][1] - m[1][2]) / s
        x = 0.25 * s
        y = (m[0][1] + m[1][0]) / s
        z = (m[0][2] + m[2][0]) / s
    elif m[1][1] > m[2][2]:
        s = math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2
        w = (m[0][2] - m[2][0]) / s
        x = (m[0][1] + m[1][0]) / s
        y = 0.25 * s
        z = (m[1][2] + m[2][1]) / s
    else:
        s = math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2
        w = (m[1][0] - m[0][1]) / s
        x = (m[0][2] + m[2][0]) / s
        y = (m[1][2] + m[2][1]) / s
        z = 0.25 * s
    length = math.sqrt(x * x + y * y + z * z + w * w)
    return [x / length, y / length, z / length, w / length]


def flatten(matrix: list[list[float]]) -> list[float]:
    return [value for row in matrix for value in row]


def source_name(node: dict[str, Any], index: int) -> str:
    name = node.get("name")
    return name.strip() if isinstance(name, str) and name.strip() else f"joint-{index}"


def alias_for(name: str) -> Optional[str]:
    token = name.split(":")[-1]
    token = re_token(token)
    if token.startswith("mixamorig"):
        token = token[len("mixamorig") :]
    return MIXAMO_ALIASES.get(token)


def re_token(name: str) -> str:
    return "".join(character.lower() for character in name if character.isalnum())


def extract(path: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    document, binary = read_glb(path)
    nodes = document.get("nodes", [])
    skins = document.get("skins", [])
    meshes = document.get("meshes", [])
    if not isinstance(nodes, list) or not isinstance(skins, list) or not isinstance(meshes, list):
        raise AdapterError("GLB nodes/skins/meshes must be arrays")

    node_parents: dict[int, int] = {}
    for parent, node in enumerate(nodes):
        for child in node.get("children", []):
            if child in node_parents:
                raise AdapterError(f"node {child} has multiple parents")
            node_parents[int(child)] = parent

    local = [node_matrix(node) for node in nodes]
    world_cache: dict[int, list[list[float]]] = {}

    def world(index: int, stack: Optional[set[int]] = None) -> list[list[float]]:
        if index in world_cache:
            return world_cache[index]
        stack = set() if stack is None else stack
        if index in stack:
            raise AdapterError("node hierarchy contains a cycle")
        stack.add(index)
        parent = node_parents.get(index)
        value = local[index] if parent is None else multiply(world(parent, stack), local[index])
        world_cache[index] = value
        stack.remove(index)
        return value

    used_skin_indices = {
        int(node["skin"])
        for node in nodes
        if isinstance(node, dict) and isinstance(node.get("skin"), int)
    }
    if len(used_skin_indices) != 1:
        raise AdapterError(f"expected exactly one used skin, found {sorted(used_skin_indices)}")
    skin_index = next(iter(used_skin_indices))
    if not 0 <= skin_index < len(skins):
        raise AdapterError("node references an unknown skin")
    skin = skins[skin_index]
    joint_nodes = [int(value) for value in skin.get("joints", [])]
    if not joint_nodes or any(index < 0 or index >= len(nodes) for index in joint_nodes):
        raise AdapterError("skin has no valid joints")
    joint_set = set(joint_nodes)

    parent_joint: dict[int, Optional[int]] = {}
    for joint in joint_nodes:
        ancestor = node_parents.get(joint)
        while ancestor is not None and ancestor not in joint_set:
            ancestor = node_parents.get(ancestor)
        parent_joint[joint] = ancestor
    roots = [joint for joint in joint_nodes if parent_joint[joint] is None]
    if len(roots) != 1:
        raise AdapterError(f"skin must reduce to one root joint, found {len(roots)}")

    children: dict[int, list[int]] = {joint: [] for joint in joint_nodes}
    for joint, parent in parent_joint.items():
        if parent is not None:
            children[parent].append(joint)
    order: list[int] = []

    def visit(joint: int) -> None:
        order.append(joint)
        for child in sorted(children[joint], key=lambda item: source_name(nodes[item], item)):
            visit(child)

    visit(roots[0])
    if set(order) != joint_set:
        raise AdapterError("not every skin joint is reachable from the root")
    ordered_index = {joint: index for index, joint in enumerate(order)}
    skin_slot_to_ordered = {
        slot: ordered_index[joint] for slot, joint in enumerate(joint_nodes)
    }

    payload_indices: list[list[int]] = []
    payload_weights: list[list[float]] = []
    skinned_primitive_count = 0
    for node in nodes:
        if node.get("skin") != skin_index or not isinstance(node.get("mesh"), int):
            continue
        mesh_index = int(node["mesh"])
        if not 0 <= mesh_index < len(meshes):
            raise AdapterError("skinned node references an unknown mesh")
        for primitive in meshes[mesh_index].get("primitives", []):
            attributes = primitive.get("attributes", {})
            if "JOINTS_0" not in attributes or "WEIGHTS_0" not in attributes:
                raise AdapterError("every primitive under the used skin needs JOINTS_0 and WEIGHTS_0")
            joints = decode_accessor(document, binary, int(attributes["JOINTS_0"]), normalized=False)
            weights = decode_accessor(document, binary, int(attributes["WEIGHTS_0"]), normalized=True)
            if len(joints) != len(weights):
                raise AdapterError("JOINTS_0 and WEIGHTS_0 vertex counts differ")
            skinned_primitive_count += 1
            for vertex, (joint_row, weight_row) in enumerate(zip(joints, weights)):
                if len(joint_row) != 4 or len(weight_row) != 4:
                    raise AdapterError("skin attributes must have exactly four slots")
                mapped: list[int] = []
                for raw in joint_row:
                    slot = int(raw)
                    if slot not in skin_slot_to_ordered:
                        raise AdapterError(f"JOINTS_0[{vertex}] references unknown skin slot {slot}")
                    mapped.append(skin_slot_to_ordered[slot])
                clean = [float(value) for value in weight_row]
                if any(not math.isfinite(value) or value < 0 for value in clean):
                    raise AdapterError("skin weights must be finite and non-negative")
                total = sum(clean)
                if total <= 1e-12:
                    raise AdapterError("skin vertex has zero total weight")
                payload_indices.append(mapped)
                payload_weights.append([value / total for value in clean])
    if skinned_primitive_count == 0:
        raise AdapterError("skin is declared but no skinned mesh primitive was found")

    names = [source_name(nodes[joint], joint) for joint in order]
    semantic_ids: list[str] = []
    used_ids: set[str] = set()
    unmapped: list[str] = []
    for name in names:
        candidate = alias_for(name)
        if candidate is None:
            unmapped.append(name)
            candidate = "source-" + re_token(name)
        if candidate in used_ids:
            candidate += "-" + str(len(used_ids))
        used_ids.add(candidate)
        semantic_ids.append(candidate)

    parents: list[Optional[int]] = []
    matrices: list[list[float]] = []
    positions: list[list[float]] = []
    joints_seed: list[dict[str, Any]] = []
    for index, joint in enumerate(order):
        parent_node = parent_joint[joint]
        parent = ordered_index[parent_node] if parent_node is not None else None
        parents.append(parent)
        joint_world = world(joint)
        relative = joint_world if parent_node is None else multiply(inverse(world(parent_node)), joint_world)
        matrices.append(flatten(relative))
        position = [joint_world[0][3], joint_world[1][3], joint_world[2][3]]
        positions.append(position)
        joints_seed.append(
            {
                "id": semantic_ids[index],
                "sourceName": names[index],
                "parentId": semantic_ids[parent] if parent is not None else None,
                "role": "mapped-mixamo" if alias_for(names[index]) else "unmapped-source-joint",
                "restPosition": position,
                "restRotation": matrix_quaternion(relative),
            }
        )

    animation_evidence: list[dict[str, Any]] = []
    scale_channels: list[str] = []
    for animation_index, animation in enumerate(document.get("animations", [])):
        samplers = animation.get("samplers", [])
        channels_out: list[dict[str, Any]] = []
        duration = 0.0
        for channel in animation.get("channels", []):
            sampler_index = channel.get("sampler")
            if not isinstance(sampler_index, int) or not 0 <= sampler_index < len(samplers):
                raise AdapterError("animation channel references an unknown sampler")
            sampler = samplers[sampler_index]
            target = channel.get("target", {})
            target_node = target.get("node")
            path_name = target.get("path")
            if path_name == "scale":
                label = f"animation[{animation_index}] node {target_node}"
                scale_channels.append(label)
                continue
            if path_name not in {"rotation", "translation"}:
                raise AdapterError(f"unsupported animation target path {path_name}")
            if target_node not in ordered_index:
                raise AdapterError("animation targets a node outside the extracted skeleton")
            times = [row[0] for row in decode_accessor(document, binary, int(sampler["input"]))]
            values = decode_accessor(document, binary, int(sampler["output"]))
            if times:
                duration = max(duration, max(times))
            source = source_name(nodes[target_node], int(target_node))
            channels_out.append(
                {
                    "target": semantic_ids[ordered_index[int(target_node)]],
                    "sourceTarget": source,
                    "property": "position" if path_name == "translation" else "rotation-quaternion",
                    "interpolation": sampler.get("interpolation", "LINEAR"),
                    "times": times,
                    "values": values,
                }
            )
        animation_evidence.append(
            {
                "id": animation.get("name") or f"clip-{animation_index}",
                "duration": duration,
                "channels": channels_out,
            }
        )
    if scale_channels:
        raise AdapterError(
            "scale animation channels cannot be represented safely in the CharacterIR seed: "
            + ", ".join(scale_channels)
        )

    source = {
        "path": str(path.resolve()),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "asset": document.get("asset", {}),
    }
    payload = {
        "schemaVersion": 1,
        "coordinateSystem": {"up": "Y", "handedness": "right", "unit": "meter"},
        "joints": positions,
        "parents": parents,
        "names": semantic_ids,
        "matrix_local": matrices,
        "skinIndex": payload_indices,
        "skinWeight": payload_weights,
        "provenance": {"kind": "external-rig-evidence", "source": source},
    }

    chains = []
    chain_specs = {
        "spine": ["pelvis", "spine", "chest", "upper-chest", "neck", "head"],
        "left-arm": ["left-clavicle", "left-shoulder", "left-elbow", "left-hand"],
        "right-arm": ["right-clavicle", "right-shoulder", "right-elbow", "right-hand"],
        "left-leg": ["left-hip", "left-knee", "left-ankle", "left-toes"],
        "right-leg": ["right-hip", "right-knee", "right-ankle", "right-toes"],
    }
    for chain_id, candidate in chain_specs.items():
        present = [joint for joint in candidate if joint in used_ids]
        if len(present) >= 2:
            chains.append({"id": chain_id, "joints": present, "role": chain_id})

    seed = {
        "schemaVersion": 1,
        "kind": "characterir-authoring-seed",
        "meta": {
            "name": path.stem,
            "version": "tripo-glb-evidence-v1",
            "sourceRefs": [source],
            "assumptions": [
                "glTF is Y-up and right-handed",
                "character front is provisionally +Z until browser review",
                "Mixamo aliases are explicit; unmapped source joints remain unmapped",
            ],
            "nonGoals": [
                "complete CharacterIR",
                "automatic semantic surface decomposition",
                "validated deformation quality",
                "secondary cloth, hair, tail, prop, or clearance corrections",
            ],
        },
        "coordinateSystem": {
            "up": "+Y",
            "front": "+Z",
            "lateral": "X",
            "groundY": 0,
            "leftSign": 1,
            "frontRequiresVisualConfirmation": True,
        },
        "rigGraph": {
            "joints": joints_seed,
            "chains": chains,
            "constraints": [],
            "effectors": [],
            "twistSystems": [],
            "drivers": [],
            "ikChains": [],
        },
        "deformationGraph": {
            "skinning": {"strategy": "manual-source-evidence", "maxInfluences": 4, "normalize": True},
            "rigPayload": "rig-payload.json",
        },
        "animationEvidence": animation_evidence,
        "validationRequired": [
            "img2threejs rig-payload structural gate",
            "bind-pose vertex preservation",
            "joint-loop topology",
            "per-phase self-intersection and penetration",
            "front, 40-degree and 90-degree full-cycle browser review",
        ],
    }
    report = {
        "schemaVersion": 1,
        "passed": True,
        "source": source,
        "skinIndex": skin_index,
        "jointCount": len(order),
        "vertexCount": len(payload_indices),
        "skinnedPrimitiveCount": skinned_primitive_count,
        "animationCount": len(animation_evidence),
        "semanticAliases": dict(zip(names, semantic_ids)),
        "unmappedJoints": unmapped,
        "warnings": [
            "This seed is not a complete CharacterIR.",
            "Source skin weights are evidence, not proof of deformation quality.",
            "Source quaternion tracks need rest-basis retargeting before code-native CharacterActionSpec emission.",
        ],
    }
    return payload, seed, report


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", type=Path)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    path = args.glb.expanduser().resolve()
    if not path.is_file():
        raise AdapterError(f"GLB does not exist: {path}")
    payload, seed, report = extract(path)
    output = args.out_dir.expanduser().resolve()
    write_json(output / "rig-payload.json", payload)
    write_json(output / "characterir-authoring-seed.json", seed)
    write_json(output / "glb-rig-report.json", report)
    print(json.dumps({"status": "success", "outDir": str(output), **report}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except AdapterError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(2)
