import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),{normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(r.source),'Pool level must survive strict import');
 assert.equal(r.source.components.filter(c=>c.swimDepth).length,8);
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'slipstream-race');const reports=[];
 for(const [i,pool] of r.sourceModule.SLIPSTREAM_RACE_STATS.pools.entries()){
  race.start('time-trial');race.phase='running';const a=race.riders[0],jump={s:race.course.project(new r.THREE.Vector3(...pool.takeoff)).s,end:race.course.project(new r.THREE.Vector3(...pool.landing)).s},s=jump.s-4;
  const probe=race.course.sample(s,i>=6?8:0),at=race.course.supportAt(r.l,probe);assert.ok(at);r.p.resetRacePosition(r.l,at,race.course.tangent(s));a.progress=a.previousProgress=a.anchorProgress=s;a.anchor.copy(at);race.step(r.dt,normalizeGameInput({grabHeld:true}));
  let previous={},swam=false,exited=false,frames=0,swimFrames=0,exitFrame=-1,hopCharge=-1,hopped=false;
  for(;frames<1800;frames++){
   const sample=hopCharge>=0&&hopCharge<24?{jumpHeld:true}:{moveY:1};
   const input=normalizeGameInput(sample,previous);previous=input;r.scene.updateMatrixWorld(true);race.step(r.dt,input);r.p.commitRenderStep(r.l);race.commitRenderStep();
   if(r.p.swimming){swam=true;swimFrames++;}
   if(swam&&!r.p.swimming&&r.p.grounded&&!exited){exited=true;exitFrame=frames;hopCharge=0;}
   else if(hopCharge>=0){hopCharge++;if(hopCharge===25)hopped=r.p.state==='air'&&!r.p.airFromSkate;}
   if(hopped&&r.p.grounded&&a.progress>jump.end+7)break;
   if(a.falls)break;
  }
  const report={pool:i,frames,swam,swimFrames,exited,exitFrame,hopped,progress:a.progress,target:jump.end+7,falls:a.falls,state:r.p.state,board:r.p.boardRolling,position:r.p.pos.toArray(),surface:pool.surface};reports.push(report);console.log(JSON.stringify(report));
 }
 await writeFile(process.env.RACE_POOL_REPORT??join(tmpdir(),'skate-race-pools.json'),JSON.stringify(reports,null,2));
 assert.ok(reports.every(v=>v.swam&&v.exited&&v.hopped&&v.progress>v.target&&v.falls===0&&!v.board),'Every missed gap must swim to the downhill bank and continue on foot');
 // The same production rival steering must swim out, release the swim stroke,
 // and deliberately mount the board again on the downhill road.
 race.start('time-trial');race.phase='running';const a=race.riders[0],jump=race.jumps[3];
 const position=race.course.support(r.l,jump.s-4);r.p.resetRacePosition(r.l,position,race.course.tangent(jump.s));a.progress=a.anchorProgress=jump.s-4;a.anchor.copy(position);race.step(r.dt,normalizeGameInput({grabHeld:true}));
 let swimming=false,remounted=false;
 for(let f=0;f<1800;f++){
  const input=swimming?race.drive(0):normalizeGameInput({moveY:1});r.scene.updateMatrixWorld(true);race.step(r.dt,input);r.p.commitRenderStep(r.l);race.commitRenderStep();
  swimming||=r.p.swimming;
  if(swimming&&r.p.boardRolling&&a.progress>jump.end+8){remounted=true;break;}
 }
 assert.ok(swimming&&remounted&&a.falls===0,'Rival swimming must exit and remount using normal inputs');
 const captured=r.l.captureData();assert.ok(normalizeCustomLevelData(captured));assert.equal(captured.components.filter(c=>c.swimDepth).length,8);
 const pool=r.sourceModule.SLIPSTREAM_RACE_STATS.pools[0],x=(pool.start[0]+pool.end[0])/2,z=(pool.start[2]+pool.end[2])/2;
 assert.ok(r.l.swimmingSurfaceAt(x,z,pool.surface-2)!==null);assert.equal(r.l.swimmingSurfaceAt(x,z,pool.floor-2),null,'Pool water must not reach geometry far beneath it');
 console.log('PASS eight missed-gap swimming routes, downhill exits, bounded depths and editor capture');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
