"""Clean, deformation-stable feather/neck/leg colours plus a repacked face atlas.
Only used by the living moa. Cooked-chicken materials are never touched.
"""
from pathlib import Path
import math
import bpy,bmesh
import numpy as np


def srgb_linear(c):
    c=np.asarray(c);return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)


def smooth(v):
    t=max(0,min(1,float(v)));return t*t*(3-2*t)


def clean_moa_materials(objects,source_positions,folder):
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=True)
    original=objects[0].data.materials[0]
    image=next(n.image for n in original.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
    pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels)
    pixels=pixels.reshape(image.size[1],image.size[0],4);h,w=pixels.shape[:2]
    def sample(uv):
        return pixels[min(h-1,max(0,round(float(uv[1])*(h-1)))),min(w-1,max(0,round(float(uv[0])*(w-1)))),:3]
    palette=bpy.data.materials.new('Moa clean vertex colours');palette.use_nodes=True
    bsdf=palette.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Roughness'].default_value=.94
    vc=palette.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='MoaPalette';palette.node_tree.links.new(vc.outputs['Color'],bsdf.inputs['Base Color'])
    proxies=[];vertex_faces=painted_faces=0
    for piece,obj in enumerate(objects):
        mesh=obj.data;points=source_positions[obj.name];uv=mesh.uv_layers[0]
        uv.name='MoaSourceUV'
        colours=mesh.color_attributes.new(name='MoaPalette',type='FLOAT_COLOR',domain='CORNER')
        for c in colours.data:c.color=(1,1,1,1)
        neighbours=[[] for _ in mesh.vertices]
        for edge in mesh.edges:
            a,b=edge.vertices;neighbours[a].append(b);neighbours[b].append(a)
        groups={};unseen=set(range(len(mesh.vertices)))
        while unseen:
            todo=[unseen.pop()];members=[]
            while todo:
                v=todo.pop();members.append(v)
                for n in neighbours[v]:
                    if n in unseen:unseen.remove(n);todo.append(n)
            p=points[members];meta=(p.mean(axis=0),p[:,1].min(),p[:,1].max(),len(members))
            for v in members:groups[v]=meta
        colour_index=len(mesh.materials);mesh.materials.append(palette)
        paint=[]
        for face in mesh.polygons:
            if face.material_index!=0:continue # authored dark mouth interiors
            c=points[list(face.vertices)].mean(axis=0)
            is_face=(c[1]>3.70 and (c[2]>.25 or c[1]>4.0)) or (c[2]>1.22 and c[1]>3.43)
            if is_face:paint.append(face.index);painted_faces+=1;continue
            face.material_index=colour_index;vertex_faces+=1
            for li in face.loop_indices:
                vi=mesh.loops[li].vertex_index;x,y,z=points[vi];center,lo,hi,count=groups[vi]
                src=sample(uv.data[li].uv)
                if y<1.55 and z>-.7:
                    claw=y<.23 and (z>.34 or abs(x)>.77 or z<-.34) and max(src)<.32
                    colour=np.array([.19,.125,.075]) if claw else np.array([.82,.47,.16])*(.96+.045*smooth(y/1.5))
                elif y>2.78 and (z>.3 or y>3.14):
                    center_z=np.interp(y,[2.72,2.97,3.20,3.42,3.64,3.84],[1.13,1.09,1.05,.85,.56,.62])
                    front=smooth((z-center_z+.17)/.34)
                    colour=np.array([.61,.35,.13])*(1-front)+np.array([.91,.67,.34])*front
                    # Match the painted face at the neck join, with no hard material seam.
                    blend=smooth((y-3.48)/.23);colour=colour*(1-blend)+src*blend
                else:
                    chest=smooth((z-.1)/.7) if count>200 else smooth((center[2]-.15)/.65)
                    base=np.array([.43,.215,.10])*(1-chest)+np.array([.73,.435,.17])*chest
                    tip=np.array([.69,.39,.17])*(1-chest)+np.array([.91,.665,.31])*chest
                    variation=1 if count>200 else [.91,1.,1.07][int(abs(math.sin(float(center@np.array([37,19,53]))))*997)%3]
                    t=smooth((hi-y)/max(.08,hi-lo))*.48 if count<200 else .12
                    colour=(base*(1-t)+tip*t)*variation
                colours.data[li].color=(*srgb_linear(np.clip(colour,0,1)),1)
        values=np.array([c.color[:] for c in colours.data]);print('PALETTE assigned',obj.name,values.min(axis=0),values.mean(axis=0),flush=True)
        mesh.color_attributes.active_color=colours
        ids=mesh.attributes.new('MoaOriginalLoop','INT','CORNER')
        for i,d in enumerate(ids.data):d.value=i
        tags=mesh.attributes.new('MoaPiece','INT','FACE')
        for d in tags.data:d.value=piece
        proxy_mesh=mesh.copy();bm=bmesh.new();bm.from_mesh(proxy_mesh);bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.index not in set(paint)],context='FACES')
        bm.to_mesh(proxy_mesh);bm.free();proxy_mesh.update()
        proxy=bpy.data.objects.new('Face atlas source',proxy_mesh);bpy.context.scene.collection.objects.link(proxy);proxies.append(proxy)
    # Bake only the retained eye/brow/beak detail into a dense, padded atlas.
    for o in bpy.context.scene.objects:o.select_set(o in proxies)
    bpy.context.view_layer.objects.active=proxies[0];bpy.ops.object.join();proxy=bpy.context.object
    source_mat=bpy.data.materials.new('Moa face bake source');source_mat.use_nodes=True
    nodes=source_mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');emit=nodes.new('ShaderNodeEmission');tex=nodes.new('ShaderNodeTexImage');tex.image=image
    coord=nodes.new('ShaderNodeUVMap');coord.uv_map='MoaSourceUV';source_mat.node_tree.links.new(coord.outputs['UV'],tex.inputs['Vector']);source_mat.node_tree.links.new(tex.outputs['Color'],emit.inputs['Color']);source_mat.node_tree.links.new(emit.outputs['Emission'],out.inputs['Surface'])
    proxy.data.materials.clear();proxy.data.materials.append(source_mat)
    for f in proxy.data.polygons:f.material_index=0
    atlas_uv=proxy.data.uv_layers.new(name='MoaPaintUV')
    for a,b in zip(atlas_uv.data,proxy.data.uv_layers['MoaSourceUV'].data):a.uv=b.uv
    proxy.data.uv_layers.active=atlas_uv;atlas_uv.active_render=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.select_all(action='SELECT');bpy.ops.uv.pack_islands(rotate=False,margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
    atlas=bpy.data.images.new('Moa crisp face atlas',width=1024,height=1024,alpha=False);atlas.colorspace_settings.name='sRGB'
    target=nodes.new('ShaderNodeTexImage');target.image=atlas;nodes.active=target
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.margin=12
    bpy.ops.object.bake(type='EMIT')
    atlas.filepath_raw=str(folder/'face-atlas.png');atlas.file_format='PNG';atlas.save();atlas.pack()
    maps=[{} for _ in objects]
    ids=proxy.data.attributes['MoaOriginalLoop'];tags=proxy.data.attributes['MoaPiece']
    for f in proxy.data.polygons:
        piece=tags.data[f.index].value
        for li in f.loop_indices:maps[piece][ids.data[li].value]=proxy.data.uv_layers['MoaPaintUV'].data[li].uv.copy()
    paint_material=bpy.data.materials.new('Moa crisp painted face');paint_material.use_nodes=True
    nodes=paint_material.node_tree.nodes;shader=nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.94;shader.inputs['Metallic'].default_value=0
    tex=nodes.new('ShaderNodeTexImage');tex.image=atlas;tex.interpolation='Linear';coord=nodes.new('ShaderNodeUVMap');coord.uv_map='MoaPaintUV';paint_material.node_tree.links.new(coord.outputs['UV'],tex.inputs['Vector']);paint_material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    for piece,obj in enumerate(objects):
        layer=obj.data.uv_layers.new(name='MoaPaintUV')
        for li,uv in maps[piece].items():layer.data[li].uv=uv
        obj.data.uv_layers.active=layer;layer.active_render=True;obj.data.materials[0]=paint_material
        obj.data.attributes.remove(obj.data.attributes['MoaOriginalLoop']);obj.data.attributes.remove(obj.data.attributes['MoaPiece'])
    bpy.data.objects.remove(proxy,do_unlink=True)
    for obj in objects:
        values=np.array([c.color[:] for c in obj.data.color_attributes['MoaPalette'].data]);print('PALETTE final',obj.name,values.min(axis=0),values.mean(axis=0),flush=True)
    return {'vertexColourFaces':vertex_faces,'paintedFaces':painted_faces,'faceAtlasSize':1024,'atlasPaddingPixels':12,'sourceTextureSize':[w,h],'chickenChanged':False}
