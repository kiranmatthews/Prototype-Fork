import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(r.source),'Source passes the editor/save contract');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'coconut-cart-rally');race.start('race',0);
 assert.equal(race.carts.fleet.physics.stableLandings,true);assert.equal(race.carts.fleet.physics.gravity,11.5);
 const gapFlights=new Set(),jumpSpans=r.source.skateRace.jumps.map(j=>[race.course.project(new r.p.pos.constructor(...j.takeoff)).s,race.course.project(new r.p.pos.constructor(...j.landing)).s]);
 const pipeChecks=r.sourceModule.CART_RALLY_PIPES.map(([a,b])=>{const centre=r.sourceModule.cartRallyPoint((a+b)/2),edge=r.sourceModule.cartRallyPoint((a+b)/2,26.8);const height=race.carts.ground(edge[0],edge[2]).height-race.carts.ground(centre[0],centre[2]).height;assert.ok(height>6,'Actual half-pipe collision climbs above the trough');return height;});
 const tuning=JSON.stringify(r.TUNING),samples=[],air=race.riders.map(()=>({frames:0,max:0,jumps:0})),wasAir=race.riders.map(()=>false);
 let result;race.onFinish=v=>result=v;
 for(let f=0;f<18000;f++){
  const input=race.phase==='running'?race.drive(0):{moveX:0,moveY:0};
  race.step(r.dt,input);
  jumpSpans.forEach(([a,b],i)=>{if(race.riders[0].progress>a+3&&race.riders[0].progress<b-3&&!r.p.grounded)gapFlights.add(i);});
  for(const [i,rider]of race.riders.slice(0,race.count).entries()){
   // Ownership changes after theft and wrecks; follow the racer, not their abandoned starting kart.
   const c=race.carts.fleet.physics.carts[race.carts.cartForRacer[i]],flying=!!c&&!c.grounded;
   if(flying){air[i].frames++;air[i].max=Math.max(air[i].max,c.y-race.course.sample(rider.progress).y);if(!wasAir[i])air[i].jumps++;}
   wasAir[i]=flying;
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
 assert.equal(gapFlights.size,12,'Every dirt double offers genuine flight');
 assert.ok(air[0].max>3,'Large jumps produce meaningful height');
 assert.equal(report.tuningUnchanged,true);
 report.checkpoints=r.l.checkpoints.length;assert.equal(report.checkpoints,0,'Race courses contain no checkpoints');
 console.log('PASS golf-cart race',JSON.stringify(report.riders));
 // A solo restart owns exactly one cart and retains the shared clock/items.
 race.start('time-trial',0);assert.equal(race.carts.cartForRacer.length,1);assert.ok(race.carts.fleet.models.length>1);
 for(let f=0;f<12000&&race.riders[0].finish===null;f++)race.step(r.dt,race.phase==='running'?race.drive(0):{moveX:0,moveY:0});
 assert.ok(race.riders[0].finish!==null,'Solo trial traverses the entire route');
 assert.equal(race.riders[0].falls,0,'Solo line lands every jump');
 report.solo={time:race.riders[0].finish,falls:race.riders[0].falls,boxes:race.riders[0].boxes.size,rolls:race.carts.fleet.physics.carts.reduce((n,c)=>n+c.rolls,0)};
 assert.equal(report.solo.rolls,0,'Solo jumps and landings do not roll the kart');
 assert.equal(r.l.checkpoints.length,0,'Solo race trials also contain no checkpoints');
 console.log('PASS solo route',JSON.stringify(report.solo));
 race.start('time-trial',0);race.phase='running';
 // Deliberately drive out toward the rim. The bank and physical wall must
 // keep a fully accelerated cart inside without a checkpoint reset.
 const c=race.carts.fleet.physics.carts[0],at=r.sourceModule.cartRallyPoint(600,20),frame=(await r.server.ssrLoadModule('/src/levels/cart-stadium-layout.ts')).cartRallyFrame(600);
 Object.assign(c,{x:at[0],y:at[1],z:at[2],yaw:Math.atan2(-frame.nx,-frame.nz),vx:frame.nx*35,vz:frame.nz*35,grounded:true,supportHeight:at[1],supportVelocity:0});
 race.carts.sync();race.riders[0].progress=race.course.project(r.p.pos).s;race.riders[0].anchor.copy(r.p.pos);race.riders[0].anchorProgress=race.riders[0].progress;
 const before=c.respawns;
 for(let f=0;f<900;f++)race.step(r.dt,{moveX:0,moveY:0,jumpHeld:true});
 assert.equal(race.riders[0].falls,0,'A deliberate rim collision does not send the racer off the course');
 assert.equal(c.respawns,before);assert.ok(race.carts.ground(c.x,c.z).safe);assert.ok(c.hits>0,'The upper rim produces a real impact');
 report.containment={position:[c.x,c.y,c.z],falls:race.riders[0].falls,hits:c.hits,clock:r.p.ttTime};
 await writeFile(process.env.CART_REPORT??'docs/coconut-cart-rally/validation.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS solo restart and physical stadium containment');
}, {modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
