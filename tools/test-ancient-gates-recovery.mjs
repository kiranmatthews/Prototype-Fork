import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runAncientGates} from './ancient-gates-pilot.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
const output=process.env.ANCIENT_GATES_OUTPUT||'/private/tmp/ancient-gates-native';await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 r.report={stage:'start',actions:[],evidence:[]};const c=puzzleControls(r);
 const run=gen=>{let next=gen.next();while(!next.done){r.tick(next.value);next=gen.next();}return next.value;};
 try{
  run(runAncientGates(r,{from:0,to:0}));
  const before={deaths:r.p.totalDeaths,crates:r.p.cratesBroken,masks:r.p.masks,spawn:r.l.currentSpawn.toArray()};
  run(c.walk([69.5,3,0],'return over the banked timber bridge to test a missed gap'));
  run(c.until(()=>r.p.state==='dead',{moveX:-1},{label:'intentional missed Root Steps gap',allowDeath:true,limit:400}));
  const death={position:r.p.pos.toArray(),deaths:r.p.totalDeaths};
  run(c.until(()=>r.p.grounded&&r.p.state==='ride'&&!r.p.isBailing,{}, {label:'automatic checkpoint respawn',allowDeath:true,limit:700}));
  run(c.stepFor(30));
  const after={deaths:r.p.totalDeaths,crates:r.p.cratesBroken,masks:r.p.masks,position:r.p.pos.toArray(),bridge:r.l.spinBridges[0].deployed};
  assert.equal(after.deaths,before.deaths+1);assert.equal(after.crates,before.crates);assert.equal(after.masks,before.masks);
  assert.ok(after.bridge);assert.ok(Math.abs(after.position[0]-105)<.2&&Math.abs(after.position[1]-3)<.1);
  r.report.result={before,death,after,frames:r.frame};console.log(JSON.stringify(r.report.result));
 }catch(e){r.report.failure=String(e);throw e;}
 finally{await writeFile(`${output}/recovery.json`,JSON.stringify({report:r.report,trace:r.trace},null,2));}
},{modulePath:'/src/levels/ancient-gates-route.ts',levelId:'jungle-gate-run',source:m=>m.JUNGLE_GATE_RUN_LEVEL,maxFrames:8000,endlessDeaths:true});
