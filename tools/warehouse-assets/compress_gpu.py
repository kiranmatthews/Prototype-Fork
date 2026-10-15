#!/usr/bin/env python3
"""GPU-compress accepted surfaces with the project's audited UASTC settings."""
from pathlib import Path
import copy,hashlib,io,json,math,os,struct,subprocess,sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
OUT=ROOT/'public/warehouse';WORK=ROOT/'.img2threejs/warehouse-art/gpu';WORK.mkdir(parents=True,exist_ok=True)
ENCODER=os.environ.get('WAREHOUSE_TOKTX','/private/tmp/nightworks-meshy/ktx/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/bin/toktx')
def digest(b):return hashlib.sha256(b).hexdigest()
def encode(raw,color,lower_left=False,normal=False):
 image=Image.open(io.BytesIO(raw));image.load();alpha='A' in image.getbands() and image.getchannel('A').getextrema()[0]<255
 source_size=image.size;alignment=b''
 if image.width%4 or image.height%4:
  limit=2**int(math.log2(max(image.size)));scale=min(1,limit/max(image.size));size=tuple(max(4,int(v*scale)//4*4) for v in image.size)
  image=image.resize(size,Image.Resampling.LANCZOS);alignment=('|aligned:'+str(size)).encode()
 codec='uastc' if normal or alpha else 'etc1s'
 key=digest(raw+color.encode()+b'|warehouse-gpu-v2'+str((lower_left,codec)).encode()+alignment);png=WORK/(key+'.png');ktx=WORK/(key+'.ktx2')
 image=image.convert('RGBA' if alpha else 'RGB')
 if not ktx.exists():
  image.save(png);options=['--encode','uastc','--uastc_quality','2','--zcmp','18'] if codec=='uastc' else ['--encode','etc1s','--qlevel','255','--clevel','3']
  subprocess.run([ENCODER,'--t2',*options,'--threads','2','--genmipmap','--assign_oetf',color,*(['--lower_left_maps_to_s0t0'] if lower_left else []),str(ktx),str(png)],check=True,capture_output=True)
 data=ktx.read_bytes();levels=struct.unpack_from('<I',data,40)[0]
 gpu=sum(((max(1,image.width>>m)+3)//4)*((max(1,image.height>>m)+3)//4)*(16 if codec=='uastc' or alpha else 8) for m in range(levels))
 return data,{'sourceSha256':digest(raw),'sha256':digest(data),'codec':codec,'sourceSize':source_size,'size':image.size,'mipLevels':levels,'gpuBlockBytes':gpu,'uncompressedRgbaBytes':sum(max(1,image.width>>m)*max(1,image.height>>m)*4 for m in range(levels)),'encodedBytes':len(data),'colorSpace':color,'orientation':'lower-left' if lower_left else 'glTF upper-left'}

manifest=json.loads((HERE/'asset-manifest.json').read_text())
for name in sys.argv[1:] or manifest:
 path=OUT/(name+'.glb');baseline=WORK/(name+'-uncompressed.glb')
 raw=path.read_bytes();g=Glb(path)
 if any(i.get('mimeType')=='image/ktx2' for i in g.document.get('images',[])):
  if not baseline.exists():raise ValueError('Missing authoring fallback '+name)
  raw=baseline.read_bytes();g=Glb(baseline)
 else:baseline.write_bytes(raw)
 doc=copy.deepcopy(g.document);source=bytes(g.binary);views=doc['bufferViews'];image_views={i['bufferView'] for i in doc['images']};newviews=[];binary=bytearray();remap={}
 def append(data,metadata=None):
  binary.extend(b'\0'*(-len(binary)%4));view=dict(metadata or {});view.update(buffer=0,byteOffset=len(binary),byteLength=len(data));newviews.append(view);binary.extend(data);return len(newviews)-1
 def chunk(i):
  v=views[i];a=v.get('byteOffset',0);return source[a:a+v['byteLength']]
 for i,v in enumerate(views):
  if i not in image_views:remap[i]=append(chunk(i),v)
 for accessor in doc['accessors']:accessor['bufferView']=remap[accessor['bufferView']]
 color_indices=set();normal_indices=set()
 for m in doc.get('materials',[]):
  if m.get('normalTexture'):normal_indices.add(m['normalTexture']['index'])
  for info in [m.get('pbrMetallicRoughness',{}).get('baseColorTexture'),m.get('emissiveTexture')]:
   if info:color_indices.add(info['index'])
 images=[];reports=[]
 for i,texture in enumerate(doc['textures']):
  image=doc['images'][texture['source']];data,report=encode(chunk(image['bufferView']),'srgb' if i in color_indices else 'linear',normal=i in normal_indices);reports.append(report)
  images.append({'name':name+'-gpu-'+str(i),'mimeType':'image/ktx2','bufferView':append(data)});texture.pop('source',None);texture.setdefault('extensions',{})['KHR_texture_basisu']={'source':len(images)-1}
 doc['images']=images;doc['bufferViews']=newviews;doc['buffers']=[{'byteLength':len(binary)}]
 for key in ['extensionsUsed','extensionsRequired']:doc[key]=sorted(set(doc.get(key,[])+['KHR_texture_basisu']))
 g.document=doc;g.binary=binary;g.save(path)
 record=manifest[name];record.update(bytes=path.stat().st_size,sha256=digest(path.read_bytes()),gpuTextures={'encoder':'Khronos toktx 4.4.2 / ETC1S quality 255; UASTC quality 2 for normals and alpha','geometryAndUvsUnchanged':True,'textures':reports})
 (OUT/(name+'.provenance.json')).write_text(json.dumps(record,indent=2)+'\n')
 print(name,round(sum(r['gpuBlockBytes'] for r in reports)/1048576,2),'MiB GPU blocks',flush=True)
(HERE/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
materials=json.loads((OUT/'materials/provenance.json').read_text());records=[];standalone=WORK/'standalone';standalone.mkdir(exist_ok=True)
for m in materials['maps']:
 path=ROOT/'public'/m['file'];webp=path.with_suffix('.webp');master=standalone/webp.name
 if webp.exists():master.write_bytes(webp.read_bytes())
 data,report=encode(master.read_bytes(),'srgb' if m['map']=='diff' else 'linear',True,normal=m['map']=='nor_gl');target=path.with_suffix('.ktx2');target.write_bytes(data)
 records.append({**m,'file':str(target.relative_to(ROOT/'public')),'gpuFile':str(target.relative_to(ROOT/'public')),'sha256':digest(data),'bytes':len(data),'encoding':'KTX2 UASTC; original WebP retained in ignored authoring cache','gpu':report})
 if webp.exists():webp.unlink()
graffiti=OUT/'graffiti.webp';master=standalone/'graffiti.webp'
if graffiti.exists():master.write_bytes(graffiti.read_bytes())
data,report=encode(master.read_bytes(),'srgb',True);(OUT/'graffiti.ktx2').write_bytes(data)
if graffiti.exists():graffiti.unlink()
(OUT/'materials/provenance.json').write_text(json.dumps({**materials,'maps':records},indent=2)+'\n')
(HERE/'gpu-textures.json').write_text(json.dumps({'materials':records,'graffiti':report},indent=2)+'\n')
