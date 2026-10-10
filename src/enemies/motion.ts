import * as THREE from 'three';
import type {EnemyAnimationFrame, EnemyKind} from './types';

/** Cycles per second, measured at the final displayed size. These limits keep
 * tiny source strides from turning a heavy animal into a vibrating toy. */
export const ENEMY_MOTION = {
  grunt:   {walkHz:2.15, runHz:2.15, breathHz:.32, head:.07, tail:.08},
  spiker:  {walkHz:1.8,  runHz:1.8,  breathHz:.28, head:.06, tail:.12},
  turtle:  {walkHz:1.25, runHz:1.25, breathHz:.22, head:.09, tail:.06},
  charger: {walkHz:1.75, runHz:2.8,  breathHz:.30, head:.055,tail:.12},
  hopper:  {walkHz:1.5,  runHz:1.5,  breathHz:.38, head:.06, tail:0},
  floater: {walkHz:0,    runHz:0,    breathHz:.27, head:.04, tail:0},
  sentry:  {walkHz:0,    runHz:0,    breathHz:.25, head:0,   tail:0},
  spinner: {walkHz:0,    runHz:0,    breathHz:.25, head:0,   tail:0},
} as const satisfies Record<Exclude<EnemyKind,'moa'>,unknown>;

export function enemyWalkRate(kind:Exclude<EnemyKind,'moa'>,speed:number,sourceSpeed:number,
  duration:number,displayScale:number,state:string,nightworks=false):number {
  if(!Number.isFinite(speed)||speed<=.05)return 0;
  const profile=ENEMY_MOTION[kind];
  const maxHz=nightworks?1.55:state==='dash'?profile.runHz:profile.walkHz;
  const authored= Math.max(.1,sourceSpeed)*Math.max(.01,displayScale);
  return Math.min(maxHz*Math.max(.001,duration),Math.abs(speed)/authored);
}

export const ease=(value:number):number=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};
/** A held glance with a soft entrance and return; no perpetual head waggle. */
export function enemyGlance(time:number):number {
  const t=((time%9)+9)%9;
  if(t<2||t>6.7)return 0;
  if(t<2.8)return ease((t-2)/.8);
  if(t<3.6)return 1;
  if(t<4.6)return 1-1.65*ease(t-3.6);
  if(t<5.5)return -.65;
  return -.65*(1-ease((t-5.5)/1.2));
}

/** Blend only the additive joint layer when a behaviour changes. The source
 * walk, root movement, foot contacts and aiming bearing keep their ownership. */
export function createEnemyPoseBlend(objects:readonly THREE.Object3D[]) {
  const rows=[...new Set(objects)].map(node=>({node,
    p:new THREE.Vector3(),q:new THREE.Quaternion(),s:new THREE.Vector3(),
    lastP:new THREE.Vector3(),lastQ:new THREE.Quaternion(),lastS:new THREE.Vector3(1,1,1),
    fromP:new THREE.Vector3(),fromQ:new THREE.Quaternion(),fromS:new THREE.Vector3(1,1,1),
  }));
  const q=new THREE.Quaternion(),targetQ=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3();
  let state='',elapsed=1,duration=.14,alive=true;
  return {
    begin(dt:number,frame:EnemyAnimationFrame){
      if(state!==frame.state&&state&&alive&&frame.alive){
        elapsed=0;duration=frame.kind==='sentry'||frame.kind==='hopper'?.035:.14;
        for(const r of rows){r.fromP.copy(r.lastP);r.fromQ.copy(r.lastQ);r.fromS.copy(r.lastS);}
      }
      state=frame.state;alive=frame.alive;elapsed+=dt;
      for(const r of rows){r.p.copy(r.node.position);r.q.copy(r.node.quaternion);r.s.copy(r.node.scale);}
    },
    end(){
      const mix=alive?ease(elapsed/duration):1;
      for(const r of rows){
        p.copy(r.node.position).sub(r.p);q.copy(r.q).invert().multiply(r.node.quaternion);s.copy(r.node.scale).divide(r.s);
        if(mix<1){p.lerpVectors(r.fromP,p,mix);targetQ.copy(q);q.copy(r.fromQ).slerp(targetQ,mix);s.lerpVectors(r.fromS,s,mix);}
        r.lastP.copy(p);r.lastQ.copy(q);r.lastS.copy(s);
        r.node.position.copy(r.p).add(p);r.node.quaternion.copy(r.q).multiply(q);r.node.scale.copy(r.s).multiply(s);
      }
    },
    reset(){state='';elapsed=1;alive=true;for(const r of rows){r.lastP.set(0,0,0);r.lastQ.identity();r.lastS.set(1,1,1);}},
  };
}
