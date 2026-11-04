import copy
import gzip
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from effects_scope import effects_only, prune_pack, prune_source_cache
from pack_assets import pack_catalogue, sha
from test_pack_assets import fixture


def source_fixture(root):
    models = []
    for id, name, raw in [('actor', 'actor-lod0', fixture()), ('rig', 'hud-rig', fixture()),
                          ('scenery', 'scenery-background', fixture(unindexed=True))]:
        file = root / 'levels' / (name + '.glb');file.parent.mkdir(exist_ok=True);file.write_bytes(raw)
        models.append({'id': id, 'name': name, 'background': id == 'scenery', 'path': str(file.relative_to(root)),
                       'bytes': len(raw), 'sha256': sha(raw)})
    textures = []
    for id in ['effects/hotdot', 'Hud/spare', 'village/wall']:
        file = root / 'textures' / (id + '.png');file.parent.mkdir(parents=True, exist_ok=True)
        raw = ('texture:' + id).encode();file.write_bytes(raw)
        textures.append({'id': id, 'path': str(file.relative_to(root)), 'bytes': len(raw), 'sha256': sha(raw)})
    decoded = b'{"fixture":true}';data = gzip.compress(decoded, mtime=0);relative = 'death/' + sha(data) + '.json.gz'
    file = root / relative;file.parent.mkdir(exist_ok=True);file.write_bytes(data)
    reference = {'model': 'actor', 'path': relative, 'bytes': len(data), 'sha256': sha(data),
                 'decodedBytes': len(decoded), 'decodedSha256': sha(decoded), 'events': [{'clip': 'death'}]}
    return {'coverage': {}, 'models': models, 'textures': textures,
            'particles': [{'id': 1, 'fields': [{'field': 'texture', 'value': 'effects/hotdot'}]}],
            'meshDeaths': {'texture': 'effects/hotdot', 'models': [reference]},
            'fuelCellHud': {'model': 'hud-rig'}}


class EffectsScopeTests(unittest.TestCase):
    def test_only_real_effect_dependencies_survive_and_input_is_immutable(self):
        with tempfile.TemporaryDirectory() as directory:
            source = source_fixture(Path(directory));before = copy.deepcopy(source)
            scoped = effects_only(source)
            self.assertEqual(source, before)
            self.assertEqual({m['id'] for m in scoped['models']}, {'actor', 'rig'})
            self.assertEqual({t['id'] for t in scoped['textures']}, {'effects/hotdot', 'Hud/spare'})
            self.assertEqual(effects_only(scoped), scoped)
            source['meshDeaths']['models'][0]['model'] = 'scenery'
            with self.assertRaisesRegex(ValueError, 'background'):
                effects_only(source)

    def test_verified_subset_retains_glb_images_and_removes_unused_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);source = source_fixture(root);raw = root / 'catalogue.json';output = root / 'packed'
            raw.write_text(json.dumps(source))
            with redirect_stdout(io.StringIO()):
                pack_catalogue(raw, root, output)
            original = json.loads((output / 'catalogue.json').read_text())
            scoped = effects_only(source);report = prune_pack(scoped, output)
            packed = json.loads((output / 'catalogue.json').read_text())
            self.assertGreater(len(report['removed']), 0)
            self.assertEqual({m['id'] for m in packed['models']}, {'actor', 'rig'})
            self.assertTrue(all((output / 'assets' / a['path']).is_file() for a in packed['assets']))
            self.assertTrue(all(not (output / 'assets' / a['path']).exists() for a in report['removed']))
            old = {a['path']: a for a in original['assets']}
            self.assertTrue(all(a == old[a['path']] for a in packed['assets']))
            # The model's embedded source image is not a particle texture entry.
            self.assertGreater(sum(a['path'].startswith('images/') for a in packed['assets']), len(packed['textures']))
            extra = root / 'levels' / 'actor-lod1.glb';extra.write_bytes(fixture())
            note = root / 'levels' / 'notes.txt';note.write_text('keep')
            removed = prune_source_cache(scoped, root)
            self.assertEqual(removed['removedFiles'], 3)
            self.assertTrue(all((root / m['path']).is_file() for m in scoped['models']))
            self.assertEqual(note.read_text(), 'keep')

    def test_changed_pack_is_rejected_before_any_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);source = source_fixture(root);raw = root / 'catalogue.json';output = root / 'packed'
            raw.write_text(json.dumps(source))
            with redirect_stdout(io.StringIO()):
                pack_catalogue(raw, root, output)
            previous = (output / 'catalogue.json').read_bytes();pack = json.loads(previous)
            file = output / 'assets' / pack['assets'][0]['path'];file.write_bytes(b'changed')
            before = {str(f): f.read_bytes() for f in (output / 'assets').rglob('*') if f.is_file()}
            with self.assertRaisesRegex(ValueError, 'Packed asset changed'):
                prune_pack(effects_only(source), output)
            self.assertEqual((output / 'catalogue.json').read_bytes(), previous)
            self.assertEqual(before, {str(f): f.read_bytes() for f in (output / 'assets').rglob('*') if f.is_file()})

    def test_real_game_packing_cannot_reintroduce_static_models(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);source = source_fixture(root);source['game'] = 'Jak and Daxter: The Precursor Legacy'
            raw = root / 'catalogue.json';raw.write_text(json.dumps(source));output = root / 'packed'
            with redirect_stdout(io.StringIO()):
                pack_catalogue(raw, root, output)
            packed = json.loads((output / 'catalogue.json').read_text())
            self.assertEqual({m['id'] for m in packed['models']}, {'actor', 'rig'})
            self.assertEqual(packed['effectsScope']['standaloneModels'], 0)

    def test_missing_dependency_evidence_is_not_silently_discarded(self):
        with self.assertRaisesRegex(ValueError, 'Attach source'):
            effects_only({'models': [], 'textures': []})


if __name__ == '__main__':
    unittest.main()
