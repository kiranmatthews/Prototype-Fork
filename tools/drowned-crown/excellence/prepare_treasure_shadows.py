"""Append shadow-only copies; native Meshy geometry and all textures stay exact.

Run with Blender --background --python-exit-code 1 --python this_file.
Run pack_treasure_mounds.py first to regenerate the original packed models.
"""
from pathlib import Path
import copy,hashlib,json,sys
import bpy,bmesh
import numpy as np
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from mathutils import Matrix,Quaternion,Vector

def matrices(document):
 result={}
 def visit(index,parent):
  assert index not in result
  node=document['nodes'][index]
  if 'matrix' in node:local=Matrix(np.asarray(node['matrix']).reshape(4,4).T.tolist())
  else:
   q=node.get('rotation',[0,0,0,1])
   local=Matrix.LocRotScale(Vector(node.get('translation',[0,0,0])),Quaternion((q[3],q[0],q[1],q[2])),Vector(node.get('scale',[1,1,1])))
  world=parent@local;result[index]=np.asarray(world,dtype=np.float64)
  for child in node.get('children',[]):visit(child,world)
 for index in document['scenes'][document.get('scene',0)]['nodes']:visit(index,Matrix.Identity(4))
 return result
sha=lambda data:hashlib.sha256(data).hexdigest()
manifest=json.loads((HERE/'treasure-mounds-manifest.json').read_text())
registry=ROOT/'src/drownedCrownTreasure.generated.ts';registration=registry.read_text()
assert registration.count('cellSize:16')==3 and 'shadowLod' not in registration
reports=[];outputs=[]
staging=ROOT/'.img2threejs/drowned-crown/excellence/treasure-shadow-candidates'
staging.mkdir(parents=True,exist_ok=True)
for asset in manifest['assets']:
 assert sha((ROOT/asset['output']).read_bytes())==asset['sha256'],'Regenerate all native packed piles before adding shadow meshes'
