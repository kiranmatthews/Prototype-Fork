"""Original seamless rain bed, with wind swell and small roof patters."""
from pathlib import Path
import numpy as np
import wave
rate=44100;duration=8;n=rate*duration
rng=np.random.default_rng(20261026);t=np.arange(n)/rate
frequencies=np.fft.rfftfreq(n,1/rate)
noise=np.fft.rfft(rng.normal(0,1,n))
shape=(frequencies/(frequencies+250))**.7/(1+(frequencies/7200)**2)
rain=np.fft.irfft(noise*shape,n)
rain*=.16*(.86+.09*np.sin(t*np.pi/4)+.05*np.sin(t*np.pi/2+.7))
wind=np.fft.irfft(np.fft.rfft(rng.normal(0,1,n))/(1+(frequencies/280)**2),n)
rain+=wind*.33*(.7+.3*np.sin(t*np.pi/4+.5))
for _ in range(160):
 at=int(rng.uniform(0,n));length=int(rate*.035);age=np.arange(length)/rate
 tap=rng.normal(0,1,length)*np.exp(-age*200)*rng.uniform(.015,.065)
 rain[(at+np.arange(length))%n]+=tap
rain=np.tanh(rain)
out=Path(__file__).resolve().parents[2]/'public/sfx/weather/rooftop-rain.wav'
out.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(out),'wb') as f:
 f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes((rain*32767).astype('<i2').tobytes())
print(f'Original rain loop: {duration}s, {out.stat().st_size} bytes')
