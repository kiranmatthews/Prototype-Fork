"""Register/copy one built-in image_gen result without modifying its pixels.

Example: python register-model-output.py --glyph F --palette bonus --version 01
  --source /absolute/generated.png --prompt F-extraction-prompt.txt
"""
import argparse, json, shutil
from pathlib import Path
import numpy as np
from PIL import Image

parser=argparse.ArgumentParser()
for key in ['glyph','palette','version','source','prompt']:
    parser.add_argument('--'+key,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[2]
folder=root/'art/roo-reference-match'
assert len(args.glyph)==1 and args.palette in ['bonus','counter']
name=args.glyph if args.glyph.isalnum() else f'u{ord(args.glyph):04x}'
relative=f'candidates/{name}-{args.palette}-{args.version}.png'
dest=folder/relative
if dest.exists():
    assert dest.read_bytes()==Path(args.source).read_bytes(),'Refusing to overwrite a different candidate'
else:
    shutil.copy2(args.source,dest)
im=Image.open(dest)
a=np.asarray(im.convert('RGBA')).astype(float)
r,g,b=a[:,:,0],a[:,:,1],a[:,:,2];mx=a[:,:,:3].max(2);mn=a[:,:,:3].min(2)
magenta=(r>80)&(b>80)&(g<np.minimum(r,b)*.6)
mask=(a[:,:,3]>16)&(mx>90)&((mx-mn>45)|(mx>205))&~magenta
yy,xx=np.where(mask)
assert len(xx)>0,'No colored foreground detected'
corners=np.r_[magenta[:10,:10].ravel(),magenta[-10:,:10].ravel(),magenta[:10,-10:].ravel(),magenta[-10:,-10:].ravel()]
background='transparent' if 'A'in im.getbands() and im.getextrema()[-1][0]==0 else 'magenta' if corners.mean()>.9 else 'unrecognized'
report=json.loads((folder/'review.json').read_text())
refs=json.loads((folder/'analysis/alphabet-references.json').read_text())
entry={'glyph':args.glyph,'palette':args.palette,'file':relative,'prompt':args.prompt,
       'mode':'built-in imagegen','generatedSource':str(Path(args.source).resolve()),
       'background':background,'status':'under_review','issues':['Final material, edge and registration review pending'],
       'colorBounds':[int(xx.min()),int(yy.min()),int(xx.max()+1-xx.min()),int(yy.max()+1-yy.min())]}
if args.glyph in refs:entry['reference']=refs[args.glyph]
report['candidates']=[c for c in report['candidates'] if c['file']!=relative]+[entry]
(folder/'review.json').write_text(json.dumps(report,indent=2)+'\n')
work=json.loads((folder/'worklist.json').read_text())
for item in work['glyphs']:
    item['candidates']=[c['file'] for c in report['candidates'] if c['glyph']==item['glyph']]
    item['status']='generated_under_review' if item['candidates'] else 'not_generated'
work['generatedGlyphCount']=sum(bool(item['candidates'])for item in work['glyphs'])
(folder/'worklist.json').write_text(json.dumps(work,indent=2)+'\n')
print(json.dumps(entry))
