#!/usr/bin/env python3
"""Publish compact proxies; retain the original PNG deliverables in docs/."""
from pathlib import Path
from PIL import Image
import html,json
ROOT=Path(__file__).resolve().parents[2];DOC=ROOT/'docs/drowned-crown';OUT=ROOT/'public/drowned-crown/storyboard';OUT.mkdir(parents=True,exist_ok=True)
sections=json.loads((ROOT/'tools/drowned-crown/sections.json').read_text())
css='''*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#10212a;color:#eee3cd;font:16px/1.55 system-ui}header,main{max-width:1420px;margin:auto;padding:32px 5vw}header{padding-top:56px;padding-bottom:24px}h1{font:clamp(36px,5vw,64px)/1.08 Georgia,serif;margin:12px 0 20px}h2{font:clamp(24px,3vw,36px)/1.2 Georgia,serif;margin:8px 0 18px}p{color:#b6c4c5;max-width:880px}.eyebrow{color:#d6b670;letter-spacing:.14em;font-size:12px;text-transform:uppercase}.nav{position:sticky;top:0;z-index:5;background:#10212af2;border-block:1px solid #34515c;padding:12px 5vw;display:flex;gap:12px;align-items:center;flex-wrap:wrap}a{color:#ebc677}button,select{font:inherit;color:#d5e0df;background:#1d3540;border:1px solid #47606b;border-radius:5px;padding:8px 13px}button{cursor:pointer}button[aria-pressed=true]{background:#d7b777;color:#152832;border-color:#d7b777}.views{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap}article{padding:22px 0 44px;scroll-margin-top:90px;border-bottom:1px solid #34515c;margin-bottom:26px}figure{margin:0}img{width:100%;height:auto;display:block;aspect-ratio:16/9;object-fit:contain;background:#09151b;border:1px solid #304852;border-radius:6px}figcaption{font-size:13px;color:#b6c4c5;padding:10px 0}footer{padding:0 5vw 40px;color:#a2b2b7;font-size:13px}'''
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Drowned Crown · Storyboard</title><link rel="icon" href="data:,"><style>'+css+'</style><header><div class="eyebrow">Harbour · Wreck · Royal Vault</div><h1>The Drowned Crown</h1><p>Thirteen sections in a consistent “Pirates of the Caribbean meets the Goonies” art direction. Compare each production storyboard with its original player view; six sections also include the rebuilt game.</p></header><nav class="nav"><label for="jump">Jump to section</label><select id="jump">']
for s in sections:parts.append(f'<option value="{s["id"]}">{s["id"][:2]} · {html.escape(s["title"])}</option>')
parts.append('</select><a href="../../?playtest&amp;level=drowned-crown">Play the level ↗</a></nav><main>')
counts={'storyboards':0,'playerCaptures':0}
for s in sections:
 id=s['id'];views=[]
 for key,label,folder in [('concept','Storyboard','storyboards'),('before','Before art pass','screenshots'),('game','Rebuilt game','final')]:
  source=DOC/folder/(id+'.png')
  if not source.exists():continue
  im=Image.open(source).convert('RGB');im.thumbnail((1280,720),Image.Resampling.LANCZOS);file=id+'-'+key+'.jpg';im.save(OUT/file,'JPEG',quality=88,optimize=True)
  views.append((key,label,file));counts['storyboards' if key=='concept' else 'playerCaptures']+=1
 parts.append(f'<article id="{id}"><div class="eyebrow">Section {id[:2]} / 13</div><h2>{html.escape(s["title"])}</h2><div class="views" role="group" aria-label="Choose image">')
 for i,(key,label,file) in enumerate(views):parts.append(f'<button type="button" data-file="{file}" data-label="{label}" aria-pressed="{str(i==0).lower()}">{label}</button>')
 parts.append(f'</div><figure><img loading="lazy" src="{views[0][2]}" alt="{html.escape(s["title"])} — storyboard" width="1280" height="720"><figcaption>{views[0][1]} · {html.escape(s["title"])}</figcaption></figure><p>{html.escape(s["brief"])}</p></article>')
parts.append('''</main><footer>13 storyboards · 19 player-view captures · Original PNGs and generation prompts are retained with the project.</footer><script>document.querySelectorAll('.views button').forEach(b=>b.addEventListener('click',()=>{const a=b.closest('article');a.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));a.querySelector('img').src=b.dataset.file;a.querySelector('img').alt=a.querySelector('h2').textContent+' — '+b.dataset.label;a.querySelector('figcaption').textContent=b.dataset.label+' · '+a.querySelector('h2').textContent;}));document.querySelector('#jump').addEventListener('change',e=>document.getElementById(e.target.value).scrollIntoView());</script></html>''')
assert counts=={'storyboards':13,'playerCaptures':19},counts
(OUT/'index.html').write_text(''.join(parts));(OUT/'manifest.json').write_text(json.dumps(counts,indent=2)+'\n')
im=Image.open(DOC/'final/06-moonpool-reveal.png').convert('RGB').resize((640,360),Image.Resampling.LANCZOS);im.save(ROOT/'public/level-previews/drowned-crown.jpg','JPEG',quality=90,optimize=True)
print(json.dumps(counts))
