"""Pack one complete Meshy section; retain the provider-remeshed geometry, UVs and normals."""
from pathlib import Path
import hashlib,json,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import matrices,compact_textures
name='crash-boardwalk-section'
source=ROOT/'.img2threejs/drowned-crown/excellence/meshy'/(name+'-remeshed')/'downloads/model.glb';g=Glb(source);d=g.document
worlds=matrices(d);parts=[];counts={};original=[g.read_accessor(i) for i in range(len(d['accessors']))]
for i,node in enumerate(d['nodes']):
 if 'mesh' not in node:continue
 lod=1 if node.get('name','').endswith('LOD1') else 0
 for prim in d['meshes'][node['mesh']]['primitives']:
  p=g.read_accessor(prim['attributes']['POSITION']);p=(np.c_[p,np.ones(len(p))]@worlds[i].T)[:,:3]
  ids=g.read_accessor(prim['indices']).reshape(-1,3);counts[str(lod)]=counts.get(str(lod),0)+len(ids)
  assert np.isfinite(p).all() and ids.min()>=0 and ids.max()<len(p)
  if not lod:parts.append((p,ids))
points=np.concatenate([p for p,_ in parts]);rotation=np.eye(3)
if np.ptp(points[:,0])>np.ptp(points[:,2]):
 rotation=np.array([[0,0,1],[0,1,0],[-1,0,0]])
 scene=d['scenes'][d.get('scene',0)];roots=scene['nodes'][:];scene['nodes']=[len(d['nodes'])]
 d['nodes'].append({'name':'Boardwalk long axis along Z','rotation':[0,2**-.5,0,2**-.5],'children':roots})
points=points@rotation.T;low=points.min(0);span=np.ptp(points,axis=0);scale=12/span[2];size=span*scale
triangles=np.concatenate([(p@rotation.T)[ids] for p,ids in parts]);a=triangles[:,0][:,[0,2]];b=triangles[:,1][:,[0,2]]-a;c=triangles[:,2][:,[0,2]]-a;det=b[:,0]*c[:,1]-b[:,1]*c[:,0];valid=abs(det)>1e-10
samples=[]
for x in np.linspace(low[0]+span[0]*.25,low[0]+span[0]*.75,9):
 for z in np.linspace(low[2]+span[2]*.08,low[2]+span[2]*.92,31):
  q=np.array([x,z])-a;u=np.divide(q[:,0]*c[:,1]-q[:,1]*c[:,0],det,out=np.zeros_like(det),where=valid);v=np.divide(b[:,0]*q[:,1]-b[:,1]*q[:,0],det,out=np.zeros_like(det),where=valid)
  hits=valid&(u>=0)&(v>=0)&(u+v<=1)
  if hits.any():
   heights=triangles[:,0,1]+u*(triangles[:,1,1]-triangles[:,0,1])+v*(triangles[:,2,1]-triangles[:,0,1]);samples.append((heights[hits].max()-low[1])*scale)
assert len(samples)>240,('Disconnected deck',len(samples))
# Collision only: sample the provider's actual deck rather than placing
# an unrelated flat support through the visible planks. No visual mesh edits.
raw_median=np.median(samples)/scale+low[1]
edge1=triangles[:,1]-triangles[:,0];edge2=triangles[:,2]-triangles[:,0];normal=np.cross(edge1,edge2)
walk=normal[:,1]>.35*np.linalg.norm(normal,axis=1)
def height_at(x,z):
 q=np.array([x,z])-a
 u=np.divide(q[:,0]*c[:,1]-q[:,1]*c[:,0],det,out=np.zeros_like(det),where=valid)
 v=np.divide(b[:,0]*q[:,1]-b[:,1]*q[:,0],det,out=np.zeros_like(det),where=valid)
 heights=triangles[:,0,1]+u*edge1[:,1]+v*edge2[:,1]
 hits=valid&walk&(u>=-1e-6)&(v>=-1e-6)&(u+v<=1.000001)&(heights>=raw_median-.34/scale)&(heights<=raw_median+.36/scale)
 return float(heights[hits].max()) if hits.any() else None
