"""Fit actual Meshy surfaces to the unchanged moa rig; retain source UVs and detail.
Blender --background --python tools/moa-assets/prepare.py
"""
from pathlib import Path
import sys,json,hashlib,math,argparse
import bpy,bmesh
import numpy as np
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
sys.path.insert(0,str(HERE))
from bake_assets import load_surface,normalized_surface,compact_textures,render_views
from glb_rig import Glb
from clean_materials import clean_moa_materials
WORK=ROOT/'.img2threejs/moa';OUT=ROOT/'public/enemies'
FRAMES={k:np.array(v).reshape(4,4,order='F') for k,v in json.loads((HERE/'bind-frames.json').read_text()).items()}
NAMES=list(FRAMES);INDEX={n:i for i,n in enumerate(NAMES)}
REST=np.array([FRAMES[f'neck{i}'][:3,3] for i in range(8)])

def smooth(v):
    t=np.clip(v,0,1);return t*t*(3-2*t)

def sample_neck(t):
    index=np.minimum((t*7).astype(int),6);u=t*7-index
    center=REST[index]*(1-u[:,None])+REST[index+1]*u[:,None]
    normal=np.array([FRAMES[f'neck{i}'][:3,2]/np.linalg.norm(FRAMES[f'neck{i}'][:3,2]) for i in range(8)])
    radial=normal[index]*(1-u[:,None])+normal[index+1]*u[:,None]
    radial/=np.linalg.norm(radial,axis=1)[:,None]
    return center,radial,index,u

def fit(points,jaw=False):
    x,y,z=points.T;side=np.where(x<0,-1.,1.)
    body=points.copy();body[:,2]=z*.74+.17
    neck_t=np.clip((y-2.72)/1.30,0,1)
    center,radial,neck_index,neck_u=sample_neck(neck_t)
    source_z=np.interp(y,[2.72,2.97,3.20,3.42,3.64,3.84],[1.13,1.09,1.05,.85,.56,.62])
    neck=center+radial*(z-source_z)[:,None];neck[:,0]=x*1.2
    neck_weight=smooth((y-2.72)/.42)*np.maximum(smooth((z-.25)/.4),smooth((y-3.10)/.08))
    head_weight=np.maximum(smooth((y-3.65)/.20),((z>1.25)&(y>3.43)).astype(float))
    head=points.copy();head[:,0]=x*1.5;head[:,1]=y-.04+.12*(z-.64);head[:,2]=.96+(z-.64)*.52
    neck_weight*=1-head_weight
    leg_weight=(1-smooth((y-1.23)/.45))*smooth((z+.90)/.42)
    leg_weight*=1-head_weight-neck_weight
    leg=points.copy();leg[:,0]=(x-side*.43)*.76+side*.49
    leg[:,2]=z+np.interp(y,[0,.25,.6,1.15,1.6,1.95],[.1,.1,.22,.42,.22,0])
    body_weight=1-head_weight-neck_weight-leg_weight
    result=body*body_weight[:,None]+neck*neck_weight[:,None]+head*head_weight[:,None]+leg*leg_weight[:,None]
    w=np.zeros((len(points),len(NAMES)))
    if jaw:
        w[:,INDEX['jaw']]=1;return head,w
    rump=smooth((-z-.80)/.9)*body_weight*.8
    w[:,INDEX['torso']]=body_weight-rump;w[:,INDEX['rump']]=rump
    w[:,INDEX['head']]=head_weight
    # Very small brow follow retains the original squawk/anticipation expression.
    brow=head_weight*smooth((y-4.08)/.04)*(1-smooth((y-4.26)/.06))*smooth((z-.61)/.12)*(1-smooth((z-1.03)/.12))*.85
    w[:,INDEX['head']]-=brow
    for side_name,mask in [('Left',x<0),('Right',x>=0)]:
        w[mask,INDEX['brow'+side_name]]=brow[mask]
        foot=(1-smooth((y-.22)/.22))*leg_weight
        upper=smooth((y-.95)/.36)*leg_weight
        lower=leg_weight-foot-upper
        w[mask,INDEX['foot'+side_name]]=foot[mask]
        w[mask,INDEX['upper'+side_name]]=upper[mask]
        w[mask,INDEX['lower'+side_name]]=np.maximum(0,lower[mask])
    for i in range(len(points)):
        w[i,INDEX[f'neck{neck_index[i]}']]+=neck_weight[i]*(1-neck_u[i])
        w[i,INDEX[f'neck{neck_index[i]+1}']]+=neck_weight[i]*neck_u[i]
    w=np.maximum(0,w);w/=w.sum(axis=1)[:,None]
    return result,w

