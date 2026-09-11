"""Check the rebuilt zero's silhouette, new model provenance and aligned bakes."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parents[2]
fonts=root/'public/fonts'
source=json.loads((fonts/'roo-bevel-source-v1.json').read_text())['glyphs']['0']
outline_path=root/'art/roo-reference-match/zero-v5/zero-outline.json'
outline=json.loads(outline_path.read_text())
assert outline['bounds']==source['bounds'] and outline['advance']==source['advance']
outer_end=next(i for i,c in enumerate(source['commands']) if c['type']=='Z')+1
assert outline['commands'][:outer_end]==source['commands'][:outer_end], 'Zero outer contour changed'
provenance=json.loads((fonts/'roo-font-v5-provenance.json').read_text())
previous=json.loads((fonts/'roo-font-v4-provenance.json').read_text())
assert provenance['glyphs']['0']['modelSha256']!=previous['glyphs']['0']['modelSha256'], 'A fresh whole-zero model pass is required'
assert 'zero-v5/zero-flat.png' in [i['file'] for i in provenance['glyphs']['0']['inputs']]
assert provenance['outlineOverrides']['0']['outlineSha256']==hashlib.sha256(outline_path.read_bytes()).hexdigest()
report={};palette_alpha=None
for palette in ['bonus','counter']:
    old=json.loads((fonts/f'roo-{palette}-v4.json').read_text())
    new=json.loads((fonts/f'roo-{palette}-v5.json').read_text())
    assert old['glyphs']==new['glyphs'], 'Glyph dimensions or spacing changed'
    assert old['kern']==new['kern'] and old['layouts']==new['layouts']
    assert new['outlineOverrides']=={'0':outline}
    g=new['glyphs']['0'];b=source['bounds'];cap=new['capPixels']
    sx=(g['inkRight']-g['inkLeft'])/(b[2]-b[0]);sy=(g['inkBottom']-g['inkTop'])/(b[3]-b[1])
    offset=1-g['inkTop']-b[3]*sy
    def point(x,y):
        return round((x*sx-g['left'])*cap),round((1-y*sy-offset-g['top'])*cap)
    def zero(image):
        return image[g['y']:g['y']+g['height'],g['x']:g['x']+g['width']]
    original=zero(np.array(Image.open(fonts/f'roo-{palette}-v3.png').convert('RGBA')))
    frames=[];alpha=None
    for suffix in ['', '-light1','-light2']:
        a=np.array(Image.open(fonts/f'roo-{palette}-v4{suffix}.png').convert('RGBA'))
        n=np.array(Image.open(fonts/f'roo-{palette}-v5{suffix}.png').convert('RGBA'))
        changed=np.any(a!=n,axis=2)
        changed[g['y']:g['y']+g['height'],g['x']:g['x']+g['width']]=False
        assert not changed.any(), 'A glyph other than zero changed'
        z=zero(n);oz=zero(a)
        added=(z[:,:,3]>127)&(original[:,:,3]<128)
        prior=(oz[:,:,3]>127)&(original[:,:,3]<128)
        assert added.sum()>prior.sum()*2, 'Accent remains too slight'
        x,_=point(.32,.55)
        assert added[:,x].sum()>prior[:,x].sum()*2, 'Accent body is not substantially thicker'
        x,y=point(.451,.604);assert z[y,x,3]==0, 'Accent closes the right gap'
        assert ((z[:,:,3]<128)&(original[:,:,3]>127)).sum()<=4, 'Zero lost its original body'
        body_changed=np.any(np.abs(z[:,:,:3].astype(int)-oz[:,:,:3].astype(int))>3,axis=2)&(original[:,:,3]==255)
        assert body_changed.sum()>np.count_nonzero(original[:,:,3]==255)*.5, 'Whole-glyph material was not rebuilt'
        if alpha is not None:assert np.array_equal(alpha,z[:,:,3]), 'Contour moves during the light fade'
        alpha=z[:,:,3].copy()
        frames.append({'accentPixels':int(added.sum()),'previousAccentPixels':int(prior.sum()),'bodyPixelsReshaded':int(body_changed.sum()),'allOtherGlyphsUnchanged':True})
    if palette_alpha is not None:assert np.array_equal(palette_alpha,alpha)
    palette_alpha=alpha
    report[palette]=frames
print(json.dumps(report,indent=2))