# Measure the actual deck ends; the overall GLB includes protruding beams.
valid_z=[]
for z in np.linspace(-.5,.5,401):
 hits=sum(height_at(low[0]+span[0]*(x+.5),low[2]+span[2]*(z+.5)) is not None for x in [-.12,-.06,0,.06,.12])
 if hits>=3:valid_z.append(float(z))
zlo=min(valid_z)+.003;zhi=max(valid_z)-.003
vertices=[];indices=[];recovered=0;nx=16;nz=64
for row in range(nz+1):
 for col in range(nx+1):
  x=-.38+.76*col/nx;z=zlo+(zhi-zlo)*row/nz
  wx=low[0]+span[0]*(x+.5);wz=low[2]+span[2]*(z+.5);h=height_at(wx,wz)
  if h is None:
   nearby=[]
   for radius in [.002,.004,.008,.016,.025]:
    for dx,dz in [(0,radius),(0,-radius),(radius,0),(-radius,0)]:
     value=height_at(wx+dx*span[0],wz+dz*span[2])
     if value is not None:nearby.append(value)
    if nearby:break
   assert nearby,('Unsupported deck sample',x,z)
   h=float(np.median(nearby));recovered+=1
  vertices.extend([round(x,7),round((h-low[1])/span[1],7),round(z,7)])
for row in range(nz):
 for col in range(nx):
  i=row*(nx+1)+col;j=i+nx+1;indices.extend([i,j,j+1,i,j+1,i+1])
(ROOT/'src/drownedCrownSectionGround.generated.ts').write_text('/** Collision-only samples of the complete Meshy deck; no visible board geometry. */\nexport const DROWNED_BOARDWALK_GROUND='+json.dumps({'vertices':vertices,'indices':indices},separators=(',',':'))+';\n')
textures=compact_textures(g,4096,96,data_limit=2048,lossless_data=True)
for i,values in enumerate(original):assert np.array_equal(g.read_accessor(i),values),('Changed model accessor',i)
job=json.loads((HERE/'tasks.json').read_text())['tasks'][name+'-remeshed'];assert job['state']=='SUCCEEDED'
d['asset'].setdefault('extras',{}).update({'provider':'Meshy','taskId':job['id'],'wholeSection':True,'originalUVsPreserved':True,'rootAxisRotationOnlyAfterProviderRemesh':True})
target=ROOT/'public/drowned-crown/excellence'/f'{name}.glb';g.save(target)
report={'taskId':job['id'],'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output':str(target.relative_to(ROOT)),'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'size':size.round(6).tolist(),'triangles':counts,'deckHeight':float(np.median(samples)),'deckHeightPercentiles':np.percentile(samples,[1,5,50,95,99]).tolist(),'topSamples':len(samples),'deckZBounds':[zlo,zhi],'collisionProxy':{'vertices':len(vertices)//3,'triangles':len(indices)//3,'gapSamplesRecovered':recovered,'source':'Downward samples of the provider remesh deck'},'textures':textures,'geometryAndUVAccessorsUnchangedDuringPacking':True}
(HERE/'boardwalk-section-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'src/drownedCrownSections.generated.ts').write_text('/** Complete Imagegen-guided Meshy environment sections. */\nexport const DROWNED_CROWN_SECTION_MODELS={\n crowncrashboardwalk:{file:"../drowned-crown/excellence/crash-boardwalk-section",label:"Drowned Crown · complete Meshy boardwalk",size:'+json.dumps(report['size'])+',wind:false,normalStrength:.2,cellSize:20,doubleSided:false},\n} as const;\nexport const DROWNED_BOARDWALK_DECK_HEIGHT='+str(report['deckHeight'])+';\nexport const DROWNED_BOARDWALK_Z_BOUNDS='+json.dumps([zlo,zhi])+' as const;\n')
print(json.dumps({k:v for k,v in report.items() if k!='textures'}))
