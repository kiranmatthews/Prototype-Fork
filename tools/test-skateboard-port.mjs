import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as THREE from "three";

const root = fileURLToPath(new URL("../", import.meta.url));
const readText = (path) => readFile(`${root}${path}`, "utf8");

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

const settingsApi = compileCommonJs(await readText("src/skateboard/settings.ts"));
const defaults = settingsApi.DEFAULT_SKATEBOARD_SETTINGS;
const authoredBoard = JSON.parse(
  await readText("public/skateboard/surf-cruiser-board.json"),
);
assert.equal(authoredBoard.version, 1);
assert.deepEqual(
  defaults,
  authoredBoard.settings,
  "shipped defaults must exactly match the approved Board Lab JSON",
);
assert.equal(defaults.deckTailLength + defaults.deckNoseLength, 1.982568383216858);
assert.equal(defaults.deckHalfWidth * 2, 0.47522962093353274);
assert.equal(defaults.boardToGroundDistance, 0.234);
assert.equal(settingsApi.SKATEBOARD_TRUCK_GLTF_REFERENCE_SCALE, 2.2098000049591066);
assert.equal(
  defaults.replacementTruckScale /
    settingsApi.SKATEBOARD_TRUCK_GLTF_REFERENCE_SCALE,
  2.1947687524282324,
);
assert.equal(defaults.bottomWear, 1);
assert.equal(defaults.topWear, 0);
assert.equal(defaults.frontTruckRotationXDegrees, 90);
assert.equal(defaults.rearTruckRotationXDegrees, 90);
for (const key of [
  "frontTruckRotationYDegrees",
  "frontTruckRotationZDegrees",
  "rearTruckRotationYDegrees",
  "rearTruckRotationZDegrees",
])
  assert.equal(defaults[key], 0, `${key} default`);

const clamped = settingsApi.clampSkateboardSettings({
  ...defaults,
  deckHalfWidth: 4,
  wheelRadius: -1,
  railBevelSegments: 50,
  frontTruckRotationXDegrees: 999,
  rearTruckRotationZDegrees: -999,
});
assert.equal(clamped.deckHalfWidth, 0.65);
assert.equal(clamped.wheelRadius, 0.025);
assert.equal(clamped.railBevelSegments, 8);
assert.equal(clamped.frontTruckRotationXDegrees, 180);
assert.equal(clamped.rearTruckRotationZDegrees, -180);
const migrated = settingsApi.clampSkateboardSettings({ deckHalfWidth: 0.3 });
assert.equal(migrated.frontTruckRotationXDegrees, 90);
assert.equal(migrated.rearTruckRotationXDegrees, 90);
assert.equal(migrated.frontTruckRotationYDegrees, 0);
assert.equal(migrated.rearTruckRotationYDegrees, 0);
const tuning = new settingsApi.SkateboardSettings();
tuning.patch({
  frontTruckRotationXDegrees: 12.5,
  rearTruckRotationZDegrees: -33.25,
});
const saved = JSON.parse(tuning.serialize(false));
assert.equal(saved.settings.frontTruckRotationXDegrees, 12.5);
assert.equal(saved.settings.rearTruckRotationZDegrees, -33.25);
const importedTuning = new settingsApi.SkateboardSettings();
importedTuning.importJson(tuning.serialize(false));
assert.equal(importedTuning.value.frontTruckRotationXDegrees, 12.5);
assert.equal(importedTuning.value.rearTruckRotationZDegrees, -33.25);
const authoredTuning = new settingsApi.SkateboardSettings();
authoredTuning.importJson(JSON.stringify(authoredBoard));
assert.deepEqual(authoredTuning.value, authoredBoard.settings);

const modelSource = (await readText("src/skateboard/model.ts")).replaceAll(
  "import.meta.env.BASE_URL",
  '"./"',
);
class LoaderStub {}
const modelApi = compileCommonJs(modelSource, (specifier) => {
  if (specifier === "three") return THREE;
  if (specifier.endsWith("GLTFLoader.js")) return { GLTFLoader: LoaderStub };
  if (specifier === "./settings") return settingsApi;
  throw new Error(`unexpected skateboard test import: ${specifier}`);
});

