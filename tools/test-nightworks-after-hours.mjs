import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withAfterHoursRuntime} from './nightworks-runner.mjs';
import {createAfterHoursPilot} from './nightworks-pilot.mjs';
import {assertAfterHoursMountedEvidence} from './test-nightworks-challenge-structure.mjs';

await withAfterHoursRuntime(async r=>{
 const before=JSON.stringify(r.TUNING),pilot=createAfterHoursPilot(r.source,{tuning:r.TUNING,fixedStep:r.CONST.fixedStep});
 for(let frame=0;frame<18000&&!pilot.evidence.finished;frame++){
  r.tick(pilot.sample(r.p,r.l));pilot.observe(r.p,r.l);
  assert.ok(!r.l.runMode&&!r.l.timeTrial,'the normal wheel line cannot accidentally start the stopwatch');
  if(r.p.isBailing||['dead','gameover'].includes(r.p.state))break;
 }
 const report={...pilot.evidence,trace:r.trace,end:r.snapshot()};
 if(process.env.AFTER_HOURS_TRACE)await writeFile(process.env.AFTER_HOURS_TRACE,JSON.stringify(report));
 assert.equal(r.p.state,'finished',JSON.stringify({chapters:report.chapters,current:pilot.helper.evidence,end:report.end}));
 assertAfterHoursMountedEvidence(report,r.source.AFTER_HOURS_STAGES,r.source.NIGHTWORKS_AFTER_HOURS_LEVEL.components);
 assert.equal(JSON.stringify(r.TUNING),before,'retain authored movement');
 assert.ok(report.checkpoints.length>=4,'bank real checkpoints during the joined course');
 console.log(`PASS complete After Hours: ${r.trace.length*r.CONST.fixedStep}s, eight required chapters, actual moving/phase/grind contacts, all-board normal-mode finish.`);
});

// Negative controls challenge the old design directly: accelerating, homing
// toward the gate, or repeating maximum-charge jumps must not clear the course.
for(const strategy of ['forward','gate-homing','automatic-ollies','homing-ollies'])await withAfterHoursRuntime(r=>{
 for(let frame=0;frame<6000&&!r.p.isBailing&&!['dead','gameover','finished'].includes(r.p.state);frame++){
  const direction=strategy.includes('homing')?r.toward(r.source.AFTER_HOURS_FINISH):{moveX:0,moveY:1};
  const jumpHeld=strategy.includes('ollies')?frame%65!==64:true;
  r.tick({...direction,jumpHeld});
 }
 assert.notEqual(r.p.state,'finished',`${strategy} must not bypass authored challenges`);
 assert.ok(r.p.isBailing||['dead','gameover','hang'].includes(r.p.state)||r.trace.at(-1).position[2]>-150,'a bypass attempt encounters the physical challenge');
 console.log(`PASS rejected ${strategy} bypass at ${r.p.pos.toArray().map(v=>v.toFixed(1)).join(', ')} (${r.p.state}).`);
});

await withAfterHoursRuntime(async r=>{
 const {normalizeCustomLevelData,worldMapComponentPoints}=await r.server.ssrLoadModule('/src/level.ts');
 const {validateCampaignMapGraph}=await r.server.ssrLoadModule('/src/campaign.ts');
 assert.deepEqual(validateCampaignMapGraph(),[]);
 const old=worldMapComponentPoints().slice(0,15),map=pts=>({v:1,name:'Saved map',spawn:[0,.1,0],killY:-30,components:[{t:'worldmap',p:[0,0,0],pts}]});
 assert.equal(normalizeCustomLevelData(map(old)).components.find(c=>c.t==='worldmap').pts.length,worldMapComponentPoints().length);
 old[0][0]+=.25;const custom=normalizeCustomLevelData(map(old));assert.ok(custom);
 assert.deepEqual(custom.components.find(c=>c.t==='worldmap').pts,old,'preserve custom saved hub coordinates');
 console.log('PASS legacy map import, custom coordinate preservation and unchanged sequel identity.');
});
