"""Reuse the existing KTX2 + JPEG fallback GLB packer; separate map manifest."""
import importlib.util
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('pack_modular',ROOT/'tools/jungle-kit/pack_modular.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.WORK=ROOT/'.img2threejs/map-kit';engine.OUT=ROOT/'public/map-kit';engine.OUT.mkdir(parents=True,exist_ok=True)
specs=[s for s in json.loads((ROOT/'tools/map-kit/module-specs.json').read_text()) if not s.get('rejected')]
report=[engine.pack(s) for s in specs]
assert all(0<r['triangles']<15000 and r['lodTriangles']<r['triangles'] for r in report)
(engine.OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
