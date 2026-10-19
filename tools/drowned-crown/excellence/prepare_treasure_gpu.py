"""Append full-resolution GPU colour maps; retain exact portable WebP fallbacks.
Run after pack_treasure_mounds.py and prepare_treasure_shadows.py.
CROWN_TOKTX points to the existing official toktx 4.4.2 executable.
"""
from pathlib import Path
import copy,hashlib,io,json,os,struct,subprocess,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'));from glb_rig import Glb
sha=lambda b:hashlib.sha256(b).hexdigest()
PROFILE={'encoder':'toktx 4.4.2','format':'UASTC','quality':4,'zstd':18,'mips':'Lanczos4','colorSpace':'sRGB','threads':2,'rdo':False}
work=ROOT/'.img2threejs/drowned-crown/excellence/treasure-gpu-candidates';work.mkdir(parents=True,exist_ok=True)
ledger=work/'encoding.json';cache=json.loads(ledger.read_text()) if ledger.exists() else {'assets':[]}
known={a['name']:a for a in cache['assets']} if cache.get('profile')==PROFILE else {}
manifest=json.loads((HERE/'treasure-shadow-manifest.json').read_text());registry=ROOT/'src/drownedCrownTreasure.generated.ts';registration=registry.read_text()
assert registration.count('shadowLod:true,')==3 and 'portableAtlas' not in registration
for asset in manifest['assets']:assert sha((ROOT/'public/drowned-crown/excellence'/(asset['name']+'.glb')).read_bytes())==asset['outputSha256'],'Regenerate the shadow stage before appending GPU images'
reports=[];outputs=[]
for asset in manifest['assets']:
 name=asset['name'];target=ROOT/'public/drowned-crown/excellence'/(name+'.glb');original=target.read_bytes();g=Glb(target);d=g.document;snapshot=copy.deepcopy(d);payload=bytes(g.binary)
 baseline=work/(name+'-source.glb')
 if baseline.exists():assert sha(baseline.read_bytes())==asset['outputSha256'],'Unexpected portable review baseline'
 else:baseline.write_bytes(original)
 original_accessors=[g.read_accessor(i) for i in range(len(d['accessors']))]
 texture_index=d['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index'];texture=d['textures'][texture_index]
 assert 'KHR_texture_basisu' not in texture.get('extensions',{})
 image_index=texture['extensions']['EXT_texture_webp']['source'];image=d['images'][image_index];view=d['bufferViews'][image['bufferView']]
 raw=payload[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
 decoded=Image.open(io.BytesIO(raw)).convert('RGBA');assert decoded.size==(2048,2048) and decoded.getchannel('A').getextrema()==(255,255)
 png=work/(name+'-colour.png');ktx=work/(name+'-colour.ktx2');previous=known.get(name)
 if not previous or previous['sourceSha256']!=asset['outputSha256'] or not ktx.exists() or sha(ktx.read_bytes())!=previous['ktxSha256']:
  decoded.convert('RGB').save(png)
  encoder=os.environ['CROWN_TOKTX'];assert '4.4.2' in subprocess.check_output([encoder,'--version'],text=True)
  subprocess.run([encoder,'--t2','--encode','uastc','--uastc_quality','4','--zcmp','18','--threads','2','--genmipmap','--filter','lanczos4','--assign_oetf','srgb',str(ktx),str(png)],check=True,capture_output=True)
 data=ktx.read_bytes()
 assert data[:12]==b'\xabKTX 20\xbb\r\n\x1a\n'
 assert struct.unpack_from('<II',data,20)==decoded.size
 levels=struct.unpack_from('<I',data,40)[0];assert levels==12
 while len(g.binary)%4:g.binary.append(0)
 buffer_view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(g.binary),'byteLength':len(data)});g.binary.extend(data)
 gpu_image=len(d['images']);d['images'].append({'name':name+' GPU colour','mimeType':'image/ktx2','bufferView':buffer_view})
 texture['extensions']['KHR_texture_basisu']={'source':gpu_image};d['extensionsUsed']=list(dict.fromkeys(d.get('extensionsUsed',[])+['KHR_texture_basisu']))
 assert 'KHR_texture_basisu' not in d.get('extensionsRequired',[])
 d['asset'].setdefault('extras',{})['gpuColourAtlas']={'profile':PROFILE,'portableSha256':sha(raw),'nativeSha256':asset['outputSha256'],'dimensions':[2048,2048]}
 assert bytes(g.binary[:len(payload)])==payload
 for i,a in enumerate(original_accessors):assert np.array_equal(a,g.read_accessor(i))
 for key in ['nodes','meshes','materials','accessors','samplers']:assert d[key]==snapshot[key]
 assert d['images'][:len(snapshot['images'])]==snapshot['images'];assert d['bufferViews'][:len(snapshot['bufferViews'])]==snapshot['bufferViews']
 restored=copy.deepcopy(d['textures']);del restored[texture_index]['extensions']['KHR_texture_basisu'];assert restored==snapshot['textures']
 candidate=work/(name+'-gpu.glb');g.save(candidate);outputs.append((target,candidate))
 gpu_bytes=sum(((max(1,2048>>i)+3)//4)**2*16 for i in range(levels))
 row={'name':name,'kind':asset['kind'],'sourceSha256':asset['outputSha256'],'outputSha256':sha(candidate.read_bytes()),'sourceBytes':len(original),'outputBytes':candidate.stat().st_size,'addedBytes':candidate.stat().st_size-len(original),'portableColourSha256':sha(raw),'ktxSha256':sha(data),'ktxBytes':len(data),'width':2048,'height':2048,'mips':levels,'block4x4GpuBytes':gpu_bytes,'originalBinaryPrefixExact':True,'allGeometryAccessorsExact':len(original_accessors),'originalFallbackImagesExact':True,'nativeAndShadowGeometryExact':True}
 reports.append(row);print(json.dumps(row),flush=True)
for target,candidate in outputs:target.write_bytes(candidate.read_bytes())
(HERE/'treasure-gpu-manifest.json').write_text(json.dumps({'profile':PROFILE,'assets':reports},indent=2)+'\n')
registry.write_text(registration.replace('shadowLod:true,','shadowLod:true,portableAtlas:true,'))
ledger.write_text(json.dumps({'profile':PROFILE,'assets':[{'name':r['name'],'sourceSha256':r['sourceSha256'],'ktxSha256':r['ktxSha256']} for r in reports]},indent=2)+'\n')
