#!/usr/bin/env python3
"""Resize the pinned top-40 GLB image selection, run ImageOptim, then encode.

Authoring GLBs remain intact. The committed image payloads are applied by the
release build without requiring Pillow, ImageOptim or Khronos tools on CI.
"""
import argparse
import hashlib
import io
import json
import math
import struct
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, features

ROOT = Path(__file__).resolve().parents[1]
COLOUR = {'baseColorTexture', 'emissiveTexture'}
digest = lambda data: hashlib.sha256(data).hexdigest()


def bicubic_sharper(image, size, role):
    """Linear-light, premultiplied colour; unit normal vectors; linear data."""
    if image.size == size:
        return image.convert('RGBA')
    pixels = np.asarray(image.convert('RGBA'), dtype=np.float32) / 255
    alpha = pixels[:, :, 3]
    values = pixels[:, :, :3]
    colour = role in COLOUR
    if colour:
        values = np.where(values <= .04045, values / 12.92, ((values + .055) / 1.055) ** 2.4)
        values *= alpha[:, :, None]
    elif role == 'normalTexture':
        values = values * 2 - 1
    resize = lambda channel: np.asarray(Image.fromarray(channel).resize(size, Image.Resampling.BICUBIC))
    values = np.stack([resize(values[:, :, i]) for i in range(3)], axis=2)
    alpha = np.clip(resize(alpha), 0, 1)
    if colour:
        values /= np.maximum(alpha[:, :, None], 1e-8)
        values = np.clip(values, 0, 1)
        values = np.where(values <= .0031308, values * 12.92, 1.055 * values ** (1 / 2.4) - .055)
    elif role == 'normalTexture':
        lengths = np.linalg.norm(values, axis=2, keepdims=True)
        values = np.where(lengths > 1e-8, values / np.maximum(lengths, 1e-8), [0, 0, 1])
        values = (values + 1) * .5
    rgb = Image.fromarray(np.rint(np.clip(values, 0, 1) * 255).astype(np.uint8))
    if colour:
        rgb = rgb.filter(ImageFilter.UnsharpMask(radius=.6, percent=60, threshold=2))
    rgb.putalpha(Image.fromarray(np.rint(alpha * 255).astype(np.uint8)))
    return rgb


