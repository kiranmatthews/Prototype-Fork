"""Query recorded tasks once each, downloading finished sources with Meshy CLI."""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/treehouse-trail'
WORK.mkdir(parents=True, exist_ok=True)
NODE = os.environ.get('MESHY_NODE', '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
CLI = os.environ.get('MESHY_CLI', '/tmp/carlisle-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
LEDGER = ROOT / 'tools/treehouse-trail/tasks.json'
data = json.loads(LEDGER.read_text())
for name, task in data['tasks'].items():
    if not task.get('id'):
        continue
    result = subprocess.run([NODE, CLI, 'image-to-3d', 'get', task['id']], cwd=ROOT, capture_output=True, text=True, check=True)
    state = json.loads(result.stdout)
    (WORK / (name + '-result.json')).write_text(result.stdout)
    task['state'] = state['status']
    task['progress'] = state.get('progress')
    if state.get('consumed_credits') is not None:
        task['credits'] = state['consumed_credits']
    print(name, task['state'], task['progress'], flush=True)
    target = WORK / (name + '-source.glb')
    if state['status'] == 'SUCCEEDED' and not target.exists():
        downloaded = subprocess.run([NODE, CLI, 'download', '--task-json', str(WORK / (name + '-result.json')), '--model-format', 'glb', '--output', str(target)], cwd=ROOT, capture_output=True, text=True, check=True)
        (WORK / (name + '-download.json')).write_text(downloaded.stdout)
        print(name, 'downloaded', target.stat().st_size, 'bytes', flush=True)
LEDGER.write_text(json.dumps(data, indent=2) + '\n')
