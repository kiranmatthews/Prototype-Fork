"""Native, static plant sculpts from the five imagegen references.

Run with Blender --background --python tools/desert-canyon/build-desert-plants.py.
One shared vertex-painted material per GLB; no billboards or distance meshes.
The single views establish silhouette, palette and features, not hidden geometry.
"""
import bpy
import bmesh
import hashlib
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/desert-canyon/plants'
REVIEW = ROOT / 'docs/desert-canyon/plants'
OUT.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def rgb(h):
    a = [int(h[i:i+2], 16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in a)

SAGE, LIGHT, SHADE = map(rgb, ['#92966f', '#b3af83', '#6e785b'])
BARK, STRAW, DRY, IVORY = map(rgb, ['#886c54', '#b4a07a', '#897561', '#d5c7a3'])

def mix(a, b, t):
    t = max(0, min(1, t))
    return tuple(a[i]*(1-t)+b[i]*t for i in range(3))

class Sculpt:
    def __init__(self, name):
        self.name, self.vertices, self.faces, self.colors = name, [], [], []
    def vertex(self, p, c):
        self.vertices.append(tuple(p)); self.colors.append(tuple(c)); return len(self.vertices)-1
    def face(self, *ids):
        self.faces.append(ids)
    def finish(self):
        mesh=bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces); mesh.update()
        # Recalculate each connected closed surface outward before exporting.
        bm=bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh); bm.free()
        color=mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
        for i, c in enumerate(self.colors): color.data[i].color=(*c,1)
        mesh.color_attributes.active_color=color
        for p in mesh.polygons: p.use_smooth=True
        uv=mesh.uv_layers.new(name='UVMap')
        for p in mesh.polygons:
            for li in p.loop_indices:
                v=mesh.vertices[mesh.loops[li].vertex_index].co
                uv.data[li].uv=(v.x*.2, v.z*.2)
        mat=bpy.data.materials.new(self.name+' · muted hand-painted palette')
        mat.use_nodes=True
        bsdf=mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Roughness'].default_value=.87
        vc=mat.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name='Color'
        mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
        mesh.materials.append(mat)
        obj=bpy.data.objects.new(self.name,mesh); bpy.context.collection.objects.link(obj)
        return obj

def curve(points, t):
    # Catmull-Rom interpolation, with clamped endpoints.
    q=t*(len(points)-1); i=min(int(q),len(points)-2); u=q-i
    p0,p1,p2,p3=[Vector(points[max(0,min(len(points)-1,k))]) for k in (i-1,i,i+1,i+2)]
    return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u)

def sweep(s, points, radii, rows=18, sides=32, ribs=0, color=SAGE, cork=False, phase=0):
    rings=[]
    for j in range(rows+1):
        t=j/rows; center=curve(points,t)
        tangent=(curve(points,min(1,t+.002))-curve(points,max(0,t-.002))).normalized()
        ref=Vector((0,1,0))
        if abs(tangent.dot(ref))>.9: ref=Vector((1,0,0))
        right=tangent.cross(ref).normalized(); other=tangent.cross(right).normalized()
        q=t*(len(radii)-1); k=min(int(q),len(radii)-2)
        end_radius=radii[k] if ribs and k==len(radii)-2 else radii[k+1]
        radius=radii[k]*(1-q+k)+end_radius*(q-k)
        if ribs and t>.82:
            radius*=math.sqrt(max(.0001,1-((t-.82)/.18)**2))
        ring=[]
        for i in range(sides):
            a=2*math.pi*i/sides; rib=math.cos(a*ribs+phase) if ribs else 0
            r=radius*(1+.11*rib+.012*math.sin(a*3+t*7))
            p=center+r*(right*math.cos(a)+other*math.sin(a))
            shade=.5+.30*rib+.08*math.sin(a*5+t*8)
            c=mix(SHADE,LIGHT,shade) if ribs else mix(color,STRAW,.12+.12*math.sin(a*2+t*6))
            if cork:
                boundary=.18+.055*math.sin(a*3)+.025*math.sin(a*7)
                c=mix(c,BARK,max(0,min(1,(boundary-t)*12)))
            ring.append(s.vertex(p,c))
        rings.append(ring)
    for j in range(rows):
        for i in range(sides):
            k=(i+1)%sides; s.face(rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i])
    for ring, t in [(rings[0],0),(rings[-1],1)]:
        c=s.vertex(curve(points,t),BARK if cork and t==0 else color)
        for i in range(sides): s.face(c,ring[i],ring[(i+1)%sides])

