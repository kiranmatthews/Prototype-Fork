import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));

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
    toggleAttribute: noop,
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

try {
  const { Level, findLevel } = await server.ssrLoadModule("/src/level.ts");
  const { Halfpipe } = await server.ssrLoadModule("/src/halfpipe.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { boxIntersectsMeshTriangles } = await server.ssrLoadModule(
    "/src/meshIntersections.ts",
  );

  const published = JSON.parse(
    await readFile(`${root}public/levels.json`, "utf8"),
  );
  const publishedFlats = published.levels.find((level) => level.id === "flats");
  assert.ok(publishedFlats, "published Flats & Pipes level is missing");

  const publishedScene = new THREE.Scene();
  const publishedLevel = new Level(publishedScene, publishedFlats);
  assert.equal(publishedLevel.halfpipes.length, 4);
  assert.equal(
    publishedLevel.vertBacksSkipped,
    1,
    "the published inflated pool must reject its intersecting hidden pipe back",
  );
  const swept = publishedLevel.groundMeshes.filter(
    (mesh) => mesh.userData.vertRampMesh === true,
  );
  assert.ok(swept.length > 0);
  for (const backing of publishedLevel.vertBacks) {
    for (const mesh of swept) {
      assert.equal(
        boxIntersectsMeshTriangles(backing, mesh),
        false,
        "an accepted hidden pipe back intersects a swept transition",
      );
    }
  }
  publishedLevel.dispose();

  const builtin = findLevel("flats");
  assert.ok(builtin, "built-in Flats & Pipes level is missing");
  const builtinScene = new THREE.Scene();
  const builtinLevel = new Level(builtinScene, builtin);
  assert.equal(builtinLevel.vertBacksSkipped, 0);
  assert.equal(builtinLevel.vertBacks.length, 4);
  builtinLevel.dispose();

  const pipe = new Halfpipe(
    -5,
    5,
    0,
    3,
    6,
    new THREE.MeshBasicMaterial(),
  );
  const lowerFloor = new THREE.Mesh(
    new THREE.BoxGeometry(30, 1, 30),
    new THREE.MeshBasicMaterial(),
  );
  lowerFloor.position.y = -2.5;
  lowerFloor.name = "lower floor";
  const contactScene = new THREE.Scene();
  contactScene.add(pipe.object, lowerFloor);
  contactScene.updateMatrixWorld(true);
  const contactLevel = {
    halfpipes: [pipe],
    groundMeshes: [...pipe.walls, lowerFloor],
    crates: [],
    crumbles: [],
  };
  const player = new Player(contactScene);
  if (player.special) {
    player.special.value = 0;
    player.special.step = () => {};
    player.special.award = () => false;
  }
  player.state = "air";
  player.grounded = false;
  player.crateFloorT = 0;

  const cross = 6;
  const surfaceY = pipe.surfaceY(pipe.crossToU(cross));
  player.pos.set(cross, surfaceY - 0.5, 0);
  player.prevPos.copy(player.pos);
  let hit = player.queryGround(contactLevel);
  assert.equal(hit?.halfpipe, undefined);
  assert.equal(hit?.name, "lower floor");
  assert.ok(Math.abs(player.queryShadowGround(contactLevel) + 2) < 1e-9);

  player.pos.set(cross, surfaceY + 0.5, 0);
  player.prevPos.copy(player.pos);
  hit = player.queryGround(contactLevel);
  assert.equal(hit?.halfpipe, pipe);

  player.prevPos.set(cross, surfaceY + 0.5, 0);
  player.pos.set(cross, surfaceY - 0.5, 0);
  assert.equal(player.queryGround(contactLevel)?.halfpipe, pipe);
  assert.equal(player.pipeCrossHit(contactLevel)?.halfpipe, pipe);

  player.prevPos.set(pipe.lipX + 0.2, pipe.lipY - 1, 0);
  player.pos.set(pipe.lipX - 0.1, pipe.lipY - 1, 0);
  assert.equal(
    player.pipeCrossHit(contactLevel),
    null,
    "behind-coping entry must not become a wall catch",
  );

  player.prevPos.set(cross, surfaceY + 0.5, 6);
  player.pos.set(cross, surfaceY - 0.5, 4.9);
  assert.equal(
    player.pipeCrossHit(contactLevel),
    null,
    "crossing an open pipe end must not become a cross-section catch",
  );

  const playerSource = await readFile(`${root}src/player.ts`, "utf8");
  assert.match(playerSource, /const previousRideSide = ridingPipe\.isRideSide/);
  assert.match(playerSource, /Math\.abs\(pr\.pen\) < TUNING\.wallStick/);
  assert.match(playerSource, /const previousAlong = hp\.alongCoord/);
  assert.match(playerSource, /hp\.rideSideCrossing\(/);

  console.log(
    "Validated ride-side-only pipe support/crossings and removal of the published pool's intersecting hidden backing collider.",
  );
} finally {
  await server.close();
}
