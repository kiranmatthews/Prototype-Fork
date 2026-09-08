import * as THREE from 'three';

export interface CameraView {
  p: readonly number[];
  s: readonly number[];
  yaw: number;
  feather: number;
}

/** A fixed view inside an oriented volume, feathered only at its boundary. */
export function cameraViewDirection(views: readonly CameraView[], x:number,y:number,z:number,
  base:{x:number;z:number}):{x:number;z:number} {
  let weight=0,heading=0;
  for(const view of views){
    const angle=THREE.MathUtils.degToRad(view.yaw),c=Math.cos(angle),s=Math.sin(angle);
    const dx=x-view.p[0],dz=z-view.p[2];
    const edge=Math.min(view.s[0]/2-Math.abs(c*dx-s*dz),view.s[1]/2-Math.abs(y-view.p[1]),view.s[2]/2-Math.abs(s*dx+c*dz));
    const w=THREE.MathUtils.smoothstep(edge,0,Math.max(.001,view.feather));
    if(w>weight){weight=w;heading=angle;}
  }
  if(weight===0)return base;
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
