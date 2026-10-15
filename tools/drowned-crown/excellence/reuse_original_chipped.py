#!/usr/bin/env python3
"""Reuse the existing Meshy chipped plank and its original material for woodpaths."""
from pathlib import Path
import hashlib
import json
import sys

import numpy as np

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import matrices

source=ROOT/'public/drowned-crown/boards/plank-chipped.glb'
g=Glb(source);d=g.document;worlds=matrices(d)
index=next(i for i,n in enumerate(d['nodes']) if 'mesh' in n)
prim=d['meshes'][d['nodes'][index]['mesh']]['primitives'][0];a=prim['attributes']
w=worlds[index];p=g.read_accessor(a['POSITION'])@w[:3,:3].T+w[:3,3]
n=g.read_accessor(a['NORMAL'])@np.linalg.inv(w[:3,:3])
n/=np.linalg.norm(n,axis=1,keepdims=True)
uv=g.read_accessor(a['TEXCOORD_0']);ids=g.read_accessor(prim['indices']).ravel()
lo=p.min(0);hi=p.max(0);span=hi-lo
unit_p=(p-(lo+hi)/2)/span
unit_n=n*span;unit_n/=np.linalg.norm(unit_n,axis=1,keepdims=True)
assert np.max(abs(unit_p*span+(lo+hi)/2-p))<1e-12
restored_n=unit_n/span;restored_n/=np.linalg.norm(restored_n,axis=1,keepdims=True)
assert np.max(abs(restored_n-n))<1e-12
geometry={'positions':unit_p.ravel().tolist(),'normals':unit_n.ravel().tolist(),'uvs':uv.ravel().tolist(),'indices':ids.tolist()}
(ROOT/'src/drownedPlank.generated.ts').write_text('/** Original Meshy chipped plank: exact UVs, original normals, reversible unit-envelope placement. */\nexport const DROWNED_PLANK_DATA='+json.dumps(geometry,separators=(',',':'))+' as const;\n')
material=d['materials'][prim.get('material',0)]
assert not material.get('normalTexture') and not material['pbrMetallicRoughness'].get('metallicRoughnessTexture')
texture=d['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
image=d['images'][texture['source']];assert image['mimeType']=='image/jpeg'
view=d['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0)
image_bytes=bytes(g.binary[offset:offset+view['byteLength']])
color=ROOT/'public/boardwalk/drowned-plank-color.jpg';color.write_bytes(image_bytes)
for old in ['drowned-plank-normal.jpg','drowned-plank-metalrough.jpg']:
    (ROOT/'public/boardwalk'/old).unlink(missing_ok=True)
report={'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'triangles':len(ids)//3,'vertices':len(p),'sourcePrincipalSize':span.tolist(),
        'originalUVsExactlyPreserved':True,'originalNormalsPreservedUnderReversibleEnvelopeFit':True,
        'originalProviderTextureBytesPreserved':True,'material':material,
        'color':str(color.relative_to(ROOT)),'colorSha256':hashlib.sha256(image_bytes).hexdigest(),
        'newGeometryAuthored':False,'newTexturePainted':False,'newProviderCredits':0}
(HERE/'original-chipped-plank-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
