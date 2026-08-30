import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

function installHeadlessDom() {
  const storage = new Map();
  const noop = () => {};
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
        return { width, height, data: new Uint8ClampedArray(width * height * 4) };
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
        return { width, height, data: new Uint8ClampedArray(width * height * 4) };
      },
      measureText(text) {
        return { width: String(text).length * 8 };
      },
    },
    { get(target, key) { return key in target ? target[key] : noop; } },
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
    addEventListener: noop,
    removeEventListener: noop,
    devicePixelRatio: 1,
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

const heldChannels = [
  "jumpHeld",
  "grindHeld",
  "spinHeld",
  "grabHeld",
  "transferHeld",
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
  for (const key of [...heldChannels, ...edgeChannels]) input[key] = false;
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

function vectorClose(actual, expected, message, tolerance = 1e-7) {
  closeTo(actual.x, expected.x, `${message}.x`, tolerance);
  closeTo(actual.y, expected.y, `${message}.y`, tolerance);
  closeTo(actual.z, expected.z, `${message}.z`, tolerance);
}

function quaternionClose(actual, expected, message, tolerance = 1e-7) {
  const alignment = Math.abs(actual.dot(expected));
  closeTo(alignment, 1, message, tolerance);
}

installHeadlessDom();
const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) => {
  const message = String(value ?? "");
  return (
    message.includes("GLB") ||
    message.includes("skull mask failed") ||
    message.includes("crossbones failed") ||
    message.includes("procedural skateboard trucks") ||
    message.includes("spin model failed")
  );
};
console.warn = (...args) => {
  if (!expectedAssetLog(args[0])) originalWarn(...args);
};
console.error = (...args) => {
  if (!expectedAssetLog(args[0])) originalError(...args);
};

