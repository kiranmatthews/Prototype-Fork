"""Blender static-kit preparation: retain source UVs/materials, add real LODs.
Run Blender --background --python-exit-code 1 --python this_file -- [names].
"""
from pathlib import Path
import bpy
import bmesh
import json
import math
import sys
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
WORK=ROOT/'.img2threejs/hollowwake'
SPECS=json.loads((HERE/'assets.json').read_text())
names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if not names:names=[n for n,s in SPECS.items() if not s.get('rejected')]
(WORK/'prepared').mkdir(parents=True,exist_ok=True)
report={}
for name in names:
 source=WORK/'meshy'/name/'downloads/model.glb'
 if not source.is_file():print('PENDING '+name,flush=True);continue
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(source))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 if not objects:raise RuntimeError('No geometry: '+name)
 materials={m for o in objects for m in o.data.materials if m}
 if len(materials)!=1:raise RuntimeError('One shared atlas material required: '+name)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.object.join();high=bpy.context.object
 # Strip inherited import parents while preserving each object's world pose.
 world=high.matrix_world.copy();high.parent=None;high.matrix_world=world
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 # GLB UV seams duplicate vertices. Decimating that disconnected import
 # deletes individual wedges instead of simplifying a continuous surface.
 # Weld positions in Blender while retaining per-corner UVs before reduction.
 bm=bmesh.new();bm.from_mesh(high.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
 # Discard detached moss flecks before reduction. Otherwise thousands of
 # microscopic islands consume the triangle budget and the mushroom caps
 # collapse to spikes. Keep the connected rock, stems and full caps.
 if name=='glow-fungus':
  seen=set();islands=[]
  for v in bm.verts:
   if v in seen:continue
   stack=[v];seen.add(v);island=[]
   while stack:
    q=stack.pop();island.append(q)
    for e in q.link_edges:
     n=e.other_vert(q)
     if n not in seen:seen.add(n);stack.append(n)
   islands.append(island)
  extent=max(high.dimensions)
  discard=[]
  for island in islands:
   span=Vector(tuple(max(v.co[a] for v in island)-min(v.co[a] for v in island) for a in range(3))).length
   if span<extent*.045:discard.extend(island)
  bmesh.ops.delete(bm,geom=discard,context='VERTS')
  print('Removed detached micro-moss vertices',len(discard),'from',len(islands),'islands',flush=True)
 bm.to_mesh(high.data);bm.free();high.data.update()
 # Long boats and gun barrels follow local Z in the runtime (Blender Y).
 logical=SPECS[name].get('replaces',name)
 if logical in ['cargo-lighter','naval-cannon','galleon-hull'] and high.dimensions.x>high.dimensions.y*1.15:
  high.rotation_mode='XYZ';high.rotation_euler.z=math.pi/2;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
 high.data.calc_loop_triangles();source_triangles=len(high.data.loop_triangles)
 target_triangles=SPECS[name].get('targetTriangles',source_triangles)
 if source_triangles>target_triangles:
  dec=high.modifiers.new('Game silhouette budget','DECIMATE');dec.ratio=target_triangles/source_triangles;dec.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=dec.name)
 high.name=name+'_LOD0';high.data.name=high.name
 for obj in list(bpy.context.scene.objects):
  if obj!=high:bpy.data.objects.remove(obj,do_unlink=True)
 low=high.copy();low.data=high.data.copy();low.name=name+'_LOD1';bpy.context.collection.objects.link(low)
 bpy.context.view_layer.objects.active=low
 mod=low.modifiers.new('Measured far geometry','DECIMATE');mod.ratio=.28;mod.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=mod.name)
 high.data.calc_loop_triangles();low.data.calc_loop_triangles()
 if len(high.data.loop_triangles)<50:raise RuntimeError('Empty model: '+name)
 for obj in [high,low]:
  if any(not math.isfinite(v) for vertex in obj.data.vertices for v in vertex.co):raise RuntimeError('Non-finite geometry: '+name)
 target=WORK/'prepared'/(name+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_image_format='AUTO',
  export_texcoords=True,export_normals=True,export_yup=True,export_materials='EXPORT',export_animations=False)
 report[name]={'highTriangles':len(high.data.loop_triangles),'lowTriangles':len(low.data.loop_triangles),
  'materials':len(materials),'sourceTriangles':source_triangles,'sourceUVsPreserved':True,'lodRatio':.28}
 print(json.dumps({'prepared':name,**report[name]}),flush=True)
(WORK/'prepared/geometry-audit.json').write_text(json.dumps(report,indent=2)+'\n')
