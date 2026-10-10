"""Original, deterministic placeholder foley; no recordings or external assets.

Run with Python + NumPy. 24 kHz mono PCM keeps all 24 cues under 500 KiB.
Attack layers, filtered noise and inharmonic resonances avoid bare UI bleeps.
"""
from pathlib import Path
import json
import wave
import numpy as np

RATE = 24000
OUT = Path(__file__).resolve().parents[1] / 'public/sfx/enemies'
OUT.mkdir(parents=True, exist_ok=True)
RNG = np.random.default_rng(1042026)
report = []


def lowpass(x, hz):
    a = 1 - np.exp(-2 * np.pi * hz / RATE)
    y = np.empty_like(x)
    value = 0.
    for i, sample in enumerate(x):
        value += a * (sample - value)
        y[i] = value
    return y


def noise(t, hz=2400):
    x = RNG.standard_normal(len(t))
    return lowpass(x, hz) - lowpass(x, 80)


def tone(t, hz, harmonics=(1, .24, .08)):
    phase = np.cumsum(np.broadcast_to(hz, t.shape)) * (2 * np.pi / RATE)
    return sum(g * np.sin((i + 1) * phase) for i, g in enumerate(harmonics))


def hit(t, at, hz=160, decay=.075, metal=False):
    u = np.maximum(0, t - at)
    envelope = (t >= at) * (1 - np.exp(-u * 2200)) * np.exp(-u / decay)
    partials = [1, 2.71, 4.13] if metal else [1, 1.53, 2.07]
    body = sum(g * np.sin(2 * np.pi * hz * p * u) for p, g in zip(partials, [1, .28, .13]))
    return envelope * (body + noise(t, 2600 if metal else 1100) * .55)


