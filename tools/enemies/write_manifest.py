"""Write the public roster inventory from the actual final GLBs and provenance."""
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
LABELS = dict(grunt='Coral Crab', spiker='Bristleback', turtle='Mossback',
              charger='Russet Bull', hopper='Spring Frog', floater='Violet Watcher',
              sentry='Ember Sentry', spinner='Brass Whirler')
records = []
for kind, label in LABELS.items():
    path = ROOT / 'public/enemies' / (kind + '.glb')
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + length])
    spec = json.loads((ROOT / 'tools/enemies/rigs' / (kind + '.json')).read_text())
    digest = hashlib.sha256(data).hexdigest()
    if digest != spec['outputSha256']:
        raise ValueError(f'{kind}: model and reviewed provenance differ')
    record = dict(kind=kind, name=label, file=kind + '.glb', sha256=digest,
                  bytes=len(data), provider='Meshy', generationTaskId=spec['providerTaskId'],
                  generatedSurfaceSha256=spec.get('generatedSourceSha256', spec['sourceSha256']),
                  rig='Custom model-specific skin' if gltf.get('skins') else 'Articulated rigid parts',
                  triangles=sum(gltf['accessors'][p['indices']]['count'] // 3
                                for mesh in gltf['meshes'] for p in mesh['primitives']),
                  clips=[clip.get('name', '') for clip in gltf.get('animations', [])])
    if spec.get('walkSourceSha256'):
        record['walk'] = dict(provider='Meshy', sourceFbxSha256=spec['walkSourceSha256'],
                              adaptation='Model-specific IK retarget of existing user-owned quadruped walk',
                              sourceFps=60, sourceDurationSeconds=1)
    records.append(record)
manifest = dict(schemaVersion=1, referenceGenerator='OpenAI built-in image_gen',
                modelGenerationCredits=120, runtimeBytes=sum(r['bytes'] for r in records),
                enemies=records)
(ROOT / 'public/enemies/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{len(records)} enemies, {manifest["runtimeBytes"] / 1048576:.2f} MiB')
