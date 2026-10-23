#!/usr/bin/env python3
"""Repeat and independently sanity-check the bounded retail object extraction."""
import hashlib,importlib.util,json,struct,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('props',Path(__file__).with_name('mall-source-props.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
root=Path('/private/tmp/mall-recreation/research/retail')
with tempfile.TemporaryDirectory() as temp:
 result=p.extract(root,Path(temp))
 expected=json.loads((Path(__file__).parents[1]/'src/levels/mall-source-props.json').read_text())
 assert result==expected
 assert [b['node'] for b in result['placements']]==[511,512,513,514,515,516,518,519,520,521,522,523]
 assert result['model']['nativeBounds']==[26,-24,49,-51,75,-75]
 assert len(result['model']['faces'])==6 and len(result['model']['vertices'])==24
 raw=(root/'SKMALL_T.TRG').read_bytes()
 for box in result['placements']:
  start=struct.unpack_from('<I',raw,12+box['node']*4)[0]
  position=(start+15)&~3
  assert list(struct.unpack_from('<3i',raw,position))==box['position']
  assert list(struct.unpack_from('<3h',raw,position+12))==box['angles']
 for texture in result['textures']:
  assert hashlib.sha256((Path(temp)/texture['file']).read_bytes()).hexdigest()==texture['sha256']
 bad=bytearray(raw);start=struct.unpack_from('<I',bad,12+511*4)[0];position=(start+15)&~3;bad[position+26]^=1
 for data in [raw[:10],raw[:4000],raw[:struct.unpack_from('<I',raw,12+524*4)[0]-1],bytes(bad)]:
  try:p.placements(data)
  except (ValueError,struct.error):pass
  else:raise AssertionError('Malformed source input accepted')
print(json.dumps({'deterministicExtraction':True,'directPlacementChecks':12,'nativeBounds':[26,-24,49,-51,75,-75],'faces':6,'textures':2,'malformedInputsRejected':4}))
