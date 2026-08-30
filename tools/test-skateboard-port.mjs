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
assert.equal(defaults.deckTailLength + defaults.deckNoseLength, 1.982568383216858);
assert.equal(defaults.deckHalfWidth * 2, 0.47522962093353274);
assert.equal(defaults.boardToGroundDistance, 0.19172483682632447);
assert.equal(defaults.bottomWear, 1);
assert.equal(defaults.topWear, 0);

const clamped = settingsApi.clampSkateboardSettings({
  ...defaults,
  deckHalfWidth: 4,
  wheelRadius: -1,
  railBevelSegments: 50,
});
assert.equal(clamped.deckHalfWidth, 0.65);
assert.equal(clamped.wheelRadius, 0.025);
assert.equal(clamped.railBevelSegments, 8);

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
assert.equal(geometry.getAttribute("position").count, 3148);
assert.equal(geometry.getAttribute("uv").count, 3148);
assert.equal(geometry.getAttribute("wearUv").count, 3148);
assert.equal(geometry.index.count / 3, 6292);
assert.equal(geometry.groups.length, 7);
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

const main = await readText("src/main.ts");
const player = await readText("src/player.ts");
assert.match(main, /createSkateboardTuningPanel/);
assert.match(main, /skateboardSettings/);
assert.match(player, /createSkateboardPresentation/);
assert.match(player, /skateboardRestingPivotLift/);
assert.doesNotMatch(player, /new THREE\.BoxGeometry\(0\.5, 0\.09, 1\.4\)/);
assert.match(await readText("skateboard-lab.html"), /src\/skateboard\/lab\.ts/);

const expectedAssets = new Map([
  ["public/skateboard/skateboard-truck.glb", "20d30d6fb2f594549db6ff219bfa8d925540c8dcdbd912f1116bef8e194b05c7"],
  ["public/skateboard/skateboard-truck.webp", "eb263b1250367575f5666838e8c30253e5344492d0ec1e474ef5829cd631a905"],
  ["public/skateboard/surf-cruiser-orange-sun.webp", "d24e9e704a626fdb7b3e4d26fd35dc9d5760de728c9e8d2e17843cea64ba9ff9"],
  ["public/skateboard/surf-cruiser-reference.webp", "67e55cf8ffbb0d202083ea35cfacec8289f27313806ccc659c94e5efa16e3621"],
]);
for (const [path, expected] of expectedAssets) {
  const bytes = await readFile(`${root}${path}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, path);
}

console.log(
  "Validated Unity skateboard settings, exact 3,148-vertex/7-material deck topology, bounds, player integration, lab entry, and baked web assets.",
);
