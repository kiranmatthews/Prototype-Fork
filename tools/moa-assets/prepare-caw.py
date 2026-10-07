"""Fit the public CC0 crow recording to the unchanged two squawk mouth beats.
Decode the public MP3 to a mono PCM WAV at .img2threejs/moa/audio/caw-source.wav
first. Original source: egomassive / Nigel Coop, Freesound 536732 / 75162.
"""
from pathlib import Path
import wave,math,struct,json,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'.img2threejs/moa/audio/caw-source.wav'
with wave.open(str(SOURCE)) as w:
    rate=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
result=np.zeros(round(1.14*32000))
# Use the actual two caws. A modest time/pitch lift matches the old mouth pulses.
for start,end,at,duration in [(.08,.87,0,.56),(1.16,1.76,.64,.43)]:
    source=raw[round(start*rate):round(end*rate)]
    values=np.interp(np.linspace(0,len(source)-1,round(duration*32000)),np.arange(len(source)),source)
    fade=round(.015*32000);values[:fade]*=np.linspace(0,1,fade);values[-fade:]*=np.linspace(1,0,fade)
    result[round(at*32000):round(at*32000)+len(values)]+=values
result*=.78/max(np.max(np.abs(result)),1e-6)
path=ROOT/'public/sfx/moa-caw.wav'
with wave.open(str(path),'wb') as w:
    w.setparams((1,2,32000,0,'NONE','not compressed'));w.writeframes((result*32767).astype('<i2').tobytes())
peck=raw[round(.30*rate):round(.52*rate)].copy()
peck=np.interp(np.linspace(0,len(peck)-1,7040),np.arange(len(peck)),peck)
fade=480;peck[:fade]*=np.linspace(0,1,fade);peck[-fade:]*=np.linspace(1,0,fade);peck*=.68/max(np.max(np.abs(peck)),1e-6)
with wave.open(str(ROOT/'public/sfx/moa-caw-peck.wav'),'wb') as w:
    w.setparams((1,2,32000,0,'NONE','not compressed'));w.writeframes((peck*32767).astype('<i2').tobytes())
license={'title':'Caw.ogg','author':'egomassive','originalAuthor':'Nigel Coop (nigelcoop)','source':'https://freesound.org/people/egomassive/sounds/536732/','originalSource':'https://freesound.org/people/nigelcoop/sounds/75162/','license':'CC0 1.0','licenseUrl':'https://creativecommons.org/publicdomain/zero/1.0/','publicPreview':'https://cdn.freesound.org/previews/536/536732_1415754-hq.mp3','changes':'Trimmed the two calls, resampled to the unchanged animation mouth beats, 15 ms edge fades, mono 32 kHz PCM, peak normalized to 0.78.','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'peckFile':'moa-caw-peck.wav','peckChanges':'0.30–0.52 s excerpt of the first caw with 15 ms edge fades, mono 32 kHz PCM, peak normalized to 0.68','peckSha256':hashlib.sha256((ROOT/'public/sfx/moa-caw-peck.wav').read_bytes()).hexdigest()}
(ROOT/'public/sfx/moa-caw-license.json').write_text(json.dumps(license,indent=2)+'\n')
print('Packed CC0 crow calls:',len(result)/32000,'seconds')
