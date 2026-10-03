import assert from 'node:assert/strict';
import * as THREE from 'three';
import { withChiefRuntime } from './crab-chief-harness.mjs';
await withChiefRuntime(async ({ l, p, tick, source, module }) => {
  const boss = l.boss, dt = 1 / 60;
  assert.ok(module.normalizeCustomLevelData(source));
  assert.equal(module.parseCustomLevelJson(JSON.stringify(source)).encounter, 'crab-chief');
  assert.equal(module.normalizeCustomLevelData({ ...source, encounter: 'remote-code' }), null);
  assert.equal(l.captureData().encounter, 'crab-chief');
  assert.equal(source.components.filter(c => c.t === 'gate').length, 1);
  assert.equal(l.crystalPickup,null); assert.equal(l.cameraViews.length,0);
  assert.ok(!l.groundMeshes.some(mesh=>mesh.userData.finishPad));
  const geometry=boss.phaseGeometry,terraceRails=l.rails.filter(rail=>rail!==geometry.tongueRail);
  assert.equal(terraceRails.length,2);assert.ok(l.rails.includes(geometry.tongueRail));assert.equal(geometry.tongueActive,false);
  assert.equal(l.clockPickup, null); assert.equal(l.comboOrb, null);
  assert.equal(p.masks,2);assert.equal('playerHealth' in boss,false);
  for (let i = 0; i < 30; i++) tick();
  assert.equal(p.grounded, true); assert.equal(p.state, 'ride'); assert.ok(Math.abs(p.pos.y) < .01);
  // The old finish location cannot end an undefeated boss encounter. It
  // makes no claim about travelling there; the journey test owns that proof.
  p.respawn(l, true, false, { position: new THREE.Vector3(0, .1, -49) });
  for (let i = 0; i < 30; i++) tick();
  assert.notEqual(p.state, 'finished'); assert.equal(boss.canFinish, false);
  p.respawn(l, true);
  // Body collision and both real grind paths use ordinary Player controls.
  p.respawn(l, true, false, { position: new THREE.Vector3(0, .1, -21) });
  for (let i = 0; i < 150; i++) tick({ moveY: 1 });
  assert.ok(p.pos.z >= boss.bodyBox.max.z+.35 && p.grounded, 'rider passed through the carapace');
  for (const side of [-1, 1]) {
    p.respawn(l, true, false, { position: new THREE.Vector3(side * 10.8, .1, 4.5) });
    let railFrames=0;
    for (let i = 0; i < 200; i++) {
      if (p.state === 'grind') {railFrames++;tick({ grindHeld: true, moveY: 1, moveX: Math.max(-.75, Math.min(.75, -p.balance * 1.9)) });}
      else { const dx = side * 14 - p.pos.x, dz = -10 - p.pos.z, d = Math.hypot(dx, dz);
        tick({ grindHeld: true, moveX: dx / d, moveY: -dz / d }); }
    }
    assert.ok(railFrames>25,`${side<0?'west':'east'} terrace rail did not support a real grind`);
    assert.equal(boss.grindDistance,0);assert.equal(boss.charged,false,'ordinary terrace grind earned tongue credit');assert.equal(boss.health,9);
    assert.equal(p.totalDeaths, 0); assert.equal(p.isBailing, false);
  }
  p.respawn(l, true);
  for (let i = 0; i < 130; i++) tick({ moveY: 1, spinPressed: i % 24 === 0 });
  assert.ok(l.activeCheckpoint, 'arrival checkpoint was not reachable'); const saved = l.currentSpawn.clone();
  // This hazard fixture starts outside the native shelf, inside the authored
  // deep lagoon. The real fall/death path must return to the earned checkpoint;
  // traversal through the arena remains the input-only journey's responsibility.
  p.respawn(l,false,false,{position:new THREE.Vector3(48,2,14)});
  for (let i = 0; i < 240 && p.state !== 'dead'; i++) tick();
  assert.equal(p.state, 'dead', 'deep lagoon did not kill a fall');
  for (let i = 0; i < 240 && p.state === 'dead'; i++) tick();
  assert.equal(p.state, 'ride'); assert.ok(p.pos.distanceTo(saved) < 1, 'lagoon death missed the earned checkpoint');assert.equal(p.masks,2);
  p.respawn(l, true);

  const model = boss.model, toes = model.diagnostics.toes;
  assert.ok(model.diagnostics.triangles < 8500, 'boss exceeded the low-poly budget');
  assert.equal(model.diagnostics.provider,'Meshy');assert.ok(model.diagnostics.joints>=20);
  const states = ['waiting','intro', 'idle', 'slam-tell', 'slam', 'recover', 'tongue-form','tongue-open','ramp-form','ramp-open','hurt', 'volley-tell', 'volley', 'sweep-tell', 'sweep', 'phase', 'defeated'];
  for (const state of states) for (let i = 0; i <= 180; i++) {
    const time = i / 60;
    model.pose({ time, stateTime: time, state, phase: state.startsWith('tongue')?2:state==='recover'?1:3, target: new THREE.Vector3(6, 0, -14),
      left: true, exposed: state === 'recover' && time > .7 || state==='tongue-open'||state==='ramp-open', defeated: state === 'defeated' });
    assert.deepEqual(model.root.scale.toArray(), [1, 1, 1]); assert.deepEqual(model.diagnostics.toes, toes);
    model.root.traverse(node => { for (const value of [...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()]) assert.ok(Number.isFinite(value)); });
  }
  model.pose({ time: 3, stateTime: 3, state: 'defeated', phase: 3, target: new THREE.Vector3(), left: true, exposed: false, defeated: true });
  const settled = model.arms.map(arm => arm.wrist.toArray());
  model.pose({ time: 6, stateTime: 6, state: 'defeated', phase: 3, target: new THREE.Vector3(), left: true, exposed: false, defeated: true });
  assert.deepEqual(model.arms.map(arm => arm.wrist.toArray()), settled, 'defeat claws failed to settle');

  // Contact/attack unit scenarios use the actual generated tongue Rail and
  // sand ground object. Production movement is proven separately by the pilot.
  const actor = { position:new THREE.Vector3(0,0,-16),state:'ride',speed:0,grounded:true,
    skating:false,grinding:false,attacking:false,spinning:false,immune:true,shielded:false,rail:null,support:null };
  const step=()=>{const result=boss.step(dt,actor);boss.present(dt);return result;};
  const until=predicate=>{for(let i=0;i<1800&&!predicate();i++)step();assert.ok(predicate(),`FSM timed out in ${boss.state}`);};
  const rest=()=>{Object.assign(actor,{state:'ride',speed:0,grounded:true,skating:false,grinding:false,attacking:false,spinning:false,rail:null,support:null});actor.position.set(0,0,-16);};
  const waitForOpening=()=>{rest();until(()=>boss.exposed);};
  const strikeTongue=()=>{
    waitForOpening();assert.equal(boss.state,'tongue-open');assert.equal(geometry.tongueActive,true);
    const hp=boss.health,grindBefore=boss.grindDistance;
    // Unrelated grind metres and skating/spinning into the pearl are inert.
    Object.assign(actor,{state:'grind',grounded:false,grinding:true,skating:true,speed:12,rail:terraceRails[0],attacking:true,spinning:true});
    for(let i=0;i<65;i++){actor.position.copy(terraceRails[0].pointAt(i*.2));assert.equal(step().strike,false);}
    actor.position.copy(geometry.tongueMouth);assert.equal(step().strike,false);
    assert.equal(boss.charge,0);assert.equal(boss.health,hp);assert.equal(boss.grindDistance,grindBefore);
    Object.assign(actor,{state:'ride',grounded:true,grinding:false,rail:null});actor.position.copy(boss.pearl);actor.position.y=0;
    assert.equal(step().strike,false,'phase 2 accepted a pearl spin');
    // Being at the mouth without covering the tongue is not a grind.
    Object.assign(actor,{state:'grind',grounded:false,grinding:true,rail:geometry.tongueRail,attacking:false,spinning:false});
    actor.position.copy(geometry.tongueMouth);assert.equal(step().strike,false,'tongue end contact skipped the required grind');
    actor.position.copy(geometry.tongueEntry);step();
    let result,earlyCharged=false;
    for(let distance=0;distance<=geometry.tongueRail.totalLength+.2;distance+=.2){
      actor.position.copy(geometry.tongueRail.pointAt(Math.min(distance,geometry.tongueRail.totalLength)));result=step();
      if(result.strike)break;
      if(boss.charged){earlyCharged=true;assert.equal(boss.health,hp,'tongue struck before reaching its mouth');}
    }
    assert.equal(earlyCharged,true);assert.equal(result?.strike,true,'full tongue grind missed the mouth strike');assert.equal(boss.health,hp-1);
    const strike=boss.strikes.at(-1);assert.equal(strike.kind,'tongue');assert.ok(strike.tongueMetres>=6);assert.ok(geometry.tongueFraction(actor.position)>.94);
    for(let i=0;i<4;i++){assert.equal(step().strike,false);assert.equal(boss.health,hp-1,'one tongue opening accepted multiple hits');}
  };
  const strikeSand=()=>{
    waitForOpening();assert.equal(boss.state,'ramp-open');assert.equal(geometry.rampActive,true);
    const hp=boss.health,head=()=>actor.position.set(boss.model.root.position.x,5.5,boss.model.root.position.z);
    Object.assign(actor,{state:'air',grounded:false,skating:true,grinding:false,speed:14,rail:null,support:null,attacking:true,spinning:true});
    head();assert.equal(step().strike,false,'phase 3 accepted an unearned aerial spin');assert.equal(boss.diagnostics.launchTime,0);
    const contact=(speed,support=geometry.sandRamp)=>{
      Object.assign(actor,{state:'ride',grounded:true,skating:true,speed,support,spinning:false});
      actor.position.copy(geometry.launchPoint);assert.equal(step().strike,false);
    };
    const launch=()=>{Object.assign(actor,{state:'air',grounded:false,support:null});head();return step();};
    contact(geometry.requiredSpeed-.1);actor.spinning=true;assert.equal(launch().strike,false,'slow sand contact minted a launch');assert.equal(boss.diagnostics.launchTime,0);
    contact(geometry.requiredSpeed+2,l.groundMeshes.find(mesh=>mesh!==geometry.sandRamp));actor.spinning=true;
    assert.equal(launch().strike,false,'ordinary floor minted a sand launch');assert.equal(boss.diagnostics.launchTime,0);
    contact(geometry.requiredSpeed+2);assert.ok(boss.diagnostics.rampSpeed>=geometry.requiredSpeed);launch();
    assert.ok(boss.diagnostics.launchTime>0);assert.equal(boss.health,hp);
    actor.attacking=true;actor.spinning=false;head();assert.equal(step().strike,false,'generic air attack replaced the required spin');
    actor.spinning=true;actor.position.y=3.9;assert.equal(step().strike,false,'low spin reached the chief');
    actor.position.y=10.1;assert.equal(step().strike,false,'spin above the chief counted');
    head();actor.position.x+=3.4;assert.equal(step().strike,false,'spin away from the chief counted');
    // A grounded return clears the launch ticket; a fresh fast ramp departure
    // must earn it again before the valid height/XZ/spin can remove one segment.
    Object.assign(actor,{state:'ride',grounded:true,support:null});actor.position.set(0,0,1);step();assert.equal(boss.diagnostics.launchTime,0);
    contact(geometry.requiredSpeed+2);launch();actor.spinning=true;head();assert.equal(step().strike,true);assert.equal(boss.health,hp-1);
    const strike=boss.strikes.at(-1);assert.equal(strike.kind,'sand-spin');assert.ok(strike.rampSpeed>=geometry.requiredSpeed);
    for(let i=0;i<4;i++){assert.equal(step().strike,false);assert.equal(boss.health,hp-1,'one sand opening accepted multiple hits');}
  };
  boss.reset(true);const stationary=boss.time;actor.state='dead';step();assert.equal(boss.time,stationary);rest();
  for(let hit=0;hit<3;hit++){
    waitForOpening();const hp=boss.health;actor.position.copy(boss.pearl);actor.position.y=0;assert.equal(step().strike,false,'walking into the pearl dealt damage');
    actor.attacking=true;assert.equal(step().strike,true);assert.equal(boss.health,hp-1);actor.attacking=false;
    for(let i=0;i<4;i++){assert.equal(step().strike,false);assert.equal(boss.health,hp-1,'one pearl opening accepted multiple strikes');}
  }
  rest();until(()=>boss.phase===2);p.masks=0;p.respawn(l,false);assert.equal(boss.phase,2);assert.equal(boss.health,6);assert.equal(p.masks,2);
  assert.equal(geometry.tongueActive,false);assert.equal(geometry.rampActive,false);assert.equal('playerHealth' in boss,false);
  for(let hit=0;hit<3;hit++)strikeTongue();
  rest();until(()=>boss.phase===3);boss.reset(false);assert.equal(boss.phase,3);assert.equal(boss.health,3);assert.equal(geometry.rampActive,false);
  for(let hit=0;hit<3;hit++)strikeSand();
  assert.deepEqual(boss.strikes.map(strike=>strike.kind),['pearl','pearl','pearl','tongue','tongue','tongue','sand-spin','sand-spin','sand-spin']);
  assert.equal(boss.health,0);assert.equal(boss.defeated,true);assert.equal(boss.canFinish,false);
  until(()=>boss.canFinish);boss.reset(false);assert.equal(boss.canFinish,true,'victory lost after a lagoon retry');
  boss.reset(true);assert.equal(boss.health,9);assert.equal(boss.phase,1);assert.equal(boss.canFinish,false);

  // Telegraph lock, swept-wave damage, mask survival, cooldown and lethal
  // unmasked contact. Damage owns masks through Player, with no heart pool.
  rest();actor.immune=false;until(()=>boss.state==='slam-tell');const locked=boss.target.clone();actor.position.x=8;
  for(let i=0;i<20;i++)step();assert.ok(boss.target.equals(locked),'aim moved after the telegraph');
  actor.position.copy(locked);until(()=>boss.state==='slam');let damage;
  for(let i=0;i<15;i++){const result=step();if(result.hurt)damage=result;}
  assert.equal(damage?.hurt,true);assert.equal(damage?.fatal,true);assert.equal(boss.playerHits,1);
  for(let i=0;i<30;i++)assert.equal(step().hurt,false,'hazard applied mask damage every frame');
  boss.reset(true);rest();actor.shielded=true;actor.immune=false;until(()=>boss.state==='slam');damage=undefined;
  for(let i=0;i<15;i++){const result=step();if(result.hurt)damage=result;}
  assert.equal(damage?.hurt,true);assert.equal(damage?.fatal,false);assert.equal('playerHealth' in boss.diagnostics,false);
  p.respawn(l,true,false,{position:new THREE.Vector3(0,.1,-16)});assert.equal(p.masks,2);const maskStates=[p.masks],startingLives=p.lives;
  for(let i=0;i<2500&&p.state!=='dead';i++){tick();if(p.masks!==maskStates.at(-1))maskStates.push(p.masks);}
  assert.deepEqual(maskStates,[2,1,0]);assert.equal(p.state,'dead');assert.equal(p.lives,startingLives-1,'third unmasked hit did not cost a life');assert.equal(boss.playerHits,3);
  const stopped=boss.time;for(let i=0;i<10;i++)tick();assert.equal(boss.time,stopped,'fight advanced during the death fade');
  p.respawn(l,false);assert.equal(p.masks,2);
  console.log(`PASS Crab Chief: editor schema, supported spawn, body/checkpoint/lagoon rules, no crystal/warp pad, ${model.diagnostics.triangles} triangles and all new poses finite; nine phase-specific strikes, irrelevant terrace rails, required tongue arc/end, fast sand contact→air ticket→spin/height/range, phase/victory retries, locked telegraphs and two-mask→fatal damage with no hearts.`);
});
