#!/usr/bin/env python3
"""Budget an Image Blaster/World Labs SPZ v2/v3 for the background renderer.

Keep the original Gaussian attributes (including SH) and coordinate frame.
This is an offline asset step; the game never calls a generation service.
"""
import argparse
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path


def budget_spz(source: Path, destination: Path, budget: int):
    compressed = source.read_bytes()
    data = gzip.decompress(compressed)
    magic, version, count, degree, fractional, flags, reserved = struct.unpack('<III4B', data[:16])
    if magic != 0x5053474e or version not in (2, 3) or degree > 3 or not 1 <= count <= 5_000_000:
        raise ValueError('Expected an SPZ v2/v3 export with at most five million splats')
    sh_bytes = (0, 9, 24, 45)[degree]
    widths = (9, 1, 3, 3, 3 if version == 2 else 4, sh_bytes)
    if len(data) != 16 + count * sum(widths):
        raise ValueError('Truncated or unexpected SPZ attribute data')
    kept = min(count, budget)
    # Every region retains samples, independent of original position ordering.
    indexes = [i * count // kept for i in range(kept)]
    result = bytearray(struct.pack('<III4B', magic, version, kept, degree, fractional, flags, reserved))
    offset = 16
    for attribute, width in enumerate(widths):
        if width:
            part = bytearray().join(data[offset + index * width:offset + (index + 1) * width] for index in indexes)
            if attribute == 3:
                # Preserve coverage when thinning; scales use log units / 16.
                enlargement = round(math.log(math.sqrt(count / kept)) * 16)
                part = bytearray(min(255, value + enlargement) for value in part)
            result.extend(part)
        offset += count * width
    destination.parent.mkdir(parents=True, exist_ok=True)
    output = gzip.compress(result, compresslevel=9, mtime=0)
    destination.write_bytes(output)
    return {'sourceSha256': hashlib.sha256(compressed).hexdigest(), 'sha256': hashlib.sha256(output).hexdigest(),
            'sourceSplats': count, 'splats': kept, 'bytes': len(output), 'version': version,
            'sphericalHarmonicsDegree': degree, 'scaleEnlargement': math.sqrt(count / kept)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--budget', type=int, default=250_000)
    args = parser.parse_args()
    if not 1 <= args.budget <= 500_000:
        parser.error('--budget must be between 1 and 500000')
    print(json.dumps(budget_spz(args.source, args.destination, args.budget), indent=2))
