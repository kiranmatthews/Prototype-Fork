import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(r.source),'Source passes the editor/save contract');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'coconut-cart-rally');race.start('race',0);
 const gapFlights=new Set(),jumpSpans=r.source.skateRace.jumps.map(j=>[race.course.project(new r.p.pos.constructor(...j.takeoff)).s,race.course.project(new r.p.pos.constructor(...j.landing)).s]);
 const pipeChecks=r.sourceModule.CART_RALLY_PIPES.map(([a,b])=>{const centre=r.sourceModule.cartRallyPoint((a+b)/2),edge=r.sourceModule.cartRallyPoint((a+b)/2,14);const height=race.carts.ground(edge[0],edge[2]).height-race.carts.ground(centre[0],centre[2]).height;assert.ok(height>6,'Actual half-pipe collision climbs above the trough');return height;});
 const tuning=JSON.stringify(r.TUNING),samples=[],air=race.riders.map(()=>({frames:0,max:0,jumps:0}));
 let result;race.onFinish=v=>result=v;
 for(let f=0;f<18000;f++){
  const input=race.phase==='running'?race.drive(0):{moveX:0,moveY:0};
  race.step(r.dt,input);
  jumpSpans.forEach(([a,b],i)=>{if(race.riders[0].progress>a+3&&race.riders[0].progress<b-3&&!r.p.grounded)gapFlights.add(i);});
  for(const [i,c]of race.carts.fleet.physics.carts.slice(0,8).entries()){
   if(!c.grounded){air[i].frames++;air[i].max=Math.max(air[i].max,c.y-race.course.sample(race.riders[i].progress).y);}
   air[i].jumps=c.airborneCount;
  }
  if(f%600===0){const sample={f,phase:race.phase,riders:race.riders.slice(0,race.count).map(a=>({id:a.id,s:+a.progress.toFixed(1),p:a.player.pos.toArray().map(v=>+v.toFixed(1)),speed:+a.player.speed.toFixed(1),falls:a.falls,finish:a.finish}))};samples.push(sample);console.log(JSON.stringify(sample));}
  if(race.riders.slice(0,race.count).every(r=>r.finish!==null))break;
 }
 const report={result,gapFlights:[...gapFlights],pipeChecks,tuningUnchanged:JSON.stringify(r.TUNING)===tuning,courseLength:race.course.length,air,samples,riders:race.riders.slice(0,race.count).map(a=>({id:a.id,finish:a.finish,falls:a.falls})),stats:race.carts.fleet.stats};
 await writeFile(process.env.CART_REPORT??'docs/coconut-cart-rally/validation.json',JSON.stringify(report,null,2)+'\n');
 assert.ok(result,'Human input-driven cart finishes');
 assert.ok(report.riders.every(a=>a.finish!==null),'All cart rivals finish');
 assert.ok(report.riders[0].falls<=5,'The mayhem race stays recoverable after weapon hits');
 assert.ok(report.riders.every(a=>a.falls<=8),'Rivals recover from racing collisions without a failure loop');
 assert.equal(gapFlights.size,12,'Every authored gap is crossed in genuine flight');
 assert.ok(air[0].max>3,'Large jumps produce meaningful height');
 assert.equal(report.tuningUnchanged,true);
 report.checkpoints=r.l.checkpoints.map(cp=>cp.active);assert.ok(report.checkpoints.every(Boolean));
 assert.ok(report.result.boxes>=r.l.checkpoints.length,'Checkpoint crates count toward the obtainable box gem');
 console.log('PASS golf-cart race',JSON.stringify(report.riders));
 // A solo restart owns exactly one cart and retains the shared clock/items.
 race.start('time-trial',0);assert.equal(race.carts.cartForRacer.length,1);assert.ok(race.carts.fleet.models.length>1);
 for(let f=0;f<12000&&race.riders[0].finish===null;f++)race.step(r.dt,race.phase==='running'?race.drive(0):{moveX:0,moveY:0});
 assert.ok(race.riders[0].finish!==null,'Solo trial traverses the entire route');
 assert.equal(race.riders[0].falls,0,'Solo line lands every jump');
 report.solo={time:race.riders[0].finish,falls:race.riders[0].falls,boxes:race.riders[0].boxes.size};
 assert.ok(r.l.checkpoints.every(cp=>!race.riders[0].boxes.has(cp)),'Hidden checkpoint crates are excluded from time trials');
 console.log('PASS solo route',JSON.stringify(report.solo));
 race.start('time-trial',0);race.phase='running';
 // An explicit test setup starts the fall at an earned course checkpoint.
 const cp=r.l.checkpoints[2];r.p.resetRacePosition(r.l,cp.spawnPos.clone(),race.course.tangent(race.course.project(cp.spawnPos).s));
 let fell=false,fallAt=-1;
 for(let f=0;f<1000;f++){
  race.step(r.dt,fell?{moveX:0,moveY:0}:{moveX:1,moveY:1,jumpHeld:true});
  if(!fell&&race.riders[0].falls>0){fell=true;fallAt=f;}
  if(fell&&f>fallAt+60)break;
 }
 assert.ok(fell,'Steering off the island triggers a real fall/recovery');
 assert.ok(r.p.grounded,'Recovery returns to supported road');
 assert.ok(race.carts.ground(r.p.pos.x,r.p.pos.z).safe);
 assert.ok(r.p.ttTime>0,'Falls keep the time-trial clock running');
 report.recovery={position:r.p.pos.toArray(),falls:race.riders[0].falls,clock:r.p.ttTime,cartCount:race.carts.fleet.models.length};
 await writeFile(process.env.CART_REPORT??'docs/coconut-cart-rally/validation.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS solo restart and input-driven checkpoint fall recovery');
}, {modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
