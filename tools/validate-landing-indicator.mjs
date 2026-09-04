import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
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
  const { Level, findLevel } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { Replayer } = await server.ssrLoadModule("/src/replay.ts");
  const { CONST } = await server.ssrLoadModule("/src/tuning.ts");
  const entry = findLevel(replay.level);
  assert.ok(entry);
  const scene = new THREE.Scene();
  const level = new Level(scene, entry);
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
    player.step(CONST.fixedStep, input, level);
    level.update(CONST.fixedStep);
    player.commitRenderStep(level);
    if (frame >= 8803) {
      const mover = level.movers[3];
      const height = mover.mesh.geometry.parameters.height;
      rows.set(frame, {
        state: player.state,
        grounded: player.grounded,
        pos: player.pos.clone(),
        marker: player.floorX.position.clone(),
        markerVisible: player.floorX.visible,
        groundY: player.shadowGroundY,
        moverTop: mover.mesh.position.y + height / 2,
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
  assert.ok(Math.abs(touchdown.pos.x - -9.171688572) < 1e-4);
  assert.ok(Math.abs(touchdown.pos.z - -45.101657387) < 1e-4);

  const main = await readFile(`${root}src/main.ts`, "utf8");
  assert.match(
    main,
    /level\.update\(CONST\.fixedStep\);[\s\S]{0,600}player\.commitRenderStep\(level\)/,
  );
  assert.match(main, /p2\.commitRenderStep\(level\)/);
  const playerSource = await readFile(`${root}src/player.ts`, "utf8");
  assert.doesNotMatch(
    playerSource,
    /if \(this\.floorX\.visible\) this\.floorX\.position\.add/,
  );

  console.log(
    "Validated post-mover landing-X refresh on the Nightworks vertical lift with unchanged touchdown physics.",
  );
  level.dispose();
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
