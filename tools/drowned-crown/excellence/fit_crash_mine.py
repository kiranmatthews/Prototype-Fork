"""Bend closed, original-UV rock masses around the authored mine paths.

The visible rocks are never Boolean-cut: their complete surfaces and atlas stay
intact. Fitted near surfaces stand outside the walkable corridor and stop at the
grotto junction, where separate closed masses leave the branch mouth open.
"""
from pathlib import Path
import bpy,bmesh,json,math,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
WORK=ROOT/'.img2threejs/drowned-crown/excellence'
sys.path.insert(0,str(HERE));from clip_tunnel import weld_for_lod
paths=json.loads((HERE/'mine-source.json').read_text())['paths']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(WORK/'prepared/crash-cavern-rock.glb'))
source=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.endswith('LOD0'))
for o in list(bpy.context.scene.objects):
    if o!=source:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.objects.active=source;source.select_set(True)
world=source.matrix_world.copy();source.parent=None;source.matrix_world=world
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# glTF duplicates UV seam vertices; join positions before recalculating face
# winding, otherwise disconnected texture islands can flip independently.
weld_for_lod(source)
raw=[Vector((v.co.x,v.co.z,-v.co.y)) for v in source.data.vertices]
lo=Vector([min(v[i] for v in raw) for i in range(3)]);hi=Vector([max(v[i] for v in raw) for i in range(3)]);span=hi-lo
normalized=[Vector(((p.x-lo.x)/span.x,(p.y-lo.y)/span.y,(p.z-lo.z)/span.z)) for p in raw]
# The source is a stepped cliff: its low end would leave a window between
# the mine wall and roof. Fit each cross-section to the same upper envelope,
# retaining its surface relief, connected topology and original UV atlas.
profile=[]
for i in range(65):
    x=i/64;near=[p.y for p in normalized if abs(p.x-x)<.025]
    profile.append(max(near) if near else min(normalized,key=lambda p:abs(p.x-x)).y)
def height_at(x):
    q=min(63.999,max(0,x*64));i=int(q);return profile[i]*(1-(q-i))+profile[i+1]*(q-i)
normalized=[Vector((p.x,min(1,p.y/max(.08,height_at(p.x))),p.z)) for p in normalized]
pieces=[];piece_specs=[]
class Route:
    def __init__(self,points,width,height):
        self.points=[Vector(p) for p in points];self.dist=[0]
        self.width=width;self.height=height
        for a,b in zip(self.points,self.points[1:]):self.dist.append(self.dist[-1]+math.hypot(b.x-a.x,b.z-a.z))
    def point(self,s):
        for i in range(len(self.dist)-1):
            if s<=self.dist[i+1] or i==len(self.dist)-2:
                t=(s-self.dist[i])/(self.dist[i+1]-self.dist[i]);return self.points[i].lerp(self.points[i+1],t)
    def sample(self,s):
        # A short moving average rounds authored corners without changing the
        # corridor's endpoints or squeezing its existing playable width.
        p=sum((self.point(s+k) for k in [-2,-1,0,1,2]),Vector())/5
        d=self.point(s+2.5)-self.point(s-2.5);d.y=0;d.normalize()
        return p,Vector((-d.z,0,d.x))
main=Route([paths[0]['a']]+[p['b'] for p in paths[:5]],13,13)
branch=Route([[-44,-5.4,-38.72],[-58,-4,-40],[-58,-4,-54]],16,15)
def piece(route,start,end,side=0,roof=False,mirror=False):
    o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);o.name='Mine_closed_rock_'+str(len(pieces))
    for vertex,p in zip(o.data.vertices,normalized):
        along=(1-p.x if mirror else p.x) if not roof else p.y
        center,right=route.sample(start+(end-start)*along)
        if roof:
            across=(p.x-.5)*(route.width+17)
            v=center+right*across;v.y=center.y+10+(1-p.z)*8
        else:
            clearance=route.width/2+.45
            # The branch widens smoothly into the grotto; its approach keeps
            # the existing nine-metre entrance readable.
            if route is branch:clearance=4.95+3.5*min(1,max(0,(start+(end-start)*along-5)/8))
            radial=clearance+(1-p.z)*4.2
            v=center+right*(side*radial);v.y=-16+p.y*(center.y+route.height+3+16)
        vertex.co=(v.x,-v.z,v.y)
    if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update()
    pieces.append(o);piece_specs.append({'route':'main' if route is main else 'grotto','start':start,'end':end,'side':side,'roof':roof})
# Every facade is a complete sculpted mass. Their rounded ends overlap, and
# the left facade ends before the optional branch instead of being sliced.
for start,end in [(10,60),(48,98),(86,main.dist[-1]+2)]:piece(main,start,end,1,mirror=start==48)
for start,end in [(10,56),(44,88),(76,108)]:piece(main,start,end,-1,mirror=start!=44)
for start,end in [(10,52),(42,84),(74,116),(106,main.dist[-1]+2)]:piece(main,start,end,roof=True,mirror=start==42)
piece(branch,0,branch.dist[-1],-1,mirror=True)
piece(branch,0,branch.dist[-1],roof=True)
bpy.data.objects.remove(source,do_unlink=True);bpy.ops.object.select_all(action='DESELECT')
for o in pieces:o.select_set(True)
bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();high=bpy.context.object;high.name='Crash_mine_LOD0'
weld_for_lod(high);high.data.calc_loop_triangles();before=len(high.data.loop_triangles)
if before>110000:
    mod=high.modifiers.new('Mine silhouette budget','DECIMATE');mod.ratio=110000/before;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
high.data.calc_loop_triangles();low=high.copy();low.data=high.data.copy();low.name='Crash_mine_LOD1';bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low
mod=low.modifiers.new('Far mine','DECIMATE');mod.ratio=.25;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name);low.data.calc_loop_triangles()
for o in [high,low]:
    bm=bmesh.new();bm.from_mesh(o.data);assert not any(e.is_boundary for e in bm.edges),'Open rock edges';bm.free()
points=[v.co for v in high.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
size=[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y];position=[(lo.x+hi.x)/2,lo.z,-(lo.y+hi.y)/2]
report={'source':'crash-cavern-rock','method':'Whole closed rocks bent along authored paths; no face cutting or tiled textures','originalUVsPreserved':True,'newProviderCredits':0,'pieces':piece_specs,'sourceTriangles':before,'triangles':{'near':len(high.data.loop_triangles),'far':len(low.data.loop_triangles)},'closedAtBothLODs':True,'size':size,'position':position}
bpy.ops.export_scene.gltf(filepath=str(WORK/'prepared/crash-mine-shell.glb'),export_format='GLB',export_texcoords=True,export_normals=True,export_materials='EXPORT',export_animations=False)
(HERE/'fitted-crash-mine.json').write_text(json.dumps(report,indent=2)+'\n')
p=HERE/'assets.json';spec=json.loads(p.read_text());spec['crash-mine-shell']={'size':size,'image':False,'derived':True,'sourceTaskId':'01a13a9d-405c-75c3-8c18-0aa6e63eed72','kind':'crowncrashmineshell','triangles':report['triangles']['near'],'textureMax':4096,'lodRange':[200,260],'doubleSided':False};p.write_text(json.dumps(spec,indent=2)+'\n')
(ROOT/'src/drownedCrownMine.generated.ts').write_text('/** Closed painted rocks bent around the mine and grotto routes. */\nexport const DROWNED_MINE_POSITION='+json.dumps(position)+' as const;\n')
print(json.dumps(report),flush=True)
