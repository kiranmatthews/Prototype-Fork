// Local browser QA entry only. Not imported by the production application.
import * as THREE from 'three';
import { SkateChaseCamera } from '../src/skateChaseCamera';
import { JungleCupEvent } from '../src/competition/event';
const ready = () => new Promise<any>(resolve => {
  const poll = () => { const g=(window as any).__game; if(g)resolve(g);else requestAnimationFrame(poll); };poll();
});
const g = await ready();
let cameraMs=0,physicsMs=0,drawMs=0,lastDrawMs=0;
const nativeCamera=SkateChaseCamera.prototype.update;
SkateChaseCamera.prototype.update=function(...args){const start=performance.now();nativeCamera.apply(this,args);cameraMs=performance.now()-start;};
const nativeRender=g.renderer.render.bind(g.renderer);
g.renderer.render=(...args:any[])=>{const start=performance.now();nativeRender(...args);drawMs+=performance.now()-start;};
const panel=document.createElement('section');panel.dataset.testid='skate-review';
panel.style.cssText='position:fixed;z-index:999999;left:30px;top:20px;background:#10291eee;color:#f1edd9;padding:12px;font:12px monospace;width:350px;border:1px solid #99bc99;border-radius:8px';
const controls=document.createElement('div'),status=document.createElement('pre');status.style.cssText='white-space:pre-wrap; margin:8px 0 0';
panel.append(controls,status);document.body.append(panel);
const blank=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
let route:any=null, frame=0, events:string[]=[], freeze=false, placed=false;
let firstAir=false, firstLanding=false, pauseAtApex=false, lastVert=false, previousY=0;
const nativeRunStep=JungleCupEvent.prototype.stepRun;
JungleCupEvent.prototype.stepRun=function(dt,score,active){return nativeRunStep.call(this,freeze?0:dt,score,active);};
const originalStep=g.player.step.bind(g.player);
g.player.step=(dt:number,input:any,level:any)=>{
  if(freeze)return;
  if(route){
    if(!placed){
      g.player.respawn(level,true,true,{position:new THREE.Vector3(...route.p),heading:new THREE.Vector3(...route.h)});
      g.player.axisF.set(...route.h).normalize();g.player.axisL.set(route.h[2],0,-route.h[0]).normalize();
      g.player.freeSkate=true;g.player.speed=route.speed??23;
      g.player.groundHit=g.player.queryGround(level);g.player.rideNormal.copy(g.player.groundHit.normal);
      placed=true;route.setup?.();
    }
    const scripted={...blank(),...route.input(frame,g.player)};
    const beforePhysics=performance.now();originalStep(dt,scripted,level);physicsMs=performance.now()-beforePhysics;frame++;
    const p=g.player;
    if(p.vertAir&&!lastVert){events.push(`takeoff ${p.pos.toArray().map((n:number)=>n.toFixed(2)).join(', ')}`);firstAir=true;}
    if(firstAir&&!firstLanding&&p.grounded){firstLanding=true;events.push(`landing ${p.pos.toArray().map((n:number)=>n.toFixed(2)).join(', ')}`);if(route.firstLanding)freeze=true;}
    if(pauseAtApex&&p.vertAir&&previousY>0&&p.vVel<=0){freeze=true;events.push('paused at apex');}
    lastVert=p.vertAir;previousY=p.vVel;
    if(route.recovery&&p.bailTimeLeft===0&&p.freeSkate){freeze=true;events.push('board remounted automatically');}
    if(frame>=route.frames){freeze=true;events.push('route complete');}
  }else originalStep(dt,input,level);
};
function button(name:string,fn:()=>void){const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:2px;padding:5px;background:#cee3bd;border:0;border-radius:3px;cursor:pointer';b.onclick=fn;controls.append(b);}
function start(name:string,p:number[],h:number[],input:(f:number,p:any)=>any,frames=720,speed=15.3){g.competitionAction('retry');route={name,p,h,input,frames,speed,firstLanding:true};frame=0;events=[];freeze=false;placed=false;firstAir=false;firstLanding=false;lastVert=false;previousY=0;}
const push=(f:number)=>({jumpHeld:true,jumpPressed:f===0});
button('North vert',()=>start('North vert',[28,.1,-90],[0,0,-1],push));
button('South vert',()=>start('South vert',[0,.1,0],[0,0,1],push));
button('East vert',()=>start('East vert',[28,.1,-42],[1,0,0],push));
button('West vert',()=>start('West vert',[-28,.1,-70],[-1,0,0],push));
button('Corner',()=>start('Corner',[26,.1,6],[1,0,1],push));
button('Carve',()=>{start('Carve',[0,.1,6],[0,0,-1],f=>({...push(f),moveX:f<120?.7:f<270?-.7:0}),420,12);route.firstLanding=false;});
button('Charged vert',()=>{let popped=false;start('Charged vert',[0,.1,10],[0,0,1],(f,p)=>{const pop=!popped&&p.grounded&&p.rideNormal.y<.12;if(pop)popped=true;return {jumpHeld:!popped,jumpPressed:f===0,jumpReleased:pop};});});
button('Transfer over',()=>start('Transfer over',[0,.1,10],[0,0,1],f=>({...push(f),moveY:1})));
button('Angled vert',()=>start('Angled vert',[0,.1,10],[.45,0,1],push));
button('Pause at apex',()=>{pauseAtApex=!pauseAtApex;});
button('Resume',()=>{pauseAtApex=false;freeze=false;});
button('Manual input',()=>{route=null;freeze=false;g.competitionAction('retry');});
button('User replay',async()=>{route=null;freeze=false;g.loadReplay(await(await fetch('/tools/fixtures/jungle-cup-user-replay.json')).json());g.competitionAction('start');});
button('Overtime manual',()=>{
 start('Overtime manual',[5,.1,10],[0,0,-1],(_f,p)=>({moveY:p.balance>0?.5:-.5}),180,12);
 route.firstLanding=false;route.setup=()=>{const p=g.player;g.getCompetition().remaining=.1;p.points=1234;p.comboPoints=200;p.comboMult=2;p.comboHasTrick=true;p.comboLabels=['Manual'];p.comboTimer=.65;p.manualing=1;};
});
button('Bank final combo',()=>{if(!route)return;g.player.manualing=0;g.player.comboTimer=.05;route.input=blank;route.frames=frame+20;freeze=false;});
button('Bail final combo',()=>{if(!route)return;g.player.bail();route.input=blank;route.frames=frame+20;freeze=false;});
button('Auto remount',()=>{start('Auto remount',[5,.1,14],[0,0,-1],blank,360,12);route.firstLanding=false;route.recovery=true;route.setup=()=>g.player.bail();});
button('Hide panel',()=>{panel.style.opacity=panel.style.opacity==='0.15'?'1':'0.15';});
function render(){
 const p=g.player,c=g.camera;lastDrawMs=drawMs;drawMs=0;
 status.textContent=`${route?.name??'Live input'} · frame ${frame} ${freeze?'PAUSED':''}\n${p.state} ${p.vertAir?'VERT':''} · speed ${p.speed.toFixed(1)} · vy ${p.vVel.toFixed(1)}\nboard ${p.freeSkate?'mounted':'off'} · bail ${p.bailTimeLeft.toFixed(2)}\nevent ${g.getCompetition()?.phase} · clock ${g.getCompetition()?.remaining.toFixed(2)} · overtime ${g.getCompetition()?.overtime}\nplayer ${p.pos.toArray().map((n:number)=>n.toFixed(2)).join(', ')}\nCPU cam ${cameraMs.toFixed(1)} / sim ${physicsMs.toFixed(1)} / draw ${lastDrawMs.toFixed(1)} ms · focus ${document.hasFocus()}\nrender ${(1/Math.max(.001,g.frameStats.rawDt)).toFixed(0)} fps · ${g.renderer.info.render.calls} draws\ncamera ${c.position.toArray().map((n:number)=>n.toFixed(2)).join(', ')}\n${events.slice(-4).join('\n')}`;
 requestAnimationFrame(render);
}render();
