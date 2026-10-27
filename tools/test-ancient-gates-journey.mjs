import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runAncientGates} from './ancient-gates-pilot.mjs';
const section=Number(process.argv.find(a=>a.startsWith('--section='))?.split('=')[1]??-1);
const to=Number(process.argv.find(a=>a.startsWith('--to='))?.split('=')[1]??(section<0?11:section));
// Section probes begin just beyond a checkpoint crate. Full runs use the real
// authored spawn and must bank every checkpoint through contact.
const starts=[[-20,.12,0],[107,3.12,0],[223,5.12,0],[345,7.12,0],[458,14.12,0],[591,9.12,0],
 [711,8.12,0],[837,6.12,0],[947,10.12,0],[1057,13.12,0],[1183,8.12,0],[1288,24.12,0]];
const output=process.env.ANCIENT_GATES_OUTPUT||'/private/tmp/ancient-gates-native';await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 r.report={stage:'start',actions:[],evidence:[],maskHits:0,bonusEntries:0};const tuning=JSON.stringify(r.TUNING),gen=runAncientGates(r,{from:Math.max(0,section),to});
 const spend=r.p.spendMask.bind(r.p);r.p.spendMask=(...args)=>{const spent=spend(...args);if(spent)r.report.maskHits++;return spent;};
 let next=gen.next(),result,lastStage;try{while(!next.done){r.tick(next.value);next=gen.next();
  if(r.report.stage!==lastStage){lastStage=r.report.stage;console.log(r.frame,lastStage);}
 }result=next.value;
  assert.equal(result.deaths,0);assert.equal(r.report.maskHits,0,'Successful route must not conceal damage with masks');assert.equal(r.report.bonusEntries,0,'Main route must not enter its optional bonus');assert.equal(JSON.stringify(r.TUNING),tuning);console.log(JSON.stringify(result));
 }catch(e){r.report.failure=String(e);console.error(r.report.failure);process.exitCode=1;}
 finally{await writeFile(`${output}/journey-${section}-${to}.json`,JSON.stringify({result,report:r.report,trace:r.trace},null,2));}
},{modulePath:'/src/levels/ancient-gates-route.ts',levelId:'jungle-gate-run',source:m=>m.JUNGLE_GATE_RUN_LEVEL,
 start:section<0?undefined:starts[section],maxFrames:80000,endlessDeaths:true,
 onTick:(row,r)=>{if(r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))r.report.bonusEntries++;}});
