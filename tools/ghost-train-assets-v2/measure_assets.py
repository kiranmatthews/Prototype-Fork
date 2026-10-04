#!/usr/bin/env python3
"""Functional planes and actual Meshy UV-to-planar material extraction."""
from pathlib import Path
import copy,hashlib,io,json,sys,shutil
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb

def surface(name,path=None):
 g=Glb(path or ROOT/'public/ghost-train'/(name+'.glb'));parts=[]
 for m in g.document['meshes']:
  for p in m['primitives']:
   ix=g.read_accessor(p['indices']).ravel().astype(int).reshape(-1,3);pos=g.read_accessor(p['attributes']['POSITION']);tri=pos[ix]
   cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);area=np.linalg.norm(cross,axis=1)/2;normal=cross/np.maximum(area[:,None]*2,1e-12)
   uv=g.read_accessor(p['attributes']['TEXCOORD_0'])[ix] if 'TEXCOORD_0' in p['attributes'] else None
   parts.append((p,pos,ix,tri,tri.mean(1),normal,area,uv))
 return g,parts

def plane(parts,axis=1,sign=1,highest=False):
 groups={}
 for _,_,_,tri,centres,normals,areas,_ in parts:
  for i in np.where(normals[:,axis]*sign>.88)[0]:
   key=round(float(centres[i,axis]),3);groups.setdefault(key,[]).append((tri[i],areas[i]))
 choices=[(key,sum(area for _,area in values),values) for key,values in groups.items()]
 if not choices:return None
 choice=max((c for c in choices if c[1]>.0015),key=lambda c:c[0]) if highest and any(c[1]>.0015 for c in choices) else max(choices,key=lambda c:c[1])
 verts=np.concatenate([tri for tri,_ in choice[2]])
 return {'y' if axis==1 else 'z':choice[0],'area':float(choice[1]),'min':verts.min(0).tolist(),'max':verts.max(0).tolist()}

def triangles_mask(parts,resolution=512):
 occupancy=np.zeros((resolution,resolution),dtype=bool)
 for _,_,_,tri,_,_,_,_ in parts:
  for t in tri:
   q=np.c_[(t[:,0]+.5)*(resolution-1),t[:,1]*(resolution-1)]
   xmin,xmax=max(0,int(np.floor(q[:,0].min()))),min(resolution-1,int(np.ceil(q[:,0].max())));ymin,ymax=max(0,int(np.floor(q[:,1].min()))),min(resolution-1,int(np.ceil(q[:,1].max())))
   x,y=np.meshgrid(np.arange(xmin,xmax+1),np.arange(ymin,ymax+1));den=(q[1,1]-q[2,1])*(q[0,0]-q[2,0])+(q[2,0]-q[1,0])*(q[0,1]-q[2,1])
   if abs(den)<1e-8:continue
   a=((q[1,1]-q[2,1])*(x-q[2,0])+(q[2,0]-q[1,0])*(y-q[2,1]))/den;b=((q[2,1]-q[0,1])*(x-q[2,0])+(q[0,0]-q[2,0])*(y-q[2,1]))/den
   occupancy[ymin:ymax+1,xmin:xmax+1]|=(a>=0)&(b>=0)&(a+b<=1)
 centre=resolution//2;rows=[]
 for row in range(resolution):
  if occupancy[row,centre]:rows.append(None);continue
  left=centre;right=centre
  while left>0 and not occupancy[row,left-1]:left-=1
  while right<resolution-1 and not occupancy[row,right+1]:right+=1
  rows.append((left/(resolution-1)-.5,right/(resolution-1)-.5))
 intervals=[];start=None
 for row,value in enumerate(rows+[None]):
  if value is not None and start is None:start=row
  if value is None and start is not None:
   if row-start>10:intervals.append((start,row-1))
   start=None
 if not intervals:return {'opening':None,'reason':'No projected through-opening at model centre'}
 bottom,top=max(intervals,key=lambda interval:interval[1]-interval[0]);best=None
 for end in range(bottom+10,top+1):
  bounds=rows[bottom:end+1];left=max(v[0] for v in bounds);right=min(v[1] for v in bounds);height=(end-bottom)/(resolution-1);score=(right-left)*height
  if best is None or score>best[0]:best=(score,left,right,end)
 _,left,right,end=best
 Image.fromarray(np.flipud(np.where(occupancy,60,245).astype('uint8'))).save(HERE/'proof/portal-aperture.png')
 return {'opening':{'bottomY':bottom/(resolution-1),'topY':top/(resolution-1),'clearRect':{'leftX':left,'rightX':right,'width':right-left,'bottomY':bottom/(resolution-1),'topY':end/(resolution-1),'height':(end-bottom)/(resolution-1)}},
  'widthByY':[{'y':row/(resolution-1),'leftX':rows[row][0],'rightX':rows[row][1],'width':rows[row][1]-rows[row][0]} for row in range(bottom,top+1,20)]}

