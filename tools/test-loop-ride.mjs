import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { withWaterparkRuntime } from './waterpark-runner.mjs';

const scenarios=[];
const scenario=(run,options={})=>scenarios.push({run,options});

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { stepLoopMotion, loopContactPressure, sampleLoop, createLoopMeshData, LOOP_TURN } =
    await server.ssrLoadModule('/src/loopRide.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const shape = { radius: 26, width: 12, offset: 20 };
  const forces = { gravity: TUNING.groundGravity, pump: TUNING.pipePumpGain + TUNING.chargeBoost,
    friction: TUNING.pipeFriction, drag: TUNING.windDrag, braking: TUNING.turnaround };
  const travel = (speed, charge, dt = 1 / 120) => {
    let motion = { angle: 0, speed }, minSpeed = speed;
    for (let i = 0; i < 15 / dt; i++) {
      motion = stepLoopMotion(shape, motion, dt, charge, false, forces);
      minSpeed = Math.min(minSpeed, motion.speed);
      if (!motion.attached || motion.complete) return { ...motion, minSpeed };
    }
    throw new Error('Loop simulation never resolved');
  };
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const held = travel(64, 1, dt);
    assert.equal(held.complete, true, 'A charged gravity approach must complete the loop');
    assert.ok(held.minSpeed > 34, 'Successful run kept enough speed through the crown');
    const coast = travel(64, 0, dt);
    assert.equal(coast.attached, false, 'Uncharged launch must lose inward wheel pressure');
    assert.ok(coast.angle > Math.PI / 2 && coast.angle < Math.PI, 'Failure must detach on the inverted climb');
  }
  assert.equal(travel(24, 1).attached, false, 'Charge cannot glue a slow rider to the ceiling');
  assert.equal(travel(90, 0).complete, true, 'Sufficient real momentum can coast through without a charge gate');
  assert.ok(loopContactPressure(shape, Math.PI, 20, 45) < 0);
  assert.ok(loopContactPressure(shape, Math.PI, 40, 45) > 0);
  assert.deepEqual(sampleLoop(shape, 0).point, [0, 0, -0]);
  const exit = sampleLoop(shape, LOOP_TURN).point;
  assert.ok(Math.abs(exit[0] - 20) < 1e-9 && Math.abs(exit[1]) < 1e-9 && Math.abs(exit[2]) < 1e-9);
  const mesh = createLoopMeshData(26, 12, 20);
  assert.equal(mesh.vertices.length, mesh.normals.length);
  assert.equal(mesh.indices.length, 160 * 6);
  // Inward winding matters: front-side raycasts must see the riding face.
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [ia, ib, ic] = mesh.indices.slice(i, i + 3).map(v => v * 3);
    const a = mesh.vertices.slice(ia, ia + 3), b = mesh.vertices.slice(ib, ib + 3), c = mesh.vertices.slice(ic, ic + 3);
    const u = b.map((v, j) => v - a[j]), v = c.map((x, j) => x - a[j]);
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    assert.ok(n.reduce((dot, x, j) => dot + x * mesh.normals[ia + j], 0) > 0);
  }
} finally { await server.close(); }

