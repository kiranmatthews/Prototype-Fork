#!/usr/bin/env python3
"""Fit a 2D review-render silhouette to the reference for camera diagnosis only."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


IMG2THREEJS = Path.home() / ".codex" / "skills" / "img2threejs"
sys.path.insert(0, str(IMG2THREEJS / "forge" / "stage4_review"))
from diagnose_render import bbox_of, load_mask  # noqa: E402


def transformed_indices(points, sx, sy, tx, ty, cx, cy, size=224):
    result = set()
    for x, y in points:
        dx = int(round((x - cx) * sx + cx + tx))
        dy = int(round((y - cy) * sy + cy + ty))
        if 0 <= dx < size and 0 <= dy < size:
            result.add(dy * size + dx)
    return result


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("render", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    ref_mask, ref_warnings = load_mask(args.reference)
    render_mask, render_warnings = load_mask(args.render)
    ref = {index for index, keep in enumerate(ref_mask) if keep}
    points = [(index % 224, index // 224) for index, keep in enumerate(render_mask) if keep]
    rbox = bbox_of(ref_mask)
    dbox = bbox_of(render_mask)
    sx0 = rbox[2] / max(1, dbox[2])
    sy0 = rbox[3] / max(1, dbox[3])
    rcx = rbox[0] + (rbox[2] - 1) / 2
    rcy = rbox[1] + (rbox[3] - 1) / 2
    dcx = dbox[0] + (dbox[2] - 1) / 2
    dcy = dbox[1] + (dbox[3] - 1) / 2
    tx0 = rcx - dcx
    ty0 = rcy - dcy
    best = None
    for sx_step in range(-2, 3):
        sx = sx0 + sx_step * 0.015
        for sy_step in range(-2, 3):
            sy = sy0 + sy_step * 0.015
            for tx_step in range(-2, 3):
                tx = tx0 + tx_step
                for ty_step in range(-2, 3):
                    ty = ty0 + ty_step
                    transformed = transformed_indices(points, sx, sy, tx, ty, dcx, dcy)
                    union = len(ref | transformed)
                    iou = len(ref & transformed) / union if union else 0.0
                    candidate = (iou, sx, sy, tx, ty)
                    if best is None or candidate > best:
                        best = candidate
    report = {
        "schemaVersion": 1,
        "referenceBBox": rbox,
        "renderBBox": dbox,
        "referenceWarnings": ref_warnings,
        "renderWarnings": render_warnings,
        "bboxFit": {"scaleX": sx0, "scaleY": sy0, "translateX": tx0, "translateY": ty0},
        "best": {"iou": best[0], "scaleX": best[1], "scaleY": best[2], "translateX": best[3], "translateY": best[4]},
        "note": "2D diagnostic only; use the result to adjust review camera/framing, never to deform the production mesh.",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
