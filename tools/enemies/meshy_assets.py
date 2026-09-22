#!/usr/bin/env python3
"""Enemy asset production through the official Meshy CLI, never frontend auth.

One POST per named job. Task IDs and reference hashes are tracked; signed API
responses and large authoring outputs remain in ignored .img2threejs/enemies.
The official CLI owns authentication, transport, submission journaling and waits.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORK = ROOT / '.img2threejs/enemies'
LEDGER = HERE / 'tasks.json'


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, indent=2) + '\n')
    temporary.replace(path)


def ledger():
    return json.loads(LEDGER.read_text()) if LEDGER.exists() else {
        'schemaVersion': 1, 'provider': 'Meshy', 'cliVersion': '0.3.1',
        'budgetCredits': 250, 'startingBalance': 1691, 'tasks': {},
    }


@contextmanager
def locked():
    WORK.mkdir(parents=True, exist_ok=True)
    with (WORK / 'ledger.lock').open('w') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield


def cli_command():
    node = os.environ.get('ENEMY_NODE') or shutil.which('node') or str(
        Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
    candidates = [os.environ.get('ENEMY_MESHY_CLI', ''),
        '/tmp/codex-enemy-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js',
        '/tmp/codex-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js']
    target = next((p for p in candidates if p and Path(p).is_file()), None)
    if target:
        return [node, target]
    installed = shutil.which('meshy') or shutil.which('meshy-cli')
    if installed:
        return [installed]
    raise RuntimeError('Install official @meshy-ai/cli@0.3.1 or set ENEMY_MESHY_CLI')


def cli(*args):
    result = subprocess.run([*cli_command(), *args, '--output-schema', 'v1',
        '--no-update-check'], cwd=ROOT, text=True, capture_output=True)
    try:
        body = json.loads(result.stdout)
    except ValueError:
        # Avoid exposing raw output, which can contain signed URLs or media data.
        raise RuntimeError('Official Meshy CLI did not return JSON; inspect local installation')
    return body


def safe_error(body):
    error = body.get('error') or {}
    return {'code': error.get('code'), 'httpStatus': error.get('http_status')}


def require_success(body):
    if not body.get('ok'):
        raise RuntimeError('Meshy CLI error: ' + json.dumps(safe_error(body)))
    return body['result']


def checked_name(value):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', value):
        raise argparse.ArgumentTypeError('Use a lowercase alphanumeric job name with hyphens')
    return value


def brief_record(record):
    return {k: v for k, v in record.items() if k not in ('payload',)}


def submit(name, resource, payload, estimated_credits, dry_run=False, retry_rejected=False):
    if dry_run:
        print(json.dumps({'name': name, 'resource': resource,
            'estimatedCredits': estimated_credits, 'payload': payload}, indent=2))
        return
    with locked():
        data = ledger()
        attempts = []
        if name in data['tasks']:
            previous = data['tasks'][name]
            if not retry_rejected:
                print(json.dumps({'alreadyRecorded': True, **brief_record(previous)}))
                return
            evidence_path = WORK / name / 'submission.json'
            evidence = json.loads(evidence_path.read_text())
            submission = (evidence.get('result') or {}).get('submission') or {}
            if (previous.get('id') or previous.get('state') not in ('rejected', 'not_submitted') or
                    submission.get('state') not in ('rejected', 'not_submitted') or submission.get('task_id')):
                raise RuntimeError('Only a proven rejected/not-submitted operation may be retried; reconcile unknown outcomes')
            attempts = previous.get('previousAttempts', []) + [{k: v for k, v in previous.items()
                if k not in ('payload', 'previousAttempts')}]
            del data['tasks'][name]
        reserved = sum(t.get('estimatedCredits', 0) for t in data['tasks'].values())
        if reserved + estimated_credits > data['budgetCredits']:
            raise RuntimeError('Enemy asset budget would be exceeded')
        balance = require_success(cli('balance'))['balance']
        if balance < estimated_credits:
            raise RuntimeError('Insufficient Meshy credits')
        operation = str(uuid.uuid4())
        record = {'resource': resource, 'state': 'submitting', 'operationId': operation,
            'createdAt': now(), 'estimatedCredits': estimated_credits, 'payload': payload,
            'balanceBefore': balance}
        if attempts:
            record['previousAttempts'] = attempts
        image = payload.get('image_url')
        if image and Path(image).is_file():
            record['reference'] = str(Path(image).relative_to(ROOT))
            record['referenceSha256'] = digest(Path(image))
        data['tasks'][name] = record
        write_json(LEDGER, data)  # reservation precedes the billable request
        job = WORK / name
        write_json(job / 'request.json', payload)
        body = cli(resource, 'create', '--data', '@' + str(job / 'request.json'),
            '--async', '--operation-id', operation)
        write_json(job / 'submission.json', body)
        submission = (body.get('result') or {}).get('submission') or {}
        record['state'] = submission.get('state', 'unknown')
        if submission.get('task_id'):
            record['id'] = submission['task_id']
        if not body.get('ok'):
            record['error'] = safe_error(body)
        write_json(LEDGER, data)
        print(json.dumps(brief_record(record)))
        if not body.get('ok'):
            raise RuntimeError('Submission is recorded; reconcile this job instead of creating another')


def create(args):
    if not 100 <= args.triangles <= 15000:
        raise RuntimeError('Smart Topology requires 100–15000 triangles')
    image = Path(args.image).resolve() if args.image else HERE / 'references' / (args.name + '.png')
    if not image.is_file():
        raise RuntimeError('Reference image does not exist: ' + str(image))
    payload = {'image_url': str(image), 'model_type': 'smart-topology', 'ai_model': 'meshy-t2',
        'target_polycount': args.triangles, 'should_texture': True, 'enable_pbr': True,
        'texture_resolution': '2k', 'target_formats': ['glb']}
    submit(args.name, 'image-to-3d', payload, 15, args.dry_run)


def status(name, wait_seconds=None):
    with locked():
        data = ledger()
        record = data['tasks'][name]
        if not record.get('id'):
            raise RuntimeError('Job has no task ID: reconcile the recorded operation; never blindly resubmit')
        args = [record['resource'], 'wait' if wait_seconds else 'get', record['id'], '--include-raw']
        if wait_seconds:
            args += ['--timeout', str(wait_seconds)]
        body = cli(*args)
        write_json(WORK / name / 'response.json', body)
        result = body.get('result') or {}
        task = result.get('task') or {}
        raw = task.get('raw') or {}
        if not body.get('ok') and not task.get('status'):
            require_success(body)
        record.update(state=task.get('status') or raw.get('status') or record['state'], checkedAt=now())
        for source, destination in [('progress', 'progress'), ('consumed_credits', 'consumedCredits'),
                ('finished_at', 'finishedAt'), ('expires_at', 'expiresAt')]:
            value = raw.get(source, task.get(source))
            if value is not None:
                record[destination] = value
        if raw.get('task_error'):
            # Detailed provider error stays in ignored response.json; messages
            # may repeat signed input URLs, so only track the error code.
            record['providerErrorCode'] = raw['task_error'].get('code')
        write_json(LEDGER, data)
        print(json.dumps(brief_record(record)))
        return record, body


def download(args):
    record, body = status(args.name)
    if record['state'] != 'SUCCEEDED':
        raise RuntimeError('Downloads require a successful task; current state ' + record['state'])
    assets = args.asset or (['model.glb'] if record['resource'] == 'image-to-3d' else
        ['result.rigged_character_glb_url', 'result.basic_animations.walking_glb_url']
        if record['resource'] == 'rigging' else ['result.animation_glb_url'])
    output = WORK / args.name / 'downloads'
    command = ['download', '--task-json', str(WORK / args.name / 'response.json'),
        '--output-dir', str(output)]
    for key in assets:
        command += ['--asset', key]
    result = cli(*command)
    write_json(WORK / args.name / 'download-response.json', result)
    require_success(result)
    if record['resource'] == 'image-to-3d' and (output / 'model.glb').is_file():
        shutil.copy2(output / 'model.glb', WORK / (args.name + '.glb'))
    files = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': digest(p)}
        for p in sorted(output.rglob('*')) if p.is_file() and p.suffix != '.json']
    with locked():
        data = ledger()
        data['tasks'][args.name]['downloads'] = files
        write_json(LEDGER, data)
    print(json.dumps({'name': args.name, 'downloads': files}))


def rig(args):
    source = ledger()['tasks'][args.source]
    if source.get('state') != 'SUCCEEDED':
        raise RuntimeError('Refresh source status and wait for SUCCEEDED before rigging')
    submit(args.name, 'rigging', {'input_task_id': source['id'], 'height_meters': args.height}, 5, args.dry_run)


def animate(args):
    source = ledger()['tasks'][args.source]
    if source.get('state') != 'SUCCEEDED' or source.get('resource') != 'rigging':
        raise RuntimeError('Animation needs a successfully completed rigging job')
    submit(args.name, 'animate', {'rig_task_id': source['id'], 'action_id': args.action}, 3, args.dry_run)


def retry(args):
    record = ledger()['tasks'][args.name]
    submit(args.name, record['resource'], record['payload'], record['estimatedCredits'], retry_rejected=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('create'); p.add_argument('name', type=checked_name)
    p.add_argument('--image'); p.add_argument('--triangles', type=int, default=7500)
    p.add_argument('--dry-run', action='store_true')
    for verb in ('status', 'wait', 'download', 'retry'):
        p = sub.add_parser(verb); p.add_argument('name', type=checked_name)
        if verb == 'wait': p.add_argument('--seconds', type=int, default=50, choices=range(1, 61))
        if verb == 'download': p.add_argument('--asset', action='append')
    p = sub.add_parser('rig', help='Documented humanoid rig API; not a quadruped workaround')
    p.add_argument('name', type=checked_name); p.add_argument('--source', required=True)
    p.add_argument('--height', type=float, default=1.5); p.add_argument('--dry-run', action='store_true')
    p = sub.add_parser('animate'); p.add_argument('name', type=checked_name)
    p.add_argument('--source', required=True); p.add_argument('--action', type=int, required=True)
    p.add_argument('--dry-run', action='store_true')
    sub.add_parser('jobs'); sub.add_parser('balance'); sub.add_parser('doctor')
    args = parser.parse_args()
    if args.command == 'create': create(args)
    elif args.command == 'status': status(args.name)
    elif args.command == 'wait': status(args.name, args.seconds)
    elif args.command == 'download': download(args)
    elif args.command == 'rig': rig(args)
    elif args.command == 'animate': animate(args)
    elif args.command == 'retry': retry(args)
    elif args.command == 'jobs': print(json.dumps({k: brief_record(v) for k,v in ledger()['tasks'].items()}, indent=2))
    elif args.command == 'balance': print(json.dumps(require_success(cli('balance'))))
    elif args.command == 'doctor': print(json.dumps(require_success(cli('doctor')), indent=2))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, KeyError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
