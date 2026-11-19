"""Position-weld UV seams for animation while keeping each triangle's original atlas corners."""

import numpy as np


def isolate(draft, groups):
    faces = draft["tri"]
    faces = faces[np.isin(draft["group"][faces[:, 0]], groups)]
    corners = draft["uv"][faces].copy()
    used, indexed = np.unique(faces, return_inverse=True)
    _, unique, welded = np.unique(
        np.rint(draft["pos"][used] * 100000).astype(np.int32),
        axis=0,
        return_index=True,
        return_inverse=True,
    )
    f = welded.ravel()[indexed.ravel()].reshape(-1, 3)
    good = (f[:, 0] != f[:, 1]) & (f[:, 0] != f[:, 2]) & (f[:, 1] != f[:, 2])
    return (
        draft["pos"][used[unique]].astype(float),
        f[good],
        corners[good],
        draft["group"][used[unique]],
    )


def subdivide(p, faces, uv, labels):
    # Each new edge position stays on the same surface on either side of a UV seam.
    # Approximate the Loop limit without collapsing narrow sculpted peaks or free lip borders.
    n = len(p)
    edges = np.vstack([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    opposite = np.concatenate([faces[:, 2], faces[:, 0], faces[:, 1]])
    unique, inv, count = np.unique(
        np.sort(edges, axis=1), axis=0, return_inverse=True, return_counts=True
    )
    inv = inv.ravel()
    sums = np.zeros((len(unique), 3))
    np.add.at(sums, inv, p[opposite])
    mid = p[unique].mean(axis=1)
    smooth = count == 2
    mid[smooth] += 0.57 * (0.125 * sums[smooth] - 0.25 * mid[smooth])
    neighbor = np.zeros_like(p)
    degree = np.bincount(unique.ravel(), minlength=n)
    for i in (0, 1):
        np.add.at(neighbor, unique[:, i], p[unique[:, 1 - i]])
    old = p.copy()
    move = np.ones(n, dtype=bool)
    move[unique[~smooth].ravel()] = False
    old[move] += 0.115 * (neighbor[move] / degree[move, None] - old[move])
    a, b, c = faces.T
    ab, bc, ca = inv.reshape(3, -1) + n
    mesh_faces = np.concatenate(
        [np.stack(q, axis=1) for q in ((a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca))]
    )
    t0, t1, t2 = uv.transpose(1, 0, 2)
    h0, h1, h2 = (t0 + t1) * 0.5, (t1 + t2) * 0.5, (t2 + t0) * 0.5
    tex = np.concatenate(
        [np.stack(q, axis=1) for q in ((t0, h0, h2), (h0, t1, h1), (h2, h1, t2), (h0, h1, h2))]
    )
    return np.vstack((old, mid)), mesh_faces, tex, np.concatenate((labels, labels[unique[:, 0]]))


def slice_mouth(p, faces, uv, levels, edge_limit):
    """Follow the lip seam across real face triangles. Keep UV corner splits and paired margins."""
    pts = list(p)
    triangles = []
    texture = []
    split = {}
    seam_pairs = {}
    for face, tex in zip(faces, uv):
        vals = levels[face]
        if vals.min() >= 0 or vals.max() <= 0 or not edge_limit(p[face].mean(axis=0)):
            triangles.append(face)
            texture.append(tex)
            continue
        for sign in (-1, 1):
            polygon = []
            for j in range(3):
                k = (j + 1) % 3
                a, b = int(face[j]), int(face[k])
                if sign * vals[j] >= 0:
                    polygon.append((a, tex[j]))
                if vals[j] * vals[k] < 0:
                    t = vals[j] / (vals[j] - vals[k])
                    key = (min(a, b), max(a, b))
                    if (key, sign) not in split:
                        split[key, sign] = len(pts)
                        pts.append(p[a] + t * (p[b] - p[a]))
                    seam_pairs.setdefault(key, {})[sign] = split[key, sign]
                    polygon.append((split[key, sign], tex[j] + t * (tex[k] - tex[j])))
            for j in range(1, len(polygon) - 1):
                triple = [polygon[0], polygon[j], polygon[j + 1]]
                triangles.append([v[0] for v in triple])
                texture.append([v[1] for v in triple])
    return np.array(pts), np.array(triangles), np.array(texture), list(seam_pairs.values())


def refine(p, faces, uv, labels, selected):
    """Conforming local subdivision for moving eyelids, fingers and the lower face."""
    edge_map = {}
    pts = list(p)
    gs = list(labels)
    faces_out = []
    uv_out = []
    for face in faces[selected]:
        for j in range(3):
            a, b = int(face[j]), int(face[(j + 1) % 3])
            key = (min(a, b), max(a, b))
            if key not in edge_map:
                edge_map[key] = len(pts)
                pts.append(0.5 * (p[a] + p[b]))
                gs.append(labels[a])
    for face, tex in zip(faces, uv):
        verts = list(face)
        tc = list(tex)
        cut = []
        for j in range(3):
            a, b = int(face[j]), int(face[(j + 1) % 3])
            mid = edge_map.get((min(a, b), max(a, b)))
            cut.append(mid is not None)
            verts.append(mid)
            tc.append(0.5 * (tex[j] + tex[(j + 1) % 3]))
        k = sum(cut)
        if k == 0:
            groups = [(0, 1, 2)]
        elif k == 3:
            groups = [(0, 3, 5), (3, 1, 4), (5, 4, 2), (3, 4, 5)]
        elif k == 1:
            j = cut.index(True)
            a, b, c = j, (j + 1) % 3, (j + 2) % 3
            groups = [(a, 3 + j, c), (3 + j, b, c)]
        else:
            j = cut.index(False)
            a, b, c = j, (j + 1) % 3, (j + 2) % 3
            mb, mc = 3 + b, 3 + c
            groups = [(mc, mb, c), (a, b, mb), (a, mb, mc)]
        for idx in groups:
            faces_out.append([verts[j] for j in idx])
            uv_out.append([tc[j] for j in idx])
    return np.asarray(pts), np.asarray(faces_out), np.asarray(uv_out), np.asarray(gs)


def crop(p, faces, uv, labels, keep):
    use, inv = np.unique(faces[keep], return_inverse=True)
    return p[use], inv.reshape(-1, 3), uv[keep], labels[use]


def clip_height(p, faces, uv, labels, height, keep_above):
    """Cut closed anatomical sections with shared edge vertices, preserving the atlas corners."""
    pts = list(p)
    lab = list(labels)
    out = []
    texout = []
    seams = {}
    for face, tc in zip(faces, uv):
        diff = p[face, 1] - height
        if not keep_above:
            diff = -diff
        if diff.max() < 0:
            continue
        if diff.min() >= 0:
            out.append(face)
            texout.append(tc)
            continue
        poly = []
        for i in range(3):
            j = (i + 1) % 3
            a, b = int(face[i]), int(face[j])
            if diff[i] >= 0:
                poly.append((a, tc[i]))
            if diff[i] * diff[j] < 0:
                edge = (min(a, b), max(a, b))
                t = diff[i] / (diff[i] - diff[j])
                if edge not in seams:
                    seams[edge] = len(pts)
                    pts.append(p[a] + (p[b] - p[a]) * t)
                    lab.append(labels[a])
                poly.append((seams[edge], tc[i] + (tc[j] - tc[i]) * t))
        for j in range(1, len(poly) - 1):
            q = [poly[0], poly[j], poly[j + 1]]
            out.append([k for k, t in q])
            texout.append([t for k, t in q])
    out = np.array(out)
    return crop(np.array(pts), out, np.array(texout), np.array(lab), np.ones(len(out), bool))
