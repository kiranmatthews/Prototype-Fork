#!/usr/bin/env python3
"""Download licensed source maps; only resize/encode, never paint texture tiles."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib,json,urllib.request
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
RAW=ROOT/'.img2threejs/warehouse-art/materials'
OUT=ROOT/'public/warehouse/materials'
SOURCES={'concrete':'concrete_floor_worn_001','brick':'red_brick_03','rust':'rusty_metal_04','plywood':'plywood','steel':'blue_metal_plate','grime':'concrete_floor_02'}

def fetch(task):
 name,asset,kind=task
 url=f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{asset}/{asset}_{kind}_2k.jpg'
 raw=RAW/f'{asset}_{kind}_2k.jpg'
 if not raw.exists():
  request=urllib.request.Request(url,headers={'User-Agent':'WarehouseAssetImporter/1.0 (CC0 game material download)'})
  with urllib.request.urlopen(request,timeout=90) as response:raw.write_bytes(response.read())
 image=Image.open(raw).convert('RGB');size=2048 if kind=='diff' and name!='grime' else 1024 if kind=='diff' else 512
 image.thumbnail((size,size),Image.Resampling.LANCZOS)
 target=OUT/f'{name}-{kind}.webp';image.save(target,quality=90 if kind=='diff' else 96,method=6)
 record={'asset':asset,'map':kind,'license':'CC0-1.0','source':url,'assetPage':f'https://polyhaven.com/a/{asset}',
  'sourceSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'file':str(target.relative_to(ROOT/'public')),
  'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'size':image.size,
  'processing':'Resize and WebP encoding only; source pixels and map semantics retained'}
 print(name,kind,record['bytes'],flush=True);return record

if __name__=='__main__':
 RAW.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
 with ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(fetch,[(name,asset,kind) for name,asset in SOURCES.items() for kind in (['diff'] if name=='grime' else ['diff','nor_gl','arm'])]))
 (OUT/'provenance.json').write_text(json.dumps({'provider':'Poly Haven','license':'https://polyhaven.com/license','maps':records},indent=2)+'\n')
