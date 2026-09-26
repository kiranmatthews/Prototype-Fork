import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Gameplay regression only. Deliberate 404 responses exercise a pending/failed
// art load without making model availability, appearance or animation QA claims.
const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),
  harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', appType: 'custom', server: { middlewareMode: true } });
const levels = [];
const originalLoadAsync = GLTFLoader.prototype.loadAsync;
const realAssets = process.argv.includes('--assets');
const availableKinds = new Set(realAssets ? (await readdir(new URL('../public/enemies/', import.meta.url)))
  .filter(name => name.endsWith('.glb')).map(name => name.slice(0, -4)) : []);
if (realAssets) {
  for (const kind of ['hopper', 'floater', 'sentry', 'spinner']) assert.ok(availableKinds.has(kind), `missing actual ${kind} fixture`);
  GLTFLoader.prototype.loadAsync = async function (url, ...args) {
    const kind = String(url).match(/(?:^|\/)enemies\/([a-z]+)\.glb(?:\?.*)?$/)?.[1];
    if (!kind || !availableKinds.has(kind)) return originalLoadAsync.call(this, url, ...args);
    const path = fileURLToPath(new URL(`../public/enemies/${kind}.glb`, import.meta.url));
    const bytes = await readFile(path);
    return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
      .register(() => ({ name: 'GameplayWithoutEnemyPixels', loadTexture: () => Promise.resolve(null) }))
      .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  };
}
const originalWarn = console.warn;
console.warn = (...args) => {
  // Player accessories share this deliberate offline fixture. Suppress only
  // the exact empty-URL 404 created above, never unrelated runtime warnings.
  if (args.some(value => value?.response?.status === 404 && value.response.url === '')) return;
  originalWarn(...args);
};
const near = (actual, expected, label, epsilon = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${label}: ${actual} != ${expected}`);
const flags = enemy => [enemy.spinKill, enemy.stompKill, enemy.meleeKill, enemy.touchHurt, enemy.spinRecoil];
const starts = { grunt: 'patrol', spiker: 'patrol', turtle: 'patrol', charger: 'patrol',
  hopper: 'crouch', floater: 'hover', sentry: 'track', spinner: 'out' };

try {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { ENEMY_KINDS } = await server.ssrLoadModule('/src/enemies/types.ts');
  assert.deepEqual([...ENEMY_KINDS].sort(), Object.keys(starts).sort(), 'full eight-kind fixture');
  const scene = new THREE.Scene();
  const level = new Level(scene, { id: 'enemy-gameplay', name: 'Enemy gameplay', data: {
    v: 1, name: 'Enemy gameplay', spawn: [0, 1, 8], killY: -30,
    components: [
      { t: 'platform', p: [0, -.5, -45], s: [100, 1, 140] },
      ...ENEMY_KINDS.map((foe, i) => ({ t: 'enemy', foe, p: [0, 0, -i * 12], range: 15, speed: 4 })),
      { t: 'enemy', foe: 'grunt', p: [30, 0, -30], range: 10, speed: 4, yaw: 90 },
      { t: 'gate', p: [0, 0, -100] },
    ],
  } });
  levels.push(level);
  await level.prepareJungleAssets();
  for (const enemy of level.enemies) {
    assert.equal(enemy.visual.diagnostics.status, availableKinds.has(enemy.kind) ? 'ready' : 'error',
      `${enemy.kind}: level readiness must include its real or deliberately missing model`);
    if (availableKinds.has(enemy.kind)) assert.ok(enemy.visual.diagnostics.meshes > 0, `${enemy.kind} model did not attach`);
  }
  const byKind = Object.fromEntries(level.enemies.slice(0, 8).map(e => [e.kind, e]));
  const tick = (dt = 1 / 60) => { level.time += dt; level.updateEnemies(dt); };
  const reset = () => { level.reset(true); level.playerPos.set(1000, 0, 1000); tick(0); };
  reset();

  for (const [kind, expected] of Object.entries({
    grunt: [true, true, true, true, false], spiker: [true, false, true, true, false],
    turtle: [false, true, true, true, true], charger: [true, true, true, true, false],
    hopper: [true, true, true, true, false], floater: [true, false, true, true, false],
    sentry: [true, true, true, true, false], spinner: [false, false, false, true, false],
  })) assert.deepEqual(flags(byKind[kind]), expected, `${kind} initial attack identity`);

  // Root movement, patrol endpoints and gameplay boxes do not depend on artwork.
  tick(.1);
  near(byKind.grunt.group.position.x, .4, 'grunt patrol');
  near(byKind.spiker.group.position.x, .4, 'spiker patrol');
  near(byKind.turtle.group.position.x, .28, 'turtle slower patrol');
  near(byKind.charger.group.position.x, .2, 'charger amble');
  near(byKind.floater.group.position.x, .4, 'floater patrol');
  near(byKind.sentry.group.position.x, 0, 'sentry stationary');
  near(byKind.spinner.group.position.x, 0, 'spinner stationary');
  const zPatrol = level.enemies[8];
  near(zPatrol.group.position.z, -29.6, 'rotated patrol uses Z');
  near(zPatrol.group.position.x, 30, 'rotated patrol preserves cross coordinate');
  for (const enemy of [byKind.grunt, zPatrol]) {
    const axis = enemy.axis;
    enemy.group.position[axis] = enemy.x1 - .02; enemy.dir = 1;
    tick(.02); near(enemy.group.position[axis], enemy.x1, 'patrol clamps endpoint');
    assert.equal(enemy.dir, -1, 'patrol reverses at endpoint');
  }
  const expectedBoxes = { grunt: [1.3, 1.1], spiker: [1.3, 1.1], turtle: [1.3, .9],
    charger: [1.45, 1.1], hopper: [1.3, 1.1], floater: [1.3, 1.1],
    sentry: [1.05, 1.15], spinner: [2.1, 1.1] };
  for (const [kind, [width, height]] of Object.entries(expectedBoxes)) {
    const size = byKind[kind].box.getSize(new THREE.Vector3());
    near(size.x, width, `${kind} collision width`); near(size.y, height, `${kind} collision height`);
    assert.deepEqual(byKind[kind].group.scale.toArray(), [1, 1, 1], `${kind} root must remain unscaled`);
  }

  reset();
  const charger = byKind.charger;
  level.playerPos.copy(charger.group.position).add(new THREE.Vector3(10, 0, 0));
  tick(.01); assert.equal(charger.state, 'telegraph');
  tick(.56); assert.equal(charger.state, 'dash');
  const chargeStart = charger.group.position.x;
  tick(.1); near(charger.group.position.x - chargeStart, 1.36, 'charger dash speed');
  assert.deepEqual(flags(charger), [false, false, false, true, false], 'dash rejects all attacks');
  charger.group.position.x = charger.x1 - .01; tick(.01); assert.equal(charger.state, 'recover');
  tick(.01); assert.deepEqual(flags(charger), [true, true, true, false, false], 'recovery safe/vulnerable');
  level.playerPos.set(1000, 0, 1000); tick(1.11); assert.equal(charger.state, 'patrol');

  reset();
  const hopper = byKind.hopper;
  tick(.46); assert.equal(hopper.state, 'leap'); near(hopper.vy, 8.6, 'hopper launch');
  tick(.1); assert.ok(hopper.group.position.y > hopper.baseY + .5); assert.equal(hopper.stompKill, false);
  let hopperFrames = 0;
  while (hopper.state === 'leap' && hopperFrames++ < 120) tick(1 / 60);
  assert.equal(hopper.state, 'crouch'); near(hopper.group.position.y, hopper.baseY, 'hopper lands on deck');
  assert.equal(hopper.stompKill, true, 'grounded hopper can be stomped');

  reset();
  const floater = byKind.floater;
  level.playerPos.copy(floater.group.position);
  for (let i = 0; i < 158; i++) tick(1 / 60);
  assert.equal(floater.state, 'swoop');
  floater.stateT = .39; tick(.01); near(floater.group.position.y - floater.baseY, .35, 'swoop low point');
  tick(.41); assert.equal(floater.state, 'hover'); assert.equal(floater.stompKill, false);

  reset();
  const spinner = byKind.spinner;
  tick(2.21); assert.equal(spinner.state, 'in'); tick(0);
  assert.deepEqual(flags(spinner), [true, true, true, false, false], 'retracted blades safe/vulnerable');
  near(spinner.box.getSize(new THREE.Vector3()).x, .8, 'retracted collision width');
  tick(1.36); assert.equal(spinner.state, 'out'); tick(0);
  assert.deepEqual(flags(spinner), [false, false, false, true, false]);

  reset();
  const sentry = byKind.sentry;
  level.playerPos.copy(sentry.group.position).add(new THREE.Vector3(6, 0, 8));
  tick(1.31); assert.equal(sentry.state, 'charge'); assert.ok(sentry.body.rotation.y > .5, 'sentry aims head');
  tick(.56); assert.equal(sentry.state, 'fire'); assert.equal(level.projectiles.length, 1);
  const shot = level.projectiles[0];
  near(shot.vel.length(), 15, 'projectile velocity'); assert.equal(shot.owner, sentry);
  const liveMuzzle = new THREE.Vector3();
  if (sentry.visual.getMuzzlePosition(liveMuzzle)) {
    near(shot.mesh.position.distanceTo(liveMuzzle), 0, 'shot did not start at visible barrel tip');
    near(shot.mesh.position.y - sentry.group.position.y, 1.0248, 'doubled model muzzle height', .02);
  } else near(shot.mesh.position.y - sentry.group.position.y, .72, 'missing asset keeps fallback muzzle');
  tick(.16); assert.equal(sentry.state, 'cooldown'); tick(.71); assert.equal(sentry.state, 'track');
  level.killEnemy(sentry); assert.equal(level.projectiles.length, 0, 'defeated sentry clears its shots');

  // The unchanged real Player collision code consumes the new presentation's
  // level-owned flags. Verify actual spin takedowns and armored shell recoil.
  const player = new Player(scene);
  player.rawInput = { moveX: 0, moveY: 0, consumeEdges() {} };
  for (const kind of ENEMY_KINDS) {
    reset(); const enemy = byKind[kind];
    if (kind === 'spinner') { enemy.state = 'in'; enemy.stateT = .2; }
    tick(0);
    player.pos.copy(enemy.group.position).add(new THREE.Vector3(-.7, 0, 0));
    player.prevPos.copy(player.pos); player.spinTimer = .3; player.invulnTimer = 10;
    player.spinBox.copy(enemy.box); player.playerBox.copy(enemy.box); player.state = 'ride';
    const before = enemy.group.position.x;
    player.collide(level);
    if (kind === 'turtle') {
      assert.equal(enemy.alive, true, 'turtle survives spin');
      near(enemy.group.position.x - before, .8, 'turtle shell recoil distance');
    } else {
      assert.equal(enemy.alive, false, `${kind} actual Player spin takedown`);
      assert.equal(enemy.flungT, 0, `${kind} starts ballistic fling`);
      near(enemy.flungVel.y, 10, `${kind} fling vertical velocity`);
    }
  }

  // Normal takedown and spin fling retain separate visibility/lifetime paths;
  // both soft/hard resets restore the complete home and clear all transient state.
  for (const kind of ENEMY_KINDS) {
    reset(); const enemy = byKind[kind], home = enemy.homePosition.clone();
    level.killEnemy(enemy); assert.equal(enemy.alive, false); assert.equal(enemy.group.visible, true);
    tick(.06); assert.equal(enemy.group.visible, true); tick(.061); assert.equal(enemy.group.visible, false);
    level.reset(false); assert.equal(enemy.alive, true); assert.equal(enemy.group.visible, true);
    assert.equal(enemy.defeatedT, undefined); assert.ok(enemy.group.position.distanceTo(home) < 1e-9);
    level.killEnemy(enemy, new THREE.Vector3(6, 10, 3));
    level.update(.1);
    near(enemy.group.position.x - home.x, .6, `${kind} fling X`);
    near(enemy.group.position.y - home.y, .7, `${kind} fling gravity`);
    near(enemy.group.position.z - home.z, .3, `${kind} fling Z`);
    assert.equal(enemy.group.visible, true, 'fling is not hidden by stomp timer');
    for (let i = 0; i < 15; i++) level.update(.1);
    assert.equal(enemy.group.visible, false); assert.equal(enemy.flungT, undefined);
    level.reset(true);
    assert.ok(enemy.group.position.distanceTo(home) < 1e-9);
    assert.equal(enemy.state, starts[kind]); assert.equal(enemy.stateT, 0);
    assert.equal(enemy.vy, 0); assert.equal(enemy.flungVel, undefined); assert.equal(enemy.defeatedT, undefined);
    assert.deepEqual(enemy.group.scale.toArray(), [1, 1, 1]);
  }
  level.dispose(); levels.splice(levels.indexOf(level), 1);
  for (const enemy of level.enemies) {
    assert.equal(enemy.visual.diagnostics.status, 'disposed', 'Level did not release visual ownership');
    assert.equal(enemy.group.parent, null, 'disposed enemy remained in Level traversal');
  }
  console.log(`PASS enemy gameplay: all eight combat identities, patrol/FSM/projectile transitions, real Player spin/recoil, collision extents, death/fling, reset and disposal. ${realAssets ? `Real models loaded: ${[...availableKinds].sort().join(', ')}; source muzzle aligned.` : 'Assets deliberately unavailable; rendering not tested.'}`);
} finally {
  for (const level of levels) level.dispose();
  await server.close();
  await new Promise(resolve => setImmediate(resolve));
  console.warn = originalWarn;
  GLTFLoader.prototype.loadAsync = originalLoadAsync;
}
