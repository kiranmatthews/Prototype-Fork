"""Texture-size the two supplied Meshy bundle exports without altering their meshes."""
from pathlib import Path
import importlib.util,sys
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('prepare_prop',root/'tools/milk-crate/prepare_assets.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
for source,name in zip(sys.argv[1:],['tnt-bundle','nitro-bundle']):
 module.prepare(source,name,(1024,512,512),root/'public/props/explosives')
