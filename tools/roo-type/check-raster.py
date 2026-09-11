"""Check complete bitmap glyphs, fixed image alpha, glisten and source coverage."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

def component_sizes(mask):
 # Join horizontal runs across neighbouring rows (8-connected), without scipy.
 parents=[];sizes=[];previous=[]
 def find(i):
  while parents[i]!=i:
   parents[i]=parents[parents[i]];i=parents[i]
  return i
 for row in mask:
  edges=np.flatnonzero(np.diff(np.r_[False,row,False].astype(np.int8)))
  current=[]
  for start,end in zip(edges[::2],edges[1::2]):
   roots={find(i) for a,b,i in previous if a<=end and b>=start}
   if roots:
    i=min(roots);sizes[i]+=int(end-start)
    for other in roots-{i}:parents[other]=i;sizes[i]+=sizes[other]
   else:i=len(parents);parents.append(i);sizes.append(int(end-start))
   current.append((start,end,i))
  previous=current
 return [size for i,size in enumerate(sizes) if parents[i]==i]

root=Path(__file__).resolve().parents[2];fonts=root/'public/fonts'
provenance=json.loads((fonts/'roo-font-v9-provenance.json').read_text())
assert len(provenance['glyphs'])==51
assert all(set(g['glisten'])=={'left','right'} for g in provenance['glyphs'].values())
report={};shared_alpha=None
expected_components={'!':2,'?':2,':':2,';':2,'"':2,'%':3}
for palette in ['counter','bonus']:
 m=json.loads((fonts/f'roo-{palette}-v9.json').read_text())
 assert m['version']==9 and m['capPixels']==512 and m['contourSource']=='model-artwork'
 assert m['width']<=8192 and m['height']<=8192
 frames=[np.asarray(Image.open(fonts/f'roo-{palette}-v9{s}.png').convert('RGBA')) for s in ['', '-light1','-light2']]
 for frame in frames[1:]:assert np.array_equal(frame[:,:,3],frames[0][:,:,3]), 'Glisten alters the approved silhouette'
 if shared_alpha is not None:assert np.array_equal(shared_alpha,frames[0][:,:,3])
 shared_alpha=frames[0][:,:,3]
 glyphs={}
 for char,g in m['glyphs'].items():
  if not g['width']:assert char==' ';continue
  tiles=[f[g['y']:g['y']+g['height'],g['x']:g['x']+g['width']] for f in frames]
  a=tiles[0][:,:,3];opaque=a>240
  assert opaque.any(),f'{char}: empty glyph'
  assert not np.r_[a[0],a[-1],a[:,0],a[:,-1]].any(),f'{char}: clipped artwork'
  components=sum(size>=8 for size in component_sizes(a>127))
  assert components==expected_components.get(char,1),f'{char}: lost/extra detached parts ({components})'
  delta=np.abs(tiles[1][:,:,:3].astype(int)-tiles[2][:,:,:3].astype(int)).max(2)
  assert (delta[opaque]>8).mean()>.01,f'{char}: missing glisten variation'
  peaks=[]
  for t in tiles:
   r,gg,b=[t[:,:,i].astype(int) for i in range(3)]
   assert not ((r>150)&(b>150)&(gg<70)&opaque).any(),f'{char}: magenta matte remains'
   peaks.append(round(float((r*.2126+gg*.7152+b*.0722)[opaque].max()),2))
  glyphs[char]={'components':components,'meanGlistenDelta':round(float(delta[opaque].mean()),2),'luminancePeaks':peaks}
 report[palette]={'glyphs':glyphs,'atlas':[m['width'],m['height']],'partialAlphaPixels':int(((frames[0][:,:,3]>0)&(frames[0][:,:,3]<255)).sum())}
print(json.dumps(report,indent=2))
