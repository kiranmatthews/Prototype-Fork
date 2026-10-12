"""Generate shared hazard parts using the official Meshy CLI's blocking wait.

MESHY_CLI selects the installed official command. Requests and signed responses
remain ignored; stable operation IDs make interrupted submissions resumable.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib, json, os, shlex, subprocess, sys, uuid

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORK = ROOT / '.img2threejs/hazards'
SPECS = {'iron-weight': 3500, 'iron-link': 500}

for name in sys.argv[1:]:
    assert name in SPECS
    folder = WORK / name
    folder.mkdir(parents=True, exist_ok=True)
    ledger = HERE / (name + '-task.json')
    reference = HERE / 'references' / (name + '.png')
    record = json.loads(ledger.read_text()) if ledger.exists() else {
        'provider': 'Meshy', 'model': 'meshy-t2', 'resource': 'image-to-3d',
        'operationId': str(uuid.uuid4()), 'createdAt': datetime.now(timezone.utc).isoformat(),
        'reference': str(reference.relative_to(ROOT)),
        'referenceSha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
        'targetTriangles': SPECS[name], 'state': 'reserved',
    }
    ledger.write_text(json.dumps(record, indent=2) + '\n')
    if record['state'] == 'SUCCEEDED':
        print(name + ': already generated', flush=True)
        continue
    payload = {'image_url': str(reference), 'model_type': 'smart-topology', 'ai_model': 'meshy-t2',
        'target_polycount': SPECS[name], 'should_texture': True, 'enable_pbr': True,
        'texture_resolution': '2k', 'target_formats': ['glb'],
        'texture_prompt': 'Match the reference: charcoal-blue forged iron, subtle brown weathering in seams, rubbed pale silver edges, fine hammered dents. Stylized high quality game prop. Rich albedo, normal and roughness detail. Neutral albedo without baked directional light. Preserve open holes and metal surface regions.'}
    request = folder / 'request.json'
    request.write_text(json.dumps(payload))
    command = shlex.split(os.environ.get('MESHY_CLI', 'meshy')) + ['image-to-3d', 'create',
        '--data', '@' + str(request), '--operation-id', record['operationId'], '--timeout', '1200',
        '-o', str(folder / 'download'), '--output-schema', 'v1', '--no-update-check']
    print(name + ': official Meshy generation started', flush=True)
    with (folder / 'response.json').open('w') as out, (folder / 'stderr.log').open('w') as err:
        result = subprocess.run(command, cwd=ROOT, stdout=out, stderr=err)
    response = json.loads((folder / 'response.json').read_text())
    files = list((folder / 'download').rglob('*.glb')) if (folder / 'download').exists() else []
    record['state'] = 'SUCCEEDED' if response.get('ok') and files else 'inspect-local-response'
    record['exitCode'] = result.returncode
    if files:
        source = folder / (name + '-source.glb')
        source.write_bytes(files[0].read_bytes())
        record.update(sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(), sourceBytes=source.stat().st_size)
    ledger.write_text(json.dumps(record, indent=2) + '\n')
    print(name + ': ' + record['state'], flush=True)