def thorn(s, p, direction, size, curl=.3):
    p=Vector(p); d=Vector(direction).normalized()
    side=d.cross(Vector((0,0,1))).normalized()
    if side.length<.1: side=Vector((1,0,0))
    points=[p,p+d*size*.5,p+d*size+Vector((0,0,size*curl))]
    sweep(s,points,[size*.18,size*.105,.002],rows=2,sides=4,color=IVORY)

def thorn_rows(s, points, radii, rows, ribs=8, phase=.0):
    for j in range(rows):
        t=.20+.63*j/max(1,rows-1); c=curve(points,t)
        tangent=(curve(points,t+.002)-curve(points,t-.002)).normalized()
        right=tangent.cross(Vector((0,1,0))).normalized(); other=tangent.cross(right).normalized()
        q=t*(len(radii)-1); k=min(int(q),len(radii)-2); r=radii[k]*(1-q+k)+radii[k+1]*(q-k)
        for i in range(0,ribs,2):
            a=2*math.pi*(i+(j%2))/ribs+phase
            d=right*math.cos(a)+other*math.sin(a); p=c+d*r*1.1
            thorn(s,p,d+Vector((0,0,.18)),r*.29)

def ellipsoid(s, center, scale, tilt=0, ribs=0, rows=12, sides=32, seed=0, cork=False):
    c=Vector(center); rings=[]; rng=random.Random(seed)
    for j in range(rows+1):
        phi=math.pi*j/rows
        ring=[]
        for i in range(sides):
            a=i/sides*math.tau; rib=math.cos(a*ribs) if ribs else 0
            v=Vector((math.sin(phi)*math.cos(a)*scale[0]*(1+.1*rib),math.sin(phi)*math.sin(a)*scale[1]*(1+.1*rib),-math.cos(phi)*scale[2]))
            v=Vector((v.x*math.cos(tilt)+v.z*math.sin(tilt),v.y,-v.x*math.sin(tilt)+v.z*math.cos(tilt)))
            tone=.5+.22*rib+.07*math.sin(a*4+phi*7+seed)+rng.random()*.035
            col=mix(SHADE,LIGHT,tone)
            if cork: col=mix(col,BARK,max(0,(.26-j/rows)*3.4))
            ring.append(s.vertex(c+v,col))
        rings.append(ring)
    for j in range(rows):
        for i in range(sides):
            k=(i+1)%sides; s.face(rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i])

def blade(s, points, width=.16, color=STRAW, rows=12, twist=.0):
    # Closed diamond section gives each curled blade thickness and a lit central ridge.
    rings=[]
    for j in range(rows+1):
        t=j/rows; c=curve(points,t)
        direction=(curve(points,min(1,t+.002))-curve(points,max(0,t-.002))).normalized()
        side=Vector((math.cos(twist),math.sin(twist),.0))
        side=(side-direction*side.dot(direction)).normalized(); up=direction.cross(side).normalized()
        w=width*(.25+.85*math.sin(math.pi*t))*(1-t)**.45+.001
        thick=w*.15
        ring=[]
        for k, delta in enumerate([side*w,up*thick,-side*w,-up*thick]):
            col=mix(DRY,color,.38+.52*t+.08*(k%2))
            ring.append(s.vertex(c+delta,col))
        rings.append(ring)
    for j in range(rows):
        for i in range(4): s.face(rings[j][i],rings[j][(i+1)%4],rings[j+1][(i+1)%4],rings[j+1][i])
    s.face(*reversed(rings[0]));s.face(*rings[-1])

def seed_head(s, point, direction, size=.12):
    c=Vector(point); d=Vector(direction).normalized()
    right=d.cross(Vector((0,1,0))).normalized();other=d.cross(right).normalized()
    for i in range(6):
        a=i*2.4; side=right*math.cos(a)+other*math.sin(a)
        p=c+d*(i*size*.19);axis=(d+side*.65).normalized()
        sweep(s,[p,p+axis*size*.55,p+axis*size*1.25],
              [size*.08,size*.30,size*.37,size*.26,.001],rows=6,sides=6,color=STRAW)

