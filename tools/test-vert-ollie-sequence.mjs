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
  const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
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

  const prepareSteeringPlayer = (headingX, headingZ) => {
    const candidate = new Player(integrationLevel.scene);
    candidate.enterLevel(integrationEntry.id);
    candidate.respawn(integrationLevel, true);
    candidate.pos.set(0, integrationLevel.spawnPos.y, -220);
    candidate.prevPos.copy(candidate.pos);
    const ground = candidate.queryGround(integrationLevel);
    assert.ok(ground, 'steering-intent fixture has no ordinary support');
    candidate.pos.y = ground.y;
    candidate.groundHit = ground;
    candidate.rideNormal.copy(ground.normal);
    candidate.state = 'ride';
    candidate.grounded = true;
    candidate.speed = 27.2;
    candidate.freeSkate = true;
    candidate.axisF.set(headingX, 0, headingZ).normalize();
    candidate.axisL.set(candidate.axisF.z, 0, -candidate.axisF.x);
    candidate.prevPos.copy(candidate.pos);
    candidate.pipeLandGraceT = 0;
    candidate.brakeLockT = 0;
    return candidate;
  };
  const placeOnPipe = (candidate) => {
    const pipe = integrationLevel.halfpipes[0];
    assert.ok(pipe, 'Flats pipe is required for steering-intent integration');
    const along = (pipe.l0 + pipe.l1) * 0.5;
    const u = pipe.crossToU(pipe.cross);
    const normal = pipe.normalAt(u, new THREE.Vector3());
    candidate.pos.set(pipe.cross, pipe.surfaceY(u), along);
    candidate.prevPos.copy(candidate.pos);
    candidate.groundHit = {
      y: candidate.pos.y,
      normal,
      name: 'halfpipe',
      halfpipe: pipe,
    };
    candidate.rideNormal.copy(normal);
    candidate.pipeRideT = 0.2;
    return { pipe, along };
  };

  // Directional intent is global and camera-relative: an opposite lateral
  // direction means "carve around", not "stop", on both ordinary ground and
  // a halfpipe. The exact 180-degree tie turns through screen-forward.
  const flatHardCarve = prepareSteeringPlayer(1, 0);
  const flatStartZ = flatHardCarve.pos.z;
  let flatCarveMinSpeed = flatHardCarve.speed;
  for (let frame = 0; frame < 46; frame++) {
    flatHardCarve.step(CONST.fixedStep, makeInput({ moveX: -1 }), integrationLevel);
    flatCarveMinSpeed = Math.min(flatCarveMinSpeed, flatHardCarve.speed);
  }
  assert.equal(flatHardCarve.brakeLockT, 0,
    'ordinary lateral reversal leaked into the pull-back lock');
  assert.ok(flatCarveMinSpeed > 12,
    'ordinary lateral hard carve scrubbed away its momentum');
  assert.ok(flatHardCarve.axisF.z < -0.75 && flatHardCarve.pos.z < flatStartZ - 8,
    'ordinary lateral reversal did not carve through screen-forward');

  const pipeHardCarve = prepareSteeringPlayer(1, 0);
  const { along: pipeStartAlong } = placeOnPipe(pipeHardCarve);
  pipeHardCarve.pipeLandGraceT = 0.2;
  let pipeCarveMinSpeed = pipeHardCarve.speed;
  pipeHardCarve.step(CONST.fixedStep, makeInput({ moveX: -1 }), integrationLevel);
  pipeCarveMinSpeed = Math.min(pipeCarveMinSpeed, pipeHardCarve.speed);
  assert.ok(Math.abs(pipeHardCarve.axisF.z) < 1e-9 && pipeHardCarve.haltCd === 0,
    'landing grace did not suppress stale opposite carve input');
  for (let frame = 1; frame < 46; frame++) {
    pipeHardCarve.step(CONST.fixedStep, makeInput({ moveX: -1 }), integrationLevel);
    pipeCarveMinSpeed = Math.min(pipeCarveMinSpeed, pipeHardCarve.speed);
  }
  assert.equal(pipeHardCarve.brakeLockT, 0,
    'pipe lateral reversal leaked into the pull-back lock');
  assert.ok(pipeCarveMinSpeed > 12 && pipeHardCarve.freeSkate,
    'pipe lateral hard carve stopped or dismounted the board');
  assert.ok(pipeHardCarve.axisF.z < -0.75 && pipeHardCarve.pos.z < pipeStartAlong - 8,
    'pipe lateral reversal did not carve out along the channel');

  // A true screen-back pull against screen-forward travel remains the stop
  // gesture everywhere; only the accidental lateral/opposite case changed.
  const gracePullback = prepareSteeringPlayer(0, -1);
  placeOnPipe(gracePullback);
  gracePullback.pipeLandGraceT = 0.2;
  const graceStartSpeed = gracePullback.speed;
  gracePullback.step(CONST.fixedStep, makeInput({ moveY: -1 }), integrationLevel);
  assert.ok(gracePullback.speed > graceStartSpeed - 0.1 && gracePullback.haltCd === 0,
    'fresh pipe landing treated stale climb input as an immediate pull-back');

  for (const [label, onPipe] of [['flat', false], ['pipe', true]]) {
    const pullback = prepareSteeringPlayer(0, -1);
    if (onPipe) placeOnPipe(pullback);
    let maxLock = 0;
    for (let frame = 0; frame < 46; frame++) {
      pullback.step(CONST.fixedStep, makeInput({ moveY: -1 }), integrationLevel);
      maxLock = Math.max(maxLock, pullback.brakeLockT);
    }
    assert.ok(maxLock > 0, `${label} pull-back did not arm the stop lock`);
    assert.ok(pullback.speed < 27.2 * 0.5,
      `${label} pull-back did not substantially stop forward travel`);
    assert.ok(pullback.axisF.z < -0.999,
      `${label} pull-back rotated the heading instead of stopping it`);
  }

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

  const prepareFlatLanding = (candidate) => {
    candidate.enterLevel(integrationEntry.id);
    candidate.respawn(integrationLevel, true);
    const hit = candidate.queryGround(integrationLevel);
    assert.ok(hit, 'flat landing fixture has no ground');
    candidate.state = 'air';
    candidate.grounded = false;
    candidate.pos.y = hit.y + 0.02;
    candidate.prevPos.copy(candidate.pos);
    candidate.vVel = -2;
    candidate.speed = 10;
    candidate.freeSkate = true;
    candidate.airFromSkate = true;
    candidate.airGrav = 'board';
    candidate.vertAir = false;
    candidate.pipeHang = false;
    return hit;
  };

  // The release rearm is a VERT transaction. An ordinary board-air press held
  // through touchdown becomes the next grounded charge; otherwise X can be
  // hidden for seconds and both the uphill drive and eventual ollie disappear.
  const ordinaryLandingPlayer = new Player(integrationLevel.scene);
  prepareFlatLanding(ordinaryLandingPlayer);
  ordinaryLandingPlayer.boardOllieAir = true;
  ordinaryLandingPlayer.emergencyEjectCharging = true;
  ordinaryLandingPlayer.step(
    CONST.fixedStep,
    makeInput({ jumpHeld: true }),
    integrationLevel,
  );
  assert.equal(ordinaryLandingPlayer.grounded, true, 'ordinary board air did not land');
  assert.equal(ordinaryLandingPlayer.jumpReleaseRearmRequired, false,
    'ordinary board air inherited the vert-only release lock');
  ordinaryLandingPlayer.step(
    CONST.fixedStep,
    makeInput({ jumpHeld: true }),
    integrationLevel,
  );
  assert.equal(ordinaryLandingPlayer.charging, true,
    'held X did not become the next grounded charge after an ordinary landing');
  ordinaryLandingPlayer.step(
    CONST.fixedStep,
    makeInput({ jumpReleased: true }),
    integrationLevel,
  );
  assert.equal(ordinaryLandingPlayer.lastJumpType, 'Board Ollie');
  assert.equal(ordinaryLandingPlayer.state, 'air');

  // The original post-vert guarantee remains: an unfinished transfer/abandon
  // press cannot silently turn into ground pump or an uphill relaunch.
  const vertLandingPlayer = new Player(integrationLevel.scene);
  prepareFlatLanding(vertLandingPlayer);
  beginVertBoardRelease(vertLandingPlayer.vertBoardRelease);
  vertLandingPlayer.vertBoardRelease.pressArmed = true;
  vertLandingPlayer.step(
    CONST.fixedStep,
    makeInput({ jumpHeld: true }),
    integrationLevel,
  );
  assert.equal(vertLandingPlayer.grounded, true, 'vert release fixture did not land');
  assert.equal(vertLandingPlayer.jumpReleaseRearmRequired, true,
    'unfinished vert press was not retained through landing');
  vertLandingPlayer.step(
    CONST.fixedStep,
    makeInput({ moveY: 1, jumpHeld: true }),
    integrationLevel,
  );
  assert.equal(vertLandingPlayer.charging, false,
    'unfinished vert press bled into grounded charge');
  vertLandingPlayer.step(
    CONST.fixedStep,
    makeInput({ moveY: 1, jumpReleased: true }),
    integrationLevel,
  );
  assert.equal(vertLandingPlayer.state, 'ride',
    'unfinished vert release launched back uphill after landing');
  assert.equal(vertLandingPlayer.jumpReleaseRearmRequired, false,
    'releasing the retained vert press did not rearm X');

  // Input preserves a press+release shorter than one fixed step as two edges
  // with held=false. The final supported sample before a ledge must still
  // produce the minimum ollie instead of consuming both edges silently.
  const supportedTapPlayer = new Player(integrationLevel.scene);
  supportedTapPlayer.enterLevel(integrationEntry.id);
  supportedTapPlayer.respawn(integrationLevel, true);
  assert.equal(supportedTapPlayer.grounded, true,
    'supported same-sample tap fixture did not settle');
  supportedTapPlayer.speed = 10;
  supportedTapPlayer.freeSkate = true;
  supportedTapPlayer.step(
    CONST.fixedStep,
    makeInput({
      jumpPressed: true,
      jumpReleased: true,
      jumpHeld: false,
    }),
    integrationLevel,
  );
  assert.equal(supportedTapPlayer.state, 'air');
  assert.equal(supportedTapPlayer.lastJumpType, 'Board Ollie',
    'supported same-sample X tap was ignored');
  assert.ok(supportedTapPlayer.vVel >= TUNING.ollieMinVelocity);

  // Coyote eligibility belongs to the PRESS. A valid press near the end of
  // the edge window gets a bounded beat to finish the release-to-jump gesture.
  const coyotePlayer = new Player(integrationLevel.scene);
  coyotePlayer.enterLevel(integrationEntry.id);
  coyotePlayer.respawn(integrationLevel, true);
  coyotePlayer.state = 'air';
  coyotePlayer.grounded = false;
  coyotePlayer.pos.set(0, 500, 0);
  coyotePlayer.prevPos.copy(coyotePlayer.pos);
  coyotePlayer.vVel = 0;
  coyotePlayer.speed = 10;
  coyotePlayer.freeSkate = true;
  coyotePlayer.airFromSkate = true;
  coyotePlayer.airGrav = 'board';
  coyotePlayer.boardOllieAir = false;
  // The timer is decremented before state routing; exactly one remaining tick
  // must still be eligible on this input sample.
  coyotePlayer.coyoteTimer = CONST.fixedStep;
  coyotePlayer.step(
    CONST.fixedStep,
    makeInput({ jumpPressed: true, jumpHeld: true }),
    integrationLevel,
  );
  assert.equal(coyotePlayer.charging, true, 'on-time coyote press did not arm');
  for (let frame = 0; frame < 5; frame++) {
    coyotePlayer.step(
      CONST.fixedStep,
      makeInput({ jumpHeld: true }),
      integrationLevel,
    );
  }
  assert.equal(coyotePlayer.coyoteTimer, 0, 'edge timer did not expire in latch test');
  assert.equal(coyotePlayer.charging, true,
    'accepted coyote press was cancelled before its release');
  // Release on the latch's own final pre-decrement tick as well.
  coyotePlayer.coyoteReleaseT = CONST.fixedStep;
  coyotePlayer.step(
    CONST.fixedStep,
    makeInput({ jumpReleased: true }),
    integrationLevel,
  );
  assert.equal(coyotePlayer.lastJumpType, 'Board Ollie');
  assert.ok(coyotePlayer.vVel >= TUNING.ollieMinVelocity,
    'latched coyote release did not launch');
  assert.ok(coyotePlayer.airborneT <= Number.EPSILON,
    'coyote relaunch kept counting airtime from the ledge instead of the jump');
  assert.ok(coyotePlayer.launchVy >= TUNING.ollieMinVelocity,
    'coyote relaunch did not record its double-jump launch reference');
  assert.ok(coyotePlayer.launchVy > coyotePlayer.vVel,
    'launch reference was overwritten by the first post-jump gravity step');
  const coyoteLaunchReference = coyotePlayer.launchVy;
  coyotePlayer.step(CONST.fixedStep, makeInput(), integrationLevel);
  assert.equal(coyotePlayer.launchVy, coyoteLaunchReference,
    'next air tick overwrote the coyote launch reference after gravity');

  // A tap shorter than one fixed step carries both edges with held=false.
  // The on-foot route is important: without coyote ownership the same press
  // can also arm double jump after the pre-decrement timer reaches zero.
  const sameSampleCoyotePlayer = new Player(integrationLevel.scene);
  sameSampleCoyotePlayer.enterLevel(integrationEntry.id);
  sameSampleCoyotePlayer.respawn(integrationLevel, true);
  sameSampleCoyotePlayer.state = 'air';
  sameSampleCoyotePlayer.grounded = false;
  sameSampleCoyotePlayer.pos.set(0, 500, 0);
  sameSampleCoyotePlayer.prevPos.copy(sameSampleCoyotePlayer.pos);
  sameSampleCoyotePlayer.vVel = 0;
  sameSampleCoyotePlayer.speed = TUNING.walkSpeed;
  sameSampleCoyotePlayer.freeSkate = false;
  sameSampleCoyotePlayer.airFromSkate = false;
  sameSampleCoyotePlayer.airGrav = 'foot';
  sameSampleCoyotePlayer.coyoteTimer = CONST.fixedStep;
  sameSampleCoyotePlayer.step(
    CONST.fixedStep,
    makeInput({
      jumpPressed: true,
      jumpReleased: true,
      jumpHeld: false,
    }),
    integrationLevel,
  );
  assert.equal(sameSampleCoyotePlayer.state, 'air');
  assert.notEqual(sameSampleCoyotePlayer.lastJumpType, 'Double Jump',
    'one coyote tap fired both the first and second jump');
  assert.equal(sameSampleCoyotePlayer.airJumpUsed, false,
    'coyote tap spent the double jump on its launch frame');
  assert.equal(sameSampleCoyotePlayer.airTapT, 0,
    'coyote-owned press leaked into the double-jump tap latch');
  assert.ok(sameSampleCoyotePlayer.airborneT <= Number.EPSILON);
  assert.ok(sameSampleCoyotePlayer.launchVy >= TUNING.jumpMinVelocity);
  assert.ok(sameSampleCoyotePlayer.launchVy > sameSampleCoyotePlayer.vVel);

  // The same accumulated press+release can occur on the exact ride->air step.
  // stepRide must consume it after detecting the missing support; stepAir will
  // not run until the following fixed sample, when both edges are already gone.
  const edgeSampleCoyotePlayer = new Player(integrationLevel.scene);
  edgeSampleCoyotePlayer.enterLevel(integrationEntry.id);
  edgeSampleCoyotePlayer.respawn(integrationLevel, true);
  const edgeGround = edgeSampleCoyotePlayer.queryGround(integrationLevel);
  assert.ok(edgeGround, 'same-sample edge fixture has no starting ground');
  edgeSampleCoyotePlayer.state = 'ride';
  edgeSampleCoyotePlayer.grounded = true;
  edgeSampleCoyotePlayer.pos.set(0, 500, 0);
  edgeSampleCoyotePlayer.prevPos.copy(edgeSampleCoyotePlayer.pos);
  edgeSampleCoyotePlayer.groundHit = {
    ...edgeGround,
    y: edgeSampleCoyotePlayer.pos.y,
  };
  edgeSampleCoyotePlayer.rideNormal.set(0, 1, 0);
  edgeSampleCoyotePlayer.speed = 10;
  edgeSampleCoyotePlayer.freeSkate = true;
  edgeSampleCoyotePlayer.queryGround = () => null;
  edgeSampleCoyotePlayer.queryShadowGround = () => 490;
  edgeSampleCoyotePlayer.step(
    CONST.fixedStep,
    makeInput({
      jumpPressed: true,
      jumpReleased: true,
      jumpHeld: false,
    }),
    integrationLevel,
  );
  assert.equal(edgeSampleCoyotePlayer.state, 'air');
  assert.equal(edgeSampleCoyotePlayer.lastJumpType, 'Board Ollie',
    'same-sample edge tap was consumed before coyote routing saw it');
  assert.ok(edgeSampleCoyotePlayer.vVel >= TUNING.ollieMinVelocity);
  assert.ok(edgeSampleCoyotePlayer.airborneT <= Number.EPSILON);

  const lateCoyotePlayer = new Player(integrationLevel.scene);
  lateCoyotePlayer.enterLevel(integrationEntry.id);
  lateCoyotePlayer.respawn(integrationLevel, true);
  lateCoyotePlayer.state = 'air';
  lateCoyotePlayer.grounded = false;
  lateCoyotePlayer.pos.set(0, 500, 0);
  lateCoyotePlayer.prevPos.copy(lateCoyotePlayer.pos);
  lateCoyotePlayer.vVel = 0;
  lateCoyotePlayer.speed = 10;
  lateCoyotePlayer.freeSkate = true;
  lateCoyotePlayer.airFromSkate = true;
  lateCoyotePlayer.airGrav = 'board';
  lateCoyotePlayer.coyoteTimer = 0;
  const lateJump = lateCoyotePlayer.lastJumpType;
  lateCoyotePlayer.step(
    CONST.fixedStep,
    makeInput({ jumpPressed: true, jumpHeld: true }),
    integrationLevel,
  );
  lateCoyotePlayer.step(
    CONST.fixedStep,
    makeInput({ jumpReleased: true }),
    integrationLevel,
  );
  assert.equal(lateCoyotePlayer.lastJumpType, lateJump,
    'press first arriving after coyote expiry launched anyway');
  assert.ok(lateCoyotePlayer.jumpBufferT > 0,
    'late release no longer retained the ordinary near-landing buffer');

  // X alone is already valid mounted-board drive. On an ordinary medium road
  // whose slope gravity exceeds chargeBoost, the original skate-entry floor
  // must keep the board mounted without requiring steering chatter.
  const uphillPlayer = new Player(integrationLevel.scene);
  uphillPlayer.enterLevel(integrationEntry.id);
  uphillPlayer.respawn(integrationLevel, true);
  const uphillBaseHit = uphillPlayer.queryGround(integrationLevel);
  assert.ok(uphillBaseHit, 'uphill fixture has no base ground');
  const slopeNormal = new THREE.Vector3(0, Math.sqrt(1 - 0.3 ** 2), 0.3);
  const slopeHit = {
    y: uphillBaseHit.y,
    normal: slopeNormal,
    name: 'ordinary stone road',
    surface: 'stone',
    beachSand: false,
    vert: false,
  };
  uphillPlayer.state = 'ride';
  uphillPlayer.grounded = true;
  uphillPlayer.pos.set(0, uphillBaseHit.y, 0);
  uphillPlayer.prevPos.copy(uphillPlayer.pos);
  uphillPlayer.axisF.set(0, 0, -1);
  uphillPlayer.axisL.set(-1, 0, 0);
  uphillPlayer.speed = TUNING.skateEntrySpeed;
  uphillPlayer.freeSkate = true;
  uphillPlayer.charging = true;
  uphillPlayer.groundHit = slopeHit;
  uphillPlayer.rideNormal.copy(slopeNormal);
  uphillPlayer.queryGround = () => slopeHit;
  let minimumUphillSpeed = uphillPlayer.speed;
  for (let frame = 0; frame < 180; frame++) {
    uphillPlayer.step(
      CONST.fixedStep,
      makeInput({ jumpHeld: true }),
      integrationLevel,
    );
    minimumUphillSpeed = Math.min(minimumUphillSpeed, uphillPlayer.speed);
    assert.equal(uphillPlayer.freeSkate, true,
      `ordinary uphill drive dismounted the board at frame ${frame}, ` +
      `speed ${uphillPlayer.speed}, state ${uphillPlayer.state}, ` +
      `charging ${uphillPlayer.charging}, pos ${uphillPlayer.pos.toArray()}`);
  }
  assert.equal(uphillPlayer.freeSkate, true, 'ordinary uphill drive dismounted the board');
  assert.ok(minimumUphillSpeed >= TUNING.skateEntrySpeed - 1e-9,
    `ordinary uphill drive fell below its ${TUNING.skateEntrySpeed} floor`);

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
