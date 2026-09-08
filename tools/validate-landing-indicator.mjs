import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import ts from "typescript";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const replay = JSON.parse(
  await readFile(
    `${root}tools/fixtures/landing-x-nightworks-replay.json`,
    "utf8",
  ),
);
assert.equal(replay.level, "dark");
assert.equal(replay.frames, 9649);

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
const makeInput = () => {
  const input = { moveX: 0, moveY: 0 };
  for (const key of channels) input[key] = false;
  input.consumeEdges = () => {
    for (const key of edgeChannels) input[key] = false;
  };
  return input;
};

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

try {
  const { Level, findLevel, roundCorners } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { Replayer } = await server.ssrLoadModule("/src/replay.ts");
  const { CONST } = await server.ssrLoadModule("/src/tuning.ts");
  const entry = findLevel(replay.level);
  assert.ok(entry);
  const scene = new THREE.Scene();
  // This historical replay recorded camera-relative inputs before the fixed
  // Nightworks camera. Pin its camera fixture so it continues testing landing
  // marker timing rather than requiring the live course to retain old steering.
  const legacyCamera = JSON.parse(await readFile(`${root}tools/fixtures/nightworks-legacy-camera.json`, "utf8"));
  const level = new Level(scene, entry);
  level.cameraViews.length=0; // the historical recording predates view volumes
  level.lanePts = roundCorners(legacyCamera.filter(c=>c.t==="camnode").map(c=>[c.p[0],c.p[2],c.radius,c.p[1]]),false).map(p=>({x:p.x,y:p.y,z:p.z}));
  level.measureLane();
  level.zones = legacyCamera.filter(c=>c.t==="zone").map(c=>({xMin:c.p[0]-c.s[0]/2,xMax:c.p[0]+c.s[0]/2,zMin:c.p[2]-c.s[2]/2,zMax:c.p[2]+c.s[2]/2,dir:c.dir}));
  const player = new Player(scene);
  if (player.special) {
    player.special.value = 0;
    player.special.step = () => {};
    player.special.award = () => false;
  }
  player.enterLevel(entry.id);
  player.endlessDeaths = replay.endlessDeaths === true;
  player.respawn(level, true);
  const input = makeInput();
  const replayer = new Replayer();
  replayer.begin(replay);
  const rows = new Map();
  while (replayer.active && replayer.frame <= 8807) {
    const frame = replayer.frame;
    if (!replayer.feed(input, player.camDir)) break;
    const wasDead = player.state === "dead";
    player.step(CONST.fixedStep, input, level);
    // Preserve this legacy take's fixed-frame inputs across its earlier deaths.
    // The longer presentation interval is covered by test-campaign-death-flow.
    if (!wasDead && player.state === "dead")
      player.respawnTimer = CONST.respawnDelay;
    level.update(CONST.fixedStep);
    player.commitRenderStep(level);
    if (frame >= 8803) {
      const mover = level.movers[3];
      mover.mesh.geometry.computeBoundingBox();
      const top = mover.mesh.geometry.boundingBox.max.y;
      rows.set(frame, {
        state: player.state,
        grounded: player.grounded,
        pos: player.pos.clone(),
        marker: player.floorX.position.clone(),
        markerVisible: player.floorX.visible,
        groundY: player.shadowGroundY,
        moverTop: mover.mesh.position.y + top,
      });
    }
    input.consumeEdges();
  }

  for (const frame of [8803, 8804, 8805, 8806]) {
    const row = rows.get(frame);
    assert.ok(row, `missing frame ${frame}`);
    assert.equal(row.markerVisible, true, `X hidden on frame ${frame}`);
    assert.ok(
      Math.abs(row.groundY - row.moverTop) < 1e-6,
      `frame ${frame}: ground probe is stale`,
    );
    assert.ok(
      Math.abs(row.marker.y - (row.moverTop + 0.05)) < 1e-6,
      `frame ${frame}: X is not on the rendered lift`,
    );
    assert.ok(Math.abs(row.marker.x - row.pos.x) < 1e-6);
    assert.ok(Math.abs(row.marker.z - row.pos.z) < 1e-6);
  }
  const touchdown = rows.get(8807);
  assert.equal(touchdown.state, "ride");
  assert.equal(touchdown.grounded, true);
  // Gameplay lands against the mover transform sampled by Player.step; the
  // subsequent Level.update is presentation timing and remains untouched.
  assert.ok(Math.abs(touchdown.pos.y - 3.5764) < 1e-3);
  // The fitted stone rim can resolve the approach laterally. The replay must
  // still land on this same lift, with the marker under the actual feet.
  const supportRay = new THREE.Raycaster(
    new THREE.Vector3(touchdown.pos.x, rows.get(8806).moverTop + 1, touchdown.pos.z),
    new THREE.Vector3(0, -1, 0), 0, 2,
  );
  assert.ok(supportRay.intersectObject(level.movers[3].mesh, false).length > 0,
    `touchdown must remain over the lift: ${touchdown.pos.toArray()}`);
  assert.ok(Math.abs(touchdown.pos.x - level.movers[3].mesh.position.x) < 2.25);
  assert.ok(Math.abs(touchdown.pos.z - level.movers[3].mesh.position.z) < 2.25);

  const main = await readFile(`${root}src/main.ts`, "utf8");
  // Check statement order inside the actual fixed-step loop. A character
  // count between calls makes an unrelated comment break this invariant.
  const ast = ts.createSourceFile('main.ts', main, ts.ScriptTarget.Latest, true);
  let fixedLoopChecked = false;
  const inspect = node => {
    if (ts.isWhileStatement(node) && ts.isBlock(node.statement)) {
      const calls = node.statement.statements
        .filter(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression))
        .map(n => n.expression.expression.getText(ast));
      const update = calls.indexOf('level.update');
      if (update >= 0) {
        const commit = calls.indexOf('player.commitRenderStep');
        assert.ok(commit > update, 'publish the render pose after updating the level');
        assert.ok(calls.indexOf('input.consumeEdges') > commit, 'publish before consuming the tick');
        fixedLoopChecked = true;
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(ast);
  assert.equal(fixedLoopChecked, true, 'fixed simulation loop was not inspected');
  assert.match(main, /p2\.commitRenderStep\(level\)/);
  const playerSource = await readFile(`${root}src/player.ts`, "utf8");
  assert.doesNotMatch(
    playerSource,
    /if \(this\.floorX\.visible\) this\.floorX\.position\.add/,
  );

  console.log(
    "Validated post-mover landing-X refresh and the recorded touchdown height on the fitted Nightworks lift.",
  );
  level.dispose();
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
