import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop=()=>{};' + harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held')) + '\ninstallHeadlessDom();');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
const evidence = [], failures = [];
let level;
try {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const { CODEX_LAB_LEVEL: source, BLOCKWORKS_SECTIONS: sections } = await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const tuningBefore = JSON.stringify(TUNING), dt = CONST.fixedStep;
  level = new Level(new THREE.Scene(), { id: 'blockworks-ice', name: source.name, data: source });
  level.scene.updateMatrixWorld(true);
  const world = (index, u, y, v) => {
    const s = sections[index], a = s.yaw * Math.PI / 180;
    return new THREE.Vector3(s.start[0] + Math.cos(a) * u - Math.sin(a) * v, y,
      s.start[2] - Math.sin(a) * u - Math.cos(a) * v);
  };
  const local = (index, p) => {
    const s = sections[index], a = s.yaw * Math.PI / 180;
    const x = p.x - s.start[0], z = p.z - s.start[2];
    return { u: x * Math.cos(a) - z * Math.sin(a), y: p.y, v: -x * Math.sin(a) - z * Math.cos(a) };
  };
  const start = (index, u, y, v, speed = 0) => {
    level.reset(true);
    const p = new Player(level.scene); p.enterLevel('blockworks-ice');
    p.endlessDeaths = true; p.respawn(level, true);
    p.pos.copy(world(index, u, y + .02, v)); p.laneCursor.s = -1; p.settle(level);
    p.prevPos.copy(p.pos); p.groundHit = p.queryGround(level);
    // Only the braking stress cases seed velocity; traversal begins on foot at rest.
    if (speed) { p.freeSkate = true; p.speed = speed; p.lastPlanar = speed; }
    assert.ok(p.grounded && p.groundHit && Math.abs(p.groundHit.y - y) < .06);
    const tick = overrides => { p.step(dt, makeInput(overrides), level); level.update(dt); };
    return { p, tick, at: () => local(index, p.pos) };
  };
  const platforms = index => source.components.filter(c => c.grp === index + 10 && c.t === 'platform')
    .map(c => { const centre = local(index, new THREE.Vector3(...c.p)); return {
      component: c, start: centre.v - c.s[2] / 2, end: centre.v + c.s[2] / 2,
      top: c.p[1] + c.s[1] / 2,
    }; }).sort((a, b) => a.start - b.start);
  const icePatches = index => platforms(index).filter(p => p.component.slip);
  const checkpointBefore = (index, v) => Math.max(...source.components
    .filter(c => c.grp === index + 10 && c.t === 'checkpoint')
    .map(c => local(index, new THREE.Vector3(...c.p)).v).filter(at => at < v));
  const check = (name, run) => {
    try { evidence.push({ name, ...run() }); }
    catch (error) { failures.push({ name, error: error.message }); }
  };
  const safe = f => assert.ok(!f.p.isBailing && !['dead', 'gameover', 'hang'].includes(f.p.state),
    `lost traversal: ${JSON.stringify({ ...f.at(), state: f.p.state, speed: f.p.speed })}`);

  for (const [index, u] of [[2, 3], [10, 0]]) check(`Section ${index + 1}: rest to ice to charged gap`, () => {
    const patches = icePatches(index), edge = patches.at(-1).end;
    const startV = checkpointBefore(index, patches[0].start);
    const landing = platforms(index).find(p => p.start > edge + 1).start;
    const f = start(index, u, 0, startV), samples = [];
    let priorSlip = false;
    for (let frame = 0; frame < 1200 && f.at().v < edge - .7; frame++) {
      f.tick({ moveY: 1, jumpHeld: true, jumpPressed: frame === 0 }); safe(f);
      if (!!f.p.groundHit?.slippy !== priorSlip) {
        samples.push({ v: +f.at().v.toFixed(2), speed: +f.p.speed.toFixed(2), ice: !!f.p.groundHit?.slippy });
        priorSlip = !!f.p.groundHit?.slippy;
      }
    }
    assert.ok(f.at().v >= edge - 1 && f.at().v < edge + .2, `never reached launch: ${JSON.stringify(f.at())}`);
    const launch = { ...f.at(), speed: f.p.speed, charge: f.p.chargeTimer };
    f.tick({ moveY: 1, jumpReleased: true });
    assert.equal(f.p.state, 'air', 'charged release failed');
    for (let frame = 0; frame < 120 && f.p.state === 'air'; frame++) {
      f.tick({ moveY: 1 }); safe(f);
    }
    const result = { samples, launch, landing: { ...f.at(), state: f.p.state, speed: f.p.speed } };
    assert.ok(f.p.grounded && f.p.state === 'ride' && f.at().v >= landing && Math.abs(f.at().y) < .08,
      JSON.stringify(result));
    // Keep the same motion after landing: the real adjoining court must also
    // absorb the approach speed without a collision bail or falling off its end.
    for (let frame = 0; frame < 300 && f.p.speed > .08; frame++) {
      f.tick({ grabHeld: true, grabPressed: frame === 0 }); safe(f);
    }
    assert.ok(f.p.grounded && f.p.speed <= .08, 'landing court cannot absorb the approach speed');
    result.dryStop = f.at();
    return result;
  });

  for (const index of [2, 7, 13]) check(`Section ${index + 1}: 23m/s dry brake deck`, () => {
    const ice = icePatches(index)[0], dryStart = ice.end;
    const dry = platforms(index).find(p => !p.component.slip && Math.abs(p.start - dryStart) < .01);
    assert.ok(dry, 'ice needs a contiguous dry catch deck');
    const dryEnd = dry.end;
    const f = start(index, 0, ice.top, dryStart - 3, 23);
    while (f.at().v < dryStart + .05) { f.tick({ moveY: 1 }); safe(f); }
    const brakeAt = f.at().v;
    for (let frame = 0; frame < 300 && f.p.speed > .08; frame++) {
      f.tick({ grabHeld: true, grabPressed: frame === 0 }); safe(f);
    }
    const result = { brakeAt, stoppedAt: f.at().v, distance: f.at().v - brakeAt, speed: f.p.speed, state: f.p.state };
    assert.ok(f.p.speed <= .08 && f.at().v < dryEnd - .5 && f.p.grounded, JSON.stringify(result));
    return result;
  });

  check('Crown: rest to ice, dry catch and finish rail', () => {
    const ice = icePatches(13)[0];
    const f = start(13, 0, ice.top, checkpointBefore(13, ice.start));
    let iceFrames = 0, grindFrames = 0;
    for (let frame = 0; frame < 1200; frame++) {
      const at = f.at(), grinding = f.p.state === 'grind';
      const correction = grinding ? THREE.MathUtils.clamp(-f.p.balance * 5 - f.p.balanceVel * .7, -1, 1) : 0;
      f.tick({ moveY: 1, moveX: correction, jumpHeld: at.v < 121,
        jumpPressed: frame === 0, grindHeld: at.v >= 119, grindPressed: at.v >= 119 && at.v < 119.5 });
      safe(f);
      if (f.p.groundHit?.slippy) iceFrames++;
      if (f.p.state === 'grind') grindFrames++;
      if (f.at().v >= 157 && f.p.grounded && f.p.state === 'ride') break;
    }
    const result = { iceFrames, grindFrames, landing: { ...f.at(), state: f.p.state, speed: f.p.speed } };
    assert.ok(iceFrames > 60 && grindFrames > 30 && f.p.grounded && f.at().v >= 157, JSON.stringify(result));
    return result;
  });
  assert.equal(JSON.stringify(TUNING), tuningBefore, 'ice traversal changed movement tuning');
  console.log(JSON.stringify({ evidence, failures }, null, 2));
  assert.equal(failures.length, 0, failures.map(f => `${f.name}: ${f.error}`).join('\n'));
  console.log('PASS Blockworks continuous ice approaches, charged gap landings, dry brakes and crown rail');
} finally { level?.dispose(); await server.close(); console.warn = warn; console.error = error; }
