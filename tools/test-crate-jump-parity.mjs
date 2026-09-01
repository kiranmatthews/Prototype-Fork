import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

function closeTo(actual, expected, message, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function towerData() {
  return {
    v: 1,
    name: "Crate jump parity fixture",
    spawn: [5, 0.02, 5],
    killY: -20,
    components: [
      { t: "platform", p: [0, -0.5, 0], s: [20, 1, 20] },
      { t: "crate", p: [0, 0, 0], kind: "metalbounce" },
      { t: "crate", p: [0, 0.96, 0], kind: "wood" },
      { t: "crate", p: [0, 1.92, 0], kind: "metal" },
      { t: "gate", p: [0, 0, -8] },
    ],
    groups: [],
  };
}

function prepareTopContact(player, crate, { skate = false, fallSpeed = 12 } = {}) {
  const x = crate.mesh.position.x;
  const z = crate.mesh.position.z;
  const top = crate.box.max.y;
  player.state = "air";
  player.grounded = false;
  player.freeSkate = skate;
  player.airFromSkate = skate;
  player.airGrav = skate ? "board" : "foot";
  player.airMomentum = skate;
  player.airRose = true;
  player.airPeakY = top + 2;
  player.prevPos.set(x, top + 0.2, z);
  player.pos.set(x, top - 0.05, z);
  player.vVel = -fallSpeed;
  player.speed = 0;
  player.rawInput = makeInput();
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
try {
  const { Level, findLevel } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { Replayer } = await server.ssrLoadModule("/src/replay.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");
  const dt = CONST.fixedStep;

  const createTower = () => {
    const scene = new THREE.Scene();
    const data = towerData();
    const level = new Level(scene, {
      id: "crate-jump-parity",
      name: data.name,
      data,
    });
    const player = new Player(scene);
    player.respawn(level, true);
    fixtures.push(level);
    const arrow = level.crates.find((crate) => crate.metalBounce);
    const wood = level.crates.find((crate) => !crate.metalBounce && !crate.metal);
    const lid = level.crates.find((crate) => crate.metal);
    assert.ok(arrow && wood && lid, "fixture tower did not build all three crate kinds");
    return { level, player, arrow, wood, lid };
  };

  // A blank Metal top is a landing, never an Arrow-style automatic launch.
  // Web deliberately keeps the contact in Air for one tick so all of its
  // trick/board cleanup runs in the normal landing path. The support latch
  // must therefore consume airRose or it rejects itself on that handoff.
  {
    const f = createTower();
    prepareTopContact(f.player, f.lid, { skate: true });
    f.player.boardOllieAir = true;
    f.player.emergencyEjectCharging = true;
    f.player.emergencyEjectChargeT = 0.2;
    f.player.deckTricksThisAir.add("Kickflip");
    f.player.floatAir = true;
    f.player.grindExitAir = true;
    const contactX = f.player.pos.x;
    const contactZ = f.player.pos.z;
    f.player.collide(f.level);
    assert.equal(f.player.state, "air", "Metal contact skipped the web landing path");
    assert.equal(f.player.grounded, false, "Metal contact grounded before landing cleanup");
    assert.equal(f.player.airRose, false, "Metal contact did not hand its latch to ground query");
    assert.equal(f.player.vVel, 0, "blank Metal landing popped vertically");
    assert.equal(f.player.crateFloor, f.lid, "Metal contact did not retain lid identity");
    assert.ok(f.player.crateFloorT > 0, "Metal contact did not seed stable support");
    closeTo(f.player.pos.y, f.lid.box.max.y + 0.02, "Metal contact did not seat feet");
    closeTo(f.player.pos.x, contactX, "Metal contact side-ejected X");
    closeTo(f.player.pos.z, contactZ, "Metal contact side-ejected Z");

    f.level.update(dt);
    f.player.step(dt, makeInput(), f.level);
    assert.equal(f.player.state, "ride", "Metal contact did not complete ordinary landing");
    assert.equal(f.player.grounded, true, "Metal landing did not become grounded");
    assert.equal(f.player.crateFloor, f.lid, "ordinary landing lost Metal lid identity");
    assert.equal(f.player.boardOllieAir, false, "Metal landing left board-ollie air stale");
    assert.equal(
      f.player.emergencyEjectCharging,
      false,
      "Metal landing left emergency-eject charge stale",
    );
    assert.equal(f.player.deckTricksThisAir.size, 0, "Metal landing left deck tricks stale");
    assert.equal(f.player.airMomentum, false, "Metal landing left air momentum stale");
    assert.equal(f.player.airGrav, "foot", "Metal landing left air gravity stale");
    assert.equal(f.player.floatAir, false, "Metal landing left float-air stale");
    assert.equal(f.player.grindExitAir, false, "Metal landing left grind-exit air stale");
  }

  // Remove the middle Wood support and wait for the Metal lid to enter its
  // persistent 14/28 Arrow cycle. Land while it is rising, then stay planted
  // through the apex, descent and next Arrow reversal without lateral shove.
  {
    const f = createTower();
    f.level.breakCrate(f.wood);
    let reachedRisingPhase = false;
    for (let tick = 0; tick < 180; tick++) {
      f.level.update(dt);
      if ((f.lid.fallVel ?? 0) < -4) {
        reachedRisingPhase = true;
        break;
      }
    }
    assert.equal(reachedRisingPhase, true, "Metal lid never entered Arrow bounce");
    const startX = f.lid.mesh.position.x + 0.22;
    const startZ = f.lid.mesh.position.z - 0.18;
    prepareTopContact(f.player, f.lid, { fallSpeed: 13.88 });
    f.player.pos.x = startX;
    f.player.pos.z = startZ;
    f.player.prevPos.x = startX;
    f.player.prevPos.z = startZ;
    f.player.collide(f.level);
    assert.equal(f.player.airRose, false, "rising-lid contact did not open latch handoff");
    assert.equal(f.player.crateFloor, f.lid, "rising-lid contact lost support identity");
    closeTo(f.player.pos.x, startX, "rising lid side-ejected X on contact");
    closeTo(f.player.pos.z, startZ, "rising lid side-ejected Z on contact");

    f.level.update(dt);
    f.player.step(dt, makeInput(), f.level);
    assert.equal(f.player.state, "ride", "rising-lid handoff did not land next tick");
    assert.equal(f.player.grounded, true, "rising-lid handoff did not ground next tick");
    closeTo(f.player.pos.x, startX, "rising lid side-ejected X during handoff");
    closeTo(f.player.pos.z, startZ, "rising lid side-ejected Z during handoff");

    let sawRising = false;
    let sawFalling = false;
    let sawArrowReversal = false;
    let reversalVelocity = 0;
    let previousFallVel = f.lid.fallVel ?? 0;
    for (let tick = 0; tick < 140 && !sawArrowReversal; tick++) {
      const currentTop = f.lid.box.max.y;
      f.player.step(dt, makeInput(), f.level);
      assert.equal(f.player.state, "ride", `moving-lid carry left Ride at tick ${tick}`);
      assert.equal(f.player.grounded, true, `moving-lid carry lost ground at tick ${tick}`);
      assert.equal(f.player.crateFloor, f.lid, `moving-lid carry changed identity at tick ${tick}`);
      closeTo(f.player.pos.y, currentTop + 0.02, `moving-lid carry missed top at tick ${tick}`);
      closeTo(f.player.pos.x, startX, `moving lid side-ejected X at tick ${tick}`);
      closeTo(f.player.pos.z, startZ, `moving lid side-ejected Z at tick ${tick}`);
      f.level.update(dt);
      const fallVel = f.lid.fallVel ?? 0;
      sawRising ||= fallVel < 0;
      sawFalling ||= fallVel > 0;
      if (previousFallVel > 0 && fallVel < 0) {
        sawArrowReversal = true;
        reversalVelocity = fallVel;
      }
      previousFallVel = fallVel;
    }
    assert.equal(sawRising, true, "carry did not cover the rising phase");
    assert.equal(sawFalling, true, "carry did not cover the falling phase");
    assert.equal(sawArrowReversal, true, "carry did not survive the next Arrow reversal");
    closeTo(
      reversalVelocity,
      -TUNING.crateHopSpeed + TUNING.crateHopGravity * dt,
      "Arrow support did not reapply the authored 14/28 launch",
    );

    // Jump is still an ordinary grounded charge/release and inherits none of
    // the crate's vertical motion. A full fresh-input charge reaches 14.
    for (let tick = 0; tick < 25; tick++) {
      f.player.step(
        dt,
        makeInput({ jumpHeld: true, jumpPressed: tick === 0 }),
        f.level,
      );
      f.level.update(dt);
    }
    f.player.step(dt, makeInput({ jumpReleased: true }), f.level);
    assert.equal(f.player.state, "air", "jump release did not leave moving lid");
    assert.equal(f.player.grounded, false, "jump release remained grounded to moving lid");
    closeTo(f.player.vVel, TUNING.jumpVelocity, "moving lid changed grounded jump speed");
    assert.equal(f.lid.alive, true, "jumping off destroyed blank Metal");
  }

  // The box carrying the rider is blank Metal; the Arrow below keeps its own
  // separate player rule: 16 normally, 20 only when Jump is held on impact.
  for (const [jumpHeld, expected] of [
    [false, TUNING.arrowBounce],
    [true, TUNING.arrowBounce * TUNING.arrowBoostMult],
  ]) {
    const f = createTower();
    prepareTopContact(f.player, f.arrow);
    f.player.rawInput = makeInput({ jumpHeld });
    f.player.collide(f.level);
    closeTo(f.player.vVel, expected, `Metal Arrow ${jumpHeld ? "perfect" : "plain"} launch`);
    assert.equal(f.player.state, "air");
    assert.equal(f.player.grounded, false);
    assert.equal(f.arrow.alive, true, "Metal Arrow was destroyed by a stomp");
  }

  // Optional exact replay regression. CI remains self-contained, while a
  // supplied gameplay replay can pin the original failing contact directly.
  if (process.argv[2]) {
    const replay = JSON.parse(await readFile(process.argv[2], "utf8"));
    const entry = findLevel(replay.level);
    assert.ok(entry, `replay level ${replay.level} is not registered`);
    const scene = new THREE.Scene();
    const level = new Level(scene, entry);
    const player = new Player(scene);
    fixtures.push(level);
    player.enterLevel(entry.id);
    player.respawn(level, true);
    // Crate physics is the subject here; prevent unrelated newer directional
    // SPECIAL decoding from changing an older replay's route.
    player.special.value = 0;
    player.special.step = noop;
    player.special.award = () => false;
    const input = makeInput();
    const replayer = new Replayer();
    replayer.begin(replay);
    const lid = level.crates.find(
      (crate) =>
        crate.metal &&
        Math.abs(crate.mesh.position.x - 16) < 0.1 &&
        Math.abs(crate.mesh.position.z + 100) < 0.1,
    );
    assert.ok(lid, "Flats replay bounce-tower lid is missing");
    const samples = new Map();
    while (replayer.active && replayer.frame <= 4992) {
      const frame = replayer.frame;
      if (!replayer.feed(input, player.camDir)) break;
      player.step(dt, input, level);
      level.update(dt);
      if ([4933, 4934, 4935, 4953, 4982, 4983, 4992].includes(frame)) {
        samples.set(frame, {
          x: player.pos.x,
          z: player.pos.z,
          state: player.state,
          grounded: player.grounded,
          vVel: player.vVel,
          airRose: player.airRose,
          lid: player.crateFloor === lid,
          lidFallVel: lid.fallVel ?? 0,
        });
      }
      input.consumeEdges();
    }
    assert.equal(samples.get(4933)?.state, "air", "replay did not approach lid in Air");
    assert.deepEqual(
      {
        state: samples.get(4934)?.state,
        grounded: samples.get(4934)?.grounded,
        vVel: samples.get(4934)?.vVel,
        airRose: samples.get(4934)?.airRose,
        lid: samples.get(4934)?.lid,
      },
      { state: "air", grounded: false, vVel: 0, airRose: false, lid: true },
      "replay contact did not enter the protected one-tick landing handoff",
    );
    assert.equal(samples.get(4935)?.state, "ride", "replay did not ground on next tick");
    assert.equal(samples.get(4935)?.grounded, true, "replay next-tick landing is not grounded");
    assert.equal(samples.get(4953)?.grounded, true, "replay lost support near lid apex");
    assert.equal(samples.get(4982)?.grounded, true, "replay lost descending lid support");
    assert.ok(
      (samples.get(4982)?.lidFallVel ?? 0) > 0 &&
        (samples.get(4983)?.lidFallVel ?? 0) < 0,
      "replay did not retain support across Arrow reversal",
    );
    for (const frame of [4933, 4934, 4935, 4953, 4982, 4983, 4992]) {
      closeTo(samples.get(frame)?.x, 15.732, `replay X drift at frame ${frame}`, 0.001);
      closeTo(samples.get(frame)?.z, -99.959, `replay Z drift at frame ${frame}`, 0.001);
    }
    assert.equal(samples.get(4992)?.state, "air", "replay jump release did not leave lid");
    assert.equal(samples.get(4992)?.grounded, false, "replay jump release stayed grounded");
    closeTo(samples.get(4992)?.vVel, TUNING.jumpVelocity, "replay jump-off speed", 0.001);
  }

  console.log(
    `crate jump parity ok${process.argv[2] ? " (including supplied replay)" : ""}`,
  );
} finally {
  for (const level of fixtures) level.dispose();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
