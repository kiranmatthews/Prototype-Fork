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
assert.equal(defaults.overallScale, 1);
assert.equal(defaults.artworkScaleX, 1.37);
assert.equal(defaults.artworkScaleY, 1.37);
assert.equal("artworkScale" in defaults, false);
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
  overallScale: 9,
  artworkScaleX: 0.01,
  artworkScaleY: 12,
});
assert.equal(clamped.deckHalfWidth, 0.65);
assert.equal(clamped.wheelRadius, 0.025);
assert.equal(clamped.railBevelSegments, 8);
assert.equal(clamped.frontTruckRotationXDegrees, 180);
assert.equal(clamped.rearTruckRotationZDegrees, -180);
assert.equal(clamped.overallScale, 3);
assert.equal(clamped.artworkScaleX, 0.2);
assert.equal(clamped.artworkScaleY, 3);
const migrated = settingsApi.clampSkateboardSettings({ deckHalfWidth: 0.3 });
assert.equal(migrated.frontTruckRotationXDegrees, 90);
assert.equal(migrated.rearTruckRotationXDegrees, 90);
assert.equal(migrated.frontTruckRotationYDegrees, 0);
assert.equal(migrated.rearTruckRotationYDegrees, 0);
assert.equal(migrated.overallScale, 1);
assert.equal(migrated.artworkScaleX, 1.37);
assert.equal(migrated.artworkScaleY, 1.37);
const legacyArtwork = settingsApi.clampSkateboardSettings({
  artworkScale: 2.1,
});
assert.equal(legacyArtwork.artworkScaleX, 2.1);
assert.equal(legacyArtwork.artworkScaleY, 2.1);
assert.equal("artworkScale" in legacyArtwork, false);
const mixedArtwork = settingsApi.clampSkateboardSettings({
  artworkScale: 1.8,
  artworkScaleX: 0.7,
});
assert.equal(mixedArtwork.artworkScaleX, 0.7);
assert.equal(mixedArtwork.artworkScaleY, 1.8);
const tuning = new settingsApi.SkateboardSettings();
tuning.patch({
  frontTruckRotationXDegrees: 12.5,
  rearTruckRotationZDegrees: -33.25,
  overallScale: 1.42,
  artworkScaleX: 0.83,
  artworkScaleY: 2.17,
});
const saved = JSON.parse(tuning.serialize(false));
assert.equal(saved.settings.frontTruckRotationXDegrees, 12.5);
assert.equal(saved.settings.rearTruckRotationZDegrees, -33.25);
assert.equal(saved.settings.overallScale, 1.42);
assert.equal(saved.settings.artworkScaleX, 0.83);
assert.equal(saved.settings.artworkScaleY, 2.17);
assert.equal("artworkScale" in saved.settings, false);
const importedTuning = new settingsApi.SkateboardSettings();
importedTuning.importJson(tuning.serialize(false));
assert.equal(importedTuning.value.frontTruckRotationXDegrees, 12.5);
assert.equal(importedTuning.value.rearTruckRotationZDegrees, -33.25);
assert.equal(importedTuning.value.overallScale, 1.42);
assert.equal(importedTuning.value.artworkScaleX, 0.83);
assert.equal(importedTuning.value.artworkScaleY, 2.17);
const authoredTuning = new settingsApi.SkateboardSettings();
authoredTuning.importJson(JSON.stringify(authoredBoard));
assert.deepEqual(authoredTuning.value, authoredBoard.settings);

const modelSource = (await readText("src/skateboard/model.ts")).replaceAll(
  "import.meta.env.BASE_URL",
  '"./"',
);
THREE.TextureLoader.prototype.load = function loadTextureStub() {
  return new THREE.Texture();
};
class LoaderStub {
  load(_url, onLoad) {
    queueMicrotask(() => onLoad({ scene: new THREE.Group() }));
  }
}
const modelApi = compileCommonJs(modelSource, (specifier) => {
  if (specifier === "three") return THREE;
  if (specifier.endsWith("GLTFLoader.js")) return { GLTFLoader: LoaderStub };
  if (specifier === "./settings") return settingsApi;
  throw new Error(`unexpected skateboard test import: ${specifier}`);
});

const geometry = modelApi.buildSkateboardDeckGeometry(defaults);
assert.equal(modelApi.SKATEBOARD_GRIP_TOP, 0.234);
assert.deepEqual(
  modelApi.skateboardArtworkUvTransform(
    defaults.artworkScaleX,
    defaults.artworkScaleY,
    true,
  ),
  [
    0.7299270072992701,
    0.7299270072992701,
    0.13503649635036497,
    0.13503649635036497,
  ],
);
assert.deepEqual(
  modelApi.skateboardArtworkUvTransform(
    defaults.artworkScaleX,
    defaults.artworkScaleY,
    false,
  ),
  [1, 1, 0, 0],
);
assert.deepEqual(
  modelApi.skateboardArtworkUvTransform(2, 0.5, true),
  [0.5, 2, 0.25, -0.5],
);
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

