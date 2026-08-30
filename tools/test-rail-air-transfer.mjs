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

function closeTo(actual, expected, message, tolerance = 1e-8) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`,
  );
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
  const { Level } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { Rail } = await server.ssrLoadModule("/src/rails.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");

  const levelData = {
    v: 1,
    name: "Rail Air Transfer Test",
    spawn: [0, 8, 0],
    killY: -40,
    components: [
      { t: "platform", p: [0, -20.5, -10], s: [40, 1, 80] },
      { t: "gate", p: [0, -20, -35] },
    ],
    groups: [],
  };

  function createPlayer() {
    const scene = new THREE.Scene();
    const level = new Level(scene, {
      id: "rail-air-test",
      name: levelData.name,
      data: structuredClone(levelData),
    });
    const player = new Player(scene);
    if (player.special) {
      player.special.value = 0;
      player.special.step = () => {};
      player.special.award = () => false;
    }
    player.pos.set(0, 8, 0);
    player.prevPos.copy(player.pos);
    player.axisF.set(0, 0, -1);
    player.axisL.set(1, 0, 0);
    player.state = "air";
    player.grounded = false;
    return { scene, level, player };
  }

  function createRailExit() {
    const fixture = createPlayer();
    const rail = new Rail([
      new THREE.Vector3(0, 8, 5),
      new THREE.Vector3(0, 8, -15),
    ]);
    fixture.scene.add(rail.object);
    fixture.player.state = "grind";
    fixture.player.freeSkate = true;
    fixture.player.grindRail = rail;
    fixture.player.grindT = 5;
    fixture.player.grindDir = 1;
    fixture.player.grindVel = 12;
    fixture.player.exitGrind(8, fixture.level);
    assert.equal(fixture.player.state, "air");
    assert.equal(fixture.player.airFromSkate, true);
    assert.equal(fixture.player.airMomentum, true);
    assert.equal(fixture.player.grindExitAir, true);
    return fixture;
  }

  function stepAndMeasure(fixture, input) {
    const before = fixture.player.pos.clone();
    const forward = fixture.player.axisF.clone();
    const lateral = fixture.player.axisL.clone();
    fixture.player.step(CONST.fixedStep, input, fixture.level);
    fixture.level.update(CONST.fixedStep);
    const delta = fixture.player.pos.clone().sub(before);
    return {
      forward: delta.dot(forward),
      lateral: delta.dot(lateral),
      worldX: delta.x,
      spin: fixture.player.grabSpinAngle,
    };
  }

  for (const sign of [-1, 1]) {
    const rotationOnly = createRailExit();
    const noR2 = stepAndMeasure(
      rotationOnly,
      makeInput({ moveX: sign }),
    );
    closeTo(noR2.lateral, 0, `rail ${sign} without R2 traversed laterally`);
    closeTo(noR2.forward, 12 * CONST.fixedStep, `rail ${sign} forward carry`);
    closeTo(
      noR2.spin,
      -sign * TUNING.grabSpinRate * CONST.fixedStep,
      `rail ${sign} without R2 did not rotate`,
    );
    rotationOnly.level.dispose();

    const transferring = createRailExit();
    const withR2 = stepAndMeasure(
      transferring,
      makeInput({ moveX: sign, transferHeld: true }),
    );
    closeTo(
      withR2.worldX,
      sign * TUNING.walkSpeed * CONST.fixedStep,
      `rail ${sign} held-R2 transfer`,
    );
    closeTo(withR2.forward, 12 * CONST.fixedStep, `rail ${sign} R2 forward carry`);
    closeTo(
      withR2.spin,
      -sign * TUNING.grabSpinRate * CONST.fixedStep,
      `rail ${sign} held R2 suppressed rotation`,
    );
    const released = stepAndMeasure(
      transferring,
      makeInput({ moveX: sign }),
    );
    closeTo(released.worldX, 0, `rail ${sign} kept strafe after R2 release`);
    transferring.level.dispose();

    const edgeOnly = createRailExit();
    const pressedNotHeld = stepAndMeasure(
      edgeOnly,
      makeInput({ moveX: sign, transferPressed: true }),
    );
    closeTo(
      pressedNotHeld.lateral,
      0,
      `rail ${sign} transfer edge acted like held R2`,
    );
    edgeOnly.level.dispose();

    for (const transferHeld of [false, true]) {
      const foot = createPlayer();
      foot.player.vVel = 8;
      foot.player.freeSkate = false;
      foot.player.airFromSkate = false;
      foot.player.airMomentum = false;
      foot.player.grindExitAir = false;
      const footStep = stepAndMeasure(
        foot,
        makeInput({ moveX: sign, transferHeld }),
      );
      closeTo(
        footStep.lateral,
        sign * TUNING.walkSpeed * CONST.fixedStep,
        `foot ${sign} precision air with R2=${transferHeld}`,
      );
      closeTo(footStep.spin, 0, `foot ${sign} air rotated`);
      closeTo(
        foot.player.walkVelocity.dot(foot.player.axisL),
        sign * TUNING.walkSpeed,
        `foot ${sign} walkVelocity`,
      );
      foot.level.dispose();
    }

    const ordinaryBoardAir = createPlayer();
    ordinaryBoardAir.player.freeSkate = true;
    ordinaryBoardAir.player.airFromSkate = true;
    ordinaryBoardAir.player.airGrav = "board";
    ordinaryBoardAir.player.airMomentum = true;
    ordinaryBoardAir.player.speed = 12;
    ordinaryBoardAir.player.vVel = 8;
    ordinaryBoardAir.player.grindExitAir = false;
    const boardStep = stepAndMeasure(
      ordinaryBoardAir,
      makeInput({ moveX: sign, transferHeld: true }),
    );
    closeTo(boardStep.lateral, 0, `ordinary board air ${sign} used rail transfer`);
    closeTo(
      boardStep.spin,
      -sign * TUNING.grabSpinRate * CONST.fixedStep,
      `ordinary board air ${sign} did not rotate`,
    );
    ordinaryBoardAir.level.dispose();
  }

  const respawn = createRailExit();
  respawn.player.respawn(respawn.level, true);
  assert.equal(respawn.player.grindExitAir, false, "respawn leaked rail transfer authority");
  respawn.level.dispose();

  const touchSource = await readFile(`${root}src/touch.ts`, "utf8");
  assert.match(
    touchSource,
    /const SWIPE_HOLD_MS = 450/,
    "touch R2 pulse is too short for the authored rail-transfer gap",
  );

  console.log(
    "Validated R2-gated rail-air traversal, rotation-only stick input without R2, and unchanged foot-air control.",
  );
} finally {
  await server.close();
}
