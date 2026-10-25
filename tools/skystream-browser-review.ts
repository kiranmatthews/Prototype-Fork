import * as THREE from 'three';
import * as source from '../src/levels/skystream';
import { createSkystreamPilot } from './skystream-pilot.mjs';
import { CONST } from '../src/tuning';

const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game&&!game.gameFlow.blocksGameplay)resolve(game);else requestAnimationFrame(poll);};poll();});
const panel=document.createElement('details');panel.open=true;panel.id='skystream-review-controls';
panel.style.cssText='position:fixed;left:8px;top:8px;z-index:999999;max-width:330px;padding:8px;background:#122d40ed;color:#fff;font:12px monospace';
const title=document.createElement('summary');title.textContent='Skystream review';panel.append(title);
const controls=document.createElement('div'),status=document.createElement('pre');status.id='skystream-review-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
const add=(name:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:3px;padding:6px';b.onclick=action;controls.append(b);};
let pilot:any=null,frame=0,finished=false,failed:string|null=null,reviewMode:'route'|'fall'='route';
const p=g.player,realStep=p.step.bind(p),realCommit=p.commitRenderStep.bind(p);
p.step=(dt:any,input:any,level:any)=>{
 if(!pilot||finished||failed){realStep(dt,input,level);return;}
 const request=pilot.sample(p,level),previous=p.rawInput;
 // Match Input.poll and the native runner's recorded stick precision.
 const scale=Math.max(1,Math.hypot(request.moveX??0,request.moveY??0));
 const sample={...input,moveX:Math.round((request.moveX??0)/scale*100)/100,moveY:Math.round((request.moveY??0)/scale*100)/100,jumpHeld:request.jumpHeld??false,
  grabHeld:request.grabHeld??false,spinHeld:request.spinHeld??false,grindHeld:false,transferHeld:false,
  jumpPressed:!!request.jumpHeld&&!previous?.jumpHeld,jumpReleased:!request.jumpHeld&&!!previous?.jumpHeld,
  grabPressed:!!request.grabHeld&&!previous?.grabHeld,spinPressed:!!request.spinHeld&&!previous?.spinHeld,
  grindPressed:false,transferPressed:false,restartPressed:false};
 realStep(dt,sample,level);
};
p.commitRenderStep=(...args:any[])=>{realCommit(...args);if(!pilot||finished||failed)return;
 frame++;pilot.observe(p,g.getLevel());
 if(reviewMode==='fall'){
  const evidence=pilot.evidence;
  if(evidence.departure===null&&!p.grounded&&p.state==='air')evidence.departure=frame;
  if(evidence.death===null&&p.state==='dead'){evidence.death=frame;evidence.deathY=p.pos.y;}
  if(evidence.death!==null&&p.state!=='dead'&&!p.isBailing&&p.grounded){
   evidence.fallSeconds=(evidence.death-evidence.departure)*CONST.fixedStep;
   evidence.returnSeconds=(frame-evidence.departure)*CONST.fixedStep;
   finished=true;if(evidence.returnSeconds>5)failed='Fall recovery exceeded five seconds';
  }
  if(frame>900)failed='Fall recovery timed out';
  return;
 }
 finished=p.state==='finished';
 if(finished&&p.cratesBroken!==g.getLevel().totalCrates-g.getLevel().bonusCrateTotal)
  failed='The route left main-course crates behind';
 if(p.isBailing||['dead','gameover'].includes(p.state))failed='Route failed at '+JSON.stringify(p.pos.toArray());
};
add('Run full route',()=>{g.gameFlow.hide();g.switchLevel('skystream');p.respawn(g.getLevel(),true);reviewMode='route';pilot=createSkystreamPilot(source);frame=0;finished=false;failed=null;});
add('Test fall recovery',()=>{
 g.gameFlow.hide();g.switchLevel('skystream');p.respawn(g.getLevel(),true);reviewMode='fall';frame=0;finished=false;failed=null;
 pilot={evidence:{departure:null,death:null},observe:()=>{},sample:()=>{
  if(pilot.evidence.death!==null)return {};
  const direction=p.courseInputDirection(g.getLevel())??p.camDir,length=Math.hypot(direction.x,direction.z)||1;
  return {moveX:-direction.z/length,moveY:direction.x/length,jumpHeld:true};
 }};
});
add('Stop pilot',()=>{pilot=null;});
for(const [i,cp]of source.SKYSTREAM_CHECKPOINTS.entries())add(`Sanctuary ${i+1}`,()=>{pilot=null;g.gameFlow.hide();p.respawn(g.getLevel(),true,false,{position:new THREE.Vector3(...cp).add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(0,0,-1)});});
const reviewLane=source.SKYSTREAM_LEVEL.components.filter(c=>c.t==='camnode').map(c=>new THREE.Vector3(...c.p));
for(const line of [source.SKYSTREAM_CRATE_LINES[0],source.SKYSTREAM_CRATE_LINES[9],source.SKYSTREAM_CRATE_LINES[19]])
 add(`View ${line.name}`,()=>{
  pilot=null;finished=false;failed=null;frame=0;g.gameFlow.hide();const first=new THREE.Vector3(...line.positions[0]);
  let nearest=0;reviewLane.forEach((q,i)=>{if(q.distanceTo(first)<reviewLane[nearest].distanceTo(first))nearest=i;});
  const start=reviewLane[Math.max(0,nearest-2)].clone();
  p.respawn(g.getLevel(),true,false,{position:start.add(new THREE.Vector3(0,.1,0)),heading:first.sub(start).setY(0).normalize()});
 });
add('Hide controls',()=>{panel.open=false;});
const download=document.createElement('a');download.textContent='Download preview';download.download='skystream-preview.jpg';download.style.cssText='display:block;color:white;padding:6px';panel.append(download);
add('Make loop preview',async()=>{
 const l=g.getLevel();await l.prepareSurfaceImages();
 const renderer=g.renderer,previous=renderer.getRenderTarget();
 const target=new THREE.WebGLRenderTarget(640,360);target.texture.colorSpace=THREE.SRGBColorSpace;
 const camera=new THREE.PerspectiveCamera(67,640/360,.1,4000);
 camera.position.set(0,-276,-1820);camera.lookAt(104,-296,-1760);
 renderer.setRenderTarget(target);renderer.render(g.scene,camera);
 const pixels=new Uint8Array(640*360*4);renderer.readRenderTargetPixels(target,0,0,640,360,pixels);renderer.setRenderTarget(previous);target.dispose();
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d')!,im=ctx.createImageData(640,360);
 for(let y=0;y<360;y++)im.data.set(pixels.subarray((359-y)*640*4,(360-y)*640*4),y*640*4);ctx.putImageData(im,0,0);
 download.href=canvas.toDataURL('image/jpeg',.9);
 let image=document.getElementById('skystream-preview') as HTMLImageElement|null;
 if(!image){image=document.createElement('img');image.id='skystream-preview';image.style.cssText='position:fixed;right:10px;top:10px;width:640px;z-index:999999';document.body.append(image);}image.src=download.href;
});
function report(){panel.style.setProperty('display','block','important');panel.style.setProperty('visibility','visible','important');panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({reviewMode,frame,finished,failed,index:pilot?.index,
 position:p.pos.toArray().map((n:number)=>Math.round(n*100)/100),speed:Math.round(p.speed*10)/10,grounded:p.grounded,
 mainCourseCrates:`${p.cratesBroken}/${g.getLevel().totalCrates-g.getLevel().bonusCrateTotal}`,
 remainingCrates:finished?g.getLevel().crates.filter((c:any)=>c.alive).map((c:any)=>c.mesh.position.toArray()):undefined,
 loop:p.loopStatus,evidence:pilot?.evidence},null,2);requestAnimationFrame(report);}
report();
