"""Fit the existing paid hull-panel atlas and mesh to the authored galleon."""
from pathlib import Path
import bpy,json,math,hashlib,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from clip_tunnel import clip_tunnel,clip_box,weld_for_lod
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
weld_for_lod(template)
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
   y=-7.5+(v.co.z-lo.z)/span.z*16
   z=centre-side*length
   radius=width_at(z)*(.5+.5*math.sqrt(max(0,min(1,(y+14)/25.4))))
   v.co=(side*(radius+depth-.38),-z,y)
  o.data.validate(clean_customdata=False)
  if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
  o.data.update();parts.append(o)
bpy.data.objects.remove(template,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();high=bpy.context.object;high.name='Fitted_hull_LOD0'
# The inner lining reaches beneath the floor. Open only the actual bow
# hatches and powder-room crosswalk, retaining original UVs around each cut.
for a,b,w,h in [((8,204,-2),(8,239,10),4.7,5.2),((8,237,10),(0,248,10),5.2,5)]:
 clip_tunnel(high,a,b,w,h)
clip_tunnel(high,(-10,198,-.5),(-28,198,-.5),3.1,4.1,padding=0)
weld_for_lod(high)

low=high.copy();low.data=high.data.copy();low.name='Fitted_hull_LOD1';bpy.context.collection.objects.link(low)
bpy.context.view_layer.objects.active=low;dec=low.modifiers.new('Far hull detail','DECIMATE');dec.ratio=.28;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
for o in [high,low]:o.data.validate(clean_customdata=False);o.data.update();o.data.calc_loop_triangles()
lo=Vector([min(v.co[i] for v in high.data.vertices) for i in range(3)]);hi=Vector([max(v.co[i] for v in high.data.vertices) for i in range(3)])
size=[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y];p=[(lo.x+hi.x)/2,lo.z,-(lo.y+hi.y)/2]
out=ROOT/'public/drowned-crown/fitted-hull.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_image_format='AUTO',export_yup=True,export_materials='EXPORT',export_animations=False)
original=json.loads((ROOT/'tools/drowned-crown/asset-manifest.json').read_text())['hull-panel']
report={'method':'Existing Meshy hull panels fitted as inward-facing bracing; continuous bilge lining, measured outer-hull curvature and three real passage openings; original atlas and UVs retained','newMeshyCredits':0,'sourceTaskId':original['taskId'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'size':[round(v,5) for v in size],'position':[round(v,5) for v in p],'rings':rings,'triangles':{'near':len(high.data.loop_triangles),'far':len(low.data.loop_triangles)}}
(ROOT/'tools/drowned-crown/excellence/fitted-hull.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'public/drowned-crown/fitted-hull.provenance.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'src/drownedCrownShip.generated.ts').write_text('/** Original paid hull mesh, fitted locally to the authored vessel. */\nexport const DROWNED_CROWN_SHIP_ASSETS={\n crownfittedhull:{file:\'../drowned-crown/fitted-hull\',label:\'Drowned Crown · fitted inner hull bracing\',size:'+json.dumps(report['size'])+',wind:false,lod:true,distanceLod:true,normalStrength:.2,doubleSided:true,lodRange:[250,300]},\n} as const;\nexport const DROWNED_HULL_POSITION='+json.dumps(report['position'])+' as const;\n')
print(json.dumps(report),flush=True)
