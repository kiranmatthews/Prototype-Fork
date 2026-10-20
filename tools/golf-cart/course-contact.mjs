import assert from 'node:assert/strict';
import * as THREE from 'three';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';

await withBlockworksRuntime(async runtime=>{
  const {SkateRace}=await runtime.server.ssrLoadModule('/src/race/runtime.ts');
  const {CountryClubCarts}=await runtime.server.ssrLoadModule('/src/golf-cart/course.ts');
  const race=new SkateRace(runtime.scene,runtime.p),traffic=new CountryClubCarts(runtime.scene);
  race.attach(runtime.l,'country-club');traffic.attach(runtime.l,'country-club');race.start('race',0);
  traffic.step(runtime.dt,runtime.p,race);
  const parked=traffic.fleet.physics.carts.map(c=>[c.x,c.y,c.z]);
  for(let i=0;i<120;i++)traffic.step(runtime.dt,runtime.p,race);
  assert.deepEqual(traffic.fleet.physics.carts.map(c=>[c.x,c.y,c.z]),parked,'countdown cannot move traffic into the grid');

  // Arrange one real rider and physical cart in contact before each probe.
  const setup=(id,shield=0,spin=false)=>{
    race.start('race',0);traffic.step(runtime.dt,runtime.p,race);race.phase='running';
    const r=race.riders[id],p=r.player,point=race.course.sample(240,0);
    p.resetRacePosition(runtime.l,point,race.course.tangent(240));p.invulnTimer=0;p.speed=0;p.spinTimer=spin?.3:0;
    r.progress=240;r.knockGrace=0;r.shield=shield;
    const c=traffic.fleet.physics.carts[0];
    Object.assign(c,{x:p.pos.x+3,z:p.pos.z,y:p.pos.y,yaw:Math.PI/2,vx:-18,vz:0,speed:18,grounded:true});
    traffic.roaming.progress[0]=240;
    return {r,p,c};
  };
  const rival=setup(3);traffic.step(runtime.dt,runtime.p,race);
  assert.equal(traffic.stats.contacts,1);assert.equal(traffic.stats.knockdowns,1);
  assert.ok(rival.p.skateCameraBailing,'carts disrupt a rival using the actual race recovery');
  assert.ok(traffic.roaming.drivers[0].clearUntil>traffic.fleet.physics.time+8,'contact sends the cart away while the pack passes');
  assert.ok(!runtime.p.skateCameraBailing,'unrelated human is not hit');
  const protectedRider=setup(2,8);traffic.step(runtime.dt,runtime.p,race);
  assert.equal(protectedRider.r.shield,0,'normal race shield absorbs the cart hit');
  assert.ok(!protectedRider.p.skateCameraBailing);assert.equal(traffic.stats.knockdowns,0);
  const spinner=setup(0,0,true);traffic.step(runtime.dt,runtime.p,race);
  assert.equal(traffic.stats.spinHits,1);assert.ok(!spinner.p.skateCameraBailing);
  assert.ok(spinner.c.hits>0,'spin damages and kicks the physical cart');
  const above=setup(0);above.p.pos.y+=5;traffic.step(runtime.dt,runtime.p,race);
  assert.equal(traffic.stats.contacts,0,'a rider above the roof clears the cart');

  race.start('time-trial',0);traffic.step(runtime.dt,runtime.p,race);
  assert.equal(race.count,1);assert.equal(traffic.fleet.models.length,10);
  assert.deepEqual(traffic.fleet.physics.carts.map(c=>[c.x,c.y,c.z]),parked,'trial restart restores the complete traffic grid');
  assert.ok(traffic.fleet.physics.carts.every(c=>c.health===1));
  assert.deepEqual(traffic.stats,{contacts:0,knockdowns:0,spinHits:0});
  const geometry=traffic.fleet.models[0].root.getObjectByName('chassis').geometry;
  assert.equal(geometry,traffic.fleet.models[9].root.getObjectByName('chassis').geometry,'ten large carts still share geometry');
  traffic.attach({walls:[]},'flats');assert.equal(traffic.fleet,null);
  console.log('Country Club: doubled contacts, rival knockdown, shield, spin, roof clearance, countdown, solo restart and unload passed.');
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club'});
