#!/usr/bin/env python3
"""Map copies of authored Meshy assets: original surfaces, UVs and full atlases.

Drops duplicate distance LODs and unused rig/animation channels, bakes existing
node transforms, and uniformly normalizes bounds. It creates no prop geometry.
The source GLBs stay untouched. Every output records its exact source hash.
"""
from pathlib import Path
import copy,hashlib,io,json,re,sys,os,subprocess,tempfile
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
OUT=ROOT/'public/map-landmarks';OUT.mkdir(exist_ok=True)
SPECS=json.loads((HERE/'assets.json').read_text())
def matrix(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
 m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m

def pack(name,spec):
 source=ROOT/spec['source'];g=Glb(source);old=copy.deepcopy(g.document);binary=bytes(g.binary);surfaces=[]
 def visit(index,parent):
  n=old['nodes'][index]
  if re.search(r'LOD[1-9]|_low$',n.get('name',''),re.I):return
  world=parent@matrix(n)
  if 'mesh' in n:
   for p in old['meshes'][n['mesh']]['primitives']:
    attrs={k:g.read_accessor(i) for k,i in p['attributes'].items() if k in ['POSITION','NORMAL','TEXCOORD_0','COLOR_0']}
    pos=attrs['POSITION'];attrs['POSITION']=(np.c_[pos,np.ones(len(pos))]@world.T)[:,:3].astype('<f4')
    if 'NORMAL' in attrs:
     normal=attrs['NORMAL']@np.linalg.inv(world[:3,:3]);normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12);attrs['NORMAL']=normal.astype('<f4')
    indices=g.read_accessor(p['indices']).ravel() if 'indices' in p else np.arange(len(pos),dtype='<u4')
    surfaces.append((attrs,indices,p))
  for child in n.get('children',[]):visit(child,world)
 for index in old['scenes'][old.get('scene',0)]['nodes']:visit(index,np.eye(4))
 allpos=np.concatenate([a['POSITION'] for a,_,_ in surfaces]);lo=allpos.min(0);hi=allpos.max(0);span=hi-lo;extent=float(max(span));origin=(lo+hi)/2;origin[1]=lo[1]
 if not np.isfinite(allpos).all() or extent<=0:raise ValueError(name+' invalid original mesh')
 g.document={'asset':{'version':'2.0','generator':'Original Meshy surfaces, map atlas pack','extras':{'source':spec['source'],'originalUVsPreserved':True}},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':name,'mesh':0}],'meshes':[{'primitives':[]}],'accessors':[],'bufferViews':[],'materials':[],'textures':[],'images':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]};g.binary=bytearray();doc=g.document;materials={};texture_cache={}
 def texture(index):
  if index in texture_cache:return texture_cache[index]
  tex=old['textures'][index];image_index=tex.get('source',tex.get('extensions',{}).get('KHR_texture_basisu',{}).get('source'));img=old['images'][image_index];view=old['bufferViews'][img['bufferView']];start=view.get('byteOffset',0)
  encoded=binary[start:start+view['byteLength']]
  if img.get('mimeType')=='image/ktx2':
   cli=os.environ.get('MAP_KTX','/private/tmp/drowned-ktx-4.4.2/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/bin/ktx')
   with tempfile.TemporaryDirectory(prefix='map-atlas-') as tmp:
    inp=Path(tmp)/'input.ktx2';outp=Path(tmp)/'output.png';inp.write_bytes(encoded);subprocess.run([cli,'extract','--transcode','rgba8',str(inp),str(outp)],check=True,capture_output=True);encoded=outp.read_bytes()
  im=Image.open(io.BytesIO(encoded));alpha='A' in im.getbands() and im.getchannel('A').getextrema()[0]<255
  buf=io.BytesIO(encoded);mime='image/png' if img.get('mimeType')=='image/ktx2' else img.get('mimeType','image/png')
  while len(g.binary)%4:g.binary.append(0)
  image=len(doc['images']);bv=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(g.binary),'byteLength':len(buf.getvalue())});g.binary.extend(buf.getvalue());doc['images'].append({'bufferView':bv,'mimeType':mime});t=len(doc['textures']);doc['textures'].append({'source':image,'sampler':0});texture_cache[index]=t;return t
 def material(index):
  if index in materials:return materials[index]
  src=old.get('materials',[{}])[index];pbr=src.get('pbrMetallicRoughness',{});out={k:copy.deepcopy(src[k]) for k in ['name','doubleSided','alphaMode','alphaCutoff','emissiveFactor'] if k in src};out['pbrMetallicRoughness']={k:copy.deepcopy(pbr[k]) for k in ['baseColorFactor','metallicFactor','roughnessFactor'] if k in pbr};out['pbrMetallicRoughness'].setdefault('roughnessFactor',.85);out['pbrMetallicRoughness'].setdefault('metallicFactor',0)
  for owner,key in [(pbr,'baseColorTexture'),(pbr,'metallicRoughnessTexture'),(src,'emissiveTexture'),(src,'normalTexture'),(src,'occlusionTexture')]:
   if key in owner:
    val=copy.deepcopy(owner[key]);val['index']=texture(val['index']);(out['pbrMetallicRoughness'] if owner is pbr else out)[key]=val
  materials[index]=len(doc['materials']);doc['materials'].append(out);return materials[index]
 for attrs,indices,p in surfaces:
  attrs['POSITION']=(attrs['POSITION']-origin)/extent;output={}
  for key,array in attrs.items():
   olda=old['accessors'][p['attributes'][key]];component=olda['componentType'];i=g.add_accessor(array.astype('<f4') if component==5126 else array,component,olda['type'],34962);output[key]=i
   if olda.get('normalized'):doc['accessors'][i]['normalized']=True
   if key=='POSITION':doc['accessors'][i].update(min=array.min(0).tolist(),max=array.max(0).tolist())
  primitive={'attributes':output,'indices':g.add_accessor(indices.astype('<u4').reshape(-1,1),5125,'SCALAR',34963),'material':material(p.get('material',0))};doc['meshes'][0]['primitives'].append(primitive)
 target=OUT/(name+'.glb');g.save(target)
 return {'source':spec['source'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'triangles':sum(len(i)//3 for _,i,_ in surfaces),'size':(span/extent).tolist(),'textures':'original full resolution; no atlas downsampling','triangleReduction':False,'distanceLod':False,'originalUVsPreserved':True,'geometry':'original near surfaces; existing node transforms baked; duplicate LODs omitted','generation':spec.get('generation')}
manifest_path=OUT/'manifest.json';manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
for name in sys.argv[1:] or SPECS:
 if not (ROOT/SPECS[name]['source']).exists():print('Pending:',name);continue
 manifest[name]=pack(name,SPECS[name]);print(name,manifest[name]['bytes'],manifest[name]['triangles'])
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print('TOTAL',len(manifest),round(sum(x['bytes'] for x in manifest.values())/1e6,2),'MB')
