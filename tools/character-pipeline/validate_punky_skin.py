#!/usr/bin/env python3
"""Validate Punky Fox GLB skin continuity, influence count, and triangle budget."""

from __future__ import annotations

import argparse
from collections import defaultdict
import importlib.util
import json
import math
from pathlib import Path
import sys


HERE = Path(__file__).resolve().parent
ADAPTER = HERE.parent / "tripo-character" / "glb_rig_to_characterir.py"
spec = importlib.util.spec_from_file_location("glb_adapter", ADAPTER)
if spec is None or spec.loader is None:
    raise RuntimeError(f"cannot import {ADAPTER}")
adapter = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = adapter
spec.loader.exec_module(adapter)


def weighted_map(joints, weights):
    return {int(joint): float(weight) for joint, weight in zip(joints, weights) if weight > 1e-7}


def l1(left, right):
    keys = left.keys() | right.keys()
    return sum(abs(left.get(key, 0.0) - right.get(key, 0.0)) for key in keys)


def distance(left, right):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right)))


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    document, binary = adapter.read_glb(args.glb.resolve())
    if len(document.get("skins", [])) != 1:
        raise RuntimeError("expected exactly one skin")
    skin = document["skins"][0]
    names = [document["nodes"][index].get("name", f"joint-{index}") for index in skin["joints"]]
    secondary = {index for index, name in enumerate(names) if name.startswith(("Ponytail.", "Ear."))}

    primitives = []
    total_triangles = 0
    coincident_mismatches = []
    sharp_edges = []
    secondary_seams = []
    by_position = defaultdict(list)
    secondary_counts = defaultdict(int)
    max_influences = 0

    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            attributes = primitive["attributes"]
            positions = adapter.decode_accessor(document, binary, attributes["POSITION"], normalized=False)
            joints = adapter.decode_accessor(document, binary, attributes["JOINTS_0"], normalized=False)
            weights = adapter.decode_accessor(document, binary, attributes["WEIGHTS_0"])
            maps = [weighted_map(row_joints, row_weights) for row_joints, row_weights in zip(joints, weights)]
            for index, (position, influence) in enumerate(zip(positions, maps)):
                max_influences = max(max_influences, len(influence))
                key = tuple(round(value, 5) for value in position)
                by_position[key].append((len(primitives), index, influence))
                for joint in influence:
                    if joint in secondary:
                        secondary_counts[names[joint]] += 1
            if "indices" in primitive:
                raw_indices = adapter.decode_accessor(document, binary, primitive["indices"], normalized=False)
                indices = [int(row[0]) for row in raw_indices]
            else:
                indices = list(range(len(positions)))
            if len(indices) % 3:
                raise RuntimeError("triangle index stream is not divisible by three")
            total_triangles += len(indices) // 3
            for offset in range(0, len(indices), 3):
                triangle = indices[offset : offset + 3]
                secondary_total = [sum(maps[index].get(joint, 0.0) for joint in secondary) for index in triangle]
                if max(secondary_total) - min(secondary_total) > 0.48:
                    secondary_seams.append({
                        "primitive": len(primitives),
                        "triangle": offset // 3,
                        "vertices": triangle,
                        "positions": [positions[index] for index in triangle],
                        "secondaryWeights": secondary_total,
                    })
                for a, b in ((triangle[0], triangle[1]), (triangle[1], triangle[2]), (triangle[2], triangle[0])):
                    length = distance(positions[a], positions[b])
                    delta = l1(maps[a], maps[b])
                    if length < 0.018 and delta > 1.15:
                        sharp_edges.append({"primitive": len(primitives), "vertices": [a, b], "length": length, "weightL1": delta})
            primitives.append({"vertices": len(positions), "triangles": len(indices) // 3})

    for key, entries in by_position.items():
        if len(entries) < 2:
            continue
        baseline = entries[0]
        for entry in entries[1:]:
            delta = l1(baseline[2], entry[2])
            if delta > 0.025:
                coincident_mismatches.append({
                    "position": key,
                    "a": [baseline[0], baseline[1]],
                    "b": [entry[0], entry[1]],
                    "weightL1": delta,
                })

    report = {
        "schemaVersion": 1,
        "passed": (
            total_triangles < 100000
            and max_influences <= 4
            and not coincident_mismatches
            and not sharp_edges
            and len(secondary_seams) < 256
        ),
        "triangleCount": total_triangles,
        "triangleCeiling": 100000,
        "jointCount": len(names),
        "maxInfluences": max_influences,
        "secondaryVertexCounts": dict(sorted(secondary_counts.items())),
        "coincidentWeightMismatchCount": len(coincident_mismatches),
        "coincidentWeightMismatches": sorted(coincident_mismatches, key=lambda item: item["weightL1"], reverse=True)[:20],
        "secondarySeamTriangleCount": len(secondary_seams),
        "secondarySeamTriangles": secondary_seams[:20],
        "sharpShortEdgeCount": len(sharp_edges),
        "sharpShortEdges": sorted(sharp_edges, key=lambda item: item["weightL1"], reverse=True)[:20],
        "continuityPolicy": {
            "coincidentWeightMismatchMaximum": 0,
            "sharpShortEdgeMaximum": 0,
            "broadSecondaryGradientTriangleMaximum": 255,
            "note": "Broad gradients are permitted on long hair/ear triangles; short-edge and coincident-point discontinuities are not.",
        },
        "primitives": primitives,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
