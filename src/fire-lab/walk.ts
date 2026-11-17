import * as THREE from 'three';
import {FireCourtyard,COURT_FIRES} from './courtyard';

/** Small first-person inspection controller. Independent of the game's authored movement. */
export class CourtyardWalk {
  active=false;
  readonly feet=new THREE.Vector3();
  private readonly keys=new Set<string>();
  private readonly checkpoint=new THREE.Vector3();
  private yaw=0;
  private pitch=0;
  private vertical=0;
  private grounded=true;
  private jump=false;
  private padJump=false;
  private pointer:number|null=null;
  private pointerX=0;
  private pointerY=0;
  private hasCheckpoint=false;
  private finished=false;
  private touchX=0;
  private touchZ=0;
  private readonly abort=new AbortController();
  constructor(private readonly camera:THREE.PerspectiveCamera,canvas:HTMLCanvasElement,private readonly court:FireCourtyard,private readonly status:(s:string)=>void){
    this.checkpoint.copy(court.spawn);this.feet.copy(court.spawn);
    const opts={signal:this.abort.signal};
    window.addEventListener('keydown',e=>{
      if(!this.active||(e.target as HTMLElement).matches('input,select,textarea,button,summary,a'))return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();
      this.keys.add(e.code);if(e.code==='Space'&&!e.repeat)this.jump=true;if(e.code==='KeyR')this.respawn(false);
    },opts);
    window.addEventListener('keyup',e=>this.keys.delete(e.code),opts);
    window.addEventListener('blur',()=>this.clear(),opts);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();},opts);
    canvas.addEventListener('pointerdown',e=>{if(!this.active)return;this.pointer=e.pointerId;this.pointerX=e.clientX;this.pointerY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.focus();},opts);
    canvas.addEventListener('pointermove',e=>{if(!this.active||this.pointer!==e.pointerId)return;this.yaw-=(e.clientX-this.pointerX)*.004;this.pitch=THREE.MathUtils.clamp(this.pitch-(e.clientY-this.pointerY)*.003,-1.2,1.2);this.pointerX=e.clientX;this.pointerY=e.clientY;},opts);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>this.pointer=null,opts);
    document.querySelectorAll<HTMLButtonElement>('[data-walk]').forEach(button=>{
      button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);const [x,z]=button.dataset.walk!.split(',').map(Number);this.touchX=x;this.touchZ=z;canvas.focus();},opts);
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{this.touchX=this.touchZ=0;},opts);
    });
    document.getElementById('walk-jump')?.addEventListener('click',()=>{this.jump=true;canvas.focus();},opts);
  }
  enter(reset=false){this.active=true;this.clear();if(reset)this.respawn(true);this.camera.fov=65;this.camera.updateProjectionMatrix();this.applyCamera();}
  leave(){this.active=false;this.clear();this.camera.fov=43;this.camera.updateProjectionMatrix();}
  respawn(entrance:boolean){if(entrance){this.checkpoint.copy(this.court.spawn);this.hasCheckpoint=false;this.yaw=this.pitch=0;}this.finished=false;this.feet.copy(this.checkpoint);this.vertical=0;this.grounded=true;this.applyCamera();}
  private clear(){this.keys.clear();this.touchX=this.touchZ=0;this.jump=false;this.pointer=null;}
  private applyCamera(){this.camera.position.copy(this.feet).add(new THREE.Vector3(0,1.65,0));this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch,this.yaw,0,'YXZ'));}
  step(dt:number){
    if(!this.active)return;
    const pads=navigator.getGamepads?.(),pad=pads&&Array.from(pads).find(p=>p?.connected),axis=(v:number)=>Math.abs(v)>.18?v:0;
    let x=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0)+this.touchX+axis(pad?.axes[0]||0);
    let z=(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)+this.touchZ+axis(pad?.axes[1]||0);
    this.yaw+=((this.keys.has('ArrowLeft')?1:0)-(this.keys.has('ArrowRight')?1:0)-axis(pad?.axes[2]||0))*dt*1.8;
    this.pitch=THREE.MathUtils.clamp(this.pitch-axis(pad?.axes[3]||0)*dt*1.5,-1.2,1.2);
    const padJump=pad?.buttons[0]?.pressed||false;if(padJump&&!this.padJump)this.jump=true;this.padJump=padJump;
    const length=Math.hypot(x,z);if(length>1){x/=length;z/=length;}
    const speed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||pad?.buttons[10]?.pressed?6.5:3.8;
    const dx=(x*Math.cos(this.yaw)+z*Math.sin(this.yaw))*speed*dt,dz=(-x*Math.sin(this.yaw)+z*Math.cos(this.yaw))*speed*dt;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));
    for(let i=0;i<steps;i++){
      const stepHeight=this.grounded ? .3 : 0;
      if(!this.court.blocked(this.feet.x+dx/steps,this.feet.y+stepHeight,this.feet.z))this.feet.x+=dx/steps;
      if(!this.court.blocked(this.feet.x,this.feet.y+stepHeight,this.feet.z+dz/steps))this.feet.z+=dz/steps;
    }
    if(this.jump&&this.grounded){this.vertical=6.8;this.grounded=false;}this.jump=false;
    const oldY=this.feet.y;this.vertical-=19*dt;this.feet.y+=this.vertical*dt;
    const floor=this.court.groundAt(this.feet.x,this.feet.z,Math.max(oldY,this.feet.y)+(this.grounded ? .31 : 0));
    if(this.vertical<=0&&this.feet.y<=floor){this.feet.y=floor;this.vertical=0;this.grounded=true;}else this.grounded=false;
    if(this.feet.y<-8)this.respawn(false);
    if(!this.hasCheckpoint&&Math.hypot(this.feet.x,this.feet.z+11)<1.7){this.hasCheckpoint=true;this.checkpoint.set(0,.02,-11);}
    if(this.feet.z<-23&&Math.abs(this.feet.x)<2.3&&this.feet.y>1)this.finished=true;
    let nearest=0,distance=Infinity;COURT_FIRES.forEach((f,i)=>{const d=Math.hypot(this.feet.x-f.p[0],this.feet.z-f.p[2]);if(d<distance){distance=d;nearest=i;}});
    this.status(this.finished?'Temple reached · keep exploring':distance<5?COURT_FIRES[nearest].context:this.hasCheckpoint?'Upper courtyard · checkpoint reached':'Ember Court · explore the fire studies');
    this.applyCamera();
  }
  get state(){return {active:this.active,feet:this.feet.toArray(),grounded:this.grounded,checkpoint:this.hasCheckpoint,finished:this.finished};}
  dispose(){this.abort.abort();}
}
