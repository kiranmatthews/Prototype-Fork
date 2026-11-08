import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import ts from "typescript";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
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
  const { CONST } = await server.ssrLoadModule("/src/tuning.ts");
  const entry = findLevel("dark");
  assert.ok(entry);
  const scene = new THREE.Scene();
  const level = new Level(scene, entry);
  const player = new Player(scene);
  player.enterLevel(entry.id);
  const input = makeInput();
  const mover = level.movers[3];
  assert.ok(mover, "Nightworks landing lift is missing");
  assert.ok(Math.abs(mover.axisV.y) > 0.99 && mover.amp > 0 && mover.speed > 0,
    "the landing fixture must use the authored vertical lift");
  mover.mesh.geometry.computeBoundingBox();
  const localTop = mover.mesh.geometry.boundingBox.max.y;
  const liftTop = () => mover.mesh.position.y + localTop;

  // Exercise the actual lift and Player directly. The old 147-second input
  // lead-in now reaches a death after deliberate course/controller changes;
  // it no longer reaches the landing-marker regression it was meant to test.
  // Both motion directions must publish the X at the post-update transform,
  // while gameplay contact still uses the transform sampled by Player.step.
  for (const [direction, phase, sign] of [["rising", 0, 1], ["falling", Math.PI, -1]]) {
    level.time = 0;
    mover.phase = mover.axisV.y > 0 ? phase : phase + Math.PI;
    level.update(CONST.fixedStep);
    player.respawn(level, true);
    player.pos.set(mover.mesh.position.x, liftTop() + 2, mover.mesh.position.z);
    player.prevPos.copy(player.pos);
    player.state = "air";
    player.grounded = false;
    player.groundHit = null;
    player.freeSkate = false;
    player.airFromSkate = false;
    player.speed = 0;
    player.vVel = -2;
    player.snapRenderInterpolation();
    let airborneFrames = 0;
    let touchdown = false;
    for (let frame = 0; frame < 120; frame++) {
      const sampledTop = liftTop();
      player.step(CONST.fixedStep, input, level);
      level.update(CONST.fixedStep);
      player.commitRenderStep(level);
      const renderedTop = liftTop();
      const label = `${direction} lift, frame ${frame}`;
      assert.ok((renderedTop - sampledTop) * sign > 1e-5,
        `${label}: fixture must distinguish the old and rendered transforms`);
      if (player.grounded) {
        assert.equal(player.state, "ride", `${label}: expected a supported landing`);
        assert.ok(Math.abs(player.pos.y - sampledTop) < 1e-6,
          `${label}: gameplay contact changed from the sampled lift top`);
        assert.equal(player.groundHit?.mesh, mover.mesh,
          `${label}: landed on another surface`);
        const supportRay = new THREE.Raycaster(
          new THREE.Vector3(player.pos.x, renderedTop + 1, player.pos.z),
          new THREE.Vector3(0, -1, 0), 0, 2,
        );
        assert.ok(supportRay.intersectObject(mover.mesh, false).length > 0,
          `${label}: feet must remain above the rendered lift`);
        touchdown = true;
        break;
      }
      assert.equal(player.state, "air", `${label}: approach left the airborne state`);
      assert.equal(player.floorX.visible, true, `${label}: X is hidden`);
      assert.ok(Math.abs(player.shadowGroundY - renderedTop) < 1e-6,
        `${label}: ground probe is stale`);
      assert.ok(Math.abs(player.floorX.position.y - (renderedTop + 0.05)) < 1e-6,
        `${label}: X is not on the rendered lift`);
      assert.ok(Math.abs(player.floorX.position.x - player.pos.x) < 1e-6);
      assert.ok(Math.abs(player.floorX.position.z - player.pos.z) < 1e-6);
      airborneFrames++;
      input.consumeEdges();
    }
    assert.ok(airborneFrames >= 4, `${direction}: insufficient airborne coverage`);
    assert.equal(touchdown, true, `${direction}: never landed on the lift`);
  }

  const main = await readFile(`${root}src/main.ts`, "utf8");
  // Check statement order inside the actual fixed-step loop. A character
  // count between calls makes an unrelated comment break this invariant.
  const ast = ts.createSourceFile('main.ts', main, ts.ScriptTarget.Latest, true);
  let fixedLoopChecked = false;
  const inspect = node => {
    if (ts.isWhileStatement(node) && ts.isBlock(node.statement)) {
      const calls = [];
      // The race owns its level update; ordinary play calls it conditionally.
      // Inspect the actual statement order through those conditionals.
      const collect = n => {
        if (ts.isCallExpression(n)) calls.push(n.expression.getText(ast));
        if (!ts.isFunctionLike(n)) ts.forEachChild(n, collect);
      };
      node.statement.statements.forEach(collect);
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
    "Validated post-mover landing-X refresh and sampled gameplay contact on the rising and falling Nightworks lift.",
  );
  level.dispose();
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
