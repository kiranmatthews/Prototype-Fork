import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-maze';await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const route=r.sourceModule.SPAGHETTI_PLATFORMER_BOX_ROUTE,legs=r.sourceModule.SPAGHETTI_PLATFORMER_ROUTE_LEGS,C=r.source.components;
 const report={counts:{stops:route.length,legs:legs.length,crates:C.filter(c=>c.t==='crate').length,fruit:C.filter(c=>c.t==='wumpa').length},springs:[],rails:[],jumps:[]};
 for(const leg of legs.filter(e=>e.kind==='spring')){
  const pad=C.find(c=>c.nm===leg.spring),target=leg.to.p;
  r.p.respawn(r.l,true,false,{position:new THREE.Vector3(pad.p[0],pad.p[1]+2,pad.p[2]),heading:new THREE.Vector3(target[0]-pad.p[0],0,target[2]-pad.p[2]).normalize()});
  r.p.state='air';r.p.grounded=false;r.p.vVel=-2;
  const initialOffset=r.p.verticalLoopOffset;let launched=false,peak=pad.p[1],maxCamera=0;const samples=[];
  for(let f=0;f<420;f++){
   const steer=launched?r.steerToward(target,{pace:Math.min(1,Math.hypot(target[0]-r.p.pos.x,target[2]-r.p.pos.z)/3)}):{};
   r.tick({...steer,jumpHeld:true,spinHeld:true});
   if(r.p.vVel>30)launched=true;
   peak=Math.max(peak,r.p.pos.y);maxCamera=Math.max(maxCamera,r.p.launchCameraPresentation?.strength??0);
   if(f%6===0)samples.push(r.snapshot());
   if(launched&&r.p.grounded)break;
  }
  const landed=r.p.grounded&&Math.abs(r.p.pos.y-target[1])<.2&&Math.abs(r.p.pos.x-target[0])<leg.to.w/2&&Math.abs(r.p.pos.z-target[2])<leg.to.d/2;
  const result={name:leg.spring,from:pad.p,to:target,launched,landed,wrap:r.p.verticalLoopOffset-initialOffset,rise:peak-pad.p[1],maxCamera,end:r.snapshot(),samples};report.springs.push(result);
  console.log(JSON.stringify({...result,samples:undefined}));
 }
 for(const leg of (process.argv.includes('--springs')?[]:legs.filter(e=>e.kind==='jump'))){
  const a=leg.from.p,b=leg.to.p,lateral=Math.sign(b[0]-a[0])*Math.min(leg.from.w/2-2,leg.to.w/2-2,Math.abs(b[0]-a[0])/2);
  const start=[a[0]+lateral,a[1]+.08,a[2]-(leg.from.d/2-.6)],target=[b[0]-lateral,b[1],Math.min(b[2]+leg.to.d/2-.8,a[2]-leg.from.d/2-4)];
  r.p.respawn(r.l,true,false,{position:new THREE.Vector3(...start),heading:new THREE.Vector3(b[0]-a[0],0,b[2]-a[2]).normalize()});
  r.stepFor(10);r.charge(26);r.releaseJump({...r.steerToward(target),spinHeld:true});
  for(let f=0;f<360&&!r.p.grounded;f++)r.tick({...r.steerToward(target),jumpHeld:f===30,spinHeld:true,spinPressed:f%24===0});
  const reached=r.p.grounded&&Math.abs(r.p.pos.y-b[1])<.15&&Math.abs(r.p.pos.x-b[0])<leg.to.w/2&&Math.abs(r.p.pos.z-b[2])<leg.to.d/2;
  report.jumps.push({name:leg.name,reached,end:r.snapshot()});console.log(JSON.stringify(report.jumps.at(-1)));
 }
 for(const leg of (process.argv.includes('--springs')?[]:legs.filter(e=>e.kind==='rail'))){
  const rail=r.l.rails.find(q=>q.object.userData.sourceName===leg.rail),a=new THREE.Vector3(...leg.points[0]),b=new THREE.Vector3(...leg.points.at(-1));
  const at=rail.closest(a).t,end=rail.closest(b).t,sign=Math.sign(end-at),heading=rail.tangentAt(at).multiplyScalar(sign);heading.y=0;heading.normalize();
  r.p.respawn(r.l,true,false,{position:a.clone().add(new THREE.Vector3(0,1.3,0)),heading});r.p.state='air';r.p.grounded=false;r.p.vVel=-2;r.p.speed=22;r.p.axisF.copy(heading);r.p.axisL.set(-heading.z,0,heading.x);
  let caught=false,reached=false,frames=0;const deaths=r.p.totalDeaths,samples=[];
  for(;frames<1800;frames++){
   const correction=-Math.sign(r.p.balance+r.p.balanceVel*.3);
   r.tick({moveY:1,moveX:r.p.state==='grind'?correction:0,grindHeld:true});
   if(r.p.grindRail===rail){caught=true;if((r.p.grindT-end)*sign>-3){reached=true;break;}}
   if(frames%120===0)samples.push(r.snapshot());
   if(r.p.totalDeaths>deaths)break;
  }
  const result={name:leg.name,rail:leg.rail,reverse:sign<0,caught,reached,frames,end:r.snapshot(),samples:reached?undefined:samples};report.rails.push(result);console.log(JSON.stringify({...result,samples:undefined}));
  await writeFile(output+'/route-native.json',JSON.stringify(report,null,2));
 }
 await writeFile(output+'/route-native.json',JSON.stringify(report,null,2));
 assert.ok(report.jumps.every(s=>s.reached),'Every marked foot jump reaches its original landing');
 assert.ok(report.rails.every(s=>s.reached),'Every intended rail leg is rideable in its marked direction');
 assert.ok(report.springs.every(s=>s.landed&&!s.wrap&&s.rise>48&&s.maxCamera>.8),'Every Carlisle spring must reach its intended existing tier with the full launch presentation');
},{modulePath:'/src/levels/spaghetti-rails-platforming.ts',source:m=>m.SPAGHETTI_RAILS_PLATFORMING_LEVEL,levelId:'spaghetti-rails-platforming',endlessDeaths:true,controlFrame:r=>{if(r.p.state==='air'&&r.p.trampolineAir)return r.p.axisF;const f=r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z,{...r.p.laneCursor})??{x:0,z:-1};return r.p.grounded?f:r.p.axisF.clone().lerp(new THREE.Vector3(f.x,0,f.z),.1).normalize();}});
