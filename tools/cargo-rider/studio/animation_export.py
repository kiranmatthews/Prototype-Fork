"""Embed the editable facial performances as independent glTF morph-weight clips."""

import hashlib
import json
import struct
import math

import numpy as np


def sample(points, frames):
    xy = np.array(points, dtype=float)
    if len(xy) == 1:
        return np.full_like(frames, xy[0, 1], dtype=float)
    i = np.searchsorted(xy[:, 0], frames, side="right") - 1
    i = np.clip(i, 0, len(xy) - 2)
    a, b = xy[i], xy[i + 1]
    u = np.clip((frames - a[:, 0]) / (b[:, 0] - a[:, 0]), 0.0, 1.0)
    return a[:, 1] + (b[:, 1] - a[:, 1]) * u * u * (3 - 2 * u)


def head_quaternions(tracks, frames, blender_axes=False):
    from mathutils import Quaternion

    yaw, pitch, roll = [sample(tracks[axis], frames) for axis in ("yaw", "pitch", "roll")]
    up = (0, 0, 1) if blender_axes else (0, 1, 0)
    forward = (0, -1, 0) if blender_axes else (0, 0, 1)
    return [
        Quaternion(up, math.radians(y))
        @ Quaternion((1, 0, 0), math.radians(p))
        @ Quaternion(forward, math.radians(r))
        for y, p, r in zip(yaw, pitch, roll)
    ]


def read_glb(path):
    with path.open("rb") as f:
        magic, version, total = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF" and version == 2 and total == path.stat().st_size
        n, kind = struct.unpack("<I4s", f.read(8))
        assert kind == b"JSON"
        doc = json.loads(f.read(n))
        n, kind = struct.unpack("<I4s", f.read(8))
        assert kind == b"BIN\x00"
        return doc, bytearray(f.read(n))


def save_glb(path, doc, blob):
    blob.extend(bytes(-len(blob) % 4))
    doc["buffers"][0]["byteLength"] = len(blob)
    desc = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode()
    desc += b" " * (-len(desc) % 4)
    with path.open("wb") as f:
        f.write(struct.pack("<4sIII4s", b"glTF", 2, 28 + len(desc) + len(blob), len(desc), b"JSON"))
        f.write(desc)
        f.write(struct.pack("<I4s", len(blob), b"BIN\x00"))
        f.write(blob)


def add_animations(path, sheet):
    doc, blob = read_glb(path)
    cache = {}

    def view(data):
        blob.extend(bytes(-len(blob) % 4))
        index = len(doc["bufferViews"])
        doc["bufferViews"].append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)})
        blob.extend(data)
        return index

    def accessor(values, is_time=False, rotation=False):
        arr = np.ascontiguousarray(values, dtype="<f4").ravel()
        key = (bool(is_time), rotation, len(arr), hashlib.sha256(arr.tobytes()).digest())
        if key in cache:
            return cache[key]
        item = {"componentType": 5126, "count": len(arr), "type": "SCALAR"}
        if rotation:
            item.update(count=len(arr) // 4, type="VEC4")
        if is_time:
            item.update(min=[float(arr[0])], max=[float(arr[-1])])
        ix = np.flatnonzero(arr)
        dtype, ctype = (
            ("u1", 5121)
            if len(arr) <= 256
            else ("<u2", 5123) if len(arr) <= 65536 else ("<u4", 5125)
        )
        if (
            not is_time
            and not rotation
            and len(ix) * (4 + np.dtype(dtype).itemsize) < arr.nbytes * 0.88
        ):
            item["sparse"] = {
                "count": len(ix),
                "indices": {"bufferView": view(ix.astype(dtype).tobytes()), "componentType": ctype},
                "values": {"bufferView": view(arr[ix].tobytes())},
            }
        else:
            item["bufferView"] = view(arr.tobytes())
        index = len(doc["accessors"])
        doc["accessors"].append(item)
        cache[key] = index
        return index

    doc["animations"] = []
    for name, take in sheet["takes"].items():
        frames = np.arange(take["frames"] + 1)
        clock = accessor(frames / sheet["fps"], True)
        channels = {k: sample(v, frames) for k, v in take["tracks"].items()}
        for side in (".L", ".R"):
            if "Blink" + side in channels:
                blink = channels["Blink" + side]
                channels["LidArc" + side] = 4 * blink * (1 - blink)
                if "LidAngle" + side in channels:
                    channels["LidAngle" + side] *= 1 - blink
        anim = {
            "name": name,
            "channels": [],
            "samplers": [],
            "extras": {"fps": sheet["fps"], "markers": take["markers"], "apex": take["apex"]},
        }
        for i, node in enumerate(doc["nodes"]):
            if "mesh" not in node:
                continue
            names = doc["meshes"][node["mesh"]].get("extras", {}).get("targetNames", [])
            rows = [(j, channels[key]) for j, key in enumerate(names) if key in channels]
            if not rows:
                continue
            data = np.zeros((len(frames), len(names)), dtype="<f4")
            for j, values in rows:
                data[:, j] = values
            if not np.any(data):
                continue
            assert np.max(abs(data[[0, -1]])) < 1e-6, (name, node["name"])
            output = accessor(data)
            sampler = len(anim["samplers"])
            anim["channels"].append({"sampler": sampler, "target": {"node": i, "path": "weights"}})
            anim["samplers"].append({"input": clock, "output": output, "interpolation": "LINEAR"})
        if "head" in take:
            from mathutils import Quaternion

            nodes = doc["nodes"]
            parents = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
            head = next(i for i, n in enumerate(nodes) if n["name"] == "head")

            def rotation(i):
                x, y, z, w = nodes[i].get("rotation", (0, 0, 0, 1))
                return Quaternion((w, x, y, z))

            world = rotation(head)
            parent = head
            while parent in parents:
                parent = parents[parent]
                world = rotation(parent) @ world
            baseline = rotation(head)
            local = [
                baseline @ world.inverted() @ q @ world
                for q in head_quaternions(take["head"], frames)
            ]
            samples = np.array([(q.x, q.y, q.z, q.w) for q in local])
            anim["channels"].append(
                {"sampler": len(anim["samplers"]), "target": {"node": head, "path": "rotation"}}
            )
            anim["samplers"].append(
                {
                    "input": clock,
                    "output": accessor(samples, rotation=True),
                    "interpolation": "LINEAR",
                }
            )
        if not anim["channels"]:
            raise ValueError(name + " has no bound tracks")
        doc["animations"].append(anim)
    save_glb(path, doc, blob)
