import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';

const regular=['empty','wood','multihit','wood','empty','life','empty','wood','multihit'];
const specials=['mystery','metal','bouncy','metalbounce','mask','tnt','nitro','bang','nitrobang'];
const fixture={v:1,name:'Race time crates',spawn:[0,.1,15],killY:-20,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-100],s:[60,1,300]},
 ...regular.map((kind,i)=>({t:'crate',kind,p:i?[10+i*2,0,-25]:[0,0,4]})),
 ...specials.map((kind,i)=>({t:'crate',kind,p:[-24+i*3,0,-65]})),
 {t:'gate',p:[0,0,-200]},{t:'camnode',p:[0,0,15]},{t:'camnode',p:[0,0,-210]}],
 skateRace:{v:1,racers:8,seed:19,line:[[0,0,15,60],[0,0,-200,60]],jumps:[],finishWidth:55,originalLength:161}};
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'trial-fixture');
 const originals=r.l.crates.map(c=>c.mesh.material.map),tuning=JSON.stringify(r.TUNING);
 const tick=(n=1,sample={})=>{for(let i=0;i<n;i++){r.scene.updateMatrixWorld(true);race.step(r.dt,normalizeGameInput(sample));}};
 race.start('time-trial',19);
 assert.equal(race.count,1);assert.equal(r.l.clockPickup,null);
 const times=r.l.crates.filter(c=>c.timeSecs),item=r.l.crates.find(c=>c.mystery);
 assert.equal(times.length,3);assert.deepEqual(times.map(c=>c.timeSecs),[2,1,3]);
 assert.ok(times[0].empty,'ordinary empty racing crates must convert');
 assert.ok(times[1].woodCrate&&!times[1].woodCrate.visual.visible&&times[1].mesh.material.visible,'numbered faces replace the wood model');
 for(let i=regular.length;i<r.l.crates.length;i++){
  assert.equal(r.l.crates[i].timeSecs,undefined,'item boxes and hazards keep their jobs');
  assert.equal(r.l.crates[i].mesh.material.map,originals[i]);
 }
 tick(30);assert.equal(r.p.ttTime,0);assert.equal(r.p.ttFreeze,0,'countdown does not start the trial clock');
 race.phase='running';r.p.speed=12;
 for(let i=0;i<180&&times[0].alive;i++)tick(1,{moveY:1,jumpHeld:true});
 assert.equal(times[0].alive,false,'native skating contact smashes the time crate');
 close(r.p.ttFreeze,2,'the printed bonus is awarded exactly once');
 const stopped=r.p.ttTime,wall=race.elapsed;tick(30);
 close(r.p.ttTime,stopped,'clock remains frozen');close(race.elapsed-wall,30*r.dt,'simulation still advances');
 const remaining=r.p.ttFreeze;r.l.breakCrate(times[1]);close(r.p.ttFreeze,remaining+1,'time bonuses stack');
 r.l.breakCrate(times[1]);close(r.p.ttFreeze,remaining+1,'duplicate breaks cannot reward twice');
 close(race.hud().elapsed,r.p.ttTime,'HUD uses the scored clock');close(race.hud().freeze,r.p.ttFreeze,'HUD exposes freeze countdown');
 const beforeExpiry=r.p.ttTime;r.p.ttFreeze=r.dt/3;tick();
 close(r.p.ttTime,beforeExpiry+r.dt*2/3,'partial freeze expiry charges only unfrozen time');close(r.p.ttFreeze,0,'freeze expires');
 r.l.breakCrate(item);assert.equal(race.riders[0].item,'mushroom','item boxes still give trial boosts');
 const ordinary=r.l.crates[1];r.l.breakCrate(ordinary);
 const beforeFall=r.p.ttTime;r.p.pos.y=r.l.killY-1;r.p.state='air';r.p.grounded=false;tick();
 assert.equal(r.p.state,'dead');const deadTime=r.p.ttTime;tick(20);close(r.p.ttTime,deadTime+20*r.dt,'recovery remains on the trial clock');
 tick(540);
 assert.ok(r.p.ttTime>beforeFall+8);assert.equal(times[0].alive,false);assert.equal(times[1].alive,false,'time crates cannot respawn during an attempt');
 assert.ok(ordinary.alive&&item.alive,'regular and item boxes retain race respawn behaviour');
 assert.equal(r.p.lives,4);assert.equal(r.p.totalDeaths,0);assert.equal(r.p.fruit,0);
 r.l.breakCrate(times[2]);const scored=r.p.ttTime;let result;race.onFinish=value=>result=value;
 r.p.resetRacePosition(r.l,new r.THREE.Vector3(0,0,-200.1),new r.THREE.Vector3(0,0,-1));race.riders[0].progress=214;tick();
 assert.equal(race.phase,'finished');close(result.time,scored,'finish result retains time-crate savings');
 assert.ok(result.time<race.elapsed);close(race.riders[0].finish,scored,'rider result');close(race.hud().elapsed,scored,'result HUD');
 assert.equal(r.p.ttActive,false);assert.equal(r.p.ttFreeze,0);tick(120);close(r.p.ttTime,scored,'finished clock is stopped');
 const trialMaps=r.l.crates.map(c=>c.mesh.material.map);
 race.start('time-trial',19);assert.ok(times.every(c=>c.alive));assert.equal(r.p.ttTime,0);assert.equal(r.p.ttFreeze,0);
 assert.deepEqual(r.l.crates.map(c=>c.mesh.material.map),trialMaps,'same-mode retry retains time-crate dressing');
 for(let repeat=0;repeat<3;repeat++){
  race.start('race',19);assert.equal(race.count,8);assert.ok(r.l.crates.every(c=>c.timeSecs===undefined));
  assert.deepEqual(r.l.crates.map(c=>c.mesh.material.map),originals,'race mode restores all original faces');
  assert.ok(times[1].woodCrate.visual.visible&&!times[1].mesh.material.visible);
  race.start('time-trial',19);assert.deepEqual(times.map(c=>c.timeSecs),[2,1,3]);
 }
 assert.equal(JSON.stringify(r.TUNING),tuning);
 console.log('PASS race time crates: native break, stacked freeze, fractional expiry, recovery clock, scored finish, no farming, boosts and repeated mode restoration');
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'trial-fixture'});

await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'slipstream-race');race.start('time-trial',19);
 const times=r.l.crates.filter(c=>c.timeSecs),items=r.l.crates.filter(c=>c.mystery);
 assert.ok(times.length>0&&times.length<r.l.totalCrates);assert.ok(items.every(c=>!c.timeSecs));
 const ranges=Array.from({length:4},()=>0),regularRanges=[0,0,0,0];
 for(const c of r.l.crates.filter(c=>c.empty)){
  const quarter=Math.min(3,Math.floor(race.course.project(c.mesh.position).s/race.course.length*4));
  regularRanges[quarter]++;if(c.timeSecs)ranges[quarter]++;
 }
 assert.ok(ranges.filter(n=>n>0).length>=3,'converted boxes span the existing ordinary-crate stretches');
 console.log(JSON.stringify({course:r.l.name,timeCrates:times.length,byQuarter:ranges,regularByQuarter:regularRanges,bonusSeconds:times.reduce((sum,c)=>sum+c.timeSecs,0),itemBoxes:items.length}));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
