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
  });
  const context = new Proxy(
    {
      canvas: null,
      createImageData: (width, height) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createPattern: () => ({}),
      createRadialGradient: () => ({ addColorStop: noop }),
      getImageData: (_x, _y, width, height) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      measureText: (text) => ({ width: String(text).length * 8 }),
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

const inputChannels = [
  "jumpHeld",
  "grindHeld",
  "spinHeld",
  "grabHeld",
  "transferHeld",
  "jumpPressed",
  "jumpReleased",
  "grindPressed",
  "spinPressed",
  "grabPressed",
  "transferPressed",
  "restartPressed",
];

function makeInput() {
  const input = { moveX: 0, moveY: 0 };
  for (const channel of inputChannels) input[channel] = false;
  input.consumeEdges = noop;
  return input;
}

function deathLevelData() {
  return {
    v: 1,
    name: "Campaign death flow fixture",
    spawn: [0, 0.05, 0],
    killY: -30,
    components: [
      { t: "platform", p: [0, -0.5, 0], s: [20, 1, 20] },
      { t: "gate", p: [0, 0, -8] },
    ],
    groups: [],
  };
}

installHeadlessDom();
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) =>
  /GLB|skull mask failed|crossbones failed|skateboard trucks|spin model failed/.test(
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
  const { Level } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { CONST } = await server.ssrLoadModule("/src/tuning.ts");

  function createPlayer(options = {}) {
    const scene = new THREE.Scene();
    const data = deathLevelData();
    const level = new Level(scene, {
      id: `death-flow-${fixtures.length}`,
      name: data.name,
      data,
    });
    fixtures.push(level);
    const player = new Player(scene);
    player.respawn(level, true);
    player.rawInput = makeInput();
    player.lives = options.lives ?? 4;
    player.fruit = options.fruit ?? 27;
    player.points = options.points ?? 101;
    player.totalDeaths = options.totalDeaths ?? 0;
    player.bonusMode = options.bonusMode === true;
    player.endlessDeaths = options.endlessDeaths === true;

    const events = [];
    let respawnCalls = 0;
    const respawn = player.respawn.bind(player);
    player.respawn = (...args) => {
      respawnCalls++;
      return respawn(...args);
    };
    player.onDeath = () => events.push("death");
    player.onGameOver = () => events.push("gameover");
    player.onBonusDeath = () => events.push("bonus-return");
    player.onRespawn = () => events.push("respawn");
    return {
      level,
      player,
      events,
      respawnCalls: () => respawnCalls,
    };
  }

  function resolveDeath(fixture) {
    const { player, level } = fixture;
    const input = makeInput();
    const maxSteps = Math.ceil(CONST.respawnDelay / CONST.fixedStep) + 3;
    for (let step = 0; step < maxSteps; step++) {
      player.step(CONST.fixedStep, input, level);
      if (player.state !== "dead") return step + 1;
    }
    assert.fail("death never resolved after the authored respawn delay");
  }

  // Zero is the final playable campaign life. A death from one spends it and
  // still respawns; only the following death, begun at zero, latches Game Over.
  const boundary = createPlayer({ lives: 1 });
  boundary.player.die();
  assert.equal(boundary.player.lives, 0, "one-life death did not reach zero");
  assert.deepEqual(boundary.events, ["death"]);
  resolveDeath(boundary);
  assert.equal(boundary.player.state, "ride");
  assert.equal(boundary.respawnCalls(), 1);
  assert.deepEqual(boundary.events, ["death", "respawn"]);

  boundary.player.die();
  assert.equal(boundary.player.lives, 0, "zero-life death made lives negative");
  resolveDeath(boundary);
  assert.equal(boundary.player.state, "gameover");
  assert.equal(boundary.respawnCalls(), 1, "death begun at zero respawned");
  assert.deepEqual(boundary.events, [
    "death",
    "respawn",
    "death",
    "gameover",
  ]);

  // With a life remaining, the same timer resolves to the checkpoint path and
  // must never invoke either terminal callback.
  const surviving = createPlayer({ lives: 2 });
  surviving.player.die();
  assert.equal(surviving.player.lives, 1);
  resolveDeath(surviving);
  assert.equal(surviving.player.state, "ride");
  assert.equal(surviving.respawnCalls(), 1);
  assert.deepEqual(surviving.events, ["death", "respawn"]);

  // An already-earned wumpa may finish its HUD flight during the death delay.
  // It can roll 99 fruit into a life, but it must not change the terminal
  // outcome latched when this death began at zero lives.
  const flyingBoundary = createPlayer({ lives: 0, fruit: 99 });
  const flyingFruit = flyingBoundary.player.fruits[0];
  flyingFruit.phase = "fly";
  flyingFruit.t = 2.01; // updateFruit settles timed-out flights this step
  flyingFruit.sx = 0.5;
  flyingFruit.sy = 0.5;
  const fruitRevision = flyingBoundary.player.fruitCollectionRevision;
  flyingBoundary.player.die();
  assert.equal(flyingBoundary.player.lives, 0, "zero-life impact went negative");
  flyingBoundary.player.step(
    CONST.fixedStep,
    makeInput(),
    flyingBoundary.level,
  );
  assert.equal(flyingFruit.phase, "off", "in-flight fruit did not reach the HUD");
  assert.equal(
    flyingBoundary.player.fruitCollectionRevision,
    fruitRevision + 1,
    "settled flight did not credit its earned fruit",
  );
  resolveDeath(flyingBoundary);
  assert.equal(flyingBoundary.player.state, "gameover");
  assert.deepEqual(flyingBoundary.events, ["death", "gameover"]);
  assert.equal(
    flyingBoundary.respawnCalls(),
    0,
    "late wumpa life overrode the Game Over outcome latched at impact",
  );

  // Bonus stages own a temporary zero-life purse. Death is free and resolves
  // through the parent-return callback before the standard zero-life branch.
  const bonus = createPlayer({ lives: 0, bonusMode: true, fruit: 8 });
  bonus.player.die();
  assert.equal(bonus.player.lives, 0, "bonus death changed its temporary life purse");
  assert.equal(bonus.player.fruit, 8, "bonus death mutated rewards before parent return");
  resolveDeath(bonus);
  assert.equal(bonus.player.state, "gameover");
  assert.deepEqual(bonus.events, ["death", "bonus-return"]);
  assert.equal(bonus.respawnCalls(), 0, "bonus death locally respawned instead of returning parent");

  // Endless mode keeps its score/death penalty and ordinary respawn contract;
  // the campaign lives/game-over branch must remain completely bypassed.
  const endless = createPlayer({
    lives: 0,
    endlessDeaths: true,
    fruit: 63,
    points: 101,
    totalDeaths: 7,
  });
  endless.player.die();
  assert.equal(endless.player.lives, 0, "endless death changed campaign lives");
  assert.equal(endless.player.totalDeaths, 8);
  assert.equal(endless.player.points, 51, "endless death penalty changed");
  resolveDeath(endless);
  assert.equal(endless.player.state, "ride");
  assert.equal(endless.player.fruit, 0, "endless respawn did not clear fruit");
  assert.equal(endless.respawnCalls(), 1);
  assert.deepEqual(endless.events, ["death", "respawn"]);

  console.log(
    "Validated zero-life Game Over latch, surviving respawns, free bonus return, and endless death flow.",
  );
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  for (const level of fixtures) level.dispose();
  await server.close();
}
