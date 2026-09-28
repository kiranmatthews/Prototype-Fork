// Input-only gap smoke checks after one explicit fixture placement.
import * as THREE from 'three';
import {BLOCKWORKS_GAPS, BLOCKWORKS_ROADS, routePoint} from '../src/levels/codex-lab';
const g:any=await new Promise(resolve=>{const poll=()=>{const v=(window as any).__game;if(v)resolve(v);else requestAnimationFrame(poll);};poll();});
g.campaign.startEphemeral();g.gameFlow.hide();
const p=g.player,starts=new Map([[166,135],[724,610],[1687,1590],[1754,1729],[2018,1945]]);
let run:any=null,frozen=false,result='Ready',maxError=0;
const panel=document.createElement('div');panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:999999;background:#152332ed;color:white;padding:10px;font:12px monospace';
const buttons=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='camera-alignment-status';panel.append(buttons,status);document.body.append(panel);
for(const gap of BLOCKWORKS_GAPS.filter(q=>q.kind==='charged gap')){
 const b=document.createElement('button');b.textContent=`Gap ${gap.a}`;buttons.append(b);
 b.onclick=()=>{const s=starts.get(gap.a)!,r=BLOCKWORKS_ROADS.find(q=>s>=q.a&&s<=q.b)!,y=typeof r.top==='function'?r.top(s):r.top;
  const pos=routePoint(s,y+.08),heading=g.getLevel().cameraDirAt(...pos),a=routePoint(gap.a,0),z=routePoint(gap.b,0);
  g.gameFlow.hide();p.respawn(g.getLevel(),true,false,{position:new THREE.Vector3(...pos),heading:new THREE.Vector3(heading.x,0,heading.z)});
  run={gap,released:false,air:false,frames:0,direction:new THREE.Vector3(z[0]-a[0],0,z[2]-a[2]).normalize()};frozen=false;result='Running with Up only';maxError=0;
 };
}
const step=p.step.bind(p);p.step=(dt:number,input:any,l:any)=>{
 if(frozen)return;if(!run)return step(dt,input,l);
 for(const k of Object.keys(input))if(/Held|Pressed|Released/.test(k))input[k]=false;
 const s=20-p.pos.z,release=!run.released&&s>=run.gap.a-1.7;
 input.moveX=0;input.moveY=1;
 if(s<run.gap.a-20){const q=routePoint(s+10,0),dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz),f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z);input.moveX=(dx*-f.z+dz*f.x)/n;input.moveY=(dx*f.x+dz*f.z)/n;}
 input.jumpHeld=!run.released&&!release;input.jumpPressed=run.frames===0;input.jumpReleased=release;
 if(release)run.released=true;step(dt,input,l);run.frames++;
 if(run.released&&!p.grounded)run.air=true;
 if(p.isBailing||p.totalDeaths){result='FAIL';run=null;frozen=true;}
 else if(run.air&&p.grounded){result=20-p.pos.z>=run.gap.b?'PASS — landed using Up, zero sideways input':'FAIL — short landing';run=null;frozen=true;}
};
const direction=new THREE.Vector3();
function report(){panel.inert=false;if(run&&20-p.pos.z>=run.gap.a-2&&20-p.pos.z<=run.gap.b){g.camera.getWorldDirection(direction);direction.y=0;direction.normalize();maxError=Math.max(maxError,THREE.MathUtils.radToDeg(direction.angleTo(run.direction)));}
 status.textContent=JSON.stringify({result,station:+(20-p.pos.z).toFixed(2),state:p.state,grounded:p.grounded,speed:+p.speed.toFixed(2),gapSidewaysInput:run&&20-p.pos.z>=run.gap.a-20?0:null,maxGapCameraError:+maxError.toFixed(3),deaths:p.totalDeaths},null,1);requestAnimationFrame(report);}report();
