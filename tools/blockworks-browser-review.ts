// Authoring harness: source level, ephemeral play, real fixed-step controller.
import * as THREE from 'three';
import { BLOCKWORKS_SECTIONS as sections } from '../src/levels/codex-lab';
const g:any=await new Promise(resolve=>{const poll=()=>{const v=(window as any).__game;if(v)resolve(v);else requestAnimationFrame(poll);};poll();});
g.campaign.startEphemeral();
const p=g.player,level=()=>g.getLevel();let frozen=false,mode='Manual',ticks=0,held:any=null;
let run:any=null;
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='blockworks-review';
panel.style.cssText='position:fixed;bottom:6px;left:6px;z-index:999999;width:420px;max-height:220px;overflow:auto;background:#101b28ed;padding:9px;color:white;font:11px monospace';
panel.innerHTML='<summary>BLOCKWORKS · authoring review</summary>';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='blockworks-status';panel.append(controls,status);document.body.append(panel);
const add=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;controls.append(b);};
const neutral=()=>{for(const k of Object.keys(g.input))if(/Pressed|Held|Released/.test(k))g.input[k]=false;g.input.moveX=g.input.moveY=0;};
const place=(position:THREE.Vector3,heading=new THREE.Vector3(0,0,-1))=>{run=null;held=null;neutral();g.gameFlow.hide();p.respawn(level(),true,true,{position,heading});frozen=false;};
sections.forEach((s,i)=>add(`${i+1} ${s.name.split(' · ')[1]}`,()=>{const a=s.yaw*Math.PI/180;place(new THREE.Vector3(...s.start).add(new THREE.Vector3(-Math.sin(a)*5,.1,-Math.cos(a)*5)),new THREE.Vector3(-Math.sin(a),0,-Math.cos(a)));mode=s.name;}));
add('Freeze',()=>{frozen=!frozen;held=null;neutral();mode=frozen?'Frozen':'Manual';});
add('Checkpoint +',()=>{held=null;neutral();g.gameFlow.hide();p.warpCheckpoint(level(),1);frozen=false;mode='Checkpoint warp';});
add('Checkpoint -',()=>{held=null;neutral();g.gameFlow.hide();p.warpCheckpoint(level(),-1);frozen=false;mode='Checkpoint warp';});
add('Pit respawn',()=>{frozen=false;held=null;g.gameFlow.hide();p.pos.y=level().killY-3;p.prevPos.copy(p.pos);p.grounded=false;p.state='air';mode='Pit respawn';});
add('Forward 2s',()=>{frozen=false;ticks=0;held={moveY:1};mode='Forward 2 seconds';});
add('Spin',()=>{frozen=false;ticks=110;held={spinPressed:true};mode='Spin checkpoint';});
add('Finish',()=>{const gate=level().captureData().components.find((c:any)=>c.t==='gate');place(new THREE.Vector3(gate.p[0],gate.p[1]+.1,gate.p[2]+4));ticks=0;held={moveY:1};mode='Finish crossing';});
add('Hide',()=>panel.open=false);
add('Play foundry puzzle',()=>{
 const s=sections[1];place(new THREE.Vector3(s.start[0]-6,.1,s.start[2]-22));
 const stages:any[]=[{kind:'hop',x:-4.75,y:2.4,v:27},{kind:'spin'},{kind:'walk',x:-6,y:0,v:41}];
 for(let i=0;i<4;i++)stages.push({kind:'hop',x:-6,y:(i+1)*.96,v:46+i*4.6});
 stages.push({kind:'hop',x:-4.75,y:3.84,v:65},{kind:'spin'},{kind:'walk',x:-4.75,y:3.84,v:66.5});
 for(let i=0;i<6;i++)stages.push({kind:'hop',x:-6+Math.min(i,3)*2,y:4.8,v:71+i*5.4});
 stages.push({kind:'hop',x:0,y:4.8,v:103},{kind:'walk',x:0,y:4.8,v:114},{kind:'spin'});
 run={stages,at:0,t:0,origin:s.start,deaths:p.totalDeaths};mode='Foundry · continuous input play';
});
const step=p.step.bind(p);
p.step=(dt:number,input:any,l:any)=>{
 if(frozen)return;
 if(run){
  const stage=run.stages[run.at];
  for(const k of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed'])input[k]=false;
  input.moveX=input.moveY=0;
  if(!stage){mode='PASS foundry: both keys and all crossing pads';run=null;}
  else{
   const world=stage.x===undefined?null:new THREE.Vector3(run.origin[0]+stage.x,stage.y,run.origin[2]-stage.v);
   const steer=()=>{
    const dx=world!.x-p.pos.x,dz=world!.z-p.pos.z;
    const vx=Math.abs(dx)>.09?Math.sign(dx):0,vz=Math.abs(dz)>.09?Math.sign(dz):0;
    const f=p.camDir.clone().setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x);p.viewInput.reset();
    input.moveX=vx*right.x+vz*right.z;input.moveY=vx*f.x+vz*f.z;
   };
   if(stage.kind==='spin'){input.spinPressed=run.t===0;input.spinHeld=run.t<3;}
   else if(stage.kind==='walk')steer();
   else if(run.t<26){input.jumpHeld=true;input.jumpPressed=run.t===0;}
   else if(run.t===26)input.jumpReleased=true;
   else steer();
   const result=step(dt,input,l);run.t++;
   const near=world&&Math.hypot(p.pos.x-world.x,p.pos.z-world.z)<.5;
   if(p.totalDeaths>run.deaths||p.state==='dead'||run.t>600){mode=`FAIL foundry stage ${run.at}: ${p.state}`;run=null;}
   else if(stage.kind==='spin'&&run.t>=22||stage.kind==='walk'&&near||stage.kind==='hop'&&run.t>27&&p.grounded){
    if(stage.kind==='hop'&&Math.abs(p.pos.y-stage.y)>.12){mode=`FAIL landing ${run.at}: y ${p.pos.y}`;run=null;}
    else {run.at++;run.t=0;mode=`Foundry stage ${run.at}/${run.stages.length}`;}
   }
   return result;
  }
 }
 if(held){for(const k of ['moveX','moveY'])input[k]=held[k]??0;for(const k of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed'])input[k]=held[k]??false;if(++ticks>=120)held=null;}
 return step(dt,input,l);
};
function report(){panel.inert=false;status.textContent=JSON.stringify({mode,state:p.state,pos:p.pos.toArray().map((v:number)=>+v.toFixed(2)),ground:p.grounded,speed:+p.speed.toFixed(2),deaths:p.totalDeaths,checkpoint:level().activeCheckpoint?.spawnPos.toArray(),pending:level().crates.filter((c:any)=>c.pending).length,draw:g.renderer.info.render.calls},null,1);requestAnimationFrame(report);}report();
