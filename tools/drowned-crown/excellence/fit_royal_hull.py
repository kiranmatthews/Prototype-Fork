"""Fit the textured hollow hull to the playable galleon and cut its routes."""
from pathlib import Path
import bpy,json,math,shutil,sys
import numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE));from clip_tunnel import clip_tunnel
source=ROOT/'.img2threejs/drowned-crown/excellence/prepared/galleon-hull.glb'
canonical=source.with_name('galleon-hull-unfitted.glb')
if not canonical.exists():shutil.copy2(source,canonical)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(canonical))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];near=[o for o in objects if not o.name.endswith('LOD1')]
for o in objects:
 if o not in near:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in near:o.select_set(True)
bpy.context.view_layer.objects.active=near[0];bpy.ops.object.join();high=bpy.context.object
world=high.matrix_world.copy();high.parent=None;high.matrix_world=world
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
high.rotation_mode='XYZ'
points=np.array([v.co[:] for v in high.data.vertices]);lo=points.min(0);hi=points.max(0);span=hi-lo
if span[0]>span[1]*1.15:
 high.rotation_euler.z=math.pi/2;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
 points=np.array([v.co[:] for v in high.data.vertices]);lo=points.min(0);hi=points.max(0);span=hi-lo
# A broad transom belongs at +Z (Blender -Y); the tapered bow is at -Z.
t=(points[:,1]-lo[1])/span[1]
end_widths=[float(np.quantile(np.abs(points[t<.15,0]-(lo[0]+hi[0])/2),.9)),float(np.quantile(np.abs(points[t>.85,0]-(lo[0]+hi[0])/2),.9))]
turned=end_widths[0]<end_widths[1]
if turned:
 high.rotation_euler.z=math.pi;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
 points=np.array([v.co[:] for v in high.data.vertices]);lo=points.min(0);hi=points.max(0);span=hi-lo
centre_x=(lo[0]+hi[0])/2;points[:,0]-=centre_x
# A smoothed sampled cross-section keeps relief between inner planks and
# carvings while fitting the wall around the existing supported deck widths.
nz,ny=48,16;grid=np.full((nz,ny),np.nan)
zt=np.clip((points[:,1]-lo[1])/span[1],0,1);yt=np.clip((points[:,2]-lo[2])/span[2],0,1)
zi=np.minimum(nz-1,(zt*nz).astype(int));yi=np.minimum(ny-1,(yt*ny).astype(int))
for z in range(nz):
 for y in range(ny):
  values=np.abs(points[(zi==z)&(yi==y),0])
  if len(values):grid[z,y]=np.quantile(values,.9)
known=np.argwhere(np.isfinite(grid))
for z,y in np.argwhere(~np.isfinite(grid)):
 nearest=known[np.argmin((known[:,0]-z)**2+(known[:,1]-y)**2*2)];grid[z,y]=grid[tuple(nearest)]
for iteration in range(3):
 old=grid.copy()
 for z in range(nz):
  for y in range(ny):grid[z,y]=np.mean(old[max(0,z-1):min(nz,z+2),max(0,y-1):min(ny,y+2)])
grid=np.maximum(grid,span[0]*.025)
top=np.array([np.quantile(yt[zi==z],.99) if np.any(zi==z) else 1 for z in range(nz)])
for iteration in range(3):top=np.convolve(np.pad(top,(1,1),mode='edge'),np.ones(3)/3,mode='valid')
def measured_width(t,h):
 z=np.clip(t*nz-.5,0,nz-1);y=np.clip(h*ny-.5,0,ny-1);za=int(z);ya=int(y);zb=min(nz-1,za+1);yb=min(ny-1,ya+1)
 return (grid[za,ya]*(1-y+ya)+grid[za,yb]*(y-ya))*(1-z+za)+(grid[zb,ya]*(1-y+ya)+grid[zb,yb]*(y-ya))*(z-za)
rings=[(-92,10.5),(-103,16),(-120,19),(-142,20),(-155,19),(-176,18),(-197,17),(-222,13),(-244,5),(-252,.15)]
def width_at(z):
 for (za,wa),(zb,wb) in zip(rings,rings[1:]):
  if za>=z>=zb:return wa+(wb-wa)*(z-za)/(zb-za)
 return rings[0][1] if z>rings[0][0] else .15
