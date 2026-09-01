import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const near = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`);
};

const transform = (object) => ({
  position: object.position.toArray(),
  quaternion: object.quaternion.toArray(),
  scale: object.scale.toArray(),
});

const finiteTree = (rootNode) => {
  rootNode.traverse((object) => {
    assert.ok([
      ...object.position.toArray(),
      ...object.quaternion.toArray(),
      ...object.scale.toArray(),
    ].every(Number.isFinite), `${object.name} has a non-finite transform`);
  });
};

try {
  const boneApi = await server.ssrLoadModule('/src/character/stretchableBone.ts');
  const { PlayerAnimationBridge } = await server.ssrLoadModule('/src/animation/bridge.ts');
  const { CharacterProportionLayer } = await server.ssrLoadModule('/src/character/proportionLayer.ts');
  const { DEFAULT_CHARACTER_PROPORTIONS } = await server.ssrLoadModule('/src/character/settings.ts');
  const {
    STRETCHABLE_BONE_MAX_SCALE,
    STRETCHABLE_BONE_MIN_SCALE,
    createStretchableBone,
    directStretchableBones,
    resolveStretchableBone,
    setStretchableBoneLength,
    stretchableBoneTriangleCount,
  } = boneApi;

  const clay = new THREE.MeshPhysicalMaterial({ color: 0xeee6d6, roughness: 0.7 });
  const primary = createStretchableBone({
    id: 'test-upper-arm-left',
    length: 0.22,
    shaftRadius: 0.036,
    knobRadius: 0.043,
    material: clay,
  });
  const duplicate = createStretchableBone({
    id: 'test-upper-arm-right',
    length: 0.22,
    shaftRadius: 0.036,
    knobRadius: 0.043,
    material: clay,
  });
  assert.equal(stretchableBoneTriangleCount(primary), 5312);
  assert.equal(primary.shaft.geometry, duplicate.shaft.geometry);
  assert.equal(primary.proximalKnob.geometry, duplicate.proximalKnob.geometry);
  assert.equal(primary.distalKnob.geometry, duplicate.distalKnob.geometry);
  assert.equal(primary.root.userData.stretchableBoneRuntime.schemaVersion, 1);
  assert.deepEqual(primary.root.userData.stretchableBoneRuntime.axis, [0, -1, 0]);
  near(primary.maxScale, 2.765);
  assert.equal(resolveStretchableBone(primary.root).shaft, primary.shaft);
  assert.deepEqual(directStretchableBones(new THREE.Group()), []);
  assert.ok(primary.shaft.geometry.attributes.position.count > 700);
  assert.equal(primary.shaft.geometry.attributes.normal.count,
    primary.shaft.geometry.attributes.position.count);
  const distinctKnobDepth = new Set();
  const knobPosition = primary.proximalKnob.geometry.attributes.position;
  for (let index = 0; index < knobPosition.count; index++) {
    distinctKnobDepth.add(Math.round(knobPosition.getZ(index) * 1000));
  }
  assert.ok(distinctKnobDepth.size > 20, 'double-lobe knobble is not a genuine smooth volume');
  const coincidentNormals = new Map();
  const knobNormal = primary.proximalKnob.geometry.attributes.normal;
  for (let index = 0; index < knobPosition.count; index++) {
    const key = [
      Math.round(knobPosition.getX(index) * 100000),
      Math.round(knobPosition.getY(index) * 100000),
      Math.round(knobPosition.getZ(index) * 100000),
    ].join(':');
    const entries = coincidentNormals.get(key) ?? [];
    entries.push(new THREE.Vector3().fromBufferAttribute(knobNormal, index).normalize());
    coincidentNormals.set(key, entries);
  }
  let worstCoincidentNormalAngle = 0;
  for (const normals of coincidentNormals.values()) {
    for (let leftIndex = 0; leftIndex < normals.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < normals.length; rightIndex++) {
        worstCoincidentNormalAngle = Math.max(
          worstCoincidentNormalAngle,
          normals[leftIndex].angleTo(normals[rightIndex]),
        );
      }
    }
  }
  assert.ok(worstCoincidentNormalAngle <= THREE.MathUtils.degToRad(1),
    `visible knobble seam normals diverge by ${THREE.MathUtils.radToDeg(worstCoincidentNormalAngle)}°`);

  const proximalRest = transform(primary.proximalKnob);
  const distalRestScale = primary.distalKnob.scale.toArray();
  const distalRestQuaternion = primary.distalKnob.quaternion.toArray();
  for (const scale of [STRETCHABLE_BONE_MIN_SCALE, 1, STRETCHABLE_BONE_MAX_SCALE]) {
    const length = setStretchableBoneLength(primary, primary.baseLength * scale);
    near(length, primary.baseLength * scale);
    near(primary.shaft.scale.y, length);
    near(primary.distalKnob.position.y, -length);
    near(primary.distalSocket.position.y, -length);
    assert.deepEqual(transform(primary.proximalKnob), proximalRest);
    assert.deepEqual(primary.distalKnob.scale.toArray(), distalRestScale);
    assert.deepEqual(primary.distalKnob.quaternion.toArray(), distalRestQuaternion);
    primary.root.updateMatrixWorld(true);
    const shaftBox = new THREE.Box3().setFromObject(primary.shaft);
    assert.ok(shaftBox.intersectsBox(new THREE.Box3().setFromObject(primary.proximalKnob)));
    assert.ok(shaftBox.intersectsBox(new THREE.Box3().setFromObject(primary.distalKnob)));
    finiteTree(primary.root);
  }
  for (let iteration = 0; iteration < 100; iteration++) {
    setStretchableBoneLength(primary, primary.baseLength * 1.75);
  }
  const repeated = transform(primary.distalKnob);
  setStretchableBoneLength(primary, primary.baseLength * 1.75);
  assert.deepEqual(transform(primary.distalKnob), repeated, 'absolute length writes accumulate');

  const hiddenStart = createStretchableBone({
    id: 'test-lower-arm-left',
    length: 0.195,
    shaftRadius: 0.033,
    knobRadius: 0.039,
    showProximalKnob: false,
  });
  assert.equal(hiddenStart.proximalKnob, null);
  assert.equal(stretchableBoneTriangleCount(hiddenStart), 3456);
  assert.deepEqual(hiddenStart.root.userData.stretchableBoneRuntime.invariantParts, ['distal-knob']);

  const playerRoot = new THREE.Group();
  const rigRoot = new THREE.Group();
  rigRoot.name = 'rig-root';
  playerRoot.add(rigRoot);
  const anchor = new THREE.Bone();
  anchor.name = 'shoulder-left';
  rigRoot.add(anchor);
  const endpoint = new THREE.Bone();
  endpoint.name = 'elbow-left';
  endpoint.position.y = -0.22;
  anchor.add(endpoint);
  const runtimeComponent = createStretchableBone({
    id: 'runtime-upper-arm-left',
    length: 0.22,
    shaftRadius: 0.036,
    knobRadius: 0.043,
  });
  runtimeComponent.proximalKnob.position.x = 0.035;
  anchor.add(runtimeComponent.root);
  rigRoot.userData.sculptRuntime = {
    schemaVersion: 1,
    rigId: 'stretch-bone-test',
    rigName: 'Stretch Bone Test',
    joints: { shoulderLeft: anchor.name, elbowLeft: endpoint.name },
    deformations: [{
      controlId: 'deform.arm.upper.left.length',
      jointId: 'shoulderLeft',
      downstreamJointIds: ['elbowLeft'],
      lengthAxis: [0, -1, 0],
      min: 0.55,
      max: 1.75,
      volume: 'preserve-cross-section-area',
    }],
  };

  const bridge = new PlayerAnimationBridge(playerRoot, rigRoot);
  const bridgeProximal = transform(runtimeComponent.proximalKnob);
  const bridgeDistalScale = runtimeComponent.distalKnob.scale.toArray();
  bridge.applyDeformations({ 'deform.arm.upper.left.length': 1.75 });
  near(endpoint.position.y, -0.22 * 1.75);
  near(runtimeComponent.shaft.scale.y, 0.22 * 1.75);
  near(runtimeComponent.shaft.scale.x, 0.036 / Math.sqrt(1.75));
  near(runtimeComponent.shaft.scale.z, 0.036 / Math.sqrt(1.75));
  near(runtimeComponent.distalKnob.position.y, -0.22 * 1.75);
  assert.deepEqual(transform(runtimeComponent.proximalKnob), bridgeProximal);
  assert.deepEqual(runtimeComponent.distalKnob.scale.toArray(), bridgeDistalScale);
  bridge.applyDeformations({});
  near(endpoint.position.y, -0.22);
  near(runtimeComponent.shaft.scale.y, 0.22);
  near(runtimeComponent.shaft.scale.x, 0.036);
  near(runtimeComponent.distalKnob.position.y, -0.22);

  const proportions = new CharacterProportionLayer(rigRoot);
  proportions.apply({
    ...DEFAULT_CHARACTER_PROPORTIONS,
    upperArmLength: 1.2,
    armThickness: 1.3,
  });
  near(endpoint.position.y, -0.22 * 1.2);
  near(runtimeComponent.shaft.scale.y, 0.22 * 1.2);
  near(runtimeComponent.shaft.scale.x, 0.036 * 1.3);
  near(runtimeComponent.proximalKnob.scale.x, bridgeProximal.scale[0] * 1.3);
  near(runtimeComponent.proximalKnob.scale.y, bridgeProximal.scale[1] * 1.3);
  near(runtimeComponent.proximalKnob.scale.z, bridgeProximal.scale[2] * 1.3);
  near(runtimeComponent.proximalKnob.position.x, bridgeProximal.position[0] * 1.3);
  near(runtimeComponent.distalKnob.position.y, -0.22 * 1.2);
  assert.equal(
    runtimeComponent.proximalKnob.scale.x / bridgeProximal.scale[0],
    runtimeComponent.proximalKnob.scale.y / bridgeProximal.scale[1],
    'thickness changed the knobble non-uniformly',
  );
  proportions.clear();
  near(endpoint.position.y, -0.22);
  assert.deepEqual(transform(runtimeComponent.proximalKnob), bridgeProximal);

  bridge.applyDeformations({ 'deform.arm.upper.left.length': 0.8 });
  proportions.apply({ ...DEFAULT_CHARACTER_PROPORTIONS, upperArmLength: 1.2 });
  near(endpoint.position.y, -0.22 * 0.8 * 1.2);
  near(runtimeComponent.shaft.scale.y, 0.22 * 0.8 * 1.2);
  near(runtimeComponent.distalKnob.position.y, -0.22 * 0.8 * 1.2);
  assert.deepEqual(runtimeComponent.proximalKnob.scale.toArray(), bridgeProximal.scale);
  proportions.clear();
  near(endpoint.position.y, -0.22 * 0.8);
  bridge.applyDeformations({});
  near(endpoint.position.y, -0.22);
  bridge.applyDeformations({ 'deform.arm.upper.left.length': 1.75 });
  proportions.apply({ ...DEFAULT_CHARACTER_PROPORTIONS, upperArmLength: 1.58 });
  near(endpoint.position.y, -0.22 * 2.765);
  near(runtimeComponent.shaft.scale.y, 0.22 * 2.765);
  near(runtimeComponent.distalKnob.position.y, -0.22 * 2.765);
  assert.deepEqual(runtimeComponent.proximalKnob.scale.toArray(), bridgeProximal.scale);
  proportions.clear();
  near(endpoint.position.y, -0.22 * 1.75);
  bridge.applyDeformations({});
  near(endpoint.position.y, -0.22);
  finiteTree(rigRoot);

  const [playerSource, labSource, mainSource, specSource, packageSource] = await Promise.all([
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'src/main.ts'), 'utf8'),
    readFile(resolve(root, 'docs/STRETCH_BONE_SCULPT_SPEC.json'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
  ]);
  assert.match(playerSource, /createStretchableBone\(/);
  assert.match(playerSource, /componentCount: this\.stretchableBones\.length/);
  assert.match(playerSource, /procedural character requires 8 stretchable limb segments/);
  assert.doesNotMatch(playerSource, /const upperArmGeo =/);
  assert.doesNotMatch(playerSource, /const foreArmGeo =/);
  assert.doesNotMatch(playerSource, /const shinGeo =/);
  assert.match(labSource, /Limb bone preview/);
  assert.match(labSource, /only each smooth shaft stretches/);
  assert.match(mainSource, /getStretchableBoneDiagnostics/);
  const spec = JSON.parse(specSource);
  assert.equal(spec.targetId, 'stretchable-cartoon-limb-bone');
  assert.equal(spec.performanceBudget.fpsTarget, 60);
  assert.equal(spec.qualityTargets.mustMatch.includes('shaft-only stretch with invariant knobble transforms'), true);
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts['check:character-lab'], /test-stretchable-bone\.mjs/);

  console.log('PASS high-density stretchable bone geometry, invariant knobbles, deformation layers, and player integration');
} finally {
  await server.close();
}
