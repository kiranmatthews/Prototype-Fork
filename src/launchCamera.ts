import * as THREE from 'three';
import type { LaunchPresentation } from './animation/launchJump';

/** Metres/seconds. The boss longfall camera inspires the vertical lag, but Roo
 * needs more horizontal clearance and a bounded pullback for platform landings. */
export const LAUNCH_CAMERA = {
  enterSeconds: .6, exitSeconds: .5,
  height: 10.5, distance: 4.6, aimHeight: 1.25, lookAhead: 1.4,
  descentDeadband: 3.2, descentCatchRate: 2.4, maxExtraHeight: 9,
  orbitRadiansPerSecond: 1.05, orbitDeadzone: .16,
} as const;

/** Restores the underlying camera before its next update. It never writes the
 * input heading, character transform, physics state or field of view. */
export class LaunchCamera {
  private weight=0;
  private launchId=-1;
  private yaw=0;
  private height=0;
  private saved=false;
  private activeLastFrame=false;
  private readonly basePosition=new THREE.Vector3();
  private readonly baseRotation=new THREE.Quaternion();
  private readonly shotPosition=new THREE.Vector3();
  private readonly shotRotation=new THREE.Quaternion();
  private readonly aim=new THREE.Vector3();
  private readonly matrix=new THREE.Matrix4();
  private readonly up=new THREE.Vector3(0,1,0);
  get diagnostics(){return {weight:this.weight,launchId:this.launchId,height:this.height,yaw:this.yaw,position:this.shotPosition.toArray()};}
  restore(camera:THREE.PerspectiveCamera):void {
    if(!this.saved)return;
    camera.position.copy(this.basePosition);camera.quaternion.copy(this.baseRotation);
    this.saved=false;
  }
  apply(camera:THREE.PerspectiveCamera,subject:THREE.Vector3,launch:LaunchPresentation|null,dt:number,snap:boolean,lookX=0):void {
    const t=Math.max(0,Math.min(.1,dt));
    if(snap){this.weight=0;this.launchId=-1;this.activeLastFrame=false;}
    const active=!!launch;
    if(launch && launch.id!==this.launchId){
      // Chained pads retain their current shot; fresh takeoffs inherit the
      // actual view direction so entry cannot spin around the character.
      if(this.weight<.01){
        this.yaw=Math.atan2(camera.position.x-subject.x,camera.position.z-subject.z);
        this.height=subject.y+LAUNCH_CAMERA.height;
      }
      this.launchId=launch.id;
    }
    const target=launch?.strength??0;
    const duration=target>this.weight?LAUNCH_CAMERA.enterSeconds:LAUNCH_CAMERA.exitSeconds;
    this.weight=THREE.MathUtils.damp(this.weight,target,4.6/duration,t);
    if(!active&&this.weight<.001){this.weight=0;this.activeLastFrame=false;return;}
    if(!active&&!this.activeLastFrame&&this.weight===0)return;
    if(launch){
      const stick=Math.abs(lookX)>LAUNCH_CAMERA.orbitDeadzone
        ?Math.sign(lookX)*(Math.abs(lookX)-LAUNCH_CAMERA.orbitDeadzone)/(1-LAUNCH_CAMERA.orbitDeadzone):0;
      this.yaw-=stick*LAUNCH_CAMERA.orbitRadiansPerSecond*t;
      const desired=subject.y+LAUNCH_CAMERA.height;
      if(desired>=this.height)this.height=desired;
      else {
        const extra=this.height-desired;
        const gather=THREE.MathUtils.smoothstep(launch.gather,0,1);
        const deadband=LAUNCH_CAMERA.descentDeadband*(1-gather);
        this.height-=Math.max(0,extra-deadband)*(1-Math.exp(-LAUNCH_CAMERA.descentCatchRate*t));
        this.height=Math.min(this.height,desired+LAUNCH_CAMERA.maxExtraHeight*(1-gather));
      }
      const x=Math.sin(this.yaw),z=Math.cos(this.yaw);
      this.shotPosition.set(subject.x+x*LAUNCH_CAMERA.distance,this.height,subject.z+z*LAUNCH_CAMERA.distance);
      this.aim.set(subject.x-x*LAUNCH_CAMERA.lookAhead,subject.y+LAUNCH_CAMERA.aimHeight,subject.z-z*LAUNCH_CAMERA.lookAhead);
      this.matrix.lookAt(this.shotPosition,this.aim,this.up);this.shotRotation.setFromRotationMatrix(this.matrix);
    }else if(this.activeLastFrame){
      // Exit begins from the last launch shot; the live base keeps updating
      // underneath during the half-second release.
      this.activeLastFrame=false;
    }
    this.basePosition.copy(camera.position);this.baseRotation.copy(camera.quaternion);this.saved=true;
    camera.position.lerpVectors(this.basePosition,this.shotPosition,this.weight);
    camera.quaternion.slerpQuaternions(this.baseRotation,this.shotRotation,this.weight);
    camera.updateMatrixWorld();
    this.activeLastFrame=active;
  }
}
