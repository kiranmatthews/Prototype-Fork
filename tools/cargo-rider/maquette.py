"""Measured coordinates in the supplied 724-pixel rear and profile panels."""

import numpy as np

SCALE = 0.00125
REAR_AXIS = 372.0
SIDE_AXIS = 330.0
NECK_DEPTH = -0.015
CHIN_ROW = 538.0
CHIN_HEIGHT = 1.542


def fit(p):
    x, row, depth = p
    return np.array([x * SCALE, CHIN_HEIGHT + (CHIN_ROW - row) * SCALE, NECK_DEPTH + depth * SCALE])


def coordinates(points):
    p = np.asarray(points)
    return np.stack(
        [p[..., 0] / SCALE, CHIN_ROW - (p[..., 1] - CHIN_HEIGHT) / SCALE, (p[..., 2] - NECK_DEPTH) / SCALE],
        axis=-1,
    )


def hair_projection(p, u, t):
    # The left rear ponytail and nearer profile lock describe both sides.
    x, row, d = p
    return [REAR_AXIS - abs(x), row, abs(np.sin(2 * np.pi * u)) ** 2, SIDE_AXIS - d]
