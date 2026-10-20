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
  private orbitYaw=Math.PI;
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
    const dx=centre.x-subject.x,dz=centre.z-subject.z;
    const separationSq=dx*dx+dz*dz;
    const wantedYaw=separationSq>.01?Math.atan2(dx,dz):this.orbitYaw;
    if(reset)this.orbitYaw=wantedYaw;
    else if(separationSq>4){
      // A lunge or a rider passing the chief must not whip the orbit around
      // in one frame. Inside two metres keep the last side of the encounter.
      const turn=Math.atan2(Math.sin(wantedYaw-this.orbitYaw),Math.cos(wantedYaw-this.orbitYaw));
      const seconds=Math.max(0,dt),limit=THREE.MathUtils.degToRad(150)*seconds;
      this.orbitYaw+=THREE.MathUtils.clamp(turn*(1-Math.exp(-6*seconds)),-limit,limit);
    }
    this.forward.set(Math.sin(this.orbitYaw),0,Math.cos(this.orbitYaw));
    const height=5.8,top=boss.model.cameraTop.y,head=subject.y+2.6;
    const half=THREE.MathUtils.degToRad(camera.fov)*.5*.9;
    // While the orbit catches up, give the rider room beside the chief. A
    // fixed short distance can otherwise put the rider outside the picture
    // or let the chief cross behind the lens and flip its aim.
    const along=dx*this.forward.x+dz*this.forward.z;
    const across=Math.abs(dx*this.forward.z-dz*this.forward.x);
    const horizontalHalf=Math.atan(Math.tan(half)*camera.aspect)*.65;
    let wanted=Math.max(6.5,2-along,across/Math.tan(horizontalHalf)-along);
    for(let i=0;i<100;i++,wanted+=.25){
      const bx=dx+this.forward.x*wanted,bz=dz+this.forward.z*wanted;
      const bossDepth=Math.max(.5,Math.hypot(bx,bz));
      const heroDepth=Math.max(.5,wanted*(this.forward.x*bx+this.forward.z*bz)/bossDepth);
      const eyeY=subject.y+height;
      const low=Math.min(Math.atan2(subject.y+.02-eyeY,heroDepth),Math.atan2(centre.y-eyeY,bossDepth));
      const high=Math.max(Math.atan2(head-eyeY,heroDepth),Math.atan2(top-eyeY,bossDepth));
      if(high-low<=half*2)break;
    }
    // Expand immediately for framing; ease back to the usual close view.
    this.distance=reset? wanted:Math.max(wanted,THREE.MathUtils.lerp(this.distance,wanted,1-Math.exp(-7*Math.max(0,dt))));
    this.desired.copy(subject).addScaledVector(this.forward,-this.distance);this.desired.y+=height;
    // Orbit around the already interpolated rider, keeping the lens clear
    // of the character while the chief lunges across the arena.
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
