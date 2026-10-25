"""Reuse the existing commissioned Meshy headland before the pirate route cuts.

Pass the downloaded crash-coastal-headland-remeshed model.glb as the argument.
The source model/UVs are preserved; only atlas encoding and a distant LOD change.
"""
from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/enemies'))
sys.path.insert(0,str(ROOT/'tools/waterslide-assets'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures
from add_lods import append_lod
source=Path(sys.argv[1]);target=ROOT/'public/waterslide/island-headland.glb'
g=Glb(source);original=[g.read_accessor(i).copy() for i in range(len(g.document['accessors']))]
textures=compact_textures(g,2048,94,data_limit=1024,lossless_data=True)
import numpy as np
for i,a in enumerate(original):assert np.array_equal(a,g.read_accessor(i))
g.save(target)
lod=append_lod(target,.16)
task=json.loads((ROOT/'tools/drowned-crown/excellence/tasks.json').read_text())['tasks']['crash-coastal-headland-remeshed']
proof={'provider':'Meshy','existingTaskId':task['id'],'reusedFrom':'Drowned Crown original uncut commissioned coastal headland',
 'creditsUsed':0,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceGeometryAndUVsUnchanged':True,
 'textures':textures,'distanceLod':lod,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
target.with_suffix('.provenance.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps({'nearTriangles':lod['nearTriangles'],'farTriangles':lod['triangles'],'bytes':target.stat().st_size,'creditsUsed':0}))
