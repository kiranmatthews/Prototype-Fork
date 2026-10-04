#!/usr/bin/env python3
"""Extract actual Meshy ceramic pixels through the delivered triangle UVs."""
from pathlib import Path
import importlib.util
import hashlib
import json
import shutil
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ghost_uv_projection',ROOT/'tools/ghost-train-assets-v2/measure_assets.py')
projection=importlib.util.module_from_spec(spec)
spec.loader.exec_module(projection)
proof=projection.project_texture('bathhouse-wall-v3',2,-1,[0,1],'meshy-bath-wall-uv-v3.png',1024,ROOT/'public/ghost-train/bathhouse-wall-v3.glb')
source=Image.open(ROOT/proof['path'])
crop=[143,102,901,573]
tile=source.crop(crop).convert('RGB').resize((512,512),Image.Resampling.LANCZOS)
path=ROOT/'public/ghost-train/meshy-bath-tiles-v3.png'
tile.save(path)
proof_path=HERE/'proof/bath-wall-uv.png'
proof_path.parent.mkdir(exist_ok=True)
shutil.move(ROOT/proof['path'],proof_path)
proof['path']=str(proof_path.relative_to(ROOT))
proof.update({'output':str(path.relative_to(ROOT)),'cropPixels':crop,'outputSize':[512,512],
    'region':'Upper broad ceramic panel, excluding the metal edge frame and lower push bar',
    'outputSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
    'sourceModelSha256':hashlib.sha256((ROOT/'public/ghost-train/bathhouse-wall-v3.glb').read_bytes()).hexdigest()})
(HERE/'texture-provenance.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof))