def game_points(obj):
    return np.array([[v.co.x,v.co.z,-v.co.y] for v in obj.data.vertices])

def shade(obj):
    for m in obj.data.materials:
        if not m or not m.use_nodes:continue
        s=m.node_tree.nodes.get('Principled BSDF')
        if s:s.inputs['Metallic'].default_value=0;s.inputs['Roughness'].default_value=.92

def export(objects,path,clean=False):
    for o in bpy.context.scene.objects:o.select_set(o in objects)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,
        export_apply=True,export_materials='EXPORT',export_animations=False,export_cameras=False,
        export_lights=False,export_image_format='AUTO' if clean else 'JPEG',export_jpeg_quality=90,export_extras=True,
        **({'export_vertex_color':'NONE'} if clean else {}))

def skin(path,weights_by_piece,colours_by_piece=None):
    g=Glb(path);doc=g.document;nodes=doc['nodes'];mesh_nodes=[i for i,n in enumerate(nodes) if 'mesh' in n]
    joints=[]
    for name in NAMES:
        joints.append(len(nodes));nodes.append({'name':'moa_'+name,'matrix':FRAMES[name].T.flatten().tolist()})
    inverses=np.array([np.linalg.inv(FRAMES[n]).T.flatten() for n in NAMES],dtype='<f4')
    doc['skins']=[{'name':'Original moa controls on Meshy surface','joints':joints,'inverseBindMatrices':g.add_accessor(inverses,5126,'MAT4')}]
    for ni in mesh_nodes:
        node=nodes[ni];node['skin']=0
        assert all(abs(x-y)<1e-6 for x,y in zip(node.get('matrix',np.eye(4).T.flatten()),np.eye(4).T.flatten()))
        lookup=weights_by_piece[node['name']]
        for prim in doc['meshes'][node['mesh']]['primitives']:
            points=g.read_accessor(prim['attributes']['POSITION'])
            material=doc['materials'][prim['material']]
            if colours_by_piece and material['name']=='Moa clean vertex colours':
                uv=g.read_accessor(prim['attributes']['TEXCOORD_0']);lookup_colours=colours_by_piece[node['name']];colours=[]
                for point,tex in zip(points,uv):
                    key=tuple(round(float(c),5) for c in [*point,*tex])
                    if key not in lookup_colours:
                        nearest=min(lookup_colours,key=lambda k:sum((k[j]-float([*point,*tex][j]))**2 for j in range(5)))
                        assert sum((nearest[j]-float([*point,*tex][j]))**2 for j in range(5))<1e-8
                        key=nearest
                    colours.append(lookup_colours[key])
                prim['attributes']['COLOR_0']=g.add_accessor(np.array(colours,dtype='<f4'),5126,'VEC4',34962)
            weights=[]
            for point in points:
                key=tuple(round(float(c),5) for c in point)
                if key not in lookup:
                    nearest=min(lookup,key=lambda k:sum((k[j]-float(point[j]))**2 for j in range(3)))
                    assert sum((nearest[j]-float(point[j]))**2 for j in range(3))<1e-8,(node['name'],key)
                    key=nearest
                weights.append(lookup[key])
            weights=np.array(weights);order=np.argsort(-weights,axis=1)[:,:4];strong=np.take_along_axis(weights,order,axis=1);strong/=strong.sum(axis=1)[:,None]
            prim['attributes']['JOINTS_0']=g.add_accessor(order.astype('<u2'),5123,'VEC4',34962)
            prim['attributes']['WEIGHTS_0']=g.add_accessor(strong.astype('<f4'),5126,'VEC4',34962)
    scene=doc['scenes'][doc.get('scene',0)];scene['nodes']+=joints
    doc['asset']['extras']={'provider':'Meshy','taskId':'01a11476-eb29-7375-b117-815016e9951f','sourceSha256':hashlib.sha256((WORK/'moa.glb').read_bytes()).hexdigest(),'animation':'Original moa control rig; custom anatomical surface fitting and skin weights'}
    g.save(path)

