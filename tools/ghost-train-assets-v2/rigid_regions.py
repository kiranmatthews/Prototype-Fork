#!/usr/bin/env python3
"""Reuse actual Meshy triangles/UVs for the cart face and mechanical rig."""
from pathlib import Path
import copy,hashlib,json,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
sys.path.insert(0,str(HERE));from measure_assets import surface,plane

def rebuild(source_path,output_path,regions,extras,normalize=False):
 g=Glb(source_path);source=copy.deepcopy(g.document);raw=bytes(g.binary);surfaces=[]
 for m in source['meshes']:
  for p in m['primitives']:
   arrays={key:g.read_accessor(i) for key,i in p['attributes'].items()};types={key:(source['accessors'][i]['componentType'],source['accessors'][i]['type']) for key,i in p['attributes'].items()};ix=g.read_accessor(p['indices']).ravel().astype(int).reshape(-1,3)
   surfaces.append((p,arrays,types,ix))
 selected={name:[] for name in regions}
 for p,arrays,types,ix in surfaces:
  centres=arrays['POSITION'][ix].mean(1);remaining=np.ones(len(ix),dtype=bool)
  for name,predicate in regions.items():
   mask=predicate(centres)&remaining;remaining[mask]=False
   if mask.any():selected[name].append((p,arrays,types,ix[mask]))
 all_positions=np.concatenate([arrays['POSITION'][ix].reshape(-1,3) for pieces in selected.values() for _,arrays,_,ix in pieces]);low,high=all_positions.min(0),all_positions.max(0);origin=(low+high)/2;origin[1]=low[1];scale=max(high-low) if normalize else 1
 if not normalize:origin[:]=0
 doc=g.document;doc['accessors']=[];doc['bufferViews']=[];doc['meshes']=[];doc['nodes']=[];g.binary=bytearray()
 for image in doc['images']:
  view=source['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0)
  while len(g.binary)%4:g.binary.append(0)
  image['bufferView']=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(g.binary),'byteLength':view['byteLength']});g.binary.extend(raw[offset:offset+view['byteLength']])
 counts={}
 for name,pieces in selected.items():
  primitives=[];counts[name]=0
  for p,arrays,types,ix in pieces:
   chosen,remapped=np.unique(ix.ravel(),return_inverse=True);attrs={}
   for key,array in arrays.items():
    values=array[chosen].copy()
    if key=='POSITION':values=((values-origin)/scale).astype('<f4')
    component,type_name=types[key];index=g.add_accessor(values,component,type_name,34962);attrs[key]=index
    if key=='POSITION':doc['accessors'][index]['min']=values.min(0).tolist();doc['accessors'][index]['max']=values.max(0).tolist()
   index=g.add_accessor(remapped.astype('<u4').reshape(-1,1),5125,'SCALAR',34963);primitives.append({'attributes':attrs,'indices':index,'material':p.get('material',0)});counts[name]+=len(ix)
  if primitives:
   index=len(doc['meshes']);doc['meshes'].append({'name':name,'primitives':primitives});doc['nodes'].append({'name':name,'mesh':index})
 root=len(doc['nodes']);doc['nodes'].append({'name':output_path.stem,'children':list(range(root)),'extras':extras});doc['scenes']=[{'nodes':[root]}];doc['scene']=0;g.save(output_path)
 return {'triangles':sum(counts.values()),'regions':counts,'sourceBounds':{'min':low.tolist(),'max':high.tolist()},'origin':origin.tolist(),'scale':float(scale),
  'bounds':{'min':((low-origin)/scale).tolist(),'max':((high-origin)/scale).tolist()},'bytes':output_path.stat().st_size,'sha256':hashlib.sha256(output_path.read_bytes()).hexdigest()}

