"""Fit the owner's CC0 Downtown City MegaKit into a shared city library.

Original road topology/UVs stay intact. Additional building variants are
assemblies of the pack's 2 m / 3 m facade modules, not replacement boxes.
Blender --background --python tools/carlisle-coast/bake_city.py
"""
import bpy,bmesh,json,math,re
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path('/Users/kiki/Downloads/Downtown City MegaKit[Standard]/Exports/glTF (Godot)')
WORK=ROOT/'.img2threejs/carlisle-coast/city-baked';WORK.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
templates={};materials={};images={};finals=[];report=[];collision={}

def canonical(name):return re.sub(r'\.\d{3}$','',name)
def source(name):
    if name in templates:return templates[name]
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE/(name+'.gltf')))
    meshes=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    for o in bpy.context.scene.objects:o.select_set(o in meshes)
    bpy.context.view_layer.objects.active=meshes[0]
    if len(meshes)>1:bpy.ops.object.join()
    obj=bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for slot in obj.material_slots:
        mat=slot.material;key=canonical(mat.name)
        if key in materials:slot.material=materials[key];continue
        mat.name=key;materials[key]=mat
        for node in mat.node_tree.nodes:
            if node.type!='TEX_IMAGE' or not node.image:continue
            key=canonical(node.image.name)
            if key in images:node.image=images[key]
            else:node.image.name=key;images[key]=node.image
    obj.name='source_'+name;obj.hide_render=True;obj.hide_set(True)
    templates[name]=obj;return obj

def part(name,x=0,y=0,z=0,yaw=0,scale=(1,1,1)):
    obj=source(name).copy();obj.data=obj.data.copy();bpy.context.collection.objects.link(obj)
    obj.hide_set(False);obj.hide_render=False
    obj.matrix_world=Matrix.Translation(Vector((x,-z,y)))@Matrix.Rotation(math.radians(yaw),4,'Z')@Matrix.Diagonal(Vector((scale[0],scale[2],scale[1],1)))
    return obj

def join(objects):
    for o in bpy.context.scene.objects:o.select_set(o in objects)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    obj=bpy.context.view_layer.objects.active;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);return obj

def finish(name,obj,ground=False,building=False,footprint=None):
    obj.hide_set(False);obj.hide_render=False;obj.name=name+'_LOD0'
    # Roads are authored 15 cm below pavement; p.y is the carriageway top.
    if ground:
        for v in obj.data.vertices:v.co.z+=.15
    obj.data.update();obj.data.calc_loop_triangles()
    opaque=[]
    for tri in obj.data.loop_triangles:
        mat=obj.data.materials[tri.material_index]
        if 'StreetDecals' not in mat.name:opaque.extend(tri.vertices)
    xyz=[(v.co.x,v.co.z,-v.co.y) for v in obj.data.vertices]
    chosen=[xyz[i] for i in opaque] or xyz
    lo=[min(v[i] for v in chosen) for i in range(3)];hi=[max(v[i] for v in chosen) for i in range(3)]
    if ground:collision[name]={'positions':[round(v,6) for q in xyz for v in q],'indices':opaque}
    if building and footprint is None:
        floors=[]
        for tri in obj.data.loop_triangles:
            if 'InteriorFloor' in obj.data.materials[tri.material_index].name:
                floors.extend(xyz[i] for i in tri.vertices if xyz[i][1]<.1)
        base=floors or xyz
        footprint=[min(q[0] for q in base),min(q[2] for q in base),max(q[0] for q in base),min(.1,max(q[2] for q in base))]
    high_count=len(obj.data.loop_triangles)
    low=obj.copy();low.data=obj.data.copy();bpy.context.collection.objects.link(low);low.name=name+'_LOD1';bpy.context.view_layer.objects.active=low
    if high_count>800:
        mod=low.modifiers.new('Distant architectural silhouette','DECIMATE');mod.ratio=.19 if building else .45;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    low.data.calc_loop_triangles();finals.extend([obj,low])
    row={'kind':name,'label':name.removeprefix('city').replace('_',' '),'ground':ground,'building':building,'bounds':[lo,hi],'size':[max(.15,hi[i]-lo[i]) for i in range(3)],'triangles':high_count,'lodTriangles':len(low.data.loop_triangles)}
    if footprint:row['footprint']=footprint
    report.append(row);print('CITY',json.dumps(row),flush=True)

