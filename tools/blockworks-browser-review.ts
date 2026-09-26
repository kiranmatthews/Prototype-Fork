// Authoring harness: source level, ephemeral play, real fixed-step controller.
import * as THREE from 'three';
import { BLOCKWORKS_SECTIONS as sections } from '../src/levels/codex-lab';
const g:any=await new Promise(resolve=>{const poll=()=>{const v=(window as any).__game;if(v)resolve(v);else requestAnimationFrame(poll);};poll();});
g.campaign.startEphemeral();
const p=g.player,level=()=>g.getLevel();let frozen=false,mode='Manual',ticks=0,held:any=null;
let run:any=null,currentSection=0;const history:any[]=[];
const clearReviewCamera=()=>{level().cameraViews.length=0;};
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='blockworks-review';
panel.style.cssText='position:fixed;bottom:6px;left:6px;z-index:999999;width:420px;max-height:220px;overflow:auto;background:#101b28ed;padding:9px;color:white;font:11px monospace';
panel.innerHTML='<summary>BLOCKWORKS · authoring review</summary>';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='blockworks-status';panel.append(controls,status);document.body.append(panel);
const add=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;controls.append(b);};
const neutral=()=>{for(const k of Object.keys(g.input))if(/Pressed|Held|Released/.test(k))g.input[k]=false;g.input.moveX=g.input.moveY=0;};
const place=(position:THREE.Vector3,heading=new THREE.Vector3(0,0,-1))=>{clearReviewCamera();history.length=0;run=null;held=null;neutral();g.gameFlow.hide();p.respawn(level(),true,true,{position,heading});frozen=false;};
sections.forEach((s,i)=>add(`${i+1} ${s.name.split(' · ')[1]}`,()=>{currentSection=i;const a=s.yaw*Math.PI/180;place(new THREE.Vector3(...s.start).add(new THREE.Vector3(-Math.sin(a)*5,.1,-Math.cos(a)*5)),new THREE.Vector3(-Math.sin(a),0,-Math.cos(a)));mode=s.name;}));
add('Architecture overview',()=>{
 const s=sections[currentSection],a=s.yaw*Math.PI/180;
 const local=(u:number,y:number,v:number)=>[s.start[0]+Math.cos(a)*u-Math.sin(a)*v,y,s.start[2]-Math.sin(a)*u-Math.cos(a)*v];
 held=null;run=null;neutral();frozen=true;clearReviewCamera();
 level().cameraViews.push({p:p.pos.toArray(),s:[1000,200,1000],yaw:s.yaw,feather:1,
  cameraPosition:local(-44,36,16),cameraTarget:local(0,3,64),cameraFov:58});mode='Architecture overview';
});
add('Freeze',()=>{clearReviewCamera();frozen=!frozen;held=null;neutral();mode=frozen?'Frozen':'Manual';});
add('Checkpoint +',()=>{held=null;neutral();g.gameFlow.hide();p.warpCheckpoint(level(),1);frozen=false;mode='Checkpoint warp';});
add('Checkpoint -',()=>{held=null;neutral();g.gameFlow.hide();p.warpCheckpoint(level(),-1);frozen=false;mode='Checkpoint warp';});
add('Pit respawn',()=>{frozen=false;held=null;g.gameFlow.hide();p.pos.y=level().killY-3;p.prevPos.copy(p.pos);p.grounded=false;p.state='air';mode='Pit respawn';});
add('Forward 2s',()=>{frozen=false;ticks=0;held={moveY:1};mode='Forward 2 seconds';});
add('Spin',()=>{frozen=false;ticks=110;held={spinPressed:true};mode='Spin checkpoint';});
add('Finish',()=>{const gate=level().captureData().components.find((c:any)=>c.t==='gate');place(new THREE.Vector3(gate.p[0],gate.p[1]+.1,gate.p[2]+4));ticks=0;held={moveY:1};mode='Finish crossing';});
add('Map before finale',()=>{
 clearReviewCamera();run=held=null;neutral();frozen=false;g.campaign.startEphemeral();
 g.campaign.commitClear('island-hopper',{crystal:true});g.campaign.setMapFocus('codex-switchback');
 g.gameFlow.hide();g.switchLevel('warproom');mode='Map: Island Hopper → Blockworks → Jungle Gate';
});
add('Hide',()=>panel.open=false);
add('Play foundry puzzle',()=>{
 const s=sections[1];place(new THREE.Vector3(s.start[0]-6,.1,s.start[2]-22));
 const stages:any[]=[{kind:'hop',x:-4.75,y:2.4,v:27,radius:2.2},{kind:'walkSlow',x:-4.75,y:2.4,v:27},{kind:'spin'},{kind:'walkSlow',x:-6,y:0,v:41}];
 for(let i=0;i<4;i++)stages.push({kind:'hop',x:-6,y:(i+1)*.96,v:46+i*4.6});
 stages.push({kind:'hop',x:-4.75,y:3.84,v:65},{kind:'spin'},{kind:'walkSlow',x:-4.75,y:3.84,v:66.5});
 for(let i=0;i<6;i++){
  if(i>0)stages.push({kind:'walkSlow',x:-6+Math.min(i-1,3)*2,y:4.8,v:71+(i-1)*5.4+.6});
  stages.push({kind:'hop',x:-6+Math.min(i,3)*2,y:4.8,v:71+i*5.4});
 }
 stages.push({kind:'walkSlow',x:0,y:4.8,v:98.6},{kind:'hop',x:0,y:4.8,v:103},{kind:'walk',x:0,y:4.8,v:114},{kind:'spin'});
 run={stages,at:0,t:0,origin:s.start,yaw:s.yaw,deaths:p.totalDeaths,success:'PASS foundry: both keys and all crossing pads'};mode='Foundry · continuous input play';
});
const motionRun=(index:number,startV:number,startY:number,stages:any[],success:string)=>{
 const s=sections[index],a=s.yaw*Math.PI/180;currentSection=index;
 place(new THREE.Vector3(s.start[0]-Math.sin(a)*startV,startY+.1,s.start[2]-Math.cos(a)*startV),new THREE.Vector3(-Math.sin(a),0,-Math.cos(a)));
 run={stages,at:0,t:0,origin:s.start,yaw:s.yaw,deaths:p.totalDeaths,success};mode='Moving-platform play';
};
const moverTop=(m:any)=>m.mesh.position.y+m.mesh.geometry.parameters.height/2;
add('Play paired lifts',()=>{
 const [a,b]=level().movers;
 motionRun(8,33.3,0,[{kind:'wait',until:()=>moverTop(a)<.18},
  {kind:'hop',x:0,v:38.5,mover:0},{kind:'walkSlow',x:0,v:42.6},
  {kind:'wait',until:()=>moverTop(a)>4.7&&moverTop(b)<4.9},
  {kind:'hop',x:0,v:47.5,mover:1},{kind:'walkSlow',x:0,v:51.4},
  {kind:'wait',until:()=>moverTop(b)>9.5},{kind:'hop',x:0,y:9.6,v:55.8,mover:null}],
  'PASS paired lifts: board, ride, transfer and roof landing');
});
add('Play freight shuttle',()=>{
 const ferry=level().movers[2],s=sections[11];
 const v=()=>s.start[0]-ferry.mesh.position.x;
 motionRun(11,149.4,7.2,[{kind:'wait',until:()=>v()<155.08},
  {kind:'hop',x:0,v:155,mover:2},{kind:'walkSlow',x:0,v:()=>v()+3.2},
  {kind:'wait',until:()=>v()>172.8},{kind:'hop',x:0,y:7.2,v:178.8,mover:null}],
  'PASS freight shuttle: board, ride and far-dock landing');
});
const step=p.step.bind(p);
p.step=(dt:number,input:any,l:any)=>{
 if(frozen)return;
 if(run){
  const stage=run.stages[run.at];
  for(const k of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed'])input[k]=false;
  input.moveX=input.moveY=0;
  if(!stage){mode=run.success;run=null;}
  else{
   const v=typeof stage.v==='function'?stage.v():stage.v,angle=run.yaw*Math.PI/180;
   const world=stage.x===undefined?null:new THREE.Vector3(run.origin[0]+Math.cos(angle)*stage.x-Math.sin(angle)*v,stage.y??p.pos.y,run.origin[2]-Math.sin(angle)*stage.x-Math.cos(angle)*v);
   const steer=(pace=1)=>{
    const dx=world!.x-p.pos.x,dz=world!.z-p.pos.z;
    const vx=Math.abs(dx)>.09?Math.sign(dx)*pace:0,vz=Math.abs(dz)>.09?Math.sign(dz)*pace:0;
    const f=p.camDir.clone().setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x);p.viewInput.reset();
    const ix=vx*right.x+vz*right.z,iy=vx*f.x+vz*f.z,scale=Math.max(1,Math.hypot(ix,iy));
    input.moveX=Math.round(ix/scale*100)/100;input.moveY=Math.round(iy/scale*100)/100;
   };
   if(stage.kind==='spin'){input.spinPressed=run.t===0;input.spinHeld=run.t<3;}
   else if(stage.kind==='walk')steer();
   else if(stage.kind==='walkSlow'){if(!stage.settle)steer(.2);}
   else if(stage.kind==='wait'){}
   else if(run.t<26){input.jumpHeld=true;input.jumpPressed=run.t===0;}
   else if(run.t===26)input.jumpReleased=true;
   else steer();
   const result=step(dt,input,l);run.t++;
   const distance=world?Math.hypot(p.pos.x-world.x,p.pos.z-world.z):Infinity,near=distance<.5;
   if(stage.kind==='walkSlow'&&distance<.12)stage.settle=(stage.settle??0)+1;
   if(p.totalDeaths>run.deaths||p.state==='dead'||run.t>1200){history.push({stage:run.at,failed:p.pos.toArray(),state:p.state});mode=`FAIL play stage ${run.at}: ${p.state}`;run=null;}
   else if(stage.kind==='spin'&&run.t>=22||stage.kind==='walk'&&near||stage.kind==='walkSlow'&&stage.settle>=30||stage.kind==='wait'&&stage.until()||stage.kind==='hop'&&run.t>27&&p.grounded){
    if(stage.kind==='hop'&&(stage.y!==undefined&&Math.abs(p.pos.y-stage.y)>.12||stage.mover===undefined&&world&&(Math.abs(p.pos.x-world.x)>(stage.radius??1.4)||Math.abs(p.pos.z-world.z)>(stage.radius??1.4))||stage.mover!==undefined&&(p.groundHit?.moverId??null)!==stage.mover)){mode=`FAIL landing ${run.at}: y ${p.pos.y}`;run=null;}
    else {history.push({stage:run.at,kind:stage.kind,pos:p.pos.toArray().map((v:number)=>+v.toFixed(2))});run.at++;run.t=0;mode=`Play stage ${run.at}/${run.stages.length}`;}
   }
   return result;
  }
 }
 if(held){for(const k of ['moveX','moveY'])input[k]=held[k]??0;for(const k of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed'])input[k]=held[k]??false;if(++ticks>=120)held=null;}
 return step(dt,input,l);
};
let meanFrame=1/60;
function report(){meanFrame=meanFrame*.95+(g.frameStats?.rawDt??1/60)*.05;panel.inert=false;status.textContent=JSON.stringify({mode,history:history.slice(-3),state:p.state,pos:p.pos.toArray().map((v:number)=>+v.toFixed(2)),ground:p.grounded,speed:+p.speed.toFixed(2),deaths:p.totalDeaths,checkpoint:level().activeCheckpoint?.spawnPos.toArray(),pending:level().crates.filter((c:any)=>c.pending).length,keys:level().crates.filter((c:any)=>c.bang).map((c:any)=>!!c.bangUsed),mover:p.groundHit?.moverId??null,cameraFov:+g.camera.fov.toFixed(2),frameMs:+(meanFrame*1000).toFixed(1),draw:g.renderer.info.render.calls},null,1);requestAnimationFrame(report);}report();
