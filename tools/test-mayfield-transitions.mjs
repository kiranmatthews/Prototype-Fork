import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.MAYFIELD_OUTPUT||'/tmp/mayfield-validation';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,report=[];
 for(const s of [459,636,672])for(const side of [-1,1]){
  p.respawn(l,true,false,{position:new THREE.Vector3(0,.08,-s),heading:new THREE.Vector3(side,0,0)});r.stepFor(5);
  const e={s,side,vert:0,air:0,peak:0,maxStep:0,returned:false,bail:false,trace:[]};
  for(let i=0;i<540;i++){
   const before=p.pos.clone();r.tick({moveX:p.grounded?side:0,jumpHeld:true});
   e.peak=Math.max(e.peak,p.pos.y);e.maxStep=Math.max(e.maxStep,p.pos.distanceTo(before));e.bail||=p.isBailing;
   if(p.groundHit?.vert&&p.rideNormal.y<.97)e.vert++;
   if(e.vert&&!p.grounded)e.air++;
   if(i%5===0)e.trace.push({i,p:p.pos.toArray(),state:p.state,ground:p.groundHit?.name,normal:p.rideNormal.toArray(),air:p.vertAir,speed:p.speed});
   if(e.air&&p.grounded&&p.pos.y<.2){e.returned=true;break;}
   if(p.isBailing||p.totalDeaths)break;
  }
  e.end=p.pos.toArray();report.push(e);
 }
 const deckWalks=[];
 for(const side of [-1,1]){p.respawn(l,true,false,{position:new THREE.Vector3(side*10.7,.08,-588),heading:new THREE.Vector3(0,0,-1)});r.stepFor(5);let maxStep=0;for(let i=0;i<1000&&-p.pos.z<713;i++){const before=p.pos.clone();r.tick({moveY:1});maxStep=Math.max(maxStep,p.pos.distanceTo(before));assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),'Side deck walk must stay alive');}assert.ok(-p.pos.z>=713&&p.grounded,'Side deck walk must reach the exit');deckWalks.push({side,end:p.pos.toArray(),maxStep});}
 console.log(JSON.stringify({deckWalks}));
 await writeFile(`${out}/transitions.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({trace,...e})=>e),null,2));
 assert.ok(report.every(e=>e.vert>0&&e.air>0&&e.returned&&!e.bail&&e.maxStep<1),'Both sides of each transition must climb, air and return without snagging or teleporting');
},{modulePath:'/src/levels/mayfield-mall.ts',source:m=>m.MAYFIELD_MALL_LEVEL,levelId:'mayfield-mall',maxFrames:7000});
