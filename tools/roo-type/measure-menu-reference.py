"""Measure the supplied video's 36–38 s menu sequence at its native 30 fps.
The reference video remains local; only timing and colour measurements are saved.
"""
import argparse,hashlib,json,subprocess
import numpy as np
from PIL import Image,ImageFilter
p=argparse.ArgumentParser();p.add_argument('video');p.add_argument('--ffmpeg',required=True);p.add_argument('--output',required=True);a=p.parse_args()
raw=subprocess.check_output([a.ffmpeg,'-hide_banner','-loglevel','error','-ss','36','-i',a.video,'-t','2','-vf','crop=440:170:740:780','-pix_fmt','rgb24','-f','rawvideo','-'])
f=np.frombuffer(raw,dtype=np.uint8).reshape(-1,170,440,3)
assert len(f)==60,'Expected 60 original frames; do not resample the reference.'
def colors(rows,low,high):
 region=f[:,rows]
 mask=(np.percentile(region[:,:,:,0],10,axis=0)>low)&(np.median(region[:,:,:,0],axis=0)>high)
 mask=np.asarray(Image.fromarray(mask).filter(ImageFilter.MinFilter(3)))>0
 return region[:,mask,:].mean(1),int(mask.sum())
c,n=colors(slice(0,85),100,160);idle,ni=colors(slice(90,170),50,80)
white=c[:,2]>150;expected=np.arange(60)%4==0
assert np.array_equal(white,expected),'The observed cadence is not white / orange / orange / orange.'
luma=np.array([.2126,.7152,.0722]);orange=c[~white].mean(0);peak=c[white].mean(0)
report={'source':'https://www.youtube.com/watch?v=Xhkq5wKOXfo&t=36s','sourceSha256':hashlib.sha256(open(a.video,'rb').read()).hexdigest(),'sourceFormat':137,'resolution':[1920,1080],'fps':30,'startSeconds':36,'frameCount':60,'crop':[740,780,440,170],'selectedCorePixels':n,'idleCorePixels':ni,'cycle':['white','orange','orange','orange'],'cycleMs':1000*4/30,'whiteMs':1000/30,'orangeMs':100,'orangeRgb':orange.round(4).tolist(),'whiteRgb':peak.round(4).tolist(),'idleRgb':idle.mean(0).round(4).tolist(),'orangeLuma':float(orange@luma),'whiteLuma':float(peak@luma),'lumaRatio':float((peak@luma)/(orange@luma)),'periodFourRgbRms':float(np.sqrt(np.mean((c[4:]-c[:-4])**2))),'frames':[{'frame':i,'seconds':round(36+i/30,6),'state':'white' if w else 'orange','rgb':rgb.round(4).tolist()} for i,(w,rgb) in enumerate(zip(white,c))]}
open(a.output,'w').write(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['fps','cycle','whiteMs','orangeMs','lumaRatio','periodFourRgbRms']}))
