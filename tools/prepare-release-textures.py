#!/usr/bin/env python3
"""Prepare WebP release candidates with optional role-aware resizing; never change public/.

Requires local Pillow (WebP enabled) and numpy. The output still requires visual
review before committing. --cache reuses expensive encodes, but recomputes the
pixel measurements. CI uses the reviewed output and does not need Python.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image
from texture_resampling import resize_map
import numpy as np
import struct,io,json,hashlib,time,os,argparse,shutil
from PIL import features
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--resize-drowned',action='store_true',help='Review 2K colour, 512 normal and 256 packed data maps for Drowned Crown')
parser.add_argument('--out',type=Path,required=True,help='New candidate directory outside public/')
parser.add_argument('--cache',type=Path,required=True,help='Reusable encoding cache outside public/')
args=parser.parse_args();ROOT=Path(__file__).resolve().parents[1];OUT=args.cache.resolve();DEST=args.out.resolve()
for directory in [OUT,DEST]:
 if directory==ROOT or directory==ROOT/'public' or ROOT/'public' in directory.parents:raise ValueError('Output must be separate from authoring source')
if DEST.exists():raise ValueError('Use a new candidate directory; do not overwrite a reviewed batch')
CACHE=OUT/'encoded';CACHE.mkdir(parents=True,exist_ok=True)

POLICY=json.loads((ROOT/'tools/release-texture-policy.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
unique={};models={}
for path in sorted((ROOT/'public').rglob('*.glb')):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:];rel=str(path.relative_to(ROOT/'public'))
 if len(doc.get('buffers',[]))!=1 or any('EXT_meshopt_compression' in v.get('extensions',{}) for v in doc.get('bufferViews',[])):continue
 roles={}
 def walk(v,trail=''):
  if isinstance(v,dict):
   for k,x in v.items():
    if k.endswith('Texture') and isinstance(x,dict) and isinstance(x.get('index'),int):roles.setdefault(x['index'],set()).add(k)
    walk(x,trail+'.'+k)
  elif isinstance(v,list):
   for x in v:walk(x,trail)
 for m in doc.get('materials',[]):walk(m)
 image_roles={}
 for i,t in enumerate(doc.get('textures',[])):
  if isinstance(t.get('source'),int):image_roles.setdefault(t['source'],set()).update(roles.get(i,{'unknown'}))
 for i,image in enumerate(doc.get('images',[])):
  mime=image.get('mimeType');use=image_roles.get(i,set())
  if mime not in ['image/png','image/jpeg'] or 'bufferView' not in image or not use:continue
  if mime=='image/jpeg' and use!={'baseColorTexture'}:continue
  view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0);data=binary[start:start+view['byteLength']]
  if len(data)<16384:continue
  digest=sha(data);entry=unique.setdefault(digest,{'source':data,'mime':mime,'uses':[]});entry['uses'].append({'file':rel,'image':i,'roles':sorted(use)})
  models[rel]={'sourceSha256':sha(raw),'sourceBytes':len(raw)}
print(json.dumps({'images':len(unique),'uses':sum(len(x['uses'])for x in unique.values()),'sourceBytes':sum(len(x['source'])*len(x['uses'])for x in unique.values())}),flush=True)
def encode(item,allow_resize=True):
 digest,entry=item;start=time.time();im=Image.open(io.BytesIO(entry['source']));mode='lossless' if entry['mime']=='image/png' else 'color';rgba=im.convert('RGBA')
 row={'sourceSha256':digest,'sourceBytes':len(entry['source']),'mimeType':entry['mime'],'width':im.width,'height':im.height,'uses':entry['uses']}
 if im.mode not in ['RGB','RGBA','L','LA','P'] or any(k in im.info for k in ['icc_profile','exif','gamma','chromaticity','transparency']) or getattr(im,'n_frames',1)!=1:return row|{'skip':'image metadata or unsupported precision','metadata':list(im.info),'imageMode':im.mode}
 strategy='';use_roles=set(r for u in entry['uses'] for r in u['roles'])
 if args.resize_drowned and allow_resize and all(u['file'].startswith('drowned-crown/') for u in entry['uses']) and len(use_roles)==1:
  role=next(iter(use_roles));profile=POLICY['drowned'];limit=max((profile['overrides'].get(u['file'],{}).get(role,profile['limits'].get(role,0)) for u in entry['uses']))
  if role=='baseColorTexture' and rgba.getextrema()[3]!=(255,255):limit=0
  if limit and max(im.size)>limit:
   ratio=limit/max(im.size);size=(max(1,round(im.width*ratio)),max(1,round(im.height*ratio)))
   rgba=resize_map(im,size,role);row.update(sourceWidth=im.width,sourceHeight=im.height,width=size[0],height=size[1],resampling={'role':role,'filter':'linear-light-lanczos3-sharpen-0.6-45-2' if role=='baseColorTexture' else 'vector-lanczos3-renormalize' if role=='normalTexture' else 'linear-lanczos3'})
   strategy='-resized-v1-'+str(size[0])+'x'+str(size[1])+'-'+role
 ref=np.asarray(rgba).astype(np.int16);candidates=[100] if mode=='lossless' else [85,90,95]
 for quality in candidates:
  key=f'{digest}{strategy}-{mode}-{quality}';cached=OUT/(key+'.json');target=CACHE/(key+'.webp');data=None
  if cached.exists() and target.exists():
   old=json.loads(cached.read_text());b=target.read_bytes()
   if sha(b)==old['encodedSha256']:data=b
  if data is None:
   b=io.BytesIO();(rgba if mode=='lossless' else rgba.convert('RGB')).save(b,format='WEBP',quality=quality,lossless=mode=='lossless',method=6,exact=True)
   data=b.getvalue()
  dec=Image.open(io.BytesIO(data)).convert('RGBA');assert dec.size==rgba.size
  diff=np.abs(np.asarray(dec).astype(np.int16)-ref);assert np.max(diff[:,:,3])==0
  rgb=diff[:,:,:3];mse=np.mean(rgb.astype(np.float64)**2);metrics={'encodedSha256':sha(data),'encodedBytes':len(data),'quality':quality,'lossless':mode=='lossless','meanAbs':float(rgb.mean()),'p99':float(np.percentile(rgb,99)),'max':int(rgb.max()),'psnr':float(10*np.log10(255**2/mse)) if mse else None}
  if mode=='lossless':assert rgba.tobytes()==dec.tobytes()
  temp=target.with_suffix('.webp.tmp');temp.write_bytes(data);os.replace(temp,target);cached.write_text(json.dumps(metrics))
  if mode=='lossless' or metrics['psnr'] is None or metrics['psnr']>=40 and metrics['p99']<=8 and metrics['max']<=64:
   saving=len(entry['source'])-len(data)
   if saving<max(1024,len(entry['source'])*.03):return row|{'skip':'less than three percent saving','best':metrics}
   return row|metrics|{'encodedFile':str(target),'savedBytes':saving,'seconds':round(time.time()-start,2)}
 if strategy:
  return encode(item,False)|{'resizeRejected':{'reason':'quality threshold','width':row['width'],'height':row['height'],'best':metrics}}
 return row|{'skip':'quality threshold','best':metrics}
rows=[]
with ThreadPoolExecutor(max_workers=2) as pool:
 futures={pool.submit(encode,item):item[0] for item in unique.items()}
 for future in as_completed(futures):
  try:r=future.result()
  except Exception as e:r={'sourceSha256':futures[future],'error':str(e)}
  rows.append(r);report={'encoder':{'pillow':Image.__version__,'libwebp':features.version('webp'),'format':'WebP','dimensions':'Drowned Crown reviewed role limits with close-up exceptions; other models unchanged' if args.resize_drowned else 'unchanged','lossyQualityCandidates':[85,90,95],'minPSNR':40,'maxP99':8,'maxError':64,'losslessPNG':True},'models':models,'images':sorted(rows,key=lambda r:r['sourceSha256'])}
  (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'done':len(rows),'total':len(unique),'sha':r['sourceSha256'][:12],'uses':len(r.get('uses',[])),'sourceBytes':r.get('sourceBytes'),'encodedBytes':r.get('encodedBytes'),'quality':r.get('quality'),'skip':r.get('skip'),'error':r.get('error')}),flush=True)
print(json.dumps({'uniqueEncoded':sum('encodedFile'in r for r in rows),'usedEncoded':sum(len(r.get('uses',[]))for r in rows if 'encodedFile'in r),'savedBytes':sum(r.get('savedBytes',0)*len(r.get('uses',[]))for r in rows),'errors':sum('error'in r for r in rows)}),flush=True)

if any('error' in r for r in rows):raise RuntimeError('Resolve encoding errors before review')
accepted=[r for r in sorted(rows,key=lambda r:r['sourceSha256']) if 'encodedFile' in r]
manifest={'v':1,'encoder':report['encoder'],'policy':POLICY if args.resize_drowned else None,'textures':[],'models':[]};selected={}
(DEST/'encoded').mkdir(parents=True)
for row in accepted:
 image={k:row[k] for k in ['width','height','lossless','quality','psnr','p99','max','meanAbs']}
 if 'resampling' in row:image.update(sourceWidth=row['sourceWidth'],sourceHeight=row['sourceHeight'],resampling=row['resampling'])
 image.update(sha256=row['encodedSha256'],bytes=row['encodedBytes'],sourceSha256=row['sourceSha256'])
 manifest['textures'].append(image)
 shutil.copyfile(row['encodedFile'],DEST/'encoded'/(image['sha256']+'.webp'))
 for use in row['uses']:
  selected.setdefault(use['file'],[]).append({'index':use['image'],'sourceSha256':row['sourceSha256'],'sha256':image['sha256']})
for file,images in sorted(selected.items()):
 manifest['models'].append({'file':file,'sourceSha256':models[file]['sourceSha256'],'images':sorted(images,key=lambda r:r['index'])})
assert len({r['sha256'] for r in manifest['textures']})==len(manifest['textures'])
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for row in report['images']:
 row.pop('encodedFile',None);row.pop('seconds',None)
(DEST/'review.json').write_text(json.dumps(report,indent=2)+'\n')
print('Candidate batch ready for model render review:',DEST,flush=True)