assets={
 'cityroad2':'Street_2Lane','cityroad4':'Street_4Lane','cityroad2bare':'Street_2Lane_noSidewalk',
 'cityroad4bare':'Street_4Lane_noSidewalk','citycrossing':'Street_4WayIntersection','citytjunction':'Street_TIntersection',
 'citycurve2':'Street_Curve_2Lane','citycurve4':'Street_Curve_4LaneShort','cityasphalt':'Street_Asphalt_6x6',
 'citypavement':'Sidewalk_Straight_3m','citypavementround':'Sidewalk_Corner_Round_3m','citypavementflat':'Sidewalk_NoCurb_3m',
 'cityfloor':'Floor_4x4','citysteps':'Entrance_Concrete_2x2',
 'citytownhouse':'Building_Small_1','cityapartments':'Building_Medium_2_001','citycivic':'Building_Large_2',
 'citybollard':'Prop_Bollard','cityplanter':'Prop_Planter_Single','citymanhole':'Prop_ManholeCover','citydrain':'Prop_Drain','cityac':'Prop_ACUnit',
}
for name,file in assets.items():
    ground=file.startswith(('Street','Sidewalk','Floor','Entrance'))
    objects=[part(file)]
    if name in ['cityroad2','cityroad4']:
        objects.append(part('Decal_DoubleYellow_Straight',0,.012,0))
        if name=='cityroad4':
            objects.extend([part('Decal_BrokenLine_Straight',0,.012,z) for z in [-3,3]])
    if name=='citycurve4':objects.append(part('Decal_Curve_4LaneShort_DoubleYellow',0,.012,0))
    finish(name,join(objects),ground,file.startswith('Building'))

def building(name,width,depth,floors,style):
    objects=[]
    if style=='cream':panel='Trim_FirstFloor_Window_001';blank='Trim_Plain_3';parapet='Brick_Plain_1';door='DoorFrame_Trim'
    elif style=='steel':panel='Metal_FullWindow';blank='Metal_Plain_3';parapet='Metal_Plain_1';door='DoorFrame_Metal_Single'
    else:panel='Brick_Window_Trim_Single';blank='Brick_Plain_3';parapet='Brick_Plain_1';door='DoorFrame_Wooden'
    def facade(length,x,z,yaw):
        for floor in range(floors):
            for i in range(int(length/2)):
                at=-length/2+1+i*2;angle=math.radians(yaw)
                px=x+at*math.cos(angle);pz=z-at*math.sin(angle)
                selected=panel if floor>0 or i%3 else 'Metal_FirstFloor_Window'
                if floor==0 and abs(at)<1.1 and yaw==0:selected=door
                objects.append(part(selected,px,floor*3,pz,yaw))
                if selected==door:objects.append(part('Door_1',px,0,pz+.02,yaw))
        for i in range(int(length/2)):
            at=-length/2+1+i*2;angle=math.radians(yaw)
            objects.append(part(parapet,x+at*math.cos(angle),floors*3,z-at*math.sin(angle),yaw))
    facade(width,0,0,0);facade(width,0,-depth,180);facade(depth,-width/2,-depth/2,-90);facade(depth,width/2,-depth/2,90)
    for x in range(int(-width/2)+1,int(width/2),2):
        for z in range(1,int(depth),2):
            objects.append(part('Roof_2x2',x,floors*3+.2,-z))
            objects.append(part('Floor_2x2',x,0,-z))
    # Recessed opaque core gives the actual window apertures dark room depth.
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,depth/2,floors*1.5))
    core=bpy.context.object;core.scale=(width-.45,depth-.45,floors*3-.3)
    mat=bpy.data.materials.get('City interior depth') or bpy.data.materials.new('City interior depth');mat.diffuse_color=(.035,.05,.065,1);core.data.materials.append(mat);objects.append(core)
    objects.append(part('Prop_ACUnit',width*.23,floors*3,-depth*.65))
    if style!='steel':
        objects.append(part('Entrance_Concrete_2x2',0,0,.95))
    finish(name,join(objects),False,True,[-width/2,-depth,width/2,0])

building('citybrickshops',12,10,3,'brick')
building('citywarehouse',16,12,2,'brick')
building('citycreamoffice',12,12,4,'cream')
building('cityglassoffice',16,12,6,'steel')
building('cityterrace',8,10,3,'brick')
building('citysteelworks',18,14,3,'steel')

for o in bpy.context.scene.objects:o.select_set(o in finals)
bpy.ops.export_scene.gltf(filepath=str(WORK/'city.gltf'),export_format='GLTF_SEPARATE',use_selection=True,
    export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_texture_dir='textures')
(WORK/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
(WORK/'collision.json').write_text(json.dumps(collision,separators=(',',':'))+'\n')
