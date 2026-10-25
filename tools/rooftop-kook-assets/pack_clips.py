"""Losslessly package the exact exported Meshy animation JSON for hosting."""
from pathlib import Path
import gzip
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCES = Path(__file__).resolve().parent / 'animation-clips'
PUBLIC = ROOT / 'public/rooftop-kook'


def pack_character(name):
    raw = (SOURCES / (name + '-clips.json')).read_bytes()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    assert gzip.decompress(packed) == raw
    # A .bin extension avoids static hosts assigning Content-Encoding:gzip,
    # which would decompress the body before the runtime decoder receives it.
    target = PUBLIC / (name + '-clips.bin')
    target.write_bytes(packed)
    clips = json.loads(raw)
    report = {
        'encoding': 'gzip', 'sourceBytes': len(raw), 'packedBytes': len(packed),
        'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'packedSha256': hashlib.sha256(packed).hexdigest(),
        'clips': [{'name': clip['name'], 'duration': clip['duration'],
                   'tracks': len(clip['tracks']),
                   'keyframes': sum(len(track['times']) for track in clip['tracks'])}
                  for clip in clips],
        'exactRoundTrip': True,
    }
    (PUBLIC / (name + '-clips.manifest.json')).write_text(json.dumps(report, indent=2) + '\n')
    print(name, len(raw), '->', len(packed), 'bytes; exact round trip')
    return report


if __name__ == '__main__':
    for character in sys.argv[1:] or ['karen-rain', 'kook-rain']:
        pack_character(character)
