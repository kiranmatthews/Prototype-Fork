"""GPU-compress the four standalone Trials image maps, retaining WebP fallbacks.

Use verified Khronos toktx 4.4.2 via TREEHOUSE_TOKTX. Dimensions and fallback
bytes are preserved. A physical vertical flip matches ordinary Three.js image
texture flipY=true when the compressed texture has immutable flipY=false.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import sys
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/treehouse-trials'
WORK=Path(tempfile.gettempdir())/'treehouse-trials-image-gpu'
WORK.mkdir(exist_ok=True)
ENCODER=os.environ['TREEHOUSE_TOKTX']
ACTIVE=['forest-depth-alpha','coast-depth-alpha','cavern-depth','timber-albedo']
NAMES=sys.argv[1:] or ACTIVE
assert all(name in ACTIVE for name in NAMES)
records=[]
for name in NAMES:
    fallback=OUT/(name+'.webp')
    raw=fallback.read_bytes(); original=Image.open(fallback)
    assert original.mode in {'RGB','RGBA'}, 'Retain authored RGB or genuine alpha channels'
    width,height=original.size
    png=WORK/(name+'.png'); original.save(png)
    path=OUT/(name+'.ktx2')
    subprocess.run([ENCODER,'--t2','--encode','uastc','--uastc_quality','2',
        '--zcmp','18','--threads','2','--genmipmap','--assign_oetf','srgb',
        '--lower_left_maps_to_s0t0',str(path),str(png)],
        check=True,capture_output=True)
    data=path.read_bytes()
    assert data[:12]==b'\xabKTX 20\xbb\r\n\x1a\n'
    assert struct.unpack_from('<II',data,20)==(width,height)
    levels=struct.unpack_from('<I',data,40)[0]
    assert levels==int(math.log2(max(width,height)))+1
    kvdoffset,kvdlength=struct.unpack_from('<II',data,56)
    kvd=data[kvdoffset:kvdoffset+kvdlength]
    assert b'KTXorientation\x00ru\x00' in kvd, 'Physical flip must be recorded'
    gpu=sum(math.ceil(max(1,width>>i)/4)*math.ceil(max(1,height>>i)/4)*16 for i in range(levels))
    rgba=sum(max(1,width>>i)*max(1,height>>i)*4 for i in range(levels))
    records.append({'name':name,'path':'treehouse-trials/'+path.name,
        'fallback':'treehouse-trials/'+fallback.name,'width':width,'height':height,
        'mipLevels':levels,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
        'fallbackBytes':len(raw),'fallbackSha256':hashlib.sha256(raw).hexdigest(),
        'astc4x4Bytes':gpu,'rgba8Bytes':rgba,
        'orientation':'ru: lower-left origin physically flipped to match WebP flipY=true',
        'colorSpace':'sRGB','channels':original.mode})
    print(name,round(len(data)/1048576,2),'MiB download',round(gpu/1048576,2),'MiB GPU',flush=True)
if (OUT/'image-gpu.json').exists():
    old=json.loads((OUT/'image-gpu.json').read_text())['images']
    records.extend(r for r in old if r['name'] in ACTIVE and r['name'] not in NAMES)
records.sort(key=lambda r:ACTIVE.index(r['name']))
report={'schemaVersion':1,'encoder':'Khronos toktx 4.4.2 / UASTC quality 2 / lossless Zstd 18',
    'source':'Exact current RGB/RGBA WebP fallback images. Compression itself uses no generation or credits.',
    'images':records,'total':{'encodedBytes':sum(r['bytes'] for r in records),
        'astc4x4Bytes':sum(r['astc4x4Bytes'] for r in records),
        'rgba8Bytes':sum(r['rgba8Bytes'] for r in records)}}
(OUT/'image-gpu.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report['total']))
