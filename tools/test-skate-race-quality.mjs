import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'slipstream-race');
 const afterStep=()=>{r.p.commitRenderStep(r.l);race.commitRenderStep?.();};
 race.start('time-trial');race.phase='running';r.p.speed=12;
 let interiorCaptures=0,captures=0;const commit=r.p.commitRenderStep.bind(r.p);
 r.p.commitRenderStep=(...args)=>{captures++;return commit(...args);};
 const interpolation=[];
 for(let f=0;f<12;f++){
  const before=r.p.pos.clone(),count=captures;r.scene.updateMatrixWorld(true);
  race.step(r.dt,normalizeGameInput({moveY:1}));interiorCaptures+=captures-count;afterStep();
  const travel=r.p.pos.distanceTo(before);r.p.applyRenderInterpolation(.5);
  if(f>0&&travel>.005)interpolation.push({travel,renderAge:r.p.renderPosition.distanceTo(r.p.pos)});
  r.p.restoreRenderPose();
 }
 const cases=[];
 for(const charge of [false,true])for(const side of [-6,0,6]){
  race.start('time-trial');race.phase='running';const actor=race.riders[0],s=r.sourceModule.SLIPSTREAM_RACE_STATS.baseRaceLength-8;
  const point=race.course.sample(s,side);point.y+=.06;r.p.resetRacePosition(r.l,point,race.course.tangent(s));r.p.speed=28;
  actor.progress=actor.previousProgress=actor.anchorProgress=s;actor.anchor.copy(point);
  let maxSpeed=0,maxHeadingError=0,previous={},f=0,last;
  for(;f<7200&&!actor.falls&&actor.finish===null;f++){
   r.scene.updateMatrixWorld(true);const input=normalizeGameInput({moveY:1,jumpHeld:charge},previous);previous=input;
   const target=r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z),heading=r.p.raceHeading;
   if(target&&r.p.grounded)maxHeadingError=Math.max(maxHeadingError,Math.abs(Math.atan2(target.x*heading.z-target.z*heading.x,target.x*heading.x+target.z*heading.z))*180/Math.PI);
   last={s:actor.progress,pos:r.p.pos.toArray(),speed:r.p.speed,state:r.p.state,heading:heading.toArray(),basis:target};
   race.step(r.dt,input);afterStep();maxSpeed=Math.max(maxSpeed,Math.abs(r.p.speed));
  }
  const result={charge,side,frames:f,finished:actor.finish!==null,falls:actor.falls,maxSpeed,maxHeadingError,last};cases.push(result);console.log(JSON.stringify(result));
 }
 const result={interiorCaptures,interpolation,cases,zones:r.l.zones,views:r.l.cameraViews};
 await writeFile(process.env.RACE_QUALITY_REPORT??join(tmpdir(),'skate-race-quality.json'),JSON.stringify(result,null,2));
 if(!process.env.RACE_QUALITY_BASELINE){
  assert.equal(interiorCaptures,0,'Human render pose must be captured once, by the shared frame loop');
  assert.ok(interpolation.every(v=>v.renderAge>v.travel*.35&&v.renderAge<v.travel*.65),'The hero must interpolate between fixed poses');
  assert.ok(cases.every(v=>v.finished&&v.falls===0),'Forward control must carry all six entry lines through the final descent');
 }
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
