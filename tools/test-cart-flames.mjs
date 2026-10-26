import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withBlockworksRuntime, normalizeGameInput } from './blockworks-runner.mjs';
await withBlockworksRuntime(async e => {
  const { CART_FLAMES, initialFlameRecharge, sideFlameContact } = await e.server.ssrLoadModule('/src/golf-cart/flameTactics.ts');
  const { SkateRace } = await e.server.ssrLoadModule('/src/race/runtime.ts');
  const seed = 47531, slots = initialFlameRecharge(8, seed);
  for (let seed = 1; seed <= 100; seed++) {
    const phases = initialFlameRecharge(8, seed), sorted = [...phases].sort((a,b) => a-b);
    assert.ok(phases.every(v => v > CART_FLAMES.startGrace && v < CART_FLAMES.recharge));
    assert.ok(sorted.slice(1).every((v,i) => v - sorted[i] > .25), 'starting phases bunched together');
    assert.deepEqual(phases, initialFlameRecharge(8, seed), 'replay seed changed the stagger');
  }
  assert.notDeepEqual(slots, initialFlameRecharge(8, seed + 1));
  assert.ok(new Set(Array.from({length:50}, (_,i) => initialFlameRecharge(8,i).indexOf(Math.min(...initialFlameRecharge(8,i))))).size >= 7, 'early recharge slots favor fixed racers');
  // Overtake prediction uses the same side-only volume as damage, at any yaw.
  for (const yaw of [0, .8, 2.2, -Math.PI]) {
    const source = { x:10,y:5,z:20,vx:0,vy:0,vz:0,yaw };
    const target = (side,along,sideSpeed=0,alongSpeed=0) => ({
      x:10+side*Math.cos(yaw)+along*Math.sin(yaw),y:5,z:20-side*Math.sin(yaw)+along*Math.cos(yaw),
      vx:sideSpeed*Math.cos(yaw)+alongSpeed*Math.sin(yaw),vy:0,vz:-sideSpeed*Math.sin(yaw)+alongSpeed*Math.cos(yaw),
    });
    assert.equal(sideFlameContact(source,target(4,0)),0);
    assert.equal(sideFlameContact(source,target(-4,0)),0);
    assert.equal(sideFlameContact(source,target(0,4),.4),null);
    assert.equal(sideFlameContact(source,target(7,0),.4),null);
    assert.equal(sideFlameContact(source,target(4,5,0,8),.4),null);
    assert.ok(Math.abs(sideFlameContact(source,target(4,5,0,-10),.4)-.29)<1e-9);
    assert.equal(sideFlameContact(source,{...target(4,0),y:9},.4),null);
  }
  const race = new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');race.start('race',seed);
  let c = race.carts;assert.deepEqual(c.thrustCooldown,slots);
  for(let frame=0;frame<120;frame++)race.step(e.dt,normalizeGameInput({spinPressed:true}));
  assert.equal(race.phase,'countdown');assert.deepEqual(c.thrustCooldown,slots,'countdown consumed the starting stagger');
  c.present(.2);c.present(.9);assert.deepEqual(c.thrustCooldown,slots,'rendering recharged flames');
  race.phase='running';
  for(let frame=0;frame<45;frame++)c.step(e.dt,normalizeGameInput({spinPressed:true}));
  assert.equal(c.stats.thrusters,0,'the grid fired before the initial grace elapsed');

  // Isolate a pair on real supported dirt. Other racers remain out of range.
  const world=c.fleet.physics,base=race.course.sample(45),height=c.ground(base.x,base.z).height;
  for(let id=0;id<8;id++){
    const at=race.course.sample(id<2?45:200+id*40),kart=world.carts[id];
    Object.assign(kart,{x:at.x,y:c.ground(at.x,at.z).height,z:at.z,yaw:0,vx:0,vy:0,vz:0,speed:0,health:1,grounded:true,tumbling:false});
    Object.assign(race.riders[id],{recovery:0,finish:null,knockGrace:0,star:0});c.stun[id]=0;
  }
  const source=world.carts[1],target=world.carts[0];
  Object.assign(source,{x:base.x,y:height,z:base.z});
  const put=(side,along,velocity=0)=>{Object.assign(target,{x:source.x+side,y:source.y,z:source.z+along,vx:0,vy:0,vz:velocity});c.sync();};
  c.thrustCooldown.fill(100);c.thrustCooldown[1]=0;
  for(const [side,along] of [[0,5],[0,-5],[7,0],[4,9]]){put(side,along);assert.ok(!c.drive(1).spinPressed,'rival wasted flames outside the side jets');}
  put(4,5,-10);assert.equal(c.drive(1).spinPressed,true,'rival did not anticipate an overtake');
  put(4,5,10);assert.equal(c.drive(1).spinPressed,false,'rival fired at a receding target');
  put(-4,0);assert.equal(c.drive(1).spinPressed,true,'left-side opportunity ignored');
  put(4,0);assert.equal(c.drive(1).spinPressed,true,'right-side opportunity ignored');
  race.riders[0].star=2;assert.equal(c.drive(1).spinPressed,false);race.riders[0].star=0;
  race.riders[0].knockGrace=1;assert.equal(c.drive(1).spinPressed,false);race.riders[0].knockGrace=0;
  race.riders[0].shield=2;assert.equal(c.drive(1).spinPressed,true,'shield stripping is a useful shot');race.riders[0].shield=0;
  source.tumbling=true;assert.equal(c.drive(1).spinPressed,false);source.tumbling=false;
  c.stun[1]=.3;assert.equal(c.drive(1).spinPressed,false);c.stun[1]=0;
  c.thrustCooldown[1]=.1;assert.equal(c.drive(1).spinPressed,false);c.thrustCooldown[1]=0;
  source.speed=15;race.riders[1].progress=race.riders[0].progress=45;
  c.thrustCooldown[1]=0;
  const lane=c.flameLane(1,2.2);assert.notEqual(lane,2.2,'ready rival did not line up alongside its target');
  assert.ok(lane>=-.3&&lane<=4.7,'flanking abandoned the normal racing lane');
  c.thrustCooldown[1]=3;assert.equal(c.flameLane(1,2.2),2.2,'recharging rival kept chasing a flame line');
  c.thrustCooldown[1]=0;race.riders[1].progress=c.jumpRanges[0].a;
  assert.equal(c.flameLane(1,2.2),2.2,'flanking changed the jump approach');
  race.riders[1].progress=45;source.speed=0;
  const shots=[],hits=[];
  c.audio.thrust=(_,index)=>shots.push({id:c.driverForCart[index],time:world.time});
  c.attack=(id,origin,power)=>hits.push({id,power});
  const drive=c.drive.bind(c);
  c.drive=id=>({...drive(id),moveX:0,moveY:0,jumpHeld:false,grabHeld:false});
  for(let frame=0;frame<13/e.dt;frame++)c.step(e.dt,normalizeGameInput({}));
  const ai=shots.filter(s=>s.id===1);
  assert.equal(ai.length,3,'rival did not use each recharged burst on the side-by-side opportunity');
  assert.ok(ai.slice(1).every((s,i)=>s.time-ai[i].time>=CART_FLAMES.recharge-e.dt/2));
  assert.equal(hits.filter(h=>h.id===0).length,3,'burst did not damage the target exactly once');
  // Human uses the same gate; holding Square never skips the refill or
  // auto-spams a fresh burst, and swapping carts cannot grant a refill.
  c.thrustCooldown[0]=0;c.step(e.dt,normalizeGameInput({spinPressed:true}));
  const humanShot=shots.filter(s=>s.id===0).length;
  c.step(e.dt,normalizeGameInput({spinPressed:true}));
  assert.equal(shots.filter(s=>s.id===0).length,humanShot);
  assert.match(c.hud().notice,/FLAMES RECHARGING/);
  c.exit(0,false);const remaining=c.thrustCooldown[0];assert.ok(remaining>5.9);
  c.step(e.dt,normalizeGameInput({}));assert.ok(Math.abs(c.thrustCooldown[0]-(remaining-e.dt))<1e-8);
  assert.equal(c.thrustTime[0],0,'leaving a kart left its flames running');
  const spare=c.count;c.actionCooldown[0]=0;
  e.p.resetRacePosition(e.l,c.exitPoint(spare,-1),e.p.raceHeading,true);
  assert.equal(c.interact(0),true);
  for(let frame=0;frame<65;frame++)c.step(e.dt,normalizeGameInput({}));
  assert.equal(c.cartForRacer[0],spare,'fixture must enter a different kart');
  assert.ok(c.thrustCooldown[0]>4.8&&c.thrustCooldown[0]<5,'taking a fresh kart reset the recharge');
  let held={};
  for(let frame=0;frame<7/e.dt;frame++){
    const input=normalizeGameInput({spinHeld:true},held);c.step(e.dt,input);held={...input};
  }
  assert.equal(c.thrustCooldown[0],0);assert.equal(shots.filter(s=>s.id===0).length,humanShot);
  race.start('race',seed);c=race.carts;assert.deepEqual(c.thrustCooldown,slots);assert.ok(c.thrustTime.every(v=>v===0));
  race.start('race',seed+1);assert.notDeepEqual(race.carts.thrustCooldown,slots);
  race.start('time-trial',seed);assert.equal(race.carts.thrustCooldown.length,1);assert.ok(race.carts.thrustCooldown[0]>0);
  const report={passed:true,recharge:CART_FLAMES.recharge,burst:CART_FLAMES.burst,startingPhases:slots,seededStagger:true,predictiveSides:true,flanking:true,jumpLinePreserved:true,protectedTargets:true,aiShots:ai,oneHitPerBurst:true,humanRecharge:true,onFootRecharge:true,cartSwapKeepsRecharge:true,restart:true};
  await writeFile(process.env.CART_FLAMES_REPORT??'/private/tmp/cart-flames.json',JSON.stringify(report,null,2)+'\n');
  console.log('PASS',JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
