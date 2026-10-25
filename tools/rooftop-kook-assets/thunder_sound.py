"""Original distant rolling thunder, shaped from deterministic filtered noise."""
from pathlib import Path
import json
import wave
import numpy as np

rate=44100;duration=6.4;n=round(rate*duration)
rng=np.random.default_rng(2026102602);t=np.arange(n)/rate
freq=np.fft.rfftfreq(n,1/rate)
def noise(cutoff):
    spectrum=np.fft.rfft(rng.normal(0,1,n))
    shape=(freq/(freq+32))**2/(1+(freq/cutoff)**4)
    value=np.fft.irfft(spectrum*shape,n)
    return value/max(.0001,np.sqrt(np.mean(value**2)))
low=noise(180);body=noise(620);air=noise(1300)
roll=np.zeros(n)
for onset,strength,decay in [(0,.9,.8),(.42,.65,1.3),(1.08,.8,1.8),(2.25,.54,1.6),(3.6,.25,1.1)]:
    age=np.maximum(0,t-onset)
    envelope=(1-np.exp(-age*12))*np.exp(-age/decay)*(t>=onset)
    roll+=strength*envelope
sound=(low*.58+body*.3+air*.05)*roll
sound*=np.sin(np.clip(t/.18,0,1)*np.pi/2)**2
sound*=np.sin(np.clip((duration-t)/1.3,0,1)*np.pi/2)**2
sound-=sound.mean();sound*=np.sin(np.clip(t/.06,0,1)*np.pi/2)**2*np.sin(np.clip((duration-t)/.2,0,1)*np.pi/2)**2
sound*=.64/max(abs(sound))
pcm=np.round(sound*32767).astype('<i2')
out=Path(__file__).resolve().parents[2]/'public/sfx/weather/rooftop-thunder.wav'
out.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(out),'wb') as f:
    f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(pcm.tobytes())
report={'originalSynthesis':True,'seconds':duration,'sampleRate':rate,'channels':1,'bytes':out.stat().st_size,'peak':float(max(abs(sound))),'rms':float(np.sqrt(np.mean(sound**2))),'firstSample':int(pcm[0]),'lastSample':int(pcm[-1])}
(Path(__file__).parent/'thunder-sound.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
