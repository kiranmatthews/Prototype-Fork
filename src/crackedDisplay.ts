import * as THREE from 'three';
import type {BoulderCameraRun} from './boulderCameraRun';
import type {GameHudFrameState} from './gameHudSurface';
import {sfx} from './audio';

export const CRACK_VARIANTS=['cracks-a.png','cracks-b.png','cracks-c.png'] as const;
/** Paint the fracture into the game image, before its shared fade and CRT. */
export class CrackedDisplay {
 private readonly rotation=new THREE.Quaternion();
 private readonly shake=new THREE.Quaternion();
 private readonly right=new THREE.Vector3();
 private readonly up=new THREE.Vector3();
 private readonly rollAxis=new THREE.Vector3(0,0,1);
 private run:BoulderCameraRun|null=null;
 private shown=false;
 private fadeRequested=false;
 private sequence=0;
 variant=0;
 impacts=0;
 private readonly images:HTMLImageElement[]=[];
 prepare():void {
  if(this.images.length)return;
  for(const file of CRACK_VARIANTS){const image=new Image();image.src=import.meta.env.BASE_URL+'boulder-camera/'+file;this.images.push(image);void image.decode().catch(()=>{});}
 }
 begin(run:BoulderCameraRun,camera:THREE.Camera):void {
  this.reset();this.prepare();this.run=run;this.rotation.copy(camera.quaternion);
  this.right.set(1,0,0).applyQuaternion(this.rotation);this.up.set(0,1,0).applyQuaternion(this.rotation);
  this.variant=this.sequence++%CRACK_VARIANTS.length;
 }
 frame(camera:THREE.Camera):boolean {
  const run=this.run;if(!run)return false;
  const approaching=!run.hit;
  sfx.setLoop('camera-boulder','boulderCameraRush',approaching,.22+.48*Math.min(1,run.elapsed/run.duration),.85+.35*Math.min(1,run.elapsed/run.duration));
  if(approaching)return false;
  if(!this.shown){this.shown=true;this.impacts++;sfx.play('boulderCameraHit'+(this.variant+1),1,1,0);}
  const t=run.hitAge,fade=Math.exp(-t*9),kick=1.8*(1-Math.exp(-t*48))*Math.exp(-t*4);
  camera.position.copy(run.cameraPosition).addScaledVector(run.cameraDirection,-kick)
   .addScaledVector(this.right,Math.sin(t*73)*.18*fade).addScaledVector(this.up,Math.sin(t*91)*.14*fade);
  camera.quaternion.copy(this.rotation);this.shake.setFromAxisAngle(this.rollAxis,Math.sin(t*64)*.028*fade);camera.quaternion.multiply(this.shake);
  camera.updateMatrixWorld();
  if(run.elapsed>=run.watchSeconds&&!this.fadeRequested){this.fadeRequested=true;return true;}
  return false;
 }
 private readonly paint:NonNullable<GameHudFrameState['drawBeforeFade']>=(ctx,size)=>{
  const image=this.images[this.variant];if(!this.shown||!image?.complete||!image.naturalWidth)return;
  ctx.drawImage(image,0,0,size.width,size.height);
  const flash=.17*Math.max(0,1-(this.run?.hitAge??1)/.085);
  if(flash>0){ctx.fillStyle=`rgba(232,245,255,${flash})`;ctx.fillRect(0,0,size.width,size.height);}
 };
 get paintFrame():GameHudFrameState['drawBeforeFade'] {return this.shown?this.paint:undefined;}
 reset():void {this.run=null;this.shown=false;this.fadeRequested=false;sfx.setLoop('camera-boulder','boulderCameraRush',false,0);}
 get diagnostics(){const image=this.images[this.variant];return{phase:this.run?(this.shown?'cracked':'approach'):'idle',variant:this.variant,impacts:this.impacts,elapsed:this.run?.elapsed??0,fadeRequested:this.fadeRequested,holdAfterImpact:this.run?this.run.watchSeconds-this.run.duration:0,glassWidth:image?.naturalWidth??0,glassHeight:image?.naturalHeight??0,composition:'before-death-fade-and-crt'};}
 dispose():void {this.reset();this.images.length=0;}
}
