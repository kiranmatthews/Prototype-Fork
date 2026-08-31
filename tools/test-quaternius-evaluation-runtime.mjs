import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const modulePath = resolve(root, 'src/character/quaterniusEvaluationModel.ts');
const assetPath = resolve(root, 'public/characters/quaternius-female/mannequin-f.glb');

function compileEvaluationModule(source) {
  const output = ts.transpileModule(
    source.replaceAll('import.meta.env.BASE_URL', JSON.stringify('/')),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, (specifier) => {
    if (specifier === 'three') return THREE;
    if (specifier.endsWith('GLTFLoader.js')) return { GLTFLoader };
    throw new Error(`unexpected module import: ${specifier}`);
  });
  return module.exports;
}

function localPose(bone) {
  return {
    position: bone.position.toArray(),
    quaternion: bone.quaternion.toArray(),
    scale: bone.scale.toArray(),
  };
}

function makeSourceRig() {
  const rider = new THREE.Group();
  rider.name = 'procedural-rider';
  const body = new THREE.Group();
  body.name = 'source-body-metadata';
  body.scale.set(1.18, 1.36, 1.18);
  body.add(rider);
  const bones = new Map();
  const makeBone = (name, parent, position) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.fromArray(position);
    parent.add(bone);
    bones.set(name, bone);
    return bone;
  };

  // Match the production procedural rig's short, stylized proportions. This
  // is exactly the proportion mismatch presentation IK exists to absorb.
  const hips = makeBone('hips', rider, [0, 0.71, 0]);
  const torsoRoot = makeBone('torso-root', hips, [0, 0, 0]);
  const spine = makeBone('spine', torsoRoot, [0, 0.11, 0]);
  const chest = makeBone('chest', spine, [0, 0.24, 0]);
  const neck = makeBone('neck', chest, [0, 0.265, 0]);
  makeBone('head', neck, [0, 0.095, 0]);

  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    const clavicle = makeBone(`clavicle-${side}`, chest, [sign * 0.13, 0.08, 0]);
    const shoulder = makeBone(`shoulder-${side}`, clavicle, [sign * 0.12, 0, 0]);
    const elbow = makeBone(`elbow-${side}`, shoulder, [0, -0.22, 0]);
    const wrist = makeBone(`wrist-${side}`, elbow, [0, -0.195, 0]);
    const grip = new THREE.Object3D();
    grip.name = `socket-grip-${side}`;
    grip.position.set(0, -0.14, 0.045);
    wrist.add(grip);

    const hip = makeBone(`hip-${side}`, hips, [sign * 0.115, 0, 0]);
    const knee = makeBone(`knee-${side}`, hip, [0, -0.25, 0]);
    const ankle = makeBone(`ankle-${side}`, knee, [0, -0.24, 0]);
    makeBone(`toe-${side}`, ankle, [0, 0, 0.16]);
    const foot = new THREE.Object3D();
    foot.name = `socket-foot-${side}`;
    foot.position.set(0, -0.05, 0.065);
    ankle.add(foot);
  }

  const joints = {
    hips: 'hips', torsoRoot: 'torso-root', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head',
    clavicleLeft: 'clavicle-left', shoulderLeft: 'shoulder-left', elbowLeft: 'elbow-left', wristLeft: 'wrist-left',
    clavicleRight: 'clavicle-right', shoulderRight: 'shoulder-right', elbowRight: 'elbow-right', wristRight: 'wrist-right',
    hipLeft: 'hip-left', kneeLeft: 'knee-left', ankleLeft: 'ankle-left', toeLeft: 'toe-left',
    hipRight: 'hip-right', kneeRight: 'knee-right', ankleRight: 'ankle-right', toeRight: 'toe-right',
  };
  const bindPose = Object.fromEntries(Object.entries(joints).map(([semantic, name]) => [semantic, localPose(bones.get(name))]));
  const retargetPose = structuredClone(bindPose);
  retargetPose.shoulderLeft.quaternion = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  retargetPose.shoulderRight.quaternion = [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
  body.userData.sculptRuntime = { joints, bindPose, retargetPose };
  rider.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([...bones.values()]);
  skeleton.calculateInverses();
  return { rider, body, bones, skeleton };
}

function finiteInfluences(mesh) {
  return mesh.morphTargetInfluences.every(Number.isFinite);
}

const [source, bytes] = await Promise.all([readFile(modulePath, 'utf8'), readFile(assetPath)]);
const api = compileEvaluationModule(source);
const gltf = await new Promise((resolveScene, reject) => {
  new GLTFLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
    resolveScene,
    reject,
  );
});
const originalMeshes = [];
gltf.scene.traverse((object) => {
  if (object.isSkinnedMesh) originalMeshes.push({ mesh: object, geometry: object.geometry, material: object.material });
});
assert.equal(originalMeshes.length, 2, 'UAL2 parses into two shared-skinned primitives');

const sourceRig = makeSourceRig();
const model = api.createQuaterniusEvaluationModelFromScene(gltf.scene, {
  parent: sourceRig.rider,
  sourceRoot: sourceRig.body,
  sourcePoseRoot: sourceRig.rider,
  sourceSkeleton: sourceRig.skeleton,
});

