"""Export only the fitted near mesh, retaining its existing geometry and UVs."""
from pathlib import Path
import sys,json,copy,hashlib
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'));from glb_rig import Glb
name=sys.argv[1];spec=json.loads((HERE/'assets.json').read_text())[name]
source=ROOT/spec['retextureSource'];target=ROOT/spec['retextureInput'];target.parent.mkdir(parents=True,exist_ok=True)
g=Glb(source);d=g.document
nodes=[n for n in d['nodes'] if 'mesh' in n and n.get('name','').endswith('LOD0')]
assert len(nodes)==1, 'One fitted near mesh is required'
node=copy.deepcopy(nodes[0]);mesh=copy.deepcopy(d['meshes'][node['mesh']]);node['mesh']=0
assert not node.get('children') and 'skin' not in node
original=[]
for p in mesh['primitives']:
 original.append({'positions':hashlib.sha256(g.read_accessor(p['attributes']['POSITION']).tobytes()).hexdigest(),'uvs':hashlib.sha256(g.read_accessor(p['attributes']['TEXCOORD_0']).tobytes()).hexdigest(),'triangles':len(g.read_accessor(p['indices']))//3})
d['nodes']=[node];d['meshes']=[mesh];d['scenes']=[{'nodes':[0]}];d['scene']=0
g.save(target)
report={'source':spec['retextureSource'],'input':spec['retextureInput'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'inputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'geometry':original,'method':'Near mesh only, original positions, normals, UVs and material unchanged. No route fitting repeated.'}
(HERE/(name+'-input.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
