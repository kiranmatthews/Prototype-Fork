import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

const noop = () => {};

function installHeadlessDom() {
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
      return storage.get(String(key)) ?? null;
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
    { get: (target, key) => (key in target ? target[key] : noop) },
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

function fixtureData(component = null) {
  return {
    v: 1,
    name: "Air rescue fixture",
    spawn: [6, 0.02, 6],
    killY: -30,
    components: [
      { t: "platform", p: [0, -0.5, 0], s: [24, 1, 24] },
      ...(component ? [component] : []),
      { t: "gate", p: [0, 0, -10] },
    ],
    groups: [],
  };
}

installHeadlessDom();
const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) =>
  /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(
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
  const { Level } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");
  const dt = CONST.fixedStep;
  const tuningSnapshot = { airControl: TUNING.airControl };
  restoreTuning = () => Object.assign(TUNING, tuningSnapshot);
  TUNING.airControl = 0;

  const create = (component = null) => {
    const scene = new THREE.Scene();
    const data = fixtureData(component);
    const level = new Level(scene, {
      id: `air-rescue-${fixtures.length}`,
      name: data.name,
      data,
    });
    const player = new Player(scene);
    player.respawn(level, true);
    fixtures.push(level);
    return { level, player };
  };

  const prepareAirCarry = (player, { bail = false, eject = false } = {}) => {
    player.pos.set(0, 9, 0);
    player.prevPos.copy(player.pos);
    player.state = "air";
    player.grounded = false;
    player.groundHit = null;
    player.axisF.set(0, 0, -1);
    player.axisL.set(1, 0, 0);
    player.speed = 7;
    player.vVel = -1;
    player.walkVelocity.set(0, 0, 0);
    player.airMomentum = true;
    player.airFromSkate = false;
    player.airGrav = "foot";
    player.bailDownT = bail ? 2 : 0;
    player.bailRecoverDuration = 1.1;
    player.bailRecoverT = -1;
    player.bailGroundT = 0;
    player.ragActive = bail;
    player.ragBlend = bail ? 1 : 0;
    player.ragImpacts = 0;
    player.bailVelocity.copy(player.axisF).multiplyScalar(player.speed);
    player.emergencyEjectUsed = eject;
    player.emergencyEjectLandingPending = eject;
    player.emergencyEjectLandingWillBail = eject;
    player.rawInput = makeInput();
  };

  const steerTrajectory = ({ bail = false, eject = false } = {}) => {
    const f = create();
    prepareAirCarry(f.player, { bail, eject });
    const points = [];
    for (let frame = 0; frame < 12; frame++) {
      const beforeX = f.player.pos.x;
      f.player.step(dt, makeInput({ moveX: 1 }), f.level);
      points.push([f.player.pos.x, f.player.pos.z, f.player.speed]);
      assert.ok(
        f.player.pos.x > beforeX + 1e-8,
        `${bail ? "bail" : "board abandon"} steering was not applied continuously on frame ${frame}`,
      );
    }
    return points;
  };

  // Bail and board-abandon air have dependable, held-input movement of their
  // own. They must not silently inherit the general airControl slider: that
  // value is intentionally zero in the shipped tuning.
  const bailA = steerTrajectory({ bail: true });
  const bailB = steerTrajectory({ bail: true });
  assert.deepEqual(bailA, bailB, "active-bail steering was not deterministic");
  const ejectA = steerTrajectory({ eject: true });
  const ejectB = steerTrajectory({ eject: true });
  assert.deepEqual(ejectA, ejectB, "board-abandon steering was not deterministic");

  // Neutral input retains the exact planar carry. Steering is authority over
  // an existing flight, not hidden drag or an automatic course-axis snap.
  for (const mode of [{ bail: true }, { eject: true }]) {
    const f = create();
    prepareAirCarry(f.player, mode);
    f.player.axisF.set(0.6, 0, -0.8);
    f.player.axisL.set(0.8, 0, 0.6);
    f.player.bailVelocity.copy(f.player.axisF).multiplyScalar(f.player.speed);
    const before = f.player.pos.clone();
    f.player.step(dt, makeInput(), f.level);
    closeTo(f.player.pos.x - before.x, 0.6 * 7 * dt, "neutral carry X");
    closeTo(f.player.pos.z - before.z, -0.8 * 7 * dt, "neutral carry Z");
    closeTo(f.player.speed, 7, "neutral carry speed");
  }

  const prepareTopContact = (
    player,
    box,
    { bail = true, eject = true, x = (box.min.x + box.max.x) * 0.5 } = {},
  ) => {
    const z = (box.min.z + box.max.z) * 0.5;
    const top = box.max.y;
    player.state = "air";
    player.grounded = false;
    player.groundHit = null;
    player.freeSkate = false;
    player.airFromSkate = true;
    player.airGrav = "board";
    player.airMomentum = true;
    player.airJumpUsed = true;
    player.doubleJumpAir = true;
    player.bounceJump = false;
    player.speed = 4;
    player.axisF.set(0, 0, -1);
    player.axisL.set(1, 0, 0);
    player.walkVelocity.set(0, 0, 0);
    player.prevPos.set(x, top + 0.16, z);
    player.pos.set(x, top - 0.06, z);
    player.vVel = -12;
    player.bailDownT = bail ? 1.4 : 0;
    player.bailRecoverDuration = 1.1;
    player.bailRecoverT = -1;
    player.bailRecoveryPose = bail ? 0.35 : 0;
    player.bailGroundT = bail ? 0.07 : 0;
    player.bailVelocity.copy(player.axisF).multiplyScalar(player.speed);
    player.ragActive = bail;
    player.ragBlend = bail ? 1 : 0;
    player.ragBounces = bail ? 2 : 0;
    player.ragImpacts = bail ? 2 : 0;
    player.emergencyEjectUsed = eject;
    player.emergencyEjectLandingPending = eject;
    player.emergencyEjectLandingWillBail = eject;
    player.invulnTimer = bail ? 2 : 0;
    player.rawInput = makeInput();
  };

  const assertRescuedBounce = (player, label) => {
    closeTo(player.vVel, TUNING.crateBounce, `${label} bounce velocity`);
    assert.equal(player.state, "air", `${label} did not restore Air`);
    assert.equal(player.grounded, false, `${label} incorrectly grounded`);
    assert.equal(player.bailDownT, 0, `${label} left bail active`);
    assert.equal(player.ragActive, false, `${label} left ragdoll active`);
    closeTo(player.ragBlend, 0, `${label} left ragdoll pose blended`);
    assert.equal(player.bailRecoverT, -1, `${label} left recovery armed`);
    assert.equal(player.bailRecoveryPose, 0, `${label} left recovery pose active`);
    assert.equal(player.emergencyEjectLandingPending, false, `${label} left eject judgment pending`);
    assert.equal(player.emergencyEjectLandingWillBail, false, `${label} retained a future bail result`);
    assert.equal(player.emergencyEjectUsed, false, `${label} retained eject ownership`);
    assert.equal(player.airFromSkate, false, `${label} retained board-air ownership`);
    assert.equal(player.airGrav, "foot", `${label} retained board gravity`);
    assert.equal(player.airMomentum, false, `${label} did not restore foot-air drive`);
    assert.equal(player.freeSkate, false, `${label} remounted the board`);
    assert.equal(player.airJumpUsed, false, `${label} did not re-arm the double jump`);
    assert.equal(player.doubleJumpAir, false, `${label} retained double-jump pose ownership`);
    assert.equal(player.bounceJump, true, `${label} did not declare a fresh bounce air`);
    assert.equal(player.consumeEmergencyEjectLanding(), null, `${label} could still trigger a later eject bail`);
  };

  // A strict top-down bail landing on ordinary wood is a normal Crash bounce:
  // the crate breaks and the action immediately returns to ordinary foot air.
  {
    const f = create({ t: "crate", p: [0, 0, 0], kind: "wood" });
    const crate = f.level.crates[0];
    prepareTopContact(f.player, crate.box);
    f.player.collide(f.level);
    assert.equal(crate.alive, false, "bail stomp did not destroy plain wood");
    assert.equal(f.player.cratesBroken, 1, "bail stomp did not count exactly one crate");
    assertRescuedBounce(f.player, "plain-wood bail stomp");
  }

  // The same contact is a deterministic save for a pending board abandon,
  // even before the randomized first-landing judgment has begun a bail.
  {
    const f = create({ t: "crate", p: [0, 0, 0], kind: "wood" });
    const crate = f.level.crates[0];
    prepareTopContact(f.player, crate.box, { bail: false, eject: true });
    f.player.collide(f.level);
    assert.equal(crate.alive, false, "board-abandon stomp did not destroy plain wood");
    assertRescuedBounce(f.player, "board-abandon crate stomp");
  }

  // Stompable enemies grant exactly the same rescue. Use the enemy published
  // by Level, but freeze a stable collision box so FSM animation is irrelevant.
  {
    const f = create({
      t: "enemy",
      p: [0, 0, 0],
      foe: "grunt",
      range: 0,
      speed: 0,
    });
    const enemy = f.level.enemies[0];
    assert.ok(enemy, "enemy fixture was not constructed");
    enemy.box.set(new THREE.Vector3(-0.65, 0, -0.55), new THREE.Vector3(0.65, 1.1, 0.55));
    enemy.stompKill = true;
    enemy.touchHurt = true;
    prepareTopContact(f.player, enemy.box);
    f.player.collide(f.level);
    assert.equal(enemy.alive, false, "bail stomp did not defeat a stompable enemy");
    assertRescuedBounce(f.player, "enemy bail stomp");
  }

  // A high side scrape is not a stomp, even while falling through the same
  // vertical band. The crate survives and the existing bail continues.
  {
    const f = create({ t: "crate", p: [0, 0, 0], kind: "wood" });
    const crate = f.level.crates[0];
    prepareTopContact(f.player, crate.box, { x: crate.box.max.x + 0.2 });
    f.player.collide(f.level);
    assert.equal(crate.alive, true, "side contact was misclassified as a rescue stomp");
    assert.ok(f.player.bailDownT > 0, "side contact incorrectly cleared the bail");
  }

  // Typed hazards and indestructible boxes never become rescue platforms.
  for (const kind of ["metal", "metalbounce", "tnt", "nitro"]) {
    const f = create({ t: "crate", p: [0, 0, 0], kind });
    const crate = f.level.crates[0];
    prepareTopContact(f.player, crate.box);
    f.player.collide(f.level);
    assert.ok(f.player.bailDownT > 0, `${kind} contact incorrectly cleared the bail`);
    assert.notEqual(f.player.vVel, TUNING.crateBounce, `${kind} contact granted a rescue bounce`);
  }

  // An enemy's live stompability flag remains authoritative. Spikes, airborne
  // hoppers, active blades, and other non-stomp windows cannot rescue a bail.
  {
    const f = create({
      t: "enemy",
      p: [0, 0, 0],
      foe: "spiker",
      range: 0,
      speed: 0,
    });
    const enemy = f.level.enemies[0];
    assert.ok(enemy, "non-stompable enemy fixture was not constructed");
    enemy.box.set(new THREE.Vector3(-0.65, 0, -0.55), new THREE.Vector3(0.65, 1.1, 0.55));
    enemy.stompKill = false;
    enemy.touchHurt = true;
    prepareTopContact(f.player, enemy.box);
    f.player.collide(f.level);
    assert.equal(enemy.alive, true, "non-stompable enemy was defeated by bail contact");
    assert.ok(f.player.bailDownT > 0, "non-stompable enemy incorrectly cleared the bail");
    assert.notEqual(f.player.vVel, TUNING.crateBounce, "non-stompable enemy granted a rescue bounce");
  }

  console.log("air-rescue checks passed");
} finally {
  restoreTuning?.();
  for (const level of fixtures) level.dispose();
  // Player construction starts async model fallbacks. Let their expected
  // 404s drain while the temporary suppression is still installed so PASS is
  // the only test output, matching the established ragdoll fixture cleanup.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
