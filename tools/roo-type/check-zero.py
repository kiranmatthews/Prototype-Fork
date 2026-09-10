"""Check the built PNG change: zero gains an internal accent; O stays identical."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parents[2]
fonts=root/'public/fonts'
source=json.loads((fonts/'roo-bevel-source-v1.json').read_text())['glyphs']['0']
report={}
for palette in ['bonus','counter']:
    old=json.loads((fonts/f'roo-{palette}-v3.json').read_text())
    new=json.loads((fonts/f'roo-{palette}-v4.json').read_text())
    assert old['glyphs']==new['glyphs'], 'Glyph dimensions or spacing changed'
    assert old['kern']==new['kern'] and old['layouts']==new['layouts']
    assert set(new['accents'])=={'0'}
    g=new['glyphs']['0'];b=source['bounds'];cap=new['capPixels']
    sx=(g['inkRight']-g['inkLeft'])/(b[2]-b[0]);sy=(g['inkBottom']-g['inkTop'])/(b[3]-b[1])
    offset=1-g['inkTop']-b[3]*sy
    def point(x,y):
        return round((x*sx-g['left'])*cap),round((1-y*sy-offset-g['top'])*cap)
    frames=[];alpha=None
    for suffix in ['', '-light1','-light2']:
        a=np.array(Image.open(fonts/f'roo-{palette}-v3{suffix}.png').convert('RGBA'))
        n=np.array(Image.open(fonts/f'roo-{palette}-v4{suffix}.png').convert('RGBA'))
        changed=np.any(a!=n,axis=2)
        changed[g['y']:g['y']+g['height'],g['x']:g['x']+g['width']]=False
        assert not changed.any(), 'A glyph other than zero changed'
        z=n[g['y']:g['y']+g['height'],g['x']:g['x']+g['width']]
        oz=a[g['y']:g['y']+g['height'],g['x']:g['x']+g['width']]
        assert np.array_equal(z[oz[:,:,3]==255],oz[oz[:,:,3]==255]), 'Existing opaque zero pixels changed'
        assert (z[:,:,3]>=oz[:,:,3]).all(), 'Zero lost part of its original contour'
        added=int(((z[:,:,3]>127)&(oz[:,:,3]<128)).sum());assert added>500
        x,y=point(.30,.561);assert oz[y,x,3]==0 and z[y,x,3]>240, 'Inner accent is missing'
        x,y=point(.442,.592);assert z[y,x,3]==0, 'Accent touches the right wall'
        if alpha is not None:assert np.array_equal(alpha,z[:,:,3]), 'Accent moves during the light fade'
        alpha=z[:,:,3].copy();frames.append({'addedZeroPixels':added,'allOtherGlyphsUnchanged':True})
    report[palette]=frames
print(json.dumps(report,indent=2))
