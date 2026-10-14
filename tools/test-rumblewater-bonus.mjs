import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runRumblewaterBonus} from './rumblewater-bonus-pilot.mjs';
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {resolveBonusLevel,bonusCrateCount}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 r.source=r.sourceModule.RUMBLEWATER_BONUS_LEVEL;r.report={actions:[],evidence:[]};
 assert.ok(normalizeCustomLevelData(r.source));assert.equal(resolveBonusLevel('rumblewater-run'),r.source);assert.equal(bonusCrateCount('rumblewater-run'),r.l.totalCrates);
 const pilot=runRumblewaterBonus(r);
 try{let step;while(!(step=pilot.next()).done)r.tick(step.value);r.report.result=step.value;console.log(JSON.stringify(r.report));}
 catch(error){console.log(JSON.stringify({error:error.message,report:r.report,last:r.snapshot()}));throw error;}
 finally{await writeFile('/private/tmp/rumblewater-bonus-journey.json',JSON.stringify({report:r.report,trace:r.trace}));}
},{modulePath:'/src/levels/rumblewater-bonus.ts',levelId:'bonus-rumblewater-run',source:m=>m.RUMBLEWATER_BONUS_LEVEL,controlFrame:()=>({x:0,z:-1}),maxFrames:12000});
