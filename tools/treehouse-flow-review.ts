// Local-only review controls. Pilots submit ordinary input to the real Player.
import * as THREE from 'three';
import {treehouseTrialPoint as point} from '../src/levels/treehouse-trials-continuity';
import {treehouseReviewRoute} from './treehouse-trail-review-route';
const g:any=await new Promise(resolve=>{const ready=()=>{const value=(window as any).__game;value?resolve(value):requestAnimationFrame(ready);};ready();});
const p=g.player,l=g.getLevel();g.campaign.startEphemeral();
const data=l.captureData(),half=data.components.find((c:any)=>c.nm==='Long sunlit cavern timber halfpipe');
const rope=data.components.find((c:any)=>c.t==='rope'),near=rope.p[2]+rope.len/2,far=rope.p[2]-rope.len/2;
const panel=document.createElement('details');panel.open=true;panel.style.cssText='position:fixed;left:6px;top:6px;z-index:999999;background:#09231eeb;color:white;padding:8px;max-width:340px;font:12px monospace';
panel.innerHTML='<summary>Treehouse flow review</summary>';const controls=document.createElement('div'),status=document.createElement('pre');status.id='flow-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
let route:THREE.Vector3[]=[],index=0,ticks=0,mode='Ready',frozen=false,grindFrames=0,baseDeaths=0,maxTurn=0,runwayYaw=0;
const lastCamera=g.camera.quaternion.clone();const results:any[]=[];
const neutral=(input:any)=>{input.moveX=input.moveY=0;for(const key of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed'])input[key]=false;};
function place(q:number[],heading=[0,0,-1]){route=[];frozen=false;neutral(g.input);g.gameFlow.hide();p.respawn(l,true,true,{position:new THREE.Vector3(...q),heading:new THREE.Vector3(...heading)});mode='Manual';}
function run(name:string,from:number[],targets:number[][]){place(from);route=targets.map(q=>new THREE.Vector3(...q));index=ticks=grindFrames=0;baseDeaths=p.totalDeaths;maxTurn=runwayYaw=0;mode=name;lastCamera.copy(g.camera.quaternion);}
const button=(label:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:5px;margin:2px';b.onclick=action;controls.append(b);};
button('River view',()=>place(point([35,-13.9,-225])));
button('Cross six stones',()=>run('River crossing',point([35,-13.9,-226]),[point([35,-14,-242]) ]));
button('Pipe front',()=>place([half.p[0],half.p[1]+.04,half.p[2]+half.len/2+5]));
button('Pipe rear',()=>place([half.p[0],half.p[1]+.04,half.p[2]-half.len/2-6],[0,0,1]));
button('Ride pipe',()=>run('Pipe traversal',[half.p[0],half.p[1]+.04,half.p[2]+half.len/2+1],[[half.p[0],half.p[1],half.p[2]-half.len/2-1]]));
button('Runway view',()=>place(point([36.35,-7.16,-378.3])));
button('Runway and rope',()=>run('Runway and rope',point([36.35,-7.16,-378]),[[36.35,-7.2,far-4]]));
button('End foliage',()=>place(point([35,-7.16,-429])));
button('Finish',()=>{const gate=data.components.find((c:any)=>c.t==='gate');run('Finish gate',[gate.p[0],gate.p[1]+.05,gate.p[2]+6],[[gate.p[0],gate.p[1],gate.p[2]-3]]);});
button('Pipe to finish',()=>{const start=[half.p[0],half.p[1]+.05,half.p[2]+half.len/2+1],full=treehouseReviewRoute(data).filter(q=>q.z<start[2]);run('Pipe to finish',start,full.map(q=>q.toArray()));});
button('Bank checkpoint',()=>{const cp=data.components.find((c:any)=>c.nm==='Riverbank checkpoint');place([cp.p[0],cp.p[1]+.05,cp.p[2]]);spinTicks=30;});
button('Pit respawn',()=>{route=[];p.pos.y=l.killY-3;p.prevPos.copy(p.pos);p.grounded=false;p.state='air';mode='Pit respawn';});
button('MAX native',()=>g.renderQualitySettings.setRegularResolution(null));
button('540p normal',()=>g.renderQualitySettings.setRegularResolution(540));
button('Freeze',()=>{route=[];neutral(g.input);frozen=true;mode='Frozen';});
button('Manual',()=>{route=[];frozen=false;neutral(g.input);mode='Manual';});
button('Hide',()=>panel.open=false);
let spinTicks=0;
const launches=data.components.filter((c:any)=>c.nm?.startsWith('Full-width downhill launch')).map((c:any)=>({lip:c.p[2]-c.len/2,land:c.p[2]-c.len/2-4}));
launches.push({lip:near,land:far,rope:true});let charged:any=null;
const native=p.step.bind(p);
p.step=(dt:number,input:any,current:any)=>{
 if(frozen)return;
 if(spinTicks>0){neutral(input);input.spinPressed=spinTicks--%15===0;}
 if(route.length){
  ticks++;let target=route[index];
  const stairs=p.pos.x<0&&(p.pos.y>.3||(target?.y??0)>.3),radius=stairs?.25:.75;
  while(target&&Math.hypot(target.x-p.pos.x,target.z-p.pos.z)<radius)target=route[++index];
  neutral(input);
  if(target){
   const dx=target.x-p.pos.x,dz=target.z-p.pos.z,length=Math.hypot(dx,dz)||1;
   const forward=p.courseInputDirection(l)??p.camDir,scale=1/(Math.hypot(forward.x,forward.z)||1),fx=forward.x*scale,fz=forward.z*scale;
   p.viewInput.reset();const pace=stairs?.65:1;
   input.moveX=(dx*-fz+dz*fx)/length*pace;input.moveY=(dx*fx+dz*fz)/length*pace;
   if(Math.abs(input.moveX)<.035)input.moveX=0;if(Math.abs(input.moveY)<.035)input.moveY=0;
   input.spinPressed=ticks%45===1;
   const jump=launches.find((j:any)=>p.pos.z<j.lip+5&&p.pos.z>j.land-3);
   if(jump){
    if(p.pos.z>jump.lip+1.1){input.jumpHeld=true;input.jumpPressed=charged!==jump;charged=jump;}
    else if(charged===jump){input.jumpReleased=true;charged=null;}
    // Jump off the abutment before requesting the rope. Holding grind on the
    // deck can correctly catch its ordinary edge instead of the raised rope.
    if(jump.rope){input.grindHeld=p.state==='air'||p.state==='grind';input.grindPressed=p.state==='air';}
    if(p.state==='grind'){input.moveX=THREE.MathUtils.clamp(-p.balance*5-p.balanceVel*.7,-1,1);input.moveY=0;}
   }
  }
 }
 const result=native(dt,input,current);
 if(route.length){
  if(p.state==='grind')grindFrames++;
  if(ticks>90&&p.pos.z>near+1&&p.pos.z<near+30){
   maxTurn=Math.max(maxTurn,lastCamera.angleTo(g.camera.quaternion)*180/Math.PI);
   const d=g.camera.getWorldDirection(new THREE.Vector3());runwayYaw=Math.max(runwayYaw,Math.abs(Math.atan2(d.x,-d.z)*180/Math.PI));
  }
  lastCamera.copy(g.camera.quaternion);
  if(p.totalDeaths>baseDeaths||p.state==='dead'||ticks>60*300||!route[index]||p.state==='finished'){
   const pass=p.totalDeaths===baseDeaths&&p.state!=='dead'&&ticks<=60*300;
   results.push({name:mode,pass,seconds:ticks/60,position:p.pos.toArray(),state:p.state,grindFrames,maxTurn,runwayYaw});
   mode=(pass?'PASS: ':'FAIL: ')+mode;route=[];neutral(input);
  }
 }
 return result;
};
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({mode,seconds:ticks/60,position:p.pos.toArray().map((n:number)=>+n.toFixed(2)),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,checkpoints:l.checkpoints.filter((c:any)=>c.active).length,grindFrames,maxTurn,runwayYaw,balance:p.balance,balanceVelocity:p.balanceVel,balanceControl:g.TUNING.balanceControl,stones:data.components.filter((c:any)=>c.nm==='Hero flat naturally rounded river stone fitted to its native support').length,render:g.getRenderQualitySizes(),assetErrors:l.jungleAssetDiagnostics.errors,results},null,1);requestAnimationFrame(report);}report();
