import * as THREE from 'three';
import type { Level, Enemy } from '../level';
import { ENEMY_KINDS, type EnemyKind } from './types';

const required=<T extends HTMLElement>(id:string):T=>document.getElementById(id) as T;
const iframe=required<HTMLIFrameElement>('game'),lite=required<HTMLInputElement>('lite'),levelSelect=required<HTMLSelectElement>('level');
type Hook='onDeath'|'onRespawn'|'onCheckpoint'|'onFinish';
interface ReviewPlayer {
  pos:THREE.Vector3;prevPos:THREE.Vector3;axisF:THREE.Vector3;axisL:THREE.Vector3;
  state:string;grounded:boolean;vVel:number;speed:number;surfaceName:string;
  lives:number;totalDeaths:number;points:number;masks:number;spinTimer:number;
  laneCursor:{s:number};viewInput:{reset():void};
  settle(level:Level,facing?:THREE.Vector3):void;
  snapRenderInterpolation():void;prepareStartPresentation(level:Level):void;
  respawn(level:Level,hard?:boolean,preserveInventory?:boolean):void;
  onDeath:(...args:unknown[])=>unknown;onRespawn:(...args:unknown[])=>unknown;
  onCheckpoint:(...args:unknown[])=>unknown;onFinish:(...args:unknown[])=>unknown;
}
interface Game {player:ReviewPlayer;getLevel():Level;camera:THREE.Camera;getCurrentLevel():{id:string};
  gameFlow:{blocksGameplay:boolean;currentScreen:string|null};getLoadingDiagnostics():unknown;}
