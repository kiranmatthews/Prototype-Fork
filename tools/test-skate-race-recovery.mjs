import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'slipstream-race');
 const reports=[];
 for(let i=0;i<race.jumps.length;i++)for(const offset of i>=1&&i<=3?[0,7]:[0]){
  race.start('time-trial');race.phase='running';const rider=race.riders[0],jump=race.jumps[i];
  const at=jump.s+offset;
  const support=race.course.support(r.l,at);
  assert.ok(support,`jump ${i} recovery anchor must be supported`);
  rider.progress=rider.anchorProgress=at;rider.anchor.copy(support);
  r.p.resetRacePosition(r.l,support,race.course.tangent(at));race.step(r.dt,{moveX:0,moveY:0});
  const returnPoint=rider.anchor.clone();
  r.p.pos.y=r.l.killY-1;r.p.state='air';r.p.grounded=false;r.p.vVel=-1;
  let maxY=support.y,frames=0;
  for(;frames<1800&&rider.progress<jump.end+8;frames++){
   const sample=race.drive(0);race.step(r.dt,sample);if(process.env.TRACE_GAP&&i===Number(process.env.TRACE_GAP)&&frames>103&&frames<220&&frames%5===0)console.log(JSON.stringify({frame:frames,s:rider.progress,recovery:rider.recovery,fall:rider.falls,p:r.p.pos.toArray(),state:r.p.state,speed:r.p.speed,vVel:r.p.vVel,charge:r.p.chargeTimer,charging:r.p.charging,skate:r.p.boardRolling,jump:sample.jumpHeld,press:sample.jumpPressed,release:sample.jumpReleased,buffer:r.p.jumpBufferCharge}));maxY=Math.max(maxY,r.p.pos.y);
  }
  const report={jump:i,offset,frames,from:at,to:rider.progress,expected:jump.end+8,falls:rider.falls,deaths:r.p.totalDeaths,maxY,support:support.toArray(),returnPoint:returnPoint.toArray(),position:r.p.pos.toArray(),speed:r.p.speed,state:r.p.state};reports.push(report);console.log(JSON.stringify(report));
  assert.ok(rider.progress>=jump.end+8,`jump ${i} must be possible after a stopped fall return`);assert.equal(r.p.totalDeaths,0);assert.equal(rider.falls,1,'Only the injected fall may require a return');
 }
 console.log('PASS every authored race jump after a zero-speed fall return');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
