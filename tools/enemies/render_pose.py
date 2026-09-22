"""Render explicit game-local articulation samples from a baked enemy GLB.

Blender --background --python tools/enemies/render_pose.py -- spinner retracted
    --pose .img2threejs/enemies/spinner-retracted.json

Pose entries are node names with rotateX/Y/Z (radians), scaleX/Y/Z (ratios),
or translateX/Y/Z (metres). Original bind matrices and surfaces are retained.
"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mathutils import Matrix, Quaternion, Vector
from glb_rig import Glb
from bake_assets import WORK, OUT, load_surface, render_views

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('kind')
parser.add_argument('label')
parser.add_argument('--pose', type=Path, required=True)
parser.add_argument('--size', type=int, default=640)
parser.add_argument('--source', type=Path)
parser.add_argument('--plant-feet', action='store_true', help='Apply the runtime hip-origin foot correction')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
pose = json.loads(args.pose.read_text())
glb = Glb(args.source or OUT/(args.kind+'.glb'))
def worlds():
    result = {}
    def visit(index, parent):
        node = glb.document['nodes'][index]
        raw = node.get('rotation', [0, 0, 0, 1])
        q = Quaternion((raw[3], raw[0], raw[1], raw[2]))
        local = Matrix.LocRotScale(Vector(node.get('translation', [0,0,0])), q,
                                  Vector(node.get('scale', [1,1,1])))
        result[index] = parent @ local
        for child in node.get('children', []):
            visit(child, result[index])
    for root in glb.document['scenes'][glb.document.get('scene', 0)]['nodes']:
        visit(root, Matrix.Identity(4))
    return result
rest_world = worlds()
applied = set()
for node in glb.document['nodes']:
    values = pose.get(node.get('name'))
    if values is None:
        continue
    applied.add(node['name'])
    raw = node.get('rotation', [0, 0, 0, 1])
    q = Quaternion((raw[3], raw[0], raw[1], raw[2]))
    scale = node.get('scale', [1, 1, 1])
    translation = node.get('translation', [0, 0, 0])
    for i, axis in enumerate('XYZ'):
        if 'rotate'+axis in values:
            direction = Vector(tuple(int(j == i) for j in range(3)))
            q = q @ Quaternion(direction, values['rotate'+axis])
        scale[i] *= values.get('scale'+axis, 1)
        translation[i] += values.get('translate'+axis, 0)
    node['rotation'] = [q.x, q.y, q.z, q.w]
    node['scale'] = scale
    node['translation'] = translation
if applied != set(pose):
    raise ValueError('Unknown articulation nodes: '+str(set(pose)-applied))
if args.plant_feet:
    index = {node.get('name'): i for i, node in enumerate(glb.document['nodes'])}
    parents = {child: i for i, node in enumerate(glb.document['nodes']) for child in node.get('children', [])}
    for prefix in ('front', 'hind'):
        for side in ('Left', 'Right'):
            foot = index[prefix+'Foot'+side]
            upper = index[prefix+'Upper'+side]
            current = worlds()
            delta = rest_world[foot].translation - current[foot].translation
            delta = current[parents[upper]].to_3x3().inverted() @ delta
            node = glb.document['nodes'][upper]
            node['translation'] = list(Vector(node['translation']) + delta)
folder = WORK/'review'/(args.kind+'-'+args.label)
folder.mkdir(parents=True, exist_ok=True)
temporary = folder/'posed.glb'
glb.save(temporary)
render_views(load_surface(temporary), folder, args.size)
print('ENEMY_POSE', args.kind, args.label, sorted(applied), flush=True)
