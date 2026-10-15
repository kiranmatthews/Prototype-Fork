#!/usr/bin/env python3
"""Fit original Meshy meshes to metres, preserving surfaces, UVs and PBR maps."""
from pathlib import Path
import copy,hashlib,json,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures,matrices,world_vertices
SPECS=json.loads((HERE/'assets.json').read_text())

def pack(name):
 source=ROOT/'.img2threejs/warehouse-art'/name/'downloads/model.glb'
 g=Glb(source);doc=g.document;original=copy.deepcopy(doc);binary=bytes(g.binary)
 if doc.get('skins') or doc.get('animations'):raise ValueError('Static packer cannot flatten a character')
 world=matrices(doc);positions=world_vertices(g);lo,hi=positions.min(0),positions.max(0)
 origin=(lo+hi)/2;origin[1]=lo[1];span=hi-lo
 axis=int(np.argmax(SPECS[name]['dimensions']));scale=SPECS[name]['dimensions'][axis]/span[axis]
 parts=[];triangles=0
 for node_id,matrix in world.items():
  node=original['nodes'][node_id]
  if 'mesh' not in node:continue
  for p in original['meshes'][node['mesh']]['primitives']:
   attrs={k:g.read_accessor(i).copy() for k,i in p['attributes'].items()}
   attrs['POSITION']=(((np.c_[attrs['POSITION'],np.ones(len(attrs['POSITION']))]@matrix.T)[:,:3]-origin)*scale).astype('<f4')
   if 'NORMAL' in attrs:
    n=attrs['NORMAL']@np.linalg.inv(matrix[:3,:3]);attrs['NORMAL']=(n/np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-10)).astype('<f4')
   indices=g.read_accessor(p['indices']).ravel().astype('<u4') if 'indices' in p else np.arange(len(attrs['POSITION']),dtype='<u4')
   triangles+=len(indices)//3;parts.append((attrs,indices,p.get('material',0)))
 doc['accessors']=[];doc['bufferViews']=[];doc['nodes']=[];doc['meshes']=[];g.binary=bytearray()
 for image in doc.get('images',[]):
  view=original['bufferViews'][image['bufferView']];start=view.get('byteOffset',0);chunk=binary[start:start+view['byteLength']]
  while len(g.binary)%4:g.binary.append(0)
  image['bufferView']=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(g.binary),'byteLength':len(chunk)});g.binary.extend(chunk)
 primitives=[]
 for attrs,indices,material in parts:
  a={}
  for key,value in attrs.items():
   kind={2:'VEC2',3:'VEC3',4:'VEC4'}[value.shape[1]];index=g.add_accessor(value.astype('<f4'),5126,kind,34962);a[key]=index
   if key=='POSITION':doc['accessors'][index]['min']=value.min(0).tolist();doc['accessors'][index]['max']=value.max(0).tolist()
  i=g.add_accessor(indices.reshape(-1,1),5125,'SCALAR',34963);primitives.append({'attributes':a,'indices':i,'material':material})
 doc['meshes']=[{'name':name,'primitives':primitives}];doc['nodes']=[{'name':name,'mesh':0}];doc['scenes']=[{'nodes':[0]}];doc['scene']=0
 textures=compact_textures(g,1024,90,data_limit=512,lossless_data=False)
 task=json.loads((HERE/'tasks.json').read_text())['tasks'][name]
 doc['asset']={'version':'2.0','generator':'Meshy T2; warehouse metre fitting and PBR packing','extras':{'provider':'Meshy','taskId':task['id'],'originalUVsPreserved':True}}
 output=ROOT/'public/warehouse'/f'{name}.glb';output.parent.mkdir(parents=True,exist_ok=True);g.save(output)
 report={'taskId':task['id'],'provider':'Meshy','model':'meshy-t2','triangles':triangles,'bytes':output.stat().st_size,
  'size':(span*scale).tolist(),'originalUVsPreserved':True,'textures':textures,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'axes':'Y up, base Y zero, centered XZ, metres','scale':float(scale)}
 output.with_suffix('.provenance.json').write_text(json.dumps(report,indent=2)+'\n');return report

if __name__=='__main__':
 path=HERE/'asset-manifest.json';manifest=json.loads(path.read_text()) if path.exists() else {}
 for name in sys.argv[1:] or list(SPECS):
  if not (ROOT/'.img2threejs/warehouse-art'/name/'downloads/model.glb').exists():continue
  record=pack(name);manifest[name]=record;print(name,record['triangles'],record['bytes'],record['size'],flush=True)
 path.write_text(json.dumps(manifest,indent=2)+'\n')
