import * as THREE from 'three';

import type { EnemyAnimationFrame } from './types';

const X=new THREE.Vector3(1,0,0);
type Pose={upper:THREE.Quaternion;lower:THREE.Quaternion;turn:number};

const KEYS=[{time:0,key:'neutral'},{time:.04,key:'neutral'},{time:.13,key:'lift'},{time:.24,key:'kick'},{time:.26,key:'kick'},
  {time:.42,key:'lift'},{time:.52,key:'tuck'},{time:.65,key:'neutral'}] as const;

/** Author the bend once at each motion extreme. Interpolate those rotations
 * during playback, so a nearly straight knee cannot flip its bend plane. */
export function createFrogKick(model:THREE.Object3D) {
  let enabled=false;
  model.traverse(node=>{if(node.userData.enemyRig?.frogHopRig==='symmetric-keyed-v1')enabled=true;});
  if(!enabled)return undefined;
  const torso=model.getObjectByName('torso')!;
  // Measured belly clearance and front sole offsets for this Meshy surface.
  torso.position.y+=.06;
  const orientation=(direction:THREE.Vector3,normal:THREE.Vector3)=>{
    const z=direction.clone().normalize(),x=normal.clone();
    x.addScaledVector(z,-x.dot(z)).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,new THREE.Vector3().crossVectors(z,x),z));
  };
  const chains=(['Left','Right'] as const).map(side=>{
    const sign=side==='Left'?1:-1;
    model.getObjectByName(`frontUpper${side}`)!.position.y-=.0619838;
    const upper=model.getObjectByName(`hindUpper${side}`)!;
    const lower=model.getObjectByName(`hindLower${side}`)!;
    const ankle=model.getObjectByName(`hindAnkle${side}`)!;
    const foot=model.getObjectByName(`hindFoot${side}`)!;
    const a=lower.position.clone(),b=ankle.position.clone();
    const sourceNormal=new THREE.Vector3().crossVectors(a,b).normalize();
    const sourceUpper=orientation(a,sourceNormal).invert(),sourceLower=orientation(b,sourceNormal).invert();
    function author(target:THREE.Vector3,pole:THREE.Vector3,turn:number):Pose {
      const la=a.length(),lb=b.length(),distance=THREE.MathUtils.clamp(target.length(),Math.abs(la-lb)+.01,la+lb-.015);
      const direction=target.normalize();pole.addScaledVector(direction,-pole.dot(direction)).normalize();
      const along=(la*la-lb*lb+distance*distance)/(2*distance);
      const knee=direction.clone().multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,la*la-along*along)));
      const end=direction.multiplyScalar(distance),normal=new THREE.Vector3().crossVectors(knee,end).normalize();
      return {upper:orientation(knee,normal).multiply(sourceUpper),lower:orientation(end.sub(knee),normal).multiply(sourceLower),
        turn};
    }
    const neutral=author(new THREE.Vector3(sign*.09,-.105,.10),new THREE.Vector3(sign*.65,.12,1),0);
    const lift=author(new THREE.Vector3(sign*.20,.20,-.24),new THREE.Vector3(sign*.6,-1,.2),.95);
    const kick=author(new THREE.Vector3(sign*.10,-.06,-1.08),new THREE.Vector3(sign*.3,-1,.1),Math.PI);
    const tuck=author(new THREE.Vector3(sign*.22,-.06,.08),new THREE.Vector3(sign*.65,.2,1),.7);
    return {upper,lower,ankle,foot,neutral,lift,kick,tuck};
  });
  const u=new THREE.Quaternion(),l=new THREE.Quaternion(),a=new THREE.Quaternion(),f=new THREE.Quaternion();
  function pose(frame?:EnemyAnimationFrame) {
    const time=frame?.alive&&frame.state==='leap'?frame.stateTime:0;
    let from:typeof KEYS[number]=KEYS[0],to:typeof KEYS[number]=KEYS[KEYS.length-1];
    for(let i=1;i<KEYS.length;i++)if(time<KEYS[i].time){from=KEYS[i-1];to=KEYS[i];break;}
    const t=THREE.MathUtils.clamp((time-from.time)/(to.time-from.time),0,1),mix=t*t*(3-2*t);
    for(const c of chains){
      const start=c[from.key],end=c[to.key];
      u.copy(start.upper).slerp(end.upper,mix);l.copy(start.lower).slerp(end.lower,mix);
      // An explicit sagittal arc avoids the ambiguous shortest path at 180°.
      const turn=THREE.MathUtils.lerp(start.turn,end.turn,mix);
      a.setFromAxisAngle(X,-.288+turn);f.setFromAxisAngle(X,turn);
      c.upper.quaternion.copy(u);
      c.lower.quaternion.copy(u).invert().multiply(l);
      c.ankle.quaternion.copy(l).invert().multiply(a);
      c.foot.quaternion.copy(a).invert().multiply(f);
    }
  }
  pose();
  return {pose,nodes:chains.map(c=>c.ankle),contact:(side:'Left'|'Right')=>chains[side==='Left'?0:1].ankle};
}
