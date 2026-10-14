"""Original deterministic 48 kHz camera-impact design, using the project's
existing crunch as a quiet stone texture. No external audio downloads."""
from pathlib import Path
import json, wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/sfx/boulder-camera';OUT.mkdir(parents=True,exist_ok=True)
SR=48000

def filtered_noise(rng,n,lo,hi):
    x=rng.normal(size=n);f=np.fft.rfftfreq(n,1/SR)
    shape=np.exp(-(f/hi)**4)*(1-np.exp(-(f/max(1,lo))**4))
    y=np.fft.irfft(np.fft.rfft(x)*shape,n=n)
    return y/(np.std(y)+1e-12)

def texture():
    with wave.open(str(ROOT/'public/sfx/crunch.wav')) as w:
        channels,width,rate=w.getnchannels(),w.getsampwidth(),w.getframerate();raw=w.readframes(w.getnframes())
    if width==2:a=np.frombuffer(raw,dtype='<i2').astype(float)/32768
    elif width==1:a=(np.frombuffer(raw,dtype=np.uint8).astype(float)-128)/128
    else:raise ValueError('Unsupported source width')
    return a.reshape(-1,channels).mean(axis=1),rate

receipts=[]
def save(name,a,peak=.78):
    a=a-np.mean(a,axis=0);a*=peak/max(np.max(np.abs(a)),1e-9)
    # Finite de-click tail; the rolling loop already has periodic FFT content.
    if name!='rolling-rush.wav':
        n=min(len(a),int(SR*.018));a[-n:]*=np.linspace(1,0,n)[:,None]
    pcm=np.round(np.clip(a,-1,1)*32767).astype('<i2')
    with wave.open(str(OUT/name),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    receipts.append({'file':name,'sampleRate':SR,'channels':2,'seconds':len(a)/SR,'peak':float(np.max(np.abs(a))),'rms':float(np.sqrt(np.mean(a*a))),'clippedSamples':int(np.count_nonzero(np.abs(pcm)>=32767))})

rng=np.random.default_rng(814);n=SR*2;t=np.arange(n)/SR
rumble=.28*np.sin(2*np.pi*42*t)+.13*np.sin(2*np.pi*72*t)+.34*filtered_noise(rng,n,25,540)
rumble*=.78+.22*np.cos(2*np.pi*3.5*t)
gravel=filtered_noise(rng,n,450,2200)*(.04+.045*(.5+.5*np.sin(2*np.pi*11*t))**8)
roll=rumble+gravel
save('rolling-rush.wav',np.stack([roll,np.roll(roll,37)],axis=1),.52)
crunch,source_rate=texture()
for variant,seconds in enumerate([1.38,1.5,1.28],1):
    rng=np.random.default_rng(8900+variant);n=int(SR*seconds);t=np.arange(n)/SR;a=np.zeros((n,2))
    phase=2*np.pi*((37+variant*2)*t+8.5*(1-np.exp(-t/.115)))
    body=(.67*np.sin(phase)*np.exp(-t/.135)+.24*np.sin(2*np.pi*(29+variant*3)*t)*np.exp(-t/.25))*(1-np.exp(-t/.0017))
    stone=np.interp(t*(.62+variant*.06),np.arange(len(crunch))/source_rate,crunch,left=0,right=0)*np.exp(-t/.19)*.18
    body+=stone+.08*filtered_noise(rng,n,90,1100)*np.exp(-t/.06)
    a+=body[:,None]
    snap=filtered_noise(rng,n,1700,9800)*np.exp(-t/.014)*(1-np.exp(-t/.0004))*.24
    a+=snap[:,None]
    # Irregular crack propagation, then a few restrained glass chips.
    for j in range(27):
        at=.006+float(rng.uniform(0,.12)) if j<13 else .12+float(rng.uniform(0,.72))
        local=t-at;active=local>=0;u=np.maximum(0,local);decay=float(rng.uniform(.015,.065))
        f=float(rng.uniform(1850,7600));pan=float(rng.uniform(-.8,.8))
        tone=np.sin(2*np.pi*f*u)+.26*np.sin(2*np.pi*f*1.681*u)+.12*np.sin(2*np.pi*f*2.31*u)
        env=(1-np.exp(-u/.00035))*np.exp(-u/decay)*active
        grain=(tone*.65+filtered_noise(rng,n,2300,10000)*.35)*env*(.075 if j<13 else .026)*(1-at/seconds)
        a[:,0]+=grain*np.sqrt((1-pan)/2);a[:,1]+=grain*np.sqrt((1+pan)/2)
    dry=a.copy()
    for delay,gain in [(.037,.12),(.071,.08),(.119,.045),(.177,.025)]:
        k=int(delay*SR);a[k:]+=dry[:-k,::-1]*gain
    save(f'camera-hit-{variant}.wav',a)
(OUT/'manifest.json').write_text(json.dumps({'method':'Original offline synthesis with quiet existing crunch.wav texture','assets':receipts},indent=2)+'\n')
print(json.dumps(receipts))
