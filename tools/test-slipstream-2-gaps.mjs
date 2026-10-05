import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
const sourceSha256 = createHash('sha256').update(await readFile(new URL('../src/levels/slipstream-2.ts', import.meta.url))).digest('hex');
const playerSha256 = createHash('sha256').update(await readFile(new URL('../src/player.ts', import.meta.url))).digest('hex');
const tuningSha256 = createHash('sha256').update(await readFile(new URL('../src/tuning.ts', import.meta.url))).digest('hex');

await withBlockworksRuntime(async r => {
  const m = r.sourceModule, p = r.p, l = r.l, before = JSON.stringify(r.TUNING), results = [];
  const measure = (gap, kind) => {
    const startS = gap.a - 95, start = m.slipstream2Point(startS, 0, .05), future = m.slipstream2Point(startS + 1);
    p.respawn(l, true, false, { position: new r.THREE.Vector3(...start),
      heading: new r.THREE.Vector3(future[0] - start[0], 0, future[2] - start[2]).normalize() });
    let air = false, released = false, launch = null, landed = false, braking = false;
    for (let i = 0; i < 1300; i++) {
      const camera = l.cameraDirAt(p.pos.x, p.pos.y, p.pos.z); if (camera) p.camDir.set(camera.x, 0, camera.z);
      const s = m.slipstream2Progress(p.pos);
      let input;
      if (air) input = {};
      else {
        if (kind === 'slow') { if (p.speed > 15) braking = true; if (p.speed < 13) braking = false; }
        input = { ...r.steerToward(m.slipstream2Point(s + 8)), jumpHeld: true, grabHeld: kind === 'slow' && braking };
        if (kind !== 'roll' && !released && p.grounded && s >= gap.a - 7.75) {
          input = { jumpReleased: true }; released = true;
          launch = { speed: p.speed, station: s, position: p.pos.toArray() };
        }
      }
      r.tick(input);
      if (input.jumpReleased && launch) Object.assign(launch, { up: p.vVel, launchVy: p.launchVy, floatAir: p.floatAir,
        lastTy: p.lastTy, liftTy: p.liftTy, groundNormal: p.groundHit?.normal.toArray() });
      if (!p.grounded && (released || m.slipstream2Progress(p.pos) > gap.a - 2)) air = true;
      if (air && p.grounded && m.slipstream2Progress(p.pos) > gap.b && Math.abs(p.pos.y - m.slipstream2Height(m.slipstream2Progress(p.pos))) < .4) { landed = true; break; }
      if (['dead', 'gameover'].includes(p.state) || p.isBailing) break;
    }
    const result = { name: gap.name, width: gap.width, kind, released, air, launch,
      landed, landingMargin: landed ? m.slipstream2Progress(p.pos) - gap.b : null,
      state: p.state, end: p.pos.toArray(), endStation: m.slipstream2Progress(p.pos) };
    results.push(result); console.log(JSON.stringify({ name: result.name, width: result.width, kind,
      speed: launch?.speed, margin: result.landingMargin, landed, state: p.state }));
    return result;
  };
  const ordered = [...m.SLIPSTREAM_2_GAPS].sort((a, b) => a.width - b.width);
  const chosen = process.argv.includes('--representative') ? [ordered[0], ordered[6], ordered.at(-1)] : m.SLIPSTREAM_2_GAPS;
  for (const gap of chosen) for (const kind of process.argv.includes('--fast-only') ? ['fast'] : ['fast', 'slow', 'roll']) measure(gap, kind);
  await writeFile(`${tmpdir()}/slipstream-2-gaps.json`, JSON.stringify({ sourceSha256, playerSha256, tuningSha256, results }, null, 2));
  assert.equal(JSON.stringify(r.TUNING), before);
  assert.ok(results.filter(r => r.kind === 'fast').every(r => r.landed), 'Every authored gap must land using native charged skating');
  assert.ok(results.filter(r => r.kind === 'fast').every(r => r.landingMargin >= 3), 'Full-speed jumps need at least 3m of landing margin');
  assert.ok(results.filter(r => r.kind !== 'fast').every(r => !r.landed), 'Every gap must require speed plus a deliberate jump');
  assert.ok(results.filter(r => r.kind === 'slow').every(r => r.launch?.speed < 18), 'Slow probes must actually release below 18m/s');
  if (!process.argv.includes('--representative') && !process.argv.includes('--fast-only')) {
    assert.equal(results.length, 36);
    for (const kind of ['fast', 'slow', 'roll']) assert.equal(results.filter(r => r.kind === kind).length, 12);
  }
}, { modulePath: '/src/levels/slipstream-2.ts', source: m => m.SLIPSTREAM_2_LEVEL,
  levelId: 'slipstream-2', endlessDeaths: true, maxFrames: 50000,
  controlFrame: r => r.p.courseInputDirection(r.l) ?? { x: r.p.camDir.x, z: r.p.camDir.z } });
