"""Connect measured loose Meshy vine leaves with four thin, animated stems.

Preserves the accepted leaf/branch geometry, UVs, one atlas and both LODs.
Run after pack.py and before compress_gpu.py. Re-running is a no-op.
"""
from pathlib import Path
import json,struct,math,hashlib,io
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/treehouse-trials-v3'
path=OUT/'canopy-bough.glb';raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+length]);binary=bytearray(raw[28+length:])
if doc['asset'].get('extras',{}).get('connectedVines'):raise SystemExit('Vines already connected')
chains=[
 [[-.17,.035,.15],[-.176,.22,.15],[-.20,.46,.145],[-.197,.60,.145]],
 [[-.078,.07,.003],[-.10,.30,.016],[-.098,.46,.006],[-.11,.60,.01]],
 [[-.061,.20,-.024],[-.039,.40,-.056],[-.027,.53,-.08],[-.02,.62,-.08]],
 [[.184,.065,.002],[.166,.32,.01],[.135,.47,-.004],[.124,.60,-.015]],
]
def values(id):
 a=doc['accessors'][id];v=doc['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 fmt,size={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)}[a['componentType']]
 start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*size)
 return [list(struct.unpack_from('<'+fmt*n,binary,start+i*stride)) for i in range(a['count'])]
def append(rows,kind,integer=False):
 binary.extend(b'\0'*(-len(binary)%4));start=len(binary);flat=[v for row in rows for v in row]
 binary.extend(struct.pack('<'+('I' if integer else 'f')*len(flat),*flat))
 view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start,'target':34963 if integer else 34962})
 index=len(doc['accessors']);a={'bufferView':view,'componentType':5125 if integer else 5126,'count':len(rows),'type':kind}
 if kind=='VEC3':a.update(min=[min(row[i] for row in rows) for i in range(3)],max=[max(row[i] for row in rows) for i in range(3)])
 doc['accessors'].append(a);return index
def norm(v):
 d=math.sqrt(sum(x*x for x in v));return [x/d for x in v]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
image=doc['images'][doc['textures'][doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
view=doc['bufferViews'][image['bufferView']];im=Image.open(io.BytesIO(binary[view['byteOffset']:view['byteOffset']+view['byteLength']])).convert('RGB')
added=[]
for meshIndex,mesh in enumerate(doc['meshes']):
 for primitive in mesh['primitives']:
  arrays={key:values(id) for key,id in primitive['attributes'].items()};positions=arrays['POSITION'];indices=values(primitive['indices'])
  lo=[min(v[i] for v in positions) for i in range(3)];span=[max(v[i] for v in positions)-lo[i] for i in range(3)]
  uv=[.5,.5]
  for pos,tex in zip(positions,arrays['TEXCOORD_0']):
   color=im.getpixel((min(im.width-1,max(0,int(tex[0]*im.width))),min(im.height-1,max(0,int(tex[1]*im.height)))))
   if pos[0]<lo[0]+span[0]*.2 and color[0]>color[1]*1.1 and color[1]>color[2]*1.2 and 45<color[0]<130:uv=tex;break
  before=len(indices)//3;segments=4 if meshIndex==0 else 2
  for chain in chains:
   points=[]
   for a,b in zip(chain,chain[1:]):
    for step in range(segments):points.append([a[i]+(b[i]-a[i])*step/segments for i in range(3)])
   points.append(chain[-1]);start=len(positions)
   world=[[lo[0]+(p[0]+.5)*span[0],lo[1]+p[1]*span[1],lo[2]+(p[2]+.5)*span[2]] for p in points]
   for i,(q,p) in enumerate(zip(world,points)):
    a=world[max(0,i-1)];b=world[min(len(world)-1,i+1)];tangent=norm([b[k]-a[k] for k in range(3)])
    u=norm(cross(tangent,[0,0,1]));v=cross(tangent,u)
    for side in range(4):
     angle=side*math.pi/2;normal=[u[k]*math.cos(angle)+v[k]*math.sin(angle) for k in range(3)]
     new={'POSITION':[q[k]+normal[k]*span[0]*.0018 for k in range(3)],'NORMAL':normal,'TEXCOORD_0':uv,
      '_JUNGLE_AO':[.92],'_WIND_FLEX':[.35*min(1,max(0,(.6-p[1])/.55))],'TANGENT':tangent+[1]}
     for key,rows in arrays.items():rows.append(new.get(key,[0]*len(rows[0])))
   for i in range(len(points)-1):
    for side in range(4):
     a=start+i*4+side;b=start+i*4+(side+1)%4;c=a+4;d=b+4
     indices.extend([[a],[b],[c],[b],[d],[c]])
  for key,rows in arrays.items():primitive['attributes'][key]=append(rows,{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[len(rows[0])])
  primitive['indices']=append(indices,'SCALAR',True);added.append(len(indices)//3-before)
doc['asset'].setdefault('extras',{})['connectedVines']={'normalizedChains':chains,'addedTriangles':added,'radiusRelativeToWidth':.0018}
doc['buffers']=[{'byteLength':len(binary)}];encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);binary.extend(b'\0'*(-len(binary)%4))
output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
path.write_bytes(output)
manifestPath=OUT/'canopy-bough-manifest.json';manifest=json.loads(manifestPath.read_text())
manifest.update(triangles=manifest['triangles']+added[0],lodTriangles=manifest['lodTriangles']+added[1],bytes=len(output),sha256=hashlib.sha256(output).hexdigest(),connectedVines=doc['asset']['extras']['connectedVines'])
manifestPath.write_text(json.dumps(manifest,indent=2)+'\n');print('Connected vine stems:',added,'added near/far triangles')
