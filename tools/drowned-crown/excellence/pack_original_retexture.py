#!/usr/bin/env python3
"""Pack Meshy's retexture of an existing board without authoring board geometry.

The service preserves the original triangles and UVs, but normalizes the model,
introduces six seam duplicates and regenerates normals. Retain every provider
accessor unchanged; only an ancestor transforms the intact plank for placement.
"""
from pathlib import Path
import hashlib
import json
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures, matrices, world_vertices

NAME = 'crash-existing-deck-plank'
SOURCE = ROOT / '.img2threejs/drowned-crown/excellence/meshy' / (NAME + '-textured') / 'downloads/model.glb'
ORIGINAL = ROOT / 'public/drowned-crown/boards/plank-worn.glb'
TARGET = ROOT / 'public/drowned-crown/excellence' / (NAME + '.glb')
SIZE = [2.974581, .124944, .76]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    spec = json.loads((HERE / 'assets.json').read_text())[NAME]
    assert spec.get('production') and not spec.get('rejected'), 'Rejected retexture is retained privately; production export disabled'
    old, glb = Glb(ORIGINAL), Glb(SOURCE)
    document = glb.document
    job = json.loads((HERE / 'tasks.json').read_text())['tasks'][NAME + '-textured']
    assert job['state'] == 'SUCCEEDED'
    assert sha(ORIGINAL) == job['modelReferenceSha256']
    assert len(old.document['meshes']) == len(document['meshes']) == 1
    original_primitive = old.document['meshes'][0]['primitives'][0]
    primitive = document['meshes'][0]['primitives'][0]
    original_ids = old.read_accessor(original_primitive['indices']).ravel()
    ids = glb.read_accessor(primitive['indices']).ravel()
    assert len(ids) == len(original_ids) == 918

    original_points = world_vertices(old)
    points = world_vertices(glb)
    center = (original_points.min(0) + original_points.max(0)) * .5
    normalized_original = (original_points - center) * (2 / np.ptp(original_points[:, 0]))
    position_error = float(np.max(np.abs(normalized_original[original_ids] - points[ids])))
    assert position_error < 3e-7, 'Retexture changed original board shape'
    original_uvs = old.read_accessor(original_primitive['attributes']['TEXCOORD_0'])[original_ids]
    provider_uvs = glb.read_accessor(primitive['attributes']['TEXCOORD_0'])[ids]
    assert np.array_equal(original_uvs, provider_uvs), 'Retexture changed original UV layout'

    original_normals = old.read_accessor(original_primitive['attributes']['NORMAL'])
    original_normals = original_normals @ matrices(old.document)[0][:3, :3].T
    provider_normals = glb.read_accessor(primitive['attributes']['NORMAL'])
    normal_error = float(np.max(np.abs(original_normals[original_ids] - provider_normals[ids])))
    accessors = [glb.read_accessor(i) for i in range(len(document['accessors']))]
    low, high = points.min(0), points.max(0)
    scale = SIZE[0] / (high[0] - low[0])
    translation = np.array([-(low[0] + high[0]) * .5, -low[1], -(low[2] + high[2]) * .5]) * scale
    scene = document['scenes'][document.get('scene', 0)]
    children = scene['nodes'][:]
    scene['nodes'] = [len(document['nodes'])]
    document['nodes'].append({'name': 'Original Meshy plank placement only', 'children': children,
                              'scale': [scale, scale, scale], 'translation': translation.tolist()})
    textures = compact_textures(glb, 4096, 95, data_limit=2048, lossless_data=True)
    for i, values in enumerate(accessors):
        assert np.array_equal(glb.read_accessor(i), values), f'Packing changed provider accessor {i}'
    document['asset'].setdefault('extras', {}).update({
        'provider': 'Meshy', 'taskId': job['id'], 'operation': 'retexture',
        'originalBoard': str(ORIGINAL.relative_to(ROOT)), 'originalBoardSha256': sha(ORIGINAL),
        'originalTriangleGeometryPreserved': True, 'originalUVsPreserved': True,
        'providerGeometryUVsAndNormalsUnchangedDuringPacking': True,
        'newBoardGeometryAuthored': False, 'newTexturesPaintedLocally': False,
    })
    glb.save(TARGET)
    fitted = world_vertices(glb)
    report = {
        'provider': 'Meshy', 'taskId': job['id'], 'operation': 'retexture', 'credits': 10,
        'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': sha(SOURCE),
        'originalBoard': str(ORIGINAL.relative_to(ROOT)), 'originalBoardSha256': sha(ORIGINAL),
        'styleReference': job['reference'], 'styleReferenceSha256': job['referenceSha256'],
        'output': str(TARGET.relative_to(ROOT)), 'outputSha256': sha(TARGET), 'bytes': TARGET.stat().st_size,
        'triangles': len(ids) // 3, 'sourceVertices': len(original_points), 'providerVertices': len(points),
        'size': SIZE, 'measuredFittedSize': np.ptp(fitted, axis=0).tolist(),
        'originalGeometryMaximumNormalizedError': position_error, 'originalUVsExactlyPreservedPerTriangle': True,
        'providerRegeneratedNormals': normal_error > 1e-5, 'providerNormalDeltaFromOriginal': normal_error,
        'providerAccessorsUnchangedDuringPacking': True, 'localEdits': 'Uniform root fit and texture file compression only',
        'textures': textures,
    }
    # Export the same existing board for source-owned woodpaths. Coordinates
    # use the toolkit's unit envelope; restoring that envelope recovers every
    # original position and normal. No vertices, UVs or triangles are authored.
    unit_positions = (points - (low + high) * .5) / (high - low)
    unit_normals = provider_normals * (high - low)
    unit_normals /= np.maximum(np.linalg.norm(unit_normals, axis=1, keepdims=True), 1e-12)
    unit_data = {'positions': unit_positions.ravel().tolist(), 'normals': unit_normals.ravel().tolist(),
                 'uvs': glb.read_accessor(primitive['attributes']['TEXCOORD_0']).ravel().tolist(),
                 'indices': ids.tolist()}
    restored = unit_positions * (high - low) + (low + high) * .5
    assert np.max(np.abs(restored - points)) < 1e-12
    (ROOT / 'src/drownedPlank.generated.ts').write_text(
        '/** Original Meshy worn plank with Meshy retexture; exact UVs and reversible unit-envelope fit. */\n'
        'export const DROWNED_PLANK_DATA=' + json.dumps(unit_data, separators=(',', ':')) + ' as const;\n')
    original_delivery = Glb(SOURCE)
    source_material = original_delivery.document['materials'][primitive.get('material', 0)]
    exported = []
    for label, info in [('color', source_material['pbrMetallicRoughness']['baseColorTexture']),
                        ('normal', source_material['normalTexture']),
                        ('metalrough', source_material['pbrMetallicRoughness']['metallicRoughnessTexture'])]:
        texture = original_delivery.document['textures'][info['index']]
        image = original_delivery.document['images'][texture['source']]
        assert image['mimeType'] == 'image/jpeg'
        view = original_delivery.document['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        image_bytes = bytes(original_delivery.binary[offset:offset + view['byteLength']])
        image_path = ROOT / 'public/boardwalk' / ('drowned-plank-' + label + '.jpg')
        image_path.write_bytes(image_bytes)
        exported.append({'path': str(image_path.relative_to(ROOT)), 'bytes': len(image_bytes),
                         'sha256': sha(image_path), 'providerImageBytesUnchanged': True})
    report['woodpathExport'] = {'vertices': len(points), 'triangles': len(ids) // 3,
                              'unitEnvelopeFitIsReversible': True, 'originalUVsExactlyPreserved': True,
                              'providerNormalsPreservedUnderEnvelopeFit': True, 'images': exported}
    (HERE / 'original-retexture-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    (ROOT / 'src/drownedCrownDeck.generated.ts').write_text(
        '/** Existing Meshy plank, retextured by Meshy using the approved complete jetty reference. */\n'
        'export const DROWNED_CROWN_DECK_MODELS={\n'
        ' crownmeshygoldplank:{file:"../drowned-crown/excellence/crash-existing-deck-plank",'
        'label:"Drowned Crown · Meshy honey oak plank",size:' + json.dumps(SIZE) +
        ',wind:false,normalStrength:.15,doubleSided:false},\n} as const;\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'textures'}))


if __name__ == '__main__':
    main()
