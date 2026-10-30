// Local-only review entry. Actual Player, authored level, camera and clip runtime.
import * as THREE from 'three';
import {CONST} from '../src/tuning';
import {CARLISLE_RELAY_JUMPS, CARLISLE_TIDAL_RELAY_LEVEL, carlislePoint} from '../src/levels/carlisle-tidal-relay';
const g=(window as unknown as {__game:any}).__game;
if(!g.launchReview)throw new Error('Use launch-review.html?playtest&level=carlisle-coast&launchReview');
const panel=document.createElement('section');panel.id='launch-review';panel.setAttribute('aria-label','Launch review');
panel.style.cssText='position:fixed;bottom:10px;left:12px;right:12px;z-index:999999;background:#142730ed;color:#f8eee0;padding:12px 16px;border:1px solid #a9d3d0;border-radius:10px;font:13px system-ui;display:flex;gap:10px;align-items:center;flex-wrap:wrap;pointer-events:auto';
panel.innerHTML=`<strong>CARLISLE · LAUNCH STUDY</strong><label>Pad <select aria-label="Launch pad">${CARLISLE_RELAY_JUMPS.map((j,i)=>`<option value="${i}">${j.name}</option>`).join('')}</select></label><label>Rider <select aria-label="Rider mode"><option value="foot">On foot</option><option value="board">On board</option></select></label><button>Replay launch</button><button>Pause</button><button>Step frame</button><label>Speed <select aria-label="Playback speed"><option value="1">1×</option><option value=".25">¼×</option><option value=".1">⅒×</option></select></label><label><input type="checkbox" aria-label="Steer to landing" checked> Steer to landing</label><label><input type="checkbox" aria-label="Pause at apex"> Pause at apex</label><output style="flex-basis:100%;font:12px ui-monospace,monospace"></output>`;
document.body.append(panel);
const viewLabel=document.createElement('label');viewLabel.innerHTML='View <select aria-label="Review view"><option value="game">Gameplay</option><option value="front">Front</option><option value="side">Side</option><option value="three">Three quarter</option></select>';
panel.insertBefore(viewLabel,panel.querySelector('output'));
const qualityLabel=document.createElement('label');qualityLabel.innerHTML='Render <select aria-label="Render resolution"><option value="720">720p</option><option value="max">MAX / native</option></select>';
panel.insertBefore(qualityLabel,panel.querySelector('output'));
const quality=qualityLabel.querySelector('select')!;
quality.value=g.renderQualitySettings.regularResolution==='max'?'max':'720';
quality.onchange=()=>g.renderQualitySettings.setRegularResolution(quality.value==='max'?null:720);
const view=viewLabel.querySelector('select')!;
const savedPosition=new THREE.Vector3(),savedRotation=new THREE.Quaternion();let inspected=false;
g.launchReview.restoreCamera=()=>{if(inspected){g.camera.position.copy(savedPosition);g.camera.quaternion.copy(savedRotation);inspected=false;}};
g.launchReview.afterCamera=()=>{
  if(view.value==='game')return;
  savedPosition.copy(g.camera.position);savedRotation.copy(g.camera.quaternion);inspected=true;
  const aim=g.player.renderPosition.clone().add(new THREE.Vector3(0,1.25,0));
  const forward=g.player.axisF.clone(),right=g.player.axisL.clone();
  g.camera.position.copy(aim).addScaledVector(forward,view.value==='side'?0:5.4).addScaledVector(right,view.value==='front'?0:5.4);g.camera.position.y+=.65;
  g.camera.lookAt(aim);g.camera.updateMatrixWorld();
};
const selects=panel.querySelectorAll('select'),buttons=panel.querySelectorAll('button'),output=panel.querySelector('output')!;
let jump=CARLISLE_RELAY_JUMPS[0],running=false,launched=false,flightId=-1,previousVelocity=0,history:string[]=[];
let ejectFrame=0;
const ejectButton=document.createElement('button');ejectButton.textContent='Abandon Ship';
panel.insertBefore(ejectButton,output);
ejectButton.onclick=()=>{if(g.player.launchPresentation?.board){ejectFrame=1;setPause(false);}};
const setPause=(paused:boolean)=>{g.launchReview.rate=paused?0:Number(selects[2].value);buttons[1].textContent=paused?'Resume':'Pause';};
function replay(){
  const level=g.getLevel();
  jump=CARLISLE_RELAY_JUMPS[Number(selects[0].value)];
  const component=CARLISLE_TIDAL_RELAY_LEVEL.components.find(c=>c.nm===jump.name&&(c.t==='trampoline'||c.t==='mover'))!;
  const mover=jump.moving?level.movers.find((m:any)=>m.mesh.name===jump.name):null;
  const at=mover?mover.mesh.position.clone().add(new THREE.Vector3(0,component.s![1]/2+.15,0))
    :new THREE.Vector3(...component.p).add(new THREE.Vector3(0,.15,0));
  g.player.respawn(level,true,false,{position:at,heading:new THREE.Vector3(0,0,-1)});
  const board=selects[1].value==='board';
  g.player.freeSkate=board;g.player.airFromSkate=board;g.player.airGrav=board?'board':'foot';
  g.player.speed=board?8:0;g.player.endlessDeaths=true;
  history=[];running=true;launched=false;flightId=-1;ejectFrame=0;previousVelocity=0;setPause(false);
}
g.launchReview.beforeStep=()=>{
  if(!running)return;
  const p=g.player,level=g.getLevel(),input=g.input;
  // A second pad can relaunch without a grounded frame. End this one-flight
  // pilot at that contact instead of steering back to the previous target.
  const launch=p.launchPresentation;
  if(launch&&flightId<0)flightId=launch.id;
  if(launch&&launch.id!==flightId){
    running=false;input.moveX=input.moveY=0;input.jumpHeld=input.grindHeld=false;return;
  }
  const next=CARLISLE_RELAY_JUMPS.find(j=>j.from[0]===jump.to[0]);
  const moving=next?.moving?level.movers.find((m:any)=>m.mesh.name===next.name):null;
  const target=moving?moving.mesh.position:new THREE.Vector3(...carlislePoint(...jump.to));
  const dx=target.x-p.pos.x,dz=target.z-p.pos.z,forward=dx*p.axisF.x+dz*p.axisF.z,side=dx*p.axisL.x+dz*p.axisL.z;
  const auto=(panel.querySelector('[aria-label="Steer to landing"]') as HTMLInputElement).checked;
  if(auto){
    // The board retains momentum. Brake by stopping distance rather than
    // replaying the direct-drive on-foot pilot into a carried-speed overshoot.
    const brake=p.launchPresentation?.board?p.speed*Math.abs(p.speed)/(2*Math.max(g.TUNING.airControl,12*(p.launchPresentation?.strength??0))*CONST.airBrakeFactor):0;
    input.moveY=launched&&(Math.abs(forward)>1.5||Math.abs(brake)>.5)?Math.sign(forward-brake):0;
    input.moveX=launched&&Math.abs(side)>2?Math.sign(side):0;
  }
  input.jumpHeld=!launched;input.grindHeld=!!jump.rail&&p.vVel<5;
  if(ejectFrame){
    input.jumpPressed=ejectFrame===1;input.jumpHeld=ejectFrame<7;input.jumpReleased=ejectFrame===7;
    ejectFrame=ejectFrame===7?0:ejectFrame+1;
  }
  if(p.launchPresentation)launched=true;
  if(launched&&previousVelocity>0&&p.vVel<=0&&(panel.querySelector('[aria-label="Pause at apex"]') as HTMLInputElement).checked)setPause(true);
  previousVelocity=p.vVel;
  if(launched&&(p.grounded||p.state==='grind'||p.state==='dead'||p.state==='finished')){running=false;input.moveX=input.moveY=0;input.jumpHeld=input.grindHeld=false;}
};
buttons[0].onclick=replay;buttons[1].onclick=()=>setPause(g.launchReview.rate!==0);
buttons[2].onclick=()=>{setPause(true);g.launchReview.advance=1/60;};
selects[2].onchange=()=>setPause(false);
let lastClip='';
function diagnostics(){
  const p=g.player,launch=p.launchPresentation,cam=g.getLaunchCameraDiagnostics(),clip=g.characterAnimationRuntime.activeClipId??p.animationClipHint;
  if(clip!==lastClip){history.push(clip.replace('player.',''));history=history.slice(-9);lastClip=clip;}
  const loading=g.getLoadingDiagnostics();
  output.textContent=`${loading.phase?`Loading ${loading.phase} · `:''}${clip} · y ${p.pos.y.toFixed(1)}m · vy ${p.vVel.toFixed(1)}m/s · rise ${(launch?.rise??0).toFixed(2)} · gather ${(launch?.gather??0).toFixed(2)} · turn ${(p.launchSomersaultProgress??0).toFixed(2)} · camera ${cam.weight.toFixed(2)} · FOV ${g.camera.fov.toFixed(1)}° | ${history.join(' → ')}`;
  requestAnimationFrame(diagnostics);
}diagnostics();
