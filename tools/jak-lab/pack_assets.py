#!/usr/bin/env python3
"""Losslessly pack the complete OpenGOAL export for the inspection lab.

Shared level buffers contain vertices/accessors that a particular exported model
never references. Remove only that unreachable storage. Preserve draw-order
attribute bytes, morphs, skins, animation keys, materials and original images.
Run the complete catalogue through the shared heavy-job guard.
"""
from __future__ import annotations

import argparse
import base64
import copy
import gzip
import hashlib
import json
from pathlib import Path
import struct
import re

COMPONENTS = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
              5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4,
          'MAT2': 4, 'MAT3': 9, 'MAT4': 16}


def sha(data):
    return hashlib.sha256(data).hexdigest()


class GLB:
    def __init__(self, data, directory=Path('.')):
        magic, version, length = struct.unpack_from('<III', data)
        if magic != 0x46546c67 or version != 2 or length != len(data):
            raise ValueError('Invalid GLB 2 header')
        at, binary, self.doc = 12, b'', None
        while at < length:
            size, kind = struct.unpack_from('<II', data, at)
            chunk = data[at + 8:at + 8 + size]
            if len(chunk) != size:
                raise ValueError('Truncated GLB chunk')
            if kind == 0x4e4f534a:
                self.doc = json.loads(chunk)
            elif kind == 0x004e4942:
                binary = chunk
            else:
                raise ValueError(f'Unsupported GLB chunk {kind}')
            at += 8 + size
        if self.doc is None:
            raise ValueError('GLB has no JSON')
        self.directory = directory.resolve()
        self.buffers = [self.uri(b['uri']) if 'uri' in b else binary
                        for b in self.doc.get('buffers', [])]
        # Exported backgrounds share a vertex accessor across hundreds of
        # material draws. Decode its immutable rows once, not once per draw.
        self._rows = {}
        if {'KHR_draco_mesh_compression', 'EXT_meshopt_compression'} & set(self.doc.get('extensionsUsed', [])):
            raise ValueError('Compressed source geometry requires explicit decoding')

    def uri(self, uri):
        if uri.startswith('data:'):
            header, payload = uri.split(',', 1)
            if not header.endswith(';base64'):
                raise ValueError('Only base64 data URIs are supported')
            return base64.b64decode(payload, validate=True)
        file = (self.directory / uri).resolve()
        if not file.is_relative_to(self.directory):
            raise ValueError('External source URI escapes its directory')
        return file.read_bytes()

    def view(self, index):
        view = self.doc['bufferViews'][index]
        start = view.get('byteOffset', 0)
        data = memoryview(self.buffers[view['buffer']])[start:start + view['byteLength']]
        if len(data) != view['byteLength']:
            raise ValueError('Buffer view exceeds buffer')
        return data

    def rows(self, index):
        if index in self._rows:
            return self._rows[index]
        accessor = self.doc['accessors'][index]
        if 'sparse' in accessor:
            raise ValueError('Sparse source accessor needs an explicit lossless expansion')
        width, size = WIDTHS[accessor['type']], COMPONENTS[accessor['componentType']][1]
        row_size = width * size
        if accessor['type'].startswith('MAT'):
            columns = int(accessor['type'][-1])
            row_size = columns * ((columns * size + 3) // 4 * 4)
        if 'bufferView' not in accessor:
            rows = [bytes(row_size)] * accessor['count']
            self._rows[index] = rows
            return rows
        view = self.doc['bufferViews'][accessor['bufferView']]
        stride, start = view.get('byteStride', row_size), accessor.get('byteOffset', 0)
        data = self.view(accessor['bufferView'])
        rows = [data[start + i * stride:start + i * stride + row_size].tobytes() for i in range(accessor['count'])]
        if any(len(row) != row_size for row in rows):
            raise ValueError('Accessor exceeds buffer view')
        self._rows[index] = rows
        return rows

    def indices(self, primitive):
        if 'indices' not in primitive:
            return list(range(self.doc['accessors'][primitive['attributes']['POSITION']]['count']))
        accessor = self.doc['accessors'][primitive['indices']]
        if accessor['type'] != 'SCALAR' or accessor['componentType'] not in (5121, 5123, 5125):
            raise ValueError('Invalid index accessor')
        return [struct.unpack('<' + COMPONENTS[accessor['componentType']][0], row)[0]
                for row in self.rows(primitive['indices'])]

    def image(self, image):
        return self.uri(image['uri']) if 'uri' in image else self.view(image['bufferView']).tobytes()


def semantic_fingerprint(source):
    """Hash rendered draw streams and all animation/skin data, independently of layout."""
    h = hashlib.sha256()
    doc = source.doc
    # Accessor offsets and image addresses may change. The scene, transforms,
    # joints, channel targets, materials and sampler semantics must not.
    graph = copy.deepcopy(doc)
    for key in ('buffers', 'bufferViews', 'accessors'):
        graph.pop(key, None)
    for mesh in graph.get('meshes', []):
        for p in mesh['primitives']:
            p.pop('indices', None)
            p['attributes'] = sorted(p['attributes'])
            p['targets'] = [sorted(target) for target in p.get('targets', [])]
    for skin in graph.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = 'content'
    for animation in graph.get('animations', []):
        for sampler in animation['samplers']:
            sampler['input'] = sampler['output'] = 'content'
    for image in graph.get('images', []):
        image.pop('uri', None)
        image.pop('bufferView', None)
        image.pop('mimeType', None)
    h.update(json.dumps(graph, sort_keys=True, separators=(',', ':')).encode())

    def feed(index, selection=None):
        a = doc['accessors'][index]
        h.update(json.dumps([a['componentType'], a['type'], a.get('normalized', False)]).encode())
        rows = source.rows(index)
        if selection is None:
            h.update(struct.pack('<I', len(rows)))
            h.update(b''.join(rows))
        else:
            h.update(struct.pack('<I', len(selection)))
            h.update(b''.join(rows[i] for i in selection))

    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            indices = source.indices(primitive)
            for name, index in sorted(primitive['attributes'].items()):
                h.update(name.encode())
                feed(index, indices)
            for target in primitive.get('targets', []):
                for name, index in sorted(target.items()):
                    h.update(name.encode())
                    feed(index, indices)
    for skin in doc.get('skins', []):
        if 'inverseBindMatrices' in skin:
            feed(skin['inverseBindMatrices'])
    for animation in doc.get('animations', []):
        for sampler in animation['samplers']:
            feed(sampler['input'])
            feed(sampler['output'])
    for image in doc.get('images', []):
        h.update(bytes.fromhex(sha(source.image(image))))
    return h.hexdigest()


def pack(source, image_sink):
    doc = copy.deepcopy(source.doc)
    blob, views, accessors, cached = bytearray(), [], [], {}
    domains = {}
    for mesh in source.doc.get('meshes', []):
        for primitive in mesh['primitives']:
            position = primitive['attributes']['POSITION']
            indices = source.indices(primitive)
            count = source.doc['accessors'][position]['count']
            if any(i < 0 or i >= count for i in indices):
                raise ValueError('Primitive index exceeds vertex count')
            domains.setdefault(position, set()).update(indices)
    domains = {key: tuple(sorted(value)) for key, value in domains.items()}
    remaps = {key: {old: new for new, old in enumerate(value)} for key, value in domains.items()}

    def write(index, domain=None, index_remap=None, position=False):
        key = (index, domain, index_remap, position)
        if key in cached:
            return cached[key]
        old = source.doc['accessors'][index]
        rows = source.rows(index)
        if domain is not None:
            rows = [rows[i] for i in domains[domain]]
        if index_remap is not None:
            fmt = '<' + COMPONENTS[old['componentType']][0]
            rows = [struct.pack(fmt, remaps[index_remap][struct.unpack(fmt, row)[0]]) for row in rows]
        while len(blob) % 4:
            blob.append(0)
        view = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': sum(map(len, rows))}
        if 'bufferView' in old:
            target = source.doc['bufferViews'][old['bufferView']].get('target')
            if target:
                view['target'] = target
        blob.extend(b''.join(rows))
        accessor = copy.deepcopy(old)
        accessor.update(bufferView=len(views), byteOffset=0, count=len(rows))
        if position or domain is not None and ('min' in old or 'max' in old):
            if old['type'].startswith('MAT'):
                raise ValueError('Unexpected matrix vertex attribute')
            fmt = '<' + COMPONENTS[old['componentType']][0] * WIDTHS[old['type']]
            values = [struct.unpack(fmt, row) for row in rows]
            if values:
                accessor['min'] = [min(v) for v in zip(*values)]
                accessor['max'] = [max(v) for v in zip(*values)]
            else:
                accessor.pop('min', None)
                accessor.pop('max', None)
        views.append(view)
        cached[key] = len(accessors)
        accessors.append(accessor)
        return cached[key]

    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            domain = primitive['attributes']['POSITION']
            for name, index in primitive['attributes'].items():
                primitive['attributes'][name] = write(index, domain, position=name == 'POSITION')
            for target in primitive.get('targets', []):
                for name, index in target.items():
                    target[name] = write(index, domain, position=name == 'POSITION')
            if 'indices' in primitive:
                primitive['indices'] = write(primitive['indices'], index_remap=domain)
    for skin in doc.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = write(skin['inverseBindMatrices'])
    for animation in doc.get('animations', []):
        for sampler in animation['samplers']:
            sampler['input'] = write(sampler['input'])
            sampler['output'] = write(sampler['output'])
    for image in doc.get('images', []):
        data = source.image(image)
        mime = image.get('mimeType') or (image.get('uri', '').split(';', 1)[0].removeprefix('data:'))
        extension = {'image/png': 'png', 'image/jpeg': 'jpg'}.get(mime)
        if extension is None:
            extension = 'png' if data.startswith(b'\x89PNG') else 'jpg' if data.startswith(b'\xff\xd8') else None
        if extension is None:
            raise ValueError('Unsupported original image format')
        image['uri'] = '../' + image_sink(data, extension)
        image.pop('bufferView', None)
        image.pop('mimeType', None)
    doc.update(accessors=accessors, bufferViews=views, buffers=[{'byteLength': len(blob)}])
    raw = json.dumps(doc, separators=(',', ':'), allow_nan=False).encode()
    raw += b' ' * (-len(raw) % 4)
    blob.extend(b'\0' * (-len(blob) % 4))
    return (struct.pack('<III', 0x46546c67, 2, 28 + len(raw) + len(blob)) +
            struct.pack('<II', len(raw), 0x4e4f534a) + raw +
            struct.pack('<II', len(blob), 0x004e4942) + blob)


def supplemental_assets(catalogue, exported, assets):
    """Copy verified emission data without altering model/image geometry."""
    files = {}
    for reference in catalogue.get('meshDeaths', {}).get('models', []):
        path = reference['path']
        if not re.fullmatch(r'death/[0-9a-f]{64}\.json\.gz', path):
            raise ValueError('Invalid model-death asset path')
        source = (exported / path) if exported is not None else (assets / path)
        data = source.read_bytes()
        if len(data) != reference['bytes'] or sha(data) != reference['sha256']:
            raise ValueError('Model-death source changed: ' + reference['model'])
        decoded = gzip.decompress(data)
        if len(decoded) != reference['decodedBytes'] or sha(decoded) != reference['decodedSha256']:
            raise ValueError('Model-death transport mismatch')
        (assets / path).parent.mkdir(parents=True, exist_ok=True)
        if source.resolve() != (assets / path).resolve():
            (assets / path).write_bytes(data)
        files[path] = {'path': path, 'bytes': len(data), 'sha256': sha(data)}
    return files


def pack_catalogue(catalogue_file, exported, output):
    catalogue = json.loads(catalogue_file.read_text())
    assets = output / 'assets'
    (assets / 'models').mkdir(parents=True, exist_ok=True)
    (assets / 'images').mkdir(exist_ok=True)
    files, report = {}, []

    def image_sink(data, extension):
        digest = sha(data)
        path = f'images/{digest}.{extension}'
        if path not in files:
            (assets / path).write_bytes(data)
            files[path] = {'path': path, 'sha256': digest, 'bytes': len(data)}
        return path

    for n, model in enumerate(catalogue['models']):
        file = exported / model['path']
        raw = file.read_bytes()
        if sha(raw) != model['sha256']:
            raise ValueError(f'Source changed since catalogue: {file}')
        source = GLB(raw, file.parent)
        signature = semantic_fingerprint(source)
        packed = pack(source, image_sink)
        # Check the emitted file as the loader will see it, including images.
        check = GLB(packed, assets / 'models')
        check.uri = lambda uri: (assets / 'models' / uri).resolve().read_bytes()
        if semantic_fingerprint(check) != signature:
            raise ValueError(f'Lossless verification failed for {model["id"]}')
        compressed = gzip.compress(packed, compresslevel=9, mtime=0)
        if gzip.decompress(compressed) != packed:
            raise ValueError('Lossless transport verification failed')
        digest = sha(compressed)
        path = f'models/{digest}.glb.gz'
        if path not in files:
            (assets / path).write_bytes(compressed)
            files[path] = {'path': path, 'sha256': digest, 'bytes': len(compressed)}
        report.append({'id': model['id'], 'sourceBytes': len(raw), 'packedBytes': len(packed), 'transportBytes': len(compressed),
                       'semanticSha256': signature, 'sourceVertices': sum(a['count'] for i, a in enumerate(source.doc['accessors'])
                            if i in {p['attributes']['POSITION'] for m in source.doc['meshes'] for p in m['primitives']}),
                       'packedVertices': sum(a['count'] for i, a in enumerate(check.doc['accessors'])
                            if i in {p['attributes']['POSITION'] for m in check.doc['meshes'] for p in m['primitives']})})
        model.update(sourcePath=model['path'], sourceSha256=model['sha256'], sourceBytes=model['bytes'],
                     path=path, sha256=digest, bytes=len(compressed), semanticSha256=signature,
                     encoding='gzip', decodedBytes=len(packed), decodedSha256=sha(packed))
        if n % 20 == 0 or n + 1 == len(catalogue['models']):
            print(f'Packed and verified {n + 1}/{len(catalogue["models"])} models', flush=True)
    for texture in catalogue['textures']:
        data = (exported / texture['path']).read_bytes()
        if sha(data) != texture['sha256']:
            raise ValueError('Source texture changed: ' + texture['id'])
        texture.update(sourcePath=texture['path'], path=image_sink(data, 'png'))
    files.update(supplemental_assets(catalogue, exported, assets))
    catalogue.update(assetDirectory='assets', assets=sorted(files.values(), key=lambda v: v['path']))
    summary = {'models': len(report), 'sourceModelBytes': sum(r['sourceBytes'] for r in report),
               'uniqueModelBytes': sum(f['bytes'] for f in files.values() if f['path'].startswith('models/')),
               'uniqueImageBytes': sum(f['bytes'] for f in files.values() if f['path'].startswith('images/')),
               'uniqueEmissionBytes': sum(f['bytes'] for f in files.values() if f['path'].startswith('death/')),
               'totalAssetBytes': sum(f['bytes'] for f in files.values()),
               'allDrawStreamsAnimationsSkinsAndImagesVerified': True}
    pending = output / 'catalogue.pending.json'
    pending.write_text(json.dumps(catalogue, separators=(',', ':')) + '\n')
    pending.replace(output / 'catalogue.json')
    summary['catalogueBytes'] = (output / 'catalogue.json').stat().st_size
    summary['assetAndCatalogueBytes'] = summary['totalAssetBytes'] + summary['catalogueBytes']
    (output / 'packing-report.json').write_text(json.dumps({'summary': summary, 'models': report}, indent=2) + '\n')
    # Only prune content-addressed files created by this packer. Originals are
    # outside this directory, and unrelated notes/files are never removed.
    for file in assets.rglob('*'):
        if file.is_file() and str(file.relative_to(assets)) not in files and re.fullmatch(r'[0-9a-f]{64}\.(?:glb(?:\.gz)?|png|jpg)', file.name):
            file.unlink()
    print(json.dumps(summary, indent=2), flush=True)


def refresh_metadata(catalogue_file, output, exported=None):
    """Reuse verified packed bytes when only source-analysis metadata changes.

    Compare every source asset identity, report entry and stored-file hash before
    replacing the catalogue. A changed model or image requires normal packing.
    """
    current = json.loads(catalogue_file.read_text())
    previous_file = output / 'catalogue.json'
    previous = json.loads(previous_file.read_text())
    report = json.loads((output / 'packing-report.json').read_text())
    if not report['summary'].get('allDrawStreamsAnimationsSkinsAndImagesVerified'):
        raise ValueError('No complete prior semantic verification')
    old_models = {model['id']: model for model in previous['models']}
    old_textures = {texture['id']: texture for texture in previous['textures']}
    if set(old_models) != {model['id'] for model in current['models']} or \
            set(old_textures) != {texture['id'] for texture in current['textures']} or \
            set(old_models) != {model['id'] for model in report['models']}:
        raise ValueError('Asset set changed; repack the complete catalogue')
    signatures = {model['id']: model['semanticSha256'] for model in report['models']}
    for model in current['models']:
        old = old_models[model['id']]
        if (model['path'], model['sha256'], model['bytes']) != \
                (old['sourcePath'], old['sourceSha256'], old['sourceBytes']) or \
                signatures[model['id']] != old['semanticSha256']:
            raise ValueError('Source model changed: ' + model['id'])
        for key in ('path', 'sha256', 'bytes', 'sourcePath', 'sourceSha256', 'sourceBytes',
                    'semanticSha256', 'encoding', 'decodedBytes', 'decodedSha256'):
            model[key] = old[key]
    for texture in current['textures']:
        old = old_textures[texture['id']]
        if (texture['path'], texture['sha256'], texture['bytes']) != \
                (old['sourcePath'], old['sha256'], old['bytes']):
            raise ValueError('Source texture changed: ' + texture['id'])
        texture.update(sourcePath=texture['path'], path=old['path'])
    assets = (output / 'assets').resolve()
    for asset in previous['assets']:
        path = (assets / asset['path']).resolve()
        if not path.is_relative_to(assets):
            raise ValueError('Packed asset is outside asset directory')
        data = path.read_bytes()
        if len(data) != asset['bytes'] or sha(data) != asset['sha256']:
            raise ValueError('Stored packed asset changed: ' + asset['path'])
    emission = supplemental_assets(current, exported, assets)
    files = {a['path']: a for a in previous['assets'] if not a['path'].startswith('death/')}
    files.update(emission)
    current.update(assetDirectory='assets', assets=sorted(files.values(), key=lambda v: v['path']))
    pending = output / 'catalogue.pending.json'
    pending.write_text(json.dumps(current, separators=(',', ':')) + '\n')
    report['metadataRefresh'] = {'sourceCatalogueSha256': sha(catalogue_file.read_bytes()),
                                 'previousCatalogueSha256': sha(previous_file.read_bytes()),
                                 'storedAssetHashesVerified': len(previous['assets'])}
    pending.replace(previous_file)
    summary = report['summary']
    summary['uniqueEmissionBytes'] = sum(a['bytes'] for a in emission.values())
    summary['totalAssetBytes'] = sum(a['bytes'] for a in files.values())
    summary['catalogueBytes'] = previous_file.stat().st_size
    summary['assetAndCatalogueBytes'] = summary['totalAssetBytes'] + summary['catalogueBytes']
    (output / 'packing-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(summary, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogue', type=Path, required=True)
    parser.add_argument('--exported', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--refresh-metadata', action='store_true', help='Reuse an exact verified asset pack')
    args = parser.parse_args()
    if args.refresh_metadata:
        refresh_metadata(args.catalogue, args.output, args.exported)
    else:
        if args.exported is None:
            parser.error('--exported is required for a full pack')
        pack_catalogue(args.catalogue, args.exported, args.output)


if __name__ == '__main__':
    main()
