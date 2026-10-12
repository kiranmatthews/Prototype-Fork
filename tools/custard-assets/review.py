"""Package the nine source views, approved storyboards and final player views."""
from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[2];DOC=ROOT/'docs/custard-creek-storyboard';OUT=ROOT/'public/custard-creek/storyboard'
OUT.mkdir(parents=True,exist_ok=True)
capture=json.loads((DOC/'before/capture.json').read_text())
names={'01-arrival':'Arrival at Willowmill','02-towpath':'The old towpath','03-first-hop':'First creek crossing','04-raised-cache':'Raised cache',
 '05-second-hop':'Second creek crossing','06-reedbank':'The reedbank','07-mill-view':'Along the millpond','08-rewards':'Reward bank','09-return':'Return to Custard Creek'}
for phase,folder in [('before','before'),('storyboard','storyboards'),('after','after')]:
    (OUT/phase).mkdir(exist_ok=True)
    for section in capture['sections']:
        name=section['name'];image=Image.open(DOC/folder/(name+'.png')).convert('RGB');image.thumbnail((1672,941))
        image.save(OUT/phase/(name+'.webp'),quality=90,method=6)
cards='\n'.join(f'''<article><div class="label"><span>{i+1:02d}</span><h2>{names[s['name']]}</h2><small>x = {s['x']:g}m</small></div>
<a class="view" href="after/{s['name']}.webp"><img loading="lazy" src="after/{s['name']}.webp" data-name="{s['name']}" alt="{names[s['name']]} player view"></a></article>''' for i,s in enumerate(capture['sections']))
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,"><title>Custard Creek — Willowmill Cache storyboard</title><style>
*{box-sizing:border-box}body{margin:0;background:#181d17;color:#f7edcf;font:16px/1.55 system-ui,sans-serif}header,main,footer{max-width:1440px;margin:auto;padding:36px 5vw}header{padding-bottom:20px}p{color:#c7c6ab;max-width:780px}h1{font:600 clamp(28px,4vw,52px)/1.1 Georgia,serif;margin:15px 0}h2{font-size:16px;font-weight:550;margin:0}a{color:#ebc785}nav{display:flex;gap:8px;flex-wrap:wrap;padding:18px 0}button{border:1px solid #65715a;color:#e2e4ca;background:transparent;padding:10px 20px;border-radius:30px;cursor:pointer;font:inherit}button[aria-pressed=true]{background:#dbc891;color:#1b231a;border-color:#dbc891}.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}article{overflow:hidden;background:#242b21;border:1px solid #3b4833;border-radius:12px}.label{display:flex;align-items:center;gap:12px;padding:14px 18px}.label span{color:#bda563}.label small{margin-left:auto;color:#9da68b;font-size:11px}img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#141812}.eyebrow{text-transform:uppercase;letter-spacing:.18em;color:#adbd94;font-size:12px}footer{font-size:13px;color:#a8b297;border-top:1px solid #364030}.legend{color:#eed699;font-size:13px} @media(max-width:760px){.grid{grid-template-columns:1fr}header,main,footer{padding:24px 5vw}}
</style><header><div class="eyebrow">Custard Creek / Art &amp; play review</div><h1>Willowmill Cache</h1><p>Nine player-view sections, from the original bonus to the image-generated storyboard and rebuilt game. The same two crossings and 18 reward boxes are retained.</p><nav aria-label="Comparison stage"><button data-phase="before" aria-pressed="false">Original views</button><button data-phase="storyboard" aria-pressed="false">Storyboards</button><button data-phase="after" aria-pressed="true">Rebuilt level</button></nav><div class="legend" id="caption">Final full-render game captures. Click any image to inspect it at full size.</div></header><main class="grid">'''+cards+'''</main><footer><p><a href="../../?playtest&amp;level=custard-creek">Play Custard Creek</a> · <a href="../../?playtest&amp;level=bonus-custard-creek">Open the bonus directly</a></p><p>Storyboards and scenery layers: built-in OpenAI image generation. New textured boulder, willow and watermill: Meshy Smart Topology, 45 credits total. Full prompts and source captures are retained in the repository’s docs/custard-creek-storyboard directory. New models retain their original meshes and PBR atlases with distant LODs.</p></footer><script>
const captions={before:'The nine original player-view captures, covering the complete bonus.',storyboard:'Nine image-generated targets sharing the Custard Creek material and lighting style.',after:'Final full-render game captures. Click any image to inspect it at full size.'};
for(const button of document.querySelectorAll('button[data-phase]'))button.onclick=()=>{const phase=button.dataset.phase;for(const b of document.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));for(const image of document.querySelectorAll('img[data-name]')){image.src=phase+'/'+image.dataset.name+'.webp';image.parentElement.href=image.src;}document.getElementById('caption').textContent=captions[phase];};
</script></html>'''
(OUT/'index.html').write_text(html)
print('Packaged 9 × original/storyboard/rebuilt views.')
