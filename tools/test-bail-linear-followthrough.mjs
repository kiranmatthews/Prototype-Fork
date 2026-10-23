// A rebound changes travel velocity instantly; loose joints should retain
// momentum without reducing the response when the render step is subdivided.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';

const snapshot = process.argv.find(a => a.startsWith('--source-snapshot='))?.slice(18);
const reportOnly = process.argv.includes('--report-only');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: snapshot ? [{ name: 'saved-travel-response', enforce: 'pre', async load(id) {
    if (path.relative(process.cwd(), id.split('?')[0]) === 'src/character/bailMotion.ts')
      return readFile(path.join(snapshot, 'src/character/bailMotion.ts'), 'utf8');
  } }] : [],
});
try {
  const { BailMotion } = await server.ssrLoadModule('/src/character/bailMotion.ts');
  const q = new THREE.Quaternion(), zero = new THREE.Vector3(), travel = new THREE.Vector3();
  const fresh = () => {
    const m = new BailMotion(); m.begin('air', zero, 411, false, zero);
    for (let i = 0; i < 600; i++) m.step(1 / 120, q, zero, true, 0, 0, 1, zero);
    return m;
  };
  const rows = [];
  for (const axis of [0, 2]) for (const speed of [2, 8, -8]) {
    const m = fresh(), control = fresh(); let peak = 0, firstVelocity = 0;
    travel.set(0, 0, 0).setComponent(axis, speed);
    const coordinate = 4 * 3 + (axis === 2 ? 0 : 2);
    for (let frame = 0; frame < 60; frame++) {
      m.step(1 / 120, q, zero, false, 0, 0, 1, travel);
      control.step(1 / 120, q, zero, false, 0, 0, 1, zero);
      if (frame === 0) firstVelocity = m.velocity[coordinate] - control.velocity[coordinate];
      peak = Math.max(peak, Math.abs(m.angles[coordinate] - control.angles[coordinate]));
    }
    rows.push({ axis, speed, firstVelocity, peak });
  }
  for (const axis of [0, 2]) {
    const mild = rows.find(r => r.axis === axis && r.speed === 2), hard = rows.find(r => r.axis === axis && r.speed === 8);
    if (!reportOnly) {
      assert.ok(Math.abs(hard.firstVelocity) > Math.abs(mild.firstVelocity) * 3.7, 'hard rebound lost its linear impulse');
      assert.ok(hard.peak > .12, 'travel follow-through is too small to read');
    }
    assert.ok(hard.firstVelocity * (axis === 2 ? 1 : -1) > 0);
    assert.ok(rows.find(r => r.axis === axis && r.speed === -8).firstVelocity * hard.firstVelocity < 0);
  }
  let subdivisionError = 0, maxVelocity = 0, minLength = 1, maxLength = 1;
  const a = fresh(), b = fresh();
  for (let frame = 0; frame < 360; frame++) {
    if (frame % 24 === 0 && frame < 120) travel.set(frame % 48 ? -8 : 8, 2, frame % 48 ? 10 : -10);
    if (frame === 120) travel.set(0, 0, 0);
    a.step(1 / 60, q, zero, frame > 120, 0, 0, 1, travel);
    b.step(1 / 120, q, zero, frame > 120, 0, 0, 1, travel); b.step(1 / 120, q, zero, frame > 120, 0, 0, 1, travel);
    subdivisionError = Math.max(subdivisionError, ...a.angles.map((v, i) => Math.abs(v - b.angles[i])));
    maxVelocity = Math.max(maxVelocity, ...a.velocity.map(Math.abs));
    for (const value of Object.values(a.deformations)) { minLength = Math.min(minLength, value); maxLength = Math.max(maxLength, value); }
    assert.ok([...a.angles, ...a.velocity, ...Object.values(a.deformations)].every(Number.isFinite));
  }
  if (!reportOnly) assert.ok(subdivisionError < 1e-10, `collision changed with frame subdivision: ${subdivisionError}`);
  assert.ok(maxVelocity <= 22 && minLength > .65 && maxLength < 1.35);
  for (let i = 0; i < 1200; i++) a.step(1 / 120, q, zero, true, 0, 0, 1, zero);
  const settledVelocity = Math.max(...a.velocity.map(Math.abs));
  assert.ok(settledVelocity < 1e-5, 'travel impulse never settled');
  // Captured/absent travel must not create a phantom velocity change.
  a.reset(); a.begin('air', zero, 29, false, travel.set(12, -8, 3)); b.begin('air', zero, 29, false, travel);
  a.step(1 / 60, q, zero, false, 0, 0, 1, travel); b.step(1 / 60, q, zero, false, 0, 0, 1);
  assert.deepEqual(a.angles, b.angles);
  a.step(1 / 60, q, zero, false, 0, 0, 1, travel); b.step(1 / 60, q, zero, false, 0, 0, 1, travel);
  assert.deepEqual(a.angles, b.angles, 'returning travel invented an impulse after an absent sample');
  const heading = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.37);
  const localTravel = new THREE.Vector3(8, 0, -5), worldTravel = localTravel.clone().applyQuaternion(heading);
  const c = fresh(), d = fresh(); let headingError = 0;
  for (let frame = 0; frame < 60; frame++) {
    c.step(1 / 120, q, zero, false, 0, 0, 1, localTravel); d.step(1 / 120, heading, zero, false, 0, 0, 1, worldTravel);
    headingError = Math.max(headingError, ...c.angles.map((v, i) => Math.abs(v - d.angles[i])));
  }
  assert.ok(headingError < 1e-12, 'a world heading changed the local rebound');
  const tilted = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.2);
  const fall = new THREE.Vector3(0, -8, 0), bounce = new THREE.Vector3(0, 5, 0);
  c.begin('air', zero, 29, false, fall); d.begin('air', zero, 29, false, fall);
  c.step(1 / 120, tilted, zero, false, 0, 0, 1, bounce); d.step(1 / 120, tilted, zero, false, 0, 0, 1, fall);
  const neckResponse = c.velocity[3] - d.velocity[3], wristResponse = c.velocity[12] - d.velocity[12];
  assert.ok(neckResponse * wristResponse < 0, 'the upper body and hanging limbs failed to counterbalance a floor rebound');
  const result = { source: snapshot ? 'before' : 'after', rows, subdivisionError, maxVelocity, minLength, maxLength,
    settledVelocity, capturedTravelPreserved: true, headingError, tiltedFloorRebound: { neckResponse, wristResponse } };
  const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
  if (report) await writeFile(report, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await server.close(); }