for i,v in enumerate(high.data.vertices):
 t,h=float(zt[i]),float(yt[i]);z=-92-160*t
 local_top=float(np.interp(t*nz-.5,np.arange(nz),top))
 rim=11.4+3.8*math.exp(-(t/.10)**2)+5*math.exp(-((t-1)/.05)**2)
 y=-14+h/max(.15,local_top)*(rim+14)
 profile=.5+.5*math.sqrt(max(0,min(1,(y+14)/25.4)))
 radius=width_at(z)*profile;fraction=float(np.clip(points[i,0]/measured_width(t,h),-1.085,1.085))
 v.co=(float(fraction*radius),-z,y)
high.data.update();high.name='Royal_hull_LOD0'
if '--measure-only' in sys.argv:
 probes=[]
 for z in [-181,-190,-201]:
  for x in [-8,0,8]:
   hit,p,n,i=high.ray_cast(Vector((x,-z,7.5)),Vector((0,0,-1)))
   probes.append({'x':x,'z':z,'floor':round(p.z,4) if hit else None,'normal':list(n) if hit else None})
 print(json.dumps({'uncutHoldFloor':probes}),flush=True);sys.exit(0)

# The generated inner deck lies about 6.6 m above the hold floor. Keep it
# as the hold ceiling; only the actual sloping hatches need openings.
remove=[]
if high.data.has_custom_normals:high.data.normals_split_custom_set([(0,0,0)]*len(high.data.loops))
high.data.update()
# Midship wreck break, then the boarding and both bow-hatch passages.
clip_tunnel(high,(0,155,0),(0,176,0),90,90,padding=0)
for a,b,w,h in [((-20,75,-4),(0,106,10),5.1,5.2),((-8,132,10),(-8,162,-2),5.2,5.2),((8,204,-2),(8,239,10),4.7,5.2),((8,237,10),(0,248,10),5.2,5),((-15,180,-1),(-15,209,-1),8,6)]:
 clip_tunnel(high,a,b,w,h)
# Broken plank ends vary locally while remaining inside the authored gap.
for v in high.data.vertices:
 if abs(v.co.y-155)<.015 or abs(v.co.y-176)<.015:v.co.y+=.7*math.sin(v.co.x*1.7+v.co.z*.8)
high.data.validate(clean_customdata=False);high.data.update()
low=high.copy();low.data=high.data.copy();low.name='Royal_hull_LOD1';bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low
mod=low.modifiers.new('Far hull','DECIMATE');mod.ratio=.28;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
for o in [high,low]:o.data.validate(clean_customdata=False);o.data.update();o.data.calc_loop_triangles()
points=np.array([v.co[:] for v in high.data.vertices]);lo=points.min(0);hi=points.max(0)
report={'sourceJob':'galleon-hull-textured','method':'Original atlas retained; measured hull sections fitted around supported decks; deep keel, open hold, jagged midship break, retained hold ceiling and five real passage cuts','turnedToMatchRoute':turned,'sourceEndWidths':end_widths,'removedInteriorFaces':len(remove),'newMeshyCredits':0,'size':[float(hi[0]-lo[0]),float(hi[2]-lo[2]),float(hi[1]-lo[1])],'position':[float((lo[0]+hi[0])/2),float(lo[2]),float(-(lo[1]+hi[1])/2)],'triangles':{'near':len(high.data.loop_triangles),'far':len(low.data.loop_triangles)}}
bpy.ops.export_scene.gltf(filepath=str(source),export_format='GLB',export_image_format='AUTO',export_yup=True,export_materials='EXPORT',export_animations=False)
(HERE/'fitted-royal-hull.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'src/drownedCrownRoyalHull.generated.ts').write_text('/** Fitted Meshy hull placement, measured from the actual vertices. */\nexport const DROWNED_ROYAL_HULL_POSITION='+json.dumps(report['position'])+' as const;\n')
print(json.dumps(report),flush=True)
