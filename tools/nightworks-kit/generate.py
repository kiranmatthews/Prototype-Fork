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
WORK = ROOT / '.img2threejs/nightworks-kit'
WORK.mkdir(parents=True, exist_ok=True)
NODE = os.environ.get('NIGHTWORKS_NODE', '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
CLI = os.environ.get('NIGHTWORKS_MESHY_CLI', '/tmp/codex-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
LEDGER = ROOT / 'tools/nightworks-kit/tasks.json'
REFERENCES = ROOT / 'tools/nightworks-kit/references'
SPECS = {
    'plateau': ('plateau.png', 2400),
    'stepping-rock': ('stepping-rock.png', 1800),
    'long-island': ('long-island.png', 2400),
    'phase-rock': ('phase-rock.png', 1800),
    'rock-ridge': ('rock-ridge.png', 1800),
    'anchor-rock': ('anchor-rock.png', 1800),
    'distant-arch': ('distant-arch.png', 2200),
}

def cli(*args):
    result = subprocess.run([NODE, CLI, *args], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr[:2000] or result.stdout[:2000])
    return json.loads(result.stdout)

def ledger():
    if not LEDGER.exists(): raise RuntimeError('Nightworks budget ledger is required before submitting')
    return json.loads(LEDGER.read_text())

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
    if data['reservedCredits'] + 15 > data['budget'] or balance < 15:
        raise RuntimeError('Meshy credit ceiling reached')
    # Persist reservation before POST: an ambiguous network failure must be
    # reconciled against the provider, never blindly resubmitted.
    data['reservedCredits'] += 15
    data['tasks'][name] = {'credits': 15, 'state': 'submitting', 'targetTriangles': triangles}
    save(data)
    result = cli('image-to-3d', 'create', '--image-url', str(REFERENCES / image),
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
