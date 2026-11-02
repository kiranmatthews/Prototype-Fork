import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-infinite';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const C=r.sourceModule.SPAGHETTI_RAILS_PLATFORMING_LEVEL.components,report={springs:[],ramps:[],spines:[],boundary:[]};
 const start=(position,speed=0)=>{r.p.respawn(r.l,true,false,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(0,0,-1)});r.p.speed=speed;};
 for(const c of C.filter(c=>c.t==='trampoline')){
  start([c.p[0],c.p[1]+2,c.p[2]+2],20);r.p.state='air';r.p.grounded=false;r.p.vVel=-2;
  let launched=false,peak=c.p[1],velocity=0;const samples=[];
  for(let f=0;f<300;f++){r.tick({...r.steerToward([c.p[0],c.p[1]+22,c.p[2]-30]),jumpHeld:true,spinHeld:true});peak=Math.max(peak,r.p.pos.y);if(r.p.vVel>20){launched=true;velocity=Math.max(velocity,r.p.vVel);}if(f%12===0)samples.push(r.snapshot());if(launched&&r.p.grounded)break;}
  report.springs.push({position:c.p,launched,velocity,rise:peak-c.p[1],landing:r.p.pos.toArray(),samples});
  await writeFile(output+'/features-progress.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({spring:{...report.springs.at(-1),samples:undefined}}));
  assert.ok(launched&&peak-c.p[1]>22,'Carlisle spring reaches its reward tier');
  assert.ok(r.p.grounded&&r.p.pos.y>c.p[1]+21,'The reward receiver physically catches the spring jump');
 }
 for(const c of C.filter(c=>c.t==='ramp')){
  // Begin at the supported high end of the new gravity run-in, then ride the
  // complete descent and kicker rather than placing inside the sloping deck.
  start([c.p[0],c.p[1]+4.08,c.p[2]+21],20);
  let air=false,landed=false,peak=r.p.pos.y;const samples=[];
  for(let f=0;f<360;f++){
   r.tick({...r.steerToward([c.p[0],c.p[1]-9,c.p[2]-32]),jumpHeld:true});
   peak=Math.max(peak,r.p.pos.y);
   if(!r.p.grounded&&r.p.pos.z<c.p[2])air=true;
   if(f%12===0)samples.push({p:r.p.pos.toArray(),g:r.p.grounded,vy:r.p.vVel,state:r.p.state});
   if(air&&r.p.grounded&&r.p.pos.z<c.p[2]-c.len/2-3){landed=true;break;}
  }
  report.ramps.push({position:c.p,air,landed,peak,landing:r.p.pos.toArray(),samples});
  await writeFile(output+'/features-progress.json',JSON.stringify(report,null,2));
  assert.ok(air&&landed,'Kicker launches and has a physical landing');
  assert.ok(Math.abs(r.p.pos.y-(c.p[1]-9))<.1&&Math.abs(r.p.pos.x-c.p[0])<7&&Math.abs(r.p.pos.z-(c.p[2]-32))<9,'The landing is on the authored kicker receiver');
 }
 for(const c of C.filter(c=>c.nm?.match(/^Lantern spine .*\.0$/))){
  start([c.p[0],c.p[1]+.08,c.p[2]+2],30);
  const samples=[],surfaces=new Set(),transfers=[];let air=false;
  const first=r.l.halfpipes.findIndex(h=>h.cross===c.p[2]);
  for(let f=0;f<600;f++){
   let jumpHeld=true;
   if(!r.p.grounded&&r.p.vertAir&&r.p.pipeHang)jumpHeld=r.p.vertBoardRelease.stage===1&&r.p.pos.y>r.p.hangPipe.lipY+.5&&!r.p.vertBoardRelease.pressArmed;
   const prior=r.p.hangPipe;
   r.tick({...r.steerToward([c.p[0],c.p[1]-20,c.p[2]-80]),jumpHeld});
   if(prior&&r.p.hangPipe&&prior!==r.p.hangPipe&&r.p.vertBoardRelease.stage===2)transfers.push([r.l.halfpipes.indexOf(prior),r.l.halfpipes.indexOf(r.p.hangPipe)]);
   if(!r.p.grounded)air=true;
   if(r.p.grounded&&r.p.groundHit?.halfpipe)surfaces.add(r.l.halfpipes.indexOf(r.p.groundHit.halfpipe));
   if(f%12===0)samples.push({p:r.p.pos.toArray(),g:r.p.grounded,state:r.p.state,vy:r.p.vVel});
   if(surfaces.has(first+2))break;
  }
  report.spines.push({from:c.nm,air,end:r.p.pos.toArray(),surfaces:[...surfaces],transfers,samples});
  await writeFile(output+'/features-progress.json',JSON.stringify(report,null,2));
  assert.deepEqual(transfers,[[first,first+1],[first+1,first+2]],'Both forward spine moves reach the adjacent lower receiver');
  assert.ok(surfaces.has(first+2),'The third halfpipe physically catches the rider');
 }
 // Drive into each side while falling through the seam: containment remains
 // continuous even when a whole cell changes between fixed ticks.
 for(const side of [-1,1]){
  start([side*46,-143,-80],60);r.p.state='air';r.p.grounded=false;r.p.vVel=-60;
  r.p.axisF.set(side,0,0);r.p.axisL.set(0,0,-side);
  let maximum=0;for(let f=0;f<180;f++){r.tick({});maximum=Math.max(maximum,Math.abs(r.p.pos.x));}
  report.boundary.push({side,maximum,p:r.p.pos.toArray()});
  assert.ok(maximum<48.1,'Swept side wall prevents escaping the covered corridor');
 }
 const cp=C.find(c=>c.t==='checkpoint');
 start([cp.p[0],cp.p[1]+.08,cp.p[2]+3]);
 for(let f=0;f<240&&!r.l.activeCheckpoint;f++)r.tick({moveY:1,spinHeld:true,spinPressed:f%30===0});
 assert.ok(r.l.activeCheckpoint,'Checkpoint is physically reachable');
 const checkpoint=r.l.activeCheckpoint.spawnPos.toArray();
 const gate=C.find(c=>c.t==='gate');
 start([0,gate.p[1]+.08,gate.p[2]+13]);
 for(let f=0;f<600&&r.p.state!=='finished';f++)r.tick(r.steerToward([0,gate.p[1],gate.p[2]-4]));
 report.finish={state:r.p.state,crystal:r.p.hasCrystal,p:r.p.pos.toArray(),checkpoint};
 await writeFile(output+'/features.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,springs:report.springs.map(({samples,...v})=>v),ramps:report.ramps.map(({samples,...v})=>v),spines:report.spines.map(({samples,...v})=>v)}));
 assert.ok(r.p.hasCrystal);assert.equal(r.p.state,'finished');
},{modulePath:'/src/levels/spaghetti-rails-platforming.ts',source:m=>m.SPAGHETTI_RAILS_PLATFORMING_LEVEL,levelId:'spaghetti-rails-platforming',endlessDeaths:true});
