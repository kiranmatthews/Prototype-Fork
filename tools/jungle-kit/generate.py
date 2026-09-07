"""Run the official Meshy CLI; persist task handles before waiting or downloading.

No credentials enter this repository. Meshy resolves its local OAuth profile.
Raw signed responses stay in the ignored .img2threejs authoring directory.
"""
import json
import fcntl
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/jungle-kit'
WORK.mkdir(parents=True, exist_ok=True)
NODE = os.environ.get('JUNGLE_NODE', '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
CLI = os.environ.get('JUNGLE_MESHY_CLI', '/tmp/codex-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
LEDGER = ROOT / 'tools/jungle-kit/tasks.json'
SPECS = {
    'canopy-tree': ('modular/canopy-tree.png', 2200),
    'roof-hip': ('modular/roof-hip.png', 1000),
    'ashlar-clean': ('modular/ashlar-clean.png', 700),
    'ashlar': ('modular/ashlar.png', 600),
    'broken-ashlar': ('modular/broken-ashlar.png', 850),
    'paving-slab': ('modular/paving-slab.png', 500),
    'carved-block': ('modular/carved-block.png', 1300),
    'column-base': ('modular/column-base.png', 1100),
    'column-shaft': ('modular/column-shaft.png', 900),
    'column-capital': ('modular/column-capital.png', 1100),
    'cornice': ('modular/cornice.png', 850),
    'corner-cornice': ('modular/corner-cornice.png', 1100),
    'lintel': ('modular/lintel.png', 1600),
    'roof-wedge': ('modular/roof-wedge.png', 850),
    'ridge-cap': ('modular/ridge-cap.png', 800),
    'arch-stone': ('modular/arch-stone.png', 700),
    'temple-stair': ('modular/temple-stair.png', 1400),
    'broadleaf': ('broadleaf-simple.png', 1200),
    'palm': ('palm-simple.png', 1800),
    'fern': ('fern-simple.png', 1600),
    'platform': ('platform.png', 2400),
    'wall': ('wall.png', 2400),
    'temple': ('temple.png', 6500),
    'arch': ('arch.png', 4200),
    'log': ('log.png', 1600),
    'thorns': ('thorns.png', 1400),
}

def cli(*args):
    result = subprocess.run([NODE, CLI, *args], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr[:2000] or result.stdout[:2000])
    return json.loads(result.stdout)

def ledger():
    return json.loads(LEDGER.read_text()) if LEDGER.exists() else {
        'budget': 650, 'startingBalance': 676, 'reservedCredits': 15,
        'tasks': {'broadleaf-discarded': {'id': '01a07c0d-4619-75b8-be15-fd0a89f2c756', 'credits': 15, 'note': 'Superseded by user request for simpler plant geometry.'}}
    }

def save(data):
    temporary = LEDGER.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, indent=2) + '\n')
    temporary.replace(LEDGER)

def create(name):
    # One submitter at a time, even when separate tool sessions are alive.
    with (WORK / 'ledger.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        _create(name)

def _create(name):
    data = ledger()
    if name in data['tasks']:
        print(name, 'already submitted:', data['tasks'][name], flush=True)
        return
    image, triangles = SPECS[name]
    balance = cli('balance')['balance']
    if data['reservedCredits'] + 15 > data['budget'] or balance < 41:
        raise RuntimeError('Meshy credit ceiling reached')
    # Persist reservation before POST: an ambiguous network failure must be
    # reconciled against the provider, never blindly resubmitted.
    data['reservedCredits'] += 15
    data['tasks'][name] = {'credits': 15, 'state': 'submitting', 'targetTriangles': triangles}
    save(data)
    result = cli('image-to-3d', 'create', '--image-url', str(ROOT / 'tools/jungle-kit/references' / image),
        '--model-type', 'smart-topology', '--target-polycount', str(triangles),
        '--should-texture', 'true', '--enable-pbr', 'true', '--texture-resolution', '2k',
        '--target-formats', 'glb', '--async')
    (WORK / (name + '-create.json')).write_text(json.dumps(result, indent=2))
    data['tasks'][name].update(id=result['task_id'], state=result['status'])
    data['lastBalance'] = cli('balance')['balance']
    save(data)
    print(name, result['task_id'], 'balance', data['lastBalance'], flush=True)

if __name__ == '__main__':
    for name in sys.argv[1:]:
        create(name)
