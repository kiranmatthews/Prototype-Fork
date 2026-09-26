import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

const root = new URL('../', import.meta.url);
const harness = await readFile(new URL('tools/validate-editor-roundtrip.mjs', root), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const source = await readFile(new URL('src/warpPad.ts', root), 'utf8');
const executable = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace("from 'three'", `from '${new URL('node_modules/three/build/three.module.js', root).href}'`);
const { createWarpPad, WARP_PAD_TOP, WARP_PAD_RADIUS } = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`);

const pad = createWarpPad(), tongues = pad.group.getObjectByName('warp flame tongues');
assert.ok(tongues?.isInstancedMesh);
assert.equal(tongues.count, 18);
assert.equal(tongues.instanceMatrix.usage, THREE.DynamicDrawUsage);
const referenceGeometry = new THREE.ConeGeometry(.34 / 3, 1 / 3, 4, 1, true);
for (const name of ['position', 'normal', 'uv'])
  assert.deepEqual(tongues.geometry.attributes[name].array, referenceGeometry.attributes[name].array, `${name}: every authored cone vertex is preserved`);
assert.deepEqual(tongues.geometry.index.array, referenceGeometry.index.array);
assert.equal(tongues.material.side, THREE.DoubleSide);
assert.equal(tongues.material.blending, THREE.AdditiveBlending);
assert.equal(tongues.material.depthWrite, false);
assert.equal(tongues.material.opacity, .9);
assert.equal(tongues.renderOrder, 3);
assert.equal(pad.solids.length, 3);
assert.equal(WARP_PAD_TOP, 1.7 / 3 + .5 / 3);
assert.equal(WARP_PAD_RADIUS, 4.85 / 3);

// The old 18 independent meshes used this authored seeded pose and clock.
// Compare all submitted vertices, including under a moved/scaled pad root.
let seed = 0x3a17;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const reference = Array.from({ length: 18 }, (_, i) => ({
  angle: i / 18 * Math.PI * 2, height: 1.3 + random() * 1.1, phase: random() * Math.PI * 2,
}));
const expected = new THREE.Object3D(), actual = new THREE.Matrix4();
const position = referenceGeometry.attributes.position, vertex = new THREE.Vector3(), target = new THREE.Vector3();
let time = 0, comparisons = 0;
pad.group.position.set(8, -2, 14); pad.group.rotation.set(.12, .7, -.16); pad.group.scale.set(1.2, .8, .9);
for (const dt of [null, 0, 1 / 60, .37, 8.9, 990, 1.4, .02]) {
  if (dt !== null) { time = (time + dt) % 1000; pad.update(dt); }
  pad.group.updateMatrixWorld(true);
  for (let i = 0; i < 18; i++) {
    const authored = reference[i];
    const height = dt === null ? authored.height : .75 + .25 * Math.sin(time * 11 + authored.phase);
    expected.scale.set(1, height, 1);
    expected.position.set(Math.cos(authored.angle) * 2.4 / 3,
      dt === null ? .5 * height / 3 : .5 * height, Math.sin(authored.angle) * 2.4 / 3);
    expected.updateMatrix(); tongues.getMatrixAt(i, actual);
    for (let index = 0; index < position.count; index++) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(actual);
      assert.ok(tongues.boundingBox.containsPoint(vertex), 'animated instance left the culling box');
      assert.ok(tongues.boundingSphere.containsPoint(vertex), 'animated instance left the culling sphere');
      vertex.applyMatrix4(tongues.matrixWorld);
      target.fromBufferAttribute(position, index).applyMatrix4(expected.matrix).applyMatrix4(tongues.matrixWorld);
      assert.ok(vertex.distanceTo(target) < 1e-6, `authored tongue ${i} changed at ${time}`);
      comparisons++;
    }
  }
}

// Generic Level cleanup disposes geometry; preview cleanup calls pad.dispose.
// Both own the same instance buffer, so the two paths cannot leak/double-free it.
let instanceDisposals = 0;
tongues.addEventListener('dispose', () => instanceDisposals++);
tongues.geometry.dispose(); pad.dispose();
assert.equal(instanceDisposals, 1);
const standalone = createWarpPad(), standaloneTongues = standalone.group.getObjectByName('warp flame tongues');
let standaloneDisposals = 0;
standaloneTongues.addEventListener('dispose', () => standaloneDisposals++);
standalone.dispose(); standalone.dispose();
assert.equal(standaloneDisposals, 1);
referenceGeometry.dispose();
console.log(`PASS warp tongues: ${comparisons} exact-pose vertex comparisons, bounds, additive material, collision contract and both buffer disposal paths`);
