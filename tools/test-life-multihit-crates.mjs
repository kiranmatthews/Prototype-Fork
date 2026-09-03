import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const noop = () => {};

function installHeadlessDom() {
  const storage = new Map();
  const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
  const makeElement = (tag = "div") => ({
    tagName: String(tag).toUpperCase(), style: {}, classList, children: [],
    addEventListener: noop, removeEventListener: noop, setAttribute: noop,
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    remove: noop,
  });
  globalThis.localStorage = {
    get length() { return storage.size; },
    clear() { storage.clear(); },
    getItem(key) { return storage.get(String(key)) ?? null; },
    key(index) { return [...storage.keys()][index] ?? null; },
    removeItem(key) { storage.delete(String(key)); },
    setItem(key, value) { storage.set(String(key), String(value)); },
  };
  const context = new Proxy({
    canvas: null,
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: (_x, _y, width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    measureText: (text) => ({ width: String(text).length * 8 }),
  }, { get: (target, key) => key in target ? target[key] : noop });
  const makeCanvas = () => ({
    ...makeElement("canvas"), width: 1, height: 1,
    getContext() { context.canvas = this; return context; },
  });
  globalThis.document = {
    body: makeElement("body"), fonts: null,
    createElement(tag) { return tag === "canvas" ? makeCanvas() : makeElement(tag); },
    createElementNS(_namespace, tag) { return this.createElement(tag); },
  };
  globalThis.window = {
    location: { search: "?lite", href: "http://headless.invalid/?lite" },
    addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1,
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  globalThis.Image = class HeadlessImage {
    addEventListener(type, callback) { if (type === "error") queueMicrotask(callback); }
    removeEventListener() {}
    set src(_value) { queueMicrotask(() => this.onerror?.(new Error("headless image"))); }
  };
  const NativeRequest = globalThis.Request;
  globalThis.Request = class HeadlessRequest extends NativeRequest {
    constructor(input, init) {
      super(typeof input === "string" && input.startsWith("/")
        ? `http://headless.invalid${input}` : input, init);
    }
  };
  globalThis.fetch = async () => new Response("", { status: 404 });
}

const held = ["jumpHeld", "grindHeld", "spinHeld", "grabHeld", "transferHeld"];
const edges = ["jumpPressed", "jumpReleased", "grindPressed", "spinPressed", "grabPressed", "restartPressed", "transferPressed"];
function makeInput(overrides = {}) {
  const input = { moveX: 0, moveY: 0 };
  for (const key of [...held, ...edges]) input[key] = false;
  Object.assign(input, overrides);
  input.consumeEdges = () => { for (const key of edges) input[key] = false; };
  return input;
}

function levelData(kinds, crateY = 0, checkpoint = false) {
  return {
    v: 1,
    name: "Life and multi-hit crate fixture",
    spawn: [6, 0.1, 6],
    killY: -30,
    components: [
      { t: "platform", p: [0, -0.5, 0], s: [24, 1, 24] },
      ...kinds.map((kind, index) => ({ t: "crate", p: [index * 3, crateY, 0], kind })),
      ...(checkpoint ? [{ t: "checkpoint", p: [6, 0, 0] }] : []),
      { t: "gate", p: [0, 0, -9] },
      { t: "clock", p: [2, 0, 7] },
      { t: "comboorb", p: [-2, 0, 7] },
    ],
    groups: [],
  };
}

function activeFruit(player) {
  return player.fruits.filter((fruit) => fruit.phase !== "off").length;
}

installHeadlessDom();
const server = await createServer({ logLevel: "silent", server: { middlewareMode: true } });
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ""));
console.warn = (...args) => { if (!expectedAssetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!expectedAssetLog(args[0])) originalError(...args); };

