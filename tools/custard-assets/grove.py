"""Assemble five differently oriented copies of the approved Meshy willow.

Geometry and its PBR atlas are referenced once in the GLB. The scenery loader
merges the authored grove into one near/far draw per cell, reducing editor work.
"""
from pathlib import Path
import copy,hashlib,json,math,struct
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/custard-creek'
raw=(OUT/'willow-forest.glb').read_bytes();n=struct.unpack_from('<I',raw,12)[0]
d=json.loads(raw[20:20+n]);binary=raw[28+n:];roots=d['scenes'][0]['nodes'];original=copy.deepcopy(d['nodes'])
d['nodes']=[];scene=[];bounds=[]
mesh=d['meshes'][original[roots[0]]['mesh']]['primitives'][0]
acc=d['accessors'][mesh['attributes']['POSITION']];view=d['bufferViews'][acc['bufferView']]
start=view.get('byteOffset',0)+acc.get('byteOffset',0);stride=view.get('byteStride',12)
points=[struct.unpack_from('<fff',binary,start+i*stride) for i in range(acc['count'])]
for i,(x,z,angle) in enumerate([(-1.8,-.12,.3),(-.9,.17,1.7),(0,-.18,3.0),(.9,.15,4.2),(1.8,-.10,5.6)]):
    children=[]
    for root in roots:
        node=copy.deepcopy(original[root]);node['name']=str(i)+'_'+node['name'];children.append(len(d['nodes']));d['nodes'].append(node)
    scene.append(len(d['nodes']));d['nodes'].append({'name':'Custard willow grove '+str(i),'children':children,
      'translation':[x,0,z],'rotation':[0,math.sin(angle/2),0,math.cos(angle/2)]})
    bounds.extend((p[0]*math.cos(angle)+p[2]*math.sin(angle)+x,p[1],-p[0]*math.sin(angle)+p[2]*math.cos(angle)+z) for p in points)
d['scenes']=[{'nodes':scene}]
size=[max(p[i] for p in bounds)-min(p[i] for p in bounds) for i in range(3)]
d['asset']['extras']['assembly']='Five approved Meshy willows with shared geometry and texture sources'
js=json.dumps(d,separators=(',',':')).encode();js+=b' '*(-len(js)%4)
glb=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
(OUT/'willow-thicket.glb').write_bytes(glb)
template=json.loads((OUT/'willow-forest-manifest.json').read_text())
report={'source':'willow-forest.glb','provider':'Meshy derivative assembly','copies':5,'sourceSizeXYZ':size,
  'sizeAtWidth94':[94,94*size[1]/size[0],94*size[2]/size[0]],'triangles':template['triangles']*5,'lodTriangles':template['lodTriangles']*5,
  'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest()}
(OUT/'willow-thicket-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
