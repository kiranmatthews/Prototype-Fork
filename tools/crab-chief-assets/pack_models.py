#!/usr/bin/env python3
"""Compact Meshy GLBs without changing geometry, weights or authored clips."""
from pathlib import Path
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--texture-size', type=int, default=1024)
parser.add_argument('--rigged', action='store_true')
args = parser.parse_args()
args.source = args.source.resolve()
args.output = args.output.resolve()
glb = Glb(args.source)
doc = glb.document
if args.rigged and not doc.get('skins'):
    raise ValueError('A rigged packing input must contain a deformation skin')
before = [hashlib.sha256(glb.read_accessor(i).tobytes()).hexdigest() for i in range(len(doc.get('accessors', [])))]
triangles = sum(doc['accessors'][p['indices']]['count']//3 if 'indices' in p else
    doc['accessors'][p['attributes']['POSITION']]['count']//3 for mesh in doc.get('meshes', []) for p in mesh['primitives'])
textures = compact_textures(glb, args.texture_size, 88)
doc.setdefault('asset', {}).setdefault('extras', {})['bossProvenance'] = {
    'provider':'Meshy', 'referenceProvider':'OpenAI imagegen', 'triangles':triangles,
    'sourceSha256':hashlib.sha256(args.source.read_bytes()).hexdigest(), 'geometryPreserved':True}
args.output.parent.mkdir(parents=True, exist_ok=True)
glb.save(args.output)
packed = Glb(args.output)
after = [hashlib.sha256(packed.read_accessor(i).tobytes()).hexdigest() for i in range(len(packed.document.get('accessors', [])))]
assert before == after, 'Packing changed geometry, weights, inverse binds or keyframes'
report = {'source':str(args.source.relative_to(ROOT)), 'output':str(args.output.relative_to(ROOT)),
    'triangles':triangles, 'bytes':args.output.stat().st_size, 'textures':textures,
    'skins':len(doc.get('skins',[])), 'animations':[a.get('name') for a in doc.get('animations',[])],
    'sourceSha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),
    'outputSha256':hashlib.sha256(args.output.read_bytes()).hexdigest(), 'accessorsPreserved':True}
args.output.with_suffix('.provenance.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report))
