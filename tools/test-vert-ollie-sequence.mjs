import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';

const noop = () => {};

function installHeadlessDom() {
  const storage = new Map();
  const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
  const makeElement = (tag = 'div') => ({
    tagName: String(tag).toUpperCase(), style: {}, classList, children: [],
    addEventListener: noop, removeEventListener: noop, setAttribute: noop,
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    remove: noop,
  });
  globalThis.localStorage = {
    get length() { return storage.size; }, clear() { storage.clear(); },
    getItem(key) { return storage.get(String(key)) ?? null; },
    key(index) { return [...storage.keys()][index] ?? null; },
    removeItem(key) { storage.delete(String(key)); },
    setItem(key, value) { storage.set(String(key), String(value)); },
  };
  const context = new Proxy({
    canvas: null,
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: (_x, _y, width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    measureText: (text) => ({ width: String(text).length * 8 }),
  }, { get: (target, key) => key in target ? target[key] : noop });
  const makeCanvas = () => ({
    ...makeElement('canvas'), width: 1, height: 1,
    getContext() { context.canvas = this; return context; },
  });
  globalThis.document = {
    body: makeElement('body'), fonts: null,
    createElement(tag) { return tag === 'canvas' ? makeCanvas() : makeElement(tag); },
    createElementNS(_namespace, tag) { return this.createElement(tag); },
  };
  globalThis.window = {
    location: { search: '?lite', href: 'http://headless.invalid/?lite' },
    addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1,
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  globalThis.Image = class HeadlessImage {
    addEventListener(type, callback) { if (type === 'error') queueMicrotask(callback); }
    removeEventListener() {}
    set src(_value) { queueMicrotask(() => this.onerror?.(new Error('headless image'))); }
  };
  const NativeRequest = globalThis.Request;
  globalThis.Request = class HeadlessRequest extends NativeRequest {
    constructor(input, init) {
      super(typeof input === 'string' && input.startsWith('/')
        ? `http://headless.invalid${input}` : input, init);
    }
  };
  globalThis.fetch = async () => new Response('', { status: 404 });
}

const held = ['jumpHeld', 'grindHeld', 'spinHeld', 'grabHeld', 'transferHeld'];
const edges = ['jumpPressed', 'jumpReleased', 'grindPressed', 'spinPressed', 'grabPressed', 'restartPressed', 'transferPressed'];
function makeInput(overrides = {}) {
  const input = { moveX: 0, moveY: 0 };
  for (const key of [...held, ...edges]) input[key] = false;
  Object.assign(input, overrides);
  input.consumeEdges = () => { for (const key of edges) input[key] = false; };
  return input;
}

function capture(player, level, input) {
  return {
    state: player.state,
    grounded: player.grounded,
    x: player.pos.x,
    y: player.pos.y,
    z: player.pos.z,
    vVel: player.vVel,
    speed: player.speed,
    freeSkate: player.freeSkate,
    airFromSkate: player.airFromSkate,
    vertAir: player.vertAir,
    pipeHang: player.pipeHang,
    hangPipe: level.halfpipes.indexOf(player.hangPipe),
    boardOllieAir: player.boardOllieAir,
    charging: player.charging,
    chargeTimer: player.chargeTimer,
    jumpBufferT: player.jumpBufferT,
    emergencyEjectCharging: player.emergencyEjectCharging,
    emergencyEjectUsed: player.emergencyEjectUsed,
    vertReleaseStage: player.vertBoardRelease.stage,
    vertReleasePressArmed: player.vertBoardRelease.pressArmed,
    jumpReleaseRearmRequired: player.jumpReleaseRearmRequired,
    landingLaunchLockT: player.landingLaunchLockT,
    transferCoolT: player.transferCoolT,
    lastJumpType: player.lastJumpType,
    lastTy: player.lastTy,
    takeoffTy: player.takeoffTy,
    axisF: player.axisF.toArray(),
    rideNormal: player.rideNormal.toArray(),
    jumpHeld: input.jumpHeld,
    jumpPressed: input.jumpPressed,
    jumpReleased: input.jumpReleased,
  };
}

installHeadlessDom();
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!expectedAssetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!expectedAssetLog(args[0])) originalError(...args); };

