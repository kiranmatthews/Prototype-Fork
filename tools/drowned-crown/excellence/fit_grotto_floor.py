"""Reuse the original riverstone atlas for a rounded, supported grotto floor."""
from pathlib import Path
import bpy,json,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent;WORK=ROOT/'.img2threejs/drowned-crown/excellence'
sys.path.insert(0,str(HERE));from clip_tunnel import weld_for_lod
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(WORK/'vault-floor-source.glb'))
near=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.endswith('LOD1')]
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and o not in near:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in near:o.select_set(True)
bpy.context.view_layer.objects.active=near[0];bpy.ops.object.join();high=bpy.context.object
world=high.matrix_world.copy();high.parent=None;high.matrix_world=world;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
raw=[Vector((v.co.x,v.co.z,-v.co.y)) for v in high.data.vertices];lo=Vector([min(p[i] for p in raw) for i in range(3)]);hi=Vector([max(p[i] for p in raw) for i in range(3)]);span=hi-lo
for v,p in zip(high.data.vertices,raw):
 u=(p.x-lo.x)/span.x;h=(p.y-lo.y)/span.y;t=(p.z-lo.z)/span.z
 x=-58+(u-.5)*20;z=-47+(t-.5)*22;y=-14+h/.5*10 if h<.5 else -4+(h-.5)*.008
 v.co=(x,-z,y)
high.name='Grotto_floor_LOD0'
if high.data.has_custom_normals:high.data.normals_split_custom_set([(0,0,0)]*len(high.data.loops))
high.data.update();high.data.calc_loop_triangles();vertices=[];indices=[];lookup={}
for tri in high.data.loop_triangles:
 pts=[Vector((high.data.vertices[i].co.x,high.data.vertices[i].co.z,-high.data.vertices[i].co.y)) for i in tri.vertices]
 n=(pts[1]-pts[0]).cross(pts[2]-pts[0]);n.normalize()
 if n.y<.6 or min(p.y for p in pts)<-4.03:continue
 for p in pts:
  key=tuple(round(v,5) for v in p)
  if key not in lookup:lookup[key]=len(vertices)//3;vertices.extend(key)
  indices.append(lookup[key])
assert len(indices)>300
low=high.copy();low.data=high.data.copy();low.name='Grotto_floor_LOD1';bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low;weld_for_lod(low)
mod=low.modifiers.new('Far grotto shelf','DECIMATE');mod.ratio=.4;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name);low.data.calc_loop_triangles()
pts=[v.co for v in high.data.vertices];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)])
report={'source':'public/treehouse-trials-v2/riverstone-a.glb','method':'Original-UV rounded grotto shelf with its own exact top-surface support','newProviderCredits':0,'size':[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y],'position':[(hi.x+lo.x)/2,lo.z,-(hi.y+lo.y)/2],'triangles':{'near':len(high.data.loop_triangles),'far':len(low.data.loop_triangles)},'groundVertices':len(vertices)//3,'groundTriangles':len(indices)//3}
bpy.ops.export_scene.gltf(filepath=str(WORK/'prepared/grotto-floor.glb'),export_format='GLB',export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_animations=False)
(HERE/'fitted-grotto-floor.json').write_text(json.dumps(report,indent=2)+'\n')
p=HERE/'assets.json';d=json.loads(p.read_text());d['grotto-floor']={'size':report['size'],'image':False,'derived':True,'sourceTaskId':'01a10ad3-c063-721a-abc5-1482d6a3495e','sourceAsset':report['source'],'kind':'crowngrottofloor','triangles':len(high.data.loop_triangles)};p.write_text(json.dumps(d,indent=2)+'\n')
code="/** Original riverstone UVs; support uses the same visible top triangles. */\nimport type { CustomComponent } from './level';\nexport const DROWNED_GROTTO_FLOOR_POSITION="+json.dumps(report['position'])+" as const;\nexport const DROWNED_GROTTO_GROUND:CustomComponent={t:'mesh',p:[0,0,0],vertices:"+json.dumps(vertices,separators=(',',':'))+",indices:"+json.dumps(indices,separators=(',',':'))+",solid:true,scenerySolid:false,artProxy:true,doubleSided:true,tex:'solid',grp:1,nm:'Worn crystal grotto shelf'};\n"
(ROOT/'src/drownedCrownGrotto.generated.ts').write_text(code);print(json.dumps(report),flush=True)
