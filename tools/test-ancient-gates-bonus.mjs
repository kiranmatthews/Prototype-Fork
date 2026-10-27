import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runAncientGatesBonus} from './ancient-gates-bonus-pilot.mjs';
const output=process.env.ANCIENT_GATES_OUTPUT||'/private/tmp/ancient-gates-native';await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 r.report={stage:'start',actions:[],evidence:[]};const tuning=JSON.stringify(r.TUNING),gen=runAncientGatesBonus(r);
 let next=gen.next(),result,lastStage;try{while(!next.done){r.tick(next.value);next=gen.next();
  if(r.report.stage!==lastStage){lastStage=r.report.stage;console.log(r.frame,lastStage);}
 }result=next.value;assert.equal(result.deaths,0);assert.equal(JSON.stringify(r.TUNING),tuning);console.log(JSON.stringify(result));
 }catch(e){r.report.failure=String(e);console.error(r.report.failure);process.exitCode=1;}
 finally{await writeFile(`${output}/bonus.json`,JSON.stringify({result,report:r.report,trace:r.trace},null,2));}
},{modulePath:'/src/levels/ancient-gates-bonus.ts',levelId:'bonus-jungle-gate',source:m=>m.ANCIENT_GATES_BONUS,maxFrames:30000,endlessDeaths:true});
