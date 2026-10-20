"""Package imagegen deliverables, preserving source PNGs in the authoring area."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil
ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/coastal-storyboard'
WORK=ROOT/'.img2threejs/coastal-town/art-originals'
WORK.mkdir(parents=True,exist_ok=True)
sections=json.loads((DOC/'sections.json').read_text())['sections']
for section in sections:
 name=section['id'];source=DOC/'storyboards'/(name+('-v2' if int(name[:2])<=14 else '')+'.png')
 if source.is_file():
  shutil.copy2(source,WORK/source.name)
  Image.open(source).save(DOC/'storyboards'/(name+'.webp'),quality=94,method=6)
 for folder in ['before','after']:
  source=DOC/folder/(name+'.png')
  if source.is_file():Image.open(source).save(DOC/folder/(name+'.webp'),quality=94,method=6)
# Retain every generation non-destructively outside the published review gallery.
for source in (DOC/'storyboards').glob('*.png'):
 shutil.copy2(source,WORK/source.name);source.unlink()
for folder in ['before','after']:
 for source in (DOC/folder).glob('*.png'):
  (WORK/folder).mkdir(exist_ok=True);shutil.copy2(source,WORK/folder/source.name);source.unlink()
cards=[]
for s in sections:
 n=s['id'];cards.append(f'<article id="{n}"><h2>{s["title"]}</h2><div class="views"><figure><img loading="lazy" src="before/{n}.webp"><figcaption>Original player view</figcaption></figure><figure><img loading="lazy" src="storyboards/{n}.webp"><figcaption>Imagegen storyboard · no shop signage</figcaption></figure>'+ (f'<figure><img loading="lazy" src="after/{n}.webp"><figcaption>Playable rebuild</figcaption></figure>' if (DOC/'after'/(n+'.webp')).exists() else '')+'</div></article>')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Coastal · player-view storyboard</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff7e8;color:#234f53;font:16px/1.5 system-ui,sans-serif}header{padding:40px 4vw;background:#d9f1e8;border-bottom:8px solid #efa378}h1{font-size:clamp(28px,4vw,52px);margin:0}header p{max-width:900px}nav{display:flex;flex-wrap:wrap;gap:10px}a{color:#146d75}main{padding:16px 3vw}article{padding:16px 0 32px;border-bottom:1px solid #dfd4bf}h2{font-size:22px}.views{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:16px}figure{margin:0}img{display:block;width:100%;border-radius:10px;background:#bfe7eb;aspect-ratio:16/9;object-fit:contain}figcaption{font-size:14px;margin-top:8px}footer{padding:24px 4vw}
</style><header><h1>Coastal & Rooftop Deliveries</h1><p>17 sections · normal player cameras · one friendly seaside-town art direction. The rebuilt stores use separate roofs, windows, doors, awnings, trim and foliage. Store signage is reserved for the owner.</p><nav>'''+''.join(f'<a href="#{s["id"]}">{s["id"][:2]} {s["title"]}</a>' for s in sections)+'</nav></header><main>'+''.join(cards)+'</main><footer>Built-in imagegen storyboards and scenery; 16 separately generated Meshy components. Original traversal and bonus puzzles preserved.</footer></html>'
(DOC/'index.html').write_text(html)
print('Packaged',len(sections),'storyboard sections')