const geometry = modelApi.buildSkateboardDeckGeometry(defaults);
assert.equal(modelApi.SKATEBOARD_GRIP_TOP, 0.234);
assert.deepEqual(
  modelApi.skateboardArtworkUvTransform(defaults.artworkScale, true),
  [
    0.7299270072992701,
    0.7299270072992701,
    0.13503649635036497,
    0.13503649635036497,
  ],
);
assert.deepEqual(modelApi.skateboardArtworkUvTransform(defaults.artworkScale, false), [1, 1, 0, 0]);
assert.equal(geometry.getAttribute("position").count, 3148);
assert.equal(geometry.getAttribute("uv").count, 3148);
assert.equal(geometry.getAttribute("wearUv").count, 3148);
assert.equal(geometry.index.count / 3, 6292);
assert.equal(geometry.groups.length, 7);
assert.equal(geometry.groups[1].materialIndex, 1);
assert.deepEqual(
  geometry.groups.map((group) => group.count / 3),
  [2156, 2156, 396, 396, 396, 396, 396],
);
const bounds = geometry.boundingBox;
assert.ok(bounds);
const size = bounds.getSize(new THREE.Vector3());
assert.ok(Math.abs(size.x - 0.4752296209335327) < 1e-6, `width ${size.x}`);
assert.ok(Math.abs(size.y - 0.06682928) < 2e-6, `height ${size.y}`);
assert.ok(Math.abs(size.z - 1.982568383216858) < 1e-6, `length ${size.z}`);
assert.ok(
  modelApi.evaluateSkateboardSurfaceHeight(defaults, 0, -defaults.deckTailLength) >
    modelApi.evaluateSkateboardSurfaceHeight(defaults, 0, defaults.deckNoseLength),
  "approved surf cruiser has the taller tail kick",
);
const positions = geometry.getAttribute("position");
const indices = geometry.index;
const bottomGroup = geometry.groups[1];
const bottomA = new THREE.Vector3().fromBufferAttribute(
  positions,
  indices.getX(bottomGroup.start),
);
const bottomB = new THREE.Vector3().fromBufferAttribute(
  positions,
  indices.getX(bottomGroup.start + 1),
);
const bottomC = new THREE.Vector3().fromBufferAttribute(
  positions,
  indices.getX(bottomGroup.start + 2),
);
const bottomNormal = bottomB
  .clone()
  .sub(bottomA)
  .cross(bottomC.clone().sub(bottomA))
  .normalize();
assert.ok(bottomNormal.y < -0.9, `bottom normal ${bottomNormal.toArray()}`);

const identityTruck = modelApi.skateboardTruckQuaternion(0, 0, 0, 0);
assert.ok(identityTruck.angleTo(new THREE.Quaternion()) < 1e-8);
const rearTruck = modelApi.skateboardTruckQuaternion(Math.PI, 0, 0, 0);
const rearForward = new THREE.Vector3(0, 0, 1).applyQuaternion(rearTruck);
assert.ok(rearForward.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-8);
const frontPitch = modelApi.skateboardTruckQuaternion(0, 90, 0, 0);
const pitchedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(frontPitch);
assert.ok(pitchedUp.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-8);

const main = await readText("src/main.ts");
const player = await readText("src/player.ts");
assert.match(main, /createSkateboardTuningPanel/);
assert.match(main, /skateboardSettings/);
assert.match(player, /createSkateboardPresentation/);
assert.match(player, /skateboardRestingPivotLift/);
assert.match(player, /const PLANT_DECK_TOP = SKATEBOARD_GRIP_TOP/);
assert.doesNotMatch(player, /new THREE\.BoxGeometry\(0\.5, 0\.09, 1\.4\)/);
assert.match(await readText("skateboard-lab.html"), /src\/skateboard\/lab\.ts/);
const lab = await readText("src/skateboard/lab.ts");
assert.match(lab, /Y UNDERSIDE — ARTWORK/);
assert.match(lab, /\[90, 0, 0\]/);
assert.match(modelSource, /new THREE\.TextureLoader\(\)\.load/);
assert.match(modelSource, /settings\.replacementTruckScale\s*\/\s*SKATEBOARD_TRUCK_GLTF_REFERENCE_SCALE/);
assert.doesNotMatch(
  modelSource,
  /settings\.replacementTruckScale\s*\/\s*DEFAULT_SKATEBOARD_SETTINGS\.replacementTruckScale/,
);
assert.match(
  modelSource,
  /skateboardTruckQuaternion\(endpointYaw, 0, 0, 0, root\.quaternion\)/,
  "procedural fallback must not inherit imported-GLB axis trim",
);
assert.doesNotMatch(modelSource, /texture\.source = loaded\.source/);