def project_texture(name,axis,sign,axes,filename,size=768,source_path=None):
 g,parts=surface(name,source_path);positions=np.concatenate([part[1] for part in parts]);low,high=positions.min(0),positions.max(0)
 depth=np.full((size,size),-np.inf);rgba=np.zeros((size,size,4),dtype='uint8');selected=[];uv_bounds=[]
 for p,_,_,tri,_,normal,_,uv in parts:
  material=g.document['materials'][p.get('material',0)]['pbrMetallicRoughness'];texture=g.document['textures'][material['baseColorTexture']['index']];im=g.document['images'][texture['source']];view=g.document['bufferViews'][im['bufferView']];offset=view.get('byteOffset',0)
  atlas=ROOT/'.img2threejs/ghost-train-v2/atlases'/f'{name}-atlas-{texture["source"]}.png'
  image=np.asarray(Image.open(atlas if source_path is None and atlas.exists() else io.BytesIO(bytes(g.binary[offset:offset+view['byteLength']]))).convert('RGBA'))
  for i in np.where(normal[:,axis]*sign>.10)[0]:
   t=tri[i];q=np.c_[(t[:,axes[0]]-low[axes[0]])/(high[axes[0]]-low[axes[0]])*(size-1),(t[:,axes[1]]-low[axes[1]])/(high[axes[1]]-low[axes[1]])*(size-1)]
   xmin,xmax=max(0,int(np.floor(q[:,0].min()))),min(size-1,int(np.ceil(q[:,0].max())));ymin,ymax=max(0,int(np.floor(q[:,1].min()))),min(size-1,int(np.ceil(q[:,1].max())))
   x,y=np.meshgrid(np.arange(xmin,xmax+1),np.arange(ymin,ymax+1));den=(q[1,1]-q[2,1])*(q[0,0]-q[2,0])+(q[2,0]-q[1,0])*(q[0,1]-q[2,1])
   if abs(den)<1e-8:continue
   a=((q[1,1]-q[2,1])*(x-q[2,0])+(q[2,0]-q[1,0])*(y-q[2,1]))/den;b=((q[2,1]-q[0,1])*(x-q[2,0])+(q[0,0]-q[2,0])*(y-q[2,1]))/den;c=1-a-b
   z=(a*t[0,axis]+b*t[1,axis]+c*t[2,axis])*sign;view_depth=depth[ymin:ymax+1,xmin:xmax+1];inside=(a>=0)&(b>=0)&(c>=0)&(z>view_depth)
   uv_sample=a[:,:,None]*uv[i,0]+b[:,:,None]*uv[i,1]+c[:,:,None]*uv[i,2]
   u=np.clip((uv_sample[:,:,0]*image.shape[1]).astype(int),0,image.shape[1]-1);v=np.clip((uv_sample[:,:,1]*image.shape[0]).astype(int),0,image.shape[0]-1)
   dest=rgba[ymin:ymax+1,xmin:xmax+1];dest[inside]=image[v,u][inside];view_depth[inside]=z[inside];selected.append(i);uv_bounds.append(uv[i])
 out=ROOT/'public/ghost-train'/filename;Image.fromarray(np.flipud(rgba)).save(out)
 return {'path':str(out.relative_to(ROOT)),'sourceModel':name,'operation':'Reproject actual Meshy albedo through original triangle UVs; no painted/replaced content',
  'axis':axis,'sign':sign,'projectionAxes':axes,'sampleBounds':{'min':low.tolist(),'max':high.tolist()},'coverage':float((rgba[:,:,3]>0).mean()),
  'uvBounds':{'min':np.concatenate(uv_bounds).min(0).tolist(),'max':np.concatenate(uv_bounds).max(0).tolist()},'size':[size,size],'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}

if __name__=='__main__':
 (HERE/'proof').mkdir(exist_ok=True);manifest=json.loads((HERE/'asset-manifest.json').read_text());measurements=json.loads((HERE/'placement.json').read_text()) if (HERE/'placement.json').exists() else {}
 for name,info in manifest.items():
  g,parts=surface(name);functional={'bounds':info['bounds'],'size':info['size'],'uniformMetres':info['suggestedUniformMetres']}
  if name=='banquet-table-v2':functional['tabletop']=plane(parts)
  if name=='broken-rail-trestle-v2':functional['railTop']=plane(parts,highest=True)
  if name=='castle-flagstone-v2':functional['stoneTop']=plane(parts)
  if name=='castle-chandelier-v2':functional['hangingHook']=[0,info['bounds']['max'][1],0];functional['bottomY']=0
  if name=='skull-axe-head-v2':functional['shaftSocket']=[0,0,0];functional['headCentre']=[0,info['size'][1]/2,0];functional['mountingHint']='Grip removed. RotateZ PI for a downward pendulum; translate head centre to existing blade collider.'
  if name=='castle-wall-window-v2':functional['backPlane']=plane(parts,axis=2,sign=-1)
  if name=='monster-face-portal-v2':functional.update(triangles_mask(parts))
  if info.get('rigidPivots'):functional['rigidPivots']=info['rigidPivots'];functional['rigidRegions']=info['rigidRegions']
  measurements[name]=functional;info['functional']=functional
  path=ROOT/'public/ghost-train'/(name+'.provenance.json');path.write_text(json.dumps(info,indent=2)+'\n')
  # Provider-generated proof thumbnails are supplemental; transformed floor/head
  # geometry is separately reviewed through the packed models in Chrome.
  thumb=ROOT/'.img2threejs/ghost-train-v2'/(name+'-textured')/'downloads/thumbnail.png';im=Image.open(thumb);im.thumbnail((256,256));im.save(HERE/'proof'/(name+'.png'))
 (HERE/'placement.json').write_text(json.dumps(measurements,indent=2)+'\n');(HERE/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 wall=project_texture('castle-wall-window-v2',2,-1,[0,1],'meshy-castle-window-uv-v2.png',1536)
 stone_source=ROOT/wall['path'];image=Image.open(stone_source);crop=[round(image.width*.04),round(image.height*.26),round(image.width*.159),round(image.height*.82)]
 stone=ROOT/'public/ghost-train/meshy-castle-stone-v2.png';tile=image.crop(crop);tile.save(stone)
 stone_report={**wall,'path':str(stone.relative_to(ROOT)),'sourceProjection':wall['path'],'cropPixels':crop,'region':'Pure limestone face of left window-bay column, excluding glass/tracery',
  'operation':'Exact crop of actual Meshy UV-reprojected stone pixels; no content painting','size':list(tile.size),'sha256':hashlib.sha256(stone.read_bytes()).hexdigest()}
 table_original=ROOT/'.img2threejs/ghost-train-v2/banquet-table-v2-original-packed.glb'
 if not table_original.exists():shutil.copy2(ROOT/'public/ghost-train/banquet-table-v2.glb',table_original)
 timber_projection=project_texture('banquet-table-v2',1,-1,[0,2],'meshy-castle-timber-uv-v2.png',1024,table_original)
 timber_image=Image.open(ROOT/timber_projection['path']);timber_crop=[205,205,819,819];timber=ROOT/'public/ghost-train/meshy-castle-timber-v2.png';timber_tile=timber_image.crop(timber_crop);timber_tile.save(timber)
 timber_report={**timber_projection,'path':str(timber.relative_to(ROOT)),'cropPixels':timber_crop,'region':'Unobstructed oak underside centre; excludes feet and future red-cloth tabletop',
  'size':list(timber_tile.size),'sha256':hashlib.sha256(timber.read_bytes()).hexdigest()}
 textures={'stone':stone_report,'floor':project_texture('castle-flagstone-v2',1,1,[0,2],'meshy-castle-floor-v2.png',1024),'timber':timber_report}
 (HERE/'texture-provenance.json').write_text(json.dumps(textures,indent=2)+'\n')
 print(json.dumps({'functional':measurements,'textures':textures},indent=2))
