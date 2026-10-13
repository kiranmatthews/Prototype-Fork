"""Reshape the already-paid Meshy limestone asset locally. No service calls."""
from pathlib import Path
import bpy,json,math
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/drowned-crown/limestone-wall.glb'))
all_meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
near=[o for o in all_meshes if not o.name.endswith('LOD1')]
if not near:raise RuntimeError('Missing original paid near mesh')
for obj in all_meshes:
 if obj not in near:bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in near:obj.select_set(True)
bpy.context.view_layer.objects.active=near[0];bpy.ops.object.join();obj=bpy.context.object
world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
points=[v.co.copy() for v in obj.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);span=hi-lo
# Blender XY is the horizontal plane; positive Z is world height.
for v in obj.data.vertices:
 u=(v.co.x-lo.x)/span.x;t=(v.co.y-lo.y)/span.y;h=(v.co.z-lo.z)/span.z
 x=-122+184*u
 peak=45*math.exp(-((x+80)/47)**2)+94.5*math.exp(-((x+4)/52)**2)
 # Bend the mass into a promontory, leaving distinct broad geological faces.
 front=70+7*math.sin(u*math.pi*1.3)-12*u
 world_z=front-t*(59+18*math.sin(u*math.pi))
 y=-14+h*peak
 v.co=(x,-world_z,y)
obj.data.update();obj.name='Sculpted_headland_LOD0'
# Open an elliptical passage through the whole shoulder. The authored timber
# trail and separate close rock lining determine the playable floor/headroom.
bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=1,depth=120,location=(-48,-45,-3),rotation=(math.pi/2,0,0))
cut=bpy.context.object;cut.name='Sea_gate_boolean';cut.scale=(7.5,14.0,1)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.context.view_layer.objects.active=obj
mod=obj.modifiers.new('Smugglers tidal arch','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
# Continue the mine's diagonal bend through the back of the landform.
a=Vector((-48,-20,0));b=Vector((-34,8,-3));direction=(b-a).normalized();right=Vector((0,0,1)).cross(direction).normalized();up=direction.cross(right).normalized()
bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=1,depth=(b-a).length+18,location=(a+b)/2)
cut=bpy.context.object;cut.rotation_mode='QUATERNION';cut.rotation_quaternion=Matrix((right,up,direction)).transposed().to_quaternion();cut.scale=(7,13,1)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.context.view_layer.objects.active=obj;mod=obj.modifiers.new('Diagonal mine clearance','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)

repaired=obj.data.validate(verbose=True,clean_customdata=False);obj.data.update()
for poly in obj.data.polygons:poly.use_smooth=True
# Keep a broad wet base, with no separate rectangular pedestal.
low=obj.copy();low.data=obj.data.copy();low.name='Sculpted_headland_LOD1';bpy.context.collection.objects.link(low)
bpy.context.view_layer.objects.active=low;dec=low.modifiers.new('Far silhouette','DECIMATE');dec.ratio=.34;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
low.data.validate(verbose=True,clean_customdata=False);low.data.update()
obj.data.calc_loop_triangles();low.data.calc_loop_triangles()
anchors=[]
for x,z in [(-82,26),(-102,27),(-93,41),(-66,40),(-26,29),(14,36),(29,37)]:
 hit,point,normal,index=obj.ray_cast(Vector((x,-z,150)),Vector((0,0,-1)))
 if hit:anchors.append([x,round(point.z-.5,5),z])
points=[obj.matrix_world@v.co for v in obj.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
size=[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y];placement=[(lo.x+hi.x)/2,lo.z,-(lo.y+hi.y)/2]
path=ROOT/'public/drowned-crown/sculpted-headland.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_image_format='AUTO',export_yup=True,export_materials='EXPORT',export_animations=False)
report={'method':'Existing paid Meshy limestone-wall asset reshaped in Blender; original atlas and UVs retained; elliptical sea gate cut locally','newMeshyCredits':0,'validated':True,'repairedMesh':repaired,'anchors':anchors,'size':[round(v,5) for v in size],'placement':[round(v,5) for v in placement],'triangles':{'near':len(obj.data.loop_triangles),'far':len(low.data.loop_triangles)}}
(ROOT/'tools/drowned-crown/excellence/sculpted-headland.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'src/drownedCrownSculpture.ts').write_text('/** Existing Meshy geometry, reshaped locally; no additional generation. */\nexport const DROWNED_CROWN_SCULPTURES={\n crownsculptedheadland:{file:\'../drowned-crown/sculpted-headland\',label:\'Drowned Crown · sculpted limestone promontory\',size:'+json.dumps(report['size'])+',wind:false,lod:true,distanceLod:true,normalStrength:.15,doubleSided:false},\n} as const;\nexport const DROWNED_HEADLAND_POSITION='+json.dumps(report['placement'])+' as const;\nexport const DROWNED_HEADLAND_ANCHORS='+json.dumps(anchors)+' as const;\n')
print(json.dumps(report),flush=True)
