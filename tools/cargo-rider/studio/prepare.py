"""Decode private Smart Mesh drafts without changing their UVs. Supply a directory of GLBs."""

import io
import json
import struct
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter


def unpack(path, output):
    data = path.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20 : 20 + size])
    offset = 28 + size
    views = doc["bufferViews"]

    def accessor(index):
        a = doc["accessors"][index]
        v = views[a["bufferView"]]
        dt = np.dtype({5121: "u1", 5123: "<u2", 5125: "<u4", 5126: "<f4"}[a["componentType"]])
        n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]
        return np.ndarray(
            (a["count"], n),
            dt,
            data,
            offset + v.get("byteOffset", 0) + a.get("byteOffset", 0),
            (v.get("byteStride", dt.itemsize * n), dt.itemsize),
        )

    (prim,) = doc["meshes"][0]["primitives"]
    pos = accessor(prim["attributes"]["POSITION"])
    tri = accessor(prim["indices"]).reshape(-1, 3)
    if len(tri) > 30000:
        raise ValueError(f"{path.name} exceeds the component budget")
    tex = accessor(prim["attributes"]["TEXCOORD_0"])
    _, inv = np.unique(np.rint(pos * 100000).astype(np.int32), axis=0, return_inverse=True)
    inv = inv.ravel()
    parent = np.arange(int(inv.max()) + 1)

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for a, b, c in inv[tri]:
        a, b, c = root(a), root(b), root(c)
        parent[b] = parent[c] = a
    labels = np.array([root(i) for i in range(len(parent))])[inv]
    ids, count = np.unique(labels, return_counts=True)
    order = ids[np.argsort(-count)]
    group = np.zeros(len(pos), dtype=np.int32)
    for index, label in enumerate(order):
        group[labels == label] = index
    np.savez_compressed(
        output / (path.stem + ".npz"),
        pos=pos,
        norm=accessor(prim["attributes"]["NORMAL"]),
        uv=tex,
        tri=tri,
        group=group,
    )
    im = doc["images"][0]
    v = views[im["bufferView"]]
    pixels = data[offset + v["byteOffset"] : offset + v["byteOffset"] + v["byteLength"]]
    image = Image.open(io.BytesIO(pixels)).convert("RGB")
    image.save(output / (path.stem + "-color.jpg"), quality=97, subsampling=0)
    bake_relief(image, output, path.stem)


def bake_relief(image, output, name):
    # Follow the photographed shafts, stitch runs and shell ridges across each atlas island.
    # The fine surface contrast is band limited so an albedo seam cannot become a deep cut.
    image = image.resize((1536, 1536), Image.Resampling.LANCZOS)
    rgb = np.asarray(image, dtype=np.float32) / 255
    lum = image.convert("L")
    detail = np.array(lum.filter(ImageFilter.GaussianBlur(0.65)), dtype=np.float32) / 255
    low = np.array(lum.filter(ImageFilter.GaussianBlur(3.8)), dtype=np.float32) / 255
    height = np.tanh((detail - low) * 9) * 0.40
    y, x = np.indices(height.shape, dtype=np.float32)
    # Subtle yarn relief only on violet fabric, excluding vivid rubber and dark closures.
    violet = np.clip((rgb[:, :, 2] - rgb[:, :, 1] - 0.05) * 3, 0, 1) * np.clip(
        (rgb[:, :, 2] - 0.18) * 3, 0, 1
    )
    if name == "body":
        height += violet * (0.047 * np.sin(x * 1.9 + y * 0.62) + 0.026 * np.sin(y * 1.8 - x * 0.82))
    dy, dx = np.gradient(height)
    # Image rows run downward while glTF tangent-space +V is upward in Blender.
    normal = np.dstack((-dx, dy, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    Image.fromarray(np.rint((normal * 0.5 + 0.5) * 255).astype("uint8")).save(
        output / (name + "-normal.png"), optimize=True
    )
    # Material response multiplier used with separate per-surface roughness in Blender.
    pixels = np.clip(0.92 + 0.07 * (detail - 0.52) + 0.26 * (detail - low), 0.73, 1)
    Image.fromarray(np.rint(255 * pixels).astype("uint8")).save(
        output / (name + "-rough.png"), optimize=True
    )


if __name__ == "__main__":
    source, destination = map(Path, sys.argv[1:3])
    destination.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[3:] or ("neutral", "bust", "body"):
        unpack(source / (name + ".glb"), destination)
        if name == "bust":
            from hair_paint import paint

            paint(destination)
        if name == "neutral":
            from eye_paint import paint_eye, paint_skin

            paint_eye(destination)
            paint_skin(destination)
        if name == "body":
            from tank_back import make_maps

            make_maps(destination)
