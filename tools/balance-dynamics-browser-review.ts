// Local-only, repeatable real rail catches. No saved tuning or campaign edits.
import * as THREE from 'three';
import {TUNING} from '../src/tuning';
import {JungleCupEvent} from '../src/competition/event';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player;
let mode='live',frame=0,frozen=false,correcting=false,record:string[]=[],result='';
const neutral=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:true,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
const native=p.step.bind(p),runStep=JungleCupEvent.prototype.stepRun;
JungleCupEvent.prototype.stepRun=function(dt,score,active,ready){return runStep.call(this,frozen?0:dt,score,active,ready);};
p.step=(dt:number,input:any,level:any)=>{
 if(frozen)return;
 if(mode==='live'){native(dt,input,level);return;}
 if(frame===0){
  const rail=level.grindRails[3],position=rail.pointAt(1).add(new THREE.Vector3(0,.25,0)),heading=rail.tangentAt(1);
  p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);
  p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=8;p.vVel=0;
 }
 const threshold=mode==='early'?.45:.9;
 if((mode==='early'||mode==='late')&&p.balance>=threshold)correcting=true;
 const scripted={...neutral(),grindPressed:frame===0,moveX:mode==='wrong'?1:correcting?-1:0};
 const before=p.state;
 native(dt,mode==='control'&&frame>0?input:scripted,level);
 if(frame===0){p.balance=.15;p.balanceVel=0;p.noisePhase=0;}
 frame++;
 if(frame%6===0)record.push(`${(frame*dt).toFixed(2)}s  needle ${p.balance.toFixed(3)}  speed ${p.balanceVel.toFixed(2)}`);
 if(before==='grind'&&p.state!=='grind'){result=p.isBailing?'BAIL — boundary resolved immediately':'RAIL EXIT';frozen=true;}
 if(correcting&&p.state==='grind'&&p.balance<=.15){result='RECOVERED — early correction kept the grind';frozen=true;}
};
const panel=document.createElement('section');panel.style.cssText='position:fixed;z-index:999999;left:12px;top:12px;width:310px;padding:10px;background:#071e24ed;color:white;font:12px monospace';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='balance-dynamics-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
const start=(next:string)=>{g.competitionAction('retry');mode=next;frame=0;frozen=false;correcting=false;record=[];result='';};
function button(text:string,fn:()=>void){const b=document.createElement('button');b.textContent=text;b.style.cssText='padding:6px;margin:2px';b.onclick=fn;controls.append(b);}
button('No correction',()=>start('neutral'));button('Hold wrong',()=>start('wrong'));button('Correct at 45%',()=>start('early'));button('Correct at 90%',()=>start('late'));button('Try balancing',()=>start('control'));button('Normal play',()=>{mode='live';frozen=false;g.competitionAction('retry');});
function report(){panel.inert=false;document.body.classList.add('game-debug-hidden');document.body.classList.remove('game-debug-visible');status.textContent=`${mode} · ${frame} frames · ${p.state}\n${result}\n${record.slice(-7).join('\n')}\n\nActive defaults: edge ${TUNING.balanceGravity} × |balance|^${TUNING.balanceEdgePower}\ninertia ${TUNING.balanceInertia} · speed effect ${TUNING.balanceSpeedEffect}\nbail grace ${TUNING.bailGrace}s · catch calm ${TUNING.grindCalm}s\nramp delay ${TUNING.balanceGrace}s · input ease ${TUNING.balanceSafePeriod}s`;requestAnimationFrame(report);}report();
