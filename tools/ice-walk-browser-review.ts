// Local animation review. All locomotion uses normal input and unchanged ice.
import * as THREE from 'three';
import { Level } from '../src/level';
const g:any=await new Promise(resolve=>{const poll=()=>{const v=(window as any).__game;if(v)resolve(v);else requestAnimationFrame(poll);};poll();});
g.campaign.startEphemeral();g.gameFlow.hide();
const p=g.player,runtime=g.characterAnimationRuntime;
const fixture=new Level(g.scene,{id:'ice-walk-review',name:'Ice walking',data:{v:1,name:'Ice walking',spawn:[1000,.04,10],killY:-20,components:[
 {t:'platform',p:[1000,-1.5,-40],s:[24,3,130],slip:true,iceGrip:.08,tex:'solid',color:'#a6dfe9'},
 {t:'platform',p:[1024,-1.5,-40],s:[24,3,130],tex:'solid',color:'#b6bdc7'},
 {t:'gate',p:[1024,0,-103]},
]}});
fixture.setRunModesEnabled(false);
let input:any={},frozen=false,mode='Idle on ice',cycle=false,frame=0,angle=2.6;
const reset=(dry=false)=>{p.respawn(fixture,true,false,{position:new THREE.Vector3(dry?1024:1000,.04,10)});runtime.restart();frozen=false;};reset();
const render=g.renderer.render.bind(g.renderer),eye=new THREE.Vector3(),target=new THREE.Vector3();
g.renderer.render=(...args:any[])=>{if(args[1]===g.camera){eye.copy(p.pos).add(new THREE.Vector3(Math.sin(angle)*7,3.4,Math.cos(angle)*7));target.copy(p.pos).add(new THREE.Vector3(0,1.45,0));g.camera.position.copy(eye);g.camera.up.set(0,1,0);g.camera.lookAt(target);g.camera.updateMatrixWorld(true);}return render(...args);};
const step=p.step.bind(p);p.step=(dt:number)=>{if(frozen)return;
 if(cycle){const beat=Math.floor(frame++/240)%4;input=beat===0?{moveY:.7}:beat===1?{}:beat===2?{moveX:.7}:{};mode=['Push','Coast','Side correction','Settle'][beat];}
 step(dt,{moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,grabHeld:false,grabPressed:false,...input},fixture);fixture.update(dt);
 if(Math.abs(p.pos.z+40)>61||Math.abs(p.pos.x-1012)>22)reset();
};
const panel=document.createElement('div');panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:999999;background:#142434ed;color:white;padding:10px;font:12px monospace;max-width:520px';
const buttons=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='ice-walk-status';panel.append(buttons,status);document.body.append(panel);
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.onclick=fn;buttons.append(b);};
for(const [name,value] of [['Push',{moveY:.7}],['Slow push',{moveY:.2}],['Coast',{}],['Reverse',{moveY:-.7}],['Sideways',{moveX:.7}],['Crouch',{grabHeld:true}]] as const)add(name,()=>{cycle=false;frozen=false;input=value;mode=name;});
add('Jump',()=>{cycle=false;frozen=false;input={jumpHeld:true};mode='Charge';setTimeout(()=>{input={jumpReleased:true};mode='Jump';setTimeout(()=>input={},35);},450);});
add('Cycle',()=>{cycle=true;frozen=false;frame=0;});add('Freeze',()=>frozen=!frozen);
add('Ice start',()=>{input={};cycle=false;reset();mode='Idle on ice';});add('Dry start',()=>{input={moveY:.7};cycle=false;reset(true);mode='Dry comparison';});
add('Front',()=>angle=Math.PI);add('Side',()=>angle=Math.PI/2);add('Rear',()=>angle=0);add('Quarter',()=>angle=2.6);
function report(){panel.inert=false;const d=runtime.diagnostics;status.textContent=JSON.stringify({mode,hint:p.animationClipHint,clip:d.activeClipId,phase:+(d.timelineTime??0).toFixed(3),speed:+p.walkVelocity.length().toFixed(3),grounded:p.grounded,ice:p.groundHit?.slippy??false,effort:p.animationIntent.motion.inputs.iceEffort,drift:p.animationIntent.motion.inputs.iceSideSlip,blend:d.transitionBlendWeight,deaths:p.totalDeaths},null,1);requestAnimationFrame(report);}report();
