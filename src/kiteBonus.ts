import * as THREE from 'three';
import {solveTwoBoneIk} from './animation/ik';
import {BONUS_PLATFORM_HEIGHT} from './bonusPlatform';

export const KITE_BONUS_TILT = Math.PI * .4;
export interface KiteBonusFrame {
  center:THREE.Vector3; normal:THREE.Vector3; rotation:THREE.Quaternion;
  feet:[THREE.Vector3,THREE.Vector3]; body:THREE.Vector3;
}
export function kiteBonusFrame(group:THREE.Object3D):KiteBonusFrame {
  group.updateWorldMatrix(true,false);
  const center=group.localToWorld(new THREE.Vector3(0,BONUS_PLATFORM_HEIGHT+.025,-.25));
  const rotation=group.getWorldQuaternion(new THREE.Quaternion());
  const normal=new THREE.Vector3(0,1,0).applyQuaternion(rotation);
  const feet=[-.34,.34].map(x=>group.localToWorld(new THREE.Vector3(x,BONUS_PLATFORM_HEIGHT+.025,-.25))) as [THREE.Vector3,THREE.Vector3];
  return {center,normal,rotation,feet,body:center.clone().addScaledVector(normal,.60).add(new THREE.Vector3(0,-.8,0))};
}

/** Automatic contact uses the existing body and actual sole sockets. */
export class KiteBonusDock {
  elapsed=0;
  readonly errors=[0,0];
  readonly normalErrors=[0,0];
  private readonly q=new THREE.Quaternion();
  private readonly footQ=new THREE.Quaternion();
  private readonly point=new THREE.Vector3();
  private readonly pole=new THREE.Vector3();
  constructor(readonly frame:KiteBonusFrame,readonly from:THREE.Vector3){}
  step(dt:number,pos:THREE.Vector3){
    this.elapsed+=dt;
    const t=THREE.MathUtils.smoothstep(this.elapsed,0,.28);
    pos.lerpVectors(this.from,this.frame.body,t);
  }
  pose(body:THREE.Object3D,rider:THREE.Object3D,board:THREE.Object3D|null){
    if(board)board.visible=false;
    body.rotation.y=0;body.rotation.x=-.12;
    const torso=rider.getObjectByName('torso-root');if(torso)torso.rotation.y=0;
    body.updateWorldMatrix(true,true);
    this.footQ.copy(this.frame.rotation).multiply(this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,Math.PI));
    for(const [i,side] of ['left','right'].entries()){
      const root=rider.getObjectByName(`hip-${side}`),mid=rider.getObjectByName(`knee-${side}`),end=rider.getObjectByName(`ankle-${side}`),effector=rider.getObjectByName(`socket-foot-${side}`);
      if(!root||!mid||!end||!effector)continue;
      const target=this.frame.feet[i];
      this.pole.copy(target).addScaledVector(this.frame.normal,.8);this.pole.x+=(i===0?-.18:.18);
      for(let pass=0;pass<8;pass++){
        end.parent!.getWorldQuaternion(this.q);end.quaternion.copy(this.q.invert().multiply(this.footQ));
        solveTwoBoneIk({root,mid,end,effector,target,pole:this.pole,accountForParentScale:true,tolerance:.001});
      }
      end.parent!.getWorldQuaternion(this.q);end.quaternion.copy(this.q.invert().multiply(this.footQ));
      end.updateWorldMatrix(true,true);
      this.errors[i]=effector.getWorldPosition(this.point).distanceTo(target);
      end.getWorldQuaternion(this.q);
      this.normalErrors[i]=1-this.point.set(0,1,0).applyQuaternion(this.q).dot(this.frame.normal);
    }
  }
}
