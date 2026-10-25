"""Web textures only: retain every native triangle, UV, skin weight and PBR map."""
from pathlib import Path
import hashlib, io, json, struct, sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.img2threejs/rooftop-kook'; OUT=ROOT/'public/rooftop-kook'
for name in sys.argv[1:]:
 source=WORK/(name+'-rig')/'downloads/rigged_character.glb' if name in ('karen','kook','karen-rain','kook-rain') else WORK/(name+'-native.glb')
 raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
 doc=json.loads(raw[20:20+n]);binary=raw[28+n:];packed=bytearray()
 images={i['bufferView']:(index,i) for index,i in enumerate(doc.get('images',[]))}
 base={doc['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] for m in doc['materials']}
 resolutions=[]
 for index,view in enumerate(doc['bufferViews']):
  data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  if index in images:
   image_index,definition=images[index];resolution=(2048 if image_index in base else 1024) if name=='heirloom-shotgun' else (4096 if image_index in base else 2048)
   im=Image.open(io.BytesIO(data)).convert('RGB');im.thumbnail((resolution,resolution),Image.Resampling.LANCZOS)
   buffer=io.BytesIO();im.save(buffer,'JPEG',quality=95 if image_index in base else 98,optimize=True,subsampling=0)
   data=buffer.getvalue();definition['mimeType']='image/jpeg';resolutions.append(im.size)
  packed.extend(b'\0'*(-len(packed)%4));view['byteOffset']=len(packed);view['byteLength']=len(data);packed.extend(data)
 for sampler in doc.get('samplers',[]):sampler.update(minFilter=9987,magFilter=9729)
 doc['asset']['generator']='Rooftop native Meshy PBR pack; geometry, UVs and skinning unchanged'
 doc['buffers']=[{'byteLength':len(packed)}]
 data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*(-len(data)%4);packed.extend(b'\0'*(-len(packed)%4))
 final=struct.pack('<III',0x46546c67,2,28+len(data)+len(packed))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(packed),0x004e4942)+packed
 target=OUT/(name+'.glb');target.write_bytes(final)
 triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
 manifest={'name':name,'bytes':len(final),'sha256':hashlib.sha256(final).hexdigest(),'triangles':triangles,
  'nativeGeometryPreserved':True,'skinAndUVsPreserved':True,'pbrPreserved':True,'textureSizes':resolutions,'source':str(source.relative_to(ROOT))}
 existing=OUT/(name+'.json')
 if existing.exists():manifest={**json.loads(existing.read_text()),**manifest}
 existing.write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
