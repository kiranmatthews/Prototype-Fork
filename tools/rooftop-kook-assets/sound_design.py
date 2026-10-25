"""Original, nonverbal cartoon alert and sporting-gun sounds. No voice sample."""
from pathlib import Path
import numpy as np
import wave
RATE=44100;OUT=Path(__file__).resolve().parents[2]/'public/sfx/enemies'
OUT.mkdir(parents=True,exist_ok=True);rng=np.random.default_rng(841)
def save(name,x):
 x=np.tanh(x*1.5);x=x/max(1,abs(x).max())*.8
 with wave.open(str(OUT/(name+'.wav')),'wb') as f:f.setparams((1,2,RATE,0,'NONE','not compressed'));f.writeframes((x*32767).astype('<i2').tobytes())
def voice(duration,high):
 t=np.arange(int(RATE*duration))/RATE;f0=(265 if high else 215)+(130 if high else 55)*np.sin(np.minimum(1,t/duration)*np.pi*.8)+8*np.sin(t*39)
 phase=np.cumsum(f0)/RATE*2*np.pi;out=np.zeros_like(t)
 # Harmonic glottal source through A/E formants, with a breathy edge.
 for n in range(1,27):
  frequency=f0*n;weight=.04+sum(np.exp(-((frequency-f)/w)**2)*a for f,w,a in [(780,180,1),(1490,230,.65),(2700,350,.4)])
  out+=np.sin(phase*n)*weight/n**.8
 envelope=np.minimum(1,t/.07)*np.minimum(1,(duration-t)/.16)*(1+.12*np.sin(t*34))
 return (out+rng.normal(0,.045,len(t)))*envelope
save('karen-screech',voice(1.25,True));save('karen-notice',voice(.28,False))
def blast(duration):
 t=np.arange(int(RATE*duration))/RATE;n=rng.normal(0,1,len(t));return n*np.exp(-t*32)+.7*np.sin(2*np.pi*(95*t-45*t*t))*np.exp(-t*14)
save('kook-shot',blast(.48))
t=np.arange(int(RATE*.35))/RATE;x=np.zeros_like(t)
for at in [.02,.13,.21]:x+=rng.normal(0,1,len(t))*np.exp(-np.maximum(0,t-at)*130)*(t>=at)*.6
save('kook-cock',x)