if __name__=='__main__':
 manifest=json.loads((HERE/'asset-manifest.json').read_text());placements=json.loads((HERE/'placement.json').read_text())
 cart=ROOT/'public/ghost-train/demon-ghost-cart-v2.glb';face=ROOT/'public/ghost-train/demon-cart-face-v2.glb'
 report=rebuild(cart,face,{'DemonCartFace':lambda c:(c[:,2]>.055)&(c[:,1]>.225)},
  {'provider':'Meshy','sourceModel':'demon-ghost-cart-v2','purpose':'Actual textured face sculpture for the existing open Meshy cart body'},True)
 report.update(provider='Meshy',taskId=manifest['demon-ghost-cart-v2']['taskId'],originalUVsPreserved=True,operation='Triangle-region extraction only; no new generated/painted content',
  sourceModel='demon-ghost-cart-v2',sourceSha256=hashlib.sha256(cart.read_bytes()).hexdigest(),attachment={'canonicalFront':'+Z','boundsCentre':((np.array(report['bounds']['min'])+np.array(report['bounds']['max']))/2).tolist(),'suggestedWidthMetres':2.0})
 face.with_suffix('.provenance.json').write_text(json.dumps(report,indent=2)+'\n');placements['demon-cart-face-v2']=report
 # Existing open cart uses its original Meshy floor and four wheel cap surfaces.
 _,parts=surface('ghost-cart');wheels=[]
 for side in [-1,1]:
  for end in [-1,1]:
   groups={}
   for _,_,_,tri,c,n,areas,_ in parts:
    for i in np.where((c[:,1]<.19)&(c[:,0]*side>.10)&(c[:,0]*side<.147)&(c[:,2]*end>.17)&(c[:,2]*end<.40)&(abs(n[:,0])>.75))[0]:
     key=round(float(c[i,0]),2);groups.setdefault(key,[]).append((tri[i],float(areas[i])))
   if not groups:continue
   values=max(groups.values(),key=lambda v:sum(a for _,a in v));points=np.concatenate([t for t,_ in values]);lo,hi=points.min(0),points.max(0);centre=(lo+hi)/2;radius=float(((hi-lo)[1]+(hi-lo)[2])/4)
   wheels.append({'side':side,'end':end,'centre':centre.tolist(),'radius':radius,'axis':[1,0,0],'method':'Measured largest approximately planar Meshy wheel cap bounding surface'})
 placements['original-open-cart']={'model':'ghost-cart.glb','interiorFloor':plane(parts),'wheels':wheels}
 # The main gear plane is +Z after the recorded rigid quarter turn. These
 # measured regions stay in original normalized world coordinates for pivot rigs.
 clock=ROOT/'public/ghost-train/castle-clockwork-v2.glb'
 pivots={'ClockMainWheel':{'point':[-.067,.387,.334],'axis':[0,0,1]},'ClockUpperPulley':{'point':[.332,.634,-.329],'axis':[1,0,0]},
  'ClockLowerPulley':{'point':[.332,.388,-.329],'axis':[1,0,0]},'ClockCounterweight':{'point':[.39,.147,-.315],'axis':[0,1,0]}}
 regions={
  'ClockCounterweight':lambda c:(c[:,0]>.29)&(c[:,1]>.09)&(c[:,1]<.22)&(c[:,2]<-.23),
  'ClockMainWheel':lambda c:(c[:,2]>.312)&(c[:,1]>.10)&(c[:,1]<.73)&(((c[:,0]+.067)/.365)**2+((c[:,1]-.387)/.31)**2<1.12),
  'ClockUpperPulley':lambda c:(c[:,0]>.24)&(c[:,1]>.54)&(c[:,1]<.78)&(c[:,2]<-.17),
  'ClockLowerPulley':lambda c:(c[:,0]>.24)&(c[:,1]>.28)&(c[:,1]<.53)&(c[:,2]<-.17),
  'ClockFrame':lambda c:np.ones(len(c),dtype=bool)}
 clock_report=rebuild(clock,clock,regions,{'ghostClockworkRig':{'pivots':pivots,'coordinates':'Normalized source world coordinates; subtract each pivot when parenting rigid parts','originalUVsPreserved':True}},False)
 assert clock_report['triangles']==manifest['castle-clockwork-v2']['triangles']
 info=manifest['castle-clockwork-v2'];info.update(outputSha256=clock_report['sha256'],bytes=clock_report['bytes'],rigidRegions=clock_report['regions'],rigidPivots=pivots)
 clock.with_suffix('.provenance.json').write_text(json.dumps(info,indent=2)+'\n');manifest['castle-clockwork-v2']=info;placements['castle-clockwork-v2']['rigidPivots']=pivots;placements['castle-clockwork-v2']['rigidRegions']=clock_report['regions']
 (HERE/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(HERE/'placement.json').write_text(json.dumps(placements,indent=2)+'\n')
 print(json.dumps({'face':report,'openCart':placements['original-open-cart'],'clock':clock_report},indent=2))
