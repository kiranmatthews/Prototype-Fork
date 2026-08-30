import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as THREE from "three";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path) => readFile(`${root}${path}`, "utf8");
const stored = new Map();
globalThis.localStorage = {
  getItem: (key) => stored.get(String(key)) ?? null,
  setItem: (key, value) => stored.set(String(key), String(value)),
  removeItem: (key) => stored.delete(String(key)),
  clear: () => stored.clear(),
  key: (index) => [...stored.keys()][index] ?? null,
  get length() { return stored.size; },
};

function compileCommonJs(source, requireFunction = () => undefined) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    requireFunction,
  );
  return module.exports;
}

const settingsApi = compileCommonJs(await text("src/spin-effects/settings.ts"));
const defaults = settingsApi.DEFAULT_SPIN_RING_SETTINGS;
const groundedDefaults = settingsApi.DEFAULT_GROUNDED_SKATE_SPIN_RING_SETTINGS;
assert.equal(stored.size, 0, "constructing settings stores must not write storage");
assert.equal(defaults.ringCount, 6);
assert.equal(defaults.segmentCount, 22);
assert.equal(defaults.seed, 62);
assert.equal(defaults.selfSpinRadiansPerSecond, 7.508416652679443);
assert.equal(defaults.ringOverrides[0].lineColorA, 0xfff4a9);
assert.equal(defaults.ringOverrides[5].radiusScale, 0.5);
assert.equal(groundedDefaults.ringCount, 2);
assert.equal(groundedDefaults.segmentCount, 22);
assert.equal(groundedDefaults.seed, 62);
assert.equal(groundedDefaults.minimumTiltDegrees, 1.63);
assert.equal(groundedDefaults.maximumTiltDegrees, 7.99);
assert.equal(groundedDefaults.ringOverrides[0].heightOffset, -0.047);
assert.equal(groundedDefaults.ringOverrides[0].radiusScale, 0.7150872945785522);
assert.equal(groundedDefaults.ringOverrides[1].heightOffset, -0.188);
assert.equal(groundedDefaults.ringOverrides[1].radiusScale, 1.011);
assert.equal(groundedDefaults.ringOverrides[1].lineColorA, 0xffffff);
assert.notStrictEqual(
  groundedDefaults.ringOverrides,
  defaults.ringOverrides,
  "grounded skate overrides must not alias character tuning",
);
assert.notEqual(
  settingsApi.GROUNDED_SKATE_SPIN_RING_STORAGE_KEY,
  settingsApi.SPIN_RING_STORAGE_KEY,
);
const isolatedFoot = new settingsApi.SpinRingSettings({
  storageKey: "test.spin.foot",
  defaults,
});
const isolatedGround = new settingsApi.SpinRingSettings({
  storageKey: "test.spin.ground",
  defaults: groundedDefaults,
});
const footBeforeGroundEdit = isolatedFoot.serialize(false);
isolatedGround.patch({ ringCount: 5 });
assert.equal(isolatedGround.value.ringCount, 5);
assert.equal(isolatedFoot.serialize(false), footBeforeGroundEdit);
assert.ok(stored.has("test.spin.ground"));
assert.equal(stored.has("test.spin.foot"), false);
isolatedGround.reset();
assert.equal(isolatedGround.value.ringCount, 2);
const post = settingsApi.createPostSpinRingSettings(defaults);
assert.equal(post.current, 1.188);
assert.equal(post.currentRate, 16);
assert.equal(post.pulse, 0.892);
assert.equal(post.alpha, 1);

const ringsApi = compileCommonJs(
  await text("src/spin-effects/rings.ts"),
  (specifier) => {
    if (specifier === "three") return THREE;
    if (specifier === "./settings") return settingsApi;
    throw new Error(`unexpected rings import: ${specifier}`);
  },
);
const rings = new ringsApi.SpinOrbitalRings(defaults);
assert.deepEqual(rings.geometryStats, {
  rings: 6,
  segments: 22,
  vertices: 660,
  triangles: 1056,
  uploads: 1,
});
rings.applyStep(17);
assert.equal(rings.geometryStats.uploads, 2);
const positions = rings.mesh.geometry.getAttribute("position").array;
const colors = rings.mesh.geometry.getAttribute("color").array;
assert.ok([...positions].every(Number.isFinite));
assert.ok([...colors].every(Number.isFinite));
assert.ok(Math.max(...colors) > 1, "HDR ring vertex colors must exceed one");
const azimuths = [240.43, 186.614, 350.48, 88.215, 112.617, 102.545];
for (let ring = 0; ring < azimuths.length; ring++) {
  const actual = ringsApi.spinRingHash(62, ring, 14) * 360;
  assert.ok(Math.abs(actual - azimuths[ring]) < 0.001, `${ring}: ${actual}`);
}
const groundedRings = new ringsApi.SpinOrbitalRings(groundedDefaults);
assert.deepEqual(groundedRings.geometryStats, {
  rings: 2,
  segments: 22,
  vertices: 220,
  triangles: 352,
  uploads: 1,
});
assert.notStrictEqual(groundedRings, rings);
assert.notStrictEqual(groundedRings.mesh.geometry, rings.mesh.geometry);
assert.notStrictEqual(groundedRings.mesh.material, rings.mesh.material);

