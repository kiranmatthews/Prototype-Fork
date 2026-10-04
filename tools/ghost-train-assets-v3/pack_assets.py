#!/usr/bin/env python3
"""Reuse the measured Meshy packer without replacing surfaces or original UVs."""
from pathlib import Path
import importlib.util
import json
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ghost_meshy_packer',ROOT/'tools/ghost-train-assets-v2/pack_assets.py')
packer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)
packer.HERE=HERE
packer.WORK=ROOT/'.img2threejs/ghost-train-v3'
packer.SPECS=json.loads((HERE/'prompts.json').read_text())
packer.HERO={'bathhouse-wall-v3','bathhouse-arch-v3'}
ledger=json.loads((HERE/'tasks.json').read_text())['tasks']
packer.SOURCE_STAGES={name:name+'-repaint' for name in packer.SPECS if ledger.get(name+'-repaint',{}).get('state')=='SUCCEEDED'}
manifest={}
for name in packer.SPECS:
    record=packer.pack(name)
    manifest[name]=record
    print(json.dumps({name:{k:record[k] for k in ['triangles','bytes','size','suggestedUniformMetres']}}))
(HERE/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
