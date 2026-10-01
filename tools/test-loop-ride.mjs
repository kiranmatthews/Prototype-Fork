import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { withWaterparkRuntime } from './waterpark-runner.mjs';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { stepLoopMotion, loopContactPressure, sampleLoop, createLoopMeshData, LOOP_TURN } =
    await server.ssrLoadModule('/src/loopRide.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const shape = { radius: 26, width: 12, offset: 20 };
  const forces = { gravity: TUNING.groundGravity, pump: TUNING.pipePumpGain + TUNING.chargeBoost,
    friction: TUNING.pipeFriction, drag: TUNING.windDrag, braking: TUNING.turnaround };
  const travel = (speed, charge, dt = 1 / 120) => {
    let motion = { angle: 0, speed }, minSpeed = speed;
    for (let i = 0; i < 15 / dt; i++) {
      motion = stepLoopMotion(shape, motion, dt, charge, false, forces);
      minSpeed = Math.min(minSpeed, motion.speed);
      if (!motion.attached || motion.complete) return { ...motion, minSpeed };
    }
    throw new Error('Loop simulation never resolved');
  };
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const held = travel(64, 1, dt);
    assert.equal(held.complete, true, 'A charged speed-pad approach must complete the loop');
    assert.ok(held.minSpeed > 34, 'Successful run kept enough speed through the crown');
    const coast = travel(64, 0, dt);
    assert.equal(coast.attached, false, 'Uncharged launch must lose inward wheel pressure');
    assert.ok(coast.angle > Math.PI / 2 && coast.angle < Math.PI, 'Failure must detach on the inverted climb');
  }
  assert.equal(travel(24, 1).attached, false, 'Charge cannot glue a slow rider to the ceiling');
  assert.equal(travel(90, 0).complete, true, 'Sufficient real momentum can coast through without a charge gate');
  assert.ok(loopContactPressure(shape, Math.PI, 20, 45) < 0);
  assert.ok(loopContactPressure(shape, Math.PI, 40, 45) > 0);
  assert.deepEqual(sampleLoop(shape, 0).point, [0, 0, -0]);
  const exit = sampleLoop(shape, LOOP_TURN).point;
  assert.ok(Math.abs(exit[0] - 20) < 1e-9 && Math.abs(exit[1]) < 1e-9 && Math.abs(exit[2]) < 1e-9);
  const mesh = createLoopMeshData(26, 12, 20);
  assert.equal(mesh.vertices.length, mesh.normals.length);
  assert.equal(mesh.indices.length, 160 * 6);
  // Inward winding matters: front-side raycasts must see the riding face.
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [ia, ib, ic] = mesh.indices.slice(i, i + 3).map(v => v * 3);
    const a = mesh.vertices.slice(ia, ia + 3), b = mesh.vertices.slice(ib, ib + 3), c = mesh.vertices.slice(ic, ic + 3);
    const u = b.map((v, j) => v - a[j]), v = c.map((x, j) => x - a[j]);
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    assert.ok(n.reduce((dot, x, j) => dot + x * mesh.normals[ia + j], 0) > 0);
  }
} finally { await server.close(); }

await withWaterparkRuntime(async ({ p, l, tick, directionInput, source }) => {
  const validationServer = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  try {
    const { parseCustomLevelJson } = await validationServer.ssrLoadModule('/src/level.ts');
    const captured = l.captureData();
    const roundtrip = parseCustomLevelJson(JSON.stringify(captured));
    assert.ok(roundtrip, 'Loop metadata must survive the published/editor schema');
    const loop = roundtrip.components.find(c => c.loopRadius !== undefined);
    assert.equal(loop.loopRadius, 26); assert.equal(loop.loopOffset, 20); assert.equal(loop.loopRequired, true);
    assert.equal(JSON.stringify(loop.vertices), JSON.stringify(source.WATERPARK_LEVEL.components.find(c => c.loopRadius).vertices));
    for (const mutation of [{ loopRadius: 0 }, { loopRadius: 81 }, { loopOffset: '20' },
      { loopRequired: 1 }, { s: [2, 1, 1] }, { solid: false }, { vert: true }]) {
      const invalid = structuredClone(captured);
      Object.assign(invalid.components.find(c => c.loopRadius), mutation);
      assert.equal(parseCustomLevelJson(JSON.stringify(invalid)), null, 'Malformed loop metadata was accepted');
    }
  } finally { await validationServer.close(); }
  let inverted = false, complete = false;
  for (let i = 0; i < 1600; i++) {
    tick({ ...(p.loopStatus.active?{moveY:1}:directionInput([0,0,1])), jumpHeld: true });
    inverted ||= p.loopStatus.active && p.rideNormal.y < -0.9;
    if (p.loopStatus.completed > 0) { complete = true; break; }
    assert.equal(p.totalDeaths, 0, 'Charged approach unexpectedly died');
  }
  assert.ok(inverted, 'Production rider never reached the inverted track');
  assert.ok(complete, 'Production contact never completed its full turn');
  assert.ok(Math.abs(p.pos.x-118) < 2 && Math.abs(p.pos.y) < 1, 'Exit must return supported to the separate lane');
  for (let i = 0; i < 600 && p.state !== 'finished'; i++) tick({ ...(p.loopStatus.active?{moveY:1}:directionInput([0,0,1])), jumpHeld: true });
  assert.equal(p.state, 'finished', 'Completed loop must unlock the real finish gate');
  p.respawn(l, false);
  assert.equal(p.loopStatus.completed, 0, 'Death/checkpoint respawn must reset the loop goal');
  assert.equal(p.loopStatus.active, false);
}, { start: [138, 0.1, -15], heading: [0,0,1] });

await withWaterparkRuntime(({ p, tick, directionInput }) => {
  let entered = false, fell = false;
  for (let i = 0; i < 1000; i++) {
    const release = entered;
    tick({ ...(p.loopStatus.active?{moveY:1}:directionInput([0,0,1])), jumpHeld: !release });
    entered ||= p.loopStatus.active;
    if (entered && p.state === 'air' && !p.loopStatus.active) { fell = true; break; }
  }
  assert.ok(entered && fell, 'Releasing early must produce a real gravity fall');
  assert.equal(p.grounded, false);
  assert.equal(p.loopStatus.completed, 0);
  let recovered = false;
  for (let i = 0; i < 1200; i++) {
    tick({});
    assert.equal(p.loopStatus.completed, 0, 'A lower-ribbon recovery cannot earn the loop goal');
    if (!p.loopStatus.active && p.grounded && p.pos.y < 1.1) { recovered = true; break; }
  }
  assert.ok(recovered, `A failed loop must return to its base, never stick on the lower wall: ${JSON.stringify({position:p.pos.toArray(),state:p.state,grounded:p.grounded,loop:p.loopStatus})}`);
}, { start: [138, 0.1, -15], heading: [0,0,1] });
await withWaterparkRuntime(({ p, tick, directionInput }) => {
  let blocked = false;
  p.onCourseHint = (title) => { blocked ||= title === 'LOOP STILL CLOSED'; };
  for (let i = 0; i < 180; i++) {
    tick({ ...(p.loopStatus.active?{moveY:1}:directionInput([0,0,1])), jumpHeld: true });
    assert.notEqual(p.state, 'finished', 'Exit-lane shortcut bypassed the required loop');
  }
  assert.equal(p.loopStatus.completed, 0);
  assert.ok(blocked, 'Locked finish must explain the missing loop to the player');
}, { start: [118, 0.1, 40], heading: [0,0,1] });
console.log('Loop contact: charged success, coast failure, physical pressure, geometry winding, production inversion and respawn passed.');
