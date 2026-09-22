#!/usr/bin/env python3
"""Fit and compact a Meshy walk GLB while preserving its authored rig and clips.

Uses numpy/Pillow (the bundled authoring Python), not a Blender animation
roundtrip: all source nodes, mesh/weight/IBM accessors and keyframes survive
byte-for-byte. One static ancestor supplies the reviewed orientation and fit.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import math
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from glb_rig import Glb

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/enemies'
ENVELOPES = {'grunt': [1.3, 1.1, 1.3], 'spiker': [1.3, 1.1, 1.3],
             'turtle': [1.3, .87, 1.3], 'charger': [1.45, 1.1, 1.45]}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def node_matrix(node):
    if 'matrix' in node:
        return np.asarray(node['matrix'], dtype=float).reshape(4, 4).T
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    result = np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w), 0],
        [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w), 0],
        [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y), 0],
        [0, 0, 0, 1]], dtype=float)
    result[:3, :3] *= np.asarray(node.get('scale', [1, 1, 1]))
    result[:3, 3] = node.get('translation', [0, 0, 0])
    return result


def matrices(document):
    result = {}
    nodes = document.get('nodes', [])
    def visit(index, parent):
        if index in result:
            raise ValueError('Repeated/cyclic node in active scene')
        world = parent @ node_matrix(nodes[index])
        result[index] = world
        for child in nodes[index].get('children', []):
            visit(child, world)
    for root in document['scenes'][document.get('scene', 0)].get('nodes', []):
        visit(root, np.eye(4))
    return result


def world_vertices(glb):
    parts = []
    doc = glb.document
    worlds = matrices(doc)
    for index, matrix in worlds.items():
        node = doc['nodes'][index]
        if 'mesh' not in node:
            continue
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            if 'KHR_draco_mesh_compression' in primitive.get('extensions', {}):
                raise ValueError('Decode Draco externally before fitting this GLB')
            accessor = primitive['attributes']['POSITION']
            if 'sparse' in doc['accessors'][accessor]:
                raise ValueError('Sparse POSITION accessor is not supported by the bounds reader')
            points = glb.read_accessor(accessor)
            if 'skin' not in node:
                parts.append(points @ matrix[:3, :3].T + matrix[:3, 3])
                continue
            # glTF skin positions use jointWorld * inverseBind * position;
            # mesh-world transforms do not separately move skinned vertices.
            skin = doc['skins'][node['skin']]
            inverse = (glb.read_accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
                       if 'inverseBindMatrices' in skin else np.tile(np.eye(4), (len(skin['joints']), 1, 1)))
            transforms = np.stack([worlds[joint] @ inverse[i] for i, joint in enumerate(skin['joints'])])
            homogeneous = np.column_stack((points, np.ones(len(points))))
            posed = np.zeros((len(points), 4))
            for suffix in ('0', '1'):
                attrs = primitive['attributes']
                if 'JOINTS_' + suffix not in attrs:
                    continue
                joints = glb.read_accessor(attrs['JOINTS_' + suffix]).astype(int)
                weight_id = attrs['WEIGHTS_' + suffix]
                weights = glb.read_accessor(weight_id).astype(float)
                definition = doc['accessors'][weight_id]
                if definition.get('normalized'):
                    weights /= {5121: 255, 5123: 65535}[definition['componentType']]
                for slot in range(joints.shape[1]):
                    posed += np.einsum('nij,nj->ni', transforms[joints[:, slot]], homogeneous) * weights[:, slot, None]
            if np.any(np.abs(posed[:, 3]) < 1e-8):
                raise ValueError('Unweighted vertices cannot be fitted as a valid skin')
            parts.append(posed[:, :3] / posed[:, 3, None])
    if not parts:
        raise ValueError('No active scene mesh positions')
    return np.concatenate(parts)


def clip_summary(glb):
    doc = glb.document
    result = []
    for i, clip in enumerate(doc.get('animations', [])):
        sampler = clip.get('samplers', [])
        ranges = [glb.read_accessor(s['input']).ravel() for s in sampler]
        times = np.concatenate(ranges) if ranges else np.array([0])
        result.append({'name': clip.get('name', 'animation_' + str(i)),
            'channels': len(clip.get('channels', [])), 'start': float(times.min()),
            'end': float(times.max()), 'duration': float(times.max()-times.min())})
    return result


def inspect(glb):
    points = world_vertices(glb)
    doc = glb.document
    worlds = matrices(doc)
    def joint_info(index):
        node = doc['nodes'][index]
        world = worlds.get(index)
        axes = None
        if world is not None:
            basis = world[:3, :3]
            axes = {axis: (basis[:, i] / max(1e-12, np.linalg.norm(basis[:, i]))).tolist()
                    for i, axis in enumerate(('x', 'y', 'z'))}
        return {'index': index, 'name': node.get('name'),
            'position': world[:3, 3].tolist() if world is not None else None,
            'localTranslation': node.get('translation', [0, 0, 0]),
            'localRotation': node.get('rotation', [0, 0, 0, 1]), 'worldAxes': axes,
            'children': [doc['nodes'][i].get('name', str(i)) for i in node.get('children', [])]}
    return {'bounds': [points.min(axis=0).tolist(), points.max(axis=0).tolist()],
        'size': np.ptp(points, axis=0).tolist(), 'clips': clip_summary(glb),
        'skins': [{'name': skin.get('name'), 'joints': [joint_info(i)
            for i in skin['joints']]} for skin in doc.get('skins', [])],
        'nodes': [{'index': i, 'name': node.get('name'), 'children': node.get('children', []),
                   'mesh': node.get('mesh'), 'skin': node.get('skin')}
                  for i, node in enumerate(doc.get('nodes', []))]}


def compact_textures(glb, limit, quality, data_limit=None, lossless_data=True):
    doc = glb.document
    original = bytes(glb.binary)
    replacements = {}
    report = []
    data_images = set()
    for material in doc.get('materials', []):
        for info in (material.get('normalTexture'), material.get('occlusionTexture'),
                     material.get('pbrMetallicRoughness', {}).get('metallicRoughnessTexture')):
            if info:
                data_images.add(doc['textures'][info['index']]['source'])
    for index, image in enumerate(doc.get('images', [])):
        if 'uri' in image or 'bufferView' not in image:
            raise ValueError('Authoring input must embed all texture images')
        view_index = image['bufferView']
        if view_index in replacements:
            raise ValueError('Two images share a bufferView; normalize image references first')
        view = doc['bufferViews'][view_index]
        offset = view.get('byteOffset', 0)
        source = original[offset:offset+view['byteLength']]
        texture = Image.open(io.BytesIO(source)); texture.load()
        before = list(texture.size)
        image_limit = min(limit, data_limit) if index in data_images and data_limit else limit
        texture.thumbnail((image_limit, image_limit), Image.Resampling.LANCZOS)
        has_alpha = 'A' in texture.getbands() and texture.getchannel('A').getextrema()[0] < 255
        lossless = (index in data_images and lossless_data) or has_alpha
        target = io.BytesIO()
        if lossless:
            texture.save(target, format='PNG', optimize=True)
            image['mimeType'] = 'image/png'
        else:
            jpeg_quality = max(quality, 95) if index in data_images else quality
            texture.convert('RGB').save(target, format='JPEG', quality=jpeg_quality, optimize=True)
            image['mimeType'] = 'image/jpeg'
        replacements[view_index] = target.getvalue()
        report.append({'image': index, 'sourceSize': before, 'size': list(texture.size),
                       'mimeType': image['mimeType'], 'bytes': len(replacements[view_index])})
    packed = bytearray()
    for index, view in enumerate(doc.get('bufferViews', [])):
        if view.get('buffer', 0) != 0 or view.get('extensions'):
            raise ValueError('Expected one uncompressed GLB buffer; decode extension buffers before packing')
        while len(packed) % 4:
            packed.append(0)
        offset = view.get('byteOffset', 0)
        chunk = replacements.get(index, original[offset:offset+view['byteLength']])
        view['byteOffset'] = len(packed); view['byteLength'] = len(chunk)
        packed.extend(chunk)
    glb.binary = packed
    return report


def validate_mapping(document, mapping):
    names = {node.get('name') for node in document.get('nodes', [])}
    for role, binding in mapping.items():
        selected = binding if isinstance(binding, str) else binding['name']
        selected = [selected] if isinstance(selected, str) else selected
        if not any(name in names for name in selected):
            raise ValueError(f'Mapping {role} has no matching node: {selected}')


def prepare(args):
    glb = Glb(args.source)
    doc = glb.document
    if not doc.get('skins') or not doc.get('animations'):
        raise ValueError('A Meshy skinned model with animation clips is required; no custom rig is generated')
    original_nodes = copy.deepcopy(doc.get('nodes', []))
    original_skins = copy.deepcopy(doc['skins'])
    original_animations = copy.deepcopy(doc['animations'])
    original_accessors = [glb.read_accessor(i) for i in range(len(doc.get('accessors', [])))]
    source_report = inspect(glb)
    mapping_file = json.loads(args.mapping.read_text()) if args.mapping else {}
    mapping = mapping_file.get('enemyRig', {}).get('mapping', mapping_file.get('mapping', mapping_file))
    validate_mapping(doc, mapping)
    clips = source_report['clips']
    walk = args.walk_clip or next((c['name'] for c in clips if 'walk' in c['name'].lower()), None)
    if walk is None and len(clips) == 1:
        walk = clips[0]['name']
    if not any(c['name'] == walk for c in clips):
        raise ValueError('Choose an existing --walk-clip from the inspected clip names')
    yaw = math.radians(args.yaw)
    rotation = np.array([[math.cos(yaw), 0, math.sin(yaw)], [0, 1, 0],
                         [-math.sin(yaw), 0, math.cos(yaw)]])
    points = world_vertices(glb) @ rotation.T
    low, high = points.min(axis=0), points.max(axis=0)
    scale = float(min(np.asarray(ENVELOPES[args.kind]) / (high-low)))
    center = np.array([(low[0]+high[0])*.5, low[1], (low[2]+high[2])*.5])
    scene = doc['scenes'][doc.get('scene', 0)]
    wrapper = {'name': f'Enemy_{args.kind}_Normalization', 'children': scene.get('nodes', []).copy(),
        'translation': (-center*scale).tolist(), 'scale': [scale]*3,
        'rotation': [0, math.sin(yaw*.5), 0, math.cos(yaw*.5)]}
    scene['nodes'] = [len(doc['nodes'])]
    doc['nodes'].append(wrapper)
    scene.setdefault('extras', {})['enemyRig'] = {'mapping': mapping, 'walkClip': walk,
        'walkSpeed': args.walk_speed, 'provenance': 'Meshy quadruped rig and walk',
        'sourceSha256': sha256(args.source.read_bytes())}
    texture_report = compact_textures(glb, args.texture_size, args.quality)
    output = args.output or ROOT / 'public/enemies' / (args.kind + '.glb')
    output.parent.mkdir(parents=True, exist_ok=True)
    glb.save(output)
    # Check the saved artifact, not only our in-memory intention. Geometry,
    # inverse bind matrices, weights and animation samples remain exact.
    exported = Glb(output)
    assert exported.document['nodes'][:-1] == original_nodes, 'Source node hierarchy changed'
    assert exported.document['skins'] == original_skins, 'Skin bindings changed'
    assert exported.document['animations'] == original_animations, 'Animation channels changed'
    for i, values in enumerate(original_accessors):
        assert np.array_equal(exported.read_accessor(i), values), f'Accessor {i} changed'
    after = inspect(exported)
    assert abs(after['bounds'][0][1]) < 1e-5, 'Feet are not at game Y=0'
    assert all(size <= envelope+1e-5 for size, envelope in zip(after['size'], ENVELOPES[args.kind]))
    report = {'kind': args.kind, 'source': str(args.source), 'output': str(output),
        'sourceSha256': sha256(args.source.read_bytes()), 'outputSha256': sha256(output.read_bytes()),
        'sourceBytes': args.source.stat().st_size, 'outputBytes': output.stat().st_size,
        'yawDegrees': args.yaw, 'uniformScale': scale, 'normalizationEnvelope': ENVELOPES[args.kind],
        'sourceBounds': source_report['bounds'], 'outputBounds': after['bounds'], 'clips': after['clips'],
        'textures': texture_report, 'preservedAccessors': len(original_accessors),
        'preservedNodes': len(original_nodes), 'preservedSkins': len(original_skins),
        'sourceNodesBindingsAndAnimationSamplesUnchanged': True}
    report_path = args.report or WORK / (args.kind + '-walk-preparation.json')
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    if args.rig_record:
        tasks = json.loads((Path(__file__).resolve().parent / 'tasks.json').read_text())
        generated = tasks['tasks'][args.kind]
        raw_source = WORK / (args.kind + '.glb')
        raw_sha = sha256(raw_source.read_bytes())
        if generated.get('state') != 'SUCCEEDED' or not any(
                item['sha256'] == raw_sha for item in generated.get('downloads', [])):
            raise ValueError('Generated source does not match the successful Meshy download ledger')
        rig_record = {'maxSize': ENVELOPES[args.kind], 'yawDegrees': args.yaw,
            'textureSize': args.texture_size, 'textureQuality': args.quality,
            'reviewedSource': f'.img2threejs/enemies/review/{args.kind}/: front, quarter and side inspected; source faces +Z',
            'sourceSha256': report['sourceSha256'], 'generatedSourceSha256': raw_sha,
            'providerTaskId': generated['id'],
            'walkSource': str(args.source.relative_to(ROOT) if args.source.is_absolute() else args.source),
            'walkSourceSha256': report['sourceSha256'], 'walkUiTaskIds': args.ui_task_id or [],
            'outputSha256': report['outputSha256'], 'outputBytes': report['outputBytes'],
            'rigType': 'meshy-quadruped', 'animationSource': 'Meshy basic quadruped walk',
            'enemyRig': copy.deepcopy(scene['extras']['enemyRig']), 'clips': report['clips'],
            'uniformScale': scale, 'preservedNodes': len(original_nodes),
            'preservedSkins': len(original_skins), 'preservedAccessors': len(original_accessors),
            'sourceNodesBindingsAndAnimationSamplesUnchanged': True}
        args.rig_record.parent.mkdir(parents=True, exist_ok=True)
        args.rig_record.write_text(json.dumps(rig_record, indent=2) + '\n')
    print(json.dumps(report, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    inspect_parser = sub.add_parser('inspect'); inspect_parser.add_argument('source', type=Path)
    p = sub.add_parser('prepare'); p.add_argument('kind', choices=ENVELOPES); p.add_argument('source', type=Path)
    p.add_argument('--output', type=Path); p.add_argument('--report', type=Path)
    p.add_argument('--rig-record', type=Path, help='Write tracked source/walk/output provenance after validation')
    p.add_argument('--ui-task-id', action='append', help='Observed Meshy web upload/rig/walk task identity')
    p.add_argument('--mapping', type=Path); p.add_argument('--yaw', type=float, default=0)
    p.add_argument('--walk-clip'); p.add_argument('--walk-speed', type=float, default=2.4)
    p.add_argument('--texture-size', type=int, default=1024); p.add_argument('--quality', type=int, default=86)
    args = parser.parse_args()
    if args.command == 'inspect': print(json.dumps(inspect(Glb(args.source)), indent=2))
    else: prepare(args)


if __name__ == '__main__':
    main()
