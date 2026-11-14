import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withPuzzleRuntime,runInputPilot} from './test-puzzle-trilogy.mjs';
import {runClockworkJourney,runClockworkGroundDoubleNegative} from './puzzle-clockwork-pilot.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
const out=process.env.COASTAL_REVIEW_OUT||'/tmp/coastal-crate-review';await mkdir(out,{recursive:true});
const report={};
if(!process.argv.includes('--spent-support-only')){
await withPuzzleRuntime('clockwork-gauntlet',r=>{
 report.journey=runInputPilot(r,runClockworkJourney);
 assert.equal(r.p.totalDeaths,0);assert.equal(r.p.cratesBroken,55);assert.equal(r.p.gemEarned,true);
 assert.ok(r.l.outlinedSurfaces.every(s=>s.active));
 r.l.reset(true);r.l.update(0);
 assert.ok(r.l.crates.every(c=>c.alive));assert.ok(r.l.outlinedSurfaces.every(s=>!s.active));
 assert.ok(r.l.spinBridges.every(b=>!b.activated&&!b.deployed));
 report.retry={crates:true,outlines:true,spinBridges:true};
},{maxFrames:40000});
await writeFile(out+'/bonus-validation.json',JSON.stringify(report,null,2)+'\n');
report.intakeWrongOrder=await withPuzzleRuntime('clockwork-gauntlet',r=>runInputPilot(r,runClockworkGroundDoubleNegative),{maxFrames:10000});
assert.equal(report.intakeWrongOrder.deaths,0);
}
report.spentFuseSupport=await withPuzzleRuntime('clockwork-gauntlet',r=>{
 const {p,l}=r,c=puzzleControls(r),at=c.crateSpecAt;
 // Staged negative: spend the TNT support, retain the new retreat payload,
 // then try its strongest ordinary stomp/double/air-spin toward the high cap.
 for(const box of [at(47,1.6),at(47,2.56),at(47,3.52)])if(box.alive)l.breakCrate(box,true);
 r.stepFor(65);assert.equal(p.totalDeaths,0);
 const payload=at(51,2.56),cap=c.crateNamed('Upper-first reward: preserve the high TNT support until claimed');let peak=0,spinPeak=0,bodyPeak=0;
 const capBase=cap.box.min.y;
 assert.ok(cap.alive,'setup must leave the high cap intact');
 function* attempt(){
  yield* c.walk([48.6,1.6,0],'remaining low payload approach');
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.pos.y>4.05,{}, {label:'rise beside the remaining payload',limit:100});
  yield* c.until(()=>!payload.alive&&p.vVel>12,()=>c.steer([51,3.9,0]),{label:'ordinary payload stomp',limit:180});
  yield* c.until(()=>p.vVel<.7,{}, {label:'payload rebound apex',limit:120});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.grounded,()=>{peak=Math.max(peak,p.pos.y);bodyPeak=Math.max(bodyPeak,p.crateBodyBox.max.y);if(p.spinning)spinPeak=Math.max(spinPeak,p.spinBox.max.y);return {...c.steer([47,cap.box.min.y,0]),spinHeld:p.pos.y>6};},{label:'payload double toward the stranded cap',limit:220});
 }
 runInputPilot(r,attempt);assert.ok(cap.alive,`retreat payload bypasses the spent TNT height tool: ${JSON.stringify({peak,spinPeak,bodyPeak,capBase,finalCapBase:cap.box.min.y})}`);assert.equal(p.totalDeaths,0);
 l.reset(true);l.update(0);assert.ok(l.crates.every(box=>box.alive));
 return {highCapRemains:true,capBase,peakFeet:peak,peakSpinTop:spinPeak,peakCrateBodyTop:bodyPeak,deaths:p.totalDeaths,retryRestores:true};
},{start:[42.8,1.7,0],maxFrames:4000});
await writeFile(out+'/bonus-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({journey:report.journey?.result,retry:report.retry,wrongOrder:report.intakeWrongOrder?.test,spentFuseSupport:report.spentFuseSupport}));
