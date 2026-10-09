import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { skateRoofWedges } from './blockworks-skate-pilot.mjs';

// Complete source world, real input, authored spawn: no resets, warps, velocity
// changes, direct switch activation, or rotation into easier local axes.
const station = p => 20 - p.pos.z;
const round = n => Math.round(n * 1000) / 1000;
function record(r, name, recordings) {
  recordings.push({ name, level: 'codex-switchback', fixedStep: r.dt,
    sourceSha256: createHash('sha256').update(JSON.stringify(r.source)).digest('hex'),
    tuning: structuredClone(r.TUNING), frames: r.trace, actions: r.actions });
}

/** Continue the supplied live player from the authored spawn through s510. */
export function runOpeningAndTerrace(r) {
    const evidence = [];
    const { p, l } = r;
    const { routePoint, BLOCKWORKS_CLIMBS } = r.sourceModule;
    const at = (s, y = 0, u = 0) => routePoint(s, y, u);
    const progress = () => station(p);
    const entryOffset = s => s > 32 && s < 66 ? 3.2 * Math.sin(Math.PI * (s - 32) / 34)
      : s > 112 && s < 145 ? 2.2 * Math.sin(Math.PI * (s - 112) / 33) : 0;
    r.skateAlong(s => at(s, 0, entryOffset(s)), { to: 164.7, progress, lookAhead: 9,
      label: 'charge and carve from the authored spawn' });
    const takeoff = r.snapshot();
    assert.ok(p.grounded && p.freeSkate && p.speed > 21, `entry approach lost momentum: ${JSON.stringify(takeoff)}`);
    r.releaseJump(r.steerToward(at(185, -2.4)));
    assert.equal(p.state, 'air', 'charged gap release did not launch');
    r.until(() => p.grounded, () => r.steerToward(at(185, -2.4)),
      { maxFrames: 120, label: 'cross first 10.8m gap' });
    const landing = r.snapshot();
    assert.ok(progress() >= 176.8 && Math.abs(p.pos.y + 2.4) < .1,
      `gap did not land on its far deck: ${JSON.stringify(landing)}`);
    // Coasting leaves the released charge alone while carrying the landing
    // directly through the next curve and into the foot-climb approach.
    r.skateAlong(s => at(s, -2.4), { to: 244, progress, lookAhead: 9, charge: false,
      label: 'carry the gap landing directly into Terrace canyon' });
    const roadRun = r.trace.filter(row => 20-row.position[2] > 35 && 20-row.position[2] < 235 && row.grounded && row.speed > 10);
    const headings = roadRun.map(row => Math.atan2(row.heading[0], -row.heading[2]) * 180 / Math.PI);
    const steering = r.trace.filter(row => row.frame <= landing.frame && Math.abs(row.input.moveX) > .08).length;
    assert.ok(Math.max(...headings) - Math.min(...headings) > 25, 'physical heading never followed both sides of the bend');
    evidence.push({ test: 'continuous entry carving and charged gap', takeoffStation: round(20-takeoff.position[2]),
      takeoffSpeed: round(takeoff.speed), landingStation: round(20-landing.position[2]),
      lateralInputFrames: steering, headingSweepDegrees: round(Math.max(...headings)-Math.min(...headings)) });

    r.until(() => !p.freeSkate && Math.abs(p.speed) < .1, { grabHeld: true },
      { maxFrames: 240, label: 'brake on the canyon approach' });
    r.stepFor(45, {});
    const climb = BLOCKWORKS_CLIMBS.find(c => c.name === 'Courtyard roof bays');
    assert.ok(climb, 'source terrace traversal metadata is missing');
    const roofRun = skateRoofWedges(r, climb.name);
    assert.ok(Math.abs(p.pos.y-7.2)<.1, 'roof sequence did not reach the high curved road');

    // Ride the entire return curve and leave its authored endpoint naturally.
    // Held charge stays held; the pilot never manufactures a rail-exit ollie.
    let railBrake=false;
    r.until(() => p.state === 'grind', () => {
      if(p.speed>12)railBrake=true;else if(p.speed<9)railBrake=false;
      return {...r.steerToward(at(Math.min(374,progress()+5),7.2,2.8)),
        jumpHeld:true,grindHeld:true,grabHeld:railBrake};
    }, { maxFrames: 900, label: 'mount and catch the curved outer parapet' });
    const railEntry = r.snapshot();
    r.grindUntil(() => p.state !== 'grind', { buttons:{jumpHeld:true}, maxFrames:1800,
      label:'balance through the parapet return and natural rail end' });
    const railExit=r.snapshot();
    assert.ok(p.state==='air' && progress()>=415.5 && p.vVel<=3,
      'parapet did not produce its ordinary endpoint exit');
    assert.ok(r.trace.slice(railEntry.frame,railExit.frame).every(row=>!row.input.jumpReleased),
      'parapet exit used an artificial release-to-jump');
    r.until(() => p.grounded, () => ({...r.steerToward(at(progress()+1,7.2,2.4)),jumpHeld:true}),
      { maxFrames:180,label:'natural parapet exit lands on the roof'});
    assert.ok(progress()>416 && Math.abs(p.pos.y-7.2)<.1,'natural parapet exit missed the roof');
    const railLanding=r.snapshot();
    const firstCheckpoint=r.sourceModule.BLOCKWORKS_CHECKPOINTS.find(cp=>cp.s===422);
    assert.ok(firstCheckpoint,'the first checkpoint metadata is missing');
    r.until(()=>l.checkpoints[0].active,()=>({
      ...r.steerToward(firstCheckpoint.p,{pace:.6}),jumpHeld:true,
      spinHeld:r.distanceTo(firstCheckpoint.p)<4&&(p.spinning||!r.lastInput.spinHeld),
    }),{maxFrames:600,label:'carve to and spin the actual roof checkpoint'});
    r.skateAlong(s=>at(s,0), {to:510,progress,lookAhead:9,label:'spend roof height through the descending curve'});
    assert.equal(p.totalDeaths,0,'positive run respawned between districts');
    assert.ok(l.checkpoints[0].active,'positive run never activated the first checkpoint');
    assert.ok(p.grounded && progress()>=510,'positive run did not complete both adjacent districts');
    assert.ok(r.trace.every(row=>!row.bailing && row.state!=='dead'),'positive run hid a bail or death');
    evidence.push({test:'continuous Terrace wedge climb and parapet',roofRun,
      railEntryStation:round(20-railEntry.position[2]),naturalRailExitStation:round(20-railExit.position[2]),
      naturalRailLandingStation:round(20-railLanding.position[2]),endStation:round(progress()),
      endSpeed:round(p.speed),frames:r.frame,
      checkpoints:l.checkpoints.filter(cp=>cp.active).length});
    return evidence;
}

