"""Master the two licensed harbour beds; inputs come from prepare-carlisle-audio.mjs."""
import hashlib
import json
from pathlib import Path
import wave

import numpy as np

ROOT = Path('art/carlisle-shipyard/harbour-sound')
OUT = Path('public/sfx/carlisle')
OUT.mkdir(parents=True, exist_ok=True)
records = []

for source_id, target, fade_seconds, highpass, lowpass, rms_target in [
    ('water', 'harbour-water.wav', 5, 85, 6800, .145),
    ('wind', 'coastal-wind.wav', 4, 110, 4200, .125),
]:
    meta = json.loads(Path(f'/tmp/carlisle-{source_id}.json').read_text())
    rate = meta['rate']
    data = np.stack([np.fromfile(f'/tmp/carlisle-{source_id}-{i}.f32', dtype='<f4')
                     for i in range(meta['channels'])], axis=1).astype(np.float64)
    fade = round(fade_seconds * rate)
    phase = np.linspace(0, np.pi/2, fade)[:, None]
    # The blend ends at the sample directly before the retained middle starts,
    # preserving the waveform across the loop boundary without a silence dip.
    joined = data[-fade:] * np.cos(phase) + data[:fade] * np.sin(phase)
    data = np.concatenate((data[fade:-fade], joined))
    data -= data.mean(axis=0)
    frequency = np.fft.rfftfreq(len(data), 1/rate)
    response = 1 / np.sqrt(1 + (highpass/np.maximum(frequency, 1e-9))**4)
    response *= 1 / np.sqrt(1 + (frequency/lowpass)**8)
    data = np.fft.irfft(np.fft.rfft(data, axis=0)*response[:, None], n=len(data), axis=0)
    data *= min(rms_target/np.sqrt(np.mean(data**2)), .68/np.max(np.abs(data)))
    # Also accommodate the shared audio engine's one-sample-early loop end.
    # A sub-millisecond join removes any isolated PCM discontinuity.
    n = 24
    blend = (.5-.5*np.cos(np.linspace(0, np.pi, n)))[:, None]
    data[-n:] = data[-n:]*(1-blend)+data[0]*blend
    rng = np.random.default_rng(4518)
    pcm = np.round(np.clip(data+(rng.random(data.shape)-rng.random(data.shape))/65536, -.999, .999)*32767).astype('<i2')
    pcm[-2:] = pcm[0]
    path = OUT/target
    with wave.open(str(path), 'wb') as output:
        output.setnchannels(meta['channels']); output.setsampwidth(2); output.setframerate(rate)
        output.writeframes(pcm.tobytes())
    decoded = pcm.astype(float)/32768
    steps = np.abs(np.diff(decoded, axis=0))
    records.append({
        **meta, 'inputDuration': meta['duration'], 'inputFrames': meta['frames'],
        'frames': len(data), 'output': str(path), 'duration': len(data)/rate,
        'crossfadeSeconds': fade_seconds, 'highpassHz': highpass, 'lowpassHz': lowpass,
        'rms': float(np.sqrt(np.mean(decoded**2))), 'peak': float(np.max(np.abs(decoded))),
        'dc': decoded.mean(axis=0).tolist(), 'naturalStepP999': float(np.quantile(steps,.999)),
        'loopBoundaryStep': float(np.max(np.abs(decoded[-2]-decoded[0]))),
        'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    })
(ROOT/'mastering.json').write_text(json.dumps(records, indent=2)+'\n')
print(json.dumps(records, indent=2))
