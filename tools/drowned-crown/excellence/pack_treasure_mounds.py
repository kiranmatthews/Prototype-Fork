#!/usr/bin/env python3
"""Pack complete provider-authored heaps; keep all geometry and original UVs exact."""
from pathlib import Path
import hashlib, io, json, sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path[:0]=[str(ROOT/'tools/enemies'),str(ROOT/'tools')]
from glb_rig import Glb
from prepare_meshy_walk import world_vertices
from texture_resampling import resize_map
SPECS=json.loads((HERE/'assets.json').read_text());TASKS=json.loads((HERE/'tasks.json').read_text())['tasks']
sha=lambda b:hashlib.sha256(b).hexdigest()
reports=[];registrations=[]
for name in ['treasure-mound-shallow','treasure-mound-bank','treasure-mound-hero']:
 spec=SPECS[name];assert not spec.get('rejected');job=name+'-textured';task=TASKS[job];assert task['state']=='SUCCEEDED'
 source=ROOT/'.img2threejs/drowned-crown/excellence/meshy'/job/'downloads/model.glb'
 g=Glb(source);d=g.document;original=bytes(g.binary);accessors=[g.read_accessor(i) for i in range(len(d['accessors']))]
 assert len(d['materials'])==1 and not d.get('skins') and not d.get('animations')
 material=d['materials'][0];pbr=material['pbrMetallicRoughness']
 assert pbr.get('metallicRoughnessTexture') and material.get('normalTexture')
 triangles=0
 for mesh in d['meshes']:
  for primitive in mesh['primitives']:
   for attr in ['POSITION','NORMAL','TEXCOORD_0']:assert np.isfinite(g.read_accessor(primitive['attributes'][attr])).all()
   indices=g.read_accessor(primitive['indices']).ravel();assert len(indices)%3==0 and indices.min()>=0 and indices.max()<len(g.read_accessor(primitive['attributes']['POSITION']))
   triangles+=len(indices)//3
 assert triangles<=spec['triangles']*1.15,('Triangle budget exceeded',name,triangles)
 points=world_vertices(g);span=np.ptp(points,axis=0);size=(span*(spec['size'][0]/span[0])).round(5)
 assert size[1]>size[0]*.1,('Expected a complete volumetric heap',size)
 roles={}
 for role,info in [('baseColorTexture',pbr['baseColorTexture']),('normalTexture',material['normalTexture']),('metallicRoughnessTexture',pbr['metallicRoughnessTexture'])]:
  image=d['textures'][info['index']]['source'];assert image not in roles;roles[image]=role
 replacements={};images=[]
 for index,image in enumerate(d.get('images',[])):
  role=roles.get(index,'data');limit={'baseColorTexture':2048,'normalTexture':512}.get(role,256)
  view=d['bufferViews'][image['bufferView']];start=view.get('byteOffset',0);raw=original[start:start+view['byteLength']]
  source_image=Image.open(io.BytesIO(raw)).convert('RGBA');ratio=min(1,limit/max(source_image.size));dimensions=tuple(max(1,round(n*ratio))for n in source_image.size)
  resized=resize_map(source_image,dimensions,role) if dimensions!=source_image.size else source_image
  ref=np.asarray(resized).astype(np.int16);encoded=None;metrics=None
  for quality,lossless in ([(90,False),(95,False),(100,True)] if role=='baseColorTexture' else [(100,True)]):
   buffer=io.BytesIO();resized.save(buffer,format='WEBP',quality=quality,lossless=lossless,method=6,exact=True);data=buffer.getvalue();decoded=Image.open(io.BytesIO(data)).convert('RGBA')
   diff=np.abs(np.asarray(decoded).astype(np.int16)-ref);assert diff[:,:,3].max()==0
   mse=float(np.mean(diff[:,:,:3].astype(np.float64)**2));psnr=10*np.log10(255**2/mse) if mse else None
   metrics={'quality':quality,'lossless':lossless,'psnr':psnr,'p99':float(np.percentile(diff[:,:,:3],99)),'maxError':int(diff[:,:,:3].max())}
   if lossless or psnr>=40 and metrics['p99']<=8 and metrics['maxError']<=64:encoded=data;break
  assert encoded is not None
  replacements[image['bufferView']]=encoded;image['mimeType']='image/webp'
  images.append({'index':index,'role':role,'sourceSize':list(source_image.size),'size':list(dimensions),'sourceBytes':len(raw),'bytes':len(encoded),'sha256':sha(encoded),'filter':'linear-light Lanczos3 with mild sharpening' if role=='baseColorTexture' else 'vector Lanczos3 and renormalization' if role=='normalTexture' else 'linear Lanczos3',**metrics})
 for texture in d.get('textures',[]):
  index=texture.pop('source');texture.setdefault('extensions',{})['EXT_texture_webp']={'source':index}
 for key in ['extensionsUsed','extensionsRequired']:d[key]=list(dict.fromkeys(d.get(key,[])+['EXT_texture_webp']))
 packed=bytearray()
 for index,view in enumerate(d['bufferViews']):
  assert view.get('buffer',0)==0 and not view.get('extensions')
  while len(packed)%4:packed.append(0)
  start=view.get('byteOffset',0);data=replacements.get(index,original[start:start+view['byteLength']]);view.update(byteOffset=len(packed),byteLength=len(data));packed.extend(data)
 g.binary=packed
 for i,values in enumerate(accessors):assert np.array_equal(values,g.read_accessor(i)),('Packing changed geometry/UV/normal accessor',i)
 d['asset'].setdefault('extras',{}).update(provider='Meshy',taskId=task['id'],wholeTreasureMound=True,originalGeometryAccessorsPreserved=True)
 target=ROOT/'public/drowned-crown/excellence'/(name+'.glb');g.save(target)
 report={'name':name,'kind':spec['kind'],'taskId':task['id'],'source':str(source.relative_to(ROOT)),'sourceSha256':sha(source.read_bytes()),'output':str(target.relative_to(ROOT)),'sha256':sha(target.read_bytes()),'bytes':target.stat().st_size,'triangles':triangles,'size':size.tolist(),'sourceMaterial':material,'images':images,'allOriginalAccessorsExact':True,'uniformScaleOnly':True,'runtimeMaterial':{'normalStrength':.36,'metalness':.62,'roughness':.7,**spec.get('runtimeMaterial',{})}}
 reports.append(report)
 look=','.join(f'{key}:{json.dumps(value)}' for key,value in {'normalStrength':.36,'metalness':.62,'roughness':.7,**spec.get('runtimeMaterial',{})}.items())
 registrations.append(f" {spec['kind']}:{{file:'../drowned-crown/excellence/{name}',label:'Drowned Crown · complete Meshy {name.replace('-',' ')}',size:{json.dumps(size.tolist())},wind:false,{look},cellSize:16,doubleSided:false}},")
 print(json.dumps({k:report[k] for k in ['name','triangles','size','bytes']}))
credits=sum(task.get('consumedCredits',task.get('estimatedCredits',0)) for name,task in TASKS.items() if name.startswith('treasure-mound-'))
(HERE/'treasure-mounds-manifest.json').write_text(json.dumps({'assets':reports,'newGenerationCredits':credits,'rejectedModels':['treasure-mound-high','treasure-mound-low','treasure-mound-spill','treasure-mound-ridge'],'packing':'All original geometry, normal and UV accessors exact. All three heaps retain provider PBR maps: linear-light sharpened 2K colour, vector-filtered 512px normals and 256px packed material data. Only uniform physical scaling.'},indent=2)+'\n')
(ROOT/'src/drownedCrownTreasure.generated.ts').write_text('/** Complete Meshy mounds, measured in metres with their original proportions. */\nexport const DROWNED_CROWN_TREASURE_MODELS={\n'+'\n'.join(registrations)+'\n} as const;\n')
