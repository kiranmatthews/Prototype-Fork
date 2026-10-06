import * as THREE from 'three';
import type { Enemy } from '../level';
import { sfx } from '../audio';
import { MOA } from './moa';

const tip=new THREE.Vector3(),size=new THREE.Vector3(.68,.72,.68);
/** A readable, dodgeable beak strike, with a locked bearing after anticipation.
 * Body contact is safe while the bird catches its breath; ordinary attacks win. */
export function stepMoa(e:Enemy,dt:number,player:THREE.Vector3):void {
  const previous=e.stateT;e.stateT+=dt;
  const dx=player.x-e.group.position.x,dz=player.z-e.group.position.z,distance=Math.hypot(dx,dz);
  const nearby=distance<3.8&&Math.abs(player.y-e.baseY)<1.8;
  const change=(state:string)=>{e.state=state;e.stateT=0;};
  if(e.state==='patrol'){
    if(nearby&&e.stateT>.8){change('windup');e.group.rotation.y=Math.atan2(dx,dz);}
    else if(e.stateT>3.5+(Math.abs(e.cross)%1)){change('idle');}
    else {
      const axis=e.axis==='z'?'z':'x';
      e.group.position[axis]+=e.dir*e.speed*dt;
      if(e.group.position[axis]>=e.x1){e.group.position[axis]=e.x1;e.dir=-1;}
      else if(e.group.position[axis]<=e.x0){e.group.position[axis]=e.x0;e.dir=1;}
      e.group.rotation.y=axis==='z'?(e.dir>0?0:Math.PI):e.dir*Math.PI/2;
    }
  }else if(e.state==='idle'){
    if(nearby){change('windup');e.group.rotation.y=Math.atan2(dx,dz);}
    else if(e.stateT>.6)change('squawk');
  }else if(e.state==='squawk'){
    if(previous<.24&&e.stateT>=.24&&distance<32)sfx.play('moaSquawk',.72*Math.max(0,1-distance/32),1,.035);
    if(e.stateT>=MOA.squawk)change('patrol');
  }else if(e.state==='windup'){
    if(e.stateT<.32&&nearby)e.group.rotation.y=Math.atan2(dx,dz);
    if(e.stateT>=MOA.windup){change('peck');if(distance<24)sfx.play('moaPeck',.65*Math.max(0,1-distance/24),1,.02);}
  }else if(e.state==='peck'){
    if(e.stateT>=MOA.peck)change('recover');
  }else if(e.state==='recover'&&e.stateT>=MOA.recover)change('patrol');
  e.touchHurt=e.state==='patrol'||e.state==='windup'||e.state==='peck';
}

/** Called after the pose update, so the damage volume follows the actual bill. */
export function updateMoaAttack(e:Enemy):void {
  e.attackBox??=new THREE.Box3();e.attackBox.makeEmpty();
  if(e.alive&&e.state==='peck'&&e.stateT>=.08&&e.stateT<=.25&&e.visual.getAttackPosition?.(tip)){
    e.attackBox.setFromCenterAndSize(tip,size);
  }
}
