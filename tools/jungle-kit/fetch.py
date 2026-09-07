"""Wait on recorded Meshy handles with the official CLI, download GLBs."""
import json
from pathlib import Path
import sys
import urllib.request
from generate import cli, ledger, save, WORK

for name in sys.argv[1:]:
    task = ledger()['tasks'][name]
    result = cli('image-to-3d', 'wait', task['id'], '--timeout', '600')
    # The CLI's wait wrapper returns the task under data in some releases.
    if 'model_urls' not in result:
        result = cli('image-to-3d', 'get', task['id'])
    (WORK / (name + '-result.json')).write_text(json.dumps(result, indent=2))
    data = ledger(); data['tasks'][name]['state'] = result.get('status'); save(data)
    if result.get('status') != 'SUCCEEDED':
        print(name, result.get('status'), flush=True)
        continue
    for field, suffix in [('model_urls', '.glb'), ('thumbnail_url', '-preview.png')]:
        url = result[field]['glb'] if field == 'model_urls' else result.get(field)
        if url:
            urllib.request.urlretrieve(url, WORK / (name + suffix))
    print(name, 'downloaded', (WORK / (name + '.glb')).stat().st_size, 'bytes', flush=True)
