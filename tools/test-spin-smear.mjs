import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const code = ts.transpileModule(await readFile(new URL('../src/spin-effects/smear.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
new Function('module', 'exports', 'require', code)(module, module.exports, name => {
  if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return geometryUtils;
  assert.equal(name, 'three'); return THREE;
});
const { captureSpinCharacter, bakeSpinSmear, DEFAULT_SPIN_SMEAR, disposeSpinModel, normalizeSpinSmear } = module.exports;
const scene = new THREE.Scene(), reference = new THREE.Group(), rider = new THREE.Group();
reference.position.set(10, 3, -7); reference.rotation.y = .7; scene.add(reference); reference.add(rider);
const geometry = new THREE.BoxGeometry(.7, 1.2, .5, 5, 8, 5);
const morph = geometry.attributes.position.clone();
for (let i = 0; i < morph.count; i++) morph.setX(i, .1);
geometry.morphAttributes.position = [morph]; geometry.morphTargetsRelative = true;
const texture = new THREE.Texture(), material = new THREE.MeshLambertMaterial({ color: 0xd93728, map: texture });
const mesh = new THREE.Mesh(geometry, material); mesh.position.y = .6; mesh.scale.x = -1;
mesh.morphTargetInfluences[0] = .6; rider.add(mesh);
const hidden = new THREE.Mesh(new THREE.BoxGeometry(), material); hidden.visible = false; rider.add(hidden);
const skinGeometry = new THREE.BufferGeometry();
skinGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .4, 0, 0, 0, .4, 0], 3));
skinGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
skinGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
const skin = new THREE.SkinnedMesh(skinGeometry, material), rootBone = new THREE.Bone(), tip = new THREE.Bone();
tip.position.y = .4; rootBone.add(tip); skin.add(rootBone); rider.add(skin);
skin.bind(new THREE.Skeleton([rootBone, tip])); tip.position.y += .25;
scene.updateMatrixWorld(true); skin.skeleton.update();
const before = [...geometry.attributes.position.array];
const source = captureSpinCharacter(rider, reference);
assert.equal(source.children.length, 2, 'hidden alternate character surface was baked');
assert.notEqual(source.children[0].geometry, geometry);
assert.notEqual(source.children[0].material, material);
assert.equal(source.children[0].material.map, texture, 'current character texture was replaced');
const capturedGeometry = source.children[0].geometry;
const center = capturedGeometry.boundingBox.getCenter(new THREE.Vector3());
const outward = new THREE.Vector3().fromBufferAttribute(capturedGeometry.attributes.position, 0).sub(center);
assert.ok(new THREE.Vector3().fromBufferAttribute(capturedGeometry.attributes.normal, 0).dot(outward) > 0,
  'a reflected limb was baked inside out');
const frozenPosition = source.children[0].geometry.attributes.position.array.slice();
mesh.position.x = 8; mesh.morphTargetInfluences[0] = 1;
assert.deepEqual(source.children[0].geometry.attributes.position.array, frozenPosition, 'the snapshot follows the live character');
const expectedSkin = skin.getVertexPosition(1, new THREE.Vector3());
assert.ok(new THREE.Vector3().fromBufferAttribute(source.children[1].geometry.attributes.position, 1).distanceTo(expectedSkin) < 1e-5,
  'skinned hand vertices were frozen in their bind pose');
for (const object of source.children) {
  assert.equal(object.isSkinnedMesh, undefined);
  assert.equal(object.geometry.attributes.skinWeight, undefined);
  assert.deepEqual(object.geometry.morphAttributes, {});
}
const baked = bakeSpinSmear(source, DEFAULT_SPIN_SMEAR), repeat = bakeSpinSmear(source, DEFAULT_SPIN_SMEAR);
for (let i = 0; i < baked.children.length; i++) {
  const a = baked.children[i].geometry.attributes.position.array;
  assert.ok(a.every(Number.isFinite));
  assert.deepEqual(a, repeat.children[i].geometry.attributes.position.array, 'bakes are not deterministic');
  if (i < source.children.length)
    assert.notDeepEqual(a, source.children[i].geometry.attributes.position.array, 'radial distortion left the character unchanged');
}
assert.equal(baked.children.length, source.children.length * 2, 'the rotated model copies are missing');
for (let i = 0; i < source.children.length; i++) {
  const trail = baked.children[i + source.children.length];
  assert.equal(trail.geometry.attributes.position.count, source.children[i].geometry.attributes.position.count * (DEFAULT_SPIN_SMEAR.trailCopies - 1));
  assert.equal(trail.geometry.attributes.color.itemSize, 4);
  assert.equal(trail.material.transparent, true);
  assert.equal(trail.material.depthWrite, false, 'blur copies occlude each other instead of overlapping');
}
assert.ok(Math.abs(new THREE.Box3().setFromObject(baked).min.y) < 1e-5, 'baked feet float away from the player origin');
const fixed = baked.children[0].geometry.attributes.position.array.slice();
for (let i = 0; i < 40; i++) { baked.rotation.y += .2; baked.updateMatrixWorld(true); }
assert.deepEqual(baked.children[0].geometry.attributes.position.array, fixed, 'spin mutates the baked surface');
const invalid = normalizeSpinSmear({ radialScale: Infinity, heightScale: -5, sweepDegrees: 2000 });
assert.equal(invalid.radialScale, DEFAULT_SPIN_SMEAR.radialScale);
assert.equal(invalid.heightScale, .45); assert.equal(invalid.sweepDegrees, 360);
let sourceDisposals = 0; geometry.addEventListener('dispose', () => sourceDisposals++);
disposeSpinModel(source); disposeSpinModel(baked); disposeSpinModel(repeat);
assert.equal(sourceDisposals, 0, 'replacing a bake disposes the gameplay character');
assert.deepEqual([...geometry.attributes.position.array], before, 'baking changed the live character geometry');
console.log('PASS current textured/morphed/skinned character snapshot, deterministic radial distortion, merged overlapping rotated blur copies, grounded static bake and independent geometry lifetime');
