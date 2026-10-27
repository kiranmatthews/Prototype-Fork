import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/transfer-envelope';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');
 const runs=r.sourceModule.SPAGHETTI_RUNS,transfers=runs.map((run,i)=>run.jumpEntry?i:-1).filter(i=>i>=0);
 const originals=race.jumps.map(j=>({...j})),tuning=JSON.stringify(r.TUNING),cases=[];
 const speeds=(process.env.SPAGHETTI_SPEEDS??'24,30.5').split(',').map(Number);
 const timing=(process.env.SPAGHETTI_TIMING??'-2,0,2').split(',').map(Number);
 for(const [jumpIndex,receiver]of transfers.entries())for(const lane of [0,1,2])for(const speed of speeds)for(const offset of timing){
  race.start('time-trial',270327);race.phase='running';
  race.jumps=originals.map((j,i)=>({...j,s:j.s+(i===jumpIndex?offset:0)}));
  const rail=r.l.rails[(receiver-1)*3+lane],start=Math.max(0,rail.totalLength-28),point=rail.pointAt(start),heading=rail.tangentAt(start).setY(0).normalize();
  // Explicit launch fixture: set one initial position and approach speed.
  // Catch, charge, balance, jump, gravity and landing then use production input.
  point.y+=r.CONST.railRideHeight;
  r.p.resetRacePosition(r.l,point,heading);r.p.state='air';r.p.grounded=false;r.p.vVel=0;r.p.speed=speed;
  race.riders[0].progress=race.course.project(point).s;
  let caught=false,launched=false,result=null,exitSpeed=null,frames=0,previous='air';
  for(;frames<300;frames++){
   const input=race.drive(0);r.scene.updateMatrixWorld(true);race.step(r.dt,input);
   r.l.update(r.dt);r.p.commitRenderStep(r.l);race.commitRenderStep();
   const current=r.l.rails.indexOf(r.p.grindRail);
   if(r.p.state==='grind'&&current===(receiver-1)*3+lane)caught=true;
   if(caught&&previous==='grind'&&r.p.state==='air'){launched=true;exitSpeed=r.p.speed;}
   if(launched&&r.p.state==='grind'&&current!==((receiver-1)*3+lane)){
    result={caughtRail:current,expectedRun:receiver,passed:Math.floor(current/3)===receiver,position:r.p.pos.toArray(),landingSpeed:r.p.grindVel};break;
   }
   if(r.p.state==='dead'||r.p.pos.y<point.y-12)break;
   previous=r.p.state;
  }
  const record={jump:jumpIndex,from:runs[receiver-1].name,to:runs[receiver].name,lane:lane-1,approachSpeed:speed,timingOffset:offset,
   caughtSource:caught,launched,exitSpeed,frames,...(result??{passed:false,position:r.p.pos.toArray(),state:r.p.state})};
  cases.push(record);
  if(!record.passed)console.log(JSON.stringify(record));
  if(cases.length%18===0)console.log(JSON.stringify({completed:cases.length,passed:cases.filter(c=>c.passed).length}));
 }
 const baseline=cases.filter(c=>c.timingOffset===0),failures=cases.filter(c=>!c.passed);
 const report={at:new Date().toISOString(),cases:cases.length,passed:cases.length-failures.length,baseline:baseline.length,
  baselinePassed:baseline.filter(c=>c.passed).length,tuningUnchanged:tuning===JSON.stringify(r.TUNING),results:cases};
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,results:undefined}));
 assert.ok(report.tuningUnchanged);
 assert.ok(baseline.every(c=>c.passed),'Every authored transfer must catch its receiver in every lane at ordinary approach speeds');
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
