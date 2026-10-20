import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'slipstream-race');race.start('time-trial',19410);race.phase='running';
 // Recorded full-render stall: the pool bank is below the reunion deck. A
 // knockdown has spent its vertical impulse and needs to settle on that bank.
 const ray=new r.THREE.Raycaster(new r.THREE.Vector3(14.2731352,704,-2225.4801552),new r.THREE.Vector3(0,-1,0));
 const bank=r.l.groundMeshes.filter(m=>r.source.components[m.userData.editorIdx]?.nm==='Catch pool 7 / bed and downhill bank');
 const floor=ray.intersectObjects(bank,false)[0]?.point;assert.ok(floor);
 const rider=race.riders[0],at=race.course.project(floor).s;
 r.p.resetRacePosition(r.l,floor,race.course.tangent(at));rider.progress=rider.previousProgress=rider.anchorProgress=at;rider.anchor.copy(floor);
 r.p.invulnTimer=0; // The recorded rider had already spent spawn protection.
 assert.ok(r.p.beginRaceStun(0,1),'A natural knockdown owns the initial state');
 const tuning={...r.TUNING};let recoveredAt=null,frame=0;
 for(;frame<900&&rider.progress<at+45;frame++){
  r.scene.updateMatrixWorld(true);race.step(r.dt,race.drive(0));r.p.commitRenderStep(r.l);race.commitRenderStep();
  if(recoveredAt===null&&!r.p.skateCameraBailing)recoveredAt=frame;
 }
 const report={frame,recoveredAt,from:at,to:rider.progress,position:r.p.pos.toArray(),state:r.p.state,bailing:r.p.skateCameraBailing,falls:rider.falls,deaths:r.p.totalDeaths};console.log(JSON.stringify(report));
 assert.ok(recoveredAt!==null&&recoveredAt<240,'The bank must support a finite get-up beneath the deck');
 assert.ok(rider.progress>=at+45,'Normal controller input must continue beyond the pool');
 assert.equal(rider.falls,0);assert.equal(r.p.totalDeaths,0);assert.deepEqual(r.TUNING,tuning);
 console.log('PASS stopped pool-bank knockdown settles and continues without a reset or tuning changes');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
