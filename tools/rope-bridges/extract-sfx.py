#!/usr/bin/env python3
"""Extract requested temporary Jak creaky-wood effects from a local COMMON.SBK.
Only a one-shot reader: original recordings remain temporary reference assets.
Usage: python3 tools/rope-bridges/extract-sfx.py /path/to/COMMON.SBK
"""
import argparse, hashlib, importlib.util, json, math, struct, wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('jak_audio',ROOT/'tools/extract-jak-jump-audio.py')
audio=importlib.util.module_from_spec(spec);spec.loader.exec_module(audio)
args=argparse.ArgumentParser(description=__doc__);args.add_argument('bank',type=Path);args=args.parse_args()
data=args.bank.read_bytes();count=struct.unpack_from('<I',data,20)[0]
names=[data[24+i*20:40+i*20].split(b'\0')[0].decode('ascii') for i in range(count)]
block=data.index(b'SBlk');attrs=block-24
kind,chunks,bank_offset,bank_size,sample_offset,sample_size=struct.unpack_from('<6I',data,attrs)
assert (kind,chunks,bank_offset)==(3,2,24)
first_sound,first_grain=struct.unpack_from('<II',data,block+28)
samples=data[attrs+sample_offset:attrs+sample_offset+sample_size]
out=ROOT/'public/sfx/rope-bridge';out.mkdir(parents=True,exist_ok=True)
manifest=dict(source='Jak and Daxter: The Precursor Legacy, USA NTSC-v1 COMMON.SBK',status='Temporary original-game SFX placeholders requested by project owner, 2026-11-08',rights='Original game recordings; Naughty Dog / Sony Computer Entertainment. Not covered by the OpenGOAL ISC source-code license.',bankSha256=hashlib.sha256(data).hexdigest(),renderer='PS-ADPCM, authored bank/tone gains, pitch register and 240 Hz grain delays; mono 48 kHz preview mix with 0.65 common headroom',files={})
for name,filename in [('walk-crwood1','step-left.wav'),('walk-crwood2','step-right.wav'),('land-crwood','land.wav')]:
    index=names.index(name);volume,_,_,n,_,_,start=struct.unpack_from('<bbhbbHI',data,block+first_sound+index*12)
    tones=[];cursor=0
    for i in range(n):
        at=block+first_grain+start+i*40;kind,delay=struct.unpack_from('<Ii',data,at);cursor+=delay
        assert kind==1,'Only resident one-shot tones are supported'
        _,gain,center,fine,_,_,_,_,_,adsr1,adsr2,flags,offset,_=struct.unpack_from('<bbbbhbbbbHHHII',data,at+8)
        assert (adsr1,adsr2,flags)==(0x80ff,0x9fc0,0)
        decoded=audio.decode_adpcm(samples,offset);pitch=round(4096*2**((60-abs(center)+fine/128)/12));step=pitch/4096*(1 if center<0 else 44100/audio.RATE)
        rendered=[]
        for j in range(math.ceil(len(decoded)/step)):
            u=min(j*step,len(decoded)-1);lo=int(u);value=decoded[lo]+(decoded[min(lo+1,len(decoded)-1)]-decoded[lo])*(u-lo)
            rendered.append(value*gain/127*volume/127*.65)
        tones.append((round(cursor*audio.RATE/240),rendered,dict(sampleOffset=offset,centerNote=center,centerFine=fine,pitchRegister=pitch,toneVolume=gain,startSeconds=cursor/240)))
    mix=[0.]*max(start+len(rendered) for start,rendered,_ in tones)
    for start,rendered,_ in tones:
        for i,value in enumerate(rendered):mix[start+i]+=value
    assert max(map(abs,mix))<32767
    pcm=[round(v) for v in mix]
    with wave.open(str(out/filename),'wb') as w:
        w.setparams((1,2,audio.RATE,0,'NONE','not compressed'));w.writeframes(struct.pack(f'<{len(pcm)}h',*pcm))
    manifest['files'][filename]=dict(effect=name,duration=len(pcm)/audio.RATE,peak=max(map(abs,pcm)),clippedSamples=0,sha256=hashlib.sha256((out/filename).read_bytes()).hexdigest(),tones=[meta for _,_,meta in tones])
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:{x:v[x] for x in ['effect','duration','peak','clippedSamples']} for k,v in manifest['files'].items()},indent=2))
