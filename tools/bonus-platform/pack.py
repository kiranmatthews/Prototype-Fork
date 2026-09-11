"""Reuse the established Meshy web packer, retaining the generated mesh and UVs."""
from pathlib import Path
import importlib.util,json,hashlib
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('meshy_web_pack',root/'tools/jungle-kit/pack.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
module.WORK=root/'.img2threejs/bonus-platform';module.OUT=root/'public/props/bonus-platform';module.OUT.mkdir(parents=True,exist_ok=True)
record=module.pack('stone-circle')
record.update(provider='Meshy',task=json.loads((root/'tools/bonus-platform/task.json').read_text()),concept='art/bonus-platform/concept.png',conceptSha256=hashlib.sha256((root/'art/bonus-platform/concept.png').read_bytes()).hexdigest(),prompt='art/bonus-platform/concept-prompt.txt',runtimeSize=[3.2,1.05,3.2])
(module.OUT/'provenance.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
