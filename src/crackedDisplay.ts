import * as THREE from 'three';
import type {BoulderCameraRun} from './boulderCameraRun';
import {sfx} from './audio';

export const CRACK_VARIANTS=['cracks-a.png','cracks-b.png','cracks-c.png'] as const;
/** Physical display glass sits after the game/CRT/HUD composition. */
export class CrackedDisplay {
 readonly element=document.createElement('div');
 private readonly glass=document.createElement('img');
 private readonly flash=document.createElement('div');
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
 constructor(){
  this.element.className='cracked-display';this.element.setAttribute('aria-hidden','true');
  Object.assign(this.element.style,{position:'fixed',inset:'0',zIndex:'100000',pointerEvents:'none',display:'none',overflow:'hidden'});
  this.glass.alt='';this.glass.draggable=false;
  Object.assign(this.glass.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'fill',pointerEvents:'none'});
  Object.assign(this.flash.style,{position:'absolute',inset:'0',background:'#e8f5ff',opacity:'0',pointerEvents:'none'});
  this.element.append(this.glass,this.flash);document.body.append(this.element);
 }
 prepare():void {
  if(this.images.length)return;
  for(const file of CRACK_VARIANTS){const image=new Image();image.src=import.meta.env.BASE_URL+'boulder-camera/'+file;this.images.push(image);void image.decode().catch(()=>{});}
 }
 begin(run:BoulderCameraRun,camera:THREE.Camera):void {
  this.reset();this.prepare();this.run=run;this.rotation.copy(camera.quaternion);
  this.right.set(1,0,0).applyQuaternion(this.rotation);this.up.set(0,1,0).applyQuaternion(this.rotation);
  this.variant=this.sequence++%CRACK_VARIANTS.length;this.glass.src=this.images[this.variant].src;
  this.element.dataset.phase='approach';this.element.dataset.variant=String(this.variant);
 }
 frame(camera:THREE.Camera):boolean {
  const run=this.run;if(!run)return false;
  const approaching=!run.hit;
  sfx.setLoop('camera-boulder','boulderCameraRush',approaching,.22+.48*Math.min(1,run.elapsed/run.duration),.85+.35*Math.min(1,run.elapsed/run.duration));
  if(approaching)return false;
  if(!this.shown){
   this.shown=true;this.impacts++;this.element.style.display='block';this.element.dataset.phase='cracked';
   sfx.play('boulderCameraHit'+(this.variant+1),1,1,0);
  }
  const t=run.hitAge,fade=Math.exp(-t*9),kick=1.8*(1-Math.exp(-t*48))*Math.exp(-t*4);
  camera.position.copy(run.cameraPosition).addScaledVector(run.cameraDirection,-kick)
   .addScaledVector(this.right,Math.sin(t*73)*.18*fade).addScaledVector(this.up,Math.sin(t*91)*.14*fade);
  camera.quaternion.copy(this.rotation);this.shake.setFromAxisAngle(this.rollAxis,Math.sin(t*64)*.028*fade);camera.quaternion.multiply(this.shake);
  camera.updateMatrixWorld();
  this.flash.style.opacity=String(.17*Math.max(0,1-t/.085));
  if(run.elapsed>=run.watchSeconds&&!this.fadeRequested){this.fadeRequested=true;return true;}
  return false;
 }
 reset():void {
  this.run=null;this.shown=false;this.fadeRequested=false;this.element.style.display='none';this.flash.style.opacity='0';
  this.element.dataset.phase='idle';sfx.setLoop('camera-boulder','boulderCameraRush',false,0);
 }
 get diagnostics(){return{phase:this.run?(this.shown?'cracked':'approach'):'idle',variant:this.variant,impacts:this.impacts,elapsed:this.run?.elapsed??0};}
 dispose():void {this.reset();this.element.remove();this.images.length=0;}
}
