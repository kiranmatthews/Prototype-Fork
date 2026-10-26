"""Bind complete Meshy surfaces as named components to the bone-man joint contract.

Only source positions are uniformly rebased to metres. Every triangle, normal,
UV and texture survives. Semantic controls own rotation/contact; childless
segment skin bones own volume-preserving stretch without scaling descendants.
"""
from pathlib import Path
import hashlib,json,struct,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.img2threejs/rooftop-anthro';OUT=ROOT/'public/rooftop-kook'

def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)

def build(name):
 raw=(WORK/name/'downloads/model.glb').read_bytes();size=struct.unpack_from('<I',raw,12)[0]
 doc=json.loads(raw[20:20+size]);binary=bytearray(raw[28+size:]);access=doc['accessors'];views=doc['bufferViews']
 def read(i):
  a=access[i];v=views[a['bufferView']];dt={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
  width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  return np.frombuffer(binary,dtype=dt,count=a['count']*width,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).copy().reshape(-1,width)
 def append(a,kind,component=5126,normalized=False):
  a=np.ascontiguousarray(a);binary.extend(b'\0'*(-len(binary)%4));vi=len(views)
  views.append({'buffer':0,'byteOffset':len(binary),'byteLength':a.nbytes});binary.extend(a.tobytes())
  out={'bufferView':vi,'componentType':component,'count':len(a),'type':kind}
  if normalized:out['normalized']=True
  if kind=='VEC3':out.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  access.append(out);return len(access)-1
 primitive=doc['meshes'][0]['primitives'][0];attrs=primitive['attributes'];p=read(attrs['POSITION']);indices=read(primitive['indices']).reshape(-1,3)
 goose=name=='goose-matron';pig=name in ('pig-matron','pig-guard');matron=name=='pig-matron';height=2.35 if goose or matron else 2.5
 lo=p.min(0);hi=p.max(0);factor=height/(hi[1]-lo[1]);center=(lo+hi)/2
 p=(p-np.array([center[0],lo[1],center[2]]))*factor;f=p/height;x,y,z=f.T;ax=np.abs(x)
 joints=[];positions={};parents={}
 def joint(n,xyz,parent=None):positions[n]=np.array(xyz)*height;parents[n]=parent;joints.append(n)
 joint('hips',[0,.31 if goose else .30,0])
 joint('spine',[0,.43 if goose else .45,0],'hips')
 joint('chest',[0,.575 if goose else .64,0],'spine')
 joint('neck',[0,.645 if goose else .72,.005],'chest')
 joint('head',[0,.79 if goose else .79,.015],'neck')
 joint('jaw',[0,.803 if goose else .80,.06 if goose else .15],'head')
 for side,sign in [('left',1),('right',-1)]:
  def sj(n,xyz,parent):joint(n+'-'+side,[xyz[0]*sign,xyz[1],xyz[2]],parent)
  sj('clavicle',[.095 if goose else .12,.575 if goose else .64,0],'chest')
  sj('shoulder',[.14 if goose else .22,.575 if goose else .64,0],'clavicle-'+side)
  sj('elbow',[.22 if goose else .31,.52 if goose else .53,0],'shoulder-'+side)
  sj('wrist',[.29 if goose else .395,.465 if goose else .445,.015],'elbow-'+side)
  sj('hip',[.081 if goose else .145,.29 if goose else .29,0],'hips')
  sj('knee',[.085 if goose else .152,.215 if goose else .20,.005],'hip-'+side)
  sj('ankle',[.095 if goose else .16,.085,.02],'knee-'+side)
  sj('toe',[.095 if goose else .16,.05,.12],'ankle-'+side)
 if pig:
  # Measured against each native Meshy front/side surface, in height units.
  # The matron's short porcine neck must not inherit the former goose neck.
  measured={'hips':[0,.31,0],'spine':[0,.43,.015],'chest':[0,.57 if matron else .65,0],
    'neck':[0,.635 if matron else .72,0],'head':[0,.69 if matron else .765,.015],
    'jaw':[0,.735 if matron else .765,.065 if matron else .12]}
  for side,sign in [('left',1),('right',-1)]:
   for n,v in {'clavicle':[.1,.58 if matron else .66,0],
     'shoulder':[.18 if matron else .225,.58 if matron else .66,-.015 if matron else -.045],
     'elbow':[.275 if matron else .315,.475 if matron else .53,-.01 if matron else -.04],
     'wrist':[.32 if matron else .35,.435,.04 if matron else .03],
     'hip':[.13 if matron else .15,.29,0], 'knee':[.14 if matron else .16,.205,-.015],
     'ankle':[.14 if matron else .16,.08,-.025],'toe':[.14 if matron else .16,.04,.07]}.items():
    measured[n+'-'+side]=[v[0]*sign,v[1],v[2]]
  for n,v in measured.items():positions[n]=np.array(v)*height
 segments={'spine':'chest','chest':'neck','neck':'head'}
 for side in ['left','right']:
  for a,b in [('shoulder','elbow'),('elbow','wrist'),('hip','knee'),('knee','ankle')]:segments[a+'-'+side]=b+'-'+side
 nodes=[];world=[];ids={};skin_names=[]
 def addnode(n,pos,parent,quat=None):
  ix=len(nodes);ids[n]=ix;skin_names.append(n);node={'name':n,'translation':(pos-(positions[parent] if parent else 0)).tolist(),'extras':{'semanticJoint':n}}
  if quat is not None:node['rotation']=quat.tolist()
  nodes.append(node)
  if parent:nodes[ids[parent]].setdefault('children',[]).append(ix)
  mat=np.eye(4);mat[:3,3]=pos
  if quat is not None:
   qx,qy,qz,qw=quat;mat[:3,:3]=[[1-2*(qy*qy+qz*qz),2*(qx*qy-qz*qw),2*(qx*qz+qy*qw)],[2*(qx*qy+qz*qw),1-2*(qx*qx+qz*qz),2*(qy*qz-qx*qw)],[2*(qx*qz-qy*qw),2*(qy*qz+qx*qw),1-2*(qx*qx+qy*qy)]]
  world.append(mat)
 for n in joints:addnode(n,positions[n],parents[n])
 for n,end in segments.items():
  d=positions[end]-positions[n];d=d/np.linalg.norm(d);q=np.array([d[2],0,-d[0],1+d[1]])
  if np.linalg.norm(q)<.00001:q=np.array([1.,0,0,0])
  q=q/np.linalg.norm(q);addnode(n+'-surface',positions[n],n,q)
 weights=np.zeros((len(p),len(nodes)),dtype=np.float32)
 def add(n,w):weights[:,ids[n]]+=w
 # Torso and long neck use endpoint-weighted spans. Art stays continuous.
 stops=[('hips',.32 if goose else .29),('spine-surface',.43 if goose else .44),('chest-surface',.58 if goose else .64),('neck-surface',.69 if goose else .735),('head',.795 if goose else .79)]
 if pig:stops=[('hips',.29),('spine-surface',.43),('chest-surface',.57 if matron else .64),('neck-surface',.62 if matron else .715),('head',.68 if matron else .76)]
 torso=np.zeros_like(weights)
 for j,(n,at) in enumerate(stops):
  left=1 if j==0 else smooth((y-stops[j-1][1])/(at-stops[j-1][1]))
  right=1 if j==len(stops)-1 else 1-smooth((y-at)/(stops[j+1][1]-at))
  torso[:,ids[n]]=left*right
 torso/=np.maximum(torso.sum(1,keepdims=True),1e-9)
 weights[:]=torso
 # Sleeves/paws: source-measured shoulder boundaries, smooth at the armhole.
 # The outer coat hem is not an arm. Follow the descending sleeve seam,
 # keeping the wide pelvis below it on the torso rather than the elbow.
 boundary=.23-np.maximum(0,y-.42)*.58 if goose else .30-np.maximum(0,y-.43)*.40
 arm_amount=smooth((ax-boundary)/(.043 if goose else .04))*(1-smooth((y-(.60 if goose else .68))/.06))*smooth((y-(.32 if goose else .26))/.07)
 if pig:
  boundary=.25+np.maximum(0,.37-y)*.4-np.maximum(0,y-.43)*.36 if matron else .26+np.maximum(0,.36-y)*.4-np.maximum(0,y-.46)*.30
  arm_amount=smooth((ax-boundary)/.025)*(1-smooth((y-(.625 if matron else .70))/.055))*smooth((y-.235)/.045)
 for side,sign in [('left',1),('right',-1)]:
  amount=arm_amount*(x*sign>0);weights*=1-amount[:,None]
  shoulder=.14 if goose else .22;elbow=.22 if goose else .31;wrist=.29 if goose else .395
  elbow_y=.52 if goose else .53;wrist_y=.465 if goose else .445
  fore=smooth(((ax-elbow)*.7-(y-elbow_y)*.7+.023)/.055)
  hand=smooth(((ax-wrist)*.7-(y-wrist_y)*.7+.012)/.04) if goose else smooth(((ax-.375)*.7-(y-.46)*.7+.045)/.05)
  if pig:
   elbow=positions['elbow-'+side]/height;wrist=positions['wrist-'+side]/height
   fore=smooth(((ax-abs(elbow[0]))*.6-(y-elbow[1])*.8+.022)/.055)
   # The entire broad hoof-palm belongs to the wrist, including its inner
   # thumb and nail. Blend inside the cuff, not through the spread fingers.
   hand=smooth((ax*.6-y*.8+(.202 if matron else .205))/.035)
  add('shoulder-'+side+'-surface',amount*(1-fore));add('elbow-'+side+'-surface',amount*fore*(1-hand));add('wrist-'+side,amount*fore*hand)
 # Hems stay at the pelvis. Boot soles and paws remain rigid contact pieces.
 leg_amount=(1-smooth((y-(.265 if goose else .255))/.055))*smooth((ax-.02)/.045)
 if pig:leg_amount=(1-smooth((y-.205)/.035))*smooth((ax-.02)/.045)
 for side,sign in [('left',1),('right',-1)]:
  amount=leg_amount*(x*sign>0);weights*=1-amount[:,None]
  shin=1-smooth((y-(.21 if goose else .195))/.05);foot=1-smooth((y-.10)/.09)
  add('hip-'+side+'-surface',amount*(1-shin));add('knee-'+side+'-surface',amount*shin*(1-foot));add('ankle-'+side,amount*shin*foot)
 # Bird lower bill: source geometry, independently hinged. The feather cheek,
 # eyes, upper bill and pearls stay on their original head/neck controls.
 if goose:
  jaw=smooth((z-.052)/.016)*(1-smooth((y-(.800-.1*np.maximum(0,z-.06)))/.008))*smooth((y-.738)/.018)
  jaw*=1-smooth((ax-.075)/.035)
  weights*=1-jaw[:,None];add('jaw',jaw)
 if matron:
  # Only the lower lip/chin and tongue hinge. Snout, cheeks and pearls stay
  # on their anatomical controls; a soft geometric seam avoids texture noise.
  jaw=smooth((z-.055)/.045)*(1-smooth((y-(.722-.12*np.maximum(0,z-.08)))/.015))*smooth((y-.65)/.022)
  jaw*=1-smooth((ax-.075)/.055)
  weights*=1-jaw[:,None];add('jaw',jaw)
 order=np.argsort(weights,axis=1)[:,-4:];best=np.take_along_axis(weights,order,axis=1);best/=best.sum(1,keepdims=True)
 quant=np.rint(best*255).astype(np.int32);quant[:,-1]+=255-quant.sum(1)
 assert quant.min()>=0 and np.all(quant.sum(1)==255)
 attrs['POSITION']=append(p.astype('<f4'),'VEC3');attrs['JOINTS_0']=append(order.astype('<u2'),'VEC4',5123);attrs['WEIGHTS_0']=append(quant.astype('u1'),'VEC4',5121,True)
 inv=append(np.stack([np.linalg.inv(m).T.reshape(-1)for m in world]).astype('<f4'),'MAT4')
 # Native triangles are partitioned, never clipped/rebuilt/decimated. Shared
 # vertex attributes keep component boundaries watertight under deformation.
 categories=[]
 for n in skin_names:
  if n in ('head','jaw'):c=n
  elif n.startswith(('hip-','knee-','ankle-','toe-')):c=('boot-' if n.startswith(('ankle-','toe-'))else 'leg-')+('left' if 'left' in n else 'right')
  elif n.startswith(('shoulder-','elbow-','wrist-')):c=('paw-' if n.startswith('wrist-')else 'sleeve-')+('left' if 'left' in n else 'right')
  elif n=='neck-surface':c='neck'
  else:c='coat-and-pelvis'
  categories.append(c)
 owner=np.array(categories)[order[:,-1]];face_owner=owner[indices[:,0]];meshes=[];counts={}
 for c in dict.fromkeys(categories):
  selected=indices[face_owner==c]
  if not len(selected):continue
  pr={**primitive,'attributes':dict(attrs),'indices':append(selected.reshape(-1,1).astype('<u4'),'SCALAR',5125)}
  meshes.append({'name':name+'-'+c,'primitives':[pr]});counts[c]=len(selected)
 roots=[0]
 for i,m in enumerate(meshes):roots.append(len(nodes));nodes.append({'name':m['name'],'mesh':i,'skin':0,'extras':{'meshyComponent':True,'fullNativeGeometry':True}})
 doc.update(nodes=nodes,meshes=meshes,skins=[{'name':name+'-bone-man','joints':list(range(len(world))),'skeleton':0,'inverseBindMatrices':inv}],scenes=[{'nodes':roots}],scene=0)
 # Preserve data needed by the runtime contact solve and independent shafts.
 doc['scenes'][0]['extras']={'rigContract':'bone-man semantic humanoid','segments':segments,'height':height,'source':'Meshy 7.1','joints':{n:p.tolist()for n,p in positions.items()}}
 doc['buffers']=[{'byteLength':len(binary)}];doc['asset']['generator']='Meshy native surfaces / bone-man component binder'
 for m in doc.get('materials',[]):m['doubleSided']=False
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*(-len(js)%4);binary.extend(b'\0'*(-len(binary)%4))
 output=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
 (OUT/(name+'.glb')).write_bytes(output)
 report={'name':name,'height':height,'sourceSha256':hashlib.sha256(raw).hexdigest(),'sourceTriangles':len(indices),'triangles':sum(counts.values()),'components':counts,'joints':len(joints),'skinBones':len(world),'allNativeTrianglesPreserved':sum(counts.values())==len(indices),'originalNormalsUVsAndTextures':True,'weightsNormalized':True,'segments':segments,'restJoints':{n:p.tolist()for n,p in positions.items()}}
 (OUT/(name+'.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k not in ('restJoints','segments')}))

for name in sys.argv[1:] or ['pig-matron','pig-guard']:build(name)
