import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {harbourPilot,harbourObservation} from './carlisle-harbour-pilot.mjs';
const b=await build({entryPoints:['src/levels/carlisle-harbour-bonus.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_HARBOUR_BONUS,out=process.env.CARLISLE_OUT??'docs/carlisle-relay/harbour-bonus',rows=[];
await mkdir(out,{recursive:true});
try{await withSkateRuntime(async({THREE,level:l,player:p,CONST,server})=>{
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');assert.ok(normalizeCustomLevelData(data));
 const {resolveBonusLevel,bonusCrateCount}=await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {levelAllowsBonus}=await server.ssrLoadModule('/src/campaign.ts');
 assert.equal(levelAllowsBonus('carlisle-coast'),true);assert.equal(resolveBonusLevel('carlisle-coast').name,data.name);assert.equal(bonusCrateCount('carlisle-coast'),21);
 for(const phase of (process.env.PHASES??'0,7,19').split(',').map(Number)){
  p.respawn(l,true);p.competitionMode=false;p.bonusMode=true;p.endlessDeaths=false;p.totalDeaths=0;
  l.time=phase;l.update(0);
  const pilot=harbourPilot(api.CARLISLE_HARBOUR_BOATS),samples=[];let done=false,frame=0,stage;
  const supports=new Set(),bounces=new Set();
  for(;frame<60*180;frame++){
   const state=harbourObservation(p,l),control=pilot.sample(state);stage=control.stage;
   if(control.done){done=true;break;}
   if(p.grounded)supports.add(p.surfaceName);if(p.trampolineAir&&p.vVel>15)bounces.add(p.surfaceName);
   if(frame%30===0)samples.push({...state,crates:undefined,stage});
   const input=makeInput(control.input);p.rawInput=input;p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);input.consumeEdges();
   if(p.isBailing||['dead','gameover'].includes(p.state)||p.totalDeaths)break;
  }
  const row={phase,done,seconds:frame/60,stage,crates:p.cratesBroken,total:l.totalCrates,supports:[...supports],bounces:[...bounces],
   end:harbourObservation(p,l),history:pilot.history,samples};rows.push(row);console.log(JSON.stringify({...row,end:{...row.end,crates:undefined},samples:undefined}));
 }
 assert.ok(rows.every(r=>r.done&&r.crates===21&&!r.end.deaths&&!r.end.bail),'continuous harbour bonus route failed');
},{levelEntry:{id:'bonus-carlisle-coast',name:data.name,data}});}finally{await writeFile(`${out}/native.json`,JSON.stringify({rows},null,2)+'\n');}
