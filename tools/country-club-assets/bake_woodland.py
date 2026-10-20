"""Render local Country Club tree assets as transparent horizon strips.
Run with Blender --background --python tools/country-club-assets/bake_woodland.py.
PNG intermediates stay in /private/tmp; no external service is used.
"""
import bpy, hashlib, json, math, random
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd()
OUT=Path('/private/tmp/country-club-woodland');OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=1536;s.render.resolution_y=384;s.render.resolution_percentage=100
s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
s.view_settings.view_transform='Standard';s.view_settings.look='None'
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.68,.8,.94,1)
s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
light=bpy.data.lights.new('Country Club sun','SUN');light.energy=2;light.angle=math.radians(12)
sun=bpy.data.objects.new(light.name,light);s.collection.objects.link(sun)
sun.rotation_euler=(math.radians(28),math.radians(-32),math.radians(-25))
cd=bpy.data.cameras.new('Woodland bake');cam=bpy.data.objects.new(cd.name,cd);s.collection.objects.link(cam);s.camera=cam
cd.type='ORTHO';cd.ortho_scale=144;cam.location=(0,-200,18)
cam.rotation_euler=(Vector((0,0,18))-cam.location).to_track_quat('-Z','Y').to_euler()
sources={}
for name,width in [('oak',18),('umbrella-pine',17)]:
    before=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/country-club-art'/(name+'.glb')))
    imported=set(s.objects)-before;high=next(o for o in imported if o.type=='MESH' and o.name.endswith('LOD0'))
    bpy.context.view_layer.update();points=[high.matrix_world@v.co for v in high.data.vertices]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    mesh=high.data.copy();center=Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z));factor=width/(hi.x-lo.x)
    for v,p in zip(mesh.vertices,points):v.co=(p-center)*factor
    sources[name]=mesh
    for o in imported:bpy.data.objects.remove(o,do_unlink=True)
report={'generator':'Local Blender render of existing project tree assets','size':[144,36,.02],'resolution':[1536,384],'variants':[],
        'sources':{n:hashlib.sha256((ROOT/'public/country-club-art'/(n+'.glb')).read_bytes()).hexdigest() for n in sources}}
for variant in range(3):
    seed=8217+variant*991;r=random.Random(seed);trees=[]
    for row,count in [(0,11),(1,10)]:
        for i in range(count):
            name='umbrella-pine' if (i+row+variant)%(3+variant)==0 else 'oak'
            o=bpy.data.objects.new(f'{name}-{row}-{i}',sources[name]);s.collection.objects.link(o)
            o.location=(-58+i*116/(count-1)+r.uniform(-1.8,1.8),8-row*16,r.uniform(-.8,1.1))
            scale=r.uniform(1.15,1.85)*(1 if 0<i<count-1 else .75);o.scale=(scale,)*3;o.rotation_euler.z=r.uniform(0,math.tau);trees.append(o)
    stem=f'woodland-{chr(97+variant)}-alpha';s.render.filepath=str(OUT/(stem+'.png'));bpy.ops.render.render(write_still=True)
    report['variants'].append({'file':stem+'.webp','sourceTrees':len(trees),'seed':seed})
    for o in trees:bpy.data.objects.remove(o,do_unlink=True)
(OUT/'bake.json').write_text(json.dumps(report,indent=2)+'\n');print('WOODLAND_BAKE_COMPLETE',OUT)