const fixtures = [];
try {
  const { Level, normalizeCustomLevelData, setEditorBuild } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");
  const { SPECIAL_POINTS_TO_FULL } = await server.ssrLoadModule("/src/specialTricks.ts");

  const editorSource = await readFile(path.join(ROOT, "src/editor.ts"), "utf8");
  const levelSource = await readFile(path.join(ROOT, "src/level.ts"), "utf8");
  assert.match(editorSource, /kind:\s*"life"/);
  assert.match(editorSource, /kind:\s*"multihit"/);
  assert.match(editorSource, /const CRATE_KINDS[\s\S]*"life"[\s\S]*"multihit"/);
  assert.match(
    levelSource,
    /const wasAlive = c\.alive;[\s\S]{0,180}this\.breakCrate\(c\);[\s\S]{0,500}this\.blastBroken\.push\(c\)/,
    "boulder force-smashes must enter the player tally/reward drain",
  );

  const both = levelData(["life", "multihit"]);
  const normalized = normalizeCustomLevelData(both);
  assert.ok(normalized, "normalizer rejected the two new crate kinds");
  const invalid = structuredClone(both);
  invalid.components.find((component) => component.t === "crate").kind = "not-a-crate";
  assert.equal(normalizeCustomLevelData(invalid), null, "normalizer accepted an unknown crate kind");

  setEditorBuild(true);
  const editorLevel = new Level(new THREE.Scene(), { id: "crate-editor", name: both.name, data: structuredClone(normalized) });
  fixtures.push(editorLevel);
  assert.equal(editorLevel.crates[0].life, true);
  assert.equal(editorLevel.crates[1].multiHit, true);
  assert.deepEqual(editorLevel.captureData(), normalized);
  editorLevel.hitMultiCrate(editorLevel.crates[1]);
  const editedCapture = editorLevel.captureData();
  assert.deepEqual(editedCapture.components.filter((c) => c.t === "crate").map((c) => c.kind), ["life", "multihit"]);
  assert.equal(JSON.stringify(editedCapture).includes("hitsRemaining"), false, "runtime hit progress leaked into level JSON");
  setEditorBuild(false);

  const create = (kind, options = {}) => {
    const scene = new THREE.Scene();
    const data = levelData([kind], options.crateY ?? 0, options.checkpoint ?? false);
    const level = new Level(scene, { id: `crate-${kind}`, name: data.name, data });
    const player = new Player(scene);
    player.respawn(level, true);
    player.rawInput = makeInput();
    fixtures.push(level);
    return { level, player, crate: level.crates[0] };
  };

  // Life crates: exactly one life, never fruit; no life economy in endless or run modes.
  for (const mode of ["normal", "endless", "time", "combo"]) {
    const f = create("life");
    if (mode === "endless") f.player.endlessDeaths = true;
    if (mode === "time") { f.level.setTimeTrial(true); f.player.ttActive = true; }
    if (mode === "combo") { f.level.setComboRun(true); f.player.comboRun = true; }
    const before = f.player.lives;
    f.player.smashCrate(f.level, f.crate);
    assert.equal(f.player.lives, before + (mode === "normal" ? 1 : 0), `${mode} life reward`);
    assert.equal(activeFruit(f.player), 0, `${mode} life crate emitted fruit`);
  }

  // The third mask owns a temporary full/ready SPECIAL override without
  // minting permanent progress underneath it.
  const maskData = levelData(["mask", "mask", "mask"]);
  const maskLevel = new Level(new THREE.Scene(), {
    id: "triple-mask-special",
    name: maskData.name,
    data: maskData,
  });
  const maskPlayer = new Player(maskLevel.scene);
  maskPlayer.respawn(maskLevel, true);
  fixtures.push(maskLevel);
  maskPlayer.special.award(SPECIAL_POINTS_TO_FULL / 2);
  for (const crate of maskLevel.crates) maskPlayer.smashCrate(maskLevel, crate);
  assert.equal(maskPlayer.masks, 2, "third mask did not preserve the two banked masks");
  assert.ok(maskPlayer.uberTimer > 0, "third mask did not start uber time");
  assert.equal(maskPlayer.specialMeter, 100, "triple mask did not force a full meter");
  assert.equal(maskPlayer.specialReady, true, "triple mask did not authorize SPECIAL tricks");
  assert.equal(maskPlayer.special.value, 50, "triple mask mutated earned SPECIAL progress");
  maskPlayer.uberTimer = 0;
  assert.equal(maskPlayer.specialMeter, 50, "uber expiry did not reveal earned progress");
  assert.equal(maskPlayer.specialReady, false, "uber expiry permanently armed SPECIAL");

  const fruitEvent = create("life").player;
  fruitEvent.fruit = 99;
  fruitEvent.collectFruit();
  assert.equal(fruitEvent.fruit, 0, "100th fruit did not roll its purse over");
  assert.equal(fruitEvent.fruitCollectionRevision, 1, "rollover fruit missed its HUD event");
  fruitEvent.endlessDeaths = true;
  fruitEvent.collectFruit();
  assert.equal(fruitEvent.fruit, 0, "endless-mode fruit unexpectedly entered a purse");
  assert.equal(fruitEvent.fruitCollectionRevision, 2, "endless fruit missed its HUD event");

  const prepareStomp = (player) => {
    player.state = "air"; player.grounded = false; player.spinTimer = 0;
    player.slamActive = false; player.freeSkate = false; player.speed = 0;
    player.prevPos.set(0, 1.1, 0); player.pos.set(0, 0.9, 0); player.vVel = -10;
  };
  const stomp = create("multihit");
  for (let hit = 1; hit <= 5; hit++) {
    prepareStomp(stomp.player);
    stomp.player.collide(stomp.level);
    assert.equal(activeFruit(stomp.player), hit * 2, `stomp ${hit} did not pay two fruit`);
    assert.equal(stomp.crate.alive, hit < 5, `stomp ${hit} alive state`);
    assert.equal(stomp.player.cratesBroken, hit === 5 ? 1 : 0, `stomp ${hit} crate tally`);
  }

  const prepareBonk = (player) => {
    player.state = "air"; player.grounded = false; player.spinTimer = 0;
    player.slamActive = false; player.freeSkate = false; player.speed = 0;
    player.prevPos.set(0, 1.9, 0); player.pos.set(0, 2.15, 0); player.vVel = 10;
  };
  const bonk = create("multihit", { crateY: 3 });
  prepareBonk(bonk.player);
  bonk.player.collide(bonk.level);
  assert.equal(bonk.crate.hitsRemaining, 4);
  assert.equal(activeFruit(bonk.player), 2);
  bonk.player.collide(bonk.level); // same overlap on the next fixed tick is not a new head-bump
  assert.equal(bonk.crate.hitsRemaining, 4, "one bonk repeated across fixed ticks");
  assert.equal(activeFruit(bonk.player), 2, "repeated bonk paid fruit twice");
  for (let hit = 2; hit <= 5; hit++) {
    prepareBonk(bonk.player);
    bonk.player.collide(bonk.level);
  }
  assert.equal(bonk.crate.alive, false);
  assert.equal(bonk.player.cratesBroken, 1);
  assert.equal(activeFruit(bonk.player), 10, "five bonks must pay ten fruit total");

  // Force-smash routes bypass the hit budget and pay exactly one fruit.
  const spin = create("multihit");
  spin.player.state = "ride"; spin.player.grounded = true; spin.player.spinTimer = 0.2;
  spin.player.prevPos.set(0, 0.02, 1.2); spin.player.pos.set(0, 0.02, 0.8);
  spin.player.collide(spin.level);
  assert.equal(spin.crate.alive, false); assert.equal(activeFruit(spin.player), 1);

  const slam = create("multihit");
  slam.player.pos.set(0, 0, 0); slam.player.slamActive = true;
  slam.player.slamImpact(slam.level);
  assert.equal(slam.crate.alive, false); assert.equal(activeFruit(slam.player), 1);

  const skate = create("multihit");
  skate.player.state = "ride"; skate.player.grounded = true; skate.player.freeSkate = true;
  skate.player.speed = TUNING.smashSpeed; skate.player.spinTimer = 0;
  skate.player.prevPos.set(0, 0.02, 1.2); skate.player.pos.set(0, 0.02, 0.8);
  skate.player.collide(skate.level);
  assert.equal(skate.crate.alive, false); assert.equal(activeFruit(skate.player), 1);

  const blast = create("multihit");
  blast.player.pos.set(6, 0.1, 6); blast.player.prevPos.copy(blast.player.pos);
  blast.level.explosions.push({ center: blast.crate.mesh.position.clone(), t: 0, radius: 3, safe: true });
  blast.level.update(CONST.fixedStep);
  blast.player.step(CONST.fixedStep, makeInput(), blast.level);
  assert.equal(blast.crate.alive, false); assert.equal(blast.player.cratesBroken, 1);
  assert.equal(activeFruit(blast.player), 1, "blast-smash must pay exactly one fruit");

  const checkpoint = create("multihit", { checkpoint: true });
  checkpoint.level.hitMultiCrate(checkpoint.crate);
  checkpoint.level.hitMultiCrate(checkpoint.crate);
  checkpoint.level.activateCheckpoint(checkpoint.level.checkpoints[0], 0, 0, 0, 0);
  checkpoint.level.hitMultiCrate(checkpoint.crate);
  checkpoint.level.hitMultiCrate(checkpoint.crate);
  assert.equal(checkpoint.crate.hitsRemaining, 1);
  checkpoint.level.reset(false);
  assert.equal(checkpoint.crate.hitsRemaining, 3, "soft reset lost checkpointed hit progress");
  checkpoint.level.reset(true);
  assert.equal(checkpoint.crate.hitsRemaining, 5, "hard reset did not restore five hits");

  console.log("Validated life/multi-hit crates, triple-mask SPECIAL, fruit HUD events, rewards, contacts, checkpoints, and capture.");
} finally {
  // Async fallback asset loaders report their expected failures just after
  // construction. Keep the filter installed until those microtasks/timers
  // have drained so the test exits quietly and deterministically.
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  for (const level of fixtures) level.dispose();
  await server.close();
}
