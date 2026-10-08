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
  /** Translation-only follow distance, capped at the close gameplay limit. */
  cameraFollowDistance?: number;
  /** Relative target height keeps tall crate goals visible at a close lens. */
  cameraFollowTargetHeight?: number;
  /** Legacy authoring metadata; gameplay no longer starts with a distant establishing shot. */
  cameraIntroDistance?: number;
}

export interface CameraViewMatch { view: CameraView; weight: number; }

/** Render-only bonus fallback. Keep it out of Level.cameraViews: legacy
 * bonus rooms already own their movement axes through cardinal travel zones. */
export const BONUS_PRESENTATION_VIEW:CameraViewMatch={weight:1,view:{
  p:[0,0,0],s:[1,1,1],yaw:0,feather:1,
  cameraPosition:[2,6,20],cameraTarget:[2,3.3,0],cameraFollowDistance:13.4,
  cameraFollowTargetHeight:2.7,cameraIntroDistance:0,cameraFov:46,cameraAspect:1.3,
}};

/** Opt-in presentation context for a side-view shot that holds the landing
 * surface while the character jumps through the frame. */
export interface CameraViewGroundFollow {
  groundY: number | null;
  grounded: boolean;
  dt: number;
}

export interface CameraSideFollow {
  travel: { x: number; z: number } | null;
  distance: number;
  dt?: number;
}

/** A side-on authored shot uses the same close scale as the gameplay rig.
 * Compare view and route directions, so rotated bonus courses and climbing
 * galleries follow the same rule without level names or world-axis guesses. */
