import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-connections';
await mkdir(output,{recursive:true});
const reports=[];
for(const platforming of [false,true])await withBlockworksRuntime(async r=>{
 const rails=r.l.rails.filter(rail=>rail.object.userData.sourceName?.startsWith('Recovery weave'));
 assert.equal(rails.length,4);
 for(const rail of rails){
  // A single initial placement over the first exposed island. Thereafter
  // production grind input must carry the rider to the collector unaided.
  const start=rail.points.find(p=>p.z<-105).clone();start.y+=1.5;
  r.p.respawn(r.l,true,false,{position:start,heading:new r.THREE.Vector3(0,0,-1)});
  r.p.state='air';r.p.grounded=false;r.p.vVel=-2;r.p.speed=22;
  const deaths=r.p.totalDeaths,samples=[];let nativeFrames=0,maxT=0,frames=0;
  for(;frames<7200;frames++){
   const correction=Math.max(-1,Math.min(1,-r.p.balance*5-r.p.balanceVel*.7));
   r.tick({moveY:1,moveX:r.p.state==='grind'?correction:0,grindHeld:true});
   if(r.p.grindRail===rail){nativeFrames++;maxT=Math.max(maxT,r.p.grindT);}
   if(frames%120===0)samples.push(r.snapshot());
   if(maxT>rail.totalLength-4&&r.p.pos.z<rail.points.at(-1).z+3)break;
   if(r.p.totalDeaths>deaths||r.p.state==='finished')break;
  }
  const report={platforming,rail:rail.object.userData.sourceName,frames,nativeFrames,maxT,length:rail.totalLength,end:r.p.pos.toArray(),deaths:r.p.totalDeaths-deaths,samples};
  reports.push(report);await writeFile(output+'/report.json',JSON.stringify(reports,null,2));
  console.log(JSON.stringify({...report,samples:undefined}));
  assert.equal(report.deaths,0);assert.ok(nativeFrames>100,'the authored recovery rail is physically grindable');
  assert.ok(maxT>rail.totalLength-4,'every recovery thread reaches the collector without a reset or teleport');
 }
},{modulePath:platforming?'/src/levels/spaghetti-rails-platforming.ts':'/src/levels/spaghetti-rails.ts',source:m=>m[platforming?'SPAGHETTI_RAILS_PLATFORMING_LEVEL':'SPAGHETTI_RAILS_LEVEL'],levelId:platforming?'spaghetti-rails-platforming':'spaghetti-rails',endlessDeaths:true});
