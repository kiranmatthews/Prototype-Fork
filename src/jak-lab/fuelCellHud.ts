import {Matrix4,Vector3,type Object3D} from 'three';
import type {FuelCellHudLibrary, FuelCellHudProfile} from './types';
import type {LabParticle, ParticleMotion} from './particleMotion';

export type HudPhase='arriving'|'in'|'leaving'|'hidden';
export interface FuelCellPose {
  seconds:number; yaw:number; scale:number; x:number; y:number; z:number;
}

/** cspace positions exclude the later HUD projection and gallery transforms. */
export function fuelCellJoints(root:Object3D,nodes:ReadonlyMap<number,Object3D>,joints:Map<number,Vector3>):void {
  root.updateMatrix();
  const matrix=new Matrix4();
  for(const [id,node] of nodes)if(id>=3) {
    const chain:Object3D[]=[];let cursor:Object3D|null=node;
    while(cursor&&cursor!==root){chain.push(cursor);cursor=cursor.parent;}
    if(cursor!==root)throw new Error(`HUD joint ${id} is outside its source skeleton`);
    matrix.copy(root.matrix);
    for(const child of chain.reverse()){child.updateMatrix();matrix.multiply(child.matrix);}
    const position=joints.get(id)??new Vector3();position.setFromMatrixPosition(matrix);
    for(const axis of ['x','y','z'] as const)position[axis]=Math.fround(position[axis]);
    joints.set(id,position);
  }
}

/** Source hud states at normal NTSC rate. Holding is the inspector's continuous
 * show condition; without it the original two-second timeout owns departure. */
export class FuelCellHud {
  profile:FuelCellHudProfile;
  phase:HudPhase='in';
  hold=true;
  offset=0;
  yaw:number;
  readonly joints=new Map<number,Vector3>();
  readonly origin=new Vector3();
  private entered=0;
  private leaveStep=5;
  private iconScale:number;

  constructor(readonly motion:ParticleMotion,readonly library:FuelCellHudLibrary,
    readonly sample:(pose:FuelCellPose,joints:Map<number,Vector3>)=>void) {
    this.profile=library.profiles.find(profile=>profile.id==='4:3')!;
    if(!this.profile)throw new Error('Missing source NTSC power-cell profile');
    this.yaw=library.yawStart;this.iconScale=this.profile.iconScale;
    motion.host.fuelCell={joints:this.joints,iconScale:this.iconScale,centerScale:this.profile.centerScale,
      starburst3:this.profile.starburst3,starburst4:this.profile.starburst4,
      setIconScale:scale=>{this.iconScale=scale;}};
    motion.sourceEmitter=()=>this.step();
    motion.cameraDistance=0;
  }
  select(id:string):void {
    const profile=this.library.profiles.find(profile=>profile.id===id);
    if(!profile)throw new Error(`Unknown source HUD format ${id}`);
    this.profile=profile;this.iconScale=profile.iconScale;
    Object.assign(this.motion.host.fuelCell!,{iconScale:profile.iconScale,centerScale:profile.centerScale,
      starburst3:profile.starburst3,starburst4:profile.starburst4});
  }
  show():void {this.phase='arriving';this.entered=this.motion.clock;}
  hide(quick=false):void {
    this.hold=false;this.leaveStep=10;this.phase=quick?'hidden':'leaving';
    if(quick)this.offset=128;
  }
  restart():void {
    this.motion.reset();this.yaw=this.library.yawStart;this.entered=0;this.iconScale=this.profile.iconScale;
    this.offset=128;this.phase='arriving';this.joints.clear();this.origin.set(0,0,0);
  }
  private step():void {
    const clock=this.motion.clock;
    if(this.phase==='arriving') {
      this.offset=Math.max(0,this.offset-15);
      if(this.offset===0){this.phase='in';this.entered=clock;}
    } else if(this.phase==='in') {
      if(this.hold)this.entered=clock;
      else if(clock-this.entered>=600){this.phase='leaving';this.leaveStep=5;}
    } else if(this.phase==='leaving') {
      this.offset=Math.min(128,this.offset+this.leaveStep);
      if(this.offset===128)this.phase='hidden';
    }
    // hud-update also runs while hidden. Its half-degree turn is independent
    // of the one-second source joint-animation loop.
    this.yaw=Math.fround(this.yaw+Math.fround(this.library.yawPerFrame));
    if(this.yaw>=32768)this.yaw-=65536;
    this.sample({seconds:clock/300,yaw:this.yaw,scale:this.iconScale,
      x:0,y:this.profile.iconY-this.offset-224,z:2048},this.joints);
    const center=this.joints.get(3);
    if(!center)throw new Error('Source power-cell main joint is missing');
    this.origin.set(center.x,Math.fround(center.y/2),Math.fround(2+Math.fround(.05*Math.fround(center.z-2048))));
    this.motion.hostEmission=this.phase==='hidden'?'off':'held';
  }
  get aspect():number{return this.profile.id==='4:3'?4/3:16/9;}
}

export interface HudSprite {
  center:Vector3; size:[number,number]; rotation:number; anchor:number;
}
/** sprite-add-matrix-data mode 1, NTSC video and user HVDF. Coordinates are
 * GS pixels (512 × 224), Y up here, and depth is distance from the near plane.
 * Keep this independent of the gallery's perspective camera and world scale. */
export function projectHudSprite(particle:LabParticle,origin:Vector3,aspect:number):HudSprite {
  const ratio=112/256*aspect, v=particle.values;
  const depth=16777215-(8380365.5-1024*origin.z+(500000000-particle.position.z)/60);
  return {center:new Vector3(Math.trunc(origin.x)+particle.position.x/60,
    -Math.trunc(origin.y)+ratio*particle.position.y/60,depth),
    size:[(v['scale-x']??0)/(60*1.9996),(v['scale-y']??0)/(60*1.9996)],
    rotation:(v['rot-z']??0)*Math.PI*2/65536,anchor:(Math.trunc(v['rot-x']??0)&15)===4?.5:0};
}
