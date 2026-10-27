import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/recovery';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');race.start('time-trial');
 const rider=race.riders[0],tuning=JSON.stringify(r.TUNING),injected=new Set(),events=[];
 const choice=Number(process.env.SPAGHETTI_CHOICE??1),expected=r.sourceModule.SPAGHETTI_PATHS.filter(p=>p.choice===choice).reduce((sum,p)=>sum+p.runs.length-1,0)+r.sourceModule.SPAGHETTI_DOCKS.length-1;
 assert.equal(r.l.raceCheckpoints.length,r.sourceModule.SPAGHETTI_RAILS_LEVEL.components.filter(c=>c.t==='checkpoint').length);
 let frames=0,pending=null,observingReturn=null;
 for(;frames<45000&&rider.finish===null;frames++){
  const previousState=r.p.state;
  r.scene.updateMatrixWorld(true);
  race.step(r.dt,race.phase==='running'?race.drive(0,false,choice):{moveX:0,moveY:0});
  r.l.update(r.dt);r.p.commitRenderStep(r.l);race.commitRenderStep();
  if(pending&&r.p.grounded&&rider.recovery===0&&rider.falls>pending.falls){
   pending.returnedAt=frames;pending.returned=r.p.pos.toArray();pending.ground=r.p.groundHit?.name;
   assert.ok(r.p.pos.distanceTo(rider.anchor)<2,'The pit returns to the supported checkpoint deck');
   assert.ok(race.course.supportAt(r.l,r.p.pos),'Recovery has real floor collision');
   events.push(pending);observingReturn=pending;pending=null;
  }
  if(observingReturn&&r.p.state==='grind'&&!observingReturn.firstRail){
   observingReturn.firstRail={index:r.l.rails.indexOf(r.p.grindRail),entry:r.p.grindEntryT,length:r.p.grindRail.totalLength,speed:r.p.grindVel};
  }
  if(observingReturn?.firstRail&&previousState==='grind'&&r.p.state==='air'){
   observingReturn.departure={speed:r.p.speed,boost:r.p.grindBoostT>0,type:r.p.lastJumpType};observingReturn=null;
  }
  const key=Math.round(rider.anchorProgress);
  if(!pending&&race.phase==='running'&&r.p.state==='grind'&&rider.progress>rider.anchorProgress+60&&!injected.has(key)){
   assert.ok(race.course.supportAt(r.l,rider.anchor),'The banked checkpoint is supported before the fall');
   const checkpoint=r.sourceModule.SPAGHETTI_RAILS_LEVEL.components.find(c=>c.t==='checkpoint'&&Math.hypot(c.p[0]-rider.anchor.x,c.p[2]-rider.anchor.z)<.2);
   injected.add(key);pending={anchor:key,name:checkpoint?.nm??'Starting grid',position:rider.anchor.toArray(),at:frames,from:rider.progress,falls:rider.falls};
   // Explicit fault injection only: traversal before and after uses real inputs.
   r.p.pos.y=r.l.killY-3;r.p.prevPos.copy(r.p.pos);r.p.state='air';r.p.grounded=false;r.p.vVel=-5;
  }
  if(frames%2400===0)console.log(JSON.stringify({frames,time:race.elapsed,s:rider.progress,anchor:rider.anchorProgress,falls:rider.falls,returned:events.length}));
  if(rider.falls>injected.size)break;
 }
 const report={at:new Date().toISOString(),frames,finish:rider.finish,falls:rider.falls,deaths:r.p.totalDeaths,
  injected:injected.size,events,tuningUnchanged:tuning===JSON.stringify(r.TUNING)};
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(rider.finish!==null,'The full course remains playable after every stopped retry');
 assert.equal(events.length,expected,'The grid, junctions and every receiving platform on the chosen branch were exercised');
 assert.equal(rider.falls,injected.size,'No additional fall occurs after any retry');
 assert.equal(r.p.totalDeaths,0,'Race recovery does not consume adventure lives');
 assert.equal(report.tuningUnchanged,true);
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
