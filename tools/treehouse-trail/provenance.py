"""Record public-safe source hashes, Meshy settings, fitting and asset budgets."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/treehouse-trail'
WORK = ROOT / '.img2threejs/treehouse-trail'
names = ['body', 'balcony', 'stairs', 'landing', 'tree', 'bush']
models = []
for name in names:
    path = OUT / (name + '-manifest.json')
    if not path.exists():
        continue
    model = json.loads(path.read_text())
    model['path'] = name + '.glb'
    model['referenceSha256'] = hashlib.sha256((ROOT / 'tools/treehouse-trail' / (name + '-reference.png')).read_bytes()).hexdigest()
    models.append(model)
ledger = json.loads((ROOT / 'tools/treehouse-trail/tasks.json').read_text())
# The official account balance read was 1826 before any task and 1721 after
# all seven submissions: 90 for the six retained modules plus 15 for the
# superseded first study. No unrelated task ran against this account here.
balance = json.loads((WORK / 'final-balance.json').read_text())['balance']
assert balance == 1721, 'Reconcile the recorded billing audit before publishing'
provenance = {
    'provider': 'Meshy', 'model': 'meshy-t2', 'modelType': 'smart-topology',
    'textureGeneratedResolution': '2k',
    'request': 'Separate reusable treehouse body, balcony, stair flight, landing, large tree and dense bush in the supplied jungle artwork style.',
    'referenceGenerator': 'Built-in image_gen',
    'referencePrompts': ['tools/treehouse-trail/prompts.json', 'tools/treehouse-trail/foliage-prompts.json'],
    'tasks': ledger['tasks'],
    'credits': {'publishedModules': 90, 'supersededMonolithicStudy': 15, 'total': 105, 'evidence': 'Official Meshy CLI balance difference across the seven recorded task submissions.'},
    'reusedMeshyFoliage': {'registry': 'src/jungleModules.ts and src/jungleAssets.ts', 'provenance': 'tools/jungle-kit/tasks.json', 'kinds': ['junglecanopy', 'junglepalmtree', 'jungleleaf', 'junglefern', 'carvedlog']},
    'moduleNotes': {
        'body': 'Front +Z; no attached balcony, tree or stairs.',
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
