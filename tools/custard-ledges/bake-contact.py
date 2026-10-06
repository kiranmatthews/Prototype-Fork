"""Bake the existing Carlisle ledge's exact upward LOD0 triangles.
No new provider job, fitted plane, or hidden rectangular collider is used.
"""
from pathlib import Path
import json,struct,hashlib
root=Path(__file__).resolve().parents[2]
source=root/'public/carlisle-coast-fidelity/ledge-root.glb'
b=source.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);blob=b[28+n:]
def attribute(index):
 a=d['accessors'][index];v=d['bufferViews'][a['bufferView']];size={'SCALAR':1,'VEC3':3}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']]
 stride=v.get('byteStride',struct.calcsize(fmt)*size);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*size,blob,offset+i*stride) for i in range(a['count'])]
p=d['meshes'][0]['primitives'][0];positions=attribute(p['attributes']['POSITION']);index=[x[0] for x in attribute(p['indices'])];vertices=[];indices=[];remap={}
for i in range(0,len(index),3):
 ids=index[i:i+3];a,b,c=[positions[j]for j in ids];u=[b[j]-a[j]for j in range(3)];v=[c[j]-a[j]for j in range(3)]
 normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=sum(x*x for x in normal)**.5
 if min(a[1],b[1],c[1])<.85 or not length or normal[1]/length<=.5:continue
 for old in ids:
  if old not in remap:remap[old]=len(vertices)//3;vertices.extend(round(v,6) for v in positions[old])
  indices.append(remap[old])
out=root/'src/levels/custard-ledge-contact.ts'
data={'vertices':vertices,'indices':indices}
out.write_text('// Exact visible cap from Carlisle ledge-root LOD0.\n// Asset attribution: public/carlisle-coast-fidelity/LICENSE.txt.\n// SHA256 '+hashlib.sha256(source.read_bytes()).hexdigest()+'\nexport const CUSTARD_LEDGE_CONTACT = '+json.dumps(data,separators=(',',':'))+';\n')
print(len(vertices)//3,'vertices',len(indices)//3,'triangles')
