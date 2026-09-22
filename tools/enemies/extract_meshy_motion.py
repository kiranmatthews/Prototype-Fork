"""Blender: extract an existing Meshy FBX walk's sampled joint transforms.

No mesh is exported and no motion is synthesized. Matrices and heads are
sampled from the imported source action in game Y-up, +Z-forward coordinates.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys

import bpy
from mathutils import Matrix

TO_GAME = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=str(args.source), use_anim=True, automatic_bone_orientation=False)
    armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    if len(armatures) != 1:
        raise ValueError(f'Expected one source armature, got {len(armatures)}')
    armature = armatures[0]
    action = armature.animation_data.action if armature.animation_data else None
    if action is None:
        raise ValueError('Source FBX has no active skeletal action')
    scene = bpy.context.scene
    fps = scene.render.fps / scene.render.fps_base
    start, end = map(float, action.frame_range)
    frames = list(range(round(start), round(end)+1))
    rest = {}
    for bone in armature.data.bones:
        world = TO_GAME @ armature.matrix_world @ bone.matrix_local
        tail = TO_GAME @ armature.matrix_world @ bone.tail_local
        rest[bone.name] = {'parent': bone.parent.name if bone.parent else None,
            'matrix': [list(row) for row in world], 'head': list(world.translation), 'tail': list(tail)}
    samples = []
    for frame in frames:
        scene.frame_set(frame); bpy.context.view_layer.update()
        joints = {}
        for bone in armature.pose.bones:
            world = TO_GAME @ armature.matrix_world @ bone.matrix
            joints[bone.name] = {'matrix': [list(row) for row in world],
                                 'head': list(world.translation)}
        samples.append({'frame': frame, 'time': (frame-start)/fps, 'joints': joints})
    data = {'source': str(args.source), 'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
        'coordinateSystem': 'right-handed Y-up +Z-forward', 'fps': fps,
        'action': action.name, 'frameRange': [start, end], 'duration': (end-start)/fps,
        'rest': rest, 'samples': samples}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, separators=(',', ':'))+'\n')
    print('MESHY_MOTION', json.dumps({k:v for k,v in data.items() if k not in ('rest','samples')}))
    print('MESHY_BONES', json.dumps({name:value['parent'] for name,value in rest.items()}))


if __name__ == '__main__':main()
