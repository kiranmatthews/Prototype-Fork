import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import * as THREE from 'three';
const require = createRequire(import.meta.url);
async function load(file) {
  const { outputFiles } = await build({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['three'] });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
const { VertexLightingSettings, VERTEX_LIGHTING_STORAGE_KEY } = await load('src/render-quality/vertexLightingSettings.ts');
const { GlobalVertexLighting, applyVertexLighting } = await load('src/vertexLighting.ts');
const saved = new Map();
const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
const settings = new VertexLightingSettings(storage);
assert.equal(settings.enabled, false);
settings.setEnabled(true);
assert.equal(saved.get(VERTEX_LIGHTING_STORAGE_KEY), 'true');
assert.equal(new VertexLightingSettings(storage).enabled, true);
saved.set(VERTEX_LIGHTING_STORAGE_KEY, 'broken');
assert.equal(new VertexLightingSettings(storage).enabled, false);
const denied = new VertexLightingSettings({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
assert.doesNotThrow(() => denied.setEnabled(true));

let draws = 0;
const renderer = {
  renderBufferDirect() { draws++; },
  render(scene) { scene.traverseVisible(o => this.renderBufferDirect(null, null, o.geometry, o.material, o, null)); },
};
const originalDraw = renderer.renderBufferDirect;
const originalRender = renderer.render;
const controller = new GlobalVertexLighting(renderer, settings);
const geometry = new THREE.PlaneGeometry(2, 2);
const normal = geometry.getAttribute('normal');
const material = new THREE.MeshStandardMaterial();
const originalCompile = function(shader) { shader.fragmentShader += '\n// authored-effect'; };
const originalKey = () => 'authored-v1';
material.onBeforeCompile = originalCompile;
material.customProgramCacheKey = originalKey;
const draw = (m = material, g = geometry) => renderer.render({ traverseVisible(callback) { callback({ isMesh: true, geometry: g, material: m }); } });
draw();
assert.equal(controller.diagnostics.materials, 1);
assert.equal(geometry.getAttribute('vertexLightingNormal'), normal);
assert.equal(geometry.getAttribute('normal'), normal);
const shader = { ...THREE.ShaderLib.standard, uniforms: {} };
material.onBeforeCompile(shader, renderer);
assert.ok(shader.fragmentShader.includes('authored-effect'));
assert.ok(shader.vertexShader.includes('getPointLightInfo( vertexSource, mvPosition.xyz'));
assert.ok(!shader.fragmentShader.includes('getPointLightInfo( pointLight, geometryPosition'));
assert.ok(shader.fragmentShader.includes('getPointShadow('));
const once = shader.vertexShader;
applyVertexLighting(shader);
assert.equal(shader.vertexShader, once, 'copied compile hooks do not double-inject');
const version = material.version;
draw(); assert.equal(material.version, version, 'no per-frame recompilation');

const flat = new THREE.BoxGeometry(1, 1, 1);
flat.deleteAttribute('normal');
const positions = Array.from(flat.attributes.position.array), indices = Array.from(flat.index.array);
draw(material, flat);
assert.equal(flat.getAttribute('normal'), undefined, 'authored normal/shadow behavior is retained');
assert.deepEqual(Array.from(flat.attributes.position.array), positions);
assert.deepEqual(Array.from(flat.index.array), indices);
const generated = flat.getAttribute('vertexLightingNormal');
assert.ok(Array.from(generated.array).every(Number.isFinite));
const normalVersion = generated.version;
draw(material, flat); assert.equal(generated.version, normalVersion, 'generated normals are cached');
flat.attributes.position.needsUpdate = true;
draw(material, flat); assert.ok(generated.version > normalVersion, 'edited geometry refreshes derived normals');

const unlit = new THREE.MeshBasicMaterial();
const unlitCompile = unlit.onBeforeCompile;
draw(unlit); assert.equal(unlit.onBeforeCompile, unlitCompile);
settings.setEnabled(false);
assert.equal(controller.diagnostics.materials, 0);
assert.equal(material.onBeforeCompile, originalCompile);
assert.equal(material.customProgramCacheKey, originalKey);
for (let cycle = 0; cycle < 3; cycle++) {
  settings.setEnabled(true); draw();
  assert.equal(material.customProgramCacheKey(), 'authored-v1|global-vertex-diffuse-v1');
  settings.setEnabled(false);
  assert.equal(material.customProgramCacheKey(), 'authored-v1');
}
settings.setEnabled(true);
const streamed = new THREE.MeshPhongMaterial();
draw(streamed); assert.equal(controller.diagnostics.materials, 1);
streamed.dispose(); assert.equal(controller.diagnostics.materials, 0, 'disposed levels leave no material references');
draw(); controller.dispose();
assert.equal(renderer.renderBufferDirect, originalDraw);
assert.equal(renderer.render, originalRender);
assert.equal(material.onBeforeCompile, originalCompile);
assert.ok(draws > 0);
console.log('PASS vertex lighting preferences, shader chaining, per-light shadows, normal preservation, streaming, repeated restore and disposal');
