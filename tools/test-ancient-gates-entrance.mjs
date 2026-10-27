import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {approachAncientHoard} from './ancient-gates-entrance-pilot.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
const output=process.env.ANCIENT_GATES_OUTPUT||'/private/tmp/ancient-gates-native';await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 r.report={stage:'start',actions:[],evidence:[],bonusEntries:0};
 const run=gen=>{let next=gen.next();while(!next.done){r.tick(next.value);next=gen.next();}return next.value;};
 const c=puzzleControls(r),start=r.p.captureRunState();
 try{
  run(c.stepFor(20));run(c.walk([1137,8,0],'ordinary main route bypass'));
  assert.equal(r.report.bonusEntries,0);
  run(approachAncientHoard(r));assert.equal(r.report.bonusEntries,1);
  assert.deepEqual(r.l.bonusReturnPoint().toArray(),[1137,8.12,0]);
  const state=r.p.captureRunState();
  r.p.resumeSuspendedLevel(r.l,r.l.bonusReturnPoint(),state);
  run(c.stepFor(30));assert.equal(r.p.grounded,true);
  run(c.walk([1140.5,8,0],'continue from restored parent'));
  assert.equal(r.report.bonusEntries,1);assert.equal(r.p.totalDeaths,start.totalDeaths);
  r.report.result={position:r.p.pos.toArray(),entries:r.report.bonusEntries,deaths:r.p.totalDeaths-start.totalDeaths};
  console.log(JSON.stringify(r.report.result));
 }catch(e){r.report.failure=String(e);throw e;}
 finally{await writeFile(`${output}/entrance.json`,JSON.stringify({report:r.report,trace:r.trace},null,2));}
},{modulePath:'/src/levels/ancient-gates-route.ts',levelId:'jungle-gate-run',source:m=>m.JUNGLE_GATE_RUN_LEVEL,
 start:[1117,8.12,0],maxFrames:5000,endlessDeaths:true,
 onTick:(row,r)=>{if(r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))r.report.bonusEntries++;}});