/** Continue the same board and clock through Frozen, banking its s750 checkpoint. */
export function runFrozen(r) {
  const {p,sourceModule:m}=r,begin=r.frame,entry=r.snapshot();
  const progress=()=>station(p);
  assert.ok(progress()>=510 && progress()<515 && p.grounded && p.freeSkate,
    'Frozen must inherit the live Terrace exit');
  assert.ok(p.speed>24,'Terrace must deliver its earned downhill speed into Frozen');
  const steer=()=>r.steerToward(m.routePoint(progress()+14,0));
  r.until(()=>progress()>=723.2,()=>({...steer(),jumpHeld:true}),
    {maxFrames:1800,label:'carry Terrace momentum through all three frozen bends'});
  const takeoff=r.snapshot();
  assert.ok(p.grounded && p.freeSkate && p.speed>21.5,'ice approach lost its real launch speed');
  r.releaseJump(steer());
  assert.equal(p.state,'air','Frozen charged release did not launch');
  r.until(()=>p.grounded,()=>({...steer(),jumpHeld:false}),
    {maxFrames:120,label:'cross Frozen gap with inherited run state'});
  const landing=r.snapshot(),gap=m.BLOCKWORKS_GAPS.find(g=>g.a===724);
  assert.ok(progress()>=gap.b && Math.abs(p.pos.y)<.1,'Frozen gap missed its receiving deck');
  const checkpointData=m.BLOCKWORKS_CHECKPOINTS.find(cp=>cp.s===750);
  assert.ok(checkpointData,'Frozen checkpoint metadata is missing');
  const checkpoint=r.l.checkpoints.find(cp=>Math.hypot(cp.spawnPos.x-checkpointData.p[0],cp.spawnPos.z-checkpointData.p[2])<.05);
  assert.ok(checkpoint,'Frozen checkpoint has no live runtime object');
  r.until(()=>checkpoint.active && progress()>=751,()=>({
    ...r.steerToward(checkpoint.active?m.routePoint(progress()+10,0,2.4):checkpointData.p),
    jumpHeld:true,spinHeld:r.distanceTo(checkpointData.p)<4,
  }), {maxFrames:180,label:'carve onto the receiving deck and bank checkpoint750'});
  assert.equal(r.l.activeCheckpoint,checkpoint,'Frozen did not bank its actual checkpoint');
  const frames=r.trace.slice(begin);
  const patches=[[575,599],[635,660],[687,714]].map(([a,b])=>{
    const samples=frames.filter(row=>20-row.position[2]>=a+.5 && 20-row.position[2]<=b-.5);
    assert.ok(samples.length>30,`ice patch ${a} lacked sustained contact`);
    assert.ok(samples.every(row=>row.grounded && row.ground?.slippy && row.ground.iceGrip===.08),
      `ice patch ${a} was bypassed or lost the authored grip`);
    const entered=samples[0].speed,minimum=Math.min(...samples.map(row=>row.speed));
    assert.ok(entered>21.5 && minimum>20,`ice patch ${a} lost momentum`);
    const maxOffset=Math.max(...samples.map(row=>Math.abs(row.position[0]-m.routeX(20-row.position[2]))));
    assert.ok(maxOffset<4.5,`ice patch ${a} exceeded its physical ribbon`);
    return {a,b,frames:samples.length,entrySpeed:round(entered),minimumSpeed:round(minimum),maxWorldXOffset:round(maxOffset)};
  });
  assert.ok(Math.abs(patches[0].entrySpeed-23)<.1,'first ice did not receive normal full skating speed');
  const minimumContinuousSpeed=Math.min(...frames.map(row=>row.speed));
  assert.ok(minimumContinuousSpeed>=r.TUNING.cruiseSpeed-.1,
    'continuous Terrace-to-Frozen traversal hid a stop or lost cruise speed');
  assert.ok(frames.every(row=>!row.bailing && row.state!=='dead'),'Frozen hid a bail or respawn');
  assert.equal(p.totalDeaths,0);
  return {test:'continuous Terrace-to-Frozen momentum and gap',entrySpeed:round(entry.speed),patches,
    takeoffSpeed:round(takeoff.speed),landingStation:round(20-landing.position[2]),
    exitStation:round(progress()),exitSpeed:round(p.speed),minimumContinuousSpeed:round(minimumContinuousSpeed),
    checkpointStation:750,checkpointBanked:checkpoint.active,seconds:round((r.frame-begin)*r.dt)};
}

export async function runBlockworksGameplayChecks() {
  const evidence=[],recordings=[];
  const tracePath=process.env.BLOCKWORKS_TRACE??'/tmp/blockworks-gameplay-trace.json';
  let failure;
  try {
    await withBlockworksRuntime(r=>{
      record(r,'continuous spawn through Terrace and Frozen',recordings);
      evidence.push(...runOpeningAndTerrace(r));
      evidence.push(runFrozen(r));
    },{maxFrames:24_000});
  } catch(error) { failure=error; }
  finally { await writeFile(tracePath,JSON.stringify({evidence,recordings},null,2)); }
  console.log(JSON.stringify({evidence,tracePath},null,2));
  if(failure)throw failure;
  console.log('PASS continuous world-space spawn→750 carving, roof climb, inherited ice momentum and gaps; aligned camera nodes');
  return evidence;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  await runBlockworksGameplayChecks();