const levels = [];
try {
  const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { Replayer, isReplayFile } = await server.ssrLoadModule('/src/replay.ts');
  const { CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const {
    beginVertBoardRelease,
    createVertBoardReleaseState,
    resetVertBoardRelease,
    SPINE_TRANSFER_DIRECTION_DOT,
    spineTransferDirectionHeld,
    stepVertBoardRelease,
  } = await server.ssrLoadModule('/src/vertBoardRelease.ts');

  assert.equal(SPINE_TRANSFER_DIRECTION_DOT, 0.35);
  assert.equal(spineTransferDirectionHeld(1, 0, 0, -1, 1, 0), true,
    'screen-right did not aim toward a +X transfer');
  assert.equal(spineTransferDirectionHeld(-1, 0, 0, -1, 1, 0), false,
    'screen-left incorrectly aimed toward a +X transfer');
  assert.equal(spineTransferDirectionHeld(0, 1, 0, -1, 1, 0), false,
    'perpendicular input incorrectly aimed across the spine');
  assert.equal(spineTransferDirectionHeld(0, 0, 0, -1, 1, 0), false,
    'neutral input incorrectly aimed across the spine');
  assert.equal(spineTransferDirectionHeld(0.35, 0, 0, -1, 1, 0), false,
    'threshold input incorrectly armed a spine transfer');
  assert.equal(spineTransferDirectionHeld(0.36, 0, 0, -1, 1, 0), true,
    'deliberate analog input did not arm a spine transfer');
  assert.equal(spineTransferDirectionHeld(0.3, 0.3, 0, -1, 1, 0), false,
    'diagonal magnitude bypassed the required toward component');
  assert.equal(spineTransferDirectionHeld(-1, 0, 0, -1, -1, 0), true,
    'screen-left did not aim toward a -X transfer');
  assert.equal(spineTransferDirectionHeld(0, -1, 0, -1, 0, 1), true,
    'screen-down did not aim toward a +Z transfer');
  assert.equal(spineTransferDirectionHeld(0, 1, 0, -1, 0, -1), true,
    'screen-up did not aim toward a -Z transfer');
  assert.equal(spineTransferDirectionHeld(0, 1, 0, -1, 0, 1), false,
    'screen-up incorrectly aimed toward a +Z transfer');
  assert.equal(spineTransferDirectionHeld(1, 0, 1, 0, 0, 1), true,
    'rotated camera-right did not aim toward a +Z transfer');

  const neutralReleaseInput = {
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
  };
  const releaseState = createVertBoardReleaseState();
  beginVertBoardRelease(releaseState);
  assert.deepEqual(releaseState, { stage: 1, pressArmed: false, holdT: 0 });

  let releaseStep = stepVertBoardRelease(releaseState, 1 / 60, {
    ...neutralReleaseInput,
    jumpReleased: true,
  });
  assert.equal(releaseStep.action, 'none', 'an unpaired release must not transfer');
  assert.equal(releaseStep.consumed, false, 'an unpaired release must remain available');
  assert.deepEqual(releaseState, { stage: 1, pressArmed: false, holdT: 0 });

  releaseStep = stepVertBoardRelease(releaseState, 1 / 60, {
    ...neutralReleaseInput,
    jumpPressed: true,
    jumpHeld: true,
  });
  assert.equal(releaseStep.action, 'none', 'a fresh press only arms the next release');
  assert.equal(releaseState.pressArmed, true);
  releaseStep = stepVertBoardRelease(releaseState, 0.12, {
    ...neutralReleaseInput,
    jumpHeld: true,
  });
  releaseStep = stepVertBoardRelease(releaseState, 1 / 60, {
    ...neutralReleaseInput,
    jumpReleased: true,
  });
  assert.equal(releaseStep.action, 'transfer');
  assert.equal(releaseStep.consumed, true, 'the sole transfer release is consumed before target resolution');
  assert.equal(releaseState.stage, 2);
  assert.ok(releaseStep.charge > 0.3, 'transfer reports normalized hold charge');

  releaseStep = stepVertBoardRelease(releaseState, 0, {
    ...neutralReleaseInput,
    jumpPressed: true,
  });
  releaseStep = stepVertBoardRelease(releaseState, 0.2, {
    ...neutralReleaseInput,
    jumpHeld: true,
  });
  releaseStep = stepVertBoardRelease(releaseState, 0, {
    ...neutralReleaseInput,
    jumpReleased: true,
  });
  assert.equal(releaseStep.action, 'abandon');
  assert.equal(releaseStep.consumed, true);
  assert.equal(releaseState.stage, 3);
  assert.equal(releaseStep.charge, 0.5, 'board abandon exposes normalized hold charge');

  releaseStep = stepVertBoardRelease(releaseState, 1, {
    jumpPressed: true,
    jumpHeld: true,
    jumpReleased: true,
  });
  assert.equal(releaseStep.action, 'none', 'the sequence is terminal after board abandon');
  assert.equal(releaseStep.consumed, false);
  assert.deepEqual(releaseState, { stage: 3, pressArmed: false, holdT: 0 });
  resetVertBoardRelease(releaseState);
  assert.deepEqual(releaseState, { stage: 0, pressArmed: false, holdT: 0 });

  const chargedState = createVertBoardReleaseState();
  beginVertBoardRelease(chargedState);
  stepVertBoardRelease(chargedState, 0.5, {
    jumpPressed: true,
    jumpHeld: true,
    jumpReleased: false,
  });
  releaseStep = stepVertBoardRelease(chargedState, 0, {
    ...neutralReleaseInput,
    jumpReleased: true,
  });
  assert.equal(releaseStep.charge, 1, 'hold charge clamps after 0.4 seconds');
  stepVertBoardRelease(chargedState, 0.1, {
    jumpPressed: true,
    jumpHeld: true,
    jumpReleased: false,
  });
  resetVertBoardRelease(chargedState);
  assert.deepEqual(chargedState, { stage: 0, pressArmed: false, holdT: 0 }, 'reset clears an armed release');

  // Player integration: each release reaches exactly one gameplay action and
  // cannot leak into the ordinary air jump/buffer paths.
  const integrationEntry = findLevel('flats');
  assert.ok(integrationEntry, 'Flats level is required for vert input integration');
  const integrationLevel = new Level(new THREE.Scene(), integrationEntry);
  const integrationPlayer = new Player(integrationLevel.scene);
  levels.push(integrationLevel);
  integrationPlayer.enterLevel(integrationEntry.id);
  integrationPlayer.respawn(integrationLevel, true);
  integrationPlayer.state = 'air';
  integrationPlayer.grounded = false;
  integrationPlayer.pos.set(0, 500, 0);
  integrationPlayer.prevPos.copy(integrationPlayer.pos);
  integrationPlayer.vVel = 5;
  integrationPlayer.freeSkate = true;
  integrationPlayer.airFromSkate = true;
  integrationPlayer.airGrav = 'board';
  integrationPlayer.vertAir = true;
  integrationPlayer.pipeHang = true;
  integrationPlayer.hangPipe = null;
  integrationPlayer.vertNormal.set(1, 0, 0);
  integrationPlayer.vertAnchor.copy(integrationPlayer.pos);
  integrationPlayer.vertLatVel = 5;

  // Exercise the real adjacent-pipe resolver once before isolating input
  // routing below. Two simple parallel mouths share a ridge probe.
  const sourcePipe = {
    axis: 'z', cross: 0, lipX: 5, lipY: 500, l0: -10, l1: 10,
    crossCoord: (x) => x,
    alongCoord: (_x, z) => z,
    rideSideCrossing: () => null,
    normalAt: (_u, out) => out.set(0, 1, 0),
  };
  const targetPipe = {
    axis: 'z', cross: 6, lipX: 2, lipY: 500, l0: -10, l1: 10,
    crossCoord: (x) => x,
    alongCoord: (_x, z) => z,
    rideSideCrossing: () => null,
    normalAt: (_u, out) => out.set(0, 1, 0),
  };
  const authoredPipes = integrationLevel.halfpipes.slice();
  integrationLevel.halfpipes.splice(0, integrationLevel.halfpipes.length, sourcePipe, targetPipe);
  const prepareDirectionalTransfer = () => {
    integrationPlayer.state = 'air';
    integrationPlayer.grounded = false;
    integrationPlayer.pos.set(5, 500, 0);
    integrationPlayer.prevPos.copy(integrationPlayer.pos);
    integrationPlayer.vVel = 5;
    integrationPlayer.freeSkate = true;
    integrationPlayer.airFromSkate = true;
    integrationPlayer.airGrav = 'board';
    integrationPlayer.vertAir = true;
    integrationPlayer.pipeHang = true;
    integrationPlayer.hangPipe = sourcePipe;
    integrationPlayer.vertNormal.set(1, 0, 0);
    integrationPlayer.vertAnchor.copy(integrationPlayer.pos);
    integrationPlayer.vertLatVel = 5;
    integrationPlayer.transferCoolT = 0;
    integrationPlayer.camDir.set(0, 0, -1);
    beginVertBoardRelease(integrationPlayer.vertBoardRelease);
  };

  // Direction is sampled on RELEASE, not remembered from the arming press.
  prepareDirectionalTransfer();
  integrationPlayer.step(CONST.fixedStep, makeInput({
    moveX: 1,
    jumpPressed: true,
    jumpHeld: true,
  }), integrationLevel);
  integrationPlayer.step(CONST.fixedStep, makeInput({ jumpReleased: true }), integrationLevel);
  assert.equal(integrationPlayer.vertBoardRelease.stage, 2,
    'mis-aimed release did not spend the transfer attempt');
  assert.equal(integrationPlayer.hangPipe, sourcePipe,
    'direction held only on press leaked into the transfer release');
  assert.equal(integrationPlayer.transferCoolT, 0,
    'rejected release armed transfer cooldown');
  assert.equal(integrationPlayer.pos.x, 5,
    'rejected release mutated the cross-pipe position');

  prepareDirectionalTransfer();
  integrationPlayer.step(CONST.fixedStep, makeInput({
    jumpPressed: true,
    jumpHeld: true,
  }), integrationLevel);
  integrationPlayer.step(CONST.fixedStep, makeInput({
    moveX: 1,
    jumpReleased: true,
  }), integrationLevel);
  assert.equal(integrationPlayer.hangPipe, targetPipe,
    'direction first held on release did not transfer');
  assert.equal(integrationPlayer.prevPos.x, integrationPlayer.pos.x,
    'transfer mirrors the physics sweep origin');
  assert.equal(integrationPlayer.vertLatVel, -5,
    'transfer preserves world lateral carry through mirrored basis');

  prepareDirectionalTransfer();
  integrationPlayer.rawInput = makeInput();
  assert.equal(integrationPlayer.tryAdjacentSpineTransfer(integrationLevel), false,
    'neutral input transferred across the adjacent spine');
  assert.equal(integrationPlayer.hangPipe, sourcePipe);
  integrationPlayer.rawInput = makeInput({ moveX: -1 });
  assert.equal(integrationPlayer.tryAdjacentSpineTransfer(integrationLevel), false,
    'input held away from the adjacent pipe transferred anyway');
  assert.equal(integrationPlayer.hangPipe, sourcePipe);
  integrationPlayer.rawInput = makeInput({ moveX: 1 });
  assert.equal(integrationPlayer.tryAdjacentSpineTransfer(integrationLevel), true);
  assert.equal(integrationPlayer.hangPipe, targetPipe);
  integrationLevel.halfpipes.splice(0, integrationLevel.halfpipes.length, ...authoredPipes);

  integrationPlayer.pos.set(0, 500, 0);
  integrationPlayer.prevPos.copy(integrationPlayer.pos);
  integrationPlayer.vertNormal.set(1, 0, 0);
  integrationPlayer.vertAnchor.copy(integrationPlayer.pos);
  integrationPlayer.vertLatVel = 5;
  integrationPlayer.hangPipe = null;
  integrationPlayer.transferCoolT = 0;
  beginVertBoardRelease(integrationPlayer.vertBoardRelease);
  let transferAttempts = 0;
  integrationPlayer.tryAdjacentSpineTransfer = () => {
    transferAttempts++;
    return false;
  };

  integrationPlayer.step(CONST.fixedStep, makeInput({
    jumpPressed: true,
    jumpHeld: true,
  }), integrationLevel);
  assert.equal(integrationPlayer.vertBoardRelease.pressArmed, true);
  assert.equal(transferAttempts, 0, 'press alone cannot transfer');
  // Losing the wall before X comes up does not release ownership: real pipe
  // exits convert lateral carry into ordinary planar speed in the same way.
  integrationPlayer.vertAir = false;
  integrationPlayer.pipeHang = false;
  integrationPlayer.vertLatVel = 0;
  integrationPlayer.axisF.set(0, 0, 1);
  integrationPlayer.axisL.set(1, 0, 0);
  integrationPlayer.speed = 5;
  integrationPlayer.step(CONST.fixedStep, makeInput({ jumpReleased: true }), integrationLevel);
  assert.equal(transferAttempts, 1, 'second release stays owned after vert authority clears');
  assert.equal(integrationPlayer.vertBoardRelease.stage, 2);
  assert.equal(integrationPlayer.jumpBufferT, 0, 'transfer release cannot seed landing buffer');
  assert.equal(integrationPlayer.airTapT, 0, 'transfer release cannot arm double jump');

  integrationPlayer.step(CONST.fixedStep, makeInput({
    jumpPressed: true,
    jumpHeld: true,
  }), integrationLevel);
  const abandonPlanar = Math.abs(integrationPlayer.speed);
  integrationPlayer.step(CONST.fixedStep, makeInput({ jumpReleased: true }), integrationLevel);
  assert.equal(integrationPlayer.lastJumpType, 'Board Abandon');
  assert.equal(integrationPlayer.vertBoardRelease.stage, 3);
  assert.equal(integrationPlayer.freeSkate, false, 'third release abandons the board');
  assert.equal(integrationPlayer.vertAir, false, 'board abandon exits vert authority');
  assert.equal(integrationPlayer.airGrav, 'foot');
  assert.equal(integrationPlayer.jumpBufferT, 0, 'abandon release cannot seed landing buffer');
  assert.ok(integrationPlayer.flyBoard?.visible, 'abandoned board enters loose-board simulation');
  assert.ok(
    Math.abs(
      Math.hypot(integrationPlayer.flyBoardVel.x, integrationPlayer.flyBoardVel.z) -
      abandonPlanar
    ) < 1e-6,
    'loose board inherits coping-tangent momentum',
  );
  assert.ok(
    Math.abs(Math.abs(integrationPlayer.speed) - abandonPlanar * 0.82) < 1e-6,
    'rider retains the authored share of coping-tangent momentum',
  );

  // If another move stows the deck after vert-wall loss, it cancels the old
  // release transaction but still owns the held X until it comes back up.
  integrationPlayer.state = 'air';
  integrationPlayer.grounded = false;
  integrationPlayer.pos.set(0, 500, 0);
  integrationPlayer.prevPos.copy(integrationPlayer.pos);
  integrationPlayer.vVel = 2;
  integrationPlayer.freeSkate = true;
  integrationPlayer.airFromSkate = true;
  integrationPlayer.airGrav = 'board';
  integrationPlayer.vertAir = false;
  integrationPlayer.pipeHang = false;
  integrationPlayer.slamActive = false;
  beginVertBoardRelease(integrationPlayer.vertBoardRelease);
  integrationPlayer.step(CONST.fixedStep, makeInput({
    jumpPressed: true,
    jumpHeld: true,
  }), integrationLevel);
  assert.equal(integrationPlayer.vertBoardRelease.pressArmed, true);
  integrationPlayer.step(CONST.fixedStep, makeInput({
    moveY: -1,
    jumpHeld: true,
    grabPressed: true,
    grabHeld: true,
  }), integrationLevel);
  assert.equal(integrationPlayer.slamActive, true);
  assert.equal(integrationPlayer.freeSkate, false);
  assert.equal(integrationPlayer.vertBoardRelease.stage, 0, 'board stow cancels vert release sequence');
  assert.equal(integrationPlayer.jumpReleaseRearmRequired, true, 'stowed air press stays owned until release');

  // Source contract stays explicit even when CI has no external replay file.
  const playerSource = await readFile(new URL('../src/player.ts', import.meta.url), 'utf8');
  assert.match(playerSource, /jumpReleased/);

  if (process.argv[2]) {
    const replay = JSON.parse(await readFile(process.argv[2], 'utf8'));
    assert.equal(isReplayFile(replay), true, 'supplied vert replay failed schema validation');
    const entry = findLevel(replay.level);
    assert.ok(entry, `replay level ${replay.level} is not registered`);
    const level = new Level(new THREE.Scene(), entry);
    const player = new Player(level.scene);
    levels.push(level);
    player.enterLevel(entry.id);
    player.endlessDeaths = replay.endlessDeaths === true;
    player.respawn(level, true);
    const input = makeInput();
    const replayer = new Replayer();
    replayer.begin(replay);
    const samples = new Map();
    const transitions = [];
    let previous = capture(player, level, input);
    const wanted = new Set();
    for (const edge of [
      4520, 4521,
      5357, 5383, 5424, 5453, 5487, 5500, 5501, 5572,
      5604, 5608, 5609, 5611,
    ]) {
      for (let offset = -2; offset <= 3; offset++) wanted.add(edge + offset);
    }
    while (replayer.active && replayer.frame <= 8886) {
      const frame = replayer.frame;
      if (!replayer.feed(input, player.camDir)) break;
      player.step(CONST.fixedStep, input, level);
      level.update(CONST.fixedStep);
      const current = capture(player, level, input);
      if (wanted.has(frame)) samples.set(frame, current);
      if (
        input.jumpPressed || input.jumpReleased ||
        current.state !== previous.state ||
        current.grounded !== previous.grounded ||
        current.vertAir !== previous.vertAir ||
        current.pipeHang !== previous.pipeHang ||
        current.hangPipe !== previous.hangPipe ||
        current.freeSkate !== previous.freeSkate
      ) transitions.push({ frame, ...current });
      previous = current;
      input.consumeEdges();
    }
    if (replay.level === 'flats' && replay.frames === 9551) {
      const landing = samples.get(4520);
      const firstGroundBeat = samples.get(4521);
      assert.equal(landing?.state, 'ride', 'supplied edge case must still land');
      assert.equal(landing?.grounded, true);
      assert.ok(landing?.landingLaunchLockT > 0, 'landing arms one automatic-crest guard beat');
      assert.equal(firstGroundBeat?.state, 'ride', 'first grounded beat must not auto-relaunch uphill');
      assert.equal(firstGroundBeat?.grounded, true);
      assert.equal(firstGroundBeat?.vertAir, false);
      assert.equal(firstGroundBeat?.pipeHang, false);
      assert.equal(firstGroundBeat?.airFromSkate, false, 'landing cannot conjure the loose board');
      assert.ok(firstGroundBeat?.speed > 0, 'the fixed landing keeps its downhill carry');

      assert.equal(samples.get(5357)?.vertReleaseStage, 1, 'first vert ollie starts release stage one');
      assert.equal(samples.get(5383)?.state, 'ride', 'the first authored vert air still lands');
      assert.equal(samples.get(5424)?.charging, true, 'later fresh X press still charges normally');
      assert.equal(samples.get(5453)?.lastJumpType, 'Board Ollie');
      assert.equal(samples.get(5453)?.vertReleaseStage, 1, 'later deliberate ollie still starts vert air');
      assert.equal(samples.get(5487)?.vertReleasePressArmed, true, 'fresh mid-air press arms transfer release');
      assert.equal(samples.get(5500)?.jumpReleaseRearmRequired, true, 'air press held through landing stays air-owned');
      assert.equal(samples.get(5501)?.charging, false, 'held air press cannot become a ground charge');
      assert.equal(samples.get(5572)?.state, 'ride', 'the eventual release is swallowed on the ground');
      assert.equal(samples.get(5572)?.charging, false);
      assert.equal(samples.get(5572)?.jumpReleaseRearmRequired, false, 'release rearms the next fresh press');
    }
    if (process.env.TRACE_VERT_REPLAY === '1') {
      const criticalFrames = [4520, 4521, 5357, 5383, 5424, 5453, 5487, 5500, 5501, 5572];
      console.log(JSON.stringify(Object.fromEntries(
        criticalFrames.map((frame) => [frame, samples.get(frame)]),
      ), null, 2));
    }
    if (process.env.TRACE_VERT_REPLAY === 'transitions') {
      console.log('VERT_TRANSITIONS');
      const traceStart = Number(process.env.TRACE_START ?? 0);
      const traceEnd = Number(process.env.TRACE_END ?? Number.POSITIVE_INFINITY);
      console.log(JSON.stringify(transitions.filter((row, index, rows) =>
        row.frame >= traceStart && row.frame <= traceEnd &&
        (row.vertAir || row.pipeHang || row.jumpPressed || row.jumpReleased ||
          rows[index - 1]?.vertAir || rows[index - 1]?.pipeHang)), null, 2));
    }
    replayer.end();
  }

  console.log('PASS vert ollie sequence harness');
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  for (const level of levels) level.dispose();
  await server.close();
}
