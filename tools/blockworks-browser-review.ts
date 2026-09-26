// Local authoring controls. Every automated move is a normalized device input;
// only choosing a starting point places the rider. Camera overviews are local.
import * as THREE from 'three';
import { BLOCKWORKS_SECTIONS as acts, routePoint, routeX } from '../src/levels/codex-lab';
const g:any=await new Promise(resolve=>{const poll=()=>{const v=(window as any).__game;if(v)resolve(v);else requestAnimationFrame(poll);};poll();});
g.campaign.startEphemeral();
const p=g.player,level=()=>g.getLevel();let frozen=false,mode='Manual',drive:any=null,index=0,meanFrame=1/60;
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='blockworks-review';
panel.style.cssText='position:fixed;bottom:6px;left:6px;z-index:999999;width:390px;max-height:220px;overflow:auto;background:#101b28eb;padding:8px;color:white;font:11px monospace';
panel.innerHTML='<summary>BLOCKWORKS · curved-route review</summary>';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='blockworks-status';panel.append(controls,status);document.body.append(panel);
const add=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;controls.append(b);};
const neutral=()=>{for(const k of Object.keys(g.input))if(/Pressed|Held|Released/.test(k))g.input[k]=false;g.input.moveX=g.input.moveY=0;};
const place=(position:number[])=>{drive=null;level().cameraViews.length=0;neutral();g.gameFlow.hide();p.respawn(level(),true,true,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(0,0,-1)});frozen=false;};
acts.forEach((a,i)=>add(a.name,()=>{index=i;const q=routePoint(a.a+3,a.y+.1);place(q);mode=a.name;}));
add('Overview',()=>{const a=acts[index],s=a.a+80;drive=null;neutral();frozen=true;level().cameraViews.length=0;
 level().cameraViews.push({p:p.pos.toArray(),s:[1000,200,1000],yaw:0,feather:1,cameraPosition:[routeX(s)+100,a.y+83,20-s+110],cameraTarget:[routeX(s),a.y,20-s],cameraFov:58});mode='Overview';});
add('Play entry curve',()=>{place(routePoint(2,.15));drive={kind:'entry',frames:0,jumped:false,air:false,startDeaths:p.totalDeaths,maxError:0,minSpeed:Infinity};mode='Entry curve: genuine steering';});
add('Hold Up comparison',()=>{place(routePoint(2,.15));drive={kind:'up',frames:0,startDeaths:p.totalDeaths,maxError:0,minSpeed:Infinity};mode='Hold Up: no automatic steering';});
add('Replay full route',()=>{void(async()=>{drive=null;frozen=false;neutral();level().cameraViews.length=0;g.gameFlow.hide();mode='Loading continuous input replay';const replay=await(await fetch('/tools/fixtures/blockworks-journey.json')).json();g.loadReplay(replay);mode='Continuous spawn-to-gate input replay';})().catch(error=>{mode=String(error);});});
add('Freeze / live',()=>{level().cameraViews.length=0;drive=null;neutral();frozen=!frozen;mode=frozen?'Frozen':'Manual';});
add('Checkpoint +',()=>{drive=null;level().cameraViews.length=0;neutral();g.gameFlow.hide();p.warpCheckpoint(level(),1);frozen=false;mode='Checkpoint';});
add('Checkpoint -',()=>{drive=null;level().cameraViews.length=0;neutral();g.gameFlow.hide();p.warpCheckpoint(level(),-1);frozen=false;mode='Checkpoint';});
add('Pit respawn',()=>{drive=null;frozen=false;g.gameFlow.hide();p.pos.y=level().killY-3;p.prevPos.copy(p.pos);p.grounded=false;p.state='air';mode='Pit respawn';});
add('Finish',()=>{const gate=level().captureData().components.find((c:any)=>c.t==='gate');place([gate.p[0],gate.p[1]+.1,gate.p[2]+4]);drive={kind:'finish',frames:0};mode='Finish crossing';});
add('Map before finale',()=>{drive=null;neutral();frozen=false;level().cameraViews.length=0;g.campaign.startEphemeral();g.campaign.commitClear('island-hopper',{crystal:true});g.campaign.setMapFocus('codex-switchback');g.gameFlow.hide();g.switchLevel('warproom');mode='Island Hopper → Blockworks → Jungle Gate';});
add('Hide',()=>panel.open=false);
const actualStep=p.step.bind(p);
p.step=(dt:number,input:any,l:any)=>{
 if(frozen)return;
 if(!drive)return actualStep(dt,input,l);
 const s=20-p.pos.z;for(const k of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed','grabHeld','grabPressed'])input[k]=false;
 input.moveX=0;input.moveY=1;
 if(drive.kind!=='finish'){
  if(drive.kind==='entry'){
   const ahead=s+10,offset=ahead>112&&ahead<145?2.2*Math.sin(Math.PI*(ahead-112)/33):0;
   const target=routePoint(ahead,0,offset),dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,n=Math.max(.001,Math.hypot(dx,dz));
   input.moveX=Math.round(dx/n*100)/100;input.moveY=Math.round(-dz/n*100)/100;
  }
  input.jumpHeld=!drive.jumped;input.jumpPressed=drive.frames===0;
  if(drive.kind==='entry'&&!drive.jumped&&s>=164.3){input.jumpHeld=false;input.jumpReleased=true;drive.jumped=true;}
  if(drive.jumped&&p.grounded&&s>177){input.jumpHeld=true;input.jumpPressed=!drive.recharged;drive.recharged=true;}
  drive.maxError=Math.max(drive.maxError,Math.abs(p.pos.x-routeX(s)));
  if(s>70)drive.minSpeed=Math.min(drive.minSpeed,p.speed);
 }
 const result=actualStep(dt,input,l);drive.frames++;
 if(['dead','gameover'].includes(p.state)||p.isBailing){mode=`${drive.kind==='up'?'Expected departure':'FAIL'} at s=${s.toFixed(1)} · error ${drive.maxError?.toFixed(2)}m`;drive=null;}
 else if(drive.kind==='entry'&&s>=228){mode=`PASS curved entry and gap · max error ${drive.maxError.toFixed(2)}m`;drive=null;frozen=true;}
 else if(drive.kind==='finish'&&drive.frames>120)drive=null;
 return result;
};
function report(){meanFrame=.95*meanFrame+.05*(g.frameStats?.rawDt??1/60);panel.inert=false;status.textContent=JSON.stringify({mode,s:+(20-p.pos.z).toFixed(2),state:p.state,pos:p.pos.toArray().map((v:number)=>+v.toFixed(2)),ground:p.grounded,speed:+p.speed.toFixed(2),heading:p.axisF.toArray().map((v:number)=>+v.toFixed(3)),cameraFov:+g.camera.fov.toFixed(2),checkpoints:level().checkpoints.length,activeCheckpoint:level().activeCheckpoint?.spawnPos?.toArray(),deaths:p.totalDeaths,pending:level().crates.filter((c:any)=>c.pending).length,mover:p.groundHit?.moverId??null,frameMs:+(meanFrame*1000).toFixed(1)},null,1);requestAnimationFrame(report);}report();
