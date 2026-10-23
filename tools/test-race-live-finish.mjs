import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';

for(const [id,modulePath,name] of [
 ['country-club','/src/levels/country-club.ts','COUNTRY_CLUB_LEVEL'],
 ['slipstream-race','/src/levels/slipstream.ts','SLIPSTREAM_LEVEL'],
])await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {RaceFinishPresentation}=await r.server.ssrLoadModule('/src/race/finishPresentation.ts');
 let crystalEarned=false;
 const race=new SkateRace(r.scene,r.p,false,levelId=>levelId===id&&crystalEarned);race.attach(r.l,id);
 let reports=0;race.onFinish=result=>{reports++;if(result.mode==='race'&&result.won)crystalEarned=true;};
 const place=(rider,behind,offset=0)=>{
  const at=race.course.length-behind,point=race.course.sample(at,offset);
  const support=race.course.supportAt(r.l,point,new r.THREE.Vector3(),10,12);assert.ok(support);
  rider.player.resetRacePosition(r.l,support,race.course.tangent(at));rider.player.speed=32;
  rider.progress=rider.previousProgress=rider.anchorProgress=at;rider.anchor.copy(support);
 };
 const tick=input=>{r.scene.updateMatrixWorld(true);race.step(r.dt,normalizeGameInput(input));r.p.commitRenderStep(r.l);race.commitRenderStep();};
 race.start('race',0);race.phase='running';
 race.riders.forEach((rider,i)=>place(rider,i?25+i*9:2,(i%4-1.5)*1.5));
 let crossing=null;
 for(let i=0;i<1200;i++){
  tick(race.phase==='running'?race.drive(0):{});
  if(race.phase==='finished'&&!crossing){
   crossing={position:r.p.pos.clone(),time:race.riders[0].finish,otherProgress:race.riders[7].progress};
   assert.ok(race.riders.some(r=>r.finish===null),'field still arriving when results appear');
  }
 }
 assert.ok(crossing);assert.equal(reports,1,'one campaign result');
 assert.ok(r.p.pos.distanceTo(crossing.position)>1,'human rolls through the timing line');
 assert.ok(race.riders[7].progress>crossing.otherProgress,'rivals continue moving behind results');
 assert.ok(race.riders.every(r=>r.finish!==null),'all eight arrive');
 assert.ok(race.riders.every(r=>!r.rollout&&r.falls===0),'finite safe finishes');
 assert.equal(race.hud().elapsed,crossing.time,'displayed time stays fixed');
 assert.equal(r.p.ttTime,crossing.time,'human finish clock stays fixed');
 const clock=race.elapsed;for(let i=0;i<60;i++)tick({});assert.equal(race.elapsed,clock);
 for(const [width,height,viewport] of [[1280,720,{x:32,y:43,width:660,height:634}],[390,844,{x:16,y:30,width:358,height:338}]]){
  const camera=new r.THREE.PerspectiveCamera(50,width/height,.1,5000);camera.position.set(2,12,6);camera.lookAt(0,0,0);
  const before=camera.clone(),presentation=new RaceFinishPresentation();
  presentation.frame(camera,race,1,width,height,viewport);
  for(const subject of [r.p.pos.clone().add(new r.THREE.Vector3(0,1,0)),race.course.sample(race.course.length)]){
   const projected=subject.project(camera),x=(projected.x+1)*width/2,y=(1-projected.y)*height/2;
   assert.ok(x>=viewport.x&&x<=viewport.x+viewport.width&&y>=viewport.y&&y<=viewport.y+viewport.height,'finish and human stay beside the UI');
  }
  presentation.restore(camera);assert.ok(camera.position.distanceTo(before.position)<1e-9);assert.ok(camera.quaternion.angleTo(before.quaternion)<1e-6);assert.equal(camera.fov,before.fov);assert.equal(camera.view,null);
 }
 const rolloutMetres=r.p.pos.distanceTo(crossing.position);
 const finished=race.riders.map(r=>({id:r.id,time:r.finish,falls:r.falls,position:r.player.pos.toArray()}));
 race.start('time-trial',0);assert.equal(race.mode,'time-trial');assert.equal(race.count,1);race.phase='running';assert.ok(race.riders.every(r=>r.finish===null&&!r.rollout));place(race.riders[0],2);
 for(let i=0;i<240;i++)tick({moveY:1});
 assert.equal(race.phase,'finished');assert.equal(reports,2);assert.equal(race.count,1);assert.equal(r.p.ttTime,race.riders[0].finish);assert.equal(race.riders[0].rollout,null);
 race.start('race',0);assert.equal(race.phase,'countdown');assert.ok(race.riders.every(r=>r.finish===null&&!r.rollout));
 console.log(JSON.stringify({id,rolloutMetres,finished}));
 console.log(`PASS ${id}: live arrivals, safe roll-out, immutable result, trial/retry and finish framing`);
},{modulePath,source:m=>m[name],levelId:id});
