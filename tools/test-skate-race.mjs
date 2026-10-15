import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
  const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  const data=r.source;
  assert.ok(normalizeCustomLevelData(data));assert.equal(r.l.checkpoints.length,0);assert.equal(r.l.allowsBonus,false);
  assert.ok(data.components.filter(c=>c.t==='crate').every(c=>['empty','mystery','tnt','nitro'].includes(c.kind)));
  assert.ok(!data.components.some(c=>['checkpoint','wumpa','clock','crystal'].includes(c.t)));
  const race=new SkateRace(r.scene,r.p);race.attach(r.l,'slipstream-race');race.start(process.env.RACE_SOLO?'time-trial':'race');
  const from=Number(process.env.RACE_FROM??0);
  if(from>0){race.phase='running';for(const a of race.riders.slice(0,race.count)){const p=race.course.sample(from,(a.id%2?1:-1)*2);p.y+=.15;a.player.resetRacePosition(r.l,p,race.course.tangent(from));a.player.speed=26;a.progress=a.previousProgress=a.anchorProgress=from;a.anchor.copy(p);}}
  const tuning=JSON.stringify(r.TUNING),report=[];let result=null;race.onFinish=v=>result=v;
  const frames=Number(process.env.RACE_FRAMES??18000);
  for(let f=0;f<frames&&(!result||process.env.RACE_ALL_FINISH&&race.riders.slice(0,race.count).some(a=>a.finish===null));f++){
    r.scene.updateMatrixWorld(true);
    const input=race.phase==='running'&&race.elapsed>=Number(process.env.RACE_DELAY??0)?race.drive(0):{moveX:0,moveY:0};const before={s:race.riders[0].progress,p:r.p.pos.toArray(),heading:r.p.raceHeading.toArray(),speed:r.p.speed,ground:r.p.groundHit?.normal.toArray(),state:r.p.state,falls:race.riders[0].falls,input};race.step(r.dt,input);if(race.riders[0].falls>before.falls)console.log(JSON.stringify({fall:before,anchor:race.riders[0].anchor.toArray()}));
    if(f%600===0){const snap={f,phase:race.phase,riders:race.riders.map(a=>({id:a.id,s:+a.progress.toFixed(2),p:a.player.pos.toArray().map(v=>+v.toFixed(2)),speed:+a.player.speed.toFixed(2),falls:a.falls,stun:a.player.skateCameraBailing,state:a.player.state,ground:a.player.grounded}))};report.push(snap);console.log(JSON.stringify(snap));}
  }
  await writeFile(process.env.RACE_REPORT??'/private/tmp/skate-race-native.json',JSON.stringify({stats:r.sourceModule.SLIPSTREAM_RACE_STATS,result,report,riders:race.riders.map(a=>({id:a.id,progress:a.progress,finish:a.finish,falls:a.falls,deaths:a.player.totalDeaths,fruit:a.player.fruit}))},null,2));
  assert.equal(JSON.stringify(r.TUNING),tuning);for(const a of race.riders)assert.equal(a.player.totalDeaths,0);
  if(frames>=18000||process.env.RACE_FROM)assert.ok(result,'Input-driven human and rivals must traverse the complete race');
  if(process.env.RACE_ALL_FINISH)assert.ok(race.riders.every(r=>r.finish!==null),'All seven rivals must complete their real traversal');
}, {modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race',maxFrames:20000});
