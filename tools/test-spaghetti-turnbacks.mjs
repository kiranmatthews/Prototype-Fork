import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/turnbacks';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');
 const tuning=JSON.stringify(r.TUNING),results=[];
 for(const index of [12,37,38,41]){
  race.start('time-trial',270328);race.phase='running';
  const rail=r.l.rails[index],at=rail.totalLength*.6,point=rail.pointAt(at),heading=rail.tangentAt(at).setY(0).normalize().negate();
  point.y+=r.CONST.railRideHeight;
  // Fixture: a low-speed backward catch like the observed combat outcome.
  // After this setup, only the production rival driver and physics run.
  r.p.resetRacePosition(r.l,point,heading);r.p.state='air';r.p.grounded=false;r.p.vVel=0;r.p.speed=7;
  const rider=race.riders[0];rider.progress=race.course.project(point).s;
  let caughtAt=null,leftAt=null,returnedAt=null,anchor=null,frames=0;
  for(;frames<1800;frames++){
   r.scene.updateMatrixWorld(true);
   race.step(r.dt,frames===0?{moveX:0,moveY:0,grindHeld:true,grindPressed:true}:race.drive(0));
   r.l.update(r.dt);r.p.commitRenderStep(r.l);race.commitRenderStep();
   if(caughtAt===null&&r.p.state==='grind'&&r.p.grindDir===-1){caughtAt=frames;anchor=rider.anchorProgress;}
   if(caughtAt!==null&&leftAt===null&&r.p.state!=='grind')leftAt=frames;
   if(leftAt!==null&&rider.falls===1&&r.p.grounded&&rider.recovery===0){returnedAt=frames;assert.ok(race.course.supportAt(r.l,r.p.pos));}
   if(returnedAt!==null&&rider.progress>anchor+40&&r.p.state==='grind')break;
  }
  const result={rail:index,caughtAt,leftAt,returnedAt,frames,anchor,progress:rider.progress,falls:rider.falls,deaths:r.p.totalDeaths};
  results.push(result);console.log(JSON.stringify(result));
  assert.notEqual(caughtAt,null,'Fixture must reproduce a real backward grind');
  assert.ok(leftAt!==null&&(leftAt-caughtAt)*r.dt<2,'Input-only driver abandons the backward catch promptly');
  assert.notEqual(returnedAt,null,'The normal pit recovery returns to supported floor');
  assert.equal(rider.falls,1);assert.equal(r.p.totalDeaths,0);
  assert.ok(rider.progress>anchor+40&&r.p.state==='grind','Normal controls rejoin the forward race');
 }
 const report={at:new Date().toISOString(),tuningUnchanged:tuning===JSON.stringify(r.TUNING),results};
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));assert.ok(report.tuningUnchanged);
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
