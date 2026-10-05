"""Encode one exact-size V2 standalone WebP into UASTC KTX2 with its audit.

Usage: TREEHOUSE_TOKTX=/path/to/toktx python compress_standalone_image.py NAME
Optionally pass the public manifest filename as a second argument. The fallback
bytes stay unchanged, and physical lower-left orientation matches ordinary
Three.js Texture.flipY=true when KTX2 textures use immutable flipY=false.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import tempfile
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/treehouse-trials-v2'
name=sys.argv[1]
assert re.fullmatch(r'[a-z0-9][a-z0-9-]*',name)
manifest=sys.argv[2] if len(sys.argv)>2 else name+'-manifest.json'
assert re.fullmatch(r'[a-z0-9][a-z0-9-]*\.json',manifest)
fallback=OUT/(name+'.webp')
original=fallback.read_bytes();im=Image.open(fallback)
assert im.mode in {'RGB','RGBA'}, 'Retain explicit source RGB/alpha channels'
width,height=im.size
work=Path(tempfile.gettempdir())/'treehouse-trials-v2-standalone-images'
work.mkdir(exist_ok=True)
png=work/(name+'.png');im.save(png)
path=OUT/(name+'.ktx2')
subprocess.run([os.environ['TREEHOUSE_TOKTX'],'--t2','--encode','uastc','--uastc_quality','2',
    '--zcmp','18','--threads','2','--genmipmap','--assign_oetf','srgb',
    '--lower_left_maps_to_s0t0',str(path),str(png)],check=True,capture_output=True)
data=path.read_bytes()
assert data[:12]==b'\xabKTX 20\xbb\r\n\x1a\n'
assert struct.unpack_from('<II',data,20)==(width,height)
levels=struct.unpack_from('<I',data,40)[0]
assert levels==int(math.log2(max(width,height)))+1
offset,length=struct.unpack_from('<II',data,56)
assert b'KTXorientation\x00ru\x00' in data[offset:offset+length]
assert fallback.read_bytes()==original
report={'schemaVersion':1,'name':name,
    'path':'treehouse-trials-v2/'+path.name,'fallback':'treehouse-trials-v2/'+fallback.name,
    'width':width,'height':height,'mipLevels':levels,'colorSpace':'sRGB',
    'orientation':'ru: lower-left physically flipped to match ordinary WebP flipY=true',
    'encoder':'Khronos toktx4.4.2 / UASTC quality2 / lossless Zstd18',
    'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
    'fallbackBytes':len(original),'fallbackSha256':hashlib.sha256(original).hexdigest(),
    'astc4x4Bytes':sum(math.ceil(max(1,width>>i)/4)*math.ceil(max(1,height>>i)/4)*16 for i in range(levels)),
    'rgba8Bytes':sum(max(1,width>>i)*max(1,height>>i)*4 for i in range(levels)),
    'credits':0,'source':'Existing generated V2 WebP; no generation request or geometry changes.'}
(OUT/manifest).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
