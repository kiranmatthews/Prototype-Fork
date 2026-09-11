"""Verify source-tone preservation, fixed alpha and untouched orange frames."""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[2];fonts=root/'public/fonts'
metrics=json.loads((fonts/'roo-bonus-v9.json').read_text())
def lab(rgb):
 c=rgb.astype(np.float64)/255
 c=np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
 lms=np.cbrt(c@np.array([[.4122214708,.5363325363,.0514459929],[.2119034982,.6806995451,.1073969566],[.0883024619,.2817188376,.6299787005]]).T)
 return lms@np.array([[.2104542553,.793617785,-.0040720468],[1.9779984951,-2.428592205,.4505937099],[.0259040371,.7827717662,-.808675766]]).T
report=[]
for suffix in ['', '-light1','-light2']:
 orange=(fonts/f'roo-counter-v8{suffix}.png').read_bytes()
 assert orange==(fonts/f'roo-counter-v9{suffix}.png').read_bytes(),'Orange artwork changed'
 source=np.asarray(Image.open(fonts/f'roo-counter-v6{suffix}.png').convert('RGBA'))
 output=np.asarray(Image.open(fonts/f'roo-bonus-v9{suffix}.png').convert('RGBA'))
 assert np.array_equal(source[:,:,3],output[:,:,3]),'Alpha changed'
 max_lightness_error=max_chroma_gain=0
 for char,g in metrics['glyphs'].items():
  if not g['width']:continue
  x,y,w,h=[g[k] for k in ['x','y','width','height']]
  old=source[y:y+h,x:x+w];new=output[y:y+h,x:x+w];mask=old[:,:,3]==255
  a,b=lab(old[mask,:3]),lab(new[mask,:3])
  max_lightness_error=max(max_lightness_error,float(np.max(np.abs(a[:,0]-b[:,0]))))
  max_chroma_gain=max(max_chroma_gain,float(np.max(np.linalg.norm(b[:,1:],axis=1)-np.linalg.norm(a[:,1:],axis=1))))
 assert max_lightness_error<.003,'Original tonal contrast/lightness was altered'
 assert max_chroma_gain<.003,'Saturation was amplified'
 report.append({'frame':suffix or 'neutral','maxOklabLightnessError':max_lightness_error,'maxChromaGain':max_chroma_gain,'orangeSha256':hashlib.sha256(orange).hexdigest()})
print(json.dumps({'version':9,'frames':report,'alphaIdentical':True,'orangeBytesIdentical':True},indent=2))
