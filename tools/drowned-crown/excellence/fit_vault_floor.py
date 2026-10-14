"""A single worn rock terrace, reusing the existing riverstone UV atlas."""
from pathlib import Path
import bpy,json,math,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent;WORK=ROOT/'.img2threejs/drowned-crown/excellence'
sys.path.insert(0,str(HERE));from clip_tunnel import weld_for_lod
source=WORK/'vault-floor-source.glb'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];near=[o for o in objects if not o.name.endswith('LOD1')]
for o in objects:
 if o not in near:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in near:o.select_set(True)
bpy.context.view_layer.objects.active=near[0];bpy.ops.object.join();high=bpy.context.object
world=high.matrix_world.copy();high.parent=None;high.matrix_world=world;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
raw=[Vector((v.co.x,v.co.z,-v.co.y)) for v in high.data.vertices]
lo=Vector([min(p[i] for p in raw) for i in range(3)]);hi=Vector([max(p[i] for p in raw) for i in range(3)]);span=hi-lo
for v,p in zip(high.data.vertices,raw):
 u=(p.x-lo.x)/span.x;h=(p.y-lo.y)/span.y;t=(p.z-lo.z)/span.z
 x=32+(u-.5)*30;z=-309+(t-.5)*52
 q=max(0,min(1,(-z-294+.8*math.sin((x-32)*.23))/14));rise=2*q*q*(3-2*q)
 y=(-14+h/.55*24 if h<.55 else 10+(h-.55)*.018)+rise
 v.co=(x,-z,y)
high.name='Vault_floor_LOD0'
if high.data.has_custom_normals:high.data.normals_split_custom_set([(0,0,0)]*len(high.data.loops))
high.data.update();high.data.calc_loop_triangles()
# The support triangles are the same authored surface as the visible stone.
verts=[];indices=[];lookup={}
for tri in high.data.loop_triangles:
 pts=[Vector((high.data.vertices[i].co.x,high.data.vertices[i].co.z,-high.data.vertices[i].co.y)) for i in tri.vertices]
 n=(pts[1]-pts[0]).cross(pts[2]-pts[0]);n.normalize()
 if n.y<.6 or min(p.y for p in pts)<9.7:continue
 for p in pts:
  key=tuple(round(v,5) for v in p)
  if key not in lookup:lookup[key]=len(verts)//3;verts.extend(key)
  indices.append(lookup[key])
assert len(verts)//3<4096 and len(indices)>300
low=high.copy();low.data=high.data.copy();low.name='Vault_floor_LOD1';bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low
weld_for_lod(low)
mod=low.modifiers.new('Far terrace','DECIMATE');mod.ratio=.4;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name);low.data.calc_loop_triangles()
pts=[v.co for v in high.data.vertices];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)])
report={'source':'public/treehouse-trials-v2/riverstone-a.glb','method':'Original UVs on one rounded terrace; shallow rise and exact matching top-surface support','newProviderCredits':0,'size':[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y],'position':[(hi.x+lo.x)/2,lo.z,-(hi.y+lo.y)/2],'triangles':{'near':len(high.data.loop_triangles),'far':len(low.data.loop_triangles)},'groundVertices':len(verts)//3,'groundTriangles':len(indices)//3}
bpy.ops.export_scene.gltf(filepath=str(WORK/'prepared/vault-floor.glb'),export_format='GLB',export_image_format='AUTO',export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_animations=False)
(HERE/'fitted-vault-floor.json').write_text(json.dumps(report,indent=2)+'\n')
p=HERE/'assets.json';d=json.loads(p.read_text());d['vault-floor']={'size':report['size'],'image':False,'derived':True,'sourceTaskId':'01a10ad3-c063-721a-abc5-1482d6a3495e','sourceAsset':report['source'],'kind':'crownvaultfloor','triangles':len(high.data.loop_triangles)};p.write_text(json.dumps(d,indent=2)+'\n')
code='''/** Original riverstone UVs; physical support sampled from the same vertices. */
import type { CustomComponent } from './level';
export const DROWNED_VAULT_FLOOR_POSITION=__POSE__ as const;
export const DROWNED_VAULT_GROUND:CustomComponent={t:'mesh',p:[0,0,0],vertices:VERTICES,indices:INDICES,solid:true,scenerySolid:false,artProxy:true,doubleSided:true,tex:'solid',grp:7,nm:'Worn royal vault terrace'};
export function drownedVaultSurfaceHeight(x:number,z:number):number {
 const v=DROWNED_VAULT_GROUND.vertices!,ids=DROWNED_VAULT_GROUND.indices!;let height=-Infinity;
 for(let i=0;i<ids.length;i+=3){
  const a=ids[i]*3,b=ids[i+1]*3,c=ids[i+2]*3;
  const den=(v[b+2]-v[c+2])*(v[a]-v[c])+(v[c]-v[b])*(v[a+2]-v[c+2]);if(Math.abs(den)<1e-8)continue;
  const u=((v[b+2]-v[c+2])*(x-v[c])+(v[c]-v[b])*(z-v[c+2]))/den;
  const w=((v[c+2]-v[a+2])*(x-v[c])+(v[a]-v[c])*(z-v[c+2]))/den,q=1-u-w;
  if(u>=-.0001&&w>=-.0001&&q>=-.0001)height=Math.max(height,u*v[a+1]+w*v[b+1]+q*v[c+1]);
 }
 if(!Number.isFinite(height))throw new Error('Vault placement has no stone support: '+x+','+z);
 return height;
}
'''.replace('__POSE__',json.dumps(report['position'])).replace('VERTICES',json.dumps(verts,separators=(',',':'))).replace('INDICES',json.dumps(indices,separators=(',',':')))
(ROOT/'src/drownedCrownVault.generated.ts').write_text(code);print(json.dumps(report),flush=True)
