// Local-only balance/tuner probes; use real Player entry and step handlers.
import * as THREE from 'three';
import {Rail} from '../src/rails';
import {TUNING,CONST} from '../src/tuning';
import {JungleCupEvent} from '../src/competition/event';
import fixture from './fixtures/grind-entry-inputs.json';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player,level=g.getLevel(),native=p.step.bind(p);
const rail=new Rail([new THREE.Vector3(0,1,5),new THREE.Vector3(0,1,-115)]);
level.rails.push(rail);level.grindRails.push(rail);level.root.add(rail.object);level.root.updateMatrixWorld(true);
let mode='freeze',frame=0,result='',lastProbe:any=null,caseIndex=0;
const empty=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:true,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,consumeEdges(){}});
const run=JungleCupEvent.prototype.stepRun;JungleCupEvent.prototype.stepRun=function(dt,...args){return run.call(this,mode==='live'?dt:0,...args);};
function prepare(manual=false,entryX=0){
  g.gameFlow.hide();g.competitionAction('retry');g.getCompetition().phase='running';
  const position=manual?new THREE.Vector3(0,.1,10):rail.pointAt(2).add(new THREE.Vector3(0,.25,0)),heading=new THREE.Vector3(0,0,-1);
  p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);p.axisF.copy(heading);p.axisL.set(-1,0,0);
  p.speed=8;p.freeSkate=p.airFromSkate=true;p.rawInput=empty();
  if(manual){p.state='ride';p.grounded=true;p.groundHit=p.queryGround(level);p.pos.y=p.groundHit.y;p.rideNormal.copy(p.groundHit.normal);p.enterManual(1);}
  else {p.state='air';p.grounded=false;p.vVel=0;native(CONST.fixedStep,{...empty(),grindPressed:true,moveX:entryX},level);}
  p.commitRenderStep(level);frame=0;result='';
}
function probe(manual=false){mode='freeze';prepare(manual);p.balance=.4;p.balanceVel=0;p.balanceAge=8;p.balanceEntryAge=.05;p.noisePhase=0;
  native(CONST.fixedStep,empty(),level);p.commitRenderStep(level);
  lastProbe={mode:manual?'manual':'grind',start:.4,needle:p.balance,velocity:p.balanceVel,comboAge:p.balanceAge,catchAge:p.balanceEntryAge};
}
function watch(index:number){mode='freeze';const c=fixture.cases[index];prepare(false,c.inputX[0]??0);caseIndex=index;p.grindStyle=c.style;p.speed=p.grindVel=c.speed;p.balance=c.linked?c.balance:Math.sign(c.balance)*TUNING.balanceEntryLean;p.balanceVel=c.velocity;p.balanceAge=c.age;p.balanceEntryAge=0;p.noisePhase=0;mode='watch';lastProbe=null;}
p.step=(dt:number,input:any,activeLevel:any)=>{
  if(mode==='freeze')return;
  if(mode==='live'){native(dt,input,activeLevel);return;}
  native(dt,{...empty(),moveX:fixture.cases[caseIndex].inputX[frame]??0},activeLevel);frame++;
  if(p.state!=='grind'||frame>=30){result=p.state==='grind'?'Still grinding after 0.50s':'Exited before 0.50s';mode='freeze';}
};
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='balance-slider-review';
panel.style.cssText='position:fixed;left:5px;top:5px;z-index:999999;max-width:310px;background:#0b2027ed;color:white;padding:6px;font:11px monospace';panel.innerHTML='<summary>Balance slider review</summary>';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='balance-slider-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
const add=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;controls.append(b);};
add('Probe grind',()=>probe());add('Probe manual',()=>probe(true));
fixture.cases.forEach((c,i)=>add(`Watch catch ${c.frame}`,()=>watch(i)));
add('Use build defaults',()=>g.ui.applyTuning(g.ui.defaults));
add('Continue skating',()=>mode='live');
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({state:p.state,mode,result,frame,needle:p.balance,velocity:p.balanceVel,comboAge:p.balanceAge,catchAge:p.balanceEntryAge,lastProbe,
  tuning:{grindCalm:TUNING.grindCalm,manualCalm:TUNING.manualCalm,inputEase:TUNING.balanceSafePeriod,drift:TUNING.balanceDrift,control:TUNING.balanceControl,gravity:TUNING.balanceGravity,inertia:TUNING.balanceInertia}},null,2);requestAnimationFrame(report);}watch(0);report();
