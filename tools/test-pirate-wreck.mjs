import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {pirateJourney} from './pirate-wreck-pilot.mjs';
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(r.source),'Authored data must round-trip through the editor');
 assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
 assert.equal(r.source.components.filter(c=>c.t==='checkpoint').length,4);
 try{
  const pilot=pirateJourney(r);let next=pilot.next();while(!next.done){r.tick(next.value);next=pilot.next();}
  assert.equal(next.value.checkpoints,4);
  await writeFile('/private/tmp/pirate-wreck-journey.json',JSON.stringify({result:next.value,seconds:r.frame*r.dt,trace:r.trace}));
  console.log(JSON.stringify({result:next.value,seconds:r.frame*r.dt,components:r.source.components.length},null,2));
 }catch(error){await writeFile('/private/tmp/pirate-wreck-failure.json',JSON.stringify({error:String(error),report:r.report,trace:r.trace},null,2));throw error;}
},{modulePath:'/src/levels/pirate-wreck.ts',levelId:'drowned-crown',source:m=>m.PIRATE_WRECK_LEVEL,maxFrames:90000});
