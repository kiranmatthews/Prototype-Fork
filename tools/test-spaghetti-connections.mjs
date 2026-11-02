import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-connections';
await mkdir(output,{recursive:true});
const reports=[];
for(const platforming of [false,true])await withBlockworksRuntime(async r=>{
 const rails=r.l.rails.filter(rail=>rail.object.userData.sourceName?.startsWith('Recovery weave'));
 assert.ok(rails.length>60,'Long courses keep rail queries in local spans');
 for(let tier=1;tier<=6;tier++){
  const chain=rails.filter(rail=>rail.object.userData.sourceName.startsWith(`Recovery weave / tier ${tier} /`));
  const first=chain[0],second=chain[1];
  const start=first.points.find(p=>p.z<-105).clone();start.y+=1.5;
  r.p.respawn(r.l,true,false,{position:start,heading:new r.THREE.Vector3(0,0,-1)});
  r.p.state='air';r.p.grounded=false;r.p.vVel=-2;r.p.speed=22;
  const deaths=r.p.totalDeaths,samples=[];let nativeFrames=0,maxT=0,frames=0,firstCaught=false,secondCaught=false;
  for(;frames<7200;frames++){
   const correction=Math.max(-1,Math.min(1,-r.p.balance*5-r.p.balanceVel*.7));
   r.tick({moveY:1,moveX:r.p.state==='grind'?correction:0,grindHeld:true});
   if(r.p.grindRail===first)firstCaught=true;
   if(r.p.grindRail===second){secondCaught=true;nativeFrames++;maxT=Math.max(maxT,r.p.grindT);}
   if(frames%120===0)samples.push(r.snapshot());
   if(maxT>second.totalLength-4&&r.p.pos.z<second.points.at(-1).z+3)break;
   if(r.p.totalDeaths>deaths)break;
  }
  const report={platforming,tier,frames,nativeFrames,firstCaught,secondCaught,maxT,length:second.totalLength,end:r.p.pos.toArray(),deaths:r.p.totalDeaths-deaths,samples};
  reports.push(report);await writeFile(output+'/report.json',JSON.stringify(reports,null,2));
  console.log(JSON.stringify({...report,samples:undefined}));
  assert.equal(report.deaths,0);assert.ok(firstCaught&&secondCaught&&nativeFrames>100,'Normal grind input transfers between local rail spans');
  assert.ok(maxT>second.totalLength-4,'Every recovery tier crosses a span junction and reaches the next landing');
 }
},{modulePath:platforming?'/src/levels/spaghetti-rails-platforming.ts':'/src/levels/spaghetti-rails.ts',source:m=>m[platforming?'SPAGHETTI_RAILS_PLATFORMING_LEVEL':'SPAGHETTI_RAILS_LEVEL'],levelId:platforming?'spaghetti-rails-platforming':'spaghetti-rails',endlessDeaths:true});
