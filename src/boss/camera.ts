import * as THREE from 'three';
import type { CrabChiefEncounter } from './crabChief';

/** Close, boss-facing presentation. Restore before the ordinary rig updates. */
export class ChiefCamera {
  private applied=false;
  private readonly basePosition=new THREE.Vector3();
  private readonly baseQuaternion=new THREE.Quaternion();
  private readonly baseUp=new THREE.Vector3();
  private readonly eye=new THREE.Vector3();
  private readonly desired=new THREE.Vector3();
  private readonly forward=new THREE.Vector3(0,0,-1);
  private readonly aim=new THREE.Vector3();
  private active:CrabChiefEncounter|null=null;
  private distance=7;
  restore(camera:THREE.PerspectiveCamera):void {
    if(!this.applied)return;
    camera.position.copy(this.basePosition);camera.quaternion.copy(this.baseQuaternion);camera.up.copy(this.baseUp);this.applied=false;
  }
  apply(camera:THREE.PerspectiveCamera,boss:CrabChiefEncounter|null,subject:THREE.Vector3,dt:number,snap=false):void {
    if(!boss){this.active=null;return;}
    const reset=snap||this.active!==boss;this.active=boss;
    this.basePosition.copy(camera.position);this.baseQuaternion.copy(camera.quaternion);this.baseUp.copy(camera.up);this.applied=true;
    const centre=boss.model.root.position;
    this.forward.subVectors(centre,subject);this.forward.y=0;
    if(this.forward.lengthSq()<.01)this.forward.set(0,0,-1);else this.forward.normalize();
    const separation=Math.max(1,Math.hypot(centre.x-subject.x,centre.z-subject.z));
    const height=5.8,top=boss.model.cameraTop.y,head=subject.y+2.6;
    const half=THREE.MathUtils.degToRad(camera.fov)*.5*.9;
    let wanted=6.5;
    for(;wanted<9;wanted+=.25){
      const eyeY=subject.y+height;
      const low=Math.min(Math.atan2(subject.y+.02-eyeY,wanted),Math.atan2(centre.y-eyeY,separation+wanted));
      const high=Math.max(Math.atan2(head-eyeY,wanted),Math.atan2(top-eyeY,separation+wanted));
      if(high-low<=half*2)break;
    }
    this.distance=reset?wanted:THREE.MathUtils.lerp(this.distance,wanted,1-Math.exp(-7*Math.max(0,dt)));
    this.desired.copy(subject).addScaledVector(this.forward,-this.distance);this.desired.y+=height;
    // Subject/root positions are already render-interpolated. Stay on their
    // radial line so a fast chief leap cannot pull the lens through the rider.
    this.eye.copy(this.desired);
    camera.position.copy(this.eye);camera.up.set(0,1,0);
    // Aim in the chief's direction; pitch frames both the rider and the chief.
    this.forward.subVectors(centre,this.eye);this.forward.y=0;this.forward.normalize();
    const heroDepth=Math.max(.5,(subject.x-this.eye.x)*this.forward.x+(subject.z-this.eye.z)*this.forward.z);
    const bossDepth=Math.max(.5,(centre.x-this.eye.x)*this.forward.x+(centre.z-this.eye.z)*this.forward.z);
    const low=Math.min(Math.atan2(subject.y+.02-this.eye.y,heroDepth),Math.atan2(centre.y-this.eye.y,bossDepth));
    const high=Math.max(Math.atan2(head-this.eye.y,heroDepth),Math.atan2(top-this.eye.y,bossDepth));
    const pitch=(low+high)*.5;
    this.aim.copy(this.eye).addScaledVector(this.forward,Math.cos(pitch)*20);this.aim.y+=Math.sin(pitch)*20;
    camera.lookAt(this.aim);camera.updateMatrixWorld(true);
  }
  get heading():THREE.Vector3{return this.forward;}
  get diagnostics(){return{active:!!this.active,distance:this.distance,eye:this.eye.toArray(),bossFacing:this.forward.toArray()};}
}
