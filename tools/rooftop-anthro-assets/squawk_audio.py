"""Original nasal goose honk: reed harmonics, flutter and a breath intake."""
from pathlib import Path
import numpy as np
import wave
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/sfx/enemies';RATE=44100
rng=np.random.default_rng(3048)
def save(name,data):
 data=np.tanh(data*1.7);data*=.86/max(1,float(abs(data).max()))
 with wave.open(str(OUT/(name+'.wav')),'wb')as f:
  f.setparams((1,2,RATE,0,'NONE','not compressed'));f.writeframes((data*32767).astype('<i2').tobytes())
t=np.arange(int(RATE*.84))/RATE
frequency=480+125*np.sin(np.pi*np.minimum(1,t/.48))+37*np.sin(t*43)+22*np.sin(t*79)
phase=np.cumsum(frequency)/RATE*2*np.pi
voice=sum(np.sin(phase*n)*(1 if n in (1,3,5)else .35)/n**.65 for n in range(1,13))
flutter=.75+.25*np.sin(2*np.pi*t*16)
envelope=np.minimum(1,t/.025)*np.minimum(1,(.84-t)/.10)
save('goose-squawk',(voice*flutter+rng.normal(0,.04,len(t)))*envelope)
t=np.arange(int(RATE*.48))/RATE;noise=rng.normal(0,.12,len(t));breath=np.convolve(noise,np.ones(7)/7,mode='same')
save('goose-inhale',(breath+.07*np.sin(2*np.pi*(370*t+90*t*t)))*np.sin(np.pi*t/.48)**1.4)
print('Wrote original goose inhale and squawk')
