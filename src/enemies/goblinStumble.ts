import * as THREE from 'three';
import type { EnemyAnimationFrame, EnemyLeg } from './types';
import { NIGHTWORKS_GOBLIN_ELASTICITY_PROFILE, sampleEnemyElasticity } from './elasticity';

export const GOBLIN_STUMBLE_PERIOD = 2.8;
const clamp=THREE.MathUtils.clamp;
const smooth=(v:number)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const fract=(v:number)=>v-Math.floor(v);
// Hand-authored weight transfers: lift, heel slap, sag, knee buckle, dragging
// catch, then a reluctant recovery. The two halves deliberately do not match.
const BODY = [
  [0,    .08,-.12,.12,-.10,.24,-.12],
  [.07,  .16,-.17,.18,-.19,.29,-.19],
  [.18,  .24,-.23,.29,-.29,.36,-.27],
  [.25,  .16,-.32,.34, .12,.43, .19],
  [.34,  .10,-.21,.26, .17,.31, .24],
  [.48, -.02,-.23,.34, .23,.38, .30],
  [.56, -.19,-.43,.43, .32,.54, .37],
  [.65, -.21,-.37,.36, .22,.47, .30],
  [.77, -.15,-.30,.29, .11,.40, .17],
  [.86, -.05,-.23,.22,-.14,.29,-.20],
  [.94,  .03,-.17,.15,-.16,.24,-.19],
  [1,    .08,-.12,.12,-.10,.24,-.12],
] as const;
// Columns: phase, pelvis lateral/drop/pitch/roll, chest pitch/roll.
function channel(phase:number,column:number):number {
  const p=fract(phase);
  for(let i=1;i<BODY.length;i++)if(p<=BODY[i][0]){
    const a=BODY[i-1],b=BODY[i],u=smooth((p-a[0])/(b[0]-a[0]));
    return THREE.MathUtils.lerp(a[column],b[column],u);
  }
  return BODY[0][column];
}
export function goblinShambleSpeed(clock:number):number {
  const p=fract(clock/GOBLIN_STUMBLE_PERIOD);
  // A stalled bad leg arrests the body; a short surge gets it over the toe.
  if(p<.25)return .19+.46*Math.sin(p/.25*Math.PI)**2;
  if(p<.55)return .12;
  if(p<.82)return .09+.17*smooth((p-.55)/.27);
  return .18+.31*Math.sin((p-.82)/.18*Math.PI)**2;
}
const Y=new THREE.Vector3(0,1,0);
type Bone=THREE.Object3D;
type LegName='Left'|'Right';
interface Leg {
  name:LegName;upper:Bone;lower:Bone;foot:Bone;toe:Bone;
  rest:THREE.Vector3;restQ:THREE.Quaternion;sole:THREE.Vector3[];
  previous:THREE.Vector3;from:THREE.Vector3;goal:THREE.Vector3;at:THREE.Vector3;anchor:THREE.Vector3;
  q:THREE.Quaternion;anchorQ:THREE.Quaternion;plantedYaw:number;elapsed:number;duration:number;active:boolean;tag:string;
  drag:boolean;rush:boolean;lift:number;startPitch:number;startClearance:number;strike:number;pitch:number;twist:number;
}
interface SavedPose {n:Bone;p:THREE.Vector3;q:THREE.Quaternion;s:THREE.Vector3}
export interface GoblinStumbleDiagnostics {
  authored:boolean;phase:number;leftContact:boolean;rightContact:boolean;
  leftFoot:number[];rightFoot:number[];pelvis:number[];steps:number;
  plantedSlip:number;reachError:number;reachCorrection:number;bodyDrop:number;travel:number;
}

/** Model-specific authored zombie animation. No ordinary walk action runs.
 * World-space foot plants, two-bone IK and independent joint deformation give
 * the irregular body timing actual weight instead of sliding a tilted walk. */