for asset in manifest['assets']:
 target=ROOT/asset['output'];original=target.read_bytes()
 assert sha(original)==asset['sha256'],'Regenerate the native packed pile before adding its shadow mesh'
 source=Glb(target);doc=source.document;snapshot=copy.deepcopy(doc);payload=bytes(source.binary)
 accessors=[source.read_accessor(i) for i in range(len(doc['accessors']))]
 assert not doc['asset'].get('extras',{}).get('shadowOnlyLod')
 materials={primitive['material'] for mesh in doc['meshes'] for primitive in mesh['primitives']}
 assert len(materials)==1 and all(doc['materials'][i].get('alphaMode','OPAQUE')=='OPAQUE' for i in materials)
 points=[];faces=[];offset=0
 for index,world in matrices(doc).items():
  node=doc['nodes'][index]
  if 'mesh' not in node:continue
  assert 'skin' not in node and np.linalg.det(world[:3,:3])>0
  for primitive in doc['meshes'][node['mesh']]['primitives']:
   p=source.read_accessor(primitive['attributes']['POSITION'])
   points.append(p@world[:3,:3].T+world[:3,3])
   faces.append(source.read_accessor(primitive['indices']).reshape(-1,3)+offset);offset+=len(p)
 points=np.concatenate(points);faces=np.concatenate(faces);before=len(faces)
 assert before==asset['triangles']
 bpy.ops.wm.read_factory_settings(use_empty=True)
 mesh=bpy.data.meshes.new('Disposable shadow copy');mesh.from_pydata(points.tolist(),[],faces.tolist());mesh.update()
 obj=bpy.data.objects.new('Treasure shadow copy',mesh);bpy.context.collection.objects.link(obj)
 bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 # Work in the original Y-up coordinates. Decimation is coordinate-neutral;
 # no glTF image decode/export or native material rewrite is involved.
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bm.to_mesh(mesh);bm.free();mesh.update()
 welded=len(mesh.vertices)
 modifier=obj.modifiers.new('Shadow-only detail','DECIMATE');modifier.ratio=.2;modifier.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=modifier.name)
 mesh=obj.data;mesh.calc_loop_triangles()
 positions=np.array([v.co[:] for v in mesh.vertices],dtype='<f4')
 normals=np.array([v.normal[:] for v in mesh.vertices],dtype='<f4')
 triangles=np.array([t.vertices[:] for t in mesh.loop_triangles],dtype='<u4')
 # Collapse can leave unused vertices and zero-area faces. Remove those only
 # from the disposable copy before validating its shading normals.
 edges=positions[triangles[:,1:]]-positions[triangles[:,0,None]]
 triangles=triangles[np.linalg.norm(np.cross(edges[:,0],edges[:,1]),axis=1)>1e-12]
 used,inverse=np.unique(triangles,return_inverse=True)
 positions=positions[used];normals=normals[used]
 indices=inverse.astype('<u4').reshape(-1,1)
 after=len(indices)//3
 print(json.dumps({'asset':asset['name'],'nativeTriangles':before,'shadowTriangles':after,'positionsFinite':bool(np.isfinite(positions).all()),'normalsFinite':bool(np.isfinite(normals).all())}),flush=True)
 assert 0<after<=before*.4 and np.isfinite(positions).all() and np.isfinite(normals).all()
 assert indices.max()<len(positions)
 lengths=np.linalg.norm(normals,axis=1)
 invalid=lengths<.9;fallback_count=int(invalid.sum())
 # Thin generated coin surfaces can cancel a welded vertex's normal. Use
 # its largest nondegenerate incident face for shadow normal bias only.
 if fallback_count:
  triangles=indices.reshape(-1,3)
  face_normals=np.cross(positions[triangles[:,1]]-positions[triangles[:,0]],positions[triangles[:,2]]-positions[triangles[:,0]])
  areas=np.linalg.norm(face_normals,axis=1);best=np.zeros(len(positions))
  for triangle,normal,area in zip(triangles,face_normals,areas):
   for vertex in triangle:
    if invalid[vertex] and area>best[vertex]:normals[vertex]=normal/area;best[vertex]=area
  lengths=np.linalg.norm(normals,axis=1)
 assert lengths.min()>.9
 normals/=lengths[:,None]
 # The copy never appears in a colour pass. UVs are inert but preserve the
 # loader's standard attribute contract; it shares the original opaque material.
 position=source.add_accessor(positions,5126,'VEC3',34962)
 doc['accessors'][position].update(min=positions.min(0).tolist(),max=positions.max(0).tolist())
 attributes={'POSITION':position,'NORMAL':source.add_accessor(normals,5126,'VEC3',34962),
  'TEXCOORD_0':source.add_accessor(np.zeros((len(positions),2),dtype='<f4'),5126,'VEC2',34962)}
 primitive={'attributes':attributes,'indices':source.add_accessor(indices,5125,'SCALAR',34963),
  'material':snapshot['meshes'][0]['primitives'][0]['material']}
 mesh_index=len(doc['meshes']);doc['meshes'].append({'name':'Treasure shadow_LOD1','primitives':[primitive]})
 node_index=len(doc['nodes']);doc['nodes'].append({'name':'Treasure shadow_LOD1','mesh':mesh_index})
 doc['scenes'][doc.get('scene',0)]['nodes'].append(node_index)
 doc['asset'].setdefault('extras',{})['shadowOnlyLod']={'requestedRatio':.2,'actualRatio':after/before,'nativeSha256':asset['sha256'],'nativeTriangles':before,'shadowTriangles':after}
 assert bytes(source.binary[:len(payload)])==payload
 for i,values in enumerate(accessors):assert np.array_equal(source.read_accessor(i),values)
 for key in ['images','textures','materials']:assert doc[key]==snapshot[key]
 for key in ['nodes','meshes','bufferViews','accessors']:assert doc[key][:len(snapshot[key])]==snapshot[key]
 candidate=staging/target.name;source.save(candidate);outputs.append((target,candidate))
 report={'name':asset['name'],'kind':asset['kind'],'nativeSha256':asset['sha256'],'outputSha256':sha(candidate.read_bytes()),
  'nativeBytes':len(original),'outputBytes':candidate.stat().st_size,'addedBytes':candidate.stat().st_size-len(original),
  'nativeTriangles':before,'shadowTriangles':after,'weldedVertices':welded,'shadowVertices':len(positions),'normalFallbackVertices':fallback_count,
  'nativeBinaryPrefixExact':True,'nativeAccessorsExact':len(accessors),'nativeImagesAndMaterialsExact':True,
  'nativeNodesAndMeshesExact':True,'shadowOnly':True,'newTextures':0,'blenderVersion':bpy.app.version_string}
 reports.append(report);print(json.dumps(report),flush=True)
for target,candidate in outputs:target.write_bytes(candidate.read_bytes())
(HERE/'treasure-shadow-manifest.json').write_text(json.dumps({'assets':reports},indent=2)+'\n')
registry.write_text(registration.replace('cellSize:16','shadowLod:true,cellSize:16'))
