import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadLevel(relativeFile, exportName) {
  const file = path.join(root, relativeFile);
  const source = readFileSync(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  }).outputText;
  const sourceUrl = pathToFileURL(file).href;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${sourceUrl}`).toString("base64");
  const module = await import(`data:text/javascript;base64,${encoded}`);
  return module[exportName];
}

const specs = [
  ["src/levels/beachfront-run.ts", "BEACHFRONT_RUN_LEVEL"],
  ["src/levels/bonus-level.ts", "BONUS_LEVEL"],
  ["src/levels/coastal-street-run.ts", "COASTAL_STREET_RUN_LEVEL"],
  ["src/levels/island-hopper.ts", "ISLAND_HOPPER_LEVEL"],
  ["src/levels/jungle-gate-run.ts", "JUNGLE_GATE_RUN_LEVEL"],
  ["src/levels/meshylook-thorns.ts", "MESHYLOOK_THORNS_LEVEL"],
];

const levels = new Map();
for (const [file, exportName] of specs) {
  const level = await loadLevel(file, exportName);
  assert.equal(level.v, 1, `${file} must use CustomLevelData v1`);
  assert.ok(level.name && level.name.length > 2, `${file} needs a menu name`);
  assert.ok(level.spawn.length === 3 && level.spawn.every(Number.isFinite));
  assert.ok(Number.isFinite(level.killY));
  assert.ok(level.components.length < 512, `${file} exceeds the component budget`);
  assert.equal(
    level.components.filter((component) => component.t === "gate").length,
    1,
    `${file} needs exactly one finish gate`,
  );
  assert.ok(
    level.components.filter((component) => component.t === "camnode").length >= 2,
    `${file} needs an ordered camera route`,
  );
  levels.set(exportName, level);
}

const parallaxSource = readFileSync(path.join(root, "src/bonusParallax.ts"), "utf8");
for (const literal of [
  "vec4(0.006, 0.004, 1.035, 0.0005)",
  "vec4(0.024, 0.015, 1.09, 0.0012)",
  "vec4(0.058, 0.034, 1.20, 0.0021)",
  "vec4(0.108, 0.064, 1.38, 0.0032)",
  "MOTION_SMOOTH_SECONDS = 0.55",
  "scene.add(this.mesh)",
]) {
  assert.ok(parallaxSource.includes(literal), `Bonus parallax contract missing: ${literal}`);
}
for (const [file, expected] of Object.entries({
  "BonusParallax_Sky.png": "e43dc3ae70b6ca77534b168b7bc7468a7c9bb1ed8f23752c64715afe65dcab2d",
  "BonusParallax_Mountains.png": "9750eb2906ea0f1fb232d8e4820bc615a18ba6457bbbb083f5c6688818350aca",
  "BonusParallax_BackgroundHouses.png": "d11b1dd7c06e0c892ae2fe29089f69cffcf3a5df158d2cb99b8c24377da84a01",
  "BonusParallax_ForegroundHouses.png": "244ac441ebc0dff9d72ae3e2c6bdc6146c8c02301aa63d7e2f24056c8a19fae6",
})) {
  const actual = createHash("sha256")
    .update(readFileSync(path.join(root, "public/bonus-parallax", file)))
    .digest("hex");
  assert.equal(actual, expected, `${file} no longer matches the registered Unity layer`);
}

const count = (level, type) =>
  level.components.filter((component) => component.t === type).length;

const beach = levels.get("BEACHFRONT_RUN_LEVEL");
assert.equal(count(beach, "woodpath"), 28);
assert.equal(count(beach, "checkpoint"), 4);
assert.equal(count(beach, "wumpa"), 84);
assert.equal(count(beach, "crate"), 16);
for (let sequence = 0; sequence < 7; sequence++) {
  const paths = beach.components.filter(
    (component) => component.t === "woodpath" && component.grp === 10 + sequence,
  );
  assert.equal(paths.length, 4, `Beach boardwalk sequence ${sequence + 1}`);
  for (let index = 1; index < paths.length; index++) {
    const before = paths[index - 1];
    const after = paths[index];
    const last = before.pts.at(-1);
    const endX = before.p[0] + last[0];
    const endZ = before.p[2] + last[1];
    const gap = Math.hypot(after.p[0] - endX, after.p[2] - endZ);
    assert.ok(
      gap >= 2.75 && gap <= 5.25,
      `Beach boardwalk ${sequence + 1}.${index} gap ${gap.toFixed(2)}m`,
    );
  }
  assert.ok(paths[0].p[1] < 0.8, "Beach boardwalk entry must meet the sand");
  const final = paths.at(-1);
  const finalNode = final.pts.at(-1);
  assert.ok(final.p[1] + finalNode[3] < 0.8, "Beach boardwalk exit must meet the sand");
}

const coastal = levels.get("COASTAL_STREET_RUN_LEVEL");
assert.equal(
  coastal.components.filter(
    (component) =>
      (component.t === "platform" || component.t === "ramp") &&
      component.grp === 1,
  ).length,
  23,
);
assert.equal(count(coastal, "speedpad"), 11);
assert.equal(count(coastal, "enemy"), 16);
assert.equal(count(coastal, "checkpoint"), 6);
assert.ok(coastal.components.some((component) => component.nm === "screen-right beach"));
assert.ok(coastal.components.some((component) => component.nm === "screen-right deep water"));

const bonus = levels.get("BONUS_LEVEL");
assert.equal(count(bonus, "mover"), 1);
assert.equal(count(bonus, "rail"), 1);
assert.equal(count(bonus, "checkpoint"), 0);
assert.equal(count(bonus, "crate"), 34); // 33 puzzle crates + mask approximation
assert.ok(bonus.components.some((component) => component.kind === "mask"));

const island = levels.get("ISLAND_HOPPER_LEVEL");
assert.equal(count(island, "woodpath"), 11);
assert.equal(count(island, "rope"), 2);
assert.equal(count(island, "crate"), 20);
assert.equal(count(island, "checkpoint"), 3);
assert.equal(count(island, "wumpa"), 49);
assert.equal(
  island.components.filter((component) => component.nm?.startsWith("Sand island ")).length,
  5,
);

const jungle = levels.get("JUNGLE_GATE_RUN_LEVEL");
assert.equal(count(jungle, "platform"), 14);
assert.equal(count(jungle, "ramp"), 2);
assert.equal(count(jungle, "pit"), 6);
assert.equal(count(jungle, "rail"), 2);
assert.equal(count(jungle, "checkpoint"), 3);
assert.equal(
  jungle.components.filter((component) => component.kind === "metalbounce").length,
  2,
);
assert.ok(jungle.components.some((component) => component.t === "zone" && component.dir === "E"));

const meshy = levels.get("MESHYLOOK_THORNS_LEVEL");
assert.equal(count(meshy, "ramp"), 16);
assert.equal(count(meshy, "rail"), 8);
assert.equal(count(meshy, "pit"), 4);
assert.equal(count(meshy, "thorn"), 4);
assert.equal(count(meshy, "zone"), 0, "Meshy camera must follow its +X spine");
const meshyCamera = meshy.components.filter((component) => component.t === "camnode");
assert.ok(
  meshyCamera.every((node, index) => index === 0 || node.p[0] > meshyCamera[index - 1].p[0]),
  "Meshy camera spine must look and travel forward along +X",
);
assert.ok(
  meshy.components
    .filter((component) => component.t === "ramp")
    .every((component) => component.invisible === true),
  "Meshy gameplay ramps must not cover the actual bridge art",
);
const courtyardVisuals = meshy.components.filter(
  (component) => component.t === "decor" && component.dkind === "meshycourtyard",
);
assert.equal(courtyardVisuals.length, 4);
assert.deepEqual(
  courtyardVisuals.map((component) => [component.p[0], component.yaw, component.amp]),
  [[0, 90, 6], [10.8, 90, -6], [21.6, 90, 6], [32.4, 90, -6]],
);
const thornPits = meshy.components.filter((component) => component.nm?.startsWith("Small thorn core"));
assert.equal(thornPits.length, 4);
assert.ok(thornPits.every((component) => component.s[0] === 1.15 && component.s[2] === 1.25));
assert.ok(thornPits.every((component) => component.invisible === true));
assert.equal(
  meshy.components.filter((component) => component.nm?.startsWith("THORN_VISUAL_")).length,
  4,
);

const thornSource = readFileSync(path.join(root, "src/proceduralThorns.ts"), "utf8");
for (const literal of [
  "createProceduralThornCluster",
  "new THREE.TubeGeometry",
  "THREE.AdditiveBlending",
  "TAU * timeSeconds) / 2.4",
  "core.emissiveIntensity = 1 + wave",
]) {
  assert.ok(thornSource.includes(literal), `procedural thorn contract missing: ${literal}`);
}

const courtyardSource = readFileSync(path.join(root, "src/meshyCourtyard.ts"), "utf8");
for (const literal of [
  'MESHY_COURTYARD_PATH = "meshy/ancient-stone-courtyard.glb"',
  "MESHY_COURTYARD_UNIT_BOTTOM = 0.04 / 11.52",
  "mesh.geometry.userData.shared = true",
  "template.clone(true)",
  "releaseMeshyCourtyard",
  "meshyCourtyardReleased",
  "AncientStoneCourtyard_EditorBounds",
]) {
  assert.ok(courtyardSource.includes(literal), `Meshy courtyard loader missing: ${literal}`);
}
const levelSource = readFileSync(path.join(root, "src/level.ts"), "utf8");
for (const literal of [
  '"meshycourtyard", // owner-supplied Ancient Stone Courtyard mesh; visual only',
  'case "meshycourtyard"',
  "createMeshyCourtyardVisual()",
  "m.userData.editorGhost = true",
]) {
  assert.ok(levelSource.includes(literal), `Meshy runtime integration missing: ${literal}`);
}
const editorSource = readFileSync(path.join(root, "src/editor.ts"), "utf8");
for (const literal of [
  "meshycourtyard: (x) =>",
  'meshycourtyard: { w: 11.52, yaw: 90, amp: 6 }',
  '"fitted size"',
  '"pitch °"',
]) {
  assert.ok(editorSource.includes(literal), `Meshy editor integration missing: ${literal}`);
}
const courtyardAsset = readFileSync(
  path.join(root, "public/meshy/ancient-stone-courtyard.glb"),
);
assert.ok(courtyardAsset.byteLength < 160_000, "Meshy courtyard GLB is no longer aggressively compressed");
assert.equal(
  createHash("sha256").update(courtyardAsset).digest("hex"),
  "820899ca1d314fb56cccc7eeb49caa15d9e9f05fe3e16e5a42ae97ea53b01ebb",
);
assert.equal(courtyardAsset.toString("ascii", 0, 4), "glTF");
const courtyardJsonLength = courtyardAsset.readUInt32LE(12);
const courtyardDocument = JSON.parse(
  courtyardAsset.toString("utf8", 20, 20 + courtyardJsonLength),
);
assert.equal(courtyardDocument.extensionsRequired, undefined);
assert.equal(courtyardDocument.meshes.length, 1);
assert.equal(courtyardDocument.meshes[0].primitives.length, 1);
assert.equal(courtyardDocument.images[0].mimeType, "image/jpeg");
assert.equal(courtyardDocument.images[0].name, "AncientStoneCourtyard_BaseColor_512");
assert.equal(courtyardDocument.materials[0].doubleSided, undefined);
assert.equal(
  courtyardDocument.asset.copyright,
  "Ancient Stone Courtyard — model created with Meshy — CC BY 4.0",
);
assert.equal(courtyardDocument.accessors[3].componentType, 5123);
assert.equal(courtyardDocument.accessors[3].count, 3195);
const courtyardBake = readFileSync(path.join(root, "tools/bake-meshy-courtyard.py"), "utf8");
for (const literal of [
  "image.scale(512, 512)",
  'image.file_format = "JPEG"',
  "modifier.ratio = 0.78",
  'material.pop("doubleSided", None)',
  'document.setdefault("asset", {})["copyright"]',
  'document["images"][0]["name"] = "AncientStoneCourtyard_BaseColor_512"',
]) {
  assert.ok(courtyardBake.includes(literal), `Meshy courtyard bake contract missing: ${literal}`);
}

const registry = readFileSync(path.join(root, "src/levels/unity-ports.ts"), "utf8");
for (const id of [
  "beachside-run",
  "bonus-level",
  "coastal-street-run",
  "island-hopper",
  "jungle-gate-run",
  "meshylook-thorns",
]) {
  assert.ok(registry.includes(`id: "${id}"`), `Unity port registry missing ${id}`);
}

console.log(
  "Validated six Unity ports: joins, routes, goals, actors, beach treatment, Bonus layout, actual compressed Meshy bridge, forward camera and reduced thorn cores.",
);