type GameWindow=Window&{__game?:Game;KeyboardEvent:typeof KeyboardEvent};
let game:Game|null=null,selected:EnemyKind='grunt',busy=false,generation=0,navigationPending=true;
const held=new Set<string>(),events:{id:number;type:string;state:string;position:number[]}[]=[];
let eventId=0;
const originalHooks=new Map<Hook,ReviewPlayer[Hook]>();
const rootUrl=new URL('../../',location.href),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
const pause=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));
const round=(n:number)=>Math.round(n*1000)/1000;
const position=(point:THREE.Vector3)=>point.toArray().map(round);
function child():GameWindow {return iframe.contentWindow as GameWindow;}
function liveGame():Game {if(!game)throw new Error('Game hooks are not ready.');return game;}
function enemy():Enemy {const value=liveGame().getLevel().enemies.find(value=>value.kind===selected);if(!value)throw new Error(`${selected} is absent from this level.`);return value;}
function snapshot():Record<string,unknown> {
  if(!game)return {ready:false};
  const p=game.player,l=game.getLevel(),e=l.enemies.find(value=>value.kind===selected);
  return {level:game.getCurrentLevel().id,blocked:game.gameFlow.blocksGameplay,screen:game.gameFlow.currentScreen,
    player:{state:p.state,position:position(p.pos),grounded:p.grounded,surface:p.surfaceName,speed:round(p.speed),verticalVelocity:round(p.vVel),lives:p.lives,deaths:p.totalDeaths,points:p.points,masks:p.masks,spinning:p.spinTimer>0},
    checkpoint:l.activeCheckpoint?l.checkpoints.indexOf(l.activeCheckpoint):null,currentSpawn:position(l.currentSpawn),
    selected:selected,enemy:e?{alive:e.alive,state:e.state,position:position(e.group.position),flags:{spin:e.spinKill,stomp:e.stompKill,melee:e.meleeKill,touchHurt:e.touchHurt},model:structuredClone(e.visual.diagnostics)}:null,
    readyModels:l.enemies.filter(value=>value.visual.diagnostics.status==='ready').length,totalEnemies:l.enemies.length,
    camera:position(game.camera.position),events:eventId};
}
function setKeys(codes:string[]):void {
  const wanted=new Set(codes),w=child();
  for(const code of held)if(!wanted.has(code)){w.dispatchEvent(new w.KeyboardEvent('keyup',{code,bubbles:true}));held.delete(code);}
  for(const code of wanted)if(!held.has(code)){w.dispatchEvent(new w.KeyboardEvent('keydown',{code,bubbles:true}));held.add(code);}
}
async function pulse(codes:string[],duration=180):Promise<void> {setKeys(codes);await pause(duration);setKeys([]);}
function floorAt(x:number,z:number,hint:number,finishOnly=false):number|null {
  const l=liveGame().getLevel(),meshes=finishOnly?l.groundMeshes.filter(mesh=>mesh.userData.finishPad):l.groundMeshes;
  for(const mesh of meshes)mesh.updateWorldMatrix(true,false);
  ray.set(new THREE.Vector3(x,Math.max(512,hint+256),z),down);ray.far=4096;
  const hits=ray.intersectObjects(meshes,false).filter(hit=>hit.face&&hit.face.normal.y>.15);
  if(!hits.length)return null;
  hits.sort((a,b)=>Math.abs(a.point.y-hint)-Math.abs(b.point.y-hint));return hits[0].point.y;
}
function place(point:THREE.Vector3,air=false,heading?:THREE.Vector3):void {
  const {player:p}=liveGame(),l=liveGame().getLevel();setKeys([]);
  if(liveGame().gameFlow.blocksGameplay)throw new Error('Game is showing a menu/results. Reload the game to stage another probe.');
  p.laneCursor.s=-1;p.viewInput.reset();p.pos.copy(point);l.playerPos.copy(point);p.settle(l,heading);
  if(air){p.grounded=false;p.state='air';p.vVel=-1;}
  p.prevPos.copy(p.pos);p.snapRenderInterpolation();p.prepareStartPresentation(l);
}
function stageEnemy(distance=4):void {
  const e=enemy();if(!e.alive)throw new Error('This enemy is defeated. Reset the live run to restore it.');
  const candidates=[[0,distance],[distance,0],[-distance,0],[0,-distance]];
  for(const [dx,dz] of candidates){
    const x=e.group.position.x+dx,z=e.group.position.z+dz,y=floorAt(x,z,e.baseY);
    if(y===null||Math.abs(y-e.baseY)>2)continue;
    const at=new THREE.Vector3(x,y+.04,z),heading=e.group.position.clone().sub(at).setY(0).normalize();
    place(at,false,heading);return;
  }
  throw new Error('No supported staging point found within the four reviewed offsets.');
}
async function approach(spin=false,duration=900):Promise<void> {
  const until=performance.now()+duration,token=generation;
  while(performance.now()<until&&token===generation){
    const p=liveGame().player,e=enemy();if(!e.alive||p.state==='dead'||p.state==='gameover')break;
    const delta=e.group.position.clone().sub(p.pos).setY(0),distance=delta.length();delta.normalize();
    const x=delta.dot(p.axisL),y=delta.dot(p.axisF),codes:string[]=[];
    if(distance>.8){if(x>.3)codes.push('KeyD');else if(x<-.3)codes.push('KeyA');if(y>.3)codes.push('KeyW');else if(y<-.3)codes.push('KeyS');}
    if(spin&&distance<2.4)codes.push('KeyF');setKeys(codes);await pause(50);
  }
  setKeys([]);
}
async function probe(label:string,action:()=>void|Promise<void>,waitMs:number,observed:(before:Record<string,unknown>,after:Record<string,unknown>,newEvents:typeof events)=>boolean):Promise<void> {
  if(busy)return;busy=true;const token=++generation,before=snapshot(),startEvent=eventId;
  required('probe-status').textContent=`Running: ${label}`;
  required('result').textContent=JSON.stringify({probe:label,status:'running',before},null,2);
  try{
    await action();await pause(waitMs);if(token!==generation)return;
    const after=snapshot(),newEvents=events.filter(event=>event.id>startEvent),detected=observed(before,after,newEvents);
    required('probe-status').textContent=detected?`${label}: expected engine result observed.`:`${label}: no expected engine result observed in this window.`;
    required('result').textContent=JSON.stringify({probe:label,status:detected?'observed':'not-observed',before,after,events:newEvents},null,2);
  }catch(error){required('probe-status').textContent=error instanceof Error?error.message:String(error);
    required('result').textContent=JSON.stringify({probe:label,status:'error',before,error:String(error)},null,2);
  }finally{if(token===generation){setKeys([]);busy=false;}refresh();}
}
const hasEvent=(type:string)=>(_a:unknown,_b:unknown,list:typeof events)=>list.some(event=>event.type===type);
const encounterChanged=(before:Record<string,unknown>,after:Record<string,unknown>,list:typeof events):boolean=>
  Boolean((before.enemy as {alive:boolean})?.alive&&!(after.enemy as {alive:boolean})?.alive)||
  list.some(event=>event.type==='onDeath')||
  (before.player as {masks:number})?.masks!==(after.player as {masks:number})?.masks;
