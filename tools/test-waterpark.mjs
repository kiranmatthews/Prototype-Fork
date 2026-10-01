import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withWaterparkRuntime } from './waterpark-runner.mjs';
import { createWaterparkPilot } from './waterpark-pilot.mjs';

for(const fastLine of [false,true])await withWaterparkRuntime(async r=>{
 const {p,l,source,trace}=r,before=JSON.stringify(r.TUNING);
 const pilot=createWaterparkPilot(source,{fastLine,releaseDistance:fastLine?.5:1.4});
 assert.equal(l.halfpipes.length,7,'Seven differently sized analytic pools must remain');
 assert.ok(new Set(source.WATERPARK_POOLS.map(pool=>pool.radius)).size>=4);
 assert.ok(source.WATERPARK_POOLS.every(pool=>pool.yaw===90&&pool.dir[0]===0&&pool.dir[2]===-1),'Every main-route pool must progress forward down the same line');
 for(const [from,to]of [[0,1],[1,2],[2,3],[4,5],[5,6]]){
  const a=source.WATERPARK_POOLS[from],b=source.WATERPARK_POOLS[to];
  assert.equal(a.farLip,b.nearLip,'Adjacent spine lips must share the exact forward station');
  assert.equal(a.lipY-b.lipY,2,'Each receiving spine pool must step downhill two metres');
 }
 assert.equal(source.WATERPARK_LEVEL.spawn[1],80.15);
 assert.equal(source.WATERPARK_FINISH[1],-165);
 assert.equal(source.WATERPARK_LEVEL.components.filter(c=>c.t==='speedpad').length,0,'Every approach must earn speed from the ramps; no boost pads');
 assert.equal(l.checkpoints.length,2);
 assert.ok(l.checkpoints[0].spawnPos.distanceTo(l.spawnPos)>200,'The first checkpoint must follow the upper ride and its vault');
 assert.equal(l.cameraViews.length,0);
 assert.equal(l.cameraAirLift,1);
 assert.equal(source.WATERPARK_LEVEL.components.filter(c=>c.t==='gate').length,1);
 assert.equal(source.WATERPARK_LEVEL.components.filter(c=>c.t==='crystal').length,1);
 for(let i=0;i<8000&&p.state!=='finished';i++){
  r.tick(pilot.sample(p,l));pilot.observe(p,l);
  assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),`${pilot.phase}: ${JSON.stringify(r.snapshot())}`);
 }
 const e=pilot.evidence;
 assert.deepEqual(e.transfers.map(t=>[t.from,t.to]),[[0,1],[1,2],[2,3],[4,5],[5,6]],'All five forward downhill spine transfers must succeed');
 assert.equal(e.jumps.length,4);
 for(const flight of e.jumps){
  const gap=source.WATERPARK_JUMPS[flight.index];
  assert.ok(flight.end[2]<=gap.landing[2]+.05,`${gap.name} must reach its receiving deck`);
  assert.ok(flight.peak>gap.takeoff[1]+(flight.index===3?1:3),`${gap.name} must make a substantial earned air`);
 }
 assert.deepEqual(e.checkpoints,fastLine?[1]:[0,1]);
 assert.equal(e.backwardInputs,0,'The downhill route must never request reversing or a turn back uphill');
 assert.equal(Object.keys(e.downhills).length,4);
 for(const slope of source.WATERPARK_DOWNHILL){
  const run=e.downhills[slope.name];
  assert.ok(run.frames>50&&run.mounted&&run.minSpeed>12,`${slope.name} must retain continuous supported skating`);
  assert.ok(run.entry[1]-run.exit[1]>(slope.from[1]-slope.to[1])*.9,`${slope.name} must actually descend its authored height`);
 }
 assert.ok(e.inverted&&e.finished);
 assert.equal(p.loopStatus.completed,3);
 assert.deepEqual(e.inversions,[0,1,2]);
 assert.equal(e.loopEntries.length,3);
 assert.ok(e.loopEntries.every(entry=>entry.speed>54),'Each real entry must carry enough ramp-earned momentum');
 assert.equal(Object.keys(e.coasterRamps).length,4);
 assert.ok(trace.every(t=>t.rail===null));
 assert.equal(JSON.stringify(r.TUNING),before);
 let biggest=0,worstStep=null;
 for(let i=1;i<trace.length;i++){
  const step=Math.hypot(...trace[i].position.map((v,k)=>v-trace[i-1].position[k]));
  if(step>biggest){biggest=step;worstStep={before:trace[i-1],after:trace[i]};}
 }
 assert.ok(biggest<3,`Unexpected large physics step ${biggest}: ${JSON.stringify(worstStep)}`);
 if(process.env.WATERPARK_TRACE)await writeFile(`${process.env.WATERPARK_TRACE}${fastLine?'.late':''}`,JSON.stringify({evidence:e,trace}));
 console.log(`Downhill Deadwater ${fastLine?'late-release line':'checkpoint line'}: 5 downhill spines, 4 gravity jumps and triple loop; ${(trace.length*r.CONST.fixedStep).toFixed(2)} s, largest step ${biggest.toFixed(3)} m.`);
});

await withWaterparkRuntime(({p,l,tick,directionInput})=>{
 let dead=false,recovered=false;
 for(let i=0;i<900;i++){
  tick(dead?{}:directionInput([0,0,1],.6));
  dead ||= p.state==='dead';
  if(dead&&p.state==='ride'&&p.grounded){recovered=true;break;}
 }
 assert.ok(dead&&recovered,`A missed upper vault must die and recover: ${JSON.stringify({dead,recovered,p:p.pos.toArray(),state:p.state})}`);
 assert.equal(l.activeCheckpoint,null);
 assert.ok(p.pos.distanceTo(l.spawnPos)<.2);
},{start:[0,48.1,-162],heading:[0,0,1]});

await withWaterparkRuntime(({p,l,tick,toward,source})=>{
 const home=source.WATERPARK_CHECKPOINTS[0].p;
 const well=source.WATERPARK_LEVEL.components.find(c=>c.t==='pit'&&c.nm==='Flooded downhill maintenance well');
 assert.ok(well,'The authored first missed-vault well must exist');
 let activated=false,dead=false,recovered=false;
 for(let i=0;i<1600;i++){
  if(!activated){
   const distance=Math.hypot(p.pos.x-home[0],p.pos.z-home[2]);
   tick({...toward(home,.5),spinHeld:distance<2.5});activated=l.checkpoints[0].active;
  }else if(!dead){tick(toward(well.p,.6));dead=p.state==='dead';}
  else{tick({});if(p.state==='ride'&&p.grounded){recovered=true;break;}}
 }
 assert.ok(activated&&dead&&recovered,'Checkpoint activation, service-well fall and automatic recovery must all occur');
 assert.equal(l.activeCheckpoint,l.checkpoints[0]);
 assert.ok(p.pos.distanceTo(l.checkpoints[0].spawnPos)<.2);
 console.log('Downhill Deadwater: no start checkpoint; real upper-vault failure and checkpoint recovery passed.');
},{start:[-4,48.1,-172],heading:[0,0,-1]});
