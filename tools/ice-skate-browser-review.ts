// Local review of ice skating, using ordinary device inputs.
import * as THREE from 'three';
import {Level} from '../src/level';
const g:any=await new Promise(resolve=>{const poll=()=>{const v=(window as any).__game;if(v)resolve(v);else requestAnimationFrame(poll);};poll();});
g.campaign.startEphemeral();g.gameFlow.hide();
const p=g.player,runtime=g.characterAnimationRuntime;
const fixture=new Level(g.scene,{id:'ice-skate-review',name:'Ice skate review',data:{v:1,name:'Ice skate review',spawn:[1000,.02,10],killY:-20,components:[
 {t:'platform',p:[1000,-1.5,-250],s:[200,3,600],slip:true,iceGrip:.08,tex:'solid',color:'#a6dfe9',edgeGrinding:false},
 {t:'platform',p:[1200,-1.5,-250],s:[200,3,600],tex:'solid',color:'#b6bdc7',edgeGrinding:false},
 {t:'gate',p:[1200,0,-540]},
]}});
fixture.setRunModesEnabled(false);
let frame=0,frozen=false,mode='Ice cruise',angle=2.6,dry=false,goofy=false;
const reset=()=>{p.respawn(fixture,true,false,{position:new THREE.Vector3(dry?1200:1000,.02,10)});p.stance=goofy?-1:1;runtime.restart();frame=0;frozen=false;};reset();
const render=g.renderer.render.bind(g.renderer);
g.renderer.render=(...args:any[])=>{if(args[1]===g.camera){g.camera.position.copy(p.pos).add(new THREE.Vector3(Math.sin(angle)*6,3.1,Math.cos(angle)*6));g.camera.up.set(0,1,0);g.camera.lookAt(p.pos.x,p.pos.y+1.45,p.pos.z);g.camera.updateMatrixWorld(true);}return render(...args);};
const step=p.step.bind(p);p.step=(dt:number)=>{if(frozen)return;
 let input:any=frame<90?{moveY:1,jumpHeld:true}:frame===90?{jumpReleased:true}:frame<160?{moveY:1}:{};
 if(frame>=160){if(mode==='Ice steering')input={moveY:.3,moveX:(Math.floor((frame-160)/100)%2?-.85:.85)};else if(mode==='Ice brake')input={grabHeld:true};}
 step(dt,{moveX:0,moveY:0,jumpHeld:false,jumpPressed:frame===0,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,...input},fixture);fixture.update(dt);frame++;
 if(frame>850)reset();
};
const panel=document.createElement('div');panel.style.cssText='position:fixed;top:8px;left:8px;max-width:330px;z-index:999999;background:#142434ed;color:white;padding:10px;font:12px monospace';
const status=document.createElement('pre');status.dataset.testid='ice-skate-status';document.body.append(panel);
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.onclick=fn;panel.append(b);};
for(const name of ['Ice cruise','Ice steering','Ice brake','Dry cruise'])add(name,()=>{mode=name;dry=name==='Dry cruise';reset();});
add('Freeze',()=>frozen=!frozen);add('Switch stance',()=>{goofy=!goofy;reset();});
for(const [name,yaw] of [['Front',Math.PI],['Side',Math.PI/2],['Rear',0],['Quarter',2.6]] as const)add(name,()=>angle=yaw);
panel.append(status);
function report(){panel.inert=false;const motion=p.boardG?.userData.iceSkateMotion;status.textContent=JSON.stringify({mode,frame,stance:p.stance,speed:+p.speed.toFixed(2),grounded:p.grounded,board:p.freeSkate,ice:p.groundHit?.slippy??false,iceWeight:motion?.weight??0,steer:motion?.steering??0,brace:motion?.brace??0,footError:p.boardG?.userData.skateContact?.footError,deaths:p.totalDeaths},null,1);requestAnimationFrame(report);}report();
