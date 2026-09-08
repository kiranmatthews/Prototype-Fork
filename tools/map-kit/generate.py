"""Map-scoped budget/asset adapter over the existing Meshy CLI workflow."""
import importlib.util
import json
from pathlib import Path
import runpy
import sys

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('generate',ROOT/'tools/jungle-kit/generate.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.WORK=ROOT/'.img2threejs/map-kit';engine.WORK.mkdir(parents=True,exist_ok=True)
engine.LEDGER=ROOT/'tools/map-kit/tasks.json'
engine.REFERENCES=ROOT/'tools/map-kit/references'
brief=json.loads((ROOT/'tools/map-kit/brief.json').read_text())
engine.SPECS={a['name']:(a['name']+'.png',a['triangles']) for a in brief['assets']}
clay_brief=ROOT/'tools/map-kit/clay-brief.json'
if clay_brief.exists():
    engine.SPECS.update({a['name']:(a['name']+'.png',a['triangles']) for a in json.loads(clay_brief.read_text())['assets']})
if not engine.LEDGER.exists():
    engine.save({'budget':brief['budgetCredits'],'startingBalance':brief['startingBalance'],'reservedCredits':0,'tasks':{}})
if sys.argv[1]=='fetch':
    sys.modules['generate']=engine
    sys.argv=[str(ROOT/'tools/jungle-kit/fetch.py'),*sys.argv[2:]]
    runpy.run_path(str(ROOT/'tools/jungle-kit/fetch.py'),run_name='__main__')
else:
    for name in sys.argv[1:]:engine.create(name)
