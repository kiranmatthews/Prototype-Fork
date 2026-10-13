"""Subtract convex tunnel volumes while retaining source UVs and normals.
Triangle clipping cannot invent caps or vertices outside a non-manifold scan.
"""
import bpy,math
from mathutils import Vector

def clip_tunnel(obj,a,b,width,height,padding=10):
 a,b=Vector(a),Vector(b);direction=(b-a).normalized();length=(b-a).length
 right=Vector((0,0,1)).cross(direction).normalized();up=direction.cross(right).normalized()
 planes=[(direction,-direction.dot(a)+padding),(-direction,direction.dot(a)+length+padding)]
 for k in range(32):
  angle=2*math.pi*k/32;n=-right*(math.cos(angle)/width)-up*(math.sin(angle)/height)
  planes.append((n,1-n.dot(a)))
 mesh=obj.data;mesh.calc_loop_triangles();uv=mesh.uv_layers.active.data
 output=[]
 def distance(p,plane):return Vector(p[:3]).dot(plane[0])+plane[1]
 for tri in mesh.loop_triangles:
  polygon=[]
  for vi,li in zip(tri.vertices,tri.loops):polygon.append(tuple(mesh.vertices[vi].co)+tuple(uv[li].uv)+tuple(mesh.corner_normals[li].vector))
  if any(all(distance(p,q)<-1e-6 for p in polygon) for q in planes):output.append(polygon);continue
  remaining=polygon
  for q in planes:
   inside=[];outside=[]
   for i,p in enumerate(remaining):
    t=remaining[(i+1)%len(remaining)];dp=distance(p,q);dt=distance(t,q)
    (inside if dp>=0 else outside).append(p)
    if (dp>=0)!=(dt>=0):
     f=dp/(dp-dt);hit=tuple(v+(t[j]-v)*f for j,v in enumerate(p));inside.append(hit);outside.append(hit)
   if len(outside)>=3:output.append(outside)
   remaining=inside
   if not remaining:break
 vertices=[];faces=[];uvs=[];normals=[];lookup={}
 for poly in output:
  for i in range(1,len(poly)-1):
   tri=[poly[0],poly[i],poly[i+1]]
   if (Vector(tri[1][:3])-Vector(tri[0][:3])).cross(Vector(tri[2][:3])-Vector(tri[0][:3])).length<1e-8:continue
   ids=[]
   for p in tri:
    key=tuple(round(v,6) for v in p)
    if key not in lookup:lookup[key]=len(vertices);vertices.append(p[:3])
    ids.append(lookup[key]);uvs.append(p[3:5]);normals.append(Vector(p[5:8]).normalized())
   faces.append(ids)
 result=bpy.data.meshes.new(mesh.name+' clipped');result.from_pydata(vertices,[],faces);result.update()
 for mat in mesh.materials:result.materials.append(mat)
 layer=result.uv_layers.new(name='UVMap')
 for i,coords in enumerate(uvs):layer.data[i].uv=coords
 for poly in result.polygons:poly.use_smooth=True
 result.normals_split_custom_set(normals);obj.data=result;bpy.data.meshes.remove(mesh)
