"""Original moa voice, synthesized locally with no samples or external services."""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 32000
ROOT = Path(__file__).resolve().parents[1] / 'public' / 'sfx'


def voice(duration, pulses, seed):
    rng = random.Random(seed)
    phase = 0
    result = []
    for i in range(round(duration * RATE)):
        t = i / RATE
        value = 0
        for start, length, pitch in pulses:
            u = (t - start) / length
            if 0 <= u < 1:
                envelope = min(1, u / .045) * min(1, (1 - u) / .13)
                frequency = pitch * (1 - .42 * u + .11 * math.sin(u * 19))
                frequency *= 1 + .04 * math.sin(t * 2 * math.pi * 37)
                phase += 2 * math.pi * frequency / RATE
                # Breathy rasp under a nasal, falling, rubber-duck honk.
                reed = math.sin(phase + 1.8 * math.sin(phase * 2))
                formant = .23 * math.sin(phase * 3) + .12 * math.sin(phase * 5)
                rasp = rng.uniform(-1, 1) * .095
                value = math.tanh((reed + formant + rasp) * 1.6) * envelope * .78
        result.append(value)
    return result


def write(name, samples):
    ROOT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(ROOT / name), 'wb') as wav:
        wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        wav.writeframes(b''.join(struct.pack('<h', round(max(-.9, min(.9, x)) * 32767)) for x in samples))
    print(name, len(samples) / RATE, 'seconds')


write('moa-squawk.wav', voice(1.14, [(0, .56, 490), (.64, .43, 670)], 204))
write('moa-peck.wav', voice(.22, [(0, .18, 260)], 205))
