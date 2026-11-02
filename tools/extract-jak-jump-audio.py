#!/usr/bin/env python3
"""Extract local jump placeholders from a user's Jak 1 NTSC-v1 COMMON.SBK.

Usage: python3 tools/extract-jak-jump-audio.py COMMON.SBK /outside/repo/audio
Format evidence: OpenGOAL v0.3.9 game/sound/989snd/{loader,sfxgrain,voice,
util,player}.cpp. This standalone reader contains no game samples. It renders
the resident PS-ADPCM one-shots, including tone pitch, gain and 240 Hz delays.
Linear resampling is for motion preview; it does not emulate the SPU mixer.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import wave

RATE = 48000
COEFFICIENTS = ((0, 0), (60, 0), (115, -52), (98, -55), (122, -60))


def decode_adpcm(data, offset):
    samples, h1, h2 = [], 0, 0
    for at in range(offset, len(data) - 15, 16):
        shift, filt, flags = data[at] & 15, data[at] >> 4, data[at + 1]
        if shift > 12 or filt >= len(COEFFICIENTS):
            raise ValueError(f'Invalid ADPCM header at {at}')
        c1, c2 = COEFFICIENTS[filt]
        for byte in data[at + 2:at + 16]:
            for nibble in (byte & 15, byte >> 4):
                signed = nibble if nibble < 8 else nibble - 16
                value = ((signed << 12) >> shift) + ((c1 * h1) >> 6) + ((c2 * h2) >> 6)
                value = max(-32768, min(32767, value))
                samples.append(value)
                h2, h1 = h1, value
        if flags & 1:
            if flags & 2:
                raise ValueError('Looping tone is outside this one-shot extractor')
            return samples
    raise ValueError('Missing ADPCM end flag')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bank', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    repo = Path(__file__).resolve().parents[1]
    if output == repo or repo in output.parents:
        parser.error('Use a local study directory outside the repository for extracted assets.')
    data = args.bank.read_bytes()
    count, = struct.unpack_from('<I', data, 20)
    names = [data[24 + i * 20:40 + i * 20].split(b'\0')[0].decode('ascii') for i in range(count)]
    block = data.index(b'SBlk')
    attrs = block - 24
    typ, chunks, bank_offset, bank_size, sample_offset, sample_size = struct.unpack_from('<6I', data, attrs)
    if (typ, chunks, bank_offset) != (3, 2, 24) or struct.unpack_from('<I', data, block + 4)[0] != 1:
        raise ValueError('Expected a v1 Jak 1 resident SFX bank')
    sound_count, = struct.unpack_from('<h', data, block + 22)
    first_sound, first_grain = struct.unpack_from('<II', data, block + 28)
    assert sound_count == count and block + bank_size <= len(data)
    sample_data = data[attrs + sample_offset:attrs + sample_offset + sample_size]
    assert len(sample_data) == sample_size

    def grains(name):
        index = names.index(name)
        vol, _, _, n, _, _, start = struct.unpack_from('<bbhbbHI', data, block + first_sound + index * 12)
        result = []
        for i in range(n):
            at = block + first_grain + start + i * 40
            kind, delay = struct.unpack_from('<Ii', data, at)
            result.append((kind, delay, data[at + 8:at + 40]))
        return vol, result

    def render_tone(payload):
        tone = struct.unpack_from('<bbbbhbbbbHHHII', payload)
        _, volume, center, fine, _, _, _, _, _, adsr1, adsr2, flags, offset, _ = tone
        # The selected one-shots have instantaneous attack and no authored
        # envelope decay. Their recorded sample tail supplies the release.
        assert (adsr1, adsr2, flags) == (0x80ff, 0x9fc0, 0)
        decoded = decode_adpcm(sample_data, offset)
        # PS2 tone centers are negative; positive centers use the PS1 rate.
        pitch = round(4096 * 2 ** ((60 - abs(center) + fine / 128) / 12))
        step = pitch / 4096 * (1 if center < 0 else 44100 / RATE)
        rendered = []
        for i in range(math.ceil(len(decoded) / step)):
            at = min(i * step, len(decoded) - 1)
            lo = int(at)
            value = decoded[lo] + (decoded[min(lo + 1, len(decoded) - 1)] - decoded[lo]) * (at - lo)
            rendered.append(value * volume / 127)
        return rendered, {'sampleOffset': offset, 'centerNote': center, 'centerFine': fine,
                          'pitchRegister': pitch, 'toneVolume': volume, 'samples': len(decoded)}

    output.mkdir(parents=True, exist_ok=True)
    manifest = {'source': 'Jak and Daxter, USA NTSC-v1 COMMON.SBK',
                'bankSha256': hashlib.sha256(data).hexdigest(), 'sampleRate': RATE,
                'renderer': 'PS-ADPCM; quantized pitch; linear resampling; 240 Hz grain delays',
                'jump': [], 'doubleJump': [], 'files': {}}
    for name, key in [('jump', 'jump'), ('jump-double', 'doubleJump')]:
        bank_vol, sequence = grains(name)
        randoms = [g for g in sequence if g[0] == 25]
        assert len(randoms) == 1
        choices, group_size = struct.unpack_from('<hh', randoms[0][2])
        assert group_size == 1
        for choice in range(choices):
            scheduled, cursor, i = [], 0, 0
            while i < len(sequence):
                kind, delay, payload = sequence[i]
                cursor += delay
                if kind == 25:
                    options, size = struct.unpack_from('<hh', payload)
                    chosen = sequence[i + 1 + choice]
                    assert chosen[0] == 1 and size == 1
                    cursor += chosen[1]
                    samples, meta = render_tone(chosen[2])
                    scheduled.append((round(cursor * RATE / 240), samples, meta))
                    i += options + 1
                elif kind == 1:
                    samples, meta = render_tone(payload)
                    scheduled.append((round(cursor * RATE / 240), samples, meta))
                    i += 1
                else:
                    raise ValueError(f'Unexpected grain {kind}')
            mix = [0.] * max(start + len(samples) for start, samples, _ in scheduled)
            for start, samples, _ in scheduled:
                for j, value in enumerate(samples):
                    mix[start + j] += value * bank_vol / 127 * .65
            assert max(map(abs, mix)) < 32767, 'Clipping; preserve relative mix and lower common headroom'
            pcm = [round(x) for x in mix]
            filename = f'{name}-{choice + 1}.wav'
            with wave.open(str(output / filename), 'wb') as wav:
                wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
                wav.writeframes(struct.pack(f'<{len(pcm)}h', *pcm))
            manifest[key].append(filename)
            manifest['files'][filename] = {'duration': len(pcm) / RATE, 'peak': max(map(abs, pcm)),
                'tones': [{'startSeconds': start / RATE, **meta} for start, _, meta in scheduled]}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({key: manifest[key] for key in ('source', 'jump', 'doubleJump', 'files')}, indent=2))


if __name__ == '__main__':
    main()
