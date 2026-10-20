import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'slipstream-race');const reports=[];
 for(const offset of [-20,-10,0,10,20]){
  race.start('time-trial');race.phase='running';const rider=race.riders[0],at=race.course.length-3;
  const point=race.course.sample(at,offset),ray=new r.THREE.Raycaster(point.clone().add(new r.THREE.Vector3(0,15,0)),new r.THREE.Vector3(0,-1,0),0,30);
  const hit=ray.intersectObjects(r.l.groundMeshes,false)[0];assert.ok(hit);point.y=hit.point.y+.05;
  r.p.resetRacePosition(r.l,point,race.course.tangent(at));r.p.speed=32;rider.progress=at;rider.anchor.copy(point);rider.anchorProgress=at;
  for(let i=0;i<30&&race.phase!=='finished';i++)race.step(r.dt,{moveX:0,moveY:1,jumpHeld:true});
  assert.equal(race.phase,'finished',`finish lane ${offset}`);assert.equal(rider.falls,0);reports.push({offset,time:rider.finish,position:r.p.pos.toArray()});
 }
 console.log(JSON.stringify(reports));console.log('PASS supported full-width finish: centre and both outer racing lines');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
