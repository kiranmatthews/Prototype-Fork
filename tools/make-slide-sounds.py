"""Original, deterministic placeholder foley for the slide and slide jump.

No recordings or external assets, and no dependencies beyond Python itself.
24 kHz mono PCM16, like the other generated placeholders.

  slide.wav       a short rush of air, the hip thumping down, then a gritty
                  scrape whose pitch and level fall away as the skid brakes
  slide-jump.wav  a scuff off the floor, a soft springy rise, and one swish
                  of air as the knees come up
"""
from pathlib import Path
import json
import math
import random
import struct
import wave

RATE = 24000
OUT = Path(__file__).resolve().parents[1] / 'public/sfx'
RNG = random.Random(20261110)


def smooth(u):
    u = min(1., max(0., u))
    return u * u * (3 - 2 * u)


def swept_noise(seconds, centre, width, level, grain=None):
    """White noise through a state-variable band-pass whose centre moves."""
    low = band = 0.
    out = []
    hold = 1.
    for i in range(int(seconds * RATE)):
        t = i / RATE
        f = 2 * math.sin(math.pi * min(centre(t), RATE * .22) / RATE)
        high = RNG.uniform(-1, 1) - low - width * band
        band += f * high
        low += f * band
        if grain and i % max(1, int(RATE / grain(t))) == 0:
            hold = RNG.uniform(.35, 1.)  # gravel: the scrape catches and lets go
        out.append(band * level(t) * (hold if grain else 1.))
    return out


def tone(seconds, hertz, level, harmonics=(1., .3, .1)):
    phase = 0.
    out = []
    for i in range(int(seconds * RATE)):
        t = i / RATE
        phase += 2 * math.pi * hertz(t) / RATE
        out.append(level(t) * sum(g * math.sin((k + 1) * phase) for k, g in enumerate(harmonics)))
    return out


def mix(seconds, *layers):
    out = [0.] * int(seconds * RATE)
    for start, samples in layers:
        offset = int(start * RATE)
        for i, value in enumerate(samples):
            if offset + i < len(out):
                out[offset + i] += value
    return out


def write(name, samples, peak=.84):
    # Short edge fades, then normalise: a placeholder must never click or clip.
    fade = int(.005 * RATE)
    for i in range(fade):
        samples[i] *= i / fade
        samples[-1 - i] *= i / fade
    top = max(abs(s) for s in samples) or 1.
    data = [int(round(s / top * peak * 32767)) for s in samples]
    with wave.open(str(OUT / name), 'wb') as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(struct.pack('<%dh' % len(data), *data))
    rms = math.sqrt(sum(d * d for d in data) / len(data)) / 32767
    return {'file': name, 'seconds': round(len(data) / RATE, 3), 'peak': peak, 'rms': round(rms, 4)}


def slide():
    rush = swept_noise(.16, lambda t: 500 + 2600 * smooth(t / .14), .9,
                       lambda t: .5 * math.sin(math.pi * min(1., t / .16)) ** 2)
    thump = tone(.14, lambda t: 58 + 70 * math.exp(-t / .025), lambda t: math.exp(-t / .045), (1., .2))
    slap = swept_noise(.05, lambda t: 1400, 1.2, lambda t: .8 * math.exp(-t / .012))
    scrape = swept_noise(.44, lambda t: 2100 - 1500 * smooth(t / .40), .55,
                         lambda t: (1 - math.exp(-t / .012)) * math.exp(-t / .17) * (1 - smooth((t - .34) / .10)),
                         grain=lambda t: 95 - 55 * smooth(t / .40))
    grit = swept_noise(.44, lambda t: 5200 - 2400 * smooth(t / .40), .8,
                       lambda t: .35 * (1 - math.exp(-t / .02)) * math.exp(-t / .12),
                       grain=lambda t: 160 - 90 * smooth(t / .40))
    return mix(.62, (0, rush), (.13, [.9 * s for s in thump]), (.13, slap), (.14, scrape), (.14, grit))


def slide_jump():
    scuff = swept_noise(.07, lambda t: 2600 - 1200 * t / .07, .8, lambda t: .7 * math.exp(-t / .018))
    # A soft rubbery rise, wobbling as it lets go: more "whup" than "boing".
    spring = tone(.26, lambda t: (170 + 420 * smooth(t / .20) ** .8) * (1 + .035 * math.exp(-t / .09) * math.sin(2 * math.pi * 31 * t)),
                  lambda t: (1 - math.exp(-t / .006)) * math.exp(-t / .085), (1., .42, .16, .05))
    lift = swept_noise(.24, lambda t: 500 + 2400 * smooth(t / .2), .9,
                       lambda t: .5 * math.sin(math.pi * min(1., t / .24)) ** 2)
    swish = lambda top: swept_noise(.13, lambda t: 900 + top * math.sin(math.pi * t / .13), 1.,
                                    lambda t: math.sin(math.pi * min(1., t / .13)) ** 3)
    return mix(.40, (0, scuff), (.01, [.55 * s for s in spring]), (.02, lift),
               (.18, [.36 * s for s in swish(2400)]))


report = [write('slide.wav', slide()), write('slide-jump.wav', slide_jump())]
print(json.dumps(report))