export function cameraSideWeight(view: CameraView, travel: CameraSideFollow['travel']): number {
  if (!travel || !view.cameraPosition || !view.cameraTarget) return 0;
  const x = view.cameraTarget[0] - view.cameraPosition[0];
  const z = view.cameraTarget[2] - view.cameraPosition[2];
  const length = Math.hypot(x, z) * Math.hypot(travel.x, travel.z);
  if (length < 1e-6) return 0;
  const alignment = Math.abs((x * travel.x + z * travel.z) / length);
  return 1 - THREE.MathUtils.smoothstep(alignment, .25, .75);
}

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
  private readonly followEye=new THREE.Vector3();
  private readonly followTarget=new THREE.Vector3();
  private groundView:CameraView|null=null;
  private sideView:CameraView|null=null;
  private sideWeight=0;
  private supportY=0;
  private anchorY=0;
  private leadX=0;
  private lastX=0;
  private direction=1;

  restore(camera:THREE.PerspectiveCamera):void {
    if(!this.applied)return;
    camera.position.copy(this.position);camera.quaternion.copy(this.orientation);camera.up.copy(this.up);
    if(camera.fov!==this.fov){camera.fov=this.fov;camera.updateProjectionMatrix();}
    this.applied=false;
  }

  apply(camera:THREE.PerspectiveCamera,match:CameraViewMatch|null,subject?:THREE.Vector3,snap=false,groundFollow?:CameraViewGroundFollow,sideFollow?:CameraSideFollow):void {
    if(!match){this.groundView=null;this.sideView=null;this.sideWeight=0;return;}
    const {view,weight}=match;
    if(!view.cameraPosition&&!view.cameraTarget&&view.cameraFov===undefined)return;
    this.position.copy(camera.position);this.orientation.copy(camera.quaternion);this.up.copy(camera.up);this.fov=camera.fov;
    this.applied=true;
    if(view.cameraPosition&&view.cameraTarget){
      this.shotEye.fromArray(view.cameraPosition);this.shotTarget.fromArray(view.cameraTarget);
      const authoredDistance=groundFollow ? 13.4 : Math.min(18,view.cameraFollowDistance??this.shotEye.distanceTo(this.shotTarget));
      const desiredSide = sideFollow ? cameraSideWeight(view, sideFollow.travel) : 0;
      this.sideWeight = snap || this.sideView !== view || sideFollow?.dt === undefined
        ? desiredSide : THREE.MathUtils.lerp(this.sideWeight, desiredSide, 1-Math.exp(-6*Math.max(0,sideFollow.dt)));
      this.sideView = view;
      const side = this.sideWeight;
      const distance = THREE.MathUtils.lerp(authoredDistance,
        Math.min(authoredDistance, sideFollow?.distance ?? authoredDistance), side);
      // Bonus owns its lens without changing the parent's camera or controls.
      if(groundFollow){camera.fov=46;camera.updateProjectionMatrix();}
      if(subject){
        const targetHeight=THREE.MathUtils.lerp(groundFollow ? 2.7 : view.cameraFollowTargetHeight??1.3,1.3,side);
        this.followTarget.copy(subject);
        if(groundFollow){
          const floor=groundFollow.groundY;
          const supported=floor!==null&&Number.isFinite(floor);
          const fresh=snap||this.groundView!==view;
          if(fresh){
            this.supportY=supported?Math.min(subject.y,floor):subject.y;
            this.anchorY=this.supportY;
            this.direction=1;this.leadX=.9*Math.min(1,distance/13.4);this.lastX=subject.x;
          }else if(groundFollow.grounded)this.supportY=supported?floor:subject.y;
          this.groundView=view;
          const travel=subject.x-this.lastX;
          if(Math.abs(travel)>.012)this.direction=Math.sign(travel);
          this.lastX=subject.x;
          const desiredLead=this.direction*Math.min(1.45,Math.max(.45,camera.aspect*1.05))*Math.min(1,distance/13.4);
          this.leadX=THREE.MathUtils.lerp(this.leadX,desiredLead,1-Math.exp(-3*Math.max(0,groundFollow.dt)));
          this.followTarget.x+=this.leadX;

          // A higher floor under an airborne player is a future landing, not
          // an instruction to bob the shot. Hold the last supported height;
          // the head/feet bounds below still allow tall climbs and drops.
          const fov=camera.fov;
          const tangent=Math.tan(THREE.MathUtils.degToRad(fov)/2);
          this.followEye.copy(this.shotEye).sub(this.shotTarget).normalize();
          const sine=this.followEye.y,cosine=Math.hypot(this.followEye.x,this.followEye.z);
          const frameHeight=(screenY:number)=>screenY*tangent*distance/Math.max(.1,cosine+screenY*tangent*sine);
          const maxRise=targetHeight+frameHeight(.63)-2.5;
          const minDrop=targetHeight+frameHeight(-.72);
          const low=subject.y-maxRise;
          // A void fall keeps its last composition. Only follow downward
          // when the player's existing support probe sees a real receiver.
          const high=supported?subject.y-minDrop:Infinity;
          const goal=THREE.MathUtils.clamp(this.supportY,low,high);
          const blend=fresh?1:1-Math.exp(-5*Math.max(0,groundFollow.dt));
          this.anchorY=THREE.MathUtils.clamp(THREE.MathUtils.lerp(this.anchorY,goal,blend),low,high);
          this.followTarget.y=this.anchorY;
        }else this.groundView=null;
        this.followTarget.y+=targetHeight;
        this.followEye.copy(this.shotEye).sub(this.shotTarget).setLength(distance).add(this.followTarget);
        this.shotEye.copy(this.followEye);this.shotTarget.copy(this.followTarget);
      }else this.shotEye.sub(this.shotTarget).setLength(distance).add(this.shotTarget);
      this.shotMatrix.lookAt(this.shotEye,this.shotTarget,this.worldUp);
      this.shotOrientation.setFromRotationMatrix(this.shotMatrix);
      camera.position.lerp(this.shotEye,weight);
      camera.quaternion.slerp(this.shotOrientation,weight);
      camera.up.lerp(this.worldUp,weight).normalize();
    }
    if(view.cameraFov!==undefined&&!groundFollow){
      // Portrait fitting must not widen the gameplay lens into an overview.
      camera.fov=THREE.MathUtils.lerp(camera.fov,Math.min(this.fov,view.cameraFov),weight);camera.updateProjectionMatrix();
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