export function createGoblinStumble(model:THREE.Object3D,root:THREE.Group) {
  const get=(name:string):Bone=>{const n=model.getObjectByName(name);if(!n)throw Error(`Goblin skeleton missing ${name}`);return n;};
  const hips=get('Hips'),low=get('Spine02'),mid=get('Spine01'),chest=get('Spine'),neck=get('neck'),head=get('Head');
  const saved:SavedPose[]=[];model.traverse(n=>{if((n as THREE.Bone).isBone)saved.push({n,p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()});});
  root.updateMatrixWorld(true);
  const toRoot=(n:Bone)=>root.worldToLocal(n.getWorldPosition(new THREE.Vector3()));
  const hipRest=toRoot(hips);
  const rootQ=new THREE.Quaternion(),inverseRootQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),worldQ=new THREE.Quaternion();
  root.getWorldQuaternion(rootQ);inverseRootQ.copy(rootQ).invert();
  const legs=(['Left','Right'] as const).map(name=>{
    const foot=get(name+'Foot'),rest=toRoot(foot),q=foot.getWorldQuaternion(new THREE.Quaternion()).premultiply(inverseRootQ);
    return {name,upper:get(name+'UpLeg'),lower:get(name+'Leg'),foot,toe:get(name+'ToeBase'),rest,restQ:q,
      sole:[] as THREE.Vector3[],previous:new THREE.Vector3(),from:new THREE.Vector3(),goal:new THREE.Vector3(),at:new THREE.Vector3(),anchor:new THREE.Vector3(),q:new THREE.Quaternion(),anchorQ:new THREE.Quaternion(),plantedYaw:0,
      elapsed:0,duration:1,active:false,tag:'',drag:false,rush:false,lift:.25,startPitch:0,startClearance:0,strike:10,pitch:0,twist:0};
  });
  // Measure the boot soles from the actual weighted mesh, in ankle coordinates.
  // Rolling onto the toe raises the ankle instead of clipping the boot floor.
  model.traverse(n=>{
    const mesh=n as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
    const skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,v=new THREE.Vector3();
    for(const leg of legs){
      const ids=[mesh.skeleton.bones.indexOf(leg.foot as THREE.Bone),mesh.skeleton.bones.indexOf(leg.toe as THREE.Bone)];
      const inverse=leg.foot.matrixWorld.clone().invert(),candidates:THREE.Vector3[]=[];
      for(let i=0;i<skin.count;i++){
        let weight=0;for(let k=0;k<4;k++)if(ids.includes(skin.getComponent(i,k)))weight+=weights.getComponent(i,k);
        if(weight<.6)continue;
        mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);const local=root.worldToLocal(v.clone());
        if(local.y<.10)candidates.push(v.clone().applyMatrix4(inverse));
      }
      // Keep the low surface perimeter; sampling all candidates is cheap (a
      // few dozen boot vertices) and avoids guessing a pivot or a heel height.
      leg.sole=candidates;
    }
  });
  const mouthLocal=head.worldToLocal(root.localToWorld(new THREE.Vector3(0,2.23,.76)));
  const p0=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3(),dir=new THREE.Vector3(),pole=new THREE.Vector3(),knee=new THREE.Vector3();
  const offset=new THREE.Vector3(),tmp=new THREE.Vector3(),rootPos=new THREE.Vector3();
  const deltaQ=new THREE.Quaternion(),q1=new THREE.Quaternion(),q2=new THREE.Quaternion(),euler=new THREE.Euler();
  const matrix=new THREE.Matrix4(),scale=new THREE.Vector3(),desiredMatrix=new THREE.Matrix4();
  const boneFrames=new Map<Bone,THREE.Quaternion>(),planeNormals=new Map<Bone,THREE.Vector3>(),restPlanes=new Map<Bone,THREE.Vector3>();
  const priorPlane=new THREE.Vector3(),priorAxis=new THREE.Vector3();let solveStep=1/120;
  const priorBoneQ=new Map<Bone,THREE.Quaternion>(),restBoneQ=new Map<Bone,THREE.Quaternion>();
  const transported=new THREE.Quaternion(),relativeTwist=new THREE.Quaternion();
  const normal=new THREE.Vector3(),axisY=new THREE.Vector3(),axisZ=new THREE.Vector3();
  for(const name of ['Left','Right'])for(const suffixes of [['UpLeg','Leg','Foot'],['Arm','ForeArm','Hand']]){
    const a=get(name+suffixes[0]),b=get(name+suffixes[1]),c=get(name+suffixes[2]);
    a.getWorldPosition(p0);b.getWorldPosition(p1);c.getWorldPosition(p2);
    normal.subVectors(p1,p0).cross(tmp.subVectors(p2,p1)).normalize();
    for(const [bone,end]of [[a,b],[b,c]]){
      axisY.copy(end.getWorldPosition(p1)).sub(bone.getWorldPosition(p0)).normalize();axisZ.crossVectors(normal,axisY).normalize();
      matrix.makeBasis(normal,axisY,axisZ);q1.setFromRotationMatrix(matrix).invert();bone.getWorldQuaternion(q2);
      boneFrames.set(bone,q1.multiply(q2).clone());
      priorBoneQ.set(bone,q2.clone());restBoneQ.set(bone,inverseRootQ.clone().multiply(q2));
    }
    planeNormals.set(a,normal.clone());restPlanes.set(a,normal.clone().applyQuaternion(inverseRootQ));
  }
  const lastRoot=new THREE.Vector3(),velocity=new THREE.Vector3(),localVelocity=new THREE.Vector3(),lastVelocity=new THREE.Vector3();
  const diagnostic:GoblinStumbleDiagnostics={authored:true,phase:0,leftContact:true,rightContact:true,leftFoot:[],rightFoot:[],pelvis:[],steps:0,plantedSlip:0,reachError:0,reachCorrection:0,bodyDrop:0,travel:0};
  let initialized=false,clock=0,phase=0,previousState='',serial=0,lastYaw=0,turnLag=0,acceleration=0,settle=0;
  let lastAliveFrame:EnemyAnimationFrame|null=null;
  const envelope={wind:0,lurch:0,stagger:0};
  const handTargets=[new THREE.Vector3(.91,.88,-.2),new THREE.Vector3(-.91,1.35,.33)];
  const handVelocities=[new THREE.Vector3(),new THREE.Vector3()];

  function restore(){for(const r of saved){r.n.position.copy(r.p);r.n.quaternion.copy(r.q);r.n.scale.copy(r.s);r.n.matrixAutoUpdate=true;}}
  function rotate(n:Bone,x=0,y=0,z=0){
    n.updateWorldMatrix(true,false);n.getWorldQuaternion(worldQ);n.parent!.getWorldQuaternion(parentQ).invert();
    deltaQ.setFromEuler(euler.set(x,y,z,'YXZ'));
    q1.copy(rootQ).multiply(deltaQ).multiply(inverseRootQ);
    n.quaternion.copy(parentQ).multiply(worldQ.premultiply(q1));n.updateWorldMatrix(false,true);
  }
  function segment(n:Bone,ratio:number){
    const r=clamp(ratio,.84,1.18),cross=1/Math.sqrt(r);scale.set(cross,r,cross);n.scale.multiply(scale);
    for(const child of n.children)child.scale.divide(scale);
  }
  function boneFrame(n:Bone,target:THREE.Vector3,norm:THREE.Vector3){
    n.updateWorldMatrix(true,false);n.getWorldPosition(p0);axisY.copy(target).sub(p0).normalize();
    axisZ.crossVectors(norm,axisY).normalize();normal.crossVectors(axisY,axisZ).normalize();
    matrix.makeBasis(normal,axisY,axisZ);worldQ.setFromRotationMatrix(matrix).multiply(boneFrames.get(n)!);
    const prior=priorBoneQ.get(n)!;
    priorAxis.copy(Y).applyQuaternion(prior);deltaQ.setFromUnitVectors(priorAxis,axisY);
    transported.copy(prior).premultiply(deltaQ);relativeTwist.copy(transported).invert().multiply(worldQ);
    const twist=2*Math.atan2(relativeTwist.y,relativeTwist.w),angle=Math.atan2(Math.sin(twist),Math.cos(twist));
    // Limit axial twist independently of the IK swing: knees and elbows can
    // aim quickly without a one-frame corkscrew in the weighted skin.
    deltaQ.setFromAxisAngle(Y,clamp(angle,-solveStep*10,solveStep*10));
    worldQ.copy(transported).multiply(deltaQ);prior.copy(worldQ);
    n.parent!.getWorldQuaternion(parentQ).invert();n.quaternion.copy(parentQ).multiply(worldQ);n.updateWorldMatrix(false,true);
  }
  function solve(upper:Bone,lower:Bone,end:Bone,target:THREE.Vector3,bend:THREE.Vector3){
    upper.updateWorldMatrix(true,true);upper.getWorldPosition(p0);lower.getWorldPosition(p1);end.getWorldPosition(p2);
    const a=p0.distanceTo(p1),b=p1.distanceTo(p2),distance=p0.distanceTo(target),d=clamp(distance,Math.abs(a-b)+.002,a+b-.002);
    dir.copy(target).sub(p0).normalize();pole.copy(bend).applyQuaternion(rootQ);pole.addScaledVector(dir,-pole.dot(dir)).normalize();
    const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(.00001,a*a-along*along));
    normal.crossVectors(pole,dir).normalize();
    const previous=planeNormals.get(upper)!;
    // Use one continuous anatomical bend plane for thigh and shin. A
    // shortest-arc aim can flip its axial twist by 180° near straight knees.
    priorPlane.copy(previous).addScaledVector(dir,-previous.dot(dir));
    if(priorPlane.lengthSq()>.01){
      priorPlane.normalize();if(normal.dot(priorPlane)<0)normal.negate();
      normal.lerpVectors(priorPlane,normal,1-Math.exp(-solveStep*24)).normalize();
    }
    const plane=normal.clone();previous.copy(plane);pole.crossVectors(dir,plane).normalize();
    knee.copy(p0).addScaledVector(dir,along).addScaledVector(pole,height);
    boneFrame(upper,knee,plane);boneFrame(lower,target,plane);
    return Math.max(0,distance-a-b);
  }
  function orient(n:Bone,q:THREE.Quaternion){n.parent!.getWorldQuaternion(parentQ).invert();n.quaternion.copy(parentQ).multiply(q);n.updateWorldMatrix(false,true);}
  function footOrientation(leg:Leg){
    q1.setFromAxisAngle(Y,leg.twist);
    leg.q.copy(rootQ).multiply(q1).multiply(leg.restQ);
    q1.setFromAxisAngle(new THREE.Vector3(1,0,0),leg.pitch).premultiply(rootQ).multiply(inverseRootQ);
    leg.q.premultiply(q1);
  }
  function ankleHeight(leg:Leg):number {
    // Sole vertices use source skeleton units; world bone scale includes the
    // immutable four-times artwork mount and source normalization.
    leg.foot.getWorldScale(scale);let minimum=Infinity;
    for(const point of leg.sole){tmp.copy(point).multiply(scale).applyQuaternion(leg.q);minimum=Math.min(minimum,tmp.y);}
    return Number.isFinite(minimum)?-minimum:leg.rest.y;
  }
  function startStep(leg:Leg,tag:string,duration:number,drag:boolean){
    leg.active=true;leg.elapsed=0;leg.duration=duration;leg.tag=tag;leg.drag=drag;leg.from.copy(leg.at);leg.startPitch=leg.pitch;leg.startClearance=Math.max(0,leg.at.y-rootPos.y-ankleHeight(leg));
    leg.rush=previousState==='lurch'||previousState==='stagger';leg.lift=previousState==='lurch'?.13:previousState==='stagger'?.17:.25;
    const side=leg.name==='Left'?1:-1,fast=previousState==='lurch'||previousState==='stagger';
    offset.copy(leg.rest);offset.x+=side*(fast?.08:.015)+Math.sin(clock*1.31+side)*.055;
    root.localToWorld(offset);offset.addScaledVector(velocity,duration+(fast?.025:.13));
    tmp.copy(offset).sub(rootPos);tmp.y=0;
    if(tmp.length()>1.22){tmp.setLength(1.22);offset.x=rootPos.x+tmp.x;offset.z=rootPos.z+tmp.z;}
    leg.goal.copy(offset);leg.goal.y=rootPos.y+leg.rest.y;
    leg.twist=side*(drag?.20:.08)+Math.sin(clock*1.17+side)*.07;diagnostic.steps++;
  }
  function plants(dt:number,frame:EnemyAnimationFrame){
    const fast=frame.state==='lurch',back=frame.state==='stagger',recover=frame.state==='recover';
    for(const [i,leg] of legs.entries()){
      leg.previous.copy(leg.at);leg.strike+=dt;
      let tag='',duration=.5,drag=i===1;
      if(fast||back){
        const period=fast?.34:.43,u=frame.stateTime/period,part=fract(u),active=i===0?part<.5:part>=.5;
        if(active){tag=`${serial}:${Math.floor(u)}:${i}`;duration=period*.49;drag=false;}
      }else if(recover){
        if(frame.stateTime>(i?.25:.02)){tag=`${serial}:recover:${i}`;duration=.27;drag=i===1;}
      }else if(frame.state!=='windup'&&frame.speed>.02){
        const active=i===0?phase>=.045&&phase<.225:phase>=.55&&phase<.855;
        if(active){tag=`walk:${Math.floor(clock/GOBLIN_STUMBLE_PERIOD)}:${i}`;duration=GOBLIN_STUMBLE_PERIOD*(i?.305:.18);}
      }
      // Turning a heavy body over fixed boots requires a real corrective
      // step; don't spin the planted soles in place or cross the knees.
      if(!leg.active&&!legs[1-i].active&&frame.state!=='windup'){
        tmp.copy(leg.anchor);root.worldToLocal(tmp);
        const misplaced=Math.abs(tmp.x-leg.rest.x)>.42||Math.abs(tmp.z-leg.rest.z)>.70;
        const yaw=Math.atan2(2*(rootQ.w*rootQ.y+rootQ.x*rootQ.z),1-2*(rootQ.y*rootQ.y+rootQ.z*rootQ.z));
        const angle=Math.abs(Math.atan2(Math.sin(yaw-leg.plantedYaw),Math.cos(yaw-leg.plantedYaw)));
        if(misplaced||angle>.68){tag=`turn:${serial}:${Math.floor(clock*10)}:${i}`;duration=fast?.16:.26;drag=false;}
      }
      if(tag&&tag!==leg.tag&&!leg.active)startStep(leg,tag,duration,drag);
      if(frame.state==='windup'&&leg.active&&!leg.tag.endsWith(':settle')){
        leg.from.copy(leg.at);leg.goal.copy(leg.at);leg.goal.y=rootPos.y+leg.rest.y;
        leg.elapsed=0;leg.duration=.16;leg.lift=0;leg.rush=false;leg.drag=false;leg.startPitch=leg.pitch;leg.startClearance=Math.max(0,leg.at.y-rootPos.y-ankleHeight(leg));leg.tag+=':settle';
      }
      if(leg.active){
        leg.elapsed+=dt;const u=clamp(leg.elapsed/leg.duration,0,1);
        if(leg.rush){
          // The supported gameplay direction can reverse at a quarry edge.
          // Retarget the airborne catch to the new landing, continuously.
          offset.copy(leg.rest);root.localToWorld(offset);
          offset.addScaledVector(velocity,Math.max(0,leg.duration-leg.elapsed)+.035);
          leg.goal.lerp(offset,1-Math.exp(-dt*24));
        }
        // The injured foot sticks twice, scrapes in a shallow outward arc,
        // then slaps flat. The sound leg clears the ground in one heavy lift.
        const progress=leg.drag?(u<.28?.09*smooth(u/.28):u<.53?.09+.11*smooth((u-.28)/.25):.2+.8*smooth((u-.53)/.47)):smooth(u);
        leg.at.lerpVectors(leg.from,leg.goal,progress);
        const lift=leg.drag?.025+.055*Math.sin(u*Math.PI*3)**2:leg.lift;
        const side=leg.name==='Left'?1:-1;
        tmp.set(side*Math.sin(Math.PI*u)*(leg.drag?.085:.045),0,0).applyQuaternion(rootQ);leg.at.add(tmp);
        tmp.copy(leg.at).sub(leg.previous).setY(0);
        if(tmp.length()>dt*16&&dt>0){tmp.setLength(dt*16);leg.at.x=leg.previous.x+tmp.x;leg.at.z=leg.previous.z+tmp.z;}
        leg.pitch=leg.startPitch*(1-smooth(u))+(leg.drag?.37*Math.sin(Math.PI*u):-.28*Math.sin(Math.PI*u)+.15*Math.sin(Math.PI*u*2));
        footOrientation(leg);leg.at.y=rootPos.y+ankleHeight(leg)+Math.sin(Math.PI*u)*lift+leg.startClearance*(1-smooth(u));
        if(u>=1){leg.active=false;leg.strike=0;leg.pitch=0;footOrientation(leg);leg.at.y=rootPos.y+ankleHeight(leg);leg.anchor.copy(leg.at);leg.anchorQ.copy(leg.q);leg.plantedYaw=Math.atan2(2*(rootQ.w*rootQ.y+rootQ.x*rootQ.z),1-2*(rootQ.y*rootQ.y+rootQ.z*rootQ.z));}
      }else{
        leg.pitch=0;leg.q.copy(leg.anchorQ);leg.at.copy(leg.anchor);leg.at.y=rootPos.y+ankleHeight(leg);
      }
    }
  }
  function update(dt:number,frame:EnemyAnimationFrame,deathTime=0){
    const step=Math.max(0,Math.min(dt,.05));solveStep=step;restore();root.updateMatrixWorld(true);root.getWorldPosition(rootPos);root.getWorldQuaternion(rootQ);inverseRootQ.copy(rootQ).invert();
    const yaw=Math.atan2(2*(rootQ.w*rootQ.y+rootQ.x*rootQ.z),1-2*(rootQ.y*rootQ.y+rootQ.z*rootQ.z));
    if(!initialized||rootPos.distanceTo(lastRoot)>4){
      initialized=true;for(const [n,p] of restPlanes)planeNormals.get(n)!.copy(p).applyQuaternion(rootQ);for(const [n,q] of restBoneQ)priorBoneQ.get(n)!.copy(rootQ).multiply(q);lastRoot.copy(rootPos);lastYaw=yaw;clock=0;phase=0;previousState=frame.state;
      for(const leg of legs){leg.at.copy(root.localToWorld(leg.rest.clone()));leg.anchor.copy(leg.at);leg.q.copy(rootQ).multiply(leg.restQ);leg.anchorQ.copy(leg.q);leg.plantedYaw=yaw;leg.active=false;leg.tag='';}
    }
    if(step>0){velocity.copy(rootPos).sub(lastRoot).divideScalar(step);velocity.y=0;}
    else velocity.set(0,0,0);
    // The existing asset studio previews in place. Move its virtual conveyor,
    // while real gameplay always pins feet to the actual static world floor.
    if(frame.inPlace&&frame.alive){
      velocity.set(0,0,frame.state==='stagger'?-frame.speed:frame.speed).applyQuaternion(rootQ);
      for(const leg of legs)for(const v of [leg.from,leg.goal,leg.at,leg.anchor])v.addScaledVector(velocity,-step);
    }
    localVelocity.copy(velocity).applyQuaternion(inverseRootQ);
    const dyaw=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));
    turnLag=(turnLag+dyaw)*Math.exp(-step*4.5);
    acceleration+=(clamp((localVelocity.z-lastVelocity.z)/Math.max(.016,step),-12,12)*.025-acceleration)*(1-Math.exp(-step*9));
    lastVelocity.copy(localVelocity);lastYaw=yaw;lastRoot.copy(rootPos);
    if(frame.alive){clock=frame.locomotionTime??clock+step;phase=frame.gaitPhase??fract(clock/GOBLIN_STUMBLE_PERIOD);lastAliveFrame=frame;}
    if(frame.state!==previousState){serial++;if(previousState==='lurch')settle=1;previousState=frame.state;}
    settle=Math.max(0,settle-step*1.7);
    if(frame.alive)plants(step,frame);
    const f=frame.alive?frame:lastAliveFrame??frame,death=frame.alive?1:1-smooth(deathTime/.45);
    const p=phase,late=p-.04,headLate=p-.085;
    if(frame.alive){
      const targets={wind:f.state==='windup'?smooth(f.stateTime/.32):0,lurch:f.state==='lurch'?1:0,stagger:f.state==='stagger'?1-smooth(f.stateTime/1.1):0};
      for(const key of ['wind','lurch','stagger'] as const){
        const rate=targets[key]>envelope[key]?(key==='stagger'?35:24):8;
        envelope[key]+=(targets[key]-envelope[key])*(1-Math.exp(-step*rate));
      }
    }
    const {wind,lurch,stagger}=envelope;
    const impact=Math.max(...legs.map(leg=>Math.exp(-leg.strike*19)*Math.cos(leg.strike*28)));
    const buckle=Math.max(0,channel(p,2)*-1-.25);
    const leanSide=clamp(localVelocity.x*.09,-.25,.25);
    const drop=clamp(channel(p,2)-lurch*.21-wind*.11-impact*.065,-.50,-.055)*death;
    offset.copy(hipRest).add(new THREE.Vector3((channel(p,1)+leanSide*.3)*death,drop,(.05+lurch*.15-stagger*.18)*death));
    root.localToWorld(offset);hips.position.copy(hips.parent!.worldToLocal(offset));hips.updateWorldMatrix(true,true);
    rotate(hips,(channel(p,3)*.30-lurch*.08-stagger*.2)*death,-turnLag*.32*death,(channel(p,4)*.42+leanSide*.4)*death);
    const fold=(channel(late,5)+wind*.16+lurch*.26+acceleration*.24-stagger*.74+settle*Math.sin(f.stateTime*14)*.12)*death;
    rotate(low,fold*.34,0,channel(late,6)*.22*death);
    rotate(mid,fold*.31,-turnLag*.2*death,channel(late,6)*.27*death);
    rotate(chest,fold*.35+impact*.05,Math.sin(clock*.8)*.035*death,(channel(late,6)*.24+leanSide*.45)*death);
    // Animate around the measured neck, not the auto-rig's nose-tip Head pivot.
    const headDrop=(.16+channel(headLate,5)*.23+lurch*.12-wind*.20-stagger*.45)*death;
    rotate(neck,headDrop,clamp(-turnLag*.85,-.65,.65)*death,(-.22-channel(headLate,6)*.5+Math.sin(clock*1.27)*.065)*death);
    rotate(head,-headDrop*.18,Math.sin(clock*.51)*.06*death,Math.sin(clock*2.1)*.035*death);
    const contacts:Partial<Record<EnemyLeg,boolean>>={hindLeft:!legs[0].active,hindRight:!legs[1].active,frontLeft:false,frontRight:false};
    const elastic=sampleEnemyElasticity('grunt',frame,p,contacts,deathTime,NIGHTWORKS_GOBLIN_ELASTICITY_PROFILE);
    segment(low,elastic.torso-impact*.018*death);segment(mid,1+(elastic.torso-1)*.45);
    segment(neck,1+(elastic.torso-1)*.28);
    let maxReach=0,slip=0,correction=0;
    for(const leg of legs){
      const role=leg.name==='Left'?'hindLeft':'hindRight';segment(leg.upper,elastic.legs[role].upper);segment(leg.lower,elastic.legs[role].lower);
      if(!frame.alive){leg.at.copy(root.localToWorld(leg.rest.clone()));leg.pitch=0;footOrientation(leg);}
      leg.upper.updateWorldMatrix(true,true);leg.upper.getWorldPosition(p0);leg.lower.getWorldPosition(p1);leg.foot.getWorldPosition(p2);
      const length=p0.distanceTo(p1)+p1.distanceTo(p2),reach=p0.distanceTo(leg.at);
      correction=Math.max(correction,reach-length);
      if(frame.alive&&reach>length*.96&&!leg.active){
        // Release a support before it is out of reach. A short scrambling
        // step is preferable to an impossible long planted leg at a turn.
        startStep(leg,`catch:${serial}:${clock.toFixed(3)}`,f.state==='lurch'?.12:.22,false);
      }
      if(reach>length-.003){
        tmp.copy(leg.at).sub(p0).setLength(length-.003);leg.at.copy(p0).add(tmp);
        if(frame.alive){leg.active=true;leg.anchor.copy(leg.at);}
      }
      pole.set(leg.name==='Left'?.2:-.2,-.04,1);
      maxReach=Math.max(maxReach,solve(leg.upper,leg.lower,leg.foot,leg.at,pole));
      // Full matrices preserve the boot's flat planted sole under independent
      // thigh/shin stretch, including shear in the inherited parent transform.
      leg.foot.getWorldScale(scale);desiredMatrix.compose(leg.at,leg.q,scale);
      matrix.copy(leg.foot.parent!.matrixWorld).invert().multiply(desiredMatrix);
      leg.foot.matrix.copy(matrix);matrix.decompose(leg.foot.position,leg.foot.quaternion,leg.foot.scale);leg.foot.matrixAutoUpdate=false;leg.foot.matrixWorldNeedsUpdate=true;
      if(!leg.active&&frame.alive)slip=Math.max(slip,Math.hypot(leg.at.x-leg.anchor.x,leg.at.z-leg.anchor.z));
    }
    // One arm hangs with delayed pendulum weight; the other gropes ahead and
    // splays abruptly to arrest a knee buckle. The palms never pass through
    // the torso, and recoil reaches out before the feet catch up backwards.
    for(const [i,name] of (['Left','Right'] as const).entries()){
      const side=i===0?1:-1,upper=get(name+'Arm'),lower=get(name+'ForeArm'),hand=get(name+'Hand');
      const role=i===0?'frontLeft':'frontRight';segment(upper,elastic.legs[role].upper);segment(lower,elastic.legs[role].lower);
      offset.set(side*(.91+buckle*.8+lurch*.13+stagger*.17),
        (i===0?.88:1.35)+drop*.55+(i===0?Math.sin(clock*1.65-.7)*.09:Math.sin(clock*1.2)*.12)+stagger*.54,
        (i===0?-.20:.33)+lurch*.43+stagger*.16+Math.sin(clock*1.4+i)*.11);
      offset.applyAxisAngle(Y,-turnLag*.7);
      if(frame.alive&&step>0){
        // Separate shoulder/hand inertia: the heavy hanging glove trails
        // longer; the reaching hand catches the fall sooner, then rebounds.
        const frequency=i===0?8.5:12.5,damping=i===0?.72:.82;
        tmp.copy(offset).sub(handTargets[i]).multiplyScalar(frequency*frequency).addScaledVector(handVelocities[i],-2*damping*frequency);
        handVelocities[i].addScaledVector(tmp,step);handTargets[i].addScaledVector(handVelocities[i],step);
      }
      offset.copy(handTargets[i]);root.localToWorld(offset);pole.set(side, -.2, -.75);solve(upper,lower,hand,offset,pole);
      hand.getWorldQuaternion(q2);q1.setFromEuler(euler.set(.2+wind*.16,side*.18,side*(.18+buckle*.45)));
      q2.multiply(q1);orient(hand,q2);
    }
    root.updateMatrixWorld(true);
    diagnostic.phase=p;diagnostic.leftContact=!legs[0].active;diagnostic.rightContact=!legs[1].active;
    diagnostic.leftFoot=legs[0].at.toArray();diagnostic.rightFoot=legs[1].at.toArray();diagnostic.pelvis=hips.getWorldPosition(tmp).toArray();
    diagnostic.plantedSlip=slip;diagnostic.reachError=maxReach;diagnostic.reachCorrection=correction;diagnostic.bodyDrop=drop;diagnostic.travel+=velocity.length()*step;
    root.userData.goblinStumble=diagnostic;
    contacts.hindLeft=!legs[0].active;contacts.hindRight=!legs[1].active;
    return {phase:p,contacts};
  }
  return {update,diagnostics:diagnostic,
    getMouthPosition(target:THREE.Vector3){head.updateWorldMatrix(true,false);target.copy(mouthLocal).applyMatrix4(head.matrixWorld);return true;},
    reset(){initialized=false;clock=0;phase=0;turnLag=0;acceleration=0;settle=0;lastAliveFrame=null;envelope.wind=envelope.lurch=envelope.stagger=0;
      handTargets[0].set(.91,.88,-.2);handTargets[1].set(-.91,1.35,.33);handVelocities.forEach(v=>v.set(0,0,0));lastVelocity.set(0,0,0);diagnostic.steps=0;diagnostic.travel=0;restore();},
  };
}
