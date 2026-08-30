import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as THREE from "three";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path) => readFile(`${root}${path}`, "utf8");

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
assert.equal(defaults.ringCount, 6);
assert.equal(defaults.segmentCount, 22);
assert.equal(defaults.seed, 62);
assert.equal(defaults.selfSpinRadiansPerSecond, 7.508416652679443);
assert.equal(defaults.ringOverrides[0].lineColorA, 0xfff4a9);
assert.equal(defaults.ringOverrides[5].radiusScale, 0.5);
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

const routingApi = compileCommonJs(await text("src/spin-effects/routing.ts"));
const freshRoute = () => routingApi.createSpinPresentationRouteState();
const advanceRoute = (state, step, active, boardAttached, reset = false) =>
  routingApi.advanceSpinPresentationRoute(
    state,
    { step, active, boardAttached, reset },
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
routeFrame = advanceRoute(routeFrame.state, 45, false, false, true);
assert.equal(routeFrame.state.route, "none");
assert.equal(routeFrame.characterActive, false);
assert.equal(routeFrame.characterLingering, false);

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
const main = await text("src/main.ts");
const index = await text("index.html");
assert.match(player, /new SpinEffectsPresentation/);
assert.match(player, /boardAttached: this\.boardG\?\.visible \?\? false/);
assert.doesNotMatch(player, /presentationRoute === ['"]board['"]/);
assert.match(player, /runTime \* 60/);
assert.doesNotMatch(player, /installSmear/);
assert.match(presentation, /boardRingsVisible: false/);
assert.match(presentation, /advanceSpinPresentationRoute/);
assert.doesNotMatch(presentation, /new SpinOrbitalRings\([\s\S]*localBoundsForBoard/);
assert.doesNotMatch(presentation, /BoardTrickOrbitalRings|BoardTrickRingAnchor/);
assert.match(main, /createSpinTuningPanel/);
assert.match(main, /getSpinEffectDiagnostics/);
assert.match(index, /spin\/whirlwind-vixen\.glb/);
assert.doesNotMatch(index, /preload[^\n]+models\/smear\.glb/);
assert.match(await text("spin-lab.html"), /src\/spin-effects\/lab\.ts/);

console.log(
  "Validated Unity spin defaults, hash/geometry math, 660-vertex additive rings, production sculpture assets, player routing, panel, and lab entry.",
);