assert.equal(model.readiness, 'ready');
assert.equal(model.skinnedMeshes.length, 2);
for (const { mesh, geometry, material } of originalMeshes) {
  assert.notEqual(mesh.geometry, geometry, 'generated targets live on cloned geometry');
  assert.equal(mesh.material, material, 'authored neutral mannequin material is preserved');
  assert.equal(mesh.frustumCulled, false);
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, true);
  assert.equal(mesh.geometry.morphAttributes.position.length, 14, 'ten volume plus four shoulder position targets');
  assert.equal(mesh.geometry.morphAttributes.normal.length, 14, 'every corrective has a normal delta target');
  assert.deepEqual(
    mesh.geometry.morphAttributes.normal.map((attribute) => attribute.name),
    mesh.geometry.morphAttributes.position.map((attribute) => attribute.name),
  );
}
assert.equal(model.diagnostics.generatedMorphTargetCount, 28);
assert.equal(model.diagnostics.generatedNormalMorphTargetCount, 28);

const targetSkeleton = model.targetSkeleton;
const targetBone = (name) => targetSkeleton.bones.find((bone) => bone.name === name);
sourceRig.rider.updateMatrixWorld(true);

// The source bind stance is arms-down while its published canonical pose is T.
// After retargeting, the target's upper-arm endpoint must follow that live bind stance.
model.updateAfterSourcePose();
const upperArm = targetBone('upperarm_l').getWorldPosition(new THREE.Vector3());
const lowerArm = targetBone('lowerarm_l').getWorldPosition(new THREE.Vector3());
assert.ok(lowerArm.y < upperArm.y - Math.abs(lowerArm.x - upperArm.x), 'canonical-world delta returns the target arm to bind-down');
const leftKnee = targetBone('calf_l').getWorldPosition(new THREE.Vector3());
const rightKnee = targetBone('calf_r').getWorldPosition(new THREE.Vector3());
const leftFoot = targetBone('foot_l').getWorldPosition(new THREE.Vector3());
const rightFoot = targetBone('foot_r').getWorldPosition(new THREE.Vector3());
assert.ok(leftKnee.x > 0 && leftFoot.x > 0, 'left leg remains in the anatomical +X lane');
assert.ok(rightKnee.x < 0 && rightFoot.x < 0, 'right leg remains in the anatomical -X lane');
assert.ok(leftKnee.x - rightKnee.x > 0.1, 'straight source legs do not select a medial scissor pole');

// Stretch one source segment; the target endpoint and relative volume morph use
// precisely the same world-space source ratio.
sourceRig.bones.get('elbow-left').position.y = -0.33;
sourceRig.rider.updateMatrixWorld(true);
model.updateAfterSourcePose();
const upperArmLength = model.diagnostics.lengthScales['arm.upper.left'];
assert.ok(Math.abs(upperArmLength - 1.5) < 1e-6, 'source endpoint distance produces the deformation ratio');
const armVolume = model.skinnedMeshes[0].morphTargetDictionary['sol-volume:arm.upper.left'];
assert.ok(Math.abs(model.skinnedMeshes[0].morphTargetInfluences[armVolume] - (1 / Math.sqrt(1.5) - 1)) < 1e-6);
assert.ok(finiteInfluences(model.skinnedMeshes[0]) && finiteInfluences(model.skinnedMeshes[1]));
assert.ok(
  model.diagnostics.contactErrors.footLeft < 0.02,
  `left sole contact reaches its source socket (${model.diagnostics.contactErrors.footLeft})`,
);
assert.ok(
  model.diagnostics.contactErrors.footRight < 0.02,
  `right sole contact reaches its source socket (${model.diagnostics.contactErrors.footRight})`,
);

// The same generated target expands radially for squash; negative and positive
// influences therefore cover both directions without scaling any child bone.
sourceRig.bones.get('elbow-left').position.y = -0.132;
sourceRig.rider.updateMatrixWorld(true);
model.updateAfterSourcePose();
const squashedUpperArmLength = model.diagnostics.lengthScales['arm.upper.left'];
assert.ok(Math.abs(squashedUpperArmLength - 0.6) < 1e-6, 'source endpoint supports limb squash');
assert.ok(
  Math.abs(
    model.skinnedMeshes[0].morphTargetInfluences[armVolume] -
    (1 / Math.sqrt(0.6) - 1)
  ) < 1e-6,
  'squashed limb expands radially to preserve volume',
);
assert.ok(finiteInfluences(model.skinnedMeshes[0]) && finiteInfluences(model.skinnedMeshes[1]));

model.reset();
assert.ok(model.skinnedMeshes.every((mesh) => mesh.morphTargetInfluences.every((value) => value === 0)));
assert.deepEqual(model.diagnostics.contactErrors, {
  footLeft: null, footRight: null, handLeft: null, handRight: null,
});
model.dispose();
assert.equal(model.readiness, 'disposed');
assert.equal(model.scene, null);
assert.equal(model.root.parent, null);

console.log('PASS Quaternius evaluation runtime retarget, morph, contact IK, reset, and disposal');
