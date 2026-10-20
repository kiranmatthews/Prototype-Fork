"""Validate the interchange against the official Sketch schema directory.

Usage: python3 tools/validate-level-atlas-sketch.py /path/to/schema/dist
Requires jsonschema. Discriminated layer unions avoid exponential validation
of deeply nested groups while preserving every constraint in the schema.
"""
from pathlib import Path
import hashlib,json,sys,zipfile
import jsonschema
from jsonschema import validators
from jsonschema._keywords import oneOf

root=Path(__file__).resolve().parent.parent
schema_dir=Path(sys.argv[1])
archive=zipfile.ZipFile(root/'public/provenance/level-atlas/Level Atlas.sketch')
page_schema=json.loads((schema_dir/'page.schema.json').read_text())
definitions=page_schema['definitions']
def dispatch(validator,branches,instance,schema):
 if isinstance(instance,dict) and '_class' in instance and all('$ref' in b and b['$ref'].startswith('#/definitions/') for b in branches):
  tags=[]
  for branch in branches:
   tag=definitions.get(branch['$ref'].rsplit('/',1)[1],{}).get('properties',{}).get('_class',{})
   tags.append(tag.get('const',tag.get('enum',[None])[0]))
  if None not in tags and len(set(tags))==len(tags) and instance['_class'] in tags:
   index=tags.index(instance['_class']);yield from validator.descend(instance,branches[index],schema_path=index);return
 yield from oneOf(validator,branches,instance,schema)
Validator=validators.extend(jsonschema.Draft7Validator,{'oneOf':dispatch})
for name in ['document','meta','user']:
 obj=json.loads(archive.read(name+'.json'));schema=json.loads((schema_dir/(name+'.schema.json')).read_text())
 jsonschema.Draft7Validator(schema).validate(obj);print(name,'PASS',flush=True)
count=0;ids=set();bitmaps=set();artboards=[]
inventory=json.loads((root/'public/provenance/level-atlas/inventory.json').read_text())
def inspect(node):
 global count
 count+=1
 assert node['do_objectID'] not in ids,'Duplicate layer identity';ids.add(node['do_objectID'])
 if node['_class']=='bitmap':bitmaps.add(node['image']['_ref'])
 if node.get('hasClippingMask'):assert not node['style']['fills'],'Outline masks must not paint over scenery in Figma'
 if node['_class']=='artboard':artboards.append(node)
 for child in node.get('layers',[]):inspect(child)
for name in archive.namelist():
 if not name.startswith('pages/'):continue
 page=json.loads(archive.read(name))
 errors=Validator(page_schema).iter_errors(page)
 error=next(errors,None)
 if error:
  print('SCHEMA FAILURE',list(error.absolute_path),error.validator,error.message[:800],flush=True);raise SystemExit(1)
 inspect(page);print(page['name'],'PASS',flush=True)
assert len([name for name in archive.namelist() if name.startswith('pages/')])==3
for bitmap in bitmaps:
 data=archive.read(bitmap)
 assert data.startswith(b'\x89PNG\r\n\x1a\n')
 assert bitmap=='images/'+hashlib.sha1(data).hexdigest()+'.png','Figma requires SHA-1 PNG resource identifiers'
assert len(artboards)==len(inventory['levels'])==26
for board,row in zip(artboards,inventory['levels']):
 assert board['name'].startswith(f"{row['order']:02d} · {row['name']}")
 found={};cutouts={}
 def anchors(node,tx=0,ty=0):
  f=node['frame'];x=tx+f['x'];y=ty+f['y']
  if node['name'].startswith('REF-'):
   stroke=node['layers'][0];sf=stroke['frame'];ps=[]
   for p in stroke['points']:
    px,py=[float(v) for v in p['point'].strip('{}').split(',')];ps.append((x+sf['x']+px*sf['width'],y+sf['y']+py*sf['height']))
   found[node['name'][4]]=tuple(sum(p[i] for p in ps)/len(ps) for i in [0,1])
  if ' | PNG centre ' in node['name']:
   assert len(node['layers'])==1 and node['layers'][0]['_class']=='bitmap','Cutout must be only its image, without a card or leader'
   assert not node['style']['fills'] and not node['style']['borders']
   cutouts[node['name'].split(' |')[0]]=(x+f['width']/2,y+f['height']/2)
  for c in node.get('layers',[]):anchors(c,x,y)
 for child in board['layers']:anchors(child)
 for ref in row['projection']['anchors']:
  assert all(abs(a-b)<1e-7 for a,b in zip(found[ref['id']],ref['svg'])),f"Sketch coordinate drift in {row['name']}"
 manifest=json.loads((root/'public/provenance/level-atlas'/row['manifest']).read_text())
 assert len(cutouts)==len(manifest['cutouts'])
 for cutout in manifest['cutouts']:
  assert all(abs(a-b)<1e-6 for a,b in zip(cutouts[cutout['id']],cutout['svgCenter'])),f"PNG centre drift in {row['name']}"
print(f'Official schema validation passed: {count} unique layers; {len(bitmaps)} embedded PNGs resolve.',flush=True)
archive_hash=hashlib.sha256(Path(archive.filename).read_bytes()).hexdigest()
receipt=json.loads((root/'public/provenance/level-atlas/figma.json').read_text())
cloud_status='Verified in Figma' if receipt.get('status')=='complete' and receipt.get('sketchSha256')==archive_hash else 'Not verified for this archive; import and inspect in Figma.'
report={'levels':26,'pages':3,'layers':count,'embeddedImages':len(bitmaps),'schema':'@sketch-hq/sketch-file-format 6.5.0','schemaPass':True,'nativeAnchorRegistrationPass':True,'nativeCutoutCentersPass':True,'sketchSha256':archive_hash,'figmaImageResourcePass':True,'transparentOutlineMasksPass':True,'figmaCloudImport':cloud_status}
(root/'public/provenance/level-atlas/validation.json').write_text(json.dumps(report,indent=2))
