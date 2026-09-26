import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop = () => {};' + harness.slice(harness.indexOf('function installHeadlessDom()'),
  harness.indexOf('\nconst held')) + '\ninstallHeadlessDom();');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const fixtures = [], evidence = [], failures = [];
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
const check = (name, run) => {
  try { evidence.push({ name, ...(run() ?? {}) }); }
  catch (error) { failures.push(`${name}: ${error.message}`); }
};
try {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { TUNING, CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const { CODEX_LAB_LEVEL: source, BLOCKWORKS_SECTIONS: sections } = await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const dt = CONST.fixedStep;
  const create = data => {
    const scene = new THREE.Scene(), level = new Level(scene, { id: 'blockworks-enemies', name: data.name, data });
    scene.updateMatrixWorld(true);
    const player = new Player(scene); player.enterLevel('blockworks-enemies'); player.endlessDeaths = true;
    player.rawInput = makeInput(); player.respawn(level, true);
    const tick = input => { player.step(dt, makeInput(input), level); level.update(dt); };
    const fixture = { level, player, tick }; fixtures.push(fixture); return fixture;
  };
  const section = index => {
    const s = sections[index], a = s.yaw * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const rotate = (x, z) => [cs * x - sn * z, sn * x + cs * z];
    const components = source.components.filter(c => c.grp === 10 + index && !['camnode', 'zone', 'gate'].includes(c.t)).map(c => {
      const d = structuredClone(c), [x, z] = rotate(c.p[0] - s.start[0], c.p[2] - s.start[2]); d.p = [x, c.p[1], z];
      if (d.yaw !== undefined) d.yaw = (d.yaw - s.yaw + 360) % 360;
      if (d.t === 'pit' && s.yaw % 180 !== 0) d.s = [d.s[2], d.s[1], d.s[0]];
      if (d.pts) d.pts = d.pts.map(p => { const [x, z] = rotate(p[0], p[1]); return [x, z, ...p.slice(2)]; });
      return d;
    });
    components.push({ t: 'gate', p: [500, 0, -500] });
    return create({ ...source, name: s.name, spawn: [0, s.start[1] + .02, -8], components });
  };
  const place = (f, x, y, v, board = false, speed = 0) => {
    f.level.reset(true);
    const p = f.player; p.pos.set(x, y + .02, -v); p.laneCursor.s = -1; p.settle(f.level);
    p.groundHit = p.queryGround(f.level); p.masks = 0; p.invulnTimer = 0;
    p.freeSkate = board; p.speed = speed; p.walkVelocity.set(0, 0, -speed); p.walkRamp = 1;
    p.prevPos.copy(p.pos); p.lastPlanar = speed; f.level.update(0);
    assert.ok(p.groundHit && Math.abs(p.groundHit.y - y) < .06, `unsupported start ${[x, y, v]}`);
  };
  const launch = f => {
    f.player.charging = true; f.player.chargeTimer = TUNING.jumpChargeTime;
    f.tick({ jumpReleased: true, moveY: 1 });
    assert.equal(f.player.state, 'air', 'charged release launches');
  };
  const alive = p => !['dead', 'gameover'].includes(p.state) && !p.isBailing;

  check('Every patrol remains supported through repeated reversals', () => {
    const f = create(source), ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    let probes = 0;
    for (let frame = 0; frame < 1200; frame++) {
      f.level.update(dt);
      if (frame % 6) continue;
      for (const e of f.level.enemies) for (const dx of [-.6, 0, .6]) for (const dz of [-.6, 0, .6]) {
        ray.set(new THREE.Vector3(e.group.position.x + dx, e.baseY + 2, e.group.position.z + dz), down);
        ray.near = 0; ray.far = 4;
        const hit = ray.intersectObjects(f.level.groundMeshes, false)[0];
        assert.ok(hit && Math.abs(hit.point.y - e.baseY) < .05, `${e.kind} patrol foot unsupported at ${e.group.position.toArray()}`); probes++;
      }
    }
    return { supportProbes: probes };
  });

  const grunt = section(5), turtle = section(6), spiker = section(8);
  for (const [name, f, y, v] of [['grunt', grunt, 0, 11], ['turtle', turtle, 4.8, 144], ['spiker', spiker, 9.6, 143]])
    check(`${name} blocks an unarmed centerline run`, () => {
      place(f, 0, y, v);
      for (let frame = 0; frame < 120 && alive(f.player); frame++) f.tick({ moveY: 1 });
      assert.equal(f.player.state, 'dead', `unchallenged run ended ${f.player.state} at ${f.player.pos.toArray()}`);
      assert.ok(f.level.enemies[0].alive, 'contact did not defeat enemy');
    });

  for (const [name, f, y, v] of [['grunt', grunt, 0, 10], ['spiker', spiker, 9.6, 142]])
    check(`${name} can be cleared by a timed spin approach`, () => {
      place(f, 0, y, v); const enemy = f.level.enemies[0]; let fired = false;
      for (let frame = 0; frame < 120 && enemy.alive && alive(f.player); frame++) {
        const close = f.player.pos.distanceTo(enemy.group.position) < 2.2;
        f.tick({ moveY: 1, spinPressed: close && !fired, spinHeld: close }); if (close) fired = true;
      }
      assert.ok(!enemy.alive && alive(f.player), `spin did not safely clear ${name}: ${f.player.state}`);
      return { enemyDefeated: true };
    });

  check('Turtle stomp defeats the shell, with a safe landing after the rebound', () => {
    place(turtle, 0, 4.8, 140.8, false, 9); launch(turtle);
    const enemy = turtle.level.enemies[0], trace = [];
    for (let frame = 0; frame < 120 && enemy.alive && alive(turtle.player); frame++) {
      turtle.tick({ moveY: 1 });
      if (-turtle.player.pos.z > 144 && -turtle.player.pos.z < 148) trace.push([+turtle.player.pos.y.toFixed(2), +(-turtle.player.pos.z).toFixed(2), +enemy.group.position.x.toFixed(2)]);
    }
    assert.ok(!enemy.alive && alive(turtle.player), `turtle stomp failed at ${turtle.player.pos.toArray()}, ${turtle.player.state}: ${JSON.stringify(trace)}`);
    for (let frame = 0; frame < 120 && !turtle.player.grounded && alive(turtle.player); frame++) turtle.tick({ moveY: 1 });
    assert.ok(turtle.player.grounded && alive(turtle.player) && -turtle.player.pos.z > 151, 'stomp rebound lacks a safe exit');
    return { exit: turtle.player.pos.toArray().map(n => +n.toFixed(2)) };
  });

  check('Spiker rejects the stomp that works on the turtle', () => {
    place(spiker, 0, 9.6, 139.8, false, 9); launch(spiker);
    for (let frame = 0; frame < 70 && alive(spiker.player); frame++) spiker.tick({ moveY: 1 });
    assert.equal(spiker.player.state, 'dead', 'landing on the spiker should hurt');
    assert.ok(spiker.level.enemies[0].alive, 'spiker must survive a stomp');
  });

  check('Turtle side shelf is reachable and reconnects without fighting', () => {
    place(turtle, -7, 4.8, 139.4, false, 9); launch(turtle);
    for (let frame = 0; frame < 100 && !turtle.player.grounded && alive(turtle.player); frame++) turtle.tick({ moveY: 1 });
    assert.ok(turtle.player.grounded && Math.abs(turtle.player.pos.y - 6) < .08, `missed side shelf ${turtle.player.pos.toArray()}`);
    for (let frame = 0; frame < 110 && -turtle.player.pos.z < 156 && alive(turtle.player); frame++) turtle.tick({ moveY: 1 });
    assert.ok(turtle.player.grounded && alive(turtle.player) && Math.abs(turtle.player.pos.y - 4.8) < .08 && -turtle.player.pos.z >= 156,
      `side shelf did not reconnect ${turtle.player.pos.toArray()}, ${turtle.player.state}`);
    assert.ok(turtle.level.enemies[0].alive, 'bypass required attacking turtle');
    return { exit: turtle.player.pos.toArray().map(n => +n.toFixed(2)) };
  });

  check('Spiker rail bypass crosses its neck and lands with enemy untouched', () => {
    place(spiker, 5, 9.6, 132, true, 12); let caught = false;
    for (let frame = 0; frame < 330 && alive(spiker.player); frame++) {
      spiker.tick({ moveX: spiker.player.state === 'grind' ? THREE.MathUtils.clamp(-spiker.player.balance * 5 - spiker.player.balanceVel * .7, -1, 1) : 0,
        moveY: 1, grindHeld: true, grindPressed: frame === 0 });
      caught ||= spiker.player.state === 'grind';
      if (caught && spiker.player.grounded && -spiker.player.pos.z >= 174) break;
    }
    assert.ok(caught && alive(spiker.player) && spiker.player.grounded && -spiker.player.pos.z >= 174,
      `rail bypass failed ${spiker.player.pos.toArray()}, ${spiker.player.state}`);
    assert.ok(spiker.level.enemies[0].alive, 'rail bypass defeated the spiker');
    return { exit: spiker.player.pos.toArray().map(n => +n.toFixed(2)) };
  });
  console.log(JSON.stringify({ evidence, failures }, null, 2));
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('PASS Blockworks supported patrols, dangerous contact, attack choices and traversable enemy bypasses');
} finally {
  for (const fixture of fixtures) fixture.level.dispose();
  await server.close(); console.warn = warn; console.error = error;
}
