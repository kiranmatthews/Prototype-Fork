import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop = () => {};' + harness.slice(
  harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held'),
) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
const assetLog = value => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!assetLog(args[0])) warn(...args); };
console.error = (...args) => { if (!assetLog(args[0])) error(...args); };
try {
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  const { TUNING, CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const flat = new Level(new THREE.Scene(), { id: 'slide-jump-test', name: 'Slide jump', data: {
    v: 1, name: 'Slide jump', spawn: [0, .02, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [100, 1, 100] }, { t: 'gate', p: [0, 0, -45] }],
  } });
  const makePlayer = () => {
    const p = new Player(flat.scene); p.enterLevel('slide-jump-test'); p.respawn(flat, true);
    p.grounded = true; p.state = 'ride'; p.speed = 0; p.freeSkate = false;
    return p;
  };
  const measureRise = p => {
    const start = p.pos.y;
    let peak = start;
    for (let frame = 0; frame < 100 && p.state === 'air'; frame++) {
      p.step(CONST.fixedStep, { moveX: 0, moveY: 0 }, flat); flat.update(CONST.fixedStep);
      peak = Math.max(peak, p.pos.y);
    }
    return peak - start;
  };
  for (const charge of [0, TUNING.jumpChargeTime]) {
    const normal = makePlayer(); normal.chargeTimer = charge; normal.chargedJump(CONST.fixedStep);
    const normalPop = normal.vVel, normalRise = measureRise(normal);
    for (const inGrace of [false, true]) {
      const p = makePlayer();
      p.slideTimer = inGrace ? 0 : .12; p.slideGraceT = inGrace ? .1 : 0;
      p.crawling = inGrace; p.crouchGraceT = inGrace ? .1 : 0;
      p.slidePose = 1; p.slideVec.set(1, 0, 0); p.chargeTimer = charge; p.flipTimer = .3;
      const rig = a.RigBinding.fromSculptRuntime(p.animationRig.root);
      const suite = a.createPlayerStarterAnimationSuite(rig.definition);
      const oldSuite = { ...suite, metadata: { ...suite.metadata, playerStarterCatalogVersion: 26 },
        clips: suite.clips.filter(clip => clip.id !== 'player.slide-jump') };
      const migrated = a.reconcilePlayerStarterAnimationSuite(oldSuite, rig.definition);
      assert.ok(migrated.clips.some(clip => clip.id === 'player.slide-jump'), 'saved suite did not gain the slide-jump pose');
      assert.deepEqual(migrated.clips.filter(clip => clip.id !== 'player.slide-jump'), oldSuite.clips);
      const runtime = createCharacterAnimationRuntime(p, suite);
      p.chargedJump(CONST.fixedStep);
      assert.equal(p.lastJumpType, 'Slide Jump');
      assert.equal(p.animationClipHint, 'player.slide-jump', 'slide tail masked the split pose');
      assert.equal(p.doubleJumpAir, false, 'slide pose reused a double-jump gameplay flag');
      assert.equal(p.flipTimer, 0, 'slide jump inherited a forward roll');
      assert.ok(Math.abs(p.speed) < 1e-9 && Math.abs(p.slideAirLat) > 10, 'sideways slide launch lost its direction');
      assert.ok(p.vVel < normalPop * 1.2, 'slide/grace crouch boosts still stack');
      p.syncVisual({ moveX: 0, moveY: 0 }, CONST.fixedStep);
      assert.equal(runtime.activeClipId, 'player.slide-jump');
      for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const direction = new THREE.Vector3(0, -1, 0).applyQuaternion(rig.getJoint(`hip${side}`).quaternion);
        assert.ok(direction.x * sign > .6, 'slide jump did not split the legs immediately');
      }
      const rise = measureRise(p);
      assert.ok(Math.abs(rise / normalRise - TUNING.slideJumpHeight) < .035,
        `slide height ratio ${rise / normalRise} does not match the height setting`);
      assert.equal(p.freeSkate, false, 'slide jump landed on the board');
      runtime.dispose();
    }
    const crouch = makePlayer(); crouch.crawling = true; crouch.chargeTimer = charge;
    crouch.chargedJump(CONST.fixedStep);
    assert.ok(Math.abs(crouch.vVel - normalPop * CONST.crouchJumpMult) < 1e-9, 'ordinary crouch jump changed');
  }
  flat.dispose();
  if (process.argv[2]) {
    const data = JSON.parse(await readFile(process.argv[2], 'utf8'));
    const entry = findLevel(data.level); assert.ok(entry);
    const level = new Level(new THREE.Scene(), entry);
    const player = new Player(level.scene);
    player.enterLevel(entry.id); player.endlessDeaths = data.endlessDeaths === true; player.respawn(level, true);
    const replay = new Replayer(); replay.begin(data);
    const input = { moveX: 0, moveY: 0, consumeEdges() {} };
    let flight = null;
    const flights = [];
    while (replay.active && replay.frame < data.frames) {
      const frame = replay.frame;
      if (!replay.feed(input, player.camDir)) break;
      const before = { slide: player.slideTimer, grace: player.slideGraceT, crouching: player.crawling,
        crouchGrace: player.crouchGraceT, charge: player.chargeTimer, state: player.state, y: player.pos.y };
      player.step(1 / 60, input, level); level.update(1 / 60);
      if (before.state !== 'air' && player.state === 'air') {
        flight = { frame, kind: player.lastJumpType, launchY: player.pos.y, velocity: player.vVel,
          hint: player.animationClipHint, before, peakY: player.pos.y, hints: new Set() };
        flights.push(flight);
      }
      if (flight && player.state === 'air') {
        flight.peakY = Math.max(flight.peakY, player.pos.y); flight.hints.add(player.animationClipHint);
      } else flight = null;
    }
    console.log(flights.map(({ hints, ...f }) => ({ ...f, rise: f.peakY - f.launchY, hints: [...hints] })));
    const slide = flights.find(f => f.kind === 'Slide Jump'); assert.ok(slide, 'replay did not reproduce the reported slide jump');
    assert.ok(slide.peakY - slide.launchY < 4, 'reported slide jump still rises too high');
    assert.deepEqual([...slide.hints], ['player.slide-jump'], 'reported slide jump lost its split pose during flight');
    replay.end(); level.dispose();
  }
  console.log('PASS single slide height boost, crouch/grace exclusion, directional travel, split pose and on-foot landing');
} finally { await server.close(); console.warn = warn; console.error = error; }