def saguaro():
    s=Sculpt('saguaro')
    trunk=[(0,0,0),(.10,0,.65),(-.22,.02,1.8),(-.03,0,2.8),(.21,.03,4.1),(.08,.03,4.5)]
    radii=[.45,.40,.36,.40,.34,.015]
    sweep(s,trunk,radii,rows=25,sides=40,ribs=8,cork=True)
    thorn_rows(s,trunk,radii,7)
    arms=[([(0,0,1.1),(-.62,.04,1.23),(-1.18,.08,1.6),(-1.22,.08,2.25)], [.33,.28,.25,.015]),
          ([(0,0,2.2),(.72,.04,2.27),(1.26,.02,2.70),(1.24,.02,3.25)],[.33,.28,.25,.015]),
          ([(0,0,3.05),(-.65,.04,3.25),(-1.05,.04,3.75),(-.88,.02,4.8)],[.34,.30,.25,.015])]
    for ps,rs in arms:
        sweep(s,ps,rs,rows=15,sides=32,ribs=8);thorn_rows(s,ps,rs,3)
    return s

def prickly_pear():
    s=Sculpt('prickly-pear')
    pads=[((0,0,.53),(.49,.18,.58),.12), ((-.48,.05,1.1),(.39,.16,.52),-.44),
          ((.48,.02,1.25),(.43,.17,.58),.45),((-.97,.08,1.52),(.38,.14,.5),-.56),
          ((-.57,.12,2.02),(.31,.13,.48),.36),((.88,.06,1.96),(.44,.17,.53),.36),
          ((1.45,.1,2.15),(.32,.13,.48),.65),((.65,-.05,.68),(.33,.15,.4),.8)]
    for n,(c,r,tilt) in enumerate(pads):
        ellipsoid(s,c,r,tilt,rows=8,sides=16,seed=n,cork=n==0)
        for face in [-1,1]:
            for k in range(4):
                u=(k%2-.5)*r[0];v=(k//2-.5)*r[2]
                depth=face*r[1]*math.sqrt(max(0,1-(u/r[0])**2-(v/r[2])**2))*.97
                p=Vector(c)+Vector((u*math.cos(tilt)+v*math.sin(tilt),depth,-u*math.sin(tilt)+v*math.cos(tilt)))
                thorn(s,p,(0,face,.25),.07)
    for n in [3,5]:
        c,r,t=pads[n];seed_head(s,Vector(c)+Vector((math.sin(t)*r[2],0,math.cos(t)*r[2])),(0,0,1),.12)
    return s

def barrel():
    s=Sculpt('barrel-cactus')
    lobes=[((.18,.05,.82),(.64,.59,.85),.24),((-.54,-.12,.43),(.36,.34,.48),-.14),((.05,-.55,.25),(.29,.27,.31),-.1)]
    for n,(c,r,t) in enumerate(lobes):
        ellipsoid(s,c,r,t,ribs=8,rows=12,sides=32,seed=n,cork=True)
        for j in range(3):
            phi=.65+j*.64
            for i in range(5):
                a=i*math.tau/5+(j%2)*.32
                d=Vector((math.cos(a)*math.sin(phi),math.sin(a)*math.sin(phi),math.cos(phi)))
                rib=1+.1*math.cos(a*8)
                delta=Vector((d.x*r[0]*rib,d.y*r[1]*rib,d.z*r[2]))*.975
                delta=Vector((delta.x*math.cos(t)+delta.z*math.sin(t),delta.y,-delta.x*math.sin(t)+delta.z*math.cos(t)))
                direction=Vector((d.x*math.cos(t)+d.z*math.sin(t),d.y,-d.x*math.sin(t)+d.z*math.cos(t)))
                thorn(s,Vector(c)+delta,direction,.12 if n==0 else .07,.55)
        top=Vector(c)+Vector((math.sin(t)*r[2]*.96,0,math.cos(t)*r[2]*.96))
        for i in range(7):
            a=i*math.tau/7;v=Vector((math.cos(a),math.sin(a),0))
            blade(s,[top,top+v*.12+Vector((0,0,.18)),top+v*.30+Vector((0,0,.10))],width=.07 if n==0 else .045,rows=5,twist=a+math.pi/2)
    return s

def bunchgrass():
    s=Sculpt('dry-bunchgrass');rng=random.Random(4403)
    for i in range(25):
        a=i*2.39996;h=.32+rng.random()*.46;spread=.24+rng.random()*.35
        v=Vector((math.cos(a),math.sin(a),0));p=v*(rng.random()*.09)
        blade(s,[p,p+v*spread*.22+Vector((0,0,h*.66)),p+v*spread*.72+Vector((0,0,h)),p+v*spread+Vector((0,0,h*.7))],width=.035+rng.random()*.043,rows=12,twist=a+math.pi/2)
    for i in range(4):
        a=i*2.1;v=Vector((math.cos(a),math.sin(a),0));tip=v*.27+Vector((0,0,.92+i*.05))
        sweep(s,[(0,0,0),v*.08+Vector((0,0,.65)),tip],[.022,.016,.008],rows=7,sides=6,color=DRY)
        seed_head(s,tip,tip.normalized(),.09)
    return s

def sageweed():
    s=Sculpt('dry-sageweed');rng=random.Random(7201)
    for i in range(5):
        a=i*2.39996;v=Vector((math.cos(a),math.sin(a),0));h=.72+rng.random()*.6
        ps=[(0,0,0),v*.12+Vector((0,0,h*.3)),v*.35+Vector((0,0,h*.53)),v*.3+Vector((0,0,h*.74)),v*.58+Vector((0,0,h))]
        sweep(s,ps,[.10,.075,.055,.03,.012],rows=13,sides=7,color=DRY)
        seed_head(s,ps[-1],v*.35+Vector((0,0,1)),.14)
        for j in [1,2]:
            base=curve(ps,.25+j*.2);side=Vector((-v.y,v.x,.12))*(-1 if j==1 else 1)
            end=base+side*.25+Vector((0,0,.1))
            sweep(s,[base,end,end-side*.04+Vector((0,0,.12)),end-side*.12+Vector((0,0,.13))],[.025,.014,.009,.003],rows=7,sides=5,color=DRY)
            blade(s,[base,base+side*.23+Vector((0,0,.10)),base+side*.35+Vector((0,0,-.08))],width=.065,color=mix(STRAW,BARK,.2),rows=5,twist=a)
    return s

manifest=[]
for make in [saguaro,prickly_pear,barrel,bunchgrass,sageweed]:
    sculpt=make();obj=sculpt.finish()
    for other in bpy.context.scene.objects: other.select_set(False)
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    obj.data.calc_loop_triangles();tris=len(obj.data.loop_triangles)
    if tris>12000: raise RuntimeError(f'{sculpt.name}: {tris} exceeds the authored 12k ceiling')
    path=OUT/(sculpt.name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_yup=True,export_apply=True,export_normals=True,export_texcoords=True,
        export_materials='EXPORT')
    lo=[min(v.co[k] for v in obj.data.vertices) for k in range(3)]
    hi=[max(v.co[k] for v in obj.data.vertices) for k in range(3)]
    manifest.append({'id':sculpt.name,'file':path.name,'triangles':tris,'size':[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]],
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'reference':'../../../tools/desert-canyon/plant-references/'+sculpt.name+'.png'})
    obj.hide_render=True

