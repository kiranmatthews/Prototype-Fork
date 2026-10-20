// Local development fixture: place the real field on the final straight, then
// run the production race step, finish camera, results DOM and pre-CRT renderer.
import * as THREE from 'three';
if(!import.meta.env.DEV)throw new Error('Race finish review is development-only');
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
// Keep unrelated live controller input from advancing this local review.
g.input.pollGamepad=()=>null;
const panel=document.createElement('section');panel.setAttribute('aria-label','Race finish review');
panel.style.cssText='position:fixed;z-index:999999;left:10px;top:10px;max-width:46vw;padding:7px;background:#071b23dc;color:white;font:12px monospace';
const controls=document.createElement('div'),status=document.createElement('output');status.dataset.testid='race-finish-review-status';status.style.cssText='display:block;white-space:pre-wrap';panel.append(controls,status);document.body.append(panel);
let pilot=false,started=false,finishPosition:THREE.Vector3|null=null,notifications=0,initialNotifications=0;
const actions:string[]=[];
document.addEventListener('click',event=>actions.push(`click: ${(event.target as HTMLElement).closest('button')?.textContent??'world'}`),true);
document.addEventListener('keydown',event=>actions.push(`key: ${event.code}`),true);
const race=g.getSkateRace(),native=race.step.bind(race),nativeStart=race.start.bind(race);
// Synthetic short runs must never replace the player's real campaign records.
race.onFinish=()=>{notifications++;};
race.start=(...args:any[])=>{pilot=false;return nativeStart(...args);};
race.step=(dt:number,input:any)=>native(dt,pilot&&race.phase==='running'?race.drive(0):input);
function start(mode:'race'|'time-trial'){
 race.start(mode,0);race.phase='running';pilot=started=true;finishPosition=null;initialNotifications=notifications;
 for(const rider of race.riders.slice(0,race.count)){
  const at=race.course.length-(rider.id?40+rider.id*14:16),point=race.course.sample(at,(rider.id%4-1.5)*1.7);
  const support=race.course.supportAt(g.getLevel(),point,new THREE.Vector3(),12,15);if(!support)throw new Error('Missing finish fixture support');
  rider.player.resetRacePosition(g.getLevel(),support,race.course.tangent(at));rider.player.speed=28;
  rider.progress=rider.previousProgress=rider.anchorProgress=at;rider.anchor.copy(support);
 }
}
function button(label:string,action:()=>void){const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:5px;margin:2px';b.onclick=action;controls.append(b);}
button('Race finish',()=>start('race'));button('Trial finish',()=>start('time-trial'));
button('Hide review',()=>{panel.hidden=true;});
function report(){
 panel.inert=false;
 if(started&&race.phase==='finished'&&!finishPosition)finishPosition=g.player.pos.clone();
 status.textContent=JSON.stringify({phase:race.phase,arrived:race.riders.slice(0,race.count).filter((r:any)=>r.finish!==null).length,
  actions:actions.slice(-4),input:[g.input.jumpPressed,g.input.confirmPressed,g.input.moveX,g.input.moveY],time:race.hud()?.elapsed,rollout:finishPosition?+g.player.pos.distanceTo(finishPosition).toFixed(2):null,notifications:notifications-initialNotifications,
  falls:race.riders.slice(0,race.count).map((r:any)=>r.falls),camera:g.camera.position.toArray().map((n:number)=>+n.toFixed(1))});
 requestAnimationFrame(report);
}report();