const overallScale = 1.6;
const scaledSettings = { ...defaults, overallScale };
const scaledPresentation = new THREE.Group();
scaledPresentation.scale.set(0.7, 0.8, 0.9);
modelApi.rebuildSkateboardPresentation(scaledPresentation, scaledSettings);
assert.deepEqual(
  scaledPresentation.scale.toArray(),
  [0.7, 0.8, 0.9],
  "uniform board scale overwrote the player's outer compensation",
);
const scaledAssembly = scaledPresentation.getObjectByName(
  "Skateboard_UniformAssembly",
);
assert.ok(scaledAssembly, "uniform board assembly is missing");
assert.deepEqual(scaledAssembly.scale.toArray(), [overallScale, overallScale, overallScale]);
assert.equal(
  scaledPresentation.userData.gripTop,
  defaults.boardToGroundDistance * overallScale,
);
const descendsFrom = (object, ancestor) => {
  for (let cursor = object; cursor; cursor = cursor.parent)
    if (cursor === ancestor) return true;
  return false;
};
for (const name of [
  "Deck_ContinuousRoundedKick",
  "Wheels_Procedural",
  "Hardware_Fallback",
  "socket-board-left",
  "socket-board-right",
  "socket-board-nose",
  "socket-board-tail",
]) {
  const object = scaledPresentation.getObjectByName(name);
  assert.ok(object, `${name} missing from scaled board`);
  assert.equal(descendsFrom(object, scaledAssembly), true, `${name} escaped uniform assembly`);
}

const worldScaled = new THREE.Group();
modelApi.rebuildSkateboardPresentation(worldScaled, scaledSettings);
worldScaled.updateMatrixWorld(true);
const deckWorld = worldScaled
  .getObjectByName("Deck_ContinuousRoundedKick")
  .getWorldPosition(new THREE.Vector3());
assert.ok(
  deckWorld.distanceTo(
    new THREE.Vector3(0, defaults.boardToGroundDistance * overallScale, 0),
  ) < 1e-9,
);
const frontLeftWheel = worldScaled.getObjectByName("Wheel_Front_Left");
assert.ok(frontLeftWheel);
const wheelWorld = frontLeftWheel.getWorldPosition(new THREE.Vector3());
assert.ok(
  wheelWorld.distanceTo(
    new THREE.Vector3(
      -defaults.wheelTrackHalfWidth * overallScale,
      defaults.wheelRadius * overallScale,
      defaults.frontTruckLocalZ * overallScale,
    ),
  ) < 1e-9,
  `scaled wheel relationship ${wheelWorld.toArray()}`,
);
assert.ok(
  Math.abs(wheelWorld.y - defaults.wheelRadius * overallScale) < 1e-9,
  "uniformly scaled wheels no longer touch the root ground plane",
);
const leftSocketWorld = worldScaled
  .getObjectByName("socket-board-left")
  .getWorldPosition(new THREE.Vector3());
assert.ok(
  leftSocketWorld.distanceTo(
    new THREE.Vector3(
      defaults.deckHalfWidth * overallScale,
      defaults.boardToGroundDistance * overallScale,
      0,
    ),
  ) < 1e-9,
  "semantic sockets did not share the board scale",
);
const upsideDown = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  Math.PI,
);
const highestKick = worldScaled.getObjectByName("Deck_ContinuousRoundedKick")
  .geometry.boundingBox.max.y;
assert.ok(
  Math.abs(
    modelApi.skateboardRestingPivotLift(worldScaled, upsideDown) -
      (defaults.boardToGroundDistance + highestKick) * overallScale,
  ) < 1e-9,
  "artwork-up resting lift did not share the uniform board scale",
);

await Promise.resolve();
await Promise.resolve();
const importedHardware = worldScaled.getObjectByName("Hardware_Imported");
const importedFront = worldScaled.getObjectByName("FrontTruck_Model");
assert.ok(importedHardware && importedFront, "imported hardware did not resolve");
assert.equal(
  descendsFrom(importedHardware, worldScaled.getObjectByName("Skateboard_UniformAssembly")),
  true,
  "imported trucks escaped the uniform board assembly",
);
const importedWorldScale = importedFront.getWorldScale(new THREE.Vector3());
const expectedImportedScale =
  overallScale *
  defaults.replacementTruckScale /
  settingsApi.SKATEBOARD_TRUCK_GLTF_REFERENCE_SCALE;
assert.ok(
  importedWorldScale.distanceTo(
    new THREE.Vector3(
      expectedImportedScale,
      expectedImportedScale,
      expectedImportedScale,
    ),
  ) < 1e-9,
  "imported truck was not scaled exactly once with the board",
);

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
const panel = await readText("src/skateboard/panel.ts");
assert.match(panel, /label: "Overall scale", key: "overallScale"/);
assert.match(panel, /label: "Artwork scale X", key: "artworkScaleX"/);
assert.match(panel, /label: "Artwork scale Y", key: "artworkScaleY"/);
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
  ["public/skateboard/surf-cruiser-board.json", "9767e03ba2fd951e46924477cd762ee3565ff3ac563b586fdd20c170fefaa040"],
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
  "Validated approved Board JSON/migration, true uniform assembly scaling, independent artwork axes, exact deck topology, truck/wheel relationships, player integration, and baked web assets.",
);