scenario(async r => {
  const {p,l,source,server,THREE}=r;
  const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
  const captured=l.captureData(),roundtrip=parseCustomLevelJson(JSON.stringify(captured));
  assert.ok(roundtrip,'Coaster geometry and momentum tags must survive editor serialization');
  const loops=roundtrip.components.filter(c=>c.loopRadius!==undefined);
  assert.equal(loops.length,3);assert.ok(loops.every(c=>c.loopRequired&&c.loopRadius===26));
  assert.equal(roundtrip.components.filter(c=>c.t==='speedpad').length,0);
  const tracks=roundtrip.components.filter(c=>c.gravityTrack);
  assert.ok(tracks.length>=14&&tracks.every(c=>c.t==='mesh'||c.t==='vertramp'));
  assert.ok(tracks.some(c=>c.vert===true),'The giant vert must retain its earned drop speed');
  for(const mutation of [{gravityTrack:'yes'},{solid:false}]){
    const invalid=structuredClone(captured);Object.assign(invalid.components.find(c=>c.gravityTrack),mutation);
    assert.equal(parseCustomLevelJson(JSON.stringify(invalid)),null);
  }
  for(const mutation of [{loopRadius:0},{loopRadius:81},{loopOffset:'20'},{loopRequired:1},{s:[2,1,1]},{solid:false},{vert:true}]){
    const invalid=structuredClone(captured);Object.assign(invalid.components.find(c=>c.loopRadius),mutation);
    assert.equal(parseCustomLevelJson(JSON.stringify(invalid)),null);
  }
  // Start from rest at every ramp's lower end and skate back to its summit.
  for(const run of source.WATERPARK_COASTER_RAMPS){
    p.respawn(l,true,false,{position:new THREE.Vector3(run.to[0],run.to[1]+.1,run.to[2]+1),heading:new THREE.Vector3(0,0,1)});
    let climbed=false;
    for(let i=0;i<2400;i++){
      r.tick({...r.directionInput([0,0,1]),jumpHeld:true});
      assert.ok(!p.isBailing&&p.totalDeaths===0,`${run.name} could not be re-climbed`);
      if(p.pos.z>=run.from[2]-.5&&p.pos.y>=run.from[1]-.5){climbed=true;break;}
    }
    assert.ok(climbed,`${run.name} has a one-way or blocked return`);
  }
  // The tag does not drive the rider. Removing gravity removes the gain.
  const gravity=r.TUNING.groundGravity;
  try{
    r.TUNING.groundGravity=0;
    p.respawn(l,true,false,{position:new THREE.Vector3(0,12.1,-570),heading:new THREE.Vector3(0,0,-1)});
    let reached=false;
    for(let i=0;i<1800;i++){
      r.tick({...r.directionInput([0,0,-1]),jumpHeld:true});
      assert.ok(p.speed<=r.TUNING.maxSpeed+.01,'Gravity-track tag injected artificial launch speed');
      if(p.pos.z<-658){reached=true;break;}
    }
    assert.ok(reached);
  }finally{r.TUNING.groundGravity=gravity;}
  console.log('Triple loop metadata, no-pad gravity gain and all four reverse ramp climbs pass.');
});

scenario(r=>{
  const {p}=r;let entered=false,fell=false;
  for(let i=0;i<1000;i++){
    r.tick({...(p.loopStatus.active?{moveY:1}:r.directionInput([0,0,-1])),jumpHeld:!entered});
    entered ||= p.loopStatus.active;
    if(entered&&p.state==='air'&&!p.loopStatus.active){fell=true;break;}
  }
  assert.ok(entered&&fell,'Releasing charge must lose real inward wheel pressure');
  assert.equal(p.loopStatus.completed,0);
  let recovered=false;
  for(let i=0;i<1200;i++){
    r.tick({});assert.equal(p.loopStatus.completed,0,'Falling onto a ribbon cannot grant completion');
    if(p.state==='dead'||!p.loopStatus.active&&p.grounded&&!p.isBailing){recovered=true;break;}
  }
  assert.ok(recovered,'A failed loop must resolve on real ground or a lower ride');
},{start:[0,12.1,-570],heading:[0,0,-1]});


scenario(({p,tick,directionInput,l})=>{
  let blocked=false;p.onCourseHint=title=>{blocked ||= title==='LOOP STILL CLOSED';};
  // Even two completed turns do not open the final gate.
  p.completedLoops.add(l.loopMeshes[0]);p.completedLoops.add(l.loopMeshes[1]);
  for(let i=0;i<100;i++){
    tick({...directionInput([0,0,-1]),jumpHeld:true});
    assert.notEqual(p.state,'finished','Two-loop shortcut bypassed the third required inversion');
  }
  assert.ok(blocked);
  p.respawn(l,false);assert.equal(p.loopStatus.completed,0,'Respawn resets the triple-loop goal');
},{start:[60,-164.9,-1052],heading:[0,0,-1]});
scenario(r=>{
  const {p,l}=r;p.completedLoops.add(l.loopMeshes[0]);p.completedLoops.add(l.loopMeshes[1]);let entry=null;
  for(let i=0;i<1400&&p.state!=='finished';i++){
    r.tick({...(p.loopStatus.active?{moveY:1}:r.toward(p.loopStatus.completed<3?r.source.WATERPARK_LOOPS[2].entry:r.source.WATERPARK_FINISH)),jumpHeld:true});
    if(p.loopStatus.active&&entry===null)entry=p.speed;
    assert.ok(!p.isBailing&&p.totalDeaths===0);
  }
  assert.equal(p.state,'finished');assert.ok(entry>54,'Final ramp must rebuild loop speed from a stationary retry');
},{start:[40,-99.9,-914],heading:[0,0,-1]});

// Reuse one production scene/SSR runtime while resetting each independent
// fixture. Repeated full waterpark imports retain unnecessary module graphs.
await withWaterparkRuntime(async r=>{
  for(const {run,options}of scenarios){
    r.p.respawn(r.l,true,false,options.start?{position:new r.THREE.Vector3(...options.start),heading:new r.THREE.Vector3(...(options.heading??[0,0,-1]))}:undefined);
    await run(r);
  }
});
console.log('Triple loop: pressure, real fall, required turns, stationary retry and respawn checks passed.');
