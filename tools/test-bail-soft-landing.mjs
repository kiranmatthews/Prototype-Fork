import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const reportOnly = process.argv.includes('--report');
await withSkateRuntime(async ({ THREE, Player, Level, CONST, TUNING, server, player: p }) => {
  const input = makeInput({ inventoryHeld: true });
  p.rawInput = input; p.invulnTimer = 0; p.beginPvpKnockdown(0, 1);
  p.syncVisual(input, 0); p.group.updateMatrixWorld(true);
  p.simRand = () => { throw new Error('floor response consumed gameplay randomness'); };
  const kick = p.kickRagdollContact.bind(p);
  let suppliedImpulse = new THREE.Vector3(), suppliedTravel = new THREE.Vector3();
  p.kickRagdollContact = (normal, impulse, into, travel) => {
    suppliedImpulse.copy(impulse);
    suppliedTravel.set(p.axisF.x * p.speed, p.vVel, p.axisF.z * p.speed);
    kick(normal, impulse, into, travel);
  };
  const normal = new THREE.Vector3(0, 1, 0), incoming = new THREE.Vector3(), outgoing = new THREE.Vector3();
  const resolve = (into, speed = 10, bounces = 0, n = normal) => {
    incoming.set(0, 0, -speed).addScaledVector(n, -into);
    p.axisF.copy(incoming).setY(0).normalize();
    if (p.axisF.lengthSq() === 0) p.axisF.set(0, 0, -1);
    p.axisL.set(p.axisF.z, 0, -p.axisF.x);
    p.speed = Math.hypot(incoming.x, incoming.z); p.vVel = incoming.y;
    p.ragBounces = bounces; p.state = 'air'; p.grounded = false;
    const bounced = p.resolveRagdollGroundBounce({ y: 0, normal: n, name: 'test floor' });
    outgoing.copy(p.axisF).multiplyScalar(p.speed).setY(p.vVel);
    // The ordinary supported landing removes normal velocity on a settle.
    if (!bounced) outgoing.addScaledVector(n, -outgoing.dot(n));
    return { bounced, outgoing: outgoing.toArray(), normalSpeed: outgoing.dot(n),
      impulseError: suppliedTravel.clone().add(suppliedImpulse).distanceTo(outgoing),
      energyGain: outgoing.lengthSq() - incoming.lengthSq() };
  };
  const below = resolve(3.2 - 1e-5), above = resolve(3.2 + 1e-5);
  const cutoffJump = new THREE.Vector3(...below.outgoing).distanceTo(new THREE.Vector3(...above.outgoing));
  const firstHeavy = resolve(20, 8, 0), lateHeavy = resolve(20, 8, 7);
  const countDependence = new THREE.Vector3(...firstHeavy.outgoing).distanceTo(new THREE.Vector3(...lateHeavy.outgoing));
  const soft = resolve(1, 10);
  const curve = [.3, 1, 1.5, 2, 3, 3.2, 4, 4.5, 8, 20].map(into => ({ into, ...resolve(into) }));
  let maxEnergyGain = -Infinity, maxImpulseError = 0, cases = 0;
  for (const slope of [0, -.5, .5, .85]) {
    const n = new THREE.Vector3(slope, Math.sqrt(1 - slope * slope), 0);
    for (const into of [.1, 1, 1.49, 1.51, 3.19, 3.21, 5, 18, 40])
      for (const speed of [0, 2, 15, 50]) for (const bounces of [0, 3, 9]) {
        const row = resolve(into, speed, bounces, n); cases++;
        maxEnergyGain = Math.max(maxEnergyGain, row.energyGain);
        maxImpulseError = Math.max(maxImpulseError, row.impulseError);
        assert.ok(row.outgoing.every(Number.isFinite));
      }
  }
  const scene = new THREE.Scene(), level = new Level(scene, { id: 'soft-floor-test', name: 'Soft floor', data: {
    v: 1, name: 'Soft floor', spawn: [0, .04, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [300, 1, 300] }, { t: 'gate', p: [100, 0, -100] }],
  } });
  const original = { ragBounce: TUNING.ragBounce, riseGravity: TUNING.riseGravity, fallGravity: TUNING.fallGravity };
  const settlements = [], landingOwnership = [], gravity = [];
  const { sfx } = await server.ssrLoadModule('/src/audio.ts');
  const originalPlay = sfx.play, sounds = [];
  try {
    sfx.play = (name, volume, pitch) => { if (name === 'crunch') sounds.push({ volume, pitch }); };
    resolve(20, 8, 7); resolve(8); const audibleHits = sounds.length;
    resolve(.3); resolve(1.49); resolve(3);
    assert.equal(sounds.length, audibleHits, 'tiny contact hops spammed impact audio');
    assert.ok(sounds[0].volume > sounds[1].volume && sounds[0].pitch < sounds[1].pitch,
      'the heavier floor hit did not sound louder and lower');
    sfx.play = originalPlay;

    // Exercise the whole landing branch with stale board/slide tags. It must
    // not replace the resolved skid with the clean-landing speed projection.
    for (const parkControls of [false, true]) {
      const actor = new Player(scene); actor.rawInput = input; actor.respawn(level, true);
      actor.step(CONST.fixedStep, input, level); actor.invulnTimer = 0;
      actor.bail(false, 20, 'landing', 2); actor.state = 'air'; actor.grounded = false;
      actor.pos.set(0, .01, 0); actor.prevPos.copy(actor.pos);
      actor.speed = 20; actor.vVel = -.1; actor.airMomentum = true;
      actor.slideFromWalk = true; actor.parkControls = parkControls; actor.airFromSkate = true;
      TUNING.ragBounce = 0;
      let expected = null;
      const resolveContact = actor.resolveRagdollGroundBounce.bind(actor);
      actor.resolveRagdollGroundBounce = hit => {
        const bounced = resolveContact(hit); expected = actor.speed; return bounced;
      };
      actor.stepAir(CONST.fixedStep, input, level, false);
      assert.ok(expected !== null && actor.grounded && !actor.freeSkate);
      assert.ok(Math.abs(actor.speed - expected) < 1e-9, 'clean landing stole the bail skid');
      const applied = actor.speed;
      actor.step(CONST.fixedStep, input, level);
      assert.ok(Math.abs(actor.speed - expected) < 1, 'the next tick reapplied the walking-speed cutoff');
      assert.equal(actor.slideFromWalk, false, 'bail left a stale slide-landing tag');
      landingOwnership.push({ parkControls, expected, applied, followingTick: actor.speed });
      scene.remove(actor.group);
    }
    Object.assign(TUNING, original);
    for (const contacts of [0, 1]) for (const upward of [false, true]) {
      const actor = new Player(scene); actor.rawInput = input; actor.respawn(level, true);
      actor.invulnTimer = 0; actor.bail(false, 0, 'landing', 6);
      actor.state = 'air'; actor.grounded = false; actor.airFromSkate = false; actor.airGrav = 'foot';
      actor.pos.set(0, 10, 0); actor.prevPos.copy(actor.pos); actor.vVel = upward ? 6 : -6;
      actor.ragImpacts = contacts; const before = actor.vVel;
      actor.stepAir(CONST.fixedStep, input, level, false);
      const measured = (before - actor.vVel) / CONST.fixedStep;
      const expected = contacts ? Math.sqrt(TUNING.riseGravity * TUNING.fallGravity)
        : upward ? TUNING.riseGravity : TUNING.fallGravity;
      assert.ok(Math.abs(measured - expected) < 1e-9, 'initial trip or rebound gravity changed unexpectedly');
      gravity.push({ contacts, upward, measured }); scene.remove(actor.group);
    }
    const scenarios = [.42, .8].flatMap(tuning => [0, 12, 25].flatMap(speed =>
      [6, 18, 35].map(descent => ({ tuning, speed, descent, rise: original.riseGravity, fall: original.fallGravity }))));
    for (const speed of [0, 25]) for (const [rise, fall, descent] of [[120,160,6], [120,160,18], [10,10,6]])
      scenarios.push({ tuning: .8, speed, descent, rise, fall });
    for (const { tuning, speed, descent, rise, fall } of scenarios) {
      const actor = new Player(scene); actor.rawInput = input; actor.respawn(level, true);
      actor.step(CONST.fixedStep, input, level); actor.invulnTimer = 0;
      actor.bail(false, speed, 'landing', descent);
      actor.state = 'air'; actor.grounded = false; actor.airFromSkate = false;
      actor.pos.set(0, .1, 0); actor.prevPos.copy(actor.pos);
      actor.speed = speed; actor.vVel = -descent; actor.airMomentum = true;
      TUNING.ragBounce = tuning; TUNING.riseGravity = rise; TUNING.fallGravity = fall;
      let settledAt = null, contacts = 0;
      for (let frame = 0; frame < 480; frame++) {
        actor.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep);
        contacts = Math.max(contacts, actor.ragdollImpactCount);
        assert.ok([...actor.pos.toArray(), actor.speed, actor.vVel, ...actor.ragQ.toArray()].every(Number.isFinite));
        assert.ok(!actor.breakApartDiagnostics?.active, 'a nonfatal settle broke the body apart');
        if (!actor.isBailing) { settledAt = (frame + 1) * CONST.fixedStep; break; }
      }
      settlements.push({ tuning, speed, descent, rise, fall, contacts, settledAt });
      assert.ok(settledAt !== null && actor.grounded,
        `contact response never reached a supported get-up: ${JSON.stringify({tuning, speed, descent, rise, fall, contacts,
          pos: actor.pos.toArray(), vVel: actor.vVel, bailing: actor.isBailing, recover: actor.bailRecoverT})}`);
      scene.remove(actor.group);
    }
  } finally { Object.assign(TUNING, original); sfx.play = originalPlay; level.dispose(); }
  const result = { cutoffJump, countDependence, softImpulseError: soft.impulseError,
    cases, maxEnergyGain, maxImpulseError, curve, settlements, gravity, landingOwnership, sounds };
  console.log(JSON.stringify(result, null, 2));
  if (!reportOnly) {
    assert.ok(cutoffJump < .0001, 'a tiny change in approach speed switched the whole landing');
    assert.ok(countDependence < 1e-9 && lateHeavy.bounced, 'a prior bounce count swallowed a fresh heavy impact');
    assert.ok(maxImpulseError < 1e-8, 'tumble impulse disagreed with applied travel');
    assert.ok(maxEnergyGain <= 1e-8, 'floor response added linear energy');
  }
});
