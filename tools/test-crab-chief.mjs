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
  assert.equal(l.rails.length, 2); assert.equal(l.clockPickup, null); assert.equal(l.comboOrb, null);
  for (let i = 0; i < 30; i++) tick();
  assert.equal(p.grounded, true); assert.equal(p.state, 'ride'); assert.ok(Math.abs(p.pos.y) < .01);
  // A gate fixture proves that the production finish-pad path is locked. It
  // makes no claim about travelling there; the journey test owns that proof.
  p.respawn(l, true, false, { position: new THREE.Vector3(0, .1, -49) });
  for (let i = 0; i < 30; i++) tick();
  assert.notEqual(p.state, 'finished'); assert.equal(boss.canFinish, false);
  p.respawn(l, true);
  // Body collision and both real grind paths use ordinary Player controls.
  p.respawn(l, true, false, { position: new THREE.Vector3(0, .1, -21) });
  for (let i = 0; i < 150; i++) tick({ moveY: 1 });
  assert.ok(p.pos.z >= -25.1 && p.grounded, 'rider passed through the carapace');
  for (const side of [-1, 1]) {
    p.respawn(l, true, false, { position: new THREE.Vector3(side * 10.8, .1, 4.5) });
    for (let i = 0; i < 200; i++) {
      if (p.state === 'grind') tick({ grindHeld: true, moveY: 1, moveX: Math.max(-.75, Math.min(.75, -p.balance * 1.9)) });
      else { const dx = side * 14 - p.pos.x, dz = -10 - p.pos.z, d = Math.hypot(dx, dz);
        tick({ grindHeld: true, moveX: dx / d, moveY: -dz / d }); }
    }
    assert.ok(boss.grindDistance > 8 && boss.charged, `${side < 0 ? 'west' : 'east'} rail never earned a real charge`);
    assert.equal(p.totalDeaths, 0); assert.equal(p.isBailing, false);
  }
  p.respawn(l, true);
  for (let i = 0; i < 130; i++) tick({ moveY: 1, spinPressed: i % 24 === 0 });
  assert.ok(l.activeCheckpoint, 'arrival checkpoint was not reachable'); const saved = l.currentSpawn.clone();
  // Return onto the entrance pier before walking into the lagoon, avoiding
  // the intentionally solid pearl rail and raised terrace on the side court.
  for (let i = 0; i < 70; i++) tick({ moveY: -1 });
  for (let i = 0; i < 230 && p.state !== 'dead'; i++) tick({ moveX: 1, jumpPressed: i === 40, jumpHeld: i === 40 });
  assert.equal(p.state, 'dead', 'deep lagoon did not kill a fall');
  for (let i = 0; i < 240 && p.state === 'dead'; i++) tick();
  assert.equal(p.state, 'ride'); assert.ok(p.pos.distanceTo(saved) < 1, 'lagoon death missed the earned checkpoint');
  p.respawn(l, true);

  const model = boss.model, toes = model.diagnostics.toes;
  assert.ok(model.diagnostics.triangles < 5000, 'boss exceeded the low-poly budget');
  const states = ['intro', 'idle', 'slam-tell', 'slam', 'recover', 'hurt', 'volley-tell', 'volley', 'sweep-tell', 'sweep', 'phase', 'defeated'];
  for (const state of states) for (let i = 0; i <= 180; i++) {
    const time = i / 60;
    model.pose({ time, stateTime: time, state, phase: 3, target: new THREE.Vector3(6, 0, -14),
      left: true, exposed: state === 'recover' && time > .7, defeated: state === 'defeated' });
    assert.deepEqual(model.root.scale.toArray(), [1, 1, 1]); assert.deepEqual(model.diagnostics.toes, toes);
    model.root.traverse(node => { for (const value of [...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()]) assert.ok(Number.isFinite(value)); });
  }
  model.pose({ time: 3, stateTime: 3, state: 'defeated', phase: 3, target: new THREE.Vector3(), left: true, exposed: false, defeated: true });
  const settled = model.arms.map(arm => arm.wrist.toArray());
  model.pose({ time: 6, stateTime: 6, state: 'defeated', phase: 3, target: new THREE.Vector3(), left: true, exposed: false, defeated: true });
  assert.deepEqual(model.arms.map(arm => arm.wrist.toArray()), settled, 'defeat claws failed to settle');

  // FSM/armor/charge unit scenarios are separate from the production pilot.
  const actor = { position: new THREE.Vector3(0, 0, -16), state: 'ride', speed: 0, grounded: true,
    skating: false, grinding: false, attacking: false, immune: true, shielded: false };
  const step = () => { const result = boss.step(dt, actor); boss.present(dt); return result; };
  const until = predicate => { for (let i = 0; i < 1800 && !predicate(); i++) step(); assert.ok(predicate(), `FSM timed out in ${boss.state}`); };
  const charge = () => {
    actor.attacking = false; actor.grinding = true; actor.skating = true; actor.speed = 9;
    actor.position.set(14, .9, 0);
    for (let i = 0; i < 70; i++) { actor.position.z -= .15; step(); }
    assert.equal(boss.charged, true); actor.grinding = false; actor.skating = false; actor.speed = 0;
  };
  boss.reset(true);
  const stationary = boss.time; actor.state = 'dead'; step(); assert.equal(boss.time, stationary); actor.state = 'ride';
  for (let hit = 0; hit < 9; hit++) {
    actor.position.copy(boss.pearl); actor.attacking = false;
    until(() => boss.exposed);
    const hp = boss.health; step(); assert.equal(boss.health, hp, 'walking into the pearl dealt damage');
    if (boss.phase > 1) {
      actor.attacking = true; step(); assert.equal(boss.health, hp, 'unearned strike bypassed shield'); actor.attacking = false;
      // Foot speed and position alone cannot mint a rail charge in phase 2.
      if (boss.phase === 2) { actor.speed = 12; for (let i = 0; i < 20; i++) { actor.position.x += .2; step(); }
        assert.equal(boss.charge, 0); actor.speed = 0; }
      charge(); actor.position.copy(boss.pearl); until(() => boss.exposed);
    }
    actor.attacking = true; assert.equal(step().strike, true); actor.attacking = false;
    assert.equal(boss.health, hp - 1); for (let i = 0; i < 4; i++) step(); assert.equal(boss.health, hp - 1, 'one opening accepted multiple strikes');
    if (hit === 3) { until(() => boss.state !== 'hurt'); boss.reset(false); assert.equal(boss.phase, 2); assert.equal(boss.health, 6); assert.equal(boss.playerHealth, 3); }
    if (hit === 3) { // Complete the restored phase's lost test hit so the
      // remaining numbered loop still reaches all nine actual HP reductions.
      until(() => boss.exposed); charge(); actor.position.copy(boss.pearl); until(() => boss.exposed); actor.attacking = true; step(); actor.attacking = false;
    }
  }
  assert.equal(boss.health, 0); assert.equal(boss.defeated, true); assert.equal(boss.canFinish, false);
  until(() => boss.canFinish); boss.reset(false); assert.equal(boss.canFinish, true, 'victory lost after a lagoon retry');
  boss.reset(true); assert.equal(boss.health, 9); assert.equal(boss.phase, 1); assert.equal(boss.canFinish, false);

  // Telegraph lock, swept wave damage, cooldown, masks and terminal damage.
  actor.position.set(0, 0, -16); actor.immune = false; actor.attacking = false;
  until(() => boss.state === 'slam-tell'); const locked = boss.target.clone(); actor.position.x = 8;
  for (let i = 0; i < 20; i++) step(); assert.ok(boss.target.equals(locked), 'aim moved after the telegraph');
  actor.position.copy(locked); until(() => boss.state === 'slam');
  let hurt = false; for (let i = 0; i < 10; i++) hurt ||= step().hurt;
  assert.equal(hurt, true); assert.equal(boss.playerHealth, 2);
  for (let i = 0; i < 30; i++) step(); assert.equal(boss.playerHealth, 2, 'hazard drained hearts every frame');
  boss.reset(true); actor.shielded = true; actor.position.set(0, 0, -16);
  until(() => boss.state === 'slam'); for (let i = 0; i < 12; i++) step(); assert.equal(boss.playerHealth, 3);
  boss.reset(true); actor.shielded = false; actor.position.set(0, 0, -16);
  let fatal = false; for (let i = 0; i < 2500 && !fatal; i++) fatal = step().fatal;
  assert.equal(fatal, true); assert.equal(boss.playerHealth, 0);
  console.log(`PASS Crab Chief: bounded editor round-trip, supported spawn, locked real gate, ${model.diagnostics.triangles} triangles, planted toes, finite animation settle, three-phase FSM, armor/charge, one-hit openings, phase/victory retry, telegraph lock and damage/mask rules.`);
});