def moa():
    obj=normalized_surface(load_surface(WORK/'moa.glb'),{'maxSize':[100,4.4,100]})
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    # Anatomical mouth seam: split the generated lower bill so the real surface opens.
    for co,no in [((0,0,4.24),(0,-.24,1)),((0,-1.25,0),(0,-1,0)),((0,-1.90,0),(0,-1,0))]:
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=Vector(co),plane_no=Vector(no))
    bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()
    objects=[];weights_by_piece={};source_positions={};counts={}
    for is_jaw,name in [(False,'MoaMeshyBody'),(True,'MoaMeshyJaw')]:
        mesh=obj.data.copy();bm=bmesh.new();bm.from_mesh(mesh)
        discard=[]
        for f in bm.faces:
            c=f.calc_center_median();y,z=c.z,-c.y
            selected=1.25-1e-6<z<1.90+1e-6 and y>3.43 and y+.24*z<4.24+1e-6
            if selected!=is_jaw:discard.append(f)
        bmesh.ops.delete(bm,geom=discard,context='FACES')
        cap=bpy.data.materials.new(name+'MouthInterior');cap.use_nodes=True;cap.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.11,.025,.012,1);cap.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9;mesh.materials.append(cap)
        cut_edges=[e for e in bm.edges if e.is_boundary and all(v.co.z>3.4 and -v.co.y>1.24 for v in e.verts) and (all(abs(v.co.z-.24*v.co.y-4.24)<1e-5 for v in e.verts) or all(abs(-v.co.y-1.25)<1e-5 for v in e.verts) or all(abs(-v.co.y-1.90)<1e-5 for v in e.verts))]
        if cut_edges:
            filled=bmesh.ops.holes_fill(bm,edges=cut_edges,sides=0)
            for f in filled['faces']:f.material_index=len(mesh.materials)-1
        bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
        part=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(part)
        points=game_points(part);source_positions[name]=points.copy();fitted,w=fit(points,is_jaw)
        for vertex,p in zip(mesh.vertices,fitted):vertex.co=Vector((p[0],-p[2],p[1]))
        # Restoring geometric normals avoids old normals on the fitted anatomy.
        if mesh.has_custom_normals:
            try:mesh.normals_split_custom_set([(0,0,0)]*len(mesh.loops))
            except Exception:pass
        mesh.update();shade(part)
        weights_by_piece[name]={tuple(round(float(c),5) for c in p):weight for p,weight in zip(fitted,w)}
        mesh.calc_loop_triangles();counts[name]=len(mesh.loop_triangles);objects.append(part)
    bpy.data.objects.remove(obj,do_unlink=True)
    surface=clean_moa_materials(objects,source_positions,WORK/'refine')
    colours_by_piece={}
    for part in objects:
        part.data.validate(verbose=True)
        mesh=part.data;uv=mesh.uv_layers['MoaSourceUV'];colour=mesh.color_attributes['MoaPalette'];lookup={}
        for face in mesh.polygons:
            if mesh.materials[face.material_index].name!='Moa clean vertex colours':continue
            for li in face.loop_indices:
                v=mesh.vertices[mesh.loops[li].vertex_index].co;tex=uv.data[li].uv
                lookup[tuple(round(float(c),5) for c in (v.x,v.z,-v.y,tex.x,1-tex.y))]=tuple(colour.data[li].color)
        colours_by_piece[part.name]=lookup;mesh.calc_loop_triangles();counts[part.name]=len(mesh.loop_triangles)
    path=OUT/'moa-clean.glb';export(objects,path,clean=True);skin(path,weights_by_piece,colours_by_piece)
    print('MOA_PACKED',counts,'bytes',path.stat().st_size,flush=True)
    return {'file':'moa-clean.glb','surface':surface,'triangles':sum(counts.values()),'parts':counts,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'joints':NAMES}

def chicken():
    obj=normalized_surface(load_surface(WORK/'roast-chicken.glb'),{'maxSize':[1.5,.92,1.6]});obj.name='MoaRoastChicken';shade(obj);compact_textures(512)
    path=OUT/'moa-roast-chicken.glb';export([obj],path);obj.data.calc_loop_triangles()
    return {'file':path.name,'triangles':len(obj.data.loop_triangles),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

parser=argparse.ArgumentParser();parser.add_argument('--moa-only',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT.mkdir(exist_ok=True,parents=True)
previous=json.loads((HERE/'prepared.json').read_text()) if (HERE/'prepared.json').exists() else {}
report={'sourceReview':'Actual Meshy front/quarter/side/back/top inspected; original animation bind frames retained','moa':moa(),'chicken':previous['chicken'] if args.moa_only else chicken()}
(HERE/'prepared.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
