#!/usr/bin/env python3
"""Offline census of the textures a built release ships. Read-only.

    npm run build
    python3 tools/texture-census.py [dist]

Lists embedded GLB images and standalone images by directory with hosted bytes
and an estimate of GPU bytes if loaded (width x height x 4 bytes x 4/3 for
mipmaps; KTX2 counted at 1 byte per texel). GPU cost follows pixel count, not
file size: an 8192 x 8192 map costs about 341 MB however small its file is.
Requires Pillow. No browser is needed, so it runs anywhere the build does.
"""
import collections, io, json, os, struct, sys
from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else 'dist'
KTX2 = bytes([0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A])


def ktx2_size(data):
    return struct.unpack_from('<II', data, 20) if data[:12] == KTX2 else (0, 0)


rows = []  # (path, mime, width, height, bytes, gpu-compressed)
for directory, _, names in os.walk(root):
    for name in names:
        target = os.path.join(directory, name)
        relative = os.path.relpath(target, root).replace(os.sep, '/')
        extension = name.rsplit('.', 1)[-1].lower()
        try:
            if extension == 'glb':
                with open(target, 'rb') as handle:
                    length = struct.unpack_from('<I', handle.read(20), 12)[0]
                    document = json.loads(handle.read(length))
                    handle.read(8)
                    start = handle.tell()
                    for image in document.get('images', []):
                        if 'bufferView' not in image:
                            continue
                        view = document['bufferViews'][image['bufferView']]
                        handle.seek(start + view.get('byteOffset', 0))
                        data = handle.read(view['byteLength'])
                        mime = image.get('mimeType', '')
                        if mime == 'image/ktx2':
                            width, height = ktx2_size(data)
                        else:
                            width, height = Image.open(io.BytesIO(data)).size
                        rows.append((relative, mime, width, height, view['byteLength'], mime == 'image/ktx2'))
            elif extension in ('webp', 'png', 'jpg', 'jpeg'):
                width, height = Image.open(target).size
                rows.append((relative, extension, width, height, os.path.getsize(target), False))
            elif extension == 'ktx2':
                with open(target, 'rb') as handle:
                    width, height = ktx2_size(handle.read(64))
                rows.append((relative, 'ktx2', width, height, os.path.getsize(target), True))
        except Exception as error:  # report, never hide, an unreadable image
            print('unreadable', relative, str(error)[:60], file=sys.stderr)


def gpu(row):
    return row[2] * row[3] * (1 if row[5] else 4) * 4 / 3 / 1048576


groups = collections.defaultdict(lambda: [0, 0, 0.0, 0, collections.Counter()])
for row in rows:
    parts = row[0].split('/')
    key = '/'.join(parts[:2]) if parts[0] == 'props' else parts[0]
    group = groups[key]
    group[0] += 1
    group[1] += row[4]
    group[2] += gpu(row)
    group[3] += max(row[2], row[3]) >= 2048
    group[4][max(row[2], row[3])] += 1

print(f"{'directory':34}{'images':>7}{'hostedMB':>10}{'gpuMB':>8}{'>=2048':>8}  common sizes")
for key, group in sorted(groups.items(), key=lambda item: -item[1][2])[:30]:
    print(f"{key[:33]:34}{group[0]:7}{group[1] / 1e6:10.1f}{group[2]:8.0f}{group[3]:8}  {dict(group[4].most_common(4))}")
print(f"total {len(rows)} images, {sum(row[4] for row in rows) / 1e6:.1f} MB hosted")
print('\nlargest textures by estimated GPU bytes:')
for row in sorted(rows, key=lambda row: -gpu(row))[:40]:
    print(f"{gpu(row):7.1f} MB  {row[2]}x{row[3]:<5} {row[4] / 1e6:6.2f} MB file  {row[0]}")
