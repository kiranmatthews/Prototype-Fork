"""Twelve modeled cowries with recessed lips around a continuous cotton cord."""

import numpy as np


def build(put, lib):
    vertices = []
    faces = []
    ink = []
    slit_faces = []
    n = 12
    lat = 16
    around = 16
    for j in range(n):
        a = 2 * np.pi * j / n + 0.11
        out = np.array([np.sin(a), 0, np.cos(a)])
        tan = np.array([np.cos(a), 0, -np.sin(a)])
        up = np.array([0.0, 1.0, 0.0])
        roll = 0.14 * np.sin(j * 2.37)
        along = np.cos(roll) * tan + np.sin(roll) * up
        vert = -np.sin(roll) * tan + np.cos(roll) * up
        c = np.array([0.0675 * np.sin(a), 1.530 - 0.0105 * np.cos(a), 0.003 + 0.0525 * np.cos(a)])
        long = 0.0175 * (1 + 0.035 * np.cos(3.1 * j))
        height = 0.0126 * (1 + 0.044 * np.cos(4.3 * j))
        depth = 0.0113
        offset = len(vertices)

        def point(s, phi):
            breadth = (max(0, 1 - s * s)) ** 0.53
            angle = phi + 0.075 * s + 0.035 * np.cos(4 * s + j)
            ridge = 0.00065 * np.exp(-(((abs(angle) - 0.27) / 0.14) ** 2))
            groove = 0.0019 * np.exp(-((angle / 0.105) ** 2))
            return (
                c
                + along * (s * long)
                + vert * (height * breadth * np.sin(angle))
                + out * ((depth + ridge - groove) * breadth * np.cos(angle) - 0.0010 * s * s)
            )

        for ii in range(lat + 1):
            s = -np.cos(ii * np.pi / lat)
            for kk in range(around):
                angle = -np.pi + 2 * np.pi * kk / around
                vertices.append(point(s, angle))
        for ii in range(lat):
            for kk in range(around):
                v = offset + ii * around + kk
                vn = offset + ii * around + (kk + 1) % around
                if ii > 0:
                    faces.append((v, vn, v + around))
                if ii < lat - 1:
                    faces.append((vn, vn + around, v + around))
        offset = len(ink)
        for ii in range(19):
            s = -0.87 + 1.74 * ii / 18
            w = 0.024 * max(0, 1 - (s / 0.88) ** 2) ** 0.55
            phi = -0.075 * s - 0.035 * np.cos(4 * s + j)
            for k in [-1, 1]:
                ink.append(point(s, phi + k * w) + out * 0.00013)
        for ii in range(18):
            b = offset + 2 * ii
            slit_faces.extend(((b, b + 2, b + 1), (b + 1, b + 2, b + 3)))
    mat = lib.make(
        "Nacre | porcelain cowries", None, 0.29, 0.40, 0.30, 0.02, color=(0.88, 0.78, 0.734)
    )
    put(
        "Twelve cowries | pearl ridges",
        "Wardrobe",
        np.array(vertices),
        np.array(faces)[:, ::-1],
        [],
        "neck",
        mat,
    )
    seam = lib.make(
        "Cowrie | warm recessed slit", None, 0.48, 0.28, 0.02, color=(0.385, 0.243, 0.205)
    )
    put(
        "Cowrie | incised apertures",
        "Wardrobe",
        np.array(ink),
        np.array(slit_faces),
        [],
        "neck",
        seam,
    )
