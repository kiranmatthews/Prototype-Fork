import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const load = async path => {
 const code=ts.transpileModule(await readFile(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};
const {JungleCupEvent,judgeRun,bestTwo,rivalRun,COMPETITION_TUNING:T}=await load('src/competition/event.ts');
const {JUNGLE_CUP_LEVEL:level}=await load('src/levels/jungle-cup.ts');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert.equal(T.runSeconds,60);
const perfect=judgeRun(T.perfectRunTarget,0,()=>.5);
assert.equal(perfect.judges.length,3);
near(perfect.score,Math.round(perfect.judges.reduce((a,b)=>a+b,0)/3*10)/10);
assert.ok(perfect.judges[2]>=96&&perfect.judges[2]<perfect.judges[0]);
const ordinary=judgeRun(T.perfectRunTarget*.5,0,()=>.5);
const oneBail=judgeRun(T.perfectRunTarget*.5,1,()=>.5);
assert.ok(Math.abs((ordinary.judges[0]-oneBail.judges[0])-3.75)<.051); // one-decimal marks around a 3.75 penalty
assert.equal(judgeRun(0,50,()=>.5).score,0);
assert.equal(judgeRun(NaN,NaN,()=>.5).gameplayScore,0);
assert.deepEqual(bestTwo([95,80,96]),{total:191,discarded:1});
assert.deepEqual(bestTwo([95,80]),{total:175,discarded:null});
assert.deepEqual(bestTwo([99.9,99.9,99.9]),{total:199.8,discarded:0});
assert.ok(rivalRun(0,()=>1)>rivalRun(0,()=>0),'weak runs pinned the rival to an obvious constant floor');
let seed=1;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let sample=0;sample<1500;sample++){
 const run=judgeRun(random()*20000,Math.floor(random()*8),random);
 assert.ok(run.judges.every(s=>s>=0&&s<=99.9));
 assert.ok(run.judges[2]<=Math.max(run.judges[0],run.judges[1]));
 const r=rivalRun(run.score,random);assert.ok(r>=94.1&&r<=99.9);
}
for(const win of [false,true]){
 const event=new JungleCupEvent(()=>.5);
 const previous=[];
 for(let r=0;r<3;r++){
  assert.equal(event.startRun(),true);assert.equal(event.phase,'countdown');
  event.stepPresentation(2.99);assert.equal(event.phase,'countdown');
  event.stepPresentation(.01);assert.equal(event.phase,'running');
  const score=win?T.perfectRunTarget:100;
  for(let step=0;step<3599;step++) assert.equal(event.stepRun(1/60,score),false);
  assert.ok(event.remaining>0);assert.equal(event.stepRun(1/60,score),true);
  assert.equal(event.phase,'finishing');assert.equal(event.runs.length,r);
  assert.equal(event.stepFinish(T.finishBeat,true,true),true);
  assert.equal(event.phase,'judges');assert.equal(event.revealedJudges,0);
  assert.equal(event.showStandings(),false);
  event.stepPresentation(T.revealBeat);assert.equal(event.revealedJudges,1);
  event.stepPresentation(T.revealBeat*2+.01);assert.equal(event.revealedJudges,3);
  assert.equal(event.showStandings(),true);
  for(const s of event.standings){
   if(s.id!=='rival'&&s.id!=='player')assert.ok(s.runs.every(n=>n<=94));
   assert.equal(s.runs.length,r+1);
   near(s.total,bestTwo(s.runs).total);
  }
  assert.deepEqual(event.field[1].runs.slice(0,r),previous,'rival rewrote a revealed run');
  previous.push(event.field[1].runs[r]);
 }
 assert.equal(event.phase,'final');assert.equal(event.won,win);
 assert.equal(event.standings.find(s=>s.id==='rival').rank,win?2:1);
 assert.equal(event.startRun(),false,'a fourth run was accepted');
 const bails=event.bails;event.bail();assert.equal(event.bails,bails,'non-running bail was counted');
}
for(let scenario=0;scenario<1000;scenario++){
 const e=new JungleCupEvent(random);
 for(let r=0;r<3;r++){e.startRun();e.stepPresentation(3);e.stepRun(60,random()*18000);e.stepFinish(T.finishBeat,true,true);e.stepPresentation(3);e.showStandings();}
 assert.ok([1,2].includes(e.standings.find(s=>s.id==='rival').rank));
 if(e.won)assert.equal(e.standings[1].id,'rival');
}
assert.equal(level.components.filter(c=>c.t==='gate').length,0);
assert.equal(level.skatepark,true);
assert.ok(!level.components.some(c=>['crate','checkpoint','gate'].includes(c.t)||c.dkind==='junglecup'));
assert.ok(level.killY<0);
assert.equal(level.jungleAtmosphere,true);
assert.ok(level.components.some(c=>c.t==='vertramp'&&c.closed&&c.arc===90&&c.deck>=4));
assert.ok(level.components.filter(c=>c.t==='rail').length>=4);
assert.ok(level.components.some(c=>c.t==='wallpath'&&c.containment));
assert.equal(level.components.filter(c=>c.t==='camnode').length,0);
assert.ok(!level.components.some(c=>['clock','comboorb','crystal'].includes(c.t)));
const storage = new Map();
globalThis.localStorage = {getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const campaign = await load('src/campaign.ts');
const save = new campaign.CampaignStore();save.newGame(1);
for(const id of ['jungle','test','sky','dark'])save.commitClear(id,{crystal:false,boxGem:false,comboGem:false});
assert.equal(save.levelUnlocked('jungle-cup'),true);
assert.equal(save.levelUnlocked('beachfront'),false);
save.commitClear('jungle-cup',{crystal:true,boxGem:true,comboGem:true});
assert.equal(save.levelProgress('jungle-cup').cleared,false,'ordinary gate clear bypassed the competition');
assert.equal(save.commitCompetitionWin('jungle-cup'),true);
assert.equal(save.commitCompetitionWin('jungle-cup'),false,'repeat win minted another cup');
assert.equal(save.totals().cups,1);
assert.equal(save.levelUnlocked('beachfront'),true);
assert.equal(save.runModesUnlocked('jungle-cup'),false,'competition exposed unrelated trial collectibles');
const loaded=new campaign.CampaignStore();loaded.load(1);
assert.equal(loaded.levelProgress('jungle-cup').cup,true,'cup did not survive save/load');
assert.equal(loaded.totals().maxCrystals,campaign.CAMPAIGN_LEVELS.length-1);
console.log('PASS Jungle Cup: exact 60-second runs, all three judges, bail curve, reveal gates, best two, rival consistency/placement, ordinary caps, and arena structure.');
