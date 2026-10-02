import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withPuzzleRuntime,runInputPilot } from './test-puzzle-trilogy.mjs';
import { puzzleControls } from './puzzle-controls.mjs';
import { runClockworkGroundDoubleNegative,runClockworkGreenIsolationNegative } from './puzzle-clockwork-pilot.mjs';

function* primerOrder(r) {
  const {p,l}=r,c=puzzleControls(r),arrow=c.crateSpecAt(63,.6),key=c.crateSpecAt(72,8);
  yield* c.stepFor(20);yield* c.checkpoint(59,'bank before deliberately wrong order');
  const cp=l.activeCheckpoint;
  yield* c.hit(arrow,'wrong order: destroy launcher before high key');
  yield* c.walk([65.1,.6,0],'attempt the high shelf without its launcher');
  const firstFrame=r.frame;
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.vVel<.65,()=>c.steer([65.1,.6,0]),{label:'direct charged-jump apex',limit:90});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.grounded,()=>({...c.steer([67,.6,0]),jumpHeld:p.state==='hang'}),
    {label:'try double jump and native ledge clamber without donor support',limit:240});
  const attempts=r.trace.slice(firstFrame),peak=Math.max(...attempts.map(frame=>frame.position[1]));
  c.check(peak<5.3,'direct double jump unexpectedly reached the high key shelf');
  c.check(!attempts.some(frame=>frame.state==='hang'),'native ledge grab bypassed the missing launch');
  yield* c.walk([72,.6,0],'try the high key from its lower floor');
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.vVel<.65,{}, {label:'jump directly beneath the inaccessible key',limit:90});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.grounded,{jumpHeld:p.state==='hang'},
    {label:'direct underside attempt cannot activate the high switch',limit:240});
  c.check(!key.bangUsed,'wrong early spin can still activate the key from below');
  r.report.evidence.push({action:'incorrect order remains incomplete',peak,launcherAlive:arrow.alive,keyUsed:key.bangUsed,
    ledgeCaught:false,upperBoxesAlive:[c.crateSpecAt(67,8).alive,c.crateSpecAt(69,8).alive]});
  yield* c.walk([56.9,.6,0],'return to the physical retry gap');
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.state==='dead',()=>c.steer([55,.6,0]),
    {label:'jump into the real retry gap',limit:900,allowDeath:true});
  yield* c.until(()=>p.grounded&&p.state==='ride',{},
    {label:'wait for automatic checkpoint restoration',limit:600,allowDeath:true});
  c.check(l.activeCheckpoint===cp&&Math.abs(p.pos.x-59)<.3,'real death did not respawn at banked checkpoint');
  c.check(arrow.alive&&!key.bangUsed,'checkpoint failed to restore the destroyed donor and unused key');
  c.check(p.totalDeaths===1,'retry proof should contain exactly one real death');
  r.report.evidence.push({action:'checkpoint restores failed dependency',deaths:p.totalDeaths,position:p.pos.toArray(),launcherAlive:arrow.alive});
  yield* c.bounce(arrow,[68,8,0],'correct order: reach upper with intact launch',{double:true,airSpinAbove:6.8});
  for(const x of [67,69])if(c.crateSpecAt(x,8).alive)yield* c.hit(c.crateSpecAt(x,8),`correct upper box ${x}`);
  yield* c.hit(key,'correct upper key activation');
  yield* c.walk([66.4,8,0],'correct upper-room return');
  yield* c.hop([60.6,.6,0],'return before removing used launch');
  yield* c.hit(arrow,'correct order: launch support last');
  yield* c.walk([90,.6,0],'cross the actual materialized bridge');
  c.check(key.bangUsed&&!arrow.alive&&!c.crateSpecAt(67,8).alive&&!c.crateSpecAt(69,8).alive,
    'correct order did not clear every breakable room box');
  c.check(p.grounded&&p.totalDeaths===1,'correct-order continuation hid another reset');
  return {test:'failed early spin, native-jump bypass rejected, physical retry, complete ordered room',deaths:p.totalDeaths,peak};
}
const result=await withPuzzleRuntime('crate-primer',async r=>{
  try{return runInputPilot(r,primerOrder);}
  finally{await writeFile('/private/tmp/puzzle-order-physics.json',JSON.stringify({report:r.report,trace:r.trace},null,2));}
},{start:[57.4,.65,0],endlessDeaths:true,maxFrames:12000});
assert.equal(result.deaths,1);
console.log(JSON.stringify({test:result.test,frames:result.frames,deaths:result.deaths,peak:result.peak}));
console.log('PASS wrong-order failure, native-ledge bypass rejection, real death/checkpoint repair, and all-box correct-order solution');
function* primerCapNegative(r) {
  const c=puzzleControls(r),{p}=r;
  const launcher=c.crateSpecAt(35,.6),cap=c.crateNamed('Upper box: collect before destroying its wooden arrow');
  yield* c.stepFor(20);yield* c.hit(launcher,'wrong order: destroy first upper-reward launcher');
  yield* c.walk([35,.6,0],'stand below the lost upper-reward route');
  const attempts=[];
  for(const timing of [7,3,.5,-1.5]) {
    yield* c.charge();yield* c.tick({jumpReleased:true});
    yield* c.until(()=>p.vVel<=timing,{}, {label:`ordinary double-jump timing ${timing}`,limit:100});
    yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
    let peak=p.pos.y;
    yield* c.until(()=>p.grounded,()=>{peak=Math.max(peak,p.pos.y);return {spinHeld:p.pos.y>3.8};},
      {label:`try real crown and air spin after losing the arrow at timing ${timing}`,limit:180});
    c.check(cap.alive,'ordinary double jump/air spin bypassed the first lost launcher');
    attempts.push({timing,peakFeet:peak,capAlive:cap.alive});yield* c.stepFor(25);
  }
  return {test:'Primer upper-reward donor loss blocks ordinary double and air-spin collection',capAlive:cap.alive,
    launcherAlive:launcher.alive,deaths:p.totalDeaths,attempts};
}
const capNegative=await withPuzzleRuntime('crate-primer',async r=>{
  try{return runInputPilot(r,primerCapNegative);}
  finally{await writeFile('/private/tmp/primer-cap-negative.json',JSON.stringify({report:r.report,trace:r.trace},null,2));}
},{start:[32.8,.65,0],endlessDeaths:true,maxFrames:5000});
assert.equal(capNegative.capAlive,true);assert.equal(capNegative.deaths,0);
console.log(JSON.stringify({test:capNegative.test,capAlive:capNegative.capAlive,frames:capNegative.frames,deaths:capNegative.deaths}));
for(const [name,pilot] of [['ground-double',runClockworkGroundDoubleNegative],['green-isolation',runClockworkGreenIsolationNegative]]) {
  const report=await withPuzzleRuntime('clockwork-gauntlet',async r=>{
    try{return runInputPilot(r,pilot);}
    finally{await writeFile(`/private/tmp/puzzle-clockwork-${name}-negative.json`,JSON.stringify({report:r.report,trace:r.trace},null,2));}
  },{maxFrames:20000});
  console.log(JSON.stringify({test:report.test,frames:report.frames,deaths:report.deaths,
    capAlive:report.capAlive,farSwitchUsed:report.farSwitchUsed,nitroRemaining:report.nitroRemaining}));
}
console.log('PASS Clockwork donor-loss and independent green/far-switch dependency evidence');