def cue(name, duration, make):
    t = np.arange(round(duration * RATE)) / RATE
    x = make(t)
    x -= np.mean(x)
    x *= np.minimum(1, t / .004) * np.minimum(1, (duration - t) / .025)
    x = np.tanh(x * 1.15)
    x *= .74 / max(.001, np.max(np.abs(x)))
    samples = np.round(x * 32767).astype('<i2')
    samples[0] = samples[-1] = 0
    with wave.open(str(OUT / (name + '.wav')), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(samples.tobytes())
    report.append({'file': name + '.wav', 'seconds': duration, 'peak': round(float(np.max(np.abs(x))), 3),
                   'rms': round(float(np.sqrt(np.mean(x*x))), 4)})


cue('crab-step', .13, lambda t: hit(t, 0, 510, .023) + .3*hit(t, .027, 820, .018))
cue('crab-clack', .42, lambda t: hit(t, .015, 720, .035) + .7*hit(t, .17, 570, .05) + .3*hit(t, .24, 910, .025))
cue('spiker-step', .14, lambda t: hit(t, 0, 210, .035) + noise(t, 1700)*np.exp(-t/.06)*.65)
cue('spiker-snuffle', .54, lambda t: (noise(t, 750)*.7 + tone(t, 145+18*np.sin(t*18), (1,.4,.2))*.18)
    * (np.sin(np.pi*t/.54)**2) * (.55+.45*np.sin(t*24)**2))
cue('turtle-step', .23, lambda t: hit(t, 0, 90, .07) + .3*hit(t, .048, 165, .06) + noise(t, 950)*np.exp(-t/.07)*.5)
cue('turtle-grumble', .66, lambda t: tone(t, 82+12*np.sin(t*8), (1,.5,.3)) * np.sin(np.pi*t/.66)**2
    * (.7+.3*np.sin(t*52)) + noise(t, 350)*np.sin(np.pi*t/.66)*.2)
cue('bull-step', .18, lambda t: hit(t, 0, 110, .042) + .42*hit(t, .028, 290, .028))
cue('bull-snort', .54, lambda t: (noise(t, 1100)*.9 + tone(t, 92+20*np.sin(t*7), (1,.55,.27))*.27)
    * np.sin(np.pi*t/.54)**1.7 * (.7+.3*np.sin(t*70)))
cue('bull-charge', .40, lambda t: hit(t, 0, 88, .07) + (noise(t, 1500)*.7+tone(t, 150-150*t)*.2)
    * np.sin(np.pi*t/.40)**2)
cue('bull-brake', .46, lambda t: hit(t, 0, 95, .07) + .35*hit(t, .14, 135, .04)
    + noise(t, 2200)*np.sin(np.pi*t/.46)**2*np.exp(-t*3)*.65)
cue('frog-croak', .53, lambda t: tone(t, 205+65*np.sin(np.pi*t/.53), (1,.48,.22))
    * np.sin(np.pi*t/.53)**2 * (.4+.6*np.sin(t*52)**2))
cue('frog-hop', .27, lambda t: tone(t, 160+750*(1-np.exp(-t*14)), (1,.10))
    * np.sin(np.pi*t/.27)**2 * np.exp(-t*5) + noise(t, 1900)*np.sin(np.pi*t/.27)*.15)
cue('frog-land', .28, lambda t: tone(t, 90+520*np.exp(-t*29), (1,.28)) * np.exp(-t*19)
    + .35*hit(t, .045, 290, .038) + noise(t, 2100)*np.exp(-t*32)*.25)
cue('drone-hover', .44, lambda t: (tone(t, 280+35*np.sin(t*13), (1,.15,.04))*.5+noise(t, 1400)*.18)
    * np.sin(np.pi*t/.44)**2 * (.7+.3*np.sin(t*85)))
cue('drone-swoop', .78, lambda t: (tone(t, 470-300*np.sin(np.pi*t/.78), (1,.18))*.4+noise(t, 3200)*.65)
    * np.sin(np.pi*t/.78)**2 * (.85+.15*np.sin(t*95)))
cue('sentry-charge', .55, lambda t: (tone(t, 230+800*(t/.55)**1.6, (1,.18,.04))*.6+noise(t, 2000)*.14)
    * np.sin(np.pi*t/.55)**.75 * (.85+.15*np.sin(t*(35+160*t))))
cue('sentry-fire', .24, lambda t: tone(t, 140+640*np.exp(-t*35), (1,.24)) * np.exp(-t*25)
    + noise(t, 4000)*np.exp(-t*35)*.5 + .2*hit(t, .014, 730, .035, True))
cue('sentry-cool', .32, lambda t: noise(t, 3400)*np.sin(np.pi*t/.32)*np.exp(-t*8)
    + .15*hit(t, .018, 720, .035, True))
cue('spinner-open', .34, lambda t: sum(hit(t, a, 470+i*55, .032, True)*.45 for i,a in enumerate([0,.052,.099,.14]))
    + (noise(t, 2900)*.7+tone(t, 160+1000*t, (1,.12))*.2)*np.sin(np.pi*t/.34)**2)
cue('spinner-close', .31, lambda t: sum(hit(t, a, 630-i*110, .037, True)*.5 for i,a in enumerate([0,.047,.115,.21]))
    + noise(t, 1600)*np.sin(np.pi*t/.31)*np.exp(-t*8)*.35)
cue('metal-step', .18, lambda t: hit(t, 0, 390, .055, True) + .28*hit(t, .03, 980, .035, True))
cue('goblin-mutter', .63, lambda t: tone(t, 135+42*np.sin(t*19), (1,.6,.25))
    * np.sin(np.pi*t/.63)**2 * (.20+.8*np.sin(t*14)**2) + noise(t, 650)*np.sin(np.pi*t/.63)*.14)
cue('organic-down', .32, lambda t: hit(t, 0, 105, .055) + tone(t, 130+380*np.exp(-t*14), (1,.16))
    * np.sin(np.pi*t/.32)*np.exp(-t*8) + noise(t, 1400)*np.exp(-t*20)*.2)
cue('machine-down', .38, lambda t: hit(t, 0, 270, .10, True) + .4*hit(t, .065, 510, .08, True)
    + noise(t, 2200)*np.exp(-t*16)*.35)

(OUT / 'manifest.json').write_text(json.dumps({'provenance': 'Original procedural placeholder foley; no external samples.',
    'generator': 'tools/make-enemy-sounds.py', 'sampleRate': RATE, 'channels': 1, 'bits': 16, 'sounds': report}, indent=2)+'\n')
print(f'Wrote {len(report)} original cues ({sum(p.stat().st_size for p in OUT.glob("*.wav")):,} bytes).')
