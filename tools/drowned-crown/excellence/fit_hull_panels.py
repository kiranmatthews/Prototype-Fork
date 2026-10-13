"""Fit the existing paid hull-panel atlas and mesh to the authored galleon."""
from pathlib import Path
import bpy,json,math,hashlib
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
source=ROOT/'public/drowned-crown/hull-panel.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
near=[o for o in meshes if not o.name.endswith('LOD1')]
for o in meshes:
 if o not in near:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in near:o.select_set(True)
bpy.context.view_layer.objects.active=near[0];bpy.ops.object.join();template=bpy.context.object
world=template.matrix_world.copy();template.parent=None;template.matrix_world=world
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
lo=Vector([min(v.co[i] for v in template.data.vertices) for i in range(3)]);hi=Vector([max(v.co[i] for v in template.data.vertices) for i in range(3)]);span=hi-lo
rings=[(-92,7),(-103,15),(-120,19),(-142,20),(-155,19),(-176,18),(-197,17),(-222,13),(-244,5),(-252,0)]
def width_at(z):
 for (za,wa),(zb,wb) in zip(rings,rings[1:]):
  if za>=z>=zb:return wa+(wb-wa)*(z-za)/(zb-za)
 return rings[0][1] if z>rings[0][0] else 0
parts=[]
for centre in [-117,-137,-192,-212,-230]:
 for side in [-1,1]:
  o=template.copy();o.data=template.data.copy();bpy.context.collection.objects.link(o)
  for v in o.data.vertices:
   length=-((v.co.x-lo.x)/span.x-.5)*18
   depth=((v.co.y-lo.y)/span.y-.5)*.62
   y=-.5+(v.co.z-lo.z)/span.z*9
   z=centre-side*length
   radius=width_at(z)*(.28+.72*((y+9)/20.4)**.6)
   v.co=(side*(radius+depth-.38),-z,y)
  o.data.validate(clean_customdata=False)
  if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
  o.data.update();parts.append(o)
bpy.data.objects.remove(template,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();high=bpy.context.object;high.name='Fitted_hull_LOD0'
# The bracing faces into the ship. Clear the two authored bow passages from
# the physical model instead of disabling its collision.
for a,b in [((8,-4,-204),(8,8,-237)),((8,8,-237),(0,8,-246))]:
 dx,dz=b[0]-a[0],b[2]-a[2];length=math.hypot(dx,dz);rx,rz=-dz/length*3.55,dx/length*3.55
 corners=[]
 for lift in [.045,3.5]:
  for q,side in [(a,-1),(a,1),(b,1),(b,-1)]:corners.append((q[0]+rx*side,-(q[2]+rz*side),q[1]+lift))
 mesh=bpy.data.meshes.new('Hatch clearance');mesh.from_pydata(corners,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);mesh.update()
 cut=bpy.data.objects.new('Hatch clearance',mesh);bpy.context.collection.objects.link(cut)
 bpy.context.view_layer.objects.active=high;mod=high.modifiers.new('Bow passage','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
 bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)

low=high.copy();low.data=high.data.copy();low.name='Fitted_hull_LOD1';bpy.context.collection.objects.link(low)
bpy.context.view_layer.objects.active=low;dec=low.modifiers.new('Far hull detail','DECIMATE');dec.ratio=.28;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
for o in [high,low]:o.data.validate(clean_customdata=False);o.data.update();o.data.calc_loop_triangles()
lo=Vector([min(v.co[i] for v in high.data.vertices) for i in range(3)]);hi=Vector([max(v.co[i] for v in high.data.vertices) for i in range(3)])
size=[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y];p=[(lo.x+hi.x)/2,lo.z,-(lo.y+hi.y)/2]
out=ROOT/'public/drowned-crown/fitted-hull.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_image_format='AUTO',export_yup=True,export_materials='EXPORT',export_animations=False)
original=json.loads((ROOT/'tools/drowned-crown/asset-manifest.json').read_text())['hull-panel']
report={'method':'Existing Meshy hull panels fitted as inward-facing bracing; source hull curvature and bow passages preserved; original atlas and UVs retained','newMeshyCredits':0,'sourceTaskId':original['taskId'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'size':[round(v,5) for v in size],'position':[round(v,5) for v in p],'rings':rings,'triangles':{'near':len(high.data.loop_triangles),'far':len(low.data.loop_triangles)}}
(ROOT/'tools/drowned-crown/excellence/fitted-hull.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'public/drowned-crown/fitted-hull.provenance.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'src/drownedCrownShip.generated.ts').write_text('/** Original paid hull mesh, fitted locally to the authored vessel. */\nexport const DROWNED_CROWN_SHIP_ASSETS={\n crownfittedhull:{file:\'../drowned-crown/fitted-hull\',label:\'Drowned Crown · fitted inner hull bracing\',size:'+json.dumps(report['size'])+',wind:false,lod:true,distanceLod:true,normalStrength:.2,doubleSided:false},\n} as const;\nexport const DROWNED_HULL_POSITION='+json.dumps(report['position'])+' as const;\n')
print(json.dumps(report),flush=True)
