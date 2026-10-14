"""User-approved refinement of ImageGen output into 3840x2160 RGBA assets.
Source resolution is recorded honestly; this is cleanup and high-resolution
resampling, not a claim that the image generator produced native 4K detail."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageFilter, ImageChops
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/boulder-camera';ARCHIVE=ROOT/'tools/boulder-camera/source';ARCHIVE.mkdir(exist_ok=True)
SIZE=(3840,2160);records=[]
for tag in 'abc':
    archived=ARCHIVE/f'imagegen-{tag}.png'
    image=Image.open(archived).convert('RGBA');data=np.asarray(image).astype(np.float32)/255
    rgb,alpha=data[:,:,:3],data[:,:,3]
    lum=rgb@np.array([.2126,.7152,.0722],np.float32)
    blur=np.asarray(Image.fromarray(np.uint8(lum*255)).filter(ImageFilter.GaussianBlur(1.15))).astype(np.float32)/255
    contrast=np.clip(np.abs(lum-blur)*7,0,1)
    bright=np.clip((lum-.34)/.5,0,1)
    # Suppress low-opacity pane haze; retain fracture edges and localized glints.
    refined=np.power(alpha,1.25)*(.36+.64*np.maximum(contrast,bright))
    colour=np.clip((lum-.14)*1.12+.18,0,1)
    neutral=np.stack([colour*.97,colour*.99,colour],axis=2)
    rgba=np.dstack([neutral,refined]);clean=Image.fromarray(np.uint8(np.clip(rgba,0,1)*255),'RGBA')
    clean=clean.resize(SIZE,Image.Resampling.LANCZOS)
    a=clean.getchannel('A').filter(ImageFilter.UnsharpMask(radius=.75,percent=115,threshold=2))
    av=np.asarray(a).copy();av[av<3]=0;a=Image.fromarray(av)
    clean.putalpha(a)
    # Tiny opposing dark edge makes transparent cover-glass cracks readable on white.
    dark=Image.new('RGBA',SIZE,(7,11,16,0));edge=ImageChops.offset(a,2,1)
    ev=np.asarray(edge).copy();ev[:1]=0;ev[:,:2]=0;ev=np.uint8(ev*.52)
    dark.putalpha(Image.fromarray(ev).filter(ImageFilter.GaussianBlur(.3)))
    final=Image.alpha_composite(dark,clean)
    output=OUT/f'cracks-{tag}.png';final.save(output,optimize=True,compress_level=9)
    fa=np.asarray(final.getchannel('A'))
    records.append({'file':output.name,'source':str(archived.relative_to(ROOT)),'sourceSize':list(image.size),'outputSize':list(final.size),'mode':final.mode,'fullyTransparentFraction':round(float(np.mean(fa==0)),5),'visibleCoverageFraction':round(float(np.mean(fa>8)),5),'bytes':output.stat().st_size})
(OUT/'manifest.json').write_text(json.dumps({'generator':'built-in image_gen','refinement':'Approved neutral-color cleanup, haze suppression, antialiased 4K resampling and fine opposing fracture edge','nativeGeneratedResolution':[1672,941],'exportResolution':list(SIZE),'variants':records},indent=2)+'\n')
print(json.dumps(records))
