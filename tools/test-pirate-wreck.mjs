import assert from 'node:assert/strict';
import {writeFile,stat,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {pirateJourney} from './pirate-wreck-pilot.mjs';
const output=process.env.PIRATE_WRECK_OUTPUT??join(tmpdir(),'pirate-wreck');await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData,findLevel}=await r.server.ssrLoadModule('/src/level.ts');
 const {campaignLevelById}=await r.server.ssrLoadModule('/src/campaign.ts');
 for(const id of ['drowned-crown','crab-chief','crate-primer','switchyard','clockwork-gauntlet','nightworks-after-hours','jungle-terraces','jungle-skyline']){
  const def=campaignLevelById(id);assert.ok(def&&findLevel(def.levelId),`${id}: map destination must resolve to a real level`);
  assert.ok((await stat(new URL(`../public/level-previews/${def.progressKey}.jpg`,import.meta.url))).size>5000,`${id}: missing real preview`);
 }
 // Bone Yard is still an editor playground, deliberately outside the campaign.
 assert.ok(findLevel('bone-yard'));assert.equal(campaignLevelById('bone-yard'),null);
 assert.ok(normalizeCustomLevelData(r.source),'Authored data must round-trip through the editor');
 assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
 assert.equal(r.source.components.filter(c=>c.t==='checkpoint').length,4);
 try{
  const tuning=JSON.stringify(r.TUNING);
  const pilot=pirateJourney(r);let next=pilot.next();while(!next.done){r.tick(next.value);next=pilot.next();}
  assert.equal(next.value.checkpoints,4);
  assert.equal(JSON.stringify(r.TUNING),tuning);assert.ok(r.trace.every(t=>!t.bailing&&!['dead','gameover'].includes(t.state)));
  const largestStep=Math.max(...r.trace.slice(1).map((t,i)=>Math.hypot(...t.position.map((n,k)=>n-r.trace[i].position[k]))));
  assert.ok(largestStep<2.2,'the complete journey must contain no teleport-sized step');
  const report={result:next.value,frames:r.frame,seconds:r.frame*r.dt,largestStep,tuningUnchanged:true,components:r.source.components.length};
  await writeFile(join(output,'journey.json'),JSON.stringify({...report,trace:r.trace}));
  console.log(JSON.stringify(report,null,2));
 }catch(error){await writeFile(join(output,'failure.json'),JSON.stringify({error:String(error),report:r.report,trace:r.trace},null,2));throw error;}
},{modulePath:'/src/levels/pirate-wreck.ts',levelId:'drowned-crown',source:m=>m.PIRATE_WRECK_LEVEL,maxFrames:90000});
