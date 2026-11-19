"""Record the posed torso UV vertices through the two orthographic cameras for fitting the tank pattern."""

import pickle
import sys
from pathlib import Path
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reference_pose import REFERENCE_VIEWS, place_camera, reference_pose

bake_dir, output = map(Path, sys.argv[sys.argv.index('--') + 1 :])
parts, width, height = pickle.load((bake_dir / 'surface.pickle').open('rb'))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
rig.animation_data.action = None
mesh = next(
    o
    for o in scene.objects
    if o.type == 'MESH' and o.vertex_groups.get('Island • Fitted tank, neck and midriff')
)
targets = [p for p in parts if p['paint'] in ('body', 'arm')]
record = {}
for title, angle, pitch, origin in REFERENCE_VIEWS[1:]:
    reference_pose(rig, False)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    obj = mesh.evaluated_get(deps)
    coords = np.asarray([v.co[:] for v in obj.data.vertices])
    center, _, horizontal, vertical = place_camera(scene.camera, angle, pitch, origin)
    u = 362 + ((coords - center) @ np.asarray(horizontal)) / 0.00125
    v = 362 - ((coords - center) @ np.asarray(vertical)) / 0.00125
    screen = np.column_stack([u, v])
    uv = np.asarray([a.uv[:] for a in mesh.data.uv_layers.active.data]) * [width, height]
    uv[:, 1] = height - uv[:, 1]
    indices = np.asarray([l.vertex_index for l in mesh.data.loops])
    for p in targets:
        x, y, w, h = p['rect']
        nu, nv = p['nu'], p['nv']
        k = (uv[:, 0] >= x) & (uv[:, 0] < x + w) & (uv[:, 1] >= y) & (uv[:, 1] < y + h)
        i, j = np.rint((uv[k] - [x + 0.5, y + 0.5]) / [w - 1, h - 1] * [nu, nv]).astype(int).T
        result = np.zeros((nv + 1, nu + 1, 2), dtype=np.float32)
        result[j, i] = screen[indices[k]]
        record[title + ' / ' + p['name']] = result
np.savez_compressed(output, **record)
