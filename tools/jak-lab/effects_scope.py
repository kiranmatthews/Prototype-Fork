"""Keep only effects and their necessary source assets in the lab project."""
import argparse
import copy
import gzip
import hashlib
import json
import posixpath
import re
import struct
from pathlib import Path

WARP_MODELS = {'sunken/generic-button-lod0', 'common/eichar-lod0'}
SPRITE_PAGES = {'effects', 'Hud', 'zoomerhud'}


def effects_only(source):
    catalogue = copy.deepcopy(source)
    if 'meshDeaths' not in catalogue:
        raise ValueError('Attach source mesh-disappearance metadata before selecting effect dependencies')
    references = [r for r in catalogue['meshDeaths']['models'] if r['events'] or r['model'] in WARP_MODELS]
    uses = {r['model']: ['mesh-disappearance'] for r in references}
    driver = catalogue.get('fuelCellHud')
    if driver:
        matches = [m for m in catalogue['models'] if m['name'] == driver['model']]
        if len(matches) != 1:
            raise ValueError('Expected one source HUD animation driver')
        uses.setdefault(matches[0]['id'], []).append('HUD animation driver')
    models = {m['id']: m for m in catalogue['models']}
    if set(uses) - models.keys() or any(models[id]['background'] for id in uses):
        raise ValueError('Effect has a missing or background model dependency')
    catalogue['models'] = [m for m in catalogue['models'] if m['id'] in uses]
    catalogue['meshDeaths']['models'] = references
    textures = {f['value'] for p in catalogue['particles'] for f in p['fields']
                if f['field'] == 'texture' and isinstance(f.get('value'), str) and not f['value'].startswith('@dynamic/')}
    if references:
        textures.add(catalogue['meshDeaths']['texture'])
    if textures - {t['id'] for t in catalogue['textures']}:
        raise ValueError('Missing source effect textures')
    # Preserve the source effect/HUD sprite pages for runtime texture variants,
    # not the thousands of unrelated object/scenery texture exports.
    catalogue['textures'] = [t for t in catalogue['textures'] if t['id'] in textures or t['id'].split('/')[0] in SPRITE_PAGES]
    original = source.get('effectsScope', {}).get('sourceCounts', {
        'models': len(source['models']), 'textures': len(source['textures']),
        'emissionStreams': len(source['meshDeaths']['models']),
    })
    catalogue['effectsScope'] = {'version': 1, 'sourceCounts': original,
        'modelUses': [{'id': id, 'uses': value} for id, value in sorted(uses.items())],
        'standaloneModels': 0, 'levelScenes': 0,
        'excludedModels': original['models'] - len(catalogue['models'])}
    catalogue['coverage'].update(exportedModels=len(catalogue['models']), exportedTextures=len(catalogue['textures']))
    return catalogue


def sha(data):
    return hashlib.sha256(data).hexdigest()


def contained(root, relative):
    file = (root / relative).resolve()
    if not file.is_relative_to(root.resolve()):
        raise ValueError('Asset path escapes its root: ' + relative)
    return file


