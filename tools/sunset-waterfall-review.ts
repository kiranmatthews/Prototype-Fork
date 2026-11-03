// Local development review: visible controls and input-only traversal pilot.
import * as THREE from 'three';
import {custardPoint as point,custardTangent} from '../src/levels/custard-creek';
import {SUNSET_WATERFALL_ROUTE as route} from '../src/levels/sunset-waterfalls';
const g:any=await new Promise(resolve=>{const ready=()=>{const value=(window as any).__game;value?resolve(value):requestAnimationFrame(ready);};ready();});
g.campaign.startEphemeral();const p=g.player,l=g.getLevel();await l.prepareJungleAssets();
const panel=document.createElement('details');panel.open=true;panel.style.cssText='position:fixed;left:6px;top:6px;z-index:999999;background:#23180deb;color:white;padding:8px;max-width:300px;font:11px monospace';
panel.innerHTML='<summary>Sunset waterfall review</summary>';const buttons=document.createElement('div'),status=document.createElement('pre');status.id='waterfall-status';status.style.whiteSpace='pre-wrap';panel.append(buttons,status);document.body.append(panel);
let running=false,frozen=false,target=0,ticks=0,jumps=0,charge=0,baseDeaths=0,lastLaunch=0,mode='Ready',held=false;
const results:any[]=[];
const clear=(input:any)=>{input.moveX=input.moveY=0;for(const key of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed'])input[key]=false;};
function place(s:number,y:number,u=0,hard=true){running=frozen=false;clear(g.input);g.gameFlow.hide();const q=point(s,y,u);p.respawn(l,hard,true,{position:new THREE.Vector3(...q),heading:new THREE.Vector3(...custardTangent(2430))});mode='Manual';}
function start(){place(2400,-5.95);p.speed=0;p.freeSkate=false;p.walkVelocity.set(0,0,0);running=true;target=ticks=jumps=charge=0;baseDeaths=p.totalDeaths;lastLaunch=p.trampolineLaunchId;held=false;mode='Run all twelve springs';}
const button=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:5px;margin:2px';b.onclick=fn;buttons.append(b);};
button('Old finish approach',()=>place(2400,-5.95));
button('First net',()=>place(2452,-9.95));
button('Run all twelve',start);
button('Upper waterfall',()=>place(2540,-41.95));
button('Middle terrace',()=>place(2628,-83.95));
button('Lower waterfall',()=>place(2892,-189.95));
button('Final terrace',()=>place(3024,-253.95));
button('Checkpoint spin',()=>{place(2628,-83.95);spinTicks=35;});
button('Miss the net',()=>{place(2980,-235,15,false);p.state='air';p.grounded=false;p.vVel=-2;mode='Water reset';});
button('Finish gate',()=>{place(3046,-253.95);finishTicks=150;});
button('MAX native',()=>g.renderQualitySettings.setRegularResolution(null));
button('720p normal',()=>g.renderQualitySettings.setRegularResolution(720));
button('Freeze',()=>{running=false;frozen=true;clear(g.input);mode='Frozen';});
button('Manual',()=>{running=frozen=false;clear(g.input);mode='Manual';});
button('Hide',()=>panel.open=false);
let spinTicks=0,finishTicks=0;
const native=p.step.bind(p),gate=l.captureData().components.find((c:any)=>c.t==='gate');
const steer=(input:any,q:number[],pace=1)=>{
 const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,d=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir,scale=1/(Math.hypot(f.x,f.z)||1),fx=f.x*scale,fz=f.z*scale;
 p.viewInput.reset();input.moveX=(dx*-fz+dz*fx)/d*pace;input.moveY=(dx*fx+dz*fz)/d*pace;
 if(Math.abs(input.moveX)<.1)input.moveX=0;if(Math.abs(input.moveY)<.015)input.moveY=0;
};
p.step=(dt:number,input:any,current:any)=>{
 if(frozen)return;
 if(spinTicks){clear(input);input.spinPressed=spinTicks--%15===0;}
 if(finishTicks){clear(input);steer(input,gate.p);finishTicks--;}
 if(running){
  ticks++;clear(input);
  if(p.trampolineLaunchId!==lastLaunch){lastLaunch=p.trampolineLaunchId;jumps++;if(route[target]?.kind==='spring')target++;}
  const dest=route[target];
  if(dest){
   const q=point(dest.s,dest.y),distance=Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);steer(input,q,Math.min(1,distance/2));input.jumpHeld=!p.grounded;
   if(dest.kind==='rest'&&p.grounded&&distance<3){target++;charge=0;input.spinPressed=true;}
   if(dest.kind==='spring'&&p.grounded&&distance<2){input.moveX=input.moveY=0;charge++;input.jumpHeld=charge<22;input.jumpPressed=charge===1;input.jumpReleased=charge===22;if(charge>23)charge=0;}
   if(dest.kind==='finish'&&p.grounded&&distance<3){running=false;finishTicks=240;mode='Final shelf to gate';}
  }
  if(p.isBailing){clear(input);charge=0;}
  if(!input.jumpHeld&&held&&!input.jumpReleased)input.jumpReleased=true;held=input.jumpHeld;
 }
 const value=native(dt,input,current);
 if(running){
  if(p.totalDeaths>baseDeaths||p.state==='dead'||ticks>10000){results.push({pass:false,target,jumps,seconds:ticks/60,position:p.pos.toArray()});mode='FAIL';running=false;clear(input);}
 }
 if(mode==='Final shelf to gate'&&p.state==='finished'){results.push({pass:true,jumps,seconds:ticks/60,position:p.pos.toArray()});mode='PASS';finishTicks=0;}
 return value;
};
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({mode,resolution:g.renderQualitySettings.regularResolution,target,seconds:ticks/60,jumps,position:p.pos.toArray().map((n:number)=>+n.toFixed(2)),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,checkpoints:l.checkpoints.filter((c:any)=>c.active).length,launch:g.getLaunchCameraDiagnostics(),art:l.tribalTrampolineDiagnostics,assets:l.jungleAssetDiagnostics.errors,results},null,1);requestAnimationFrame(report);}report();
