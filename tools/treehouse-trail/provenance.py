"""Record public-safe source hashes, Meshy settings, fitting and asset budgets."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/treehouse-trail'
WORK = ROOT / '.img2threejs/treehouse-trail'
names = ['body', 'body-v2', 'balcony', 'balcony-deck', 'stairs', 'landing', 'tree', 'canopy', 'host', 'bush']
models = []
for name in names:
    path = OUT / (name + '-manifest.json')
    if not path.exists():
        continue
    model = json.loads(path.read_text())
    model['path'] = name + '.glb'
    reference = {'body-v2': 'body', 'balcony-deck': 'balcony', 'canopy': 'tree'}.get(name, name)
    model['referenceSha256'] = hashlib.sha256((ROOT / 'tools/treehouse-trail' / (reference + '-reference.png')).read_bytes()).hexdigest()
    models.append(model)
ledger = json.loads((ROOT / 'tools/treehouse-trail/tasks.json').read_text())
# Preserve the earlier seven-task audit and the two-task refinement audit.
before = json.loads((WORK / 'final-balance.json').read_text())['balance']
balance = json.loads((WORK / 'refinement-balance.json').read_text())['balance']
assert before == 1721 and balance == 1691, 'Reconcile the recorded billing audits before publishing'
provenance = {
    'provider': 'Meshy', 'model': 'meshy-t2', 'modelType': 'smart-topology',
    'textureGeneratedResolution': '2k',
    'request': 'Separate reusable treehouse body, balcony, stair flight, landing, large tree and dense bush in the supplied jungle artwork style.',
    'referenceGenerator': 'Built-in image_gen',
    'referencePrompts': ['tools/treehouse-trail/prompts.json', 'tools/treehouse-trail/foliage-prompts.json', 'tools/treehouse-trail/refinement-prompts.json'],
    'tasks': ledger['tasks'],
    'credits': {'originalModules': 90, 'refinedHostAndCabin': before-balance, 'supersededMonolithicStudy': 15, 'total': 135, 'evidence': 'Official Meshy CLI balance audits: 1826 to 1721 for the original seven tasks; 1721 to 1691 for the host/cabin refinement.'},
    'openingModules': ['body-v2', 'host', 'balcony-deck', 'canopy', 'stairs', 'landing', 'tree', 'bush'],
    'reusedMeshyFoliage': {'registry': 'src/jungleModules.ts and src/jungleAssets.ts', 'provenance': 'tools/jungle-kit/tasks.json', 'kinds': ['junglecanopy', 'junglepalmtree', 'jungleleaf', 'junglefern', 'carvedlog']},
    'moduleNotes': {
        'body': 'Front +Z; no attached balcony, tree or stairs.',
        'body-v2': 'More detailed 8K-target Meshy cabin, kept near its source proportions; 2K color and 1K normal atlas.',
        'host': 'Independent rooted load-bearing fork, with broad boughs physically beneath the deck.',
        'balcony-deck': 'Actual Meshy balcony deck extracted from the original module; separate source-authored ropes leave a correct stair entry.',
        'canopy': 'Upper crown extracted from the Meshy tree to keep foliage outside the cabin and its support junction.',
        'balcony': 'Open long edge -Z; deck contact plane normalized Y=1/6; total height1.5m gives deck top0.25m above bottom.',
        'stairs': 'Seven actual Meshy treads, open risers, no handrails; rise +Z to -Z; fitted normalized tread levels1/7 through1.',
        'landing': 'Flat top normalized Y=1; no rails or supports extending below module bounds.',
        'tree': 'Independent ancient tree; branches and foliage as solid geometry; bottom-anchored, canopy-only wind.',
        'bush': 'Independent dense foliage clump with thick leaf forms; bottom-anchored with wind.'
    },
    'models': models,
}
(OUT / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
print('models', len(models), 'bytes', sum(m['bytes'] for m in models), 'near triangles', sum(m['triangles'] for m in models), 'far triangles', sum(m['lodTriangles'] for m in models), 'credits', provenance['credits']['total'])
