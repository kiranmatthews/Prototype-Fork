"""Rigidly fit the provider-remeshed cliff and clear only real mine passages.

Run with Blender --background --python this_file. No deformation, decimation,
new rock surfaces, UV remapping or texture painting is performed.
"""
from pathlib import Path
import bpy,json,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from clip_tunnel import clip_tunnel
NAME='crash-coastal-headland'
source=ROOT/'.img2threejs/drowned-crown/excellence/meshy'/(NAME+'-remeshed')/'downloads/model.glb'
output=ROOT/'.img2threejs/drowned-crown/excellence/prepared'/(NAME+'-fitted.glb');output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for obj in objects:
 world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 assert len(obj.data.materials)<=1,'Clip each provider material separately before fitting a multi-material model'
points=[v.co.copy() for obj in objects for v in obj.data.vertices]
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
span=hi-lo;scale=180/span.x
# Meshy preserves the reference's X-wide / +Z-front orientation. Downward
# front-face probes place the natural cave at X fraction .24; its upper rim
# sits at Z fraction .72. Map that entrance directly to the real sea gate.
opening_x=lo.x+span.x*.24
front_z=-hi.y+span.y*.72
translation=Vector((-48-opening_x*scale,-74-front_z*-scale,-14-lo.z*scale))
for obj in objects:
 obj.scale=(scale,scale,scale);obj.location=translation
 bpy.context.view_layer.objects.active=obj
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 obj.data.calc_loop_triangles()
triangles_before=sum(len(o.data.loop_triangles) for o in objects)
# Three.js Y-up route coordinates; Blender is Z-up with Y = -world Z.
passages=[
 ('sea-cave entrance',(-48,-1,112),(-48,-1,14),9,13,0),
 ('mine entrance lining',(-48,-1,56),(-48,-1,14),18,20,0),
 ('mine first turn',(-48,0,20),(-34,-3,-18),18,20,0),
 ('mine second turn',(-34,-3,-8),(-36,-6,-38),18,20,0),
 ('mine descent',(-36,-6,-38),(-48,-6,-64),18,20,0),
 ('grotto branch',(-35,-5,-31),(-58,-4,-40),18,20,0),
 ('grotto chamber',(-58,-4,-38),(-58,-4,-58),18,20,0),
]
def blender(p):return (p[0],-p[2],p[1])
for name,a,b,width,height,padding in passages:
 for obj in objects:clip_tunnel(obj,blender(a),blender(b),width,height,padding)
 print('Cleared '+name,flush=True)
for obj in objects:
 obj.data.validate(clean_customdata=False);obj.data.update();obj.data.calc_loop_triangles()
# Fort bases use the lowest roof sample in their full footprint so the
# bastions bed into the provider rock instead of floating on one centre hit.
def roof_height(x,z,radius=0):
 hits=[]
 for dx in ([-radius,0,radius] if radius else [0]):
  for dz in ([-radius,0,radius] if radius else [0]):
   heights=[]
   for obj in objects:
    hit,point,normal,face=obj.ray_cast(Vector((x+dx,-z-dz,200)),Vector((0,0,-1)))
    if hit:heights.append(point.z)
   if heights:hits.append(max(heights))
 if not hits:raise RuntimeError('No provider surface at anchor '+str((x,z)))
 return min(hits)-.4
forts=[[x,round(roof_height(x,z,8),5),z] for x,z in [(-58,54),(-34,49)]]
assert all(p[1]>10 for p in forts),'Fort foundation must be on an upper terrace'
palms=[[x,round(roof_height(x,z),5),z] for x,z in [(-75,61),(-15,52),(21,30),(57,48)]]
points=[v.co for o in objects for v in o.data.vertices]
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
report={'source':str(source.relative_to(ROOT)),'fit':'one uniform scale and translation; provider front remains +Z',
 'uniformScale':scale,'translationBlender':list(translation),'openingReferenceFractions':{'x':.24,'z':.72},'openingTarget':[-48,0,74],
 'size':[round(hi.x-lo.x,6),round(hi.z-lo.z,6),round(hi.y-lo.y,6)],
 'position':[round((lo.x+hi.x)/2,6),round(lo.z,6),round(-(lo.y+hi.y)/2,6)],
 'fortAnchors':forts,'palmAnchors':palms,'trianglesBeforePassageCuts':triangles_before,
 'trianglesAfterPassageCuts':sum(len(o.data.loop_triangles) for o in objects),
 'passages':[{'name':n,'a':a,'b':b,'ellipseHalfWidth':w,'ellipseHalfHeight':h,'padding':p} for n,a,b,w,h,p in passages],
 'providerUVsAndCornerNormalsPreservedThroughClipping':True,'localDecimation':False,'newRockGeometry':False}
(HERE/'fitted-crash-coastal-headland.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_materials='EXPORT',export_animations=False)
print(json.dumps(report),flush=True)
