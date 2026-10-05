// Local authoring review: steer the real Player through one continuous visit.
// No geometry changes, physics tuning, travel warps or save writes.
import * as THREE from 'three';
import {treehouseReviewRoute} from './treehouse-trail-review-route';
const g=(window as any).__game,player=g.player,level=g.getLevel();
g.campaign.startEphemeral();
const data=level.captureData(),route=treehouseReviewRoute(data),jumps:any[]=[];
for(const c of data.components.filter((c:any)=>c.nm?.startsWith('Full-width downhill launch')))
  jumps.push({lip:c.p[2]-c.len/2,land:c.p[2]-c.len/2-4,x:c.p[0],label:c.nm});
const rope=level.ropes[0]?.rail;
if(rope){
 const a=rope.pointAt(.1),b=rope.pointAt(rope.totalLength-.1),near=a.z>b.z?a:b,far=a.z>b.z?b:a;
 jumps.push({lip:near.z,land:far.z,x:near.x,label:'Broken bridge rope',rope:true});
}
const report:any={mode:'running',ticks:0,waypoint:0,waypoints:route.length,deaths:player.totalDeaths,
  samples:[],jumps:[],position:player.pos.toArray(),cameraViews:level.cameraViews.length};
let waypoint=1,charged:any=null,finished=false;
const native=player.step.bind(player),right=new THREE.Vector3(),lastCamera=g.camera.quaternion.clone();
let largestTurn=0;
player.step=(dt:number,input:any,current:any)=>{
 if(finished)return native(dt,input,current);
 report.ticks++;
 let target=route[waypoint];
 const stairs=player.pos.x<0&&(player.pos.y>.3||(target?.y??0)>.3),radius=stairs?.25:1.05;
 while(target&&Math.hypot(target.x-player.pos.x,target.z-player.pos.z)<radius)target=route[++waypoint];
 input.moveX=input.moveY=0;
 input.jumpHeld=input.jumpPressed=input.jumpReleased=input.grindHeld=input.grindPressed=input.spinHeld=input.spinPressed=false;
 if(target&&player.state!=='finished'&&player.state!=='dead'){
  const dx=target.x-player.pos.x,dz=target.z-player.pos.z,length=Math.hypot(dx,dz)||1;
  const forward=player.camDir.clone().setY(0).normalize();right.set(-forward.z,0,forward.x);
  player.viewInput.reset();
  const pace=stairs?.65:1;
  input.moveX=(dx*right.x+dz*right.z)/length*pace;
  input.moveY=(dx*forward.x+dz*forward.z)/length*pace;
  // Mirror the real controller dead zone; floating-point path corrections
  // must not turn a straight jump into a digital diagonal at reduced speed.
  if(Math.abs(input.moveX)<.035)input.moveX=0;
  if(Math.abs(input.moveY)<.035)input.moveY=0;
  const approach=jumps.find(j=>player.pos.z<j.lip+5&&player.pos.z>j.land-3);
  if(approach){
   if(player.pos.z>approach.lip+1.1){
    input.jumpHeld=true;input.jumpPressed=charged!==approach;charged=approach;
   }else if(charged===approach){
    input.jumpReleased=true;charged=null;
    report.jumps.push({label:approach.label,position:player.pos.toArray(),tick:report.ticks});
   }
   if(approach.rope){input.grindHeld=true;input.grindPressed=player.state!=='grind';}
  }
 }
 const value=native(dt,input,current);
 const angle=lastCamera.angleTo(g.camera.quaternion);largestTurn=Math.max(largestTurn,angle);lastCamera.copy(g.camera.quaternion);
 report.position=player.pos.toArray();report.state=player.state;report.grounded=player.grounded;
 report.waypoint=waypoint;report.seconds=report.ticks/60;report.largestFrameTurnDegrees=largestTurn*180/Math.PI;
 if(report.ticks%30===0)report.samples.push({tick:report.ticks,position:player.pos.toArray(),state:player.state,
   camera:g.camera.position.toArray(),fov:g.camera.fov,assets:level.jungleAssetDiagnostics,render:g.getRenderFrameStats()});
 if(player.totalDeaths>report.deaths||player.state==='dead'||player.state==='gameover'){
  report.mode='failed';report.reason='native death';finished=true;
 }else if(player.state==='finished'){
  report.mode='finished';finished=true;
 }else if(report.ticks>60*240){report.mode='failed';report.reason='timeout';finished=true;}
 if(finished){input.moveX=input.moveY=0;input.jumpHeld=input.grindHeld=false;player.step=native;}
 return value;
};
(window as any).__treehouseContinuous=report;
