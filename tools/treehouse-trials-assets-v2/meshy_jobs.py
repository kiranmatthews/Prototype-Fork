#!/usr/bin/env python3
"""Treehouse Trials source production through the official Meshy CLI.

Reservations precede each billable submission. Stable operation IDs protect
against duplicate local submission; never resubmit a recorded unknown outcome.
Credentials and signed responses are owned by the CLI and ignored authoring area.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORK = ROOT / '.img2threejs/treehouse-trials-v2'
LEDGER = HERE / 'tasks.json'
SPECS = json.loads((HERE / 'specs.json').read_text())

def now(): return datetime.now(timezone.utc).isoformat()
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    tmp.replace(path)

def ledger():
    return json.loads(LEDGER.read_text()) if LEDGER.exists() else {
        'schemaVersion': 1, 'provider': 'Meshy', 'cliVersion': '0.3.1',
        'model': 'meshy-t2', 'modelType': 'smart-topology', 'startingBalance': 861,
        'request': 'Reference-extracted V2 modular environment kit matching exact Treehouse Trials silhouettes, painterly palette, surface contacts and soft indirect shading.',
        'estimatedBatchCredits': 360, 'tasks': {},
    }

def cli(*args):
    node = os.environ.get('MESHY_NODE', '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
    entry = os.environ.get('MESHY_CLI', '/private/tmp/treehouse-trials-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
    result = subprocess.run([node, entry, *args, '--output-schema', 'v1', '--no-update-check'],
        cwd=ROOT, text=True, capture_output=True)
    try: body = json.loads(result.stdout)
    except ValueError: raise RuntimeError('Official Meshy CLI returned no JSON; inspect ignored local evidence')
    return body

def require(body):
    if not body.get('ok'):
        error = body.get('error') or {}
        raise RuntimeError('Meshy CLI error: ' + json.dumps({k: error.get(k) for k in ['code','http_status']}))
    return body['result']

def brief(record): return {k:v for k,v in record.items() if k != 'payload'}

def submit(name):
    assert name in SPECS
    WORK.mkdir(parents=True, exist_ok=True)
    with (WORK / 'ledger.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = ledger()
        attempts = []
        if name in data['tasks']:
            previous = data['tasks'][name]
            evidence = json.loads((WORK / name / 'submission.json').read_text())
            # A definitive API validation rejection has no server task and
            # cannot have produced a billed model. Preserve its audit record.
            if (not previous.get('id') and not evidence.get('ok') and
                    (evidence.get('error') or {}).get('http_status') == 400):
                attempts = previous.get('previousAttempts', []) + [brief(previous)]
            else:
                print(json.dumps({'alreadyRecorded': True, **brief(previous)})); return
        image = HERE / 'references' / (name + '.png')
        assert image.is_file(), 'Reference is missing'
        balance = require(cli('balance'))['balance']
        if balance < 15: raise RuntimeError('Insufficient credits')
        payload = {'image_url': str(image), 'model_type': 'smart-topology', 'ai_model': 'meshy-t2',
            'target_polycount': SPECS[name]['triangles'], 'should_texture': True,
            'enable_pbr': True, 'texture_resolution': '2k',
            'texture_prompt': 'Match the input reference colors and painted material regions exactly: dark vivid controlled emerald leaves, ochre warm-grey rock, warm natural weathered timber. Smooth broad brush shading, restrained self-occlusion, no directional cast sun, photorealism, noisy microdetail or grit. Keep broad source marks; do not invent material detail.',
            'target_formats': ['glb']}
        operation = str(uuid.uuid4())
        record = {'resource': 'image-to-3d', 'state': 'submitting', 'operationId': operation,
            'createdAt': now(), 'estimatedCredits': 15, 'balanceBefore': balance,
            'reference': str(image.relative_to(ROOT)), 'referenceSha256': digest(image),
            'targetTriangles': SPECS[name]['triangles'], 'size': SPECS[name]['size'],
            'kind': SPECS[name]['kind'], 'payload': payload}
        if attempts: record['previousAttempts'] = attempts
        data['tasks'][name] = record
        write_json(LEDGER, data)
        write_json(WORK / name / 'request.json', payload)
        body = cli('image-to-3d', 'create', '--data', '@' + str(WORK / name / 'request.json'), '--async', '--operation-id', operation)
        write_json(WORK / name / 'submission.json', body)
        submitted = (body.get('result') or {}).get('submission') or {}
        record['state'] = submitted.get('state', 'unknown')
        if submitted.get('task_id'): record['id'] = submitted['task_id']
        if not body.get('ok'): record['errorCode'] = (body.get('error') or {}).get('code')
        write_json(LEDGER, data)
        print(json.dumps(brief(record)), flush=True)
        if not body.get('ok'): raise RuntimeError('Submission recorded. Reconcile this operation before any further submission.')

def status(name, download=False):
    data = ledger(); record = data['tasks'][name]
    if not record.get('id'): raise RuntimeError('Recorded outcome has no task ID; reconcile operation')
    body = cli('image-to-3d', 'get', record['id'], '--include-raw')
    write_json(WORK / name / 'response.json', body)
    task = require(body)['task']; raw = task.get('raw') or {}
    record.update(state=task.get('status') or raw.get('status'), checkedAt=now())
    for source, target in [('progress','progress'),('consumed_credits','consumedCredits'),('finished_at','finishedAt')]:
        value = raw.get(source, task.get(source))
        if value is not None: record[target] = value
    if raw.get('task_error'): record['providerErrorCode'] = raw['task_error'].get('code')
    if download and record['state'] == 'SUCCEEDED':
        target = WORK / (name + '-source.glb')
        if not target.exists():
            response = cli('download', '--task-json', str(WORK/name/'response.json'),
                '--asset', 'model.glb', '--output-dir', str(WORK/name/'downloads'))
            write_json(WORK/name/'download.json', response); require(response)
            source = WORK/name/'downloads/model.glb'
            if not source.is_file(): raise RuntimeError('Downloaded GLB missing')
            target.write_bytes(source.read_bytes())
        record['sourceSha256'] = digest(target); record['sourceBytes'] = target.stat().st_size
    write_json(LEDGER, data)
    print(json.dumps(brief(record)), flush=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['submit','status','download','balance'])
    parser.add_argument('names', nargs='*')
    args=parser.parse_args()
    if args.command == 'balance':
        body=require(cli('balance')); data=ledger(); data['latestBalance']=body['balance']; data['balanceCheckedAt']=now(); write_json(LEDGER,data)
        print(json.dumps(body)); return
    for name in args.names:
        if name not in SPECS: raise RuntimeError('Unknown asset name: ' + name)
        if args.command == 'submit': submit(name)
        else: status(name, args.command == 'download')

if __name__ == '__main__':
    try: main()
    except (RuntimeError, OSError, KeyError, AssertionError) as exc:
        print(str(exc), file=sys.stderr); sys.exit(1)
