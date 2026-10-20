"""Compress the local Blender strips with transparent silhouettes intact."""
import hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path.cwd();BAKE=Path('/private/tmp/country-club-woodland');OUT=ROOT/'public/country-club-art'
report=json.loads((BAKE/'bake.json').read_text())
for entry in report['variants']:
    im=Image.open(BAKE/entry['file'].replace('.webp','.png')).convert('RGBA')
    assert im.size==tuple(report['resolution']) and im.getchannel('A').getextrema()==(0,255)
    target=OUT/entry['file'];im.save(target,'WEBP',quality=88,method=6,exact=True)
    entry.update(bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
report['bytes']=sum(e['bytes'] for e in report['variants'])
(OUT/'woodland.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
