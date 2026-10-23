import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime, makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE, server, Player, Level, scene, TUNING, CONST}) => {
  const {createSkateReference, validSkateReference, referenceKickDuration} = await server.ssrLoadModule('/src/skateReferencePhysics.ts');
  const {normalizeCustomLevelData} = await server.ssrLoadModule('/src/level.ts');
  const reference = {kind: 'thps1', metresPerUnit: .01808, stats: {ollie: 4, speed: 8, air: 8}};
  const params = createSkateReference(reference), tuning = JSON.stringify(TUNING);
  const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
  // Independently measured Tony + first-board parameters, in metres/seconds.
  near(params.park.groundGravity, 25.822265625);
  near(params.park.airGravity, 51.64453125);
  near(params.park.ollieMin, 11.7972); near(params.park.ollieMax, 17.0856);
  near(params.park.vertPopMin, 12.6108); near(params.park.vertPopMax, 17.8992);
  near(params.park.chargeSeconds, .3); near(params.kickAcceleration, 65.088);
  near(params.lowDrag, .05859375); near(params.highDrag, .6005859375);
  near(params.park.standingSpeed, 21.792857142857, .0002);
  near(params.park.crouchingSpeed, 26.151428571429, .0002);
  near(params.dragThreshold, 40.970571428571, .0002);
  for (const hz of [30, 60, 120]) {
    let duration = 0;
    for (let i = 0; i < hz * 20; i++) duration += referenceKickDuration(i / hz, 1 / hz);
    near(duration, 5, 1e-10);
  }
  near(referenceKickDuration(0, 5 / 30), 0);
  near(referenceKickDuration(5 / 30, 5 / 30), 5 / 30);
  near(referenceKickDuration(10 / 30, 10 / 30), 0);
  const data = {v: 1, name: 'Reference parameter fixture', skatepark: true, skateReference: reference,
    spawn: [0, .05, 100], killY: -30, components: [
      {t: 'platform', p: [0, -.5, 0], s: [600, 1, 600], edgeGrinding: false}, {t: 'gate', p: [250, 0, -250]},
    ]};
  for (const bad of [null, [], {...reference, kind: 'unknown'}, {...reference, extra: 1},
    {...reference, metresPerUnit: '0.02'}, {...reference, metresPerUnit: 0}, {...reference, metresPerUnit: Infinity},
    {...reference, stats: {...reference.stats, air: 11}}, {...reference, stats: {...reference.stats, air: 3.5}},
    {...reference, stats: {speed: 8}}, {...reference, stats: {...reference.stats, mystery: 1}}]) {
    assert.equal(validSkateReference(bad), false);
    assert.equal(normalizeCustomLevelData({...data, skateReference: bad}), null);
  }
  assert.equal(normalizeCustomLevelData({...data, skatepark: false}), null);
  const normalized = normalizeCustomLevelData(JSON.parse(JSON.stringify(data))); assert.ok(normalized);
  const level = new Level(scene, {id: 'reference-fixture', name: data.name, data: normalized});
  level.update(0); scene.updateMatrixWorld(true);
  assert.deepEqual(level.captureData().skateReference, reference);
  assert.deepEqual(normalizeCustomLevelData(level.captureData()).skateReference, reference);
  const p = new Player(scene); p.enterLevel('reference-fixture'); p.endlessDeaths = true;
  const reset = () => {p.rawInput = makeInput(); p.respawn(level, true, false, {
    position: new THREE.Vector3(0, 0, 100), heading: new THREE.Vector3(0, 0, -1)});};
  const step = (sample = {}) => {p.step(CONST.fixedStep, makeInput(sample), level); level.update(CONST.fixedStep);};
  try {
    reset(); for (let i = 0; i < 240; i++) step();
    const neutralSpeed = p.speed; assert.ok(neutralSpeed > 21 && neutralSpeed < 23, 'Neutral auto-kick must keep rolling');
    reset(); for (let i = 0; i < 24; i++) step({jumpHeld: true, jumpPressed: i === 0});
    step({jumpReleased: true}); const launch = p.vVel; near(launch, params.park.ollieMax);
    const groundClock = p.parkKickGroundSeconds; let peak = p.pos.y;
    for (let i = 0; i < 100 && !p.grounded; i++) {
      const vy = p.vVel; step(); peak = Math.max(peak, p.pos.y);
      if (!p.grounded) {near(p.vVel - vy, -params.park.airGravity * CONST.fixedStep); near(p.parkKickGroundSeconds, groundClock);}
    }
    assert.ok(p.grounded && !p.isBailing); assert.ok(peak > 2.65 && peak < 2.9);
    // A fixture may set initial speed once: strong drag must bleed overspeed,
    // rather than silently clamp it to either the old cap or source threshold.
    reset(); p.speed = 55; step(); const overspeed = p.speed;
    assert.ok(overspeed > 54 && overspeed < 55);
    assert.equal(JSON.stringify(TUNING), tuning);
    const report = {params, neutralSpeed, launch, peak, overspeed, chargeSeconds: params.park.chargeSeconds,
      pulseFrameRates: [30, 60, 120], editorRoundTrip: true, invalidDataRejected: true, tuningUnchanged: true};
    await writeFile('/private/tmp/mall-recreation/measured/reference-physics.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {level.dispose();}
});
