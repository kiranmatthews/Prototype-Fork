// A hard rebound must carry limb momentum through the torso's reversal. Use
// actual production springs with an independently controlled spin history.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';

const snapshot = process.argv.find(a => a.startsWith('--source-snapshot='))?.slice(18);
const reportOnly = process.argv.includes('--report-only');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: snapshot ? [{ name: 'saved-spin-response', enforce: 'pre', async load(id) {
    if (path.relative(process.cwd(), id.split('?')[0]) === 'src/character/bailMotion.ts')
      return readFile(path.join(snapshot, 'src/character/bailMotion.ts'), 'utf8');
  } }] : [],
});
try {
  const { BailMotion } = await server.ssrLoadModule('/src/character/bailMotion.ts');
  const q = new THREE.Quaternion(), zero = new THREE.Vector3(), spin = new THREE.Vector3();
  const fresh = () => {
    const m = new BailMotion(); m.begin('air', zero, 411);
    for (let i = 0; i < 600; i++) m.step(1 / 120, q, zero, true, 0, 0, 1);
    return m;
  };
  const rows = [];
  for (const axis of [0, 2]) for (const rate of [2, 8, -8]) {
    const m = fresh(), control = fresh(); let peak = 0, firstVelocity = null;
    spin.set(0, 0, 0).setComponent(axis, rate);
    for (let frame = 0; frame < 60; frame++) {
      m.step(1 / 120, q, spin, false, 0, 0, 1); control.step(1 / 120, q, zero, false, 0, 0, 1);
      const i = 4 * 3 + axis;
      if (frame === 0) firstVelocity = m.velocity[i] - control.velocity[i];
      peak = Math.max(peak, Math.abs(m.angles[i] - control.angles[i]));
    }
    rows.push({ axis, rate, firstVelocity, peak });
  }
  for (const axis of [0, 2]) {
    const mild = rows.find(r => r.axis === axis && r.rate === 2), hard = rows.find(r => r.axis === axis && r.rate === 8);
    if (!reportOnly) {
      assert.ok(Math.abs(hard.firstVelocity) > Math.abs(mild.firstVelocity) * 3.7, 'hard rebound lost its angular impulse');
      assert.ok(hard.peak > .2, 'distal follow-through is too small to read');
    }
    assert.ok(hard.firstVelocity < 0, 'limb moved with the accelerating torso instead of retaining momentum');
    assert.ok(rows.find(r => r.axis === axis && r.rate === -8).firstVelocity > 0, 'opposite rebound did not reverse the reaction');
  }
  // An instantaneous collision arrives once, whether the following frame is
  // one 60 Hz update or two 120 Hz updates. It must never be replayed twice.
  let subdivisionError = 0, maxVelocity = 0, maxAngle = 0, minLength = 1, maxLength = 1;
  const a = fresh(), b = fresh();
  for (let frame = 0; frame < 240; frame++) {
    if (frame % 24 === 0 && frame < 120) spin.set(frame % 48 ? -12 : 12, 2, frame % 48 ? 5 : -5);
    if (frame === 120) spin.set(0, 0, 0);
    a.step(1 / 60, q, spin, frame > 120, 0, 0, 1);
    b.step(1 / 120, q, spin, frame > 120, 0, 0, 1); b.step(1 / 120, q, spin, frame > 120, 0, 0, 1);
    subdivisionError = Math.max(subdivisionError, ...a.angles.map((v, i) => Math.abs(v - b.angles[i])));
    maxVelocity = Math.max(maxVelocity, ...a.velocity.map(Math.abs));
    maxAngle = Math.max(maxAngle, ...a.angles.map(Math.abs));
    for (const value of Object.values(a.deformations)) { minLength = Math.min(minLength, value); maxLength = Math.max(maxLength, value); }
    assert.ok([...a.angles, ...a.velocity, ...Object.values(a.deformations)].every(Number.isFinite));
  }
  if (!reportOnly) assert.ok(subdivisionError < 1e-10, `one collision changed with frame subdivision: ${subdivisionError}`);
  assert.ok(maxVelocity <= 22 && maxAngle <= 1.8 && minLength > .65 && maxLength < 1.35);
  for (let i = 0; i < 1200; i++) a.step(1 / 120, q, zero, true, 0, 0, 1);
  const settledVelocity = Math.max(...a.velocity.map(Math.abs)), settledStrain = Math.max(...Object.values(a.deformations).map(v => Math.abs(v - 1)));
  assert.ok(settledVelocity < 1e-5 && settledStrain < 1e-5, 'momentum did not finitely settle');
  // A captured fall already has a baseline spin. Starting it must not invent
  // an impulse from rest, and resetting must discard the prior impact history.
  a.reset(); a.begin('air', spin.set(5, 2, -3), 29); b.begin('air', spin, 29);
  for (const m of [a, b]) m.step(1 / 60, q, spin, false, 0, 0, 1);
  assert.deepEqual(a.angles, b.angles);
  const result = { source: snapshot ? 'before' : 'after', rows, subdivisionError, maxVelocity, maxAngle, minLength, maxLength,
    settledVelocity, settledStrain, resetMatchesFresh: true };
  const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
  if (report) await writeFile(report, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await server.close(); }
