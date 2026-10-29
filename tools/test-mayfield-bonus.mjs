import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusJourney} from './themed-bonus-pilot.mjs';
import {runMayfieldBonusEntrance} from './mayfield-bonus-entrance.mjs';
const out=process.env.MAYFIELD_BONUS_OUTPUT??'/tmp/mayfield-bonus-review';
await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const m=r.sourceModule;
 const {parseCustomLevelJson}=await r.server.ssrLoadModule('/src/level.ts');
 const {resolveBonusLevel,bonusCrateCount}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {levelAllowsBonus}=await r.server.ssrLoadModule('/src/campaign.ts');
 assert.ok(parseCustomLevelJson(JSON.stringify(r.source)),'Bonus survives editor serialization');
 assert.ok(parseCustomLevelJson(JSON.stringify(r.l.captureData())),'Built bonus survives editor serialization');
 for(const id of ['mayfield-mall','maynard-course-4']){
  assert.equal(levelAllowsBonus(id),true);assert.equal(resolveBonusLevel(id),r.source);assert.equal(bonusCrateCount(id),8);
 }
 assert.ok(m.MAYFIELD_BONUS_SOURCE_TRIANGLES>1000,'Retain actual Mall architecture');
 assert.ok(r.source.components.filter(c=>c.grp===91).every(c=>c.solid===false),'Backdrop cannot bypass puzzles');
 Object.assign(r,{id:'bonus-mayfield-mall',course:m.MAYFIELD_BONUS_COURSE});
 const tuning=JSON.stringify(r.TUNING);
 try{
  const result=runInputPilot(r,runThemedBonusJourney);
  assert.equal(result.state,'finished');assert.equal(result.cratesBroken,8);assert.equal(result.deaths,0);assert.equal(result.gemEarned,true);
  assert.equal(JSON.stringify(r.TUNING),tuning);
  await writeFile(out+'/native.json',JSON.stringify({...result,sourceTriangles:m.MAYFIELD_BONUS_SOURCE_TRIANGLES},null,2));
  console.log(JSON.stringify({state:result.state,crates:result.cratesBroken,deaths:result.deaths,seconds:result.seconds,sourceTriangles:m.MAYFIELD_BONUS_SOURCE_TRIANGLES}));
 }catch(error){await writeFile(out+'/native-failure.json',JSON.stringify({error:String(error),report:r.report,trace:r.trace.slice(-120)},null,2));throw error;}
},{modulePath:'/src/levels/mayfield-bonus.ts',source:m=>m.MAYFIELD_BONUS_LEVEL,levelId:'bonus-mayfield-mall',controlFrame:()=>({x:0,z:-1}),maxFrames:16000});
let entries=0;
const entranceOptions={modulePath:'/src/levels/mayfield-mall.ts',levelId:'mayfield-mall',maxFrames:4000,
 source:m=>{const cp=m.MAYFIELD_CHECKPOINTS.find(c=>c.name==='Crossrail arcade');entranceOptions.start=[cp.x,cp.y+.12,-cp.s];return m.MAYFIELD_MALL_LEVEL;},
 onTick:(row,r)=>{if(r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))entries++;}};
await withBlockworksRuntime(async r=>{
 r.entry=r.sourceModule.MAYFIELD_BONUS_ENTRY;
 try{
  const result=runInputPilot(r,runMayfieldBonusEntrance);assert.equal(entries,1);assert.equal(r.p.totalDeaths,0);
  r.p.resumeSuspendedLevel(r.l,r.l.bonusReturnPoint(),r.p.captureRunState());r.stepFor(30);
  assert.ok(r.p.grounded);assert.equal(entries,1);assert.equal(r.p.totalDeaths,0);
  assert.ok(r.p.pos.distanceTo(r.l.bonusReturnPoint())<.2,'Supported parent return');
  await writeFile(out+'/entrance.json',JSON.stringify({result,entries,returnPosition:r.p.pos.toArray(),ground:r.p.groundHit?.name},null,2));
  console.log(JSON.stringify({entrance:result.result,entries,returnPosition:r.p.pos.toArray(),ground:r.p.groundHit?.name}));
 }catch(error){await writeFile(out+'/entrance-failure.json',JSON.stringify({error:String(error),report:r.report,trace:r.trace.slice(-160)},null,2));throw error;}
},entranceOptions);
