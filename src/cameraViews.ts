import * as THREE from 'three';

export interface CameraView {
  p: readonly number[];
  s: readonly number[];
  yaw: number;
  feather: number;
  /** Optional world-space composition, independent of the gameplay heading. */
  cameraPosition?: readonly [number, number, number];
  cameraTarget?: readonly [number, number, number];
  cameraFov?: number;
  cameraAspect?: number;
}

export interface CameraViewMatch { view: CameraView; weight: number; }

/** The same spatial feather owns both the heading and optional framing. */
export function cameraViewAt(views: readonly CameraView[], x:number,y:number,z:number):CameraViewMatch|null {
  let match:CameraViewMatch|null=null;
  for(const view of views){
    const angle=THREE.MathUtils.degToRad(view.yaw),c=Math.cos(angle),s=Math.sin(angle);
    const dx=x-view.p[0],dz=z-view.p[2];
    const edge=Math.min(view.s[0]/2-Math.abs(c*dx-s*dz),view.s[1]/2-Math.abs(y-view.p[1]),view.s[2]/2-Math.abs(s*dx+c*dz));
    const weight=THREE.MathUtils.smoothstep(edge,0,Math.max(.001,view.feather));
    if(weight>(match?.weight??0))match={view,weight};
  }
  return match;
}

/** A presentation layer over the live rig, including chase and split cameras.
 * Restore the underlying pose before its next step so a fixed shot never
 * feeds back into follow-camera damping or changes movement physics. */
export class CameraViewFraming {
  private applied=false;
  private readonly position=new THREE.Vector3();
  private readonly orientation=new THREE.Quaternion();
  private readonly up=new THREE.Vector3();
  private fov=0;
  private readonly shotEye=new THREE.Vector3();
  private readonly shotTarget=new THREE.Vector3();
  private readonly shotMatrix=new THREE.Matrix4();
  private readonly shotOrientation=new THREE.Quaternion();
  private readonly worldUp=new THREE.Vector3(0,1,0);

  restore(camera:THREE.PerspectiveCamera):void {
    if(!this.applied)return;
    camera.position.copy(this.position);camera.quaternion.copy(this.orientation);camera.up.copy(this.up);
    if(camera.fov!==this.fov){camera.fov=this.fov;camera.updateProjectionMatrix();}
    this.applied=false;
  }

  apply(camera:THREE.PerspectiveCamera,match:CameraViewMatch|null):void {
    if(!match)return;
    const {view,weight}=match;
    if(!view.cameraPosition&&!view.cameraTarget&&view.cameraFov===undefined)return;
    this.position.copy(camera.position);this.orientation.copy(camera.quaternion);this.up.copy(camera.up);this.fov=camera.fov;
    this.applied=true;
    if(view.cameraPosition&&view.cameraTarget){
      this.shotEye.fromArray(view.cameraPosition);this.shotTarget.fromArray(view.cameraTarget);
      this.shotMatrix.lookAt(this.shotEye,this.shotTarget,this.worldUp);
      this.shotOrientation.setFromRotationMatrix(this.shotMatrix);
      camera.position.lerp(this.shotEye,weight);
      camera.quaternion.slerp(this.shotOrientation,weight);
      camera.up.lerp(this.worldUp,weight).normalize();
    }
    if(view.cameraFov!==undefined){
      const fit=Math.max(1,(view.cameraAspect??camera.aspect)/camera.aspect);
      const fov=fit>1?Math.min(120,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(view.cameraFov)*.5)*fit))):view.cameraFov;
      camera.fov=THREE.MathUtils.lerp(camera.fov,fov,weight);camera.updateProjectionMatrix();
    }
  }
}

/** A fixed view inside an oriented volume, feathered only at its boundary. */
export function cameraViewDirection(views: readonly CameraView[], x:number,y:number,z:number,
  base:{x:number;z:number}):{x:number;z:number} {
  const match=cameraViewAt(views,x,y,z);
  if(!match)return base;
  const {weight,view}=match,heading=THREE.MathUtils.degToRad(view.yaw);
  const start=Math.atan2(-base.x,-base.z);
  const delta=Math.atan2(Math.sin(heading-start),Math.cos(heading-start));
  const angle=start+delta*weight;
  return {x:-Math.sin(angle),z:-Math.cos(angle)};
}

/** Camera turns cannot rotate a continuously held walking/skating intention. */
export class CameraInputFrame {
  needsSeed=true;
  private held=false;
  private stickX=0;
  private stickY=0;
  private forward={x:0,z:-1};
  reset():void {this.held=false;this.needsSeed=true;}
  sample(mx:number,my:number,camera:{x:number;z:number}):{x:number;z:number} {
    const length=Math.hypot(mx,my),active=length>.1;
    const changed=active&&this.held&&(mx*this.stickX+my*this.stickY)/length<.7;
    if(!active||!this.held||changed){
      const scale=1/(Math.hypot(camera.x,camera.z)||1);
      this.forward={x:camera.x*scale,z:camera.z*scale};
      if(active){this.stickX=mx/length;this.stickY=my/length;}
    }
    this.held=active;this.needsSeed=false;
    return this.forward;
  }
}
