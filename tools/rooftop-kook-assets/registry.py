"""Refresh measured asset dimensions without changing hand-authored settings."""
from pathlib import Path
import json
import re
ROOT=Path(__file__).resolve().parents[2]
path=ROOT/'src/rooftopKookAssets.ts'
source=path.read_text()
for name in json.loads((Path(__file__).parent/'assets.json').read_text()):
    manifest=json.loads((ROOT/'public/rooftop-kook'/f'{name}.json').read_text())
    size=json.dumps(manifest['sizeAtDefaultWidth'],separators=(',',':'))
    source,count=re.subn(r'(kook'+name+r':\{[^\n]*?size:)\[[^\]]+\]',r'\g<1>'+size,source)
    assert count==1,name+': missing or duplicated registry entry'
path.write_text(source)
