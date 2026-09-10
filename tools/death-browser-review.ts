// Local-only performance/pose review; no save slot or level edits.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player;g.campaign.startEphemeral();g.gameFlow.hide();
let mode='idle',paused=false,side=true;const times:number[]=[],samples:{phase:string;ms:number}[]=[];
const neutral={moveX:0,moveY:0,inventoryHeld:true,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false};
const native=p.step.bind(p);p.onDeath=()=>{};
p.step=(dt:number,_input:any,level:any)=>{if(paused)return;const start=performance.now();native(dt,neutral,level);const ms=performance.now()-start;times.push(ms);if(times.length>120)times.shift();if(mode==='death'&&samples.length<150)samples.push({phase:p.deathPresentationDiagnostics.mode,ms});};
function reset(){mode='idle';paused=false;p.respawn(g.getLevel(),true,true);p.onDeath=()=>{};native(1/60,neutral,g.getLevel());times.length=0;samples.length=0;}
function death(height=0){reset();mode='death';p.pos.y+=height;p.prevPos.copy(p.pos);p.speed=height?10:0;p.vVel=height?-2:0;p.grounded=!height;p.die();p.respawnTimer=60;}
const panel=document.createElement('details');panel.open=true;panel.style.cssText='position:fixed;z-index:999999;right:10px;bottom:10px;width:310px;background:#081d2aee;color:white;padding:10px;font:12px monospace';
const summary=document.createElement('summary');summary.textContent='Death performance review';const buttons=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='death-status';status.style.whiteSpace='pre-wrap';panel.append(summary,buttons,status);document.body.append(panel);
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:7px;margin:2px';b.onclick=fn;buttons.append(b);};
add('Ground death',()=>death());add('Air death',()=>death(5));add('Long fall',()=>death(150));add('Reset',reset);add('Side view',()=>side=!side);add('Pause',()=>paused=true);add('Resume',()=>paused=false);add('Finish review',()=>location.assign('/?playtest&level=jungle'));
const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args:any[])=>{if(args[1]===g.camera&&side){const target=p.renderPosition.clone().add(new THREE.Vector3(0,.7,1));g.camera.position.copy(target).add(new THREE.Vector3(7,2,1.2));g.camera.fov=40;g.camera.lookAt(target);g.camera.updateProjectionMatrix();}render(...args);};
function report(){panel.inert=false;document.body.classList.add('game-debug-hidden');document.body.classList.remove('game-debug-visible');
 status.textContent=JSON.stringify({mode,state:p.state,clip:p.animationClipHint,death:p.deathPresentationDiagnostics,stepAverageMs:times.length?+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3):0,first150AverageMs:samples.length?+(samples.reduce((a,b)=>a+b.ms,0)/samples.length).toFixed(3):0,position:p.pos.toArray().map((v:number)=>+v.toFixed(2))},null,2);requestAnimationFrame(report);}
reset();report();