try {
  const { Level, setEditorBuild } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");

  const ropeLevelData = (travel = null) => ({
    v: 1,
    name: "Rope board transfer fixture",
    spawn: [0, 2, 0],
    killY: -80,
    components: [
      { t: "platform", p: [0, -20, 0], s: [30, 1, 30] },
      {
        t: "ropeswing",
        p: [0, 6, 0],
        len: 6,
        amp: 0,
        speed: 1,
        phase: 0,
        ...(travel ?? {}),
      },
      { t: "gate", p: [0, -19.5, -10] },
    ],
  });

  const createFixture = (travel = null) => {
    const scene = new THREE.Scene();
    const data = ropeLevelData(travel);
    const level = new Level(scene, { id: "rope-test", name: data.name, data });
    level.update(0); // seed analytic rope angle + travelling-anchor velocity
    const player = new Player(scene);
    const input = makeInput();
    player.pos.set(0, 2, 0);
    player.prevPos.copy(player.pos);
    player.state = "air";
    player.grounded = false;
    player.axisF.set(0, 0, -1);
    player.axisL.set(1, 0, 0);
    player.lastVelX = 0;
    player.lastVelZ = -12;
    player.speed = 12;
    player.vVel = -2;
    player.syncVisual(input, 0);
    scene.updateMatrixWorld(true);
    return { scene, data, level, player, input };
  };

  const mounted = createFixture();
  const rider = mounted.player;
  rider.freeSkate = true;
  rider.airFromSkate = true;
  rider.airGrav = "board";
  rider.airMomentum = true;
  rider.skateOn = true;
  rider.skateCharge = 0.4;
  rider.brakeT = 0.3;
  rider.brakeLockT = 0.2;
  rider.brakeRampT = 0.1;
  rider.oBrakeHold = true;
  rider.greaseT = 1;
  rider.grindBoostT = 2;
  rider.speedPadCap = 48;
  rider.activeSpeedPadId = 7;
  rider.manualing = 1;
  rider.manualArmed = 1;
  rider.manualArmT = 0.2;
  rider.floatAir = true;
  rider.grindExitAir = true;
  rider.boardOllieAir = true;
  rider.emergencyEjectCharging = true;
  rider.emergencyEjectChargeT = 0.2;
  rider.emergencyEjectUsed = true;
  rider.emergencyEjectLandingPending = true;
  rider.emergencyEjectLandingWillBail = true;
  rider.vertAir = true;
  rider.vertTracked = true;
  rider.vertLossT = 0.2;
  rider.vertGravT = 0.3;
  rider.vertLatVel = 4;
  rider.vertInDrift = 2;
  rider.pipeHang = true;
  rider.pipeEndFly = true;
  rider.rollOffT = 0.3;
  rider.charging = true;
  rider.chargePlanted = true;
  rider.chargeTimer = 0.2;
  rider.jumpBufferT = 0.1;
  rider.airTapT = 0.1;
  rider.slideJumpAir = true;
  rider.slideAirLat = 3;
  rider.spinTimer = 0.25;
  rider.spinAngle = 1.2;
  rider.flipT = 0.2;
  rider.points = 321;
  rider.comboPoints = 144;
  rider.comboMult = 3;
  rider.special.value = 67;
  const simSeedBefore = rider.simSeed;
  const boardPosition = rider.boardG.getWorldPosition(new THREE.Vector3());
  const boardAttitude = rider.boardG.getWorldQuaternion(new THREE.Quaternion());

  assert.equal(rider.tryRopeGrab(mounted.level), true, "board air did not catch rope");
  assert.equal(rider.state, "rope");
  assert.equal(rider.freeSkate, false, "rope catch left skate authority active");
  assert.equal(rider.airFromSkate, false);
  assert.equal(rider.airGrav, "foot");
  assert.equal(rider.airMomentum, false);
  assert.equal(rider.speed, 0);
  assert.equal(rider.vVel, 0);
  assert.equal(rider.bailDownT, 0, "rope board detach became a bail");
  assert.equal(rider.points, 321);
  assert.equal(rider.comboPoints, 144);
  assert.equal(rider.comboMult, 3);
  assert.equal(rider.special.value, 67);
  assert.equal(rider.simSeed, simSeedBefore, "traversal detach consumed gameplay RNG");

  assert.ok(rider.flyBoard?.visible, "detached board is not visible");
  vectorClose(rider.flyBoard.position, boardPosition, "loose board start position");
  quaternionClose(rider.flyBoard.quaternion, boardAttitude, "loose board start attitude");
  vectorClose(rider.flyBoardVel, new THREE.Vector3(0, -2, -12), "loose board velocity");
  vectorClose(rider.flyBoardAng, new THREE.Vector3(2.8, 9, -1.8), "loose board angular rate");
  closeTo(rider.flyBoardT, 30, "loose board lifetime");

  for (const [name, value] of [
    ["skateOn", rider.skateOn],
    ["floatAir", rider.floatAir],
    ["grindExitAir", rider.grindExitAir],
    ["boardOllieAir", rider.boardOllieAir],
    ["emergencyEjectCharging", rider.emergencyEjectCharging],
    ["emergencyEjectUsed", rider.emergencyEjectUsed],
    ["emergencyEjectLandingPending", rider.emergencyEjectLandingPending],
    ["vertAir", rider.vertAir],
    ["vertTracked", rider.vertTracked],
    ["pipeHang", rider.pipeHang],
    ["pipeEndFly", rider.pipeEndFly],
    ["charging", rider.charging],
    ["chargePlanted", rider.chargePlanted],
    ["slideJumpAir", rider.slideJumpAir],
  ]) assert.equal(value, false, `${name} survived rope attachment`);
  for (const [name, value] of [
    ["manualing", rider.manualing],
    ["manualArmed", rider.manualArmed],
    ["skateCharge", rider.skateCharge],
    ["brakeT", rider.brakeT],
    ["brakeLockT", rider.brakeLockT],
    ["brakeRampT", rider.brakeRampT],
    ["greaseT", rider.greaseT],
    ["grindBoostT", rider.grindBoostT],
    ["speedPadCap", rider.speedPadCap],
    ["vertLossT", rider.vertLossT],
    ["vertGravT", rider.vertGravT],
    ["vertLatVel", rider.vertLatVel],
    ["vertInDrift", rider.vertInDrift],
    ["rollOffT", rider.rollOffT],
    ["chargeTimer", rider.chargeTimer],
    ["jumpBufferT", rider.jumpBufferT],
    ["airTapT", rider.airTapT],
    ["slideAirLat", rider.slideAirLat],
    ["spinTimer", rider.spinTimer],
    ["spinAngle", rider.spinAngle],
    ["flipT", rider.flipT],
  ]) closeTo(value, 0, `${name} survived rope attachment`);

  const beforeFlyPosition = rider.flyBoard.position.clone();
  const beforeFlyVelocity = rider.flyBoardVel.clone();
  rider.updateFlyBoard(CONST.fixedStep, mounted.level);
  const expectedVelocity = beforeFlyVelocity.clone();
  expectedVelocity.y -= 24 * CONST.fixedStep;
  const expectedPosition = beforeFlyPosition
    .clone()
    .addScaledVector(expectedVelocity, CONST.fixedStep);
  assert.equal(rider.flyBoard.visible, true, "rope catch immediately recalled the loose board");
  vectorClose(rider.flyBoardVel, expectedVelocity, "same-tick loose board velocity");
  vectorClose(rider.flyBoard.position, expectedPosition, "same-tick loose board position");
  closeTo(rider.flyBoardT, 30 - CONST.fixedStep, "same-tick loose board lifetime");

  // Catching on foot must neither manufacture nor relaunch a board that is
  // already loose. It must also preserve a prior emergency-eject judgment.
  const loosePosition = rider.flyBoard.position.clone();
  const looseVelocity = rider.flyBoardVel.clone();
  const looseTime = rider.flyBoardT;
  rider.state = "air";
  rider.ropeObj = null;
  rider.ropeCoolT = 0;
  rider.pos.set(0, 2, 0);
  rider.prevPos.copy(rider.pos);
  rider.freeSkate = false;
  rider.airFromSkate = false;
  rider.emergencyEjectLandingPending = true;
  rider.emergencyEjectLandingWillBail = true;
  assert.equal(rider.tryRopeGrab(mounted.level), true, "foot air did not catch rope");
  vectorClose(rider.flyBoard.position, loosePosition, "foot catch moved loose board");
  vectorClose(rider.flyBoardVel, looseVelocity, "foot catch relaunched loose board");
  closeTo(rider.flyBoardT, looseTime, "foot catch reset loose board lifetime");
  assert.equal(rider.emergencyEjectLandingPending, true);
  assert.equal(rider.emergencyEjectLandingWillBail, true);

  // Rope release is a fresh foot-air arc. It never resurrects mounted-board
  // speed/gravity, and its double-jump window starts at this release.
  rider.emergencyEjectLandingPending = false;
  rider.emergencyEjectLandingWillBail = false;
  rider.chargeTimer = TUNING.jumpChargeTime;
  rider.airborneT = 99;
  rider.airPeakY = 50;
  rider.launchVy = 1;
  rider.coyoteTimer = 0.2;
  rider.ropeLeap(mounted.level, mounted.level.ropeSwings[0]);
  assert.equal(rider.state, "air");
  assert.equal(rider.freeSkate, false);
  assert.equal(rider.airFromSkate, false);
  assert.equal(rider.airGrav, "foot");
  assert.equal(rider.airMomentum, false);
  assert.equal(rider.speed, 0);
  assert.equal(rider.walkVelocity.lengthSq(), 0);
  closeTo(rider.vVel, TUNING.jumpVelocity, "full-charge rope release velocity");
  closeTo(rider.airborneT, 0, "rope release airborne clock");
  closeTo(rider.launchVy, rider.vVel, "rope release launch velocity record");
  closeTo(rider.airPeakY, rider.pos.y, "rope release peak reset");
  closeTo(rider.coyoteTimer, 0, "rope release stale coyote time");
  assert.equal(rider.flyBoard.visible, true, "rope release recalled the loose board");

  // Emergency eject owns its Jump release before rope/rail capture. The same
  // edge cannot perform two board-detach transactions.
  const eject = createFixture();
  eject.player.freeSkate = true;
  eject.player.airFromSkate = true;
  eject.player.airGrav = "board";
  eject.player.airMomentum = true;
  eject.player.boardOllieAir = true;
  eject.player.emergencyEjectCharging = true;
  eject.player.emergencyEjectChargeT = 0.2;
  eject.player.step(
    CONST.fixedStep,
    makeInput({ jumpReleased: true }),
    eject.level,
  );
  assert.equal(eject.player.state, "air", "emergency eject also caught the rope");
  assert.equal(eject.player.ropeObj, null);
  assert.equal(eject.player.freeSkate, false);
  assert.ok(eject.player.flyBoard?.visible);
  assert.equal(eject.player.emergencyEjectUsed, true);
  assert.equal(eject.player.emergencyEjectLandingPending, true);

  // Entry clears a stale board-air spin, but a fresh Square edge on the catch
  // tick is still routed through the rope attack after attachment.
  const freshSpin = createFixture();
  freshSpin.player.spinTimer = 0.2;
  freshSpin.player.spinAngle = 1;
  freshSpin.player.step(
    CONST.fixedStep,
    makeInput({ spinPressed: true, spinHeld: true }),
    freshSpin.level,
  );
  assert.equal(freshSpin.player.state, "rope");
  assert.ok(freshSpin.player.spinTimer > 0, "fresh rope spin did not start");

  // A travelling rope's point velocity includes the anchor cycle. At phase 0,
  // range 4 and angular speed .5 produce exactly +2 units/s along +X.
  const travelling = createFixture({ axis: "x", range: 4, cycle: 0.5 });
  const travellingRope = travelling.level.ropeSwings[0];
  const pointVelocity = travelling.level.ropeVelAt(
    travellingRope,
    3,
    new THREE.Vector3(),
  );
  vectorClose(pointVelocity, new THREE.Vector3(2, 0, 0), "travelling rope point velocity");
  travelling.level.update(Math.PI / 0.5);
  travelling.level.update(0); // evaluate the newly advanced fixed clock
  const reversedVelocity = travelling.level.ropeVelAt(
    travellingRope,
    3,
    new THREE.Vector3(),
  );
  vectorClose(reversedVelocity, new THREE.Vector3(-2, 0, 0), "reversed anchor velocity", 1e-6);

  const vertical = createFixture({ axis: "y", range: 4, cycle: 0.5 });
  assert.equal(vertical.player.tryRopeGrab(vertical.level), true);
  vertical.player.chargeTimer = 0;
  vertical.player.ropeLeap(vertical.level, vertical.level.ropeSwings[0]);
  closeTo(
    vertical.player.vVel,
    TUNING.jumpMinVelocity + 2 * 0.9,
    "vertical travelling-rope release",
  );

  // Runtime anchor/velocity state never leaks into the editor's authored JSON,
  // even after the travelling rope has moved.
  const captured = travelling.level.captureData();
  assert.deepEqual(
    captured.components.find((component) => component.t === "ropeswing"),
    travelling.data.components.find((component) => component.t === "ropeswing"),
  );
  assert.equal(JSON.stringify(captured).includes("anchorVel"), false);
  setEditorBuild(true);
  const editorScene = new THREE.Scene();
  const editorLevel = new Level(editorScene, {
    id: "rope-editor-copy",
    name: captured.name,
    data: captured,
  });
  const editorCaptured = editorLevel.captureData();
  setEditorBuild(false);
  assert.deepEqual(
    editorCaptured.components.find((component) => component.t === "ropeswing"),
    captured.components.find((component) => component.t === "ropeswing"),
  );
  assert.equal(JSON.stringify(editorCaptured).includes("anchorVel"), false);

  mounted.level.dispose();
  eject.level.dispose();
  freshSpin.level.dispose();
  travelling.level.dispose();
  vertical.level.dispose();
  editorLevel.dispose();
  console.log(
    "Validated Unity rope catch parity: skate closure, exact loose-board flight, foot release, travelling-anchor velocity, and editor round trip.",
  );
} finally {
  // Player construction starts optional presentation loads. Let their mocked
  // 404 callbacks drain while the expected-log filter is still installed;
  // closing Vite first would report a harmless cancelled transform after an
  // otherwise green gameplay test.
  await new Promise((resolve) => setTimeout(resolve, 50));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
