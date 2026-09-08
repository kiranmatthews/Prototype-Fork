"""Record the measured, closed clay meshes; never re-publish retired raw models."""
import hashlib
import json
import struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/map-kit'
audit=json.loads((ROOT/'tools/map-kit/clay-geometry-audit.json').read_text())
report=[]
for row in audit:
    raw=(OUT/(row['file']+'.glb')).read_bytes()
    length=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+length])
    counts=[sum(gltf['accessors'][p['indices']]['count']//3 for p in mesh['primitives']) for mesh in gltf['meshes']]
    assert counts==[row['near']['triangles'],row['far']['triangles']]
    assert all(0<n<15000 for n in counts)
    assert not gltf.get('textures') and all(not m.get('doubleSided',False) for m in gltf['materials'])
    report.append({'file':row['file'],'size':row['size'],'triangles':counts[0],'lodTriangles':counts[1],
        'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'colour':'opaque vertex colour','textures':0,
        'closedSolid':True,'nearTopology':row['near'],'farTopology':row['far']})
(OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