function inspect(kind:EnemyKind):void {
  if(busy)return;
  selected=kind;required('selected').textContent=`${kind} selected · setup leaves the enemy alive and its AI running.`;
  void probe(`Inspect ${kind}`,()=>stageEnemy(),650,(_before,after)=>Boolean((after.player as {grounded:boolean})?.grounded));refresh();
}
const actions:Record<string,()=>void>={
  approach:()=>void probe('Approach',()=>approach(false),250,(before,after)=>{const a=(before.player as {position:number[]}).position,b=(after.player as {position:number[]}).position;return Math.hypot(b[0]-a[0],b[2]-a[2])>.05;}),
  spin:()=>void probe('Spin',()=>pulse(['KeyF'],250),650,encounterChanged),
  'approach-spin':()=>void probe('Approach and spin',()=>approach(true,1400),650,encounterChanged),
  jump:()=>void probe('Jump',()=>pulse(['Space'],180),180,(before,after)=>Boolean((before.player as {grounded:boolean})?.grounded&&!(after.player as {grounded:boolean})?.grounded)),
  'jump-spin':()=>void probe('Jump and spin',async()=>{await pulse(['Space'],180);await pause(100);await pulse(['KeyF'],220);},500,encounterChanged),
  stomp:()=>void probe('Falling stomp',()=>{const e=enemy();place(e.group.position.clone().setY(e.box.max.y+1.5),true);},1400,encounterChanged),
  pit:()=>void probe('Kill-plane drop',()=>{const p=liveGame().player,l=liveGame().getLevel();place(p.pos.clone().setY(l.killY-2),true);},2600,hasEvent('onDeath')),
  respawn:()=>void probe('Space respawn',()=>pulse(['Space'],200),1600,hasEvent('onRespawn')),
  checkpoint:()=>void probe('Checkpoint stomp',()=>{const l=liveGame().getLevel(),cp=l.checkpoints.find(value=>!value.active);if(!cp)throw new Error('No inactive checkpoint remains. Reset the live run first.');const c=cp.box.getCenter(new THREE.Vector3());place(c.setY(cp.box.max.y+1.4),true);},1600,hasEvent('onCheckpoint')),
  finish:()=>void probe('Finish pad landing',()=>{const l=liveGame().getLevel(),at=l.finishGlow.getCenter(new THREE.Vector3()),floor=floorAt(at.x,at.z,l.finishBox.min.y,true);if(floor===null)throw new Error('No finish-pad support found.');place(at.setY(floor+.7),true);},2000,hasEvent('onFinish')),
  reset:()=>void probe('Reset live run',()=>{if(liveGame().gameFlow.blocksGameplay)throw new Error('Reload the game to leave its menu/results screen.');liveGame().player.respawn(liveGame().getLevel(),true,true);},500,hasEvent('onRespawn')),
  stop:()=>{generation++;busy=false;setKeys([]);required('probe-status').textContent='Inputs released; no probe result inferred.';refresh();},
};
for(const kind of ENEMY_KINDS){const button=document.createElement('button');button.textContent=kind;button.dataset.kind=kind;button.addEventListener('click',()=>inspect(kind));required('roster').append(button);}
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>button.addEventListener('click',()=>actions[button.dataset.action!]?.()));
function attach(next:Game):void {
  game=next;originalHooks.clear();
  for(const hook of ['onDeath','onRespawn','onCheckpoint','onFinish'] as Hook[]){
    const original=next.player[hook];originalHooks.set(hook,original);
    next.player[hook]=(...args:unknown[])=>{events.push({id:++eventId,type:hook,state:next.player.state,position:position(next.player.pos)});if(events.length>30)events.shift();return original.apply(next.player,args);};
  }
  required('probe-status').textContent='Connected. Select an enemy to stage an encounter.';refresh();
}
function refresh():void {
  const ready=!!game;
  required('connection-status').textContent=game?`${game.getCurrentLevel().id} · ${game.getLevel().enemies.filter(e=>e.visual.diagnostics.status==='ready').length}/${game.getLevel().enemies.length} enemy models ready`:'Loading real game…';
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>button.disabled=!ready||(busy&&button.dataset.action!=='stop'));
  document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button=>{button.disabled=!ready||busy||!game?.getLevel().enemies.some(e=>e.kind===button.dataset.kind);button.classList.toggle('selected',button.dataset.kind===selected);});
  required('live').textContent=JSON.stringify(snapshot(),null,2);required('events').textContent=JSON.stringify(events,null,2);
}
function load():void {
  generation++;busy=false;if(game)setKeys([]);game=null;navigationPending=true;held.clear();events.length=0;eventId=0;
  if(location.port!=='5291'){
    required('probe-status').textContent='Open this internal harness on the isolated QA origin at port 5291.';
    iframe.src='about:blank';refresh();return;
  }
  const url=new URL(rootUrl);url.searchParams.set('playtest','');url.searchParams.set('level',levelSelect.value);if(lite.checked)url.searchParams.set('lite','');
  iframe.src=url.href;required('probe-status').textContent='Loading actual game and models…';refresh();
}
required('reload').addEventListener('click',load);lite.addEventListener('change',load);levelSelect.addEventListener('change',load);
iframe.addEventListener('load',()=>{navigationPending=false;});
const poll=window.setInterval(()=>{try{const candidate=navigationPending?undefined:child().__game;if(candidate&&candidate!==game)attach(candidate);refresh();}catch(error){required('connection-status').textContent=`Connection unavailable: ${String(error)}`;}},200);
window.addEventListener('beforeunload',()=>{window.clearInterval(poll);if(game){setKeys([]);for(const [name,original] of originalHooks)game.player[name]=original;}});
load();
