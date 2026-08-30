import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";
import * as THREE from "three";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src/islandShoreFoam.ts"), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
  },
  fileName: "islandShoreFoam.ts",
}).outputText;
const threeUrl = pathToFileURL(
  path.join(root, "node_modules/three/build/three.module.js"),
).href;
const executable = transpiled.replace('from "three"', `from "${threeUrl}"`);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`;
const {
  ISLAND_SHORE_FOAM_GEOMETRY,
  ISLAND_SHORE_FOAM_LOOK,
  IslandShoreFoam,
  buildIslandShoreFoamGeometry,
  createIslandShoreFoam,
  evaluateIslandShoreFoam,
} = await import(moduleUrl);

const axes = [
  [17.5, 23],
  [18.25, 26.55],
  [17.25, 27],
  [18, 25.035],
  [19, 32],
];
const ovals = axes.map((ovalAxes, index) => ({
  center: [index * 50, -0.36, -index * 80],
  right: [2, 0, 0],
  forward: [0, 0, -3],
  axes: ovalAxes,
  phase: index * 2.19,
}));

assert.deepEqual(ISLAND_SHORE_FOAM_GEOMETRY, {
  segments: 72,
  innerScale: 1.01,
  outerScale: 1.105,
  innerLift: 0.035,
  outerLift: 0.04,
  broadShapeAmount: 0.045,
  fineShapeAmount: 0.022,
});
assert.deepEqual(ISLAND_SHORE_FOAM_LOOK, {
  color: [0.88, 0.98, 1, 0.78],
  pulseSpeed: 0.58,
  pulseAmount: 0.42,
  detailFrequency: 4.8,
  edgePower: 0.62,
});

const foam = createIslandShoreFoam(ovals);
assert.ok(foam instanceof IslandShoreFoam);
assert.equal(foam.group.children.length, 1, "all five ovals must share one mesh");
assert.equal(foam.group.children[0], foam.mesh);
assert.equal(foam.mesh.geometry, foam.geometry);
assert.equal(foam.mesh.material, foam.material);
assert.equal(foam.mesh.renderOrder, 1, "foam must draw above the renderOrder-0 ocean");
assert.equal(foam.mesh.castShadow, false);
assert.equal(foam.mesh.receiveShadow, false);
assert.equal(foam.material.transparent, true);
assert.equal(foam.material.depthTest, true);
assert.equal(foam.material.depthWrite, false);
assert.equal(foam.material.side, THREE.DoubleSide);
assert.equal(foam.material.blending, THREE.NormalBlending);
assert.deepEqual(foam.material.uniforms.uBaseColor.value.toArray(), [0.88, 0.98, 1, 0.78]);
assert.equal(foam.material.uniforms.uPulseSpeed.value, 0.58);
assert.equal(foam.material.uniforms.uPulseAmount.value, 0.42);
assert.equal(foam.material.uniforms.uDetailFrequency.value, 4.8);
assert.equal(foam.material.uniforms.uEdgePower.value, 0.62);
assert.equal(foam.material.uniforms.uSourceZSign.value, -1);

assert.deepEqual(foam.diagnostics, {
  ovalCount: 5,
  segmentsPerOval: 72,
  vertexCount: 720,
  triangleCount: 720,
  drawCalls: 1,
  sourceZSign: -1,
  renderOrder: 1,
  time: 0,
  disposed: false,
});

const position = foam.geometry.getAttribute("position");
const uv = foam.geometry.getAttribute("uv");
const index = foam.geometry.getIndex();
assert.equal(position.count, 5 * 72 * 2);
assert.equal(uv.count, position.count);
assert.equal(index.count, 5 * 72 * 6);
assert.deepEqual(Array.from(index.array.slice(0, 6)), [0, 2, 1, 1, 2, 3]);

const close = (actual, expected, epsilon = 2e-5) =>
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} must be within ${epsilon} of ${expected}`,
  );

