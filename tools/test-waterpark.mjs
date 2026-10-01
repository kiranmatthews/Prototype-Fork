import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withWaterparkRuntime } from './waterpark-runner.mjs';
import { createWaterparkPilot } from './waterpark-pilot.mjs';

await withWaterparkRuntime(async r=>{
 const {p,l,source,trace}=r,before=JSON.stringify(r.TUNING),pilot=createWaterparkPilot(source);
 assert.equal(l.halfpipes.length,7,'Seven differently sized analytic pools form the two ride sections');
 assert.ok(new Set(source.WATERPARK_POOLS.map(p=>p.radius)).size>=4,'The pools must keep their varied transition radii');
 assert.equal(new Set(source.WATERPARK_POOLS.map(p=>p.yaw)).size,2,'The two transfer lines must run in different directions');
 assert.equal(l.checkpoints.length,2,'Checkpoints belong after completed challenges');
 assert.ok(l.checkpoints[0].spawnPos.distanceTo(l.spawnPos)>150,'The first checkpoint must reward meaningful progress');
 assert.equal(l.cameraViews.length,0,'The course must use the ordinary close camera rather than fixed overview shots');
 assert.equal(l.cameraAirLift,1);
 assert.equal(source.WATERPARK_LEVEL.components.filter(c=>c.t==='gate').length,1);
 assert.equal(source.WATERPARK_LEVEL.components.filter(c=>c.t==='crystal').length,1);
 for(let i=0;i<9000&&p.state!=='finished';i++){
  r.tick(pilot.sample(p,l));pilot.observe(p,l);
  assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),`${pilot.phase}: ${JSON.stringify(r.snapshot())}`);
 }
 const e=pilot.evidence;
 assert.equal(e.transfers.length,5,'Three southbound and two eastbound spine transfers must all succeed');
 assert.deepEqual(e.transfers.map(t=>[t.from,t.to]),[[0,1],[1,2],[2,3],[4,5],[5,6]]);
 assert.equal(e.jumps.length,3,'All three major gaps must take off and land');
 for(const flight of e.jumps){
  const gap=source.WATERPARK_JUMPS[flight.index];
  const progress=(flight.end[0]-gap.landing[0])*gap.dir[0]+(flight.end[2]-gap.landing[2])*gap.dir[2];
  assert.ok(progress>=-.05,`${gap.name} must reach its authored receiving deck`);
  assert.ok(flight.peak>gap.takeoff[1]+3,`${gap.name} must make a substantial ramp air`);
 }
 assert.deepEqual(e.checkpoints,[0,1],'Both actual checkpoint crates must be banked through inputs');
 assert.ok(e.inverted&&e.finished,'The same uninterrupted run must invert, complete the loop and finish');
 assert.equal(p.loopStatus.completed,1);
 assert.ok(trace.every(t=>t.rail===null),'The main transfer route must not be hijacked by decorative grind rails');
 assert.equal(JSON.stringify(r.TUNING),before,'Movement tuning must remain unchanged');
 let biggest=0;for(let i=1;i<trace.length;i++)biggest=Math.max(biggest,Math.hypot(...trace[i].position.map((v,k)=>v-trace[i-1].position[k])));
 assert.ok(biggest<3,'The input pilot must not conceal a teleport');
 if(process.env.WATERPARK_TRACE)await writeFile(process.env.WATERPARK_TRACE,JSON.stringify({evidence:e,trace}));
 console.log(`Deadwater Park: 7 varied pools, 5 forward transfers, 3 gap landings, 2 checkpoints, full loop and finish in ${(trace.length*r.CONST.fixedStep).toFixed(2)} s; largest step ${biggest.toFixed(3)} m.`);
});

// Flow acceptance: both bends also work as continuous charged carves. Visiting
// the off-line checkpoint is optional; the route itself never forces walking.
await withWaterparkRuntime(r=>{
 const pilot=createWaterparkPilot(r.source,{fastTurns:true}),turns=new Map();
 for(let i=0;i<6000&&r.p.state!=='finished';i++){
  r.tick(pilot.sample(r.p,r.l));pilot.observe(r.p,r.l);
  assert.ok(!r.p.isBailing&&!['dead','gameover'].includes(r.p.state),`Fast line ${pilot.phase}: ${JSON.stringify(r.snapshot())}`);
  if(['concourse carve','upper carve'].includes(pilot.phase)){
   assert.ok(r.p.grounded&&r.p.freeSkate&&r.p.speed>12,'The broad turns must retain mounted, grounded skating momentum');
   turns.set(pilot.phase,(turns.get(pilot.phase)??0)+1);
  }
 }
 assert.equal(r.p.state,'finished');
 assert.equal(pilot.evidence.transfers.length,5);assert.equal(pilot.evidence.jumps.length,3);
 assert.ok(pilot.evidence.inverted&&turns.size===2&&[...turns.values()].every(n=>n>60),'Both broad bends must provide sustained real carving');
 console.log(`Deadwater Park fast line: both broad turns stay mounted above 12 m/s; complete in ${(r.trace.length*r.CONST.fixedStep).toFixed(2)} s.`);
});

// A real failed first gap returns to the authored entrance; there is no free
// checkpoint immediately in front of spawn. The later saved point gets its
// own input-only activation, pit fall and automatic respawn check.
await withWaterparkRuntime(({p,l,tick,directionInput})=>{
 let dead=false,recovered=false;
 for(let i=0;i<900;i++){
  tick(dead?{}:directionInput([0,0,1],.6));
  dead ||= p.state==='dead';
  if(dead&&p.state==='ride'&&p.grounded){recovered=true;break;}
 }
 assert.ok(dead&&recovered,`Walking into the first service well must die and automatically respawn: ${JSON.stringify({dead,recovered,p:p.pos.toArray(),state:p.state,grounded:p.grounded,ground:p.groundHit?.name})}`);
 assert.equal(l.activeCheckpoint,null,'A skipped challenge must not receive a checkpoint');
 assert.ok(p.pos.distanceTo(l.spawnPos)<.2,'Unbanked failure must return to the entrance');
},{start:[-48,12.1,-120],heading:[0,0,1]});

await withWaterparkRuntime(({p,l,tick,toward,directionInput,source})=>{
 const home=source.WATERPARK_CHECKPOINTS[0].p;
 let activated=false,dead=false,recovered=false;
 for(let i=0;i<1600;i++){
  if(!activated){
   const distance=Math.hypot(p.pos.x-home[0],p.pos.z-home[2]);
   tick({...toward(home,.5),spinHeld:distance<2.5});activated=l.checkpoints[0].active;
  }else if(!dead){
   // The first jump well is an existing nearby failure volume, reached from
   // the concourse with ordinary walking after banking the blue crate.
   tick(toward([-48,-4.2,-109],.6));dead=p.state==='dead';
  }else{
   tick({});if(p.state==='ride'&&p.grounded){recovered=true;break;}
  }
 }
 assert.ok(activated&&dead&&recovered,'Checkpoint spin, service-well fall and automatic recovery must all occur');
 assert.equal(l.activeCheckpoint,l.checkpoints[0]);
 assert.ok(p.pos.distanceTo(l.checkpoints[0].spawnPos)<.2,'Respawn must use the banked concourse checkpoint');
 console.log('Deadwater Park: no start checkpoint; service-well failure and supported checkpoint recovery passed.');
},{start:[-32,12.1,-136],heading:[0,0,-1]});
