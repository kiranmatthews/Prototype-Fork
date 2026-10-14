"""Fit the paid Meshy 7 headland to the real route; preserve its atlas."""
from pathlib import Path
import bpy,json,math,shutil,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from clip_tunnel import clip_tunnel,weld_for_lod
source=ROOT/'.img2threejs/drowned-crown/excellence/prepared/headland-detail.glb'
canonical=source.with_name('headland-detail-unfitted.glb')
if not canonical.exists():shutil.copy2(source,canonical)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(canonical))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];near=[o for o in objects if not o.name.endswith('LOD1')]
for o in objects:
 if o not in near:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in near:o.select_set(True)
bpy.context.view_layer.objects.active=near[0];bpy.ops.object.join();high=bpy.context.object
world=high.matrix_world.copy();high.parent=None;high.matrix_world=world
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
lo=Vector([min(v.co[i] for v in high.data.vertices) for i in range(3)]);hi=Vector([max(v.co[i] for v in high.data.vertices) for i in range(3)]);span=hi-lo
scale=260/span.x
for v in high.data.vertices:
 u=(v.co.x-lo.x)/span.x;t=(v.co.y-lo.y)/span.y;h=(v.co.z-lo.z)/span.z
 v.co=(11+(u-.5)*260,-77+t*130,-14+h*span.z*scale*.66*(1+1.15*math.exp(-((u-.24)/.27)**2)))
high.data.update();high.name='Headland_detail_LOD0'
# Clip only original triangles. Meshy scans can be non-manifold; a Boolean
# difference can invent long cap faces outside the rock. UV-aware clipping
# preserves the actual exterior and leaves the existing tunnel lining inside.
if high.data.has_custom_normals:high.data.normals_split_custom_set([(0,0,0)]*len(high.data.loops))
high.data.update()
for a,b,width,height in [((-48,-90,-1),(-48,-14,-1),8,12),((-48,-20,0),(-34,18,-3),8,12),((-34,8,-3),(-36,38,-6),9,12),((-36,38,-6),(-48,64,-6),9,12),((-35,31,-5),(-58,40,-4),8,11),((-58,38,-4),(-58,58,-4),9,13)]:
 clip_tunnel(high,a,b,width,height)
high.data.validate(clean_customdata=False);high.data.update()
weld_for_lod(high)
low=high.copy();low.data=high.data.copy();low.name='Headland_detail_LOD1';bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low
mod=low.modifiers.new('Far silhouette','DECIMATE');mod.ratio=.28;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
for o in [high,low]:o.data.validate(clean_customdata=False);o.data.update();o.data.calc_loop_triangles()
anchors=[]
for index,(x,z) in enumerate([(-49,26),(-33,24),(-58,18),(-20,39),(5,15),(44,15)]):
 samples=[]
 # Embed the fort base in the lowest point of its footprint, not just the
 # height under its centre; distant towers must not float off the ledge.
 offsets=[-10,0,10] if index<2 else [0]
 for dx in offsets:
  for dz in offsets:
   hit,point,normal,face=high.ray_cast(Vector((x+dx,-z-dz,150)),Vector((0,0,-1)))
   if hit:samples.append(point.z)
 if samples:anchors.append([x,round(min(samples)-.28,5),z])
lo=Vector([min(v.co[i] for v in high.data.vertices) for i in range(3)]);hi=Vector([max(v.co[i] for v in high.data.vertices) for i in range(3)])
report={'sourceJob':'headland-detail-textured','method':'Original Meshy 7 atlas, local 24000-triangle reduction, six real mine and grotto passage cuts and ray-measured fort anchors','newMeshyCredits':0,'size':[round(hi.x-lo.x,5),round(hi.z-lo.z,5),round(hi.y-lo.y,5)],'position':[round((lo.x+hi.x)/2,5),round(lo.z,5),round(-(lo.y+hi.y)/2,5)],'anchors':anchors,'triangles':{'near':len(high.data.loop_triangles),'far':len(low.data.loop_triangles)}}
bpy.ops.export_scene.gltf(filepath=str(source),export_format='GLB',export_image_format='AUTO',export_yup=True,export_materials='EXPORT',export_animations=False)
(HERE/'fitted-headland.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'src/drownedCrownHeadland.generated.ts').write_text('/** Surface anchors measured on the fitted Meshy 7 headland. */\nexport const DROWNED_HERO_HEADLAND_POSITION='+json.dumps(report['position'])+' as const;\nexport const DROWNED_HERO_HEADLAND_ANCHORS='+json.dumps(anchors)+' as const;\n')
print(json.dumps(report),flush=True)
