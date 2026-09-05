import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

function installHeadlessDom() {
  const noop = () => {};
  const storage = new Map();
  const classList = {
    add: noop,
    remove: noop,
    toggle: noop,
    contains: () => false,
  };
  const makeElement = (tag = "div") => ({
    tagName: String(tag).toUpperCase(),
    style: {},
    classList,
    children: [],
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...children) {
      this.children.push(...children);
    },
    remove: noop,
    click: noop,
  });

  globalThis.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key) {
      return storage.has(String(key)) ? storage.get(String(key)) : null;
    },
    key(index) {
      return [...storage.keys()][index] ?? null;
    },
    removeItem(key) {
      storage.delete(String(key));
    },
    setItem(key, value) {
      storage.set(String(key), String(value));
    },
  };

  const context = new Proxy(
    {
      canvas: null,
      createImageData(width, height) {
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
      createLinearGradient() {
        return { addColorStop: noop };
      },
      createPattern() {
        return {};
      },
      createRadialGradient() {
        return { addColorStop: noop };
      },
      getImageData(_x, _y, width, height) {
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
      measureText(text) {
        return { width: String(text).length * 8 };
      },
    },
    {
      get(target, key) {
        return key in target ? target[key] : noop;
      },
    },
  );
  const makeCanvas = () => ({
    ...makeElement("canvas"),
    width: 1,
    height: 1,
    getContext() {
      context.canvas = this;
      return context;
    },
  });

  globalThis.document = {
    body: makeElement("body"),
    fonts: null,
    createElement(tag) {
      return tag === "canvas" ? makeCanvas() : makeElement(tag);
    },
    createElementNS(_namespace, tag) {
      return this.createElement(tag);
    },
  };
  globalThis.window = {
    location: { search: "?lite", href: "http://headless.invalid/?lite" },
    devicePixelRatio: 1,
    addEventListener: noop,
    removeEventListener: noop,
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  globalThis.Image = class HeadlessImage {
    addEventListener(type, callback) {
      if (type === "error") queueMicrotask(callback);
    }
    removeEventListener() {}
    set src(_value) {
      queueMicrotask(() => this.onerror?.(new Error("headless image")));
    }
  };
  const NativeRequest = globalThis.Request;
  globalThis.Request = class HeadlessRequest extends NativeRequest {
    constructor(input, init) {
      super(
        typeof input === "string" && input.startsWith("/")
          ? `http://headless.invalid${input}`
          : input,
        init,
      );
    }
  };
  globalThis.fetch = async () => new Response("", { status: 404 });
}

const channels = [
  "jumpHeld",
  "grindHeld",
  "spinHeld",
  "grabHeld",
  "jumpPressed",
  "jumpReleased",
  "grindPressed",
  "spinPressed",
  "grabPressed",
  "restartPressed",
  "transferHeld",
  "transferPressed",
];
const edgeChannels = [
  "jumpPressed",
  "jumpReleased",
  "grindPressed",
  "spinPressed",
  "grabPressed",
  "restartPressed",
  "transferPressed",
];

function makeInput(overrides = {}) {
  const input = { moveX: 0, moveY: 0 };
  for (const key of channels) input[key] = false;
  Object.assign(input, overrides);
  input.consumeEdges = () => {
    for (const key of edgeChannels) input[key] = false;
  };
  return input;
}

function closeTo(actual, expected, message, tolerance = 1e-7) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function installRandomSequence(player, values, fallback = 0.5) {
  let draws = 0;
  player.simRand = () => {
    const value = draws < values.length ? values[draws] : fallback;
    draws++;
    return value;
  };
  return () => draws;
}

installHeadlessDom();
const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) =>
  /GLB|skull mask failed|crossbones failed|procedural skateboard trucks|spin model failed/.test(
    String(value ?? ""),
  );
console.warn = (...args) => {
  if (!expectedAssetLog(args[0])) originalWarn(...args);
};
console.error = (...args) => {
  if (!expectedAssetLog(args[0])) originalError(...args);
};

const fixtures = [];
let restoreTuning = null;

try {
  const { sampleBailRecovery, BAIL_RECOVERY_SPRAWL_PITCH } =
    await server.ssrLoadModule("/src/bailRecovery.ts");
  const { Level } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");

  // Pure recovery curve: invalid/early input starts in the authored sprawl,
  // temporary pose channels close cleanly, and one complete forward rotation
  // reaches the identity attitude without ever reversing.
  const start = sampleBailRecovery(0);
  const end = sampleBailRecovery(1);
  const invalid = sampleBailRecovery(Number.NaN);
  closeTo(start.forwardRoll, BAIL_RECOVERY_SPRAWL_PITCH, "recovery start pitch");
  closeTo(invalid.forwardRoll, start.forwardRoll, "invalid progress clamps to start");
  closeTo(end.forwardRoll, Math.PI * 2, "recovery completes one forward roll");
  for (const key of ["tuck", "plant", "stride", "shoulder"]) {
    closeTo(start[key], 0, `${key} starts neutral`);
    closeTo(end[key], 0, `${key} ends neutral`);
  }
  closeTo(start.drive, 0, "automatic drive starts at zero");
  closeTo(end.drive, 1, "automatic drive reaches full run-out");
  let priorRoll = -Infinity;
  let sawForwardMotion = false;
  for (let i = 0; i <= 240; i++) {
    const roll = sampleBailRecovery(i / 240).forwardRoll;
    assert.ok(roll + 1e-12 >= priorRoll, "forward recovery rotation reversed");
    if (roll > priorRoll + 1e-6 && priorRoll !== -Infinity) sawForwardMotion = true;
    priorRoll = roll;
  }
  assert.equal(sawForwardMotion, true, "forward recovery rotation never advanced");

  const tuningSnapshot = {
    bailRollOutSpeed: TUNING.bailRollOutSpeed,
    ragFlailJumpChance: TUNING.ragFlailJumpChance,
    ragFlailJumpVelocity: TUNING.ragFlailJumpVelocity,
    ragFlailSteerChance: TUNING.ragFlailSteerChance,
    ragFlailSteerSpeed: TUNING.ragFlailSteerSpeed,
    ragFlailSteerJitter: TUNING.ragFlailSteerJitter,
  };
  restoreTuning = () => Object.assign(TUNING, tuningSnapshot);

  const levelData = {
    v: 1,
    name: "Ragdoll recovery fixture",
    spawn: [0, 0.05, 0],
    killY: -20,
    components: [
      { t: "platform", p: [0, -0.5, 0], s: [40, 1, 40] },
      { t: "gate", p: [0, 0.5, -12] },
    ],
  };

  const createFixture = () => {
    const scene = new THREE.Scene();
    const level = new Level(scene, {
      id: "ragdoll-recovery-test",
      name: levelData.name,
      data: levelData,
    });
    level.update(0);
    scene.updateMatrixWorld(true);
    const player = new Player(scene);
    if (player.special) {
      player.special.value = 0;
      player.special.step = () => {};
      player.special.award = () => false;
    }
    player.pos.set(0, 0, 0);
    player.prevPos.copy(player.pos);
    player.axisF.set(0, 0, -1);
    player.axisL.set(1, 0, 0);
    player.speed = 0;
    player.vVel = 0;
    player.state = "ride";
    player.grounded = true;
    player.groundHit = player.queryGround(level);
    assert.ok(player.groundHit, "fixture has no ground support");
    player.rideNormal.copy(player.groundHit.normal);
    player.syncVisual(makeInput(), 0);
    scene.updateMatrixWorld(true);
    const fixture = { scene, level, player };
    fixtures.push(fixture);
    return fixture;
  };

  const createFirstImpact = ({ input = makeInput() } = {}) => {
    const fixture = createFixture();
    const { player, level } = fixture;
    assert.equal(player.beginPvpKnockdown(0, 1), true, "failed to arm knockdown");
    player.pos.set(0, 0.04, 0);
    player.prevPos.copy(player.pos);
    player.vVel = -8;
    player.speed = 0;
    player.state = "air";
    player.grounded = false;
    const getDraws = installRandomSequence(player, [0, 0.5, 0.5, 0.5]);
    player.step(CONST.fixedStep, input, level);
    level.update(CONST.fixedStep);
    return { ...fixture, input, getDraws };
  };

  // Held direction owns the airborne rescue trajectory even before the first
  // impact. It is deterministic and consumes no flaky-input RNG; the physical
  // contact still arms exactly one extra post-impact fish-jump/steer pulse.
  const impactInput = makeInput({ jumpPressed: true, moveX: 1 });
  const armed = createFirstImpact({ input: impactInput });
  assert.equal(armed.player.ragdollImpactCount, 1, "first contact did not arm input");
  assert.equal(armed.player.ragdollFishJumps, 0, "pre-impact X produced a fish jump");
  assert.equal(armed.getDraws(), 0, "pre-impact input consumed gameplay RNG");
  assert.ok(armed.player.axisF.x > 0.99, "pre-impact rescue steering missed screen-right");
  closeTo(armed.player.axisF.z, 0, "pre-impact rescue steering kept stale forward heading");
  impactInput.consumeEdges();
  const heldThroughImpact = makeInput({ moveX: 1 });
  armed.player.rawInput = heldThroughImpact;
  const headingBeforeHeldPulse = armed.player.axisF.clone();
  const heldSteerDraws = installRandomSequence(armed.player, [0, 0.5, 0.5, 0.5]);
  armed.player.stepRagdollFlailInput(heldThroughImpact, armed.level);
  assert.equal(heldSteerDraws(), 0, "held-through-impact stick spent a steer roll");
  closeTo(
    armed.player.axisF.distanceTo(headingBeforeHeldPulse),
    0,
    "held-through-impact stick spent the extra flaky pulse",
  );
  armed.player.rawInput = makeInput();
  armed.player.stepRagdollFlailInput(armed.player.rawInput, armed.level);

  // A bail created by the contact itself skips the already-bailing pre-impact
  // input pass. Impact recording must still latch the held stick so the next
  // frame cannot masquerade it as a fresh steering pulse.
  const contactCreated = createFixture();
  const contactHeld = makeInput({ moveX: 1 });
  contactCreated.player.rawInput = contactHeld;
  assert.equal(contactCreated.player.beginPvpKnockdown(0, 1), true);
  contactCreated.player.noteRagdollGroundImpact();
  const contactSteerDraws = installRandomSequence(
    contactCreated.player,
    [0, 0.5, 0.5, 0.5],
  );
  contactCreated.player.stepRagdollFlailInput(contactHeld, contactCreated.level);
  assert.equal(contactSteerDraws(), 0, "contact-created bail accepted held steering");

  // Forced success: the next fresh X edge after impact gains upward velocity.
  TUNING.ragFlailJumpChance = 1;
  const successBeforeVy = armed.player.vVel;
  const successInput = makeInput({ jumpPressed: true });
  const successDraws = installRandomSequence(armed.player, [0.2, 0.5]);
  armed.player.step(CONST.fixedStep, successInput, armed.level);
  armed.level.update(CONST.fixedStep);
  assert.equal(armed.player.ragdollFishJumps, 1, "forced fish jump did not succeed");
  assert.ok(armed.player.vVel > successBeforeVy, "fish jump did not add upward speed");
  assert.ok(armed.player.vVel <= 10, "fish jump exceeded its vertical cap");
  assert.equal(successDraws(), 2, "successful fish jump used the wrong RNG budget");

  // Forced failure consumes the impact's one attempt. Raising the chance and
  // pressing again before another impact cannot reroll it.
  const failed = createFirstImpact();
  failed.input.consumeEdges();
  TUNING.ragFlailJumpChance = 0;
  const failureInput = makeInput({ jumpPressed: true });
  failed.player.rawInput = failureInput;
  const failureDraws = installRandomSequence(failed.player, [0]);
  const failureVy = failed.player.vVel;
  failed.player.stepRagdollFlailInput(failureInput, failed.level);
  assert.equal(failed.player.ragdollFishJumps, 0, "zero-chance fish jump succeeded");
  closeTo(failed.player.vVel, failureVy, "failed fish jump changed vertical speed");
  assert.equal(failureDraws(), 0, "zero chance consumed shared gameplay RNG");
  TUNING.ragFlailJumpChance = 1;
  const noRerollDraws = installRandomSequence(failed.player, [0, 0.5]);
  failed.player.stepRagdollFlailInput(failureInput, failed.level);
  assert.equal(failed.player.ragdollFishJumps, 0, "same impact rerolled a failed jump");
  assert.equal(noRerollDraws(), 0, "same impact consumed RNG twice");

  // A successful direction pulse responds in the requested screen-right
  // direction, keeps an orthonormal travel frame, and cannot increase a speed
  // that already exceeds downhillMax. That impact cannot steer twice.
  const steered = createFirstImpact();
  TUNING.ragFlailSteerChance = 1;
  TUNING.ragFlailSteerJitter = 0;
  steered.player.axisF.set(0, 0, -1);
  steered.player.axisL.set(1, 0, 0);
  steered.player.speed = TUNING.downhillMax + 5;
  const steerInput = makeInput({ moveX: 1 });
  steered.player.rawInput = steerInput;
  const steerDraws = installRandomSequence(steered.player, [0, 0.5, 0.9, 0.9]);
  const speedCap = steered.player.speed;
  steered.player.stepRagdollFlailInput(steerInput, steered.level);
  assert.equal(steerDraws(), 4, "successful steering used the wrong RNG budget");
  assert.ok(steered.player.axisF.x > 0.1, "steer pulse did not turn screen-right");
  assert.ok(steered.player.axisF.z < -0.1, "steer pulse discarded all forward carry");
  assert.ok(steered.player.speed <= speedCap + 1e-9, "steer pulse exceeded its speed cap");
  closeTo(steered.player.axisF.length(), 1, "steered forward axis is not unit length");
  closeTo(steered.player.axisL.length(), 1, "steered lateral axis is not unit length");
  closeTo(steered.player.axisF.dot(steered.player.axisL), 0, "steered axes are not perpendicular");
  const headingAfterFirstSteer = steered.player.axisF.clone();
  const speedAfterFirstSteer = steered.player.speed;
  const secondSteerInput = makeInput({ moveX: -1 });
  steered.player.rawInput = secondSteerInput;
  const secondSteerDraws = installRandomSequence(steered.player, [0, 0.5, 0.9, 0.9]);
  steered.player.stepRagdollFlailInput(secondSteerInput, steered.level);
  assert.equal(secondSteerDraws(), 0, "same impact rerolled steering");
  closeTo(steered.player.axisF.distanceTo(headingAfterFirstSteer), 0, "same impact steered twice");
  closeTo(steered.player.speed, speedAfterFirstSteer, "same impact changed speed twice");

  // Two successful fish jumps exhaust the lifetime budget. A third actual
  // contact may arm other flail behavior, but must not draw or launch again.
  const capped = createFirstImpact();
  TUNING.ragFlailJumpChance = 1;
  const jumpOnce = makeInput({ jumpPressed: true });
  capped.player.rawInput = jumpOnce;
  installRandomSequence(capped.player, [0, 0.5]);
  capped.player.stepRagdollFlailInput(jumpOnce, capped.level);
  assert.equal(capped.player.ragdollFishJumps, 1);
  capped.player.noteRagdollGroundImpact();
  const jumpTwice = makeInput({ jumpPressed: true });
  capped.player.rawInput = jumpTwice;
  installRandomSequence(capped.player, [0, 0.5]);
  capped.player.stepRagdollFlailInput(jumpTwice, capped.level);
  assert.equal(capped.player.ragdollFishJumps, 2);
  capped.player.noteRagdollGroundImpact();
  const jumpThrice = makeInput({ jumpPressed: true });
  capped.player.rawInput = jumpThrice;
  const thirdJumpDraws = installRandomSequence(capped.player, [0, 0.5]);
  const cappedVy = capped.player.vVel;
  capped.player.stepRagdollFlailInput(jumpThrice, capped.level);
  assert.equal(capped.player.ragdollFishJumps, 2, "fish-jump cap was bypassed");
  assert.equal(thirdJumpDraws(), 0, "exhausted fish jump consumed RNG");
  closeTo(capped.player.vVel, cappedVy, "exhausted fish jump changed velocity");

  // Once procedural recovery owns the body, neither X nor direction may steal
  // it back, even if ragActive is deliberately left true for this guard test.
  const recovering = createFirstImpact();
  recovering.player.bailRecoverT = 0.2;
  recovering.player.bailRecoveryPose = 0.25;
  recovering.player.ragActive = true;
  const recoverInput = makeInput({ jumpPressed: true, moveX: 1 });
  recovering.player.rawInput = recoverInput;
  const recoveryDraws = installRandomSequence(recovering.player, [0, 0.5, 0.5, 0.5]);
  const recoverHeading = recovering.player.axisF.clone();
  const recoverVy = recovering.player.vVel;
  recovering.player.stepRagdollFlailInput(recoverInput, recovering.level);
  assert.equal(recoveryDraws(), 0, "procedural recovery rolled flail RNG");
  assert.equal(recovering.player.ragdollFishJumps, 0, "recovery accepted a fish jump");
  closeTo(recovering.player.axisF.distanceTo(recoverHeading), 0, "recovery accepted steering");
  closeTo(recovering.player.vVel, recoverVy, "recovery changed vertical speed");

  // If support disappears halfway through the roll, the renewed ragdoll owns
  // the exact visible rider orientation AND waist point. Capturing only the
  // quaternion leaves the metre-scale recovery root correction behind.
  const interrupted = createFixture();
  assert.equal(interrupted.player.beginPvpKnockdown(0, 1), true);
  interrupted.player.state = "ride";
  interrupted.player.grounded = true;
  interrupted.player.groundHit = interrupted.player.queryGround(interrupted.level);
  interrupted.player.rideNormal.copy(interrupted.player.groundHit.normal);
  interrupted.player.bailDownT = 0.5;
  interrupted.player.bailRecoverDuration = 0.72;
  interrupted.player.bailRecoverT = 0.36;
  interrupted.player.bailRecoveryPose = 0.5;
  interrupted.player.ragActive = false;
  interrupted.player.ragBlend = 0;
  interrupted.player.syncVisual(makeInput(), CONST.fixedStep);
  interrupted.scene.updateMatrixWorld(true);
  const waistBeforeLoss = new THREE.Vector3(0, 0.82, 0).applyMatrix4(
    interrupted.player.riderG.matrixWorld,
  );
  interrupted.player.state = "air";
  interrupted.player.grounded = false;
  interrupted.player.groundHit = null;
  interrupted.player.vVel = 1;
  interrupted.player.step(CONST.fixedStep, makeInput(), interrupted.level);
  interrupted.scene.updateMatrixWorld(true);
  const waistAfterLoss = new THREE.Vector3(0, 0.82, 0).applyMatrix4(
    interrupted.player.riderG.matrixWorld,
  );
  const supportLossDelta = waistAfterLoss.distanceTo(waistBeforeLoss);
  assert.ok(
    supportLossDelta < 0.25,
    `support loss dropped the recovery root trajectory (${supportLossDelta}; before=${waistBeforeLoss.toArray()}; after=${waistAfterLoss.toArray()}; anchor=${interrupted.player.ragPoseAnchor.toArray()}; anchorW=${interrupted.player.ragPoseAnchorW}; body=${interrupted.player.bodyGroup.position.toArray()})`,
  );

  // Full fixed-step integration: a supported knockdown with completely neutral
  // input starts recovery, rolls forward, and hands genuine forward velocity
  // and displacement into the ordinary running state.
  const runOut = createFixture();
  // The roll must close its waist-pivot offset before the later Idle/Walk
  // sole correction seats the upright rider. A seated walk no longer has a
  // zero rider-root translation, so do not conflate those two pose layers.
  const recoveryRootBeforeSeating = new THREE.Vector3();
  const seatOnFoot = runOut.player.seatOnFoot.bind(runOut.player);
  runOut.player.seatOnFoot = () => {
    recoveryRootBeforeSeating.copy(runOut.player.riderG.position);
    seatOnFoot();
  };
  const neutral = makeInput();
  assert.equal(runOut.player.beginPvpKnockdown(0, 1), true);
  runOut.player.state = "ride";
  runOut.player.grounded = true;
  runOut.player.vVel = 0;
  runOut.player.pos.set(0, 0, 0);
  runOut.player.prevPos.copy(runOut.player.pos);
  runOut.player.axisF.set(0, 0, -1);
  runOut.player.axisL.set(1, 0, 0);
  runOut.player.speed = 0;
  runOut.player.groundHit = runOut.player.queryGround(runOut.level);
  assert.ok(runOut.player.groundHit);
  runOut.player.rideNormal.copy(runOut.player.groundHit.normal);
  const startZ = runOut.player.pos.z;
  let observedRecovery = false;
  let peakRecoverySpeed = 0;
  let recoveryEntryOffset = null;
  let peakRiderOffset = 0;
  for (let step = 0; step < 120 && runOut.player.bailTimeLeft > 0; step++) {
    assert.equal(neutral.moveX, 0);
    assert.equal(neutral.moveY, 0);
    assert.equal(neutral.jumpPressed, false);
    runOut.player.step(CONST.fixedStep, neutral, runOut.level);
    runOut.level.update(CONST.fixedStep);
    neutral.consumeEdges();
    if (!observedRecovery && runOut.player.bailRecoveryK > 0) {
      observedRecovery = true;
      recoveryEntryOffset = runOut.player.riderG.position.length();
    }
    peakRiderOffset = Math.max(peakRiderOffset, runOut.player.riderG.position.length());
    peakRecoverySpeed = Math.max(peakRecoverySpeed, Math.abs(runOut.player.speed));
  }
  assert.equal(runOut.player.bailTimeLeft, 0, "neutral recovery did not finish");
  assert.equal(observedRecovery, true, "neutral recovery never entered the roll phase");
  assert.ok(recoveryEntryOffset < 0.3, "recovery root teleported at roll entry");
  assert.ok(peakRiderOffset > 0.2, "recovery never moved around its waist pivot");
  assert.ok(recoveryRootBeforeSeating.length() < 0.12, "recovery root did not close at 2pi");
  assert.ok(peakRecoverySpeed > 0.5, "neutral recovery never generated run-out speed");
  assert.ok(runOut.player.pos.z < startZ - 0.1, "neutral recovery stayed anchored at its feet");
  assert.ok(runOut.player.walkVelocity.z < -0.1, "recovery did not hand forward carry to walking");
  assert.ok(runOut.player.speed > 0.1, "recovery ended without forward run speed");

  // A wall-style rebound may be represented as negative speed on its old
  // approach axis. Recovery must canonicalize that exact velocity before its
  // automatic drive, or the roll turns around and runs back into the wall.
  const rebound = createFixture();
  assert.equal(rebound.player.beginPvpKnockdown(0, 1), true);
  rebound.player.state = "ride";
  rebound.player.grounded = true;
  rebound.player.groundHit = rebound.player.queryGround(rebound.level);
  rebound.player.rideNormal.copy(rebound.player.groundHit.normal);
  rebound.player.axisF.set(0, 0, -1);
  rebound.player.axisL.set(1, 0, 0);
  rebound.player.speed = -4;
  rebound.player.bailDownT = 0.7;
  rebound.player.bailGroundT = 0.12;
  rebound.player.step(CONST.fixedStep, makeInput(), rebound.level);
  assert.ok(rebound.player.bailRecoveryK > 0, "rebound did not start recovery");
  assert.ok(rebound.player.speed >= 0, "rebound recovery kept negative speed");
  assert.ok(rebound.player.axisF.z > 0.9, "rebound recovery reversed toward the obstacle");

  console.log(
    "Validated forward-roll sampling, post-impact flaky jump/steer limits, recovery exclusion, and neutral run-out integration.",
  );
} finally {
  restoreTuning?.();
  for (const { level } of fixtures) level.dispose();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
