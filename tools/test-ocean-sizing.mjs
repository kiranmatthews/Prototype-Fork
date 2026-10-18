import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

// Load the actual local dependency graph, including the primary-scene helper.
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let UnityOcean;
try {
  ({ UnityOcean } = await server.ssrLoadModule("/src/unityOcean.ts"));
} finally {
  await server.close();
}
const originalTextureLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function loadTextureWithoutDom() {
  return new THREE.Texture();
};

const makeOcean = (options = {}) => new UnityOcean({
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
  ...options,
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

  // An opt-in refraction budget preserves aspect, primary pixels and reflection
  // dimensions. Fixed presets below the budget retain the original capture.
  for (const invalid of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() => makeOcean({prepassMaxHeight: invalid}), RangeError);
  const capped = makeOcean({prepassMaxHeight: 1080});
  const cappedSurface = capped.sampleWaterSurface(4, 8, 3.5);
  capped.resize(1920, 1080, 2);
  const cappedTarget = capped.prepassTarget;
  assert.deepEqual([cappedTarget.width, cappedTarget.height], [1920, 1080]);
  assert.deepEqual([capped.reflectionTarget.width, capped.reflectionTarget.height], [1152, 648]);
  assert.deepEqual(capped.oceanMaterial.uniforms.uViewport.value.toArray(), [3840, 2160]);
  capped.resize(1920, 1080, 2);
  assert.equal(capped.prepassTarget, cappedTarget);
  const primary = new THREE.WebGLRenderTarget(3840, 2160, {type: THREE.HalfFloatType});
  const renderer = {getScissorTest: () => false, getPixelRatio: () => 2, xr: {isPresenting: false},
    getDrawingBufferSize: value => value.set(3840, 2160)};
  const preparePasses = capped.preparePasses, reflect = capped.renderReflection;
  capped.preparePasses = () => true;
  capped.renderReflection = activeRenderer => capped.ensureSize(activeRenderer);
  capped.primaryPass = {prepare: () => true, render: (_r, _s, _c, target, opaque) => {
    assert.deepEqual([opaque.width, opaque.height], [target.width, target.height]);
    assert.equal(opaque, cappedTarget, 'reuse the owned target across size changes');
  }, dispose() {}};
  assert.equal(capped.renderPrimary(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), primary), true);
  assert.deepEqual([capped.prepassTarget.width, capped.prepassTarget.height], [3840, 2160]);
  assert.equal(capped.primaryPrepassSize, true);
  let repeatedDisposals = 0;
  capped.prepassTarget.addEventListener('dispose', () => repeatedDisposals++);
  for (let frame = 0; frame < 3; frame++) {
    capped.resize(1920, 1080, 2); capped.clearPreCrtRenderSize();
    assert.equal(capped.renderPrimary(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), primary), true);
  }
  assert.equal(repeatedDisposals, 0, 'ordinary frame-size synchronization must not churn the shared target');
  assert.equal(capped.renderPrimary(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), null), false);
  assert.equal(capped.primaryPrepassSize, false);
  capped.resize(1920, 1080, 2);
  assert.deepEqual([capped.prepassTarget.width, capped.prepassTarget.height], [1920, 1080]);
  capped.primaryPass.render = () => {throw Error('simulated primary failure');};
  assert.throws(() => capped.renderPrimary(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), primary), /simulated primary failure/);
  assert.equal(capped.primaryPrepassSize, false, 'failed primary must restore separate-capture policy');
  capped.resize(1920, 1080, 2);
  assert.deepEqual([capped.prepassTarget.width, capped.prepassTarget.height], [1920, 1080]);
  capped.preparePasses = preparePasses; capped.renderReflection = reflect;
  primary.dispose();
  capped.setPreCrtRenderSize(1281, 721);
  assert.deepEqual([capped.prepassTarget.width, capped.prepassTarget.height], [1281, 721]);
  capped.resize(2160, 3840, 1);
  assert.deepEqual([capped.prepassTarget.width, capped.prepassTarget.height], [1281, 721]);
  capped.clearPreCrtRenderSize();
  assert.deepEqual([capped.prepassTarget.width, capped.prepassTarget.height], [608, 1080]);
  assert.deepEqual(capped.oceanMaterial.uniforms.uViewport.value.toArray(), [2160, 3840]);
  capped.prepassScale = .2;
  capped.resize(2160, 3840, 1);
  assert.deepEqual([capped.prepassTarget.width, capped.prepassTarget.height], [432, 768]);
  capped.setQuality('lite');
  assert.equal(capped.prepassTarget, null);
  capped.setQuality('full');
  capped.resize(1920, 1080, 2);
  assert.deepEqual([capped.prepassTarget.width, capped.prepassTarget.height], [1920, 1080]);
  assert.deepEqual(capped.sampleWaterSurface(4, 8, 3.5), cappedSurface);
  const retired = capped.prepassTarget; let disposals = 0, depthDisposals = 0;
  retired.addEventListener('dispose', () => disposals++);
  retired.depthTexture.addEventListener('dispose', () => depthDisposals++);
  capped.dispose(); capped.dispose();
  assert.equal(disposals, 1);
  assert.equal(depthDisposals, 1);
  assert.equal(capped.prepassTarget, null);
} finally {
  THREE.TextureLoader.prototype.load = originalTextureLoad;
}

console.log(
  "Validated UnityOcean native/fixed target sizing, viewport, reuse, quality teardown, opt-in refraction budgets, disposal, and CPU-surface invariance.",
);