const routingApi = compileCommonJs(await text("src/spin-effects/routing.ts"));
const eligible = routingApi.groundedSkateSpinEligible;
assert.equal(eligible({ active: true, movementState: "ride", grounded: true, freeSkate: true, boardVisible: true }), true);
for (const sample of [
  { active: false, movementState: "ride", grounded: true, freeSkate: true, boardVisible: true },
  { active: true, movementState: "air", grounded: false, freeSkate: true, boardVisible: true },
  { active: true, movementState: "grind", grounded: false, freeSkate: true, boardVisible: true },
  { active: true, movementState: "ride", grounded: false, freeSkate: true, boardVisible: true },
  { active: true, movementState: "ride", grounded: true, freeSkate: false, boardVisible: true },
  { active: true, movementState: "ride", grounded: true, freeSkate: true, boardVisible: false },
]) assert.equal(eligible(sample), false);
const freshRoute = () => routingApi.createSpinPresentationRouteState();
const advanceRoute = (
  state,
  step,
  active,
  boardAttached,
  groundedSkate = false,
  reset = false,
) =>
  routingApi.advanceSpinPresentationRoute(
    state,
    { step, active, boardAttached, groundedSkate, reset },
    15,
  );

let routeFrame = advanceRoute(freshRoute(), 0, true, false);
assert.equal(routeFrame.state.route, "character");
assert.equal(routeFrame.characterActive, true);
assert.equal(routeFrame.characterLingering, false);
routeFrame = advanceRoute(routeFrame.state, 1, false, false);
assert.equal(routeFrame.characterLingering, true);
for (let step = 2; step <= 15; step++)
  routeFrame = advanceRoute(routeFrame.state, step, false, false);
assert.equal(routeFrame.characterLingering, true, "character rings linger through tick 14");
routeFrame = advanceRoute(routeFrame.state, 16, false, false);
assert.equal(routeFrame.characterLingering, false, "character rings hide at tick 15");

routeFrame = advanceRoute(freshRoute(), 20, true, true);
assert.equal(routeFrame.state.route, "board");
assert.equal(routeFrame.characterActive, false);
assert.equal(routeFrame.characterLingering, false);
routeFrame = advanceRoute(routeFrame.state, 21, false, true);
assert.equal(routeFrame.characterLingering, false, "board routes never create a ring linger");

routeFrame = advanceRoute(freshRoute(), 30, true, false);
routeFrame = advanceRoute(routeFrame.state, 31, true, true);
assert.equal(routeFrame.state.route, "board");
assert.equal(routeFrame.characterActive, false, "mounting cancels an active character effect");
routeFrame = advanceRoute(routeFrame.state, 32, true, false);
assert.equal(routeFrame.state.route, "board", "dismount cannot restore a cancelled effect");

routeFrame = advanceRoute(freshRoute(), 40, true, false);
routeFrame = advanceRoute(routeFrame.state, 41, false, false);
assert.equal(routeFrame.characterLingering, true);
routeFrame = advanceRoute(routeFrame.state, 42, false, true);
assert.equal(routeFrame.state.route, "board");
assert.equal(routeFrame.characterLingering, false, "mounting cancels ring handoff immediately");
routeFrame = advanceRoute(routeFrame.state, 43, false, false);
assert.equal(routeFrame.characterLingering, false, "dismount cannot restore ring handoff");
routeFrame = advanceRoute(routeFrame.state, 44, true, false);
assert.equal(routeFrame.state.route, "character", "a later foot spin starts normally");
routeFrame = advanceRoute(routeFrame.state, 45, false, false, false, true);
assert.equal(routeFrame.state.route, "none");
assert.equal(routeFrame.characterActive, false);
assert.equal(routeFrame.characterLingering, false);

routeFrame = advanceRoute(freshRoute(), 50, true, true, true);
assert.equal(routeFrame.state.route, "grounded-skate");
assert.equal(routeFrame.groundedSkateActive, true);
assert.equal(routeFrame.characterActive, false);
routeFrame = advanceRoute(routeFrame.state, 51, true, true, false);
assert.equal(routeFrame.state.route, "board", "leaving ground cancels this attack's rings");
assert.equal(routeFrame.groundedSkateActive, false);
routeFrame = advanceRoute(routeFrame.state, 52, true, true, true);
assert.equal(routeFrame.state.route, "board", "landing cannot restore ground rings");
routeFrame = advanceRoute(routeFrame.state, 53, false, true, true);
routeFrame = advanceRoute(routeFrame.state, 54, true, true, true);
assert.equal(routeFrame.state.route, "grounded-skate", "a fresh ground spin re-arms rings");

