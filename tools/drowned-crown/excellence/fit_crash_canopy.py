"""Build an original-UV cavern canopy from the approved sculpted rock kit."""
from pathlib import Path
import bpy,json,math,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
WORK=ROOT/'.img2threejs/drowned-crown/excellence'
sys.path.insert(0,str(HERE));from clip_tunnel import clip_tunnel,weld_for_lod
SKYLIGHTS=[[-30,-190],[40,-136]]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(WORK/'prepared/crash-cavern-rock.glb'))
source=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.endswith('LOD0'))
for o in list(bpy.context.scene.objects):
    if o!=source:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.objects.active=source;source.select_set(True)
world=source.matrix_world.copy();source.parent=None;source.matrix_world=world
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
source.rotation_mode='XYZ';source.rotation_euler.x=math.pi/2
bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
raw=[v.co.copy() for v in source.data.vertices]
lo=Vector([min(v[i] for v in raw) for i in range(3)]);hi=Vector([max(v[i] for v in raw) for i in range(3)]);span=hi-lo;center=(lo+hi)/2
pieces=[]
for row,z in enumerate([-108,-180,-252,-324]):
    for col,x in enumerate([-52,38]):
        o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o)
        yaw=math.radians((-1 if col else 1)*(4+row%2*3));cs,sn=math.cos(yaw),math.sin(yaw)
        width=120;depth=94;bottom=58+2*((row+col)%2);height=10
        for vertex,p in zip(o.data.vertices,raw):
            px=(p.x-center.x)/span.x*width;py=(p.y-center.y)/span.y*depth
            vertex.co=(x+px*cs-py*sn,-z+px*sn+py*cs,bottom+(p.z-lo.z)/span.z*height)
        if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
        o.data.update()
        for sx,sz in SKYLIGHTS:clip_tunnel(o,(sx,-sz,34),(sx,-sz,95),31,28,padding=0)
        pieces.append(o)
bpy.data.objects.remove(source,do_unlink=True);bpy.ops.object.select_all(action='DESELECT')
for o in pieces:o.select_set(True)
bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();high=bpy.context.object
high.name='Crash_canopy_LOD0';high.data.calc_loop_triangles()
low=high.copy();low.data=high.data.copy();low.name='Crash_canopy_LOD1';bpy.context.collection.objects.link(low)
bpy.context.view_layer.objects.active=low;weld_for_lod(low)
mod=low.modifiers.new('Far canopy silhouette','DECIMATE');mod.ratio=.28;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
low.data.calc_loop_triangles();pts=[v.co for v in high.data.vertices]
lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)])
size=[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y];position=[(lo.x+hi.x)/2,lo.z,-(lo.y+hi.y)/2]
report={'source':'crash-cavern-rock','originalUVsPreserved':True,'newProviderCredits':0,'size':size,'position':position,'skylights':SKYLIGHTS,'clearance':[62,56],'triangles':{'near':len(high.data.loop_triangles),'far':len(low.data.loop_triangles)}}
bpy.ops.export_scene.gltf(filepath=str(WORK/'prepared/crash-cavern-canopy.glb'),export_format='GLB',export_texcoords=True,export_normals=True,export_materials='EXPORT',export_animations=False)
(HERE/'fitted-crash-canopy.json').write_text(json.dumps(report,indent=2)+'\n')
p=HERE/'assets.json';spec=json.loads(p.read_text());spec['crash-cavern-canopy']={'size':size,'image':False,'derived':True,'sourceTaskId':'01a13a9d-405c-75c3-8c18-0aa6e63eed72','kind':'crowncrashcanopy','triangles':report['triangles']['near'],'textureMax':4096,'lodRange':[250,300],'doubleSided':True};p.write_text(json.dumps(spec,indent=2)+'\n')
(ROOT/'src/drownedCrownCanopy.generated.ts').write_text('/** Original-UV sculpted ceiling; real openings align with the roof rings. */\nexport const DROWNED_CANOPY_POSITION='+json.dumps(position)+' as const;\nexport const DROWNED_SKYLIGHTS='+json.dumps(SKYLIGHTS)+' as const;\n')
print(json.dumps(report),flush=True)
