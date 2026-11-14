import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withThemedBonusRuntime} from './test-themed-bonus-puzzles.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusJourney} from './themed-bonus-pilot.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
const out=process.env.JUNGLE_REVIEW_OUT||'/tmp/jungle-crate-review';await mkdir(out,{recursive:true});
await withThemedBonusRuntime('bonus-jungle',async r=>{
 const report={journey:runInputPilot(r,runThemedBonusJourney)},l=r.l,p=r.p;
 assert.equal(p.totalDeaths,0);assert.equal(p.cratesBroken,48);assert.equal(p.gemEarned,true);
 assert.ok(l.spinBridges.every(b=>b.activated&&b.deployed));assert.ok(l.outlinedSurfaces.every(s=>s.active));
 l.reset(true);l.update(0);
 assert.ok(l.crates.every(c=>c.alive));assert.ok(l.spinBridges.every(b=>!b.activated&&!b.deployed));assert.ok(l.outlinedSurfaces.length&&l.outlinedSurfaces.every(s=>!s.active));
 report.retry={crates:true,spinBridges:true,outlinedBridge:true};
 // Explicit staged negative: all low launch donors before the gallery have
 // already been spent. This does not claim the wooden arrow is the only
 // possible launcher if earlier timber rewards or the turtle are preserved.
 for(const c of l.crates)if(c.mesh.position.x<64&&c.box.min.y<4)l.breakCrate(c,true);
 p.respawn(l,true,false,{position:p.pos.clone().set(64.3,.7,0),heading:p.camDir.clone().set(1,0,0)});r.stepFor(25);
 const c=puzzleControls(r),key=c.crateNamed('First materialisation circuit local ! switch');
 let highest=0;
 function* attempt(){
  yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.vVel<.65,{}, {label:'spent-launcher floor jump apex',limit:100});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.grounded,()=>{highest=Math.max(highest,p.pos.y);return {...c.steer([68,8,0]),spinHeld:p.pos.y>3,jumpHeld:p.state==='hang'};},{label:'ordinary double and clamber attempt after spending launch tools',limit:240});
 }
 const pilot=attempt();let next;while(!(next=pilot.next()).done)r.tick(next.value);
 assert.ok(!key.bangUsed);assert.ok(l.outlinedSurfaces.every(s=>!s.active));assert.equal(p.totalDeaths,0);
 report.wrongOrder={fixture:'all accessible low crate donors before the key gallery consumed',keyRemainsInactive:true,bridgeRemainsAbsent:true,highestFeet:highest,deaths:p.totalDeaths};
 l.reset(true);l.update(0);assert.ok(l.crates.every(c=>c.alive));report.wrongOrder.retryRestores=true;
 await writeFile(out+'/bonus-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({journey:report.journey.result,retry:report.retry,wrongOrder:report.wrongOrder}));
},{maxFrames:12000});