def roles_by_image(doc):
    roles = {}
    def walk(value):
        if isinstance(value, list):
            for item in value: walk(item)
        elif isinstance(value, dict):
            for key, child in value.items():
                if key.endswith('Texture') and isinstance(child, dict) and isinstance(child.get('index'), int):
                    roles.setdefault(child['index'], set()).add(key)
                walk(child)
    walk(doc.get('materials', []))
    images = {}
    for index, texture in enumerate(doc['textures']):
        sources = [texture.get('source')] + [v.get('source') for v in texture.get('extensions', {}).values() if isinstance(v, dict)]
        for source in sources:
            if isinstance(source, int): images.setdefault(source, set()).update(roles.get(index, set()))
    return images


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--codec', type=Path, required=True)
    parser.add_argument('--imageoptim', type=Path, default=Path('/Applications/ImageOptim.app/Contents/MacOS/ImageOptim'))
    parser.add_argument('--resume-optimized', action='store_true', help='Reuse the completed lossless ImageOptim pass, checking every decoded pixel again')
    args = parser.parse_args()
    work, out = args.work.resolve(), args.out.resolve()
    for location in (work, out):
        assert location != ROOT / 'public' and ROOT / 'public' not in location.parents
        location.mkdir(parents=True, exist_ok=True)
    encoded = out / 'encoded'; encoded.mkdir(exist_ok=True)
    selection = json.loads((ROOT / 'tools/top40-glb-textures.json').read_text())
    jobs, models = {}, []
    for selected in selection['models']:
        raw = (ROOT / 'public' / selected['file']).read_bytes()
        size = struct.unpack_from('<I', raw, 12)[0]
        doc = json.loads(raw[20:20 + size]); binary = raw[28 + size:]
        roles = roles_by_image(doc)
        model = dict(selected, sourceSha256=digest(raw), images=[])
        for index, image in enumerate(doc['images']):
            assert 'uri' not in image, 'Only embedded images belong to this batch'
            uses = roles.get(index, set()); assert len(uses) == 1, (selected['file'], index, uses)
            role = next(iter(uses)); view = doc['bufferViews'][image['bufferView']]
            assert view['buffer'] == 0
            start = view.get('byteOffset', 0); data = binary[start:start + view['byteLength']]
            maximum = selection['limits']['colour' if role in COLOUR else 'other']
            source_hash = digest(data); key = digest(data + f'|{role}|{maximum}|bicubic-sharper-v1'.encode())
            mime = image['mimeType']; gpu = mime == 'image/ktx2'
            if key not in jobs:
                png = work / (key + '.png')
                if gpu:
                    ktx = work / (key + '-source.ktx2'); ktx.write_bytes(data)
                    decoded = work / (key + '-decoded.png')
                    if not args.resume_optimized or not decoded.exists():
                        subprocess.run([str(args.codec / 'ktx'), 'extract', '--transcode', 'rgba8', '--level', '0', str(ktx), str(decoded)], check=True, capture_output=True)
                    original = Image.open(decoded)
                else:
                    original = Image.open(io.BytesIO(data))
                width, height = original.size
                ratio = min(1, maximum / max(width, height))
                target = (max(1, round(width * ratio)), max(1, round(height * ratio)))
                resized = bicubic_sharper(original, target, role)
                if resized.getextrema()[3] == (255, 255): resized = resized.convert('RGB')
                resized_png = io.BytesIO(); resized.save(resized_png, format='PNG', compress_level=6)
                if not args.resume_optimized: png.write_bytes(resized_png.getvalue())
                jobs[key] = {'sourceSha256':source_hash, 'sourceBytes':len(data), 'sourceMime':mime,
                             'sourceWidth':width, 'sourceHeight':height, 'width':target[0], 'height':target[1],
                             'role':role, 'gpu':gpu, 'png':png, 'pixelSha256':digest(resized.convert('RGBA').tobytes()),
                             'pngBeforeOptim':len(resized_png.getvalue())}
                print(json.dumps({'prepared':len(jobs), 'file':selected['file'], 'image':index, 'from':[width,height], 'to':target}), flush=True)
            model['images'].append({'index':index, 'key':key})
        models.append(model)
    # Use the real app's documented blocking CLI. Verify decoded pixels after
    # its pass: normal/data channels and transparency must remain intact.
    if not args.resume_optimized:
        preference = subprocess.run(['defaults', 'read', 'net.pornel.ImageOptim', 'LossyEnabled'], capture_output=True, text=True)
        try:
            subprocess.run(['defaults', 'write', 'net.pornel.ImageOptim', 'LossyEnabled', '-bool', 'false'], check=True)
            subprocess.run([str(args.imageoptim), *[str(job['png']) for job in jobs.values()]], check=True)
        finally:
            if preference.returncode == 0:
                subprocess.run(['defaults', 'write', 'net.pornel.ImageOptim', 'LossyEnabled', '-bool', 'true' if preference.stdout.strip() in ('1', 'true', 'YES') else 'false'], check=True)
            else:
                subprocess.run(['defaults', 'delete', 'net.pornel.ImageOptim', 'LossyEnabled'], check=True)
    print('ImageOptim completed; checking pixels and encoding runtime textures', flush=True)
    for index, (key, job) in enumerate(jobs.items(), 1):
        image = Image.open(job['png']).convert('RGBA')
        assert image.size == (job['width'], job['height'])
        assert digest(image.tobytes()) == job['pixelSha256'], 'ImageOptim changed pixels; lossless settings required'
        job['pngAfterOptim'] = job['png'].stat().st_size
        if job['gpu']:
            target = work / (key + '.ktx2')
            command = [str(args.codec / 'toktx'), '--t2', '--encode', 'uastc', '--uastc_quality', '2', '--zcmp', '18', '--threads', '2', '--genmipmap', '--assign_oetf', 'srgb' if job['role'] in COLOUR else 'linear', '--assign_primaries', 'bt709' if job['role'] in COLOUR else 'none']
            subprocess.run([*command, str(target), str(job['png'])], check=True, capture_output=True)
            subprocess.run([str(args.codec / 'ktx'), 'validate', '--gltf-basisu', str(target)], check=True, capture_output=True)
            data = target.read_bytes(); extension = 'ktx2'; job['mimeType'] = 'image/ktx2'
            assert struct.unpack_from('<II', data, 20) == image.size
            job['mipLevels'] = struct.unpack_from('<I', data, 40)[0]
            assert job['mipLevels'] == math.floor(math.log2(max(image.size))) + 1
        else:
            stream = io.BytesIO()
            image.save(stream, format='WEBP', lossless=True, quality=100, method=6, exact=True)
            data = stream.getvalue(); extension = 'webp'; job['mimeType'] = 'image/webp'
            assert Image.open(io.BytesIO(data)).convert('RGBA').tobytes() == image.tobytes()
        job['sha256'] = digest(data); job['bytes'] = len(data); job['file'] = 'encoded/' + job['sha256'] + '.' + extension
        (out / job['file']).write_bytes(data)
        del job['png']; del job['gpu']
        print(json.dumps({'encoded':index, 'total':len(jobs), 'bytes':len(data)}), flush=True)
    for model in models:
        for image in model['images']:
            image.update(jobs[image.pop('key')])
    manifest = {'v':1, 'catalogueCommit':selection['catalogueCommit'], 'limits':selection['limits'],
                'resampling':'Bicubic, linear-light/premultiplied colour + unsharp 0.6/60/2; vector-normalized normals; linear data',
                'optimizer':'ImageOptim blocking CLI; exact decoded RGBA verified',
                'encoding':{'pillow':Image.__version__, 'libwebp':features.version('webp'), 'webp':'lossless method 6', 'ktx':'Khronos 4.4.2 UASTC quality 2, Zstd 18, complete mip chains'},
                'models':models}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'models':len(models), 'uniqueImages':len(jobs), 'imageUses':sum(len(m['images']) for m in models), 'encodedBytes':sum(j['bytes'] for j in jobs.values())}), flush=True)


if __name__ == '__main__': main()
