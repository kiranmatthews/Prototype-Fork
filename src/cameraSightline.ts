import * as THREE from 'three';
import {CameraHeroFraming} from './cameraHeroFraming';

interface CameraSurfaces {raycastGround(ray:THREE.Raycaster):THREE.Intersection[];}

/** Keep a falling rider visible beneath a ledge without choosing another
 * heading or lens. Only a blocked sightline lowers the ordinary trailing eye;
 * clear space restores it smoothly. The next frame starts from the base rig. */
export class CameraSightline {
  private saved=false;
  private offsetY=0;
  private readonly eye=new THREE.Vector3();
  private readonly rotation=new THREE.Quaternion();
  private readonly candidate=new THREE.Vector3();
  private readonly target=new THREE.Vector3();
  private readonly direction=new THREE.Vector3();
  private readonly ray=new THREE.Raycaster();
  private readonly framing=new CameraHeroFraming();
  get diagnostics(){return {offsetY:this.offsetY};}
  restore(camera:THREE.PerspectiveCamera):void {
    if(!this.saved)return;
    camera.position.copy(this.eye);camera.quaternion.copy(this.rotation);this.saved=false;
  }
  private clear(eye:THREE.Vector3,bounds:THREE.Box3,surfaces:CameraSurfaces):boolean {
    const x=(bounds.min.x+bounds.max.x)/2,z=(bounds.min.z+bounds.max.z)/2;
    for(const t of [.15,.5,.85]){
      this.target.set(x,THREE.MathUtils.lerp(bounds.min.y,bounds.max.y,t),z);
      this.direction.subVectors(eye,this.target);const distance=this.direction.length();
      this.direction.divideScalar(Math.max(.001,distance));
      this.ray.set(this.target,this.direction);this.ray.near=.15;this.ray.far=Math.max(.15,distance-.12);
      if(surfaces.raycastGround(this.ray).some(hit=>hit.object.visible&&!hit.object.userData.editorGhost))return false;
    }
    return true;
  }
  apply(camera:THREE.PerspectiveCamera,bounds:THREE.Box3|null|undefined,surfaces:CameraSurfaces,dt:number,snap=false):void {
    if(!bounds||bounds.isEmpty()){this.offsetY=0;this.framing.reset();return;}
    if(snap)this.offsetY=0;
    this.eye.copy(camera.position);this.rotation.copy(camera.quaternion);
    let goal=0;
    if(!this.clear(this.eye,bounds,surfaces)){
      // A horizontal platform can sit between the high eye and the rider
      // after an edge drop. Stay on the same side, below its underside.
      for(let drop=.5;drop<=8;drop+=.5){
        this.candidate.copy(this.eye);this.candidate.y-=drop;
        if(this.clear(this.candidate,bounds,surfaces)){goal=-drop;break;}
      }
    }
    if(goal<0)this.offsetY=goal;
    else this.offsetY*=Math.exp(-8*Math.max(0,dt));
    if(Math.abs(this.offsetY)<.01)this.offsetY=0;
    this.candidate.copy(this.eye);this.candidate.y+=this.offsetY;
    if(this.offsetY&&!this.clear(this.candidate,bounds,surfaces)&&goal===0){this.offsetY=0;this.candidate.copy(this.eye);}
    this.saved=true;camera.position.copy(this.candidate);
    // Keep the same minimal pose fit through contact and the landing squash.
    // Releasing it as soon as grounded can put the crouched body below frame.
    this.framing.apply(camera,bounds,dt,snap);camera.updateMatrixWorld();
  }
}
