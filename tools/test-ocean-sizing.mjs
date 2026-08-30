import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";
import * as THREE from "three";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src/unityOcean.ts"), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
  },
  fileName: "unityOcean.ts",
}).outputText;
const threeUrl = pathToFileURL(
  path.join(root, "node_modules/three/build/three.module.js"),
).href;
const executable = transpiled
  .replace('from "three"', `from "${threeUrl}"`)
  .replaceAll("import.meta.env.BASE_URL", '"/"');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`;
const { UnityOcean } = await import(moduleUrl);

const originalTextureLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function loadTextureWithoutDom() {
  return new THREE.Texture();
};

const makeOcean = () => new UnityOcean({
  shore: [
    { x: 0, z: 0, sx: 0, sz: 1, beachSlope: 0.1, bedSlope: 0.1 },
    { x: 12, z: 0, sx: 0, sz: 1, beachSlope: 0.1, bedSlope: 0.1 },
  ],
  seaLevel: 0,
  shoreDirX: 0,
  shoreDirZ: 1,
  course: [{ x: 0, z: 0 }, { x: 12, z: 0 }],
  terrainHeight: () => -1,
  quality: "full",
});

try {
  const ocean = makeOcean();
  const cpuBefore = ocean.sampleWaterSurface(4, 8, 3.5);

  // No override retains the existing native CSS-size × DPR contract.
  ocean.resize(1920, 1080, 2);
  assert.deepEqual(ocean.preCrtRenderSize, null);
  assert.equal(ocean.stats.sceneWidth, 3840);
  assert.equal(ocean.stats.sceneHeight, 2160);
  assert.equal(ocean.stats.nativeDrawingBufferWidth, 3840);
  assert.equal(ocean.stats.nativeDrawingBufferHeight, 2160);
  assert.equal(ocean.stats.preCrtSizeOverride, false);
  assert.equal(ocean.reflectionTarget?.width, 1152);
  assert.equal(ocean.reflectionTarget?.height, 648);
  assert.equal(ocean.prepassTarget?.width, 3840);
  assert.equal(ocean.prepassTarget?.height, 2160);

  const nativeReflection = ocean.reflectionTarget;
  const nativePrepass = ocean.prepassTarget;
  ocean.setPreCrtRenderSize(1280, 720);
  assert.deepEqual(ocean.preCrtRenderSize, { width: 1280, height: 720 });
  assert.equal(ocean.stats.sceneWidth, 1280);
  assert.equal(ocean.stats.sceneHeight, 720);
  assert.equal(ocean.stats.preCrtSizeOverride, true);
  assert.equal(ocean.reflectionTarget, nativeReflection);
  assert.equal(ocean.prepassTarget, nativePrepass);
  assert.equal(ocean.reflectionTarget?.width, 384);
  assert.equal(ocean.reflectionTarget?.height, 216);
  assert.equal(ocean.prepassTarget?.width, 1280);
  assert.equal(ocean.prepassTarget?.height, 720);
  assert.deepEqual(
    ocean.oceanMaterial.uniforms.uViewport.value.toArray(),
    [1280, 720],
  );

  // Native display changes update diagnostics but do not resize fixed passes.
  ocean.resize(2560, 1440, 2);
  assert.equal(ocean.stats.nativeDrawingBufferWidth, 5120);
  assert.equal(ocean.stats.nativeDrawingBufferHeight, 2880);
  assert.equal(ocean.reflectionTarget, nativeReflection);
  assert.equal(ocean.prepassTarget, nativePrepass);
  assert.equal(ocean.reflectionTarget?.width, 384);
  assert.equal(ocean.prepassTarget?.width, 1280);

  // Reapplying the same fixed dimensions is allocation-free and invalid input
  // is transactional.
  ocean.setPreCrtRenderSize(1280, 720);
  assert.equal(ocean.reflectionTarget, nativeReflection);
  assert.equal(ocean.prepassTarget, nativePrepass);
  assert.throws(() => ocean.setPreCrtRenderSize(640, Number.NaN), RangeError);
  assert.deepEqual(ocean.preCrtRenderSize, { width: 1280, height: 720 });

  // Clearing uses the most recently observed native dimensions.
  ocean.clearPreCrtRenderSize();
  assert.equal(ocean.stats.sceneWidth, 5120);
  assert.equal(ocean.stats.sceneHeight, 2880);
  assert.equal(ocean.stats.preCrtSizeOverride, false);
  assert.equal(ocean.reflectionTarget?.width, 1536);
  assert.equal(ocean.reflectionTarget?.height, 864);
  assert.equal(ocean.prepassTarget?.width, 5120);
  assert.equal(ocean.prepassTarget?.height, 2880);
  assert.deepEqual(
    ocean.oceanMaterial.uniforms.uViewport.value.toArray(),
    [5120, 2880],
  );

  // Quality disable/re-enable releases targets without touching CPU waves or
  // losing a subsequently configured fixed scene size.
  ocean.setPreCrtRenderSize(1280, 720);
  ocean.setQuality("lite");
  assert.equal(ocean.reflectionTarget, null);
  assert.equal(ocean.prepassTarget, null);
  assert.equal(ocean.stats.reflectionWidth, 0);
  assert.equal(ocean.stats.prepassWidth, 0);
  ocean.setQuality("lite");
  ocean.setPreCrtRenderSize(1280, 720);
  assert.equal(ocean.reflectionTarget, null);
  assert.equal(ocean.prepassTarget, null);
  assert.deepEqual(
    ocean.oceanMaterial.uniforms.uViewport.value.toArray(),
    [1280, 720],
  );
  ocean.setQuality("full");
  ocean.resize(2560, 1440, 2);
  assert.equal(ocean.reflectionTarget?.width, 384);
  assert.equal(ocean.prepassTarget?.width, 1280);

  assert.deepEqual(ocean.sampleWaterSurface(4, 8, 3.5), cpuBefore);
  ocean.dispose();
  ocean.dispose();
  assert.equal(ocean.reflectionTarget, null);
  assert.equal(ocean.prepassTarget, null);
  assert.deepEqual(ocean.sampleWaterSurface(4, 8, 3.5), cpuBefore);
} finally {
  THREE.TextureLoader.prototype.load = originalTextureLoad;
}

console.log(
  "Validated UnityOcean native/fixed target sizing, viewport, reuse, quality teardown, disposal, and CPU-surface invariance.",
);
