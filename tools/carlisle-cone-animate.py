#!/usr/bin/env python3
"""Retry/refine individual cone clips through the existing blocking CLI adapter.
No API client, polling, authentication, or download implementation lives here.
"""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tripo_character', ROOT / 'tools/tripo-character/tripo_character.py')
tripo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tripo)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('clip', choices=['rig-v1', 'idle', 'walk', 'jump', 'slash'])
parser.add_argument('--restore', action='store_true', help='Download an existing completed task without generating or spending credits')
args = parser.parse_args()
work = ROOT / 'tools/tripo-character/work/carlisle-cone-biped'
workflow = {} if args.restore else json.loads((work / 'workflow-manifest.json').read_text())
output = work / 'legacy-clips' / args.clip
rig = {} if args.restore else (json.loads((work / 'legacy-clips/rig-v1/result.json').read_text()) if args.clip != 'rig-v1' else workflow['stages']['generate'])
record = output / 'result.json'
if record.exists() and not args.restore:
    raise SystemExit('A result already exists: inspect/recover it instead of submitting twice.')
output.mkdir(parents=True, exist_ok=True)
command = ['anim', 'retarget', rig.get('task_id', ''), '--animation', 'preset:biped:' + ('angry_01' if args.clip == 'slash' else args.clip),
           '--out-format', 'glb', '--out', str(output), '--name', 'cone-' + args.clip,
           '--json', '--yes', '--no-open', '--timeout', '1800']
if args.clip == 'rig-v1':
    command = ['anim', 'rig', rig.get('task_id', ''), '--rig-type', 'biped', '--spec', 'mixamo',
               '--param', 'model=v1.0-20240301', '--out-format', 'glb', '--out', str(output),
               '--name', 'cone-rig-v1', '--json', '--yes', '--no-open', '--timeout', '1800']
if args.restore:
    asset = json.loads((ROOT / 'public/props/carlisle-cone/asset.json').read_text())
    task = asset['rigTask'] if args.clip == 'rig-v1' else next(c['task'] for c in asset['clips'] if c['name'] == args.clip)
    command = ['task', 'watch', task, '--download', '--out', str(output), '--json', '--yes', '--no-open']
# Record intent before any paid submission. An interrupted operation must be
# recovered with the official CLI, never blindly replayed.
record.write_text(json.dumps({'status':'submitting', 'command':command}, indent=2)+'\n')
result = tripo.run_tripo(command, label='cone-' + args.clip)
tripo.write_json(record, result)
print(json.dumps({'clip':args.clip, 'task_id':result.get('task_id'),
                  'credits':result.get('credits_consumed'), 'files':[str(p) for p in tripo.files_in_result(result)]}))