routeFrame = advanceRoute(freshRoute(), 60, true, true, false);
assert.equal(routeFrame.state.route, "board", "board air remains effect-free");
routeFrame = advanceRoute(routeFrame.state, 61, true, true, true);
assert.equal(routeFrame.state.route, "board", "air-started spin cannot flash on landing");

const modelBytes = await readFile(`${root}public/spin/whirlwind-vixen.glb`);
assert.equal(
  createHash("sha256").update(modelBytes).digest("hex"),
  "9ce1697301045b5e307a30a2624116f2372a007afe4b81196fac2aafd9f2bf26",
);
assert.equal(modelBytes.toString("ascii", 0, 4), "glTF");
const jsonLength = modelBytes.readUInt32LE(12);
const json = JSON.parse(modelBytes.toString("utf8", 20, 20 + jsonLength));
assert.equal(json.accessors[0].count, 64196);
assert.equal(json.accessors[2].count, 274590);
assert.deepEqual(json.accessors[0].min, [
  -0.7534340023994446,
  -0.9545801281929016,
  -0.5384699702262878,
]);
assert.deepEqual(json.accessors[0].max, [
  0.7524750232696533,
  0.9487830996513367,
  0.5768750309944153,
]);
const textureBytes = await readFile(`${root}public/spin/whirlwind-vixen.webp`);
assert.equal(
  createHash("sha256").update(textureBytes).digest("hex"),
  "892d93031e384699b315ef759fa18d7c5f5d9b65c66e302baff0f0dc9f1ae17f",
);

const player = await text("src/player.ts");
const presentation = await text("src/spin-effects/presentation.ts");
const panelSource = await text("src/spin-effects/panel.ts");
const labSource = await text("src/spin-effects/lab.ts");
const main = await text("src/main.ts");
const index = await text("index.html");
assert.match(player, /new SpinEffectsPresentation/);
assert.match(player, /const boardAttached = this\.boardG\?\.visible \?\? false/);
const groundedPlayerRoute = player.slice(
  player.indexOf("const groundedSkate = groundedSkateSpinEligible"),
  player.indexOf("this.spinEffects.update", player.indexOf("const groundedSkate =")),
);
assert.match(groundedPlayerRoute, /movementState: this\.state/);
assert.match(groundedPlayerRoute, /grounded: this\.grounded/);
assert.match(groundedPlayerRoute, /freeSkate: this\.freeSkate/);
assert.match(groundedPlayerRoute, /boardVisible: boardAttached/);
assert.doesNotMatch(groundedPlayerRoute, /!this\.charging/);
assert.doesNotMatch(player, /presentationRoute === ['"]board['"]/);
assert.match(player, /runTime \* 60/);
assert.doesNotMatch(player, /installSmear/);
assert.match(presentation, /GroundedSkateSpinOrbitalRings_Additive_Web/);
assert.match(presentation, /groundedSkateRingsVisible/);
assert.match(presentation, /DEFAULT_GROUNDED_SKATE_SPIN_BOUNDS/);
assert.match(presentation, /advanceSpinPresentationRoute/);
assert.doesNotMatch(presentation, /localBoundsForBoard|BoardTrickRingAnchor/);
assert.match(main, /createSpinTuningPanel/);
assert.match(main, /groundedSkateSettings: groundedSkateSpinRingSettings/);
assert.match(main, /getSpinEffectDiagnostics/);
assert.match(panelSource, /role", "tablist/);
assert.match(panelSource, /CHARACTER SPIN/);
assert.match(panelSource, /GROUND SKATE/);
assert.match(panelSource, /this\.activeSettings\.patch/);
assert.match(panelSource, /grounded-skate-spin-ring-tuning\.json/);
assert.match(labSource, /GroundedSkateSpin_PersistentPreview/);
assert.match(labSource, /GroundedSkateSpin_LoopingPreview/);
assert.match(labSource, /BOARD AIR · NO SPIN HALO/);
assert.match(labSource, /groundedProduction/);
assert.match(labSource, /groundedSettings: groundedSkateSpinRingSettings/);
assert.match(index, /spin\/whirlwind-vixen\.glb/);
assert.doesNotMatch(index, /preload[^\n]+models\/smear\.glb/);
assert.match(await text("spin-lab.html"), /src\/spin-effects\/lab\.ts/);

console.log(
  "Validated character and grounded-skate spin defaults, independent settings/topology, latched routes, production presentation, panel tabs, and lab instances.",
);
