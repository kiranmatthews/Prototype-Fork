"""Submit individual Meshy Smart Topology modules with persisted task handles.

Meshy resolves its existing local OAuth profile; signed responses and source
models remain in the ignored authoring folder. No credentials are read here.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/treehouse-trail'
WORK.mkdir(parents=True, exist_ok=True)
NODE = os.environ.get('MESHY_NODE', '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
CLI = os.environ.get('MESHY_CLI', '/tmp/carlisle-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
SPECS = {'body': 3000, 'balcony': 2000, 'stairs': 1800, 'landing': 1200, 'tree': 3000, 'bush': 1200}
LEDGER = ROOT / 'tools/treehouse-trail/tasks.json'
data = json.loads(LEDGER.read_text()) if LEDGER.exists() else {
    'provider': 'Meshy', 'modelType': 'smart-topology', 'model': 'meshy-t2',
    'supersededMonolithicTask': {'id': '01a0a207-3e3c-767c-b6be-dd375e7a040b', 'credits': 15, 'note': 'Superseded before integration by separate-chunk user request; asset is not published.'},
    'tasks': {}}
def cli(*args):
    result = subprocess.run([NODE, CLI, *args], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr[:1600])
    return json.loads(result.stdout)
for name in sys.argv[1:]:
    assert name in SPECS
    if name in data['tasks']:
        print(name, 'already recorded; use its existing handle')
        continue
    data['tasks'][name] = {'state': 'submitting', 'targetTriangles': SPECS[name]}
    LEDGER.write_text(json.dumps(data, indent=2) + '\n')
    result = cli('image-to-3d', 'create', '--image-url', str(ROOT / 'tools/treehouse-trail' / (name + '-reference.png')),
        '--model-type', 'smart-topology', '--target-polycount', str(SPECS[name]),
        '--should-texture', 'true', '--enable-pbr', 'true', '--texture-resolution', '2k',
        '--target-formats', 'glb', '--operation-id', 'treehouse-trail-module-' + name + '-2026-09-15', '--async')
    (WORK / (name + '-create.json')).write_text(json.dumps(result, indent=2))
    data['tasks'][name].update(id=result['task_id'], state=result['status'], estimatedCredits=15)
    LEDGER.write_text(json.dumps(data, indent=2) + '\n')
    print(name, result['task_id'], result['status'], flush=True)
