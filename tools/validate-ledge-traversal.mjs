import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = JSON.parse(
  await readFile(`${root}tools/fixtures/ledge-jungle-replay.json`, "utf8"),
);
assert.equal(fixture.level, "jungle");
assert.equal(fixture.frames, 4788);

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
    height: 1,
    width: 1,
    getContext() {
      context.canvas = this;
      return context;
    },
  });
  const body = makeElement("body");
  globalThis.document = {
    body,
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

function makeInput() {
  const input = { moveX: 0, moveY: 0 };
  for (const key of channels) input[key] = false;
  input.consumeEdges = () => {
    for (const key of edgeChannels) input[key] = false;
  };
  return input;
}

function capture(player) {
  const anchor = player.ledgeAnchor?.clone() ?? new THREE.Vector3();
  const normal = player.ledgeNormal?.clone() ?? new THREE.Vector3();
  const landing = player.ledgeLanding?.clone() ?? new THREE.Vector3();
  const climbTo = player.ledgeClimbTo?.clone() ?? new THREE.Vector3();
  return {
    state: player.state,
    grounded: player.grounded,
    pos: player.pos.clone(),
    phase: player.ledgePhase,
    anchor,
    normal,
    landing,
    climbTo,
  };
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
  if (expectedAssetLog(args[0])) return;
  originalError(...args);
};

try {
  const { Level, findLevel } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { Replayer } = await server.ssrLoadModule("/src/replay.ts");
  const { CONST } = await server.ssrLoadModule("/src/tuning.ts");
  const {
    ledgeBasis,
    ledgeBlockerIntersects,
    ledgeBodyBox,
    ledgeLandingPoint,
    ledgeTraversePoint,
  } = await server.ssrLoadModule("/src/ledgeTraversal.ts");

  // Exact diagonal normal from the attached failing take: all movement must
  // stay in normal/tangent space, never collapse to an X-or-Z branch.
  const replayNormal = new THREE.Vector3(
    0.08018534728595439,
    0,
    0.9967799707461176,
  );
  const basis = ledgeBasis(replayNormal, 0.5, 0.5);
  const anchor = new THREE.Vector3(-1.695248085, -0.59423062, -38.97382037);
  const landing = ledgeLandingPoint(
    new THREE.Vector3(),
    anchor,
    basis,
    0.42,
    0.65576938,
  );
  const landingDelta = landing.clone().sub(anchor).setY(0);
  assert.ok(
    Math.abs(landingDelta.x * basis.tx + landingDelta.z * basis.tz) < 1e-9,
    "diagonal mantle target drifted along the ledge",
  );
  assert.ok(
    -(landingDelta.x * basis.nx + landingDelta.z * basis.nz) > 0.9,
    "diagonal mantle did not travel inward",
  );
  const right = ledgeTraversePoint(
    new THREE.Vector3(),
    anchor,
    basis,
    0.8,
  );
  assert.ok(right.distanceTo(anchor) > 0.79);
  assert.ok(
    (right.x - anchor.x) * basis.tx + (right.z - anchor.z) * basis.tz > 0.79,
  );

  const body = ledgeBodyBox(
    new THREE.Box3(),
    new THREE.Vector3(0, 1, 0),
    CONST.playerHalf,
  );
  const support = new THREE.Box3(
    new THREE.Vector3(-2, -1, -2),
    new THREE.Vector3(2, 1.05, 2),
  );
  const lowCeiling = new THREE.Box3(
    new THREE.Vector3(-0.4, 1.45, -0.4),
    new THREE.Vector3(0.4, 1.75, 0.4),
  );
  assert.equal(ledgeBlockerIntersects(support, body, 1), false);
  assert.equal(ledgeBlockerIntersects(lowCeiling, body, 1), true);

  const checkpoints = new Set([
    4351, 4352, 4389, 4360, 4442, 4450, 4497, 4503, 4554, 4565, 4595,
    4620,
  ]);
  async function runReplay(data, beforeFrame, stopAfter = Number.POSITIVE_INFINITY) {
    const scene = new THREE.Scene();
    const entry = findLevel(data.level);
    assert.ok(entry, "Jungle replay level is missing");
    const level = new Level(scene, entry);
    const player = new Player(scene);
    // Keep this historical traversal take scoped to ledge physics even as new
    // trick economies are added to Player after the replay was recorded.
    if (player.special) {
      player.special.value = 0;
      player.special.step = () => {};
      player.special.award = () => false;
    }
    player.enterLevel(entry.id);
    player.endlessDeaths = data.endlessDeaths === true;
    player.respawn(level, true);
    const input = makeInput();
    const replayer = new Replayer();
    replayer.begin(data);
    const rows = new Map();
    while (replayer.active) {
      const frame = replayer.frame;
      beforeFrame?.(frame, player, level);
      if (!replayer.feed(input, player.camDir)) break;
      player.step(CONST.fixedStep, input, level);
      level.update(CONST.fixedStep);
      if (checkpoints.has(frame)) rows.set(frame, capture(player));
      input.consumeEdges();
      if (frame >= stopAfter) {
        replayer.end();
        break;
      }
    }
    const final = capture(player);
    level.dispose();
    return { rows, final };
  }

  const baseline = await runReplay(structuredClone(fixture));
  assert.equal(baseline.rows.get(4351).state, "hang");
  const normal = baseline.rows.get(4351).normal.normalize();
  const tangent = new THREE.Vector3(normal.z, 0, -normal.x);
  const displacement = (from, to) =>
    baseline.rows.get(to).anchor.clone().sub(baseline.rows.get(from).anchor);
  const rightOne = displacement(4389, 4442);
  const leftOne = displacement(4450, 4497);
  const rightTwo = displacement(4503, 4554);
  assert.ok(rightOne.dot(tangent) > 0.5, "first right shimmy did not progress");
  assert.ok(leftOne.dot(tangent) < -0.5, "left shimmy did not reverse progress");
  assert.ok(rightTwo.dot(tangent) > 0.5, "second right shimmy did not progress");
  assert.ok(
    rightOne.length() > 1.5,
    "long mesh traversal stopped before the authored edge ended",
  );
  assert.ok(
    Math.abs(baseline.rows.get(4442).normal.x) < 0.03,
    "local ledge frame kept the oblique approach drift",
  );
  const climb = baseline.rows.get(4565);
  assert.equal(climb.phase, "climb", "jump did not commit the climb");
  const climbDelta = climb.climbTo.clone().sub(climb.anchor).setY(0);
  assert.ok(
    Math.abs(climbDelta.dot(tangent)) < 0.03,
    "climb target moved sideways instead of inward",
  );
  assert.ok(-climbDelta.dot(normal) > 0.85, "climb target did not clear the lip");

  // Hang/climb state rides the same lastDelta channel as grounded mover
  // contact; otherwise the platform walks away while grounded=false.
  const moverDelta = new THREE.Vector3(0.3, 0.2, -0.1);
  const moverRun = await runReplay(
    structuredClone(fixture),
    (frame, player, level) => {
      if (frame !== 4352) return;
      player.ledgeMoverId = 999;
      level.moverDelta = () => moverDelta;
    },
    4352,
  );
  assert.ok(
    moverRun.rows
      .get(4352)
      .anchor.clone()
      .sub(moverRun.rows.get(4351).anchor)
      .distanceTo(moverDelta) < 1e-9,
    "moving support did not carry the hang anchor",
  );
  assert.ok(
    moverRun.rows
      .get(4352)
      .landing.clone()
      .sub(moverRun.rows.get(4351).landing)
      .distanceTo(moverDelta) < 1e-9,
    "moving support did not carry the mantle landing",
  );

  // The old target fell unless forward input rescued it after the animation.
  const neutral = structuredClone(fixture);
  for (let frame = 4565; frame < neutral.frames; frame++) neutral.my[frame] = 0;
  const neutralRun = await runReplay(neutral);
  const neutralEnd = neutralRun.rows.get(4620);
  assert.equal(neutralEnd.state, "ride");
  assert.equal(neutralEnd.grounded, true);
  assert.ok(neutralEnd.pos.z < -39.5, "neutral climb finished outside the ledge");

  // Holding X through the collision frame must queue the mantle; no release
  // and second press should be required after the hands catch.
  const heldCatch = structuredClone(fixture);
  for (let frame = 4351; frame <= 4375; frame++) heldCatch.b[frame] |= 1;
  const heldRun = await runReplay(heldCatch);
  assert.equal(heldRun.rows.get(4351).state, "hang");
  assert.equal(
    heldRun.rows.get(4360).phase,
    "climb",
    "held-through-catch jump intent was lost",
  );

  // A real low ceiling blocks only the climb. The grip remains live and can
  // traverse away from that deliberate traverse-only section.
  const blocked = structuredClone(fixture);
  for (let frame = 4566; frame < blocked.frames; frame++) {
    blocked.mx[frame] = -1;
    blocked.my[frame] = 0;
    blocked.b[frame] = 0;
  }
  let installedBlocker = false;
  const blockedRun = await runReplay(blocked, (frame, player, level) => {
    if (frame !== 4565 || installedBlocker) return;
    installedBlocker = true;
    const point = player.ledgeLanding.clone();
    level.walls.push(
      new THREE.Box3(
        new THREE.Vector3(point.x - 0.4, point.y + 0.22, point.z - 0.4),
        new THREE.Vector3(point.x + 0.4, point.y + 0.78, point.z + 0.4),
      ),
    );
  });
  assert.equal(blockedRun.rows.get(4565).phase, "grip");
  assert.equal(blockedRun.rows.get(4595).state, "hang");
  assert.equal(blockedRun.rows.get(4595).phase, "grip");
  assert.ok(
    blockedRun.rows
      .get(4595)
      .anchor.distanceTo(blockedRun.rows.get(4565).anchor) > 0.5,
    "traverse-only blocker also stopped ledge traversal",
  );

  console.log(
    "Validated refit diagonal/seam ledge traversal, mover carry, inward mantle targeting, neutral and held-input climbs, and deliberate traverse-only clearance.",
  );
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
