// Source-owned local review: real park input/landing, no completed event/save.
import * as THREE from 'three';
import { JungleCupEvent } from '../src/competition/event';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
JungleCupEvent.prototype.stepRun=()=>false;
const p=g.player;
g.competitionAction('retry');g.getCompetition().phase='running';
const panel=document.createElement('section');panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:999999;background:#102b28ee;color:white;padding:10px;width:310px;font:12px monospace';document.body.append(panel);
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='spin-status';status.style.cssText='white-space:pre-wrap';panel.append(controls,status);
let phase='idle',target=Math.PI,freeze=false,pause='air',bank:any=null;
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:7px;margin:2px';b.onclick=fn;controls.append(b);};
function start(vert:boolean,halves:number){
  p.respawn(g.level,true,true,{position:new THREE.Vector3(0,.1,vert?10:0),heading:new THREE.Vector3(0,0,vert?1:-1)});
  p.axisF.set(0,0,vert?1:-1);p.axisL.set(vert?1:-1,0,0);
  p.freeSkate=true;p.speed=vert?15.3:12;p.groundHit=p.queryGround(g.level);p.rideNormal.copy(p.groundHit.normal);
  p.rawInput=g.input;target=Math.PI*halves;phase=vert?'approach':'spin';freeze=false;pause='air';bank=null;
  if(!vert){p.chargeTimer=.4;p.chargedJump(1/60);}
}
add('Ollie 180',()=>start(false,1));add('Vert 180',()=>start(true,1));add('Vert 360',()=>start(true,2));
add('Continue to landing',()=>{pause='landing';freeze=false;});add('Continue to bank',()=>{pause='';freeze=false;});
add('Normal play',()=>location.assign('/?playtest&level=jungle-cup'));
const native=p.step.bind(p),cash=p.onComboBank;
p.onComboBank=(amount:number,labels:string)=>{bank={amount,labels};cash(amount,labels);};
p.step=(dt:number,input:any,level:any)=>{
  if(freeze)return;
  input.moveX=phase==='spin'&&Math.abs(p.grabSpinAngle)<target?1:0;input.moveY=0;
  input.jumpHeld=phase==='approach';input.jumpPressed=input.jumpReleased=input.grabHeld=input.grabPressed=input.spinHeld=input.spinPressed=input.grindHeld=input.grindPressed=false;
  native(dt,input,level);
  if(phase==='approach'&&p.vertAir)phase='spin';
  if(phase==='spin'&&p.comboHudPreview&&pause==='air')freeze=true;
  if(phase==='spin'&&p.grounded){phase='landed';if(pause==='landing')freeze=true;}
};
function report(){status.textContent=JSON.stringify({phase,paused:freeze,angle:Math.round(p.grabSpinAngle*180/Math.PI),preview:p.comboHudPreview,points:p.points,pending:p.comboPoints,multiplier:p.comboMult,labels:p.comboLabels,bank},null,2);requestAnimationFrame(report);}report();
