import assert from 'node:assert/strict';
import {writeFile,stat,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {pirateJourney} from './pirate-wreck-pilot.mjs';
const finishOnly=process.argv.includes('--finish');
const extensionOnly=process.argv.includes('--extension')||finishOnly;
const interiorOnly=process.argv.includes('--interior')||extensionOnly;
const output=process.env.PIRATE_WRECK_OUTPUT??join(tmpdir(),'pirate-wreck');await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData,findLevel}=await r.server.ssrLoadModule('/src/level.ts');
 const {campaignLevelById}=await r.server.ssrLoadModule('/src/campaign.ts');
 for(const id of ['drowned-crown','crab-chief']){
  const def=campaignLevelById(id);assert.ok(def&&findLevel(def.levelId),`${id}: map destination must resolve to a real level`);
  assert.ok((await stat(new URL(`../public/level-previews/${def.progressKey}.jpg`,import.meta.url))).size>5000,`${id}: missing real preview`);
 }
 // Bone Yard is still an editor playground, deliberately outside the campaign.
 assert.ok(findLevel('bone-yard'));assert.equal(campaignLevelById('bone-yard'),null);
 assert.ok(normalizeCustomLevelData(r.source),'Authored data must round-trip through the editor');
 const broadside=normalizeCustomLevelData(r.source).components.find(c=>c.cameraKeepDistance);
 assert.ok(broadside?.cameraPresentationOnly&&broadside.cameraFollowDistance===18,'broadside camera scale must survive normalization');
 assert.ok(r.l.cameraPresentationViews.some(v=>v.cameraKeepDistance&&v.cameraFollowDistance===18),'runtime must retain the authored side-view scale');
 assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
 assert.equal(r.source.components.filter(c=>c.t==='checkpoint').length,extensionOnly?9:17);
 try{
  const tuning=JSON.stringify(r.TUNING);
  const pilot=pirateJourney(r);let next=pilot.next(),lastStage='';while(!next.done){r.tick(next.value);next=pilot.next();if(r.report.stage!==lastStage){lastStage=r.report.stage;console.log(JSON.stringify({stage:lastStage,frame:r.frame}));}}
  assert.equal(next.value.checkpoints,finishOnly?1:extensionOnly?9:interiorOnly?14:17);
  assert.equal(JSON.stringify(r.TUNING),tuning);assert.ok(r.trace.every(t=>!t.bailing&&!['dead','gameover'].includes(t.state)));
  const largestStep=Math.max(...r.trace.slice(1).map((t,i)=>Math.hypot(...t.position.map((n,k)=>n-r.trace[i].position[k]))));
  assert.ok(largestStep<2.2,'the complete journey must contain no teleport-sized step');
  const report={result:next.value,frames:r.frame,seconds:r.frame*r.dt,largestStep,tuningUnchanged:true,components:r.source.components.length};
  await writeFile(join(output,'journey.json'),JSON.stringify({...report,trace:r.trace}));
  console.log(JSON.stringify(report,null,2));
 }catch(error){await writeFile(join(output,'failure.json'),JSON.stringify({error:String(error),report:r.report,trace:r.trace},null,2));throw error;}
},{modulePath:'/src/levels/pirate-wreck.ts',levelId:'drowned-crown',source:m=>extensionOnly?{
 ...m.PIRATE_WRECK_LEVEL,spawn:[1000,16.1,-362.6],
 // Keep the entire extension and connected finale; the continuous browser
 // journey separately exercises the complete world from the harbour.
 components:m.PIRATE_WRECK_LEVEL.components.filter(c=>c.p[0]>500&&c.p[2]<=-350),
}:m.PIRATE_WRECK_LEVEL,...(interiorOnly?{start:finishOnly?[1104,18.7,-618]:extensionOnly?[1000,16.1,-362.6]:[1004,8.1,-112],heading:[0,0,-1]}:{}),maxFrames:90000});
