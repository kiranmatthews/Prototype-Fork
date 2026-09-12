// Local-only curved-rail animation comparison; balance is held constant to
// isolate the head from gameplay difficulty. Does not save tuning or poses.
import * as THREE from 'three';
import {Rail} from '../src/rails';
import {TUNING} from '../src/tuning';
import {JungleCupEvent} from '../src/competition/event';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player,level=g.getLevel(),native=p.step.bind(p),saved={balanceDrift:TUNING.balanceDrift,balanceNoise:TUNING.balanceNoise};
const rails=[-1,1].map(bend=>new Rail(Array.from({length:37},(_,i)=>{const a=i/36*Math.PI;return new THREE.Vector3(bend*35*Math.cos(a),8,-35-35*Math.sin(a));})));
for(const rail of rails){level.rails.push(rail);level.grindRails.push(rail);level.root.add(rail.object);}level.root.updateMatrixWorld(true);
let legacy=false,bend=-1,frame=0,frozen=false,peak=0,last=new THREE.Quaternion();
const neutral=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:true,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
const eventRun=JungleCupEvent.prototype.stepRun;JungleCupEvent.prototype.stepRun=function(_dt,...args){return eventRun.call(this,0,...args);};
function start(old:boolean,side=bend){
  legacy=old;bend=side;frame=0;peak=0;frozen=false;g.gameFlow.hide();g.competitionAction('retry');g.getCompetition().phase='running';
  TUNING.balanceDrift=0;TUNING.balanceNoise=0;
  const rail=rails[side<0?0:1],position=rail.pointAt(2).add(new THREE.Vector3(0,.25,0)),heading=rail.tangentAt(2);
  p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.speed=8;p.vVel=0;
  p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;
  native(1/60,{...neutral(),grindPressed:true,moveX:side},level);p.grindStyle='board';p.grindCrossDir=side;p.balance=.4;p.balanceVel=0;p.commitRenderStep(level);last.copy(p.headM.quaternion);
}
p.step=(dt:number,_input:any,activeLevel:any)=>{
  if(frozen)return;
  // Recreate the old feedback path for comparison without changing the fix.
  if(legacy){p.headPitchPose=p.headM.rotation.x;p.headYawPose=p.headM.rotation.y;}
  native(dt,neutral(),activeLevel);frame++;
  if(frame>60)peak=Math.max(peak,THREE.MathUtils.radToDeg(p.headM.quaternion.angleTo(last)));
  last.copy(p.headM.quaternion);if(frame>=360||p.state!=='grind')frozen=true;
};
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='grind-head-review';
panel.style.cssText='position:fixed;left:5px;top:5px;z-index:999999;max-width:300px;background:#10202bea;color:white;padding:7px;font:12px monospace';panel.innerHTML='<summary>Grind head review</summary>';
const buttons=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='grind-head-status';status.style.whiteSpace='pre-wrap';panel.append(buttons,status);document.body.append(panel);
const add=(label:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;buttons.append(b);};
add('Fixed left',()=>start(false,-1));add('Fixed right',()=>start(false,1));add('Old feedback',()=>start(true));add('Freeze',()=>frozen=true);add('Continue',()=>frozen=false);
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({mode:legacy?'old feedback':'fixed',bend,frame,state:p.state,balance:p.balance,peakDegreesPerStep:peak,headEuler:p.headM.rotation.toArray().slice(0,3)},null,2);requestAnimationFrame(report);}start(false);report();
window.addEventListener('pagehide',()=>Object.assign(TUNING,saved));