keys=['canyonsaguaro','canyonpricklypear','canyonbarrel','canyondrygrass','canyondryweed']
catalog=['// Generated by tools/desert-canyon/build-desert-plants.py. Native geometry only.',
         'export const DESERT_PLANT_ASSETS={']
for key, asset in zip(keys,manifest):
    size=','.join(f'{n:.6f}' for n in asset['size'])
    catalog.append(f"  {key}:{{file:'../desert-canyon/plants/{asset['id']}',label:'Bryce · sculpted {asset['id']}',size:[{size}] as const,wind:false,normalStrength:0,doubleSided:false,cellSize:72}},")
catalog.append('} as const;')
(ROOT/'src/desertPlantCatalog.ts').write_text('\n'.join(catalog)+'\n')

# A four-angle review of every completed native mesh, under the same neutral rig.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100
scene.world.color=(.45,.45,.45)
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
for loc,power,size in [((4,-4,7),650,5),((-4,-2,4),350,5),((1,4,5),500,4)]:
    data=bpy.data.lights.new('Review softbox','AREA');data.energy=power;data.shape='DISK';data.size=size
    light=bpy.data.objects.new('Review softbox',data);scene.collection.objects.link(light);light.location=loc
    light.rotation_euler=(Vector((0,0,1.4))-light.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.lens=55
for asset in manifest:
    obj=bpy.data.objects[asset['id']];obj.hide_render=False
    h=asset['size'][1];width=max(asset['size'][0],asset['size'][2]);radius=max(width,h)*1.7
    target=Vector((0,0,h*.5));camdata.ortho_scale=max(h,width)*1.22
    for angle in [0,90,180,270]:
        a=math.radians(angle+12);cam.location=target+Vector((math.sin(a)*radius,-math.cos(a)*radius,radius*.24))
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(REVIEW/(asset['id']+f'-{angle}.png'))
        bpy.ops.render.render(write_still=True)
    obj.hide_render=True
(OUT/'manifest.json').write_text(json.dumps({'method':'Native Blender sculpts from imagegen references, with inferred rear surfaces','geometryPolicy':'Complete authored geometry at every view distance; no simplified variants','assets':manifest},indent=2)+'\n')
print(json.dumps(manifest))
