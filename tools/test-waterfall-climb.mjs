import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runWaterfallClimb,runWaterfallBonus} from './waterfall-climb-pilot.mjs';

const out=process.env.WATERFALL_OUTPUT||'docs/waterfall-climb/runs';await mkdir(out,{recursive:true});
const bonus=process.argv.includes('--bonus'),fromBeat=Number(process.env.WATERFALL_FROM_BEAT||0);
const modulePath=bonus?'/src/levels/waterfall-climb-bonus.ts':'/src/levels/waterfall-climb.ts';
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData,findLevel}=await r.server.ssrLoadModule('/src/level.ts');
 const {resolveBonusLevel}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 assert.ok(normalizeCustomLevelData(r.source),'waterfall data survives editor validation');
 assert.equal(r.source.components.filter(k=>k.t==='gate').length,1);
 assert.equal(findLevel(bonus?'bonus-waterfall-climb':'waterfall-climb').data,r.source);
 if(bonus)assert.equal(resolveBonusLevel('waterfall-climb'),r.source);
 r.report={actions:[],evidence:[],source:'production source',started:new Date().toISOString()};
 const tuning=JSON.stringify(r.TUNING);
 const pilot=bonus?runWaterfallBonus(r):runWaterfallClimb(r,{collect:process.env.WATERFALL_COLLECT!=='0',untilBeat:Number(process.env.WATERFALL_UNTIL_BEAT||Infinity),fromBeat});
 try{let step;while(!(step=pilot.next()).done)r.tick(step.value);r.report.result=step.value;
  assert.equal(JSON.stringify(r.TUNING),tuning);assert.ok(!r.trace.some(pose=>pose.state==='dead'||pose.bailing),'No hidden death or bail during the continuous pilot');console.log('PASS',bonus?'bonus':'main',JSON.stringify(step.value));
 }catch(error){r.report.error=error.message;console.log('FAIL',JSON.stringify({error:error.message,stage:r.report.stage,beat:r.report.beat,last:r.snapshot()}));throw error;}
 finally{await writeFile(`${out}/${bonus?'bonus':'main'}-physics.json`,JSON.stringify({report:r.report,actions:r.actions,trace:r.trace}));}
},{modulePath,levelId:bonus?'bonus-waterfall-climb':'waterfall-climb',source:m=>bonus?m.WATERFALL_CLIMB_BONUS:m.WATERFALL_CLIMB_LEVEL,
 ...(process.env.WATERFALL_START?{start:JSON.parse(process.env.WATERFALL_START)}:{}),controlFrame:()=>({x:0,z:-1}),maxFrames:80000,
 onTick:(pose,r)=>{if(pose.frame%1200===0)console.log('PROGRESS',JSON.stringify({frame:pose.frame,beat:r.report?.beat,stage:r.report?.stage,position:pose.position}));}});
