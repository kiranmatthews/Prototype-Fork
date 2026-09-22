import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Authoring check: the retarget report is produced from the locally owned
// Meshy FBX. This validates real public skin/keyframes against its IK targets;
// texture appearance and live walk presentation are separate browser checks.
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1024, height: 1024, close() {} });
const kinds = process.argv.slice(2);
if (!kinds.length) kinds.push('grunt', 'spiker', 'turtle', 'charger');
const root = new URL('../', import.meta.url);
const legs = ['frontLeft', 'frontRight', 'hindLeft', 'hindRight'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const kind of kinds) {
  assert.ok(['grunt', 'spiker', 'turtle', 'charger'].includes(kind));
  const bytes = await readFile(new URL(`public/enemies/${kind}.glb`, root));
  const report = JSON.parse(await readFile(new URL(`.img2threejs/enemies/${kind}-walk-retarget.json`, root)));
  const spec = JSON.parse(await readFile(new URL(`tools/enemies/rigs/${kind}.json`, root)));
  assert.equal(hash(bytes), report.outputSha256, `${kind}: report matches actual public GLB`);
  assert.equal(spec.outputSha256, report.outputSha256);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const skinned = [];
  gltf.scene.traverse(node => { if (node.isSkinnedMesh) skinned.push(node); });
  assert.ok(skinned.length, `${kind}: actual skin required`);
  const clip = gltf.animations.find(value => value.name === report.clip);
  assert.ok(clip, `${kind}: real Meshy-derived clip required`);
  assert.equal(clip.duration, 1, `${kind}: original one-second Meshy cycle`);
  const feet = Object.fromEntries(legs.map(leg => {
    const prefix = leg.startsWith('front') ? 'front' : 'hind';
    const side = leg.endsWith('Left') ? 'Left' : 'Right';
    const foot = gltf.scene.getObjectByName(`${prefix}Foot${side}`);
    assert.ok(foot, `${kind}: semantic foot ${leg}`);
    return [leg, { node: foot, rotation: foot.getWorldQuaternion(new THREE.Quaternion()) }];
  }));
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const restBounds = new THREE.Box3(), dynamicBounds = new THREE.Box3();
  for (const mesh of skinned) {
    mesh.skeleton.update();
    const positions = mesh.geometry.attributes.position;
    for (let vertex = 0; vertex < positions.count; vertex++)
      restBounds.expandByPoint(mesh.applyBoneTransform(vertex, new THREE.Vector3().fromBufferAttribute(positions, vertex)).applyMatrix4(mesh.matrixWorld));
  }
  mixer.clipAction(clip).play();
  let maxError = 0, minSkinY = Infinity, maxSkinY = -Infinity, movingVertices = 0;
  const peaks = Object.fromEntries(legs.map(leg => [leg, { frame: 0, height: -Infinity }]));
  const firstVertices = new Map();
  for (let frame = 0; frame < report.frames; frame++) {
    mixer.setTime(frame / report.fps);
    gltf.scene.updateMatrixWorld(true);
    for (const mesh of skinned) mesh.skeleton.update();
    for (const leg of legs) {
      const actual = feet[leg].node.getWorldPosition(new THREE.Vector3());
      const expected = new THREE.Vector3(...report.legs[leg].targets[frame]);
      maxError = Math.max(maxError, actual.distanceTo(expected));
      assert.ok(actual.distanceTo(expected) < 2e-5, `${kind}/${leg}: frame ${frame} misses source-driven IK target`);
      if (actual.y > peaks[leg].height + 1e-7) peaks[leg] = { frame, height: actual.y };
      if (report.legs[leg].planted[frame]) {
        assert.ok(Math.abs(actual.y - report.legs[leg].restAnchor[1]) < 2e-5, `${kind}/${leg}: stance leaves ground plane`);
        const rotation = feet[leg].node.getWorldQuaternion(new THREE.Quaternion());
        assert.ok(rotation.angleTo(feet[leg].rotation) < 1e-4, `${kind}/${leg}: planted sole tilts`);
      }
    }
    for (const mesh of skinned) {
      const positions = mesh.geometry.attributes.position;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const p = mesh.applyBoneTransform(vertex, new THREE.Vector3().fromBufferAttribute(positions, vertex)).applyMatrix4(mesh.matrixWorld);
        assert.ok(Number.isFinite(p.x + p.y + p.z), `${kind}: invalid deformed vertex`);
        minSkinY = Math.min(minSkinY, p.y); maxSkinY = Math.max(maxSkinY, p.y);
        dynamicBounds.expandByPoint(p);
        const key = `${mesh.uuid}:${vertex}`;
        if (frame === 0) firstVertices.set(key, p.clone());
        if (frame === 30 && p.distanceTo(firstVertices.get(key)) > .001) movingVertices++;
        if (frame === 60) assert.ok(p.distanceTo(firstVertices.get(key)) < 2e-5, `${kind}: walk skin has a loop seam`);
      }
    }
  }
  assert.ok(movingVertices > 100, `${kind}: clip failed to deform the actual skin`);
  assert.ok(minSkinY >= -.003, `${kind}: actual paw/skin penetrates the support plane by ${-minSkinY}m`);
  for (const leg of legs) {
    assert.equal(report.legs[leg].targetLiftPeakFrame, report.legs[leg].sourceLiftPeakFrame, `${kind}/${leg}: original Meshy lift timing`);
    assert.equal(peaks[leg].frame, report.legs[leg].targetLiftPeakFrame, `${kind}/${leg}: exported skin rig preserves lift timing`);
  }
  assert.equal(new Set(Object.values(peaks).map(value => value.frame)).size, 4, 'The four-beat source gait must not collapse into diagonal sine stepping');
  console.log(`PASS ${kind}: ${report.frames} actual skin poses, original Meshy footfall peaks, flat stance feet, exact loop seam; IK max error ${maxError.toExponential(2)}, ${movingVertices} moving vertices, skin Y ${minSkinY.toFixed(4)}..${maxSkinY.toFixed(4)}.`);
  console.log(JSON.stringify({ kind, walkSpeed: report.walkSpeed,
    bindBounds: [restBounds.min.toArray(), restBounds.max.toArray()],
    walkBounds: [dynamicBounds.min.toArray(), dynamicBounds.max.toArray()] }));
}