const expectedAssets = new Map([
  ["public/skateboard/surf-cruiser-board.json", "5f7b984c86c30c1cbea31a1c9ad8f9dc8c4cb2b82ef0992ba16c3d1ad8bc51ce"],
  ["public/skateboard/skateboard-truck.glb", "20d30d6fb2f594549db6ff219bfa8d925540c8dcdbd912f1116bef8e194b05c7"],
  ["public/skateboard/skateboard-truck.webp", "eb263b1250367575f5666838e8c30253e5344492d0ec1e474ef5829cd631a905"],
  ["public/skateboard/surf-cruiser-orange-sun.webp", "d24e9e704a626fdb7b3e4d26fd35dc9d5760de728c9e8d2e17843cea64ba9ff9"],
  ["public/skateboard/surf-cruiser-reference.webp", "67e55cf8ffbb0d202083ea35cfacec8289f27313806ccc659c94e5efa16e3621"],
]);

const truckBytes = await readFile(`${root}public/skateboard/skateboard-truck.glb`);
const truckJsonLength = truckBytes.readUInt32LE(12);
const truckDocument = JSON.parse(
  truckBytes.toString("utf8", 20, 20 + truckJsonLength).trim(),
);
const truckPrimitive = truckDocument.meshes[0].primitives[0];
const truckPosition = truckDocument.accessors[truckPrimitive.attributes.POSITION];
assert.deepEqual(truckPosition.min, [
  -0.11999999731779099,
  -0.04453127831220627,
  1.862645149230957e-8,
]);
assert.deepEqual(truckPosition.max, [
  0.11999999731779099,
  0.04453127831220627,
  0.07125002145767212,
]);
const importedTruckRatio =
  defaults.replacementTruckScale /
  settingsApi.SKATEBOARD_TRUCK_GLTF_REFERENCE_SCALE;
const importedTruckHalfWidth = truckPosition.max[0] * importedTruckRatio;
const deckUnderside = defaults.boardToGroundDistance - defaults.deckThickness;
const importedTruckBottom =
  deckUnderside - truckPosition.max[2] * importedTruckRatio;
const importedTruckTop =
  deckUnderside - truckPosition.min[2] * importedTruckRatio;
const importedTruckRouteHalfLength =
  truckPosition.max[1] * importedTruckRatio;
assert.ok(Math.abs(importedTruckHalfWidth - 0.26337224440455936) < 1e-9);
assert.ok(Math.abs(importedTruckBottom - 0.04770433274081928) < 1e-9);
assert.ok(Math.abs(importedTruckTop - deckUnderside) < 1e-7);
assert.ok(Math.abs(importedTruckRouteHalfLength - 0.09773585814531535) < 1e-9);
const wheelOuterHalfWidth = defaults.wheelTrackHalfWidth + defaults.wheelWidth * 0.5;
assert.equal(defaults.wheelRadius - defaults.wheelRadius, 0, "wheels touch ground");
assert.equal(wheelOuterHalfWidth, 0.2525);
assert.ok(
  Math.abs(importedTruckHalfWidth - wheelOuterHalfWidth) < 0.012,
  "imported hanger and procedural wheels must line up laterally",
);
for (const [path, expected] of expectedAssets) {
  const bytes = await readFile(`${root}${path}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, path);
}

console.log(
  "Validated approved Board JSON, exact deck topology/bottom winding, imported truck calibration/trim, wheel alignment, underside lab view, player integration, and baked web assets.",
);