// Source ring zero at angle zero: unit wave, normalized +X basis, exact lifts.
close(position.getX(0), 17.5 * 1.01);
close(position.getY(0), -0.36 + 0.035);
close(position.getZ(0), 0);
close(position.getX(1), 17.5 * 1.105);
close(position.getY(1), -0.36 + 0.04);
close(uv.getX(0), 0);
close(uv.getX(1), 1);
close(uv.getY(0), 0);

// Quarter-turn uses the converted -Z forward basis and the exact organic wave.
const quarter = 18 * 2;
const angle = Math.PI / 2;
const wave = 1
  + 0.045 * Math.sin(angle * 4)
  + 0.022 * Math.sin(angle * 9);
close(position.getX(quarter), 0);
close(position.getZ(quarter), -23 * 1.01 * wave);
close(uv.getY(quarter), 18 / 72);

// The next oval carries Unity's unwrapped per-island UV phase.
const secondFirst = 72 * 2;
close(uv.getY(secondFirst), 2.19 / (Math.PI * 2));

// CPU parity probe proves the converted Unity phase negates world Z.
const sample = evaluateIslandShoreFoam([0.5, 0.37], 12, -23, 1.25);
const mirroredPhase = 0.37 * Math.PI * 2 * 4.8
  + 12 * 0.115
  - (-23) * 0.087
  + 1.25 * 0.58 * Math.PI * 2;
const broad = Math.sin(mirroredPhase);
const fine = Math.sin(mirroredPhase * 1.79 + Math.sin(mirroredPhase * 0.43) * 1.6);
const motion = Math.max(0, Math.min(1, 0.58 + broad * 0.27 + fine * 0.15));
const edge = Math.pow(Math.sin(Math.PI * 0.5), 0.62);
const alpha = 0.78 * edge * ((1 - 0.42) + motion * 0.42);
const brightness = 0.92 + (1.12 - 0.92) * motion * 0.42;
close(sample.motion, motion, 1e-12);
close(sample.edge, edge, 1e-12);
close(sample.r, Math.min(1, 0.88 * brightness), 1e-12);
close(sample.g, Math.min(1, 0.98 * brightness), 1e-12);
close(sample.b, Math.min(1, brightness), 1e-12);
close(sample.a, alpha, 1e-12);
assert.match(source, /vWorldPosition\.z \* 0\.087 \* uSourceZSign/);

foam.update(0.25);
foam.update(-1);
foam.update(Number.NaN);
close(foam.diagnostics.time, 0.25, 1e-12);
close(foam.material.uniforms.uTime.value, 0.25, 1e-12);
foam.setTime(2.5);
close(foam.diagnostics.time, 2.5, 1e-12);
assert.throws(() => foam.setTime(Number.NaN), RangeError);

let geometryDisposals = 0;
let materialDisposals = 0;
foam.geometry.addEventListener("dispose", () => geometryDisposals++);
foam.material.addEventListener("dispose", () => materialDisposals++);
foam.dispose();
foam.dispose();
foam.update(1);
assert.equal(geometryDisposals, 1);
assert.equal(materialDisposals, 1);
assert.equal(foam.group.children.length, 0);
assert.equal(foam.diagnostics.drawCalls, 0);
assert.equal(foam.diagnostics.disposed, true);
assert.equal(foam.diagnostics.time, 2.5);

assert.throws(() => buildIslandShoreFoamGeometry([]), RangeError);
assert.throws(
  () => buildIslandShoreFoamGeometry([{ ...ovals[0], axes: [0, 2] }]),
  RangeError,
);
assert.throws(
  () => buildIslandShoreFoamGeometry([
    { ...ovals[0], forward: [4, 0, 0] },
  ]),
  RangeError,
);
assert.throws(() => createIslandShoreFoam(ovals, { segments: 11 }), RangeError);
assert.throws(() => createIslandShoreFoam(ovals, { sourceZSign: 0 }), RangeError);

console.log(
  "Validated five exact Unity island-foam rings as one draw: merged geometry, mirrored phase, material parity, lifecycle, diagnostics, and input guards.",
);
