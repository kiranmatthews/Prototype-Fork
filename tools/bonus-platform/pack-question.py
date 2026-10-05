"""Pack the generated masonry pad while retaining Meshy's topology and UVs."""
from pathlib import Path
import hashlib
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('meshy_web_pack', ROOT / 'tools/jungle-kit/pack.py')
packer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)
packer.WORK = ROOT / '.img2threejs/bonus-question'
packer.OUT = ROOT / 'public/props/bonus-platform'
record = packer.pack('question-masonry')
task = json.loads((ROOT / 'tools/bonus-platform/question-task.json').read_text())['tasks']['question-masonry']
record.update(provider='Meshy', task={key: value for key, value in task.items() if key != 'payload'},
    concept='art/bonus-platform/question-masonry.png',
    conceptSha256=hashlib.sha256((ROOT / 'art/bonus-platform/question-masonry.png').read_bytes()).hexdigest(),
    prompt='art/bonus-platform/question-masonry-prompt.txt', runtimeSize=[3.2, 1.05, 3.2], runtimeYawDegrees=60,
    material='Warm golden sandstone question-mark blocks in cool dark blue-grey masonry; one 1024px base-colour texture.')
(packer.OUT / 'question-provenance.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