def prune_pack(catalogue, output):
    """Reuse the verified bytes for an exact subset, including GLB image URIs.

    No source geometry is repacked, simplified or regenerated. Verify the old
    asset allowlist before changing the catalogue or deleting excluded files.
    """
    previous_file = output / 'catalogue.json'
    previous_bytes = previous_file.read_bytes()
    previous = json.loads(previous_bytes)
    report = json.loads((output / 'packing-report.json').read_text())
    if not report['summary']['allDrawStreamsAnimationsSkinsAndImagesVerified']:
        raise ValueError('Previous pack has no complete semantic verification')
    root = output / 'assets'
    files = {f['path']: f for f in previous['assets']}
    for relative, identity in files.items():
        data = contained(root, relative).read_bytes()
        if len(data) != identity['bytes'] or sha(data) != identity['sha256']:
            raise ValueError('Packed asset changed: ' + relative)
    result = copy.deepcopy(catalogue)
    old_models = {m['id']: m for m in previous['models']}
    old_textures = {t['id']: t for t in previous['textures']}
    old_reports = {m['id']: m for m in report['models']}
    wanted = set()
    for model in result['models']:
        old = old_models[model['id']]
        if (model['path'], model['sha256'], model['bytes']) != (old['sourcePath'], old['sourceSha256'], old['sourceBytes']):
            raise ValueError('Source model changed: ' + model['id'])
        if old['semanticSha256'] != old_reports[model['id']]['semanticSha256']:
            raise ValueError('Model verification mismatch')
        for key in ('path', 'sha256', 'bytes', 'sourcePath', 'sourceSha256', 'sourceBytes',
                    'semanticSha256', 'encoding', 'decodedBytes', 'decodedSha256'):
            model[key] = old[key]
        wanted.add(model['path'])
        decoded = gzip.decompress(contained(root, model['path']).read_bytes())
        if len(decoded) != model['decodedBytes'] or sha(decoded) != model['decodedSha256']:
            raise ValueError('Model transport mismatch')
        length, kind = struct.unpack_from('<II', decoded, 12)
        if kind != 0x4e4f534a:
            raise ValueError('Missing GLB JSON')
        document = json.loads(decoded[20:20 + length])
        for image in document.get('images', []):
            relative = posixpath.normpath(posixpath.join(posixpath.dirname(model['path']), image['uri']))
            contained(root, relative)
            wanted.add(relative)
    for texture in result['textures']:
        old = old_textures[texture['id']]
        if (texture['path'], texture['sha256'], texture['bytes']) != (old['sourcePath'], old['sha256'], old['bytes']):
            raise ValueError('Source texture changed: ' + texture['id'])
        texture.update(sourcePath=texture['path'], path=old['path'])
        wanted.add(texture['path'])
    for reference in result['meshDeaths']['models']:
        identity = files.get(reference['path'])
        if not identity or (identity['sha256'], identity['bytes']) != (reference['sha256'], reference['bytes']):
            raise ValueError('Emission dependency mismatch')
        wanted.add(reference['path'])
    if wanted - files.keys():
        raise ValueError('Effect references an unverified packed asset')
    result.update(assetDirectory='assets', assets=[files[p] for p in sorted(wanted)])
    removed = [files[p] for p in sorted(files.keys() - wanted)]
    for asset in removed:
        if not re.fullmatch(r'(?:models|images|death)/[0-9a-f]{64}\.(?:glb\.gz|png|jpg|json\.gz)', asset['path']):
            raise ValueError('Refusing to remove a non-packer file')
    report['models'] = [old_reports[m['id']] for m in result['models']]
    summary = report['summary']
    summary.update(models=len(result['models']), sourceModelBytes=sum(m['sourceBytes'] for m in report['models']),
        uniqueModelBytes=sum(f['bytes'] for f in result['assets'] if f['path'].startswith('models/')),
        uniqueImageBytes=sum(f['bytes'] for f in result['assets'] if f['path'].startswith('images/')),
        uniqueEmissionBytes=sum(f['bytes'] for f in result['assets'] if f['path'].startswith('death/')),
        totalAssetBytes=sum(f['bytes'] for f in result['assets']))
    encoded = (json.dumps(result, separators=(',', ':')) + '\n').encode()
    summary.update(catalogueBytes=len(encoded), assetAndCatalogueBytes=summary['totalAssetBytes'] + len(encoded))
    report['effectsPrune'] = {'previousCatalogueSha256': sha(previous_bytes), 'verifiedAssets': len(files),
                              'removedFiles': len(removed), 'removedBytes': sum(f['bytes'] for f in removed)}
    pending = output / 'catalogue.pending.json'; pending.write_bytes(encoded); pending.replace(previous_file)
    (output / 'packing-report.json').write_text(json.dumps(report, indent=2) + '\n')
    for asset in removed:
        contained(root, asset['path']).unlink()
    return {'summary': summary, 'removed': removed}


def prune_source_cache(catalogue, exported):
    wanted = {a['path'] for a in catalogue['models'] + catalogue['textures'] + catalogue['meshDeaths']['models']}
    removed = []
    for folder, pattern in [('levels', '*.glb'), ('textures', '*.png'), ('death', '*.json.gz')]:
        for file in sorted((exported / folder).rglob(pattern)):
            relative = str(file.relative_to(exported))
            if relative in wanted:
                continue
            contained(exported, relative)
            if file.is_symlink():
                raise ValueError('Source cache contains a symlink')
            removed.append({'path': relative, 'bytes': file.stat().st_size})
    for asset in removed:
        contained(exported, asset['path']).unlink()
    return {'removedFiles': len(removed), 'removedBytes': sum(a['bytes'] for a in removed), 'removed': removed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogue', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--packed', type=Path)
    parser.add_argument('--prune-source-cache', type=Path)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    catalogue = effects_only(json.loads(args.catalogue.read_text()))
    result = {'scope': catalogue['effectsScope']}
    if args.packed:
        result['packed'] = prune_pack(catalogue, args.packed)
    args.output.write_text(json.dumps(catalogue, separators=(',', ':')) + '\n')
    if args.prune_source_cache:
        result['sourceCache'] = prune_source_cache(catalogue, args.prune_source_cache)
    args.report.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'models': len(catalogue['models']), 'textures': len(catalogue['textures']),
        'disappearances': len(catalogue['meshDeaths']['models']), 'scope': 'effects-only',
        'packed': result.get('packed', {}).get('summary'),
        'sourceFilesRemoved': result.get('sourceCache', {}).get('removedFiles', 0)}, indent=2))


if __name__ == '__main__':
    main()
