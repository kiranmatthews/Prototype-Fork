#!/usr/bin/env python3
"""Prepare the Jak 1 character browser from the supplied game's official export.

Only data assets and measured facts are published. No GOAL expressions or AI
implementation are copied. Existing effect-lab assets and scope are untouched.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/jak-lab'))
from pack_assets import GLB, pack, semantic_fingerprint, sha
from merc_death import LinkedAssembly
from jak1_animation_data import read_animations, matching_animations, verify_exported_tracks, repair_animations
from jak1_statue import attach_statue
from audit_opengoal import measure, REVISION, LINK


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--source-tree', type=Path, required=True)
    parser.add_argument('--art-manifest', type=Path, required=True)
    args = parser.parse_args()
    source = args.project / 'goal_src'
    exported = args.project / 'decompiler_out/jak1'
    tree = json.loads(args.source_tree.read_text())
    assert tree['sha'] == REVISION and not tree.get('truncated')
    blobs = {row['path']: row['sha'] for row in tree['tree'] if row['type'] == 'blob'}
    art_provenance = json.loads(args.art_manifest.read_text())
    manifest = json.loads((ROOT / 'tools/enemies/opengoal-candidates.json').read_text())
    assert all(c['game'] == 'jak1' for c in manifest)
    directory = ROOT / 'public/enemies/jak1'
    assets = directory / 'assets'
    (assets / 'models').mkdir(parents=True, exist_ok=True)
    (assets / 'images').mkdir(exist_ok=True)
    files, records, verified = {}, [], set()
    old = json.loads((ROOT / 'public/jak-lab/catalogue.json').read_text())
    existing_models = {m['sha256']: m for m in old['models']}
    names = {}
    for file in sorted((exported / 'levels').rglob('*.glb')):
        if not re.search(r'-lod[1-9]\d*$', file.stem):
            names.setdefault(file.stem, []).append(file)
    art_table = json.loads((args.project / 'decompiler/config/jak1/ntsc_v1/art-group-info.min.json').read_text())
    groups = {name.removesuffix('-jg'): group for group, members in art_table.items()
              for _, name in members if name.endswith('-lod0-jg')}
    bank = {}

    def image_sink(data, extension):
        path = f'images/{sha(data)}.{extension}'
        (assets / path).write_bytes(data)
        files[path] = len(data)
        return path

    def evidence(relative):
        raw = (source / relative).read_bytes()
        digest = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        assert blobs['goal_src/' + relative] == digest, relative
        verified.add(relative)
        text = raw.decode()
        return dict(path=relative, sha256=sha(raw), url=LINK + relative,
                    states=[dict(name=m.group(1), line=text.count('\n', 0, m.start()) + 1)
                            for m in re.finditer(r'^\(defstate\s+([^\s()]+)', text, re.M)])

    for character in manifest:
        character['sources'] = [evidence(relative) for relative in character['sources']]
        if not character['sources']:
            character['sources'] = [evidence('jak1/engine/data/art-h.gc')]
        areas = set()
        for variant in character['variants']:
            name = variant['name']
            choices = []
            for file in names[name]:
                raw = file.read_bytes()
                glb = GLB(raw, file.parent)
                choices.append((len(glb.doc.get('animations', [])), -len(raw), file))
            file = max(choices)[2]
            raw = file.read_bytes()
            original = GLB(raw, file.parent)
            areas.update(p.parent.name for p in names[name])
            group = groups[name]
            if group not in bank:
                asm = exported / (group + '.asm')
                proof = art_provenance[group]
                assert sha(asm.read_bytes()) == proof['assemblySha256']
                assert sha((exported / 'raw_obj' / (group + '.go')).read_bytes()) == proof['rawSha256']
                assert proof['archives']
                assembly = LinkedAssembly(asm.read_text())
                bank[group] = read_animations(assembly)
            siblings = [n for n, g in groups.items() if g == group]
            joint_count = len(original.doc['skins'][0]['joints'])
            selected = matching_animations(bank[group], name, joint_count, siblings)
            checked = verify_exported_tracks(original, selected)
            repairs = repair_animations(original, selected, {a['name'] for a in bank[group]})
            if 'backgroundAssembly' in variant:
                assembly = variant['backgroundAssembly']
                background_path = exported / 'levels' / assembly['level'] / (assembly['level'] + '-background.glb')
                background_bytes = background_path.read_bytes()
                entities_path = exported / 'entities' / (assembly['level'] + '-actors.json')
                actor = next(a for a in json.loads(entities_path.read_text()) if a['etype'] == assembly['entity'])
                attach_statue(original, GLB(background_bytes, background_path.parent), actor, assembly['nodes'])
                assembly.update(sourceSha256=sha(background_bytes), entitiesSha256=sha(entities_path.read_bytes()), actorId=actor['aid'])
            signature = semantic_fingerprint(original)
            packed = pack(original, image_sink)
            check = GLB(packed, assets / 'models')
            check.uri = lambda uri: (assets / 'models' / uri).resolve().read_bytes()
            assert signature == semantic_fingerprint(check), name
            compressed = gzip.compress(packed, compresslevel=9, mtime=0)
            assert gzip.decompress(compressed) == packed
            digest = sha(compressed)
            path = f'models/{digest}.glb.gz'
            model = dict(path=path, sha256=digest, decodedSha256=sha(packed), decodedBytes=len(packed), sourceSha256=sha(raw))
            if digest in existing_models:
                stored = existing_models[digest]
                fact = measure(stored, ROOT / 'public/jak-lab')
            else:
                (assets / path).write_bytes(compressed)
                files[path] = len(compressed)
                fact = measure(model, directory)
                fact['path'] = 'enemies/jak1/assets/' + path
            variant.update(id=str(file.relative_to(exported / 'levels')).removesuffix('.glb'), asset=fact,
                           artGroup=group, sourceArtSha256=art_provenance[group]['rawSha256'],
                           animationRepair=repairs)
            records.append(dict(id=variant['id'], character=character['id'], group=group, originalSha256=sha(raw),
                                sourceArtSha256=variant['sourceArtSha256'], packedSha256=digest,
                                semanticSha256=signature, originalChannelsVerified=checked,
                                joints=joint_count, clips=len(fact['clips']), **repairs))
            if 'backgroundAssembly' in variant:
                records[-1]['backgroundAssembly'] = variant['backgroundAssembly']
            print(f"{character['id']}/{name}: {len(fact['clips'])} actions, {joint_count} joints; +{len(repairs['added'])} recovered", flush=True)
        character['areas'] = sorted(areas)
        character['availability'] = 'playable-clips'
    used = {v['name'] for c in manifest for v in c['variants']}
    variants = [v for c in manifest for v in c['variants']]
    # Prune only files owned by this character pack, after a successful generation.
    referenced_images = set()
    for v in variants:
        path = v['asset']['path']
        if path.startswith('enemies/jak1/'):
            doc = GLB(gzip.decompress((ROOT / 'public' / path).read_bytes())).doc
            referenced_images.update(i['uri'].removeprefix('../') for i in doc.get('images', []))
    for path in list(files):
        if path.startswith('images/') and path not in referenced_images:
            del files[path]
    for file in assets.rglob('*'):
        if file.is_file() and str(file.relative_to(assets)) not in files:
            file.unlink()
    summary = dict(characters=len(manifest), candidates=len(manifest), playableModels=len(variants),
                   exportedClips=sum(len(v['asset']['clips']) for v in variants),
                   timedClips=sum(a['duration'] > 0 for v in variants for a in v['asset']['clips']),
                   staticPoses=sum(a['duration'] == 0 for v in variants for a in v['asset']['clips']),
                   recoveredClips=sum(len(r['added']) for r in records),
                   removedWrongRigClips=sum(len(r['removedWrongRig']) for r in records),
                   addedAssetBytes=sum(files.values()))
    audit = dict(schemaVersion=2, auditedOn='2026-11-09', sourceRevision=REVISION,
                 sourceRelease='OpenGOAL v0.3.9 / supplied Jak 1 SCUS-97124',
                 scope='Jak 1 enemies, bosses, bystanders, companions and wildlife. Model variants are grouped under their character. No Jak II/3 entries.',
                 summary=summary, candidates=manifest)
    (ROOT / 'public/enemies/opengoal-audit.json').write_text(json.dumps(audit, separators=(',', ':')) + '\n')
    report = dict(summary=summary, verifiedSourceFiles=len(verified), sources=sorted(verified), models=records,
                  includedModelNames=sorted(used), excludedModelNames=sorted(set(names) - used),
                  exclusionScope='Player Jak, cameras, scenery, mechanical props, platforms, projectiles and detached non-character debris are outside this character browser.')
    (ROOT / 'docs/opengoal-enemy-audit/jak1-character-pack.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
