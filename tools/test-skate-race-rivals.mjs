import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),race=new SkateRace(r.scene,r.p);
 race.attach(r.l,'slipstream-race');race.start('race',Number(process.env.RACE_SEED??19410));
 const stats={spinAttempts:0,npcSpinHits:0,itemUses:0,itemKinds:{},humanSpeed:0,humanSamples:0,rivalSpeed:0,rivalSamples:0};
 const drive=race.drive.bind(race),hit=race.hit.bind(race),use=race.useItem.bind(race);
 race.drive=id=>{const input=drive(id);if(id&&input.spinPressed)stats.spinAttempts++;return input;};
 race.hit=(target,origin)=>{const source=race.riders.find(a=>a.player.pos===origin),result=hit(target,origin);if(result&&source?.id>0&&target.id>0)stats.npcSpinHits++;return result;};
 race.useItem=id=>{const kind=race.riders[id??0].item,result=use(id);if(result){stats.itemUses++;stats.itemKinds[kind]=(stats.itemKinds[kind]??0)+1;}return result;};
 let frames=0;
 for(;frames<27000&&race.riders.some(a=>a.finish===null);frames++){
  r.scene.updateMatrixWorld(true);race.step(r.dt,race.phase==='running'?race.drive(0):{moveX:0,moveY:0});r.p.commitRenderStep(r.l);race.commitRenderStep();
  for(const a of race.riders)if(a.finish===null&&a.player.grounded&&!a.player.skateCameraBailing&&a.player.speed>3){
   if(a.id){stats.rivalSpeed+=Math.abs(a.player.speed);stats.rivalSamples++;}else{stats.humanSpeed+=Math.abs(a.player.speed);stats.humanSamples++;}
  }
  if(frames%1800===0)console.log(JSON.stringify({frames,time:race.elapsed,stats,riders:race.riders.map(a=>({id:a.id,s:Math.round(a.progress),falls:a.falls,finished:a.finish,state:a.player.state}))}));
 }
 const report={frames,...stats,humanMeanSpeed:stats.humanSpeed/stats.humanSamples,rivalMeanSpeed:stats.rivalSpeed/stats.rivalSamples,riders:race.riders.map(a=>({id:a.id,finish:a.finish,falls:a.falls,deaths:a.player.totalDeaths,lives:a.player.lives}))};
 await writeFile(process.env.RACE_RIVALS_REPORT??join(tmpdir(),'skate-race-rivals.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.ok(report.riders.every(a=>a.finish!==null),'All seven rivals must finish using their real controls');
 assert.ok(stats.spinAttempts>=3&&stats.npcSpinHits>=1,'Rivals must actually spin and knock each other down');
 assert.ok(stats.itemUses>=7);assert.ok(report.rivalMeanSpeed<report.humanMeanSpeed,'Rivals must have a less aggressive normal pace');
 assert.ok(report.riders.every(a=>a.deaths===0&&a.lives===4));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
