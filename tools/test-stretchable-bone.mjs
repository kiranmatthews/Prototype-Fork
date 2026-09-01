import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

const importedShaftScaleY = (component, scale) => {
  const metadata = component.root.userData.stretchableBoneRuntime;
  const fraction = metadata.stretchEnd - metadata.stretchStart;
  return component.baseLength * Math.max(0.01, scale - (1 - fraction)) / fraction;
};

const importedDistalPositionY = (component, scale) => {
  const metadata = component.root.userData.stretchableBoneRuntime;
  return -component.baseLength * (scale - (1 - metadata.stretchEnd));
};

const thicknessInfluence = (component) => component.shaft.morphTargetInfluences?.[0] ?? 0;

const signedTetraVolume = (a, b, c) => a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;

const closedRuntimeMorphVolume = (component, influence) => {
  const position = component.shaft.geometry.getAttribute('position');
  const delta = component.shaft.geometry.morphAttributes.position[0];
  const vertex = (index) => new THREE.Vector3(
    position.getX(index) + delta.getX(index) * influence,
    position.getY(index) + delta.getY(index) * influence,
    position.getZ(index) + delta.getZ(index) * influence,
  );
  let volume = 0;
  for (let index = 0; index < position.count; index += 3) {
    volume += signedTetraVolume(vertex(index), vertex(index + 1), vertex(index + 2));
  }
  const stretchFraction = component.root.userData.stretchableBoneRuntime.stretchEnd -
    component.root.userData.stretchableBoneRuntime.stretchStart;
  const cap = (targetY, reverse) => {
    const unique = new Map();
    for (let index = 0; index < position.count; index++) {
      if (Math.abs(position.getY(index) - targetY) > 1e-6) continue;
      const point = vertex(index);
      unique.set(`${point.x},${point.z}`, point);
    }
    const ring = [...unique.values()].sort((a, b) =>
      Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
    if (reverse) ring.reverse();
    for (let index = 0; index < ring.length; index++) {
      volume += signedTetraVolume(
        new THREE.Vector3(0, targetY, 0),
        ring[index],
        ring[(index + 1) % ring.length],
      );
    }
  };
  cap(0, true);
  cap(-stretchFraction, false);
  return Math.abs(volume);
};

try {
  const boneApi = await server.ssrLoadModule('/src/character/stretchableBone.ts');
  const { MESHY_LIMB_BONE_ASSETS } = await server.ssrLoadModule(
    '/src/character/meshyLimbBone.generated.ts');
  const { PlayerAnimationBridge } = await server.ssrLoadModule('/src/animation/bridge.ts');
  const { CharacterProportionLayer } = await server.ssrLoadModule('/src/character/proportionLayer.ts');
  const { IDENTITY_CHARACTER_PROPORTIONS } = await server.ssrLoadModule('/src/character/settings.ts');
  const {
    STRETCHABLE_BONE_MAX_SCALE,
    STRETCHABLE_BONE_MIN_SCALE,
    STRETCHABLE_BONE_SCHEMA_VERSION,
    applyResolvedStretchableBoneLength,
    createStretchableBone,
    directStretchableBones,
    resolveStretchableBone,
    setStretchableBoneLength,
    stretchableBoneShaftLengthRatio,
    stretchableBoneShaftLengthScale,
    stretchableBoneTriangleCount,
    stretchableBoneVolumeMorphInfluence,
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
  assert.equal(primary.root.userData.stretchableBoneRuntime.schemaVersion, 2);
  assert.equal(STRETCHABLE_BONE_SCHEMA_VERSION, 2);
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

  const ivoryBone = createStretchableBone({
    id: 'ivory-upper-arm-left',
    length: 0.22,
    knobRadius: 0.043,
    surface: 'ivory-bone',
    material: clay,
  });
  const ivoryBoneDuplicate = createStretchableBone({
    id: 'ivory-upper-arm-right',
    length: 0.22,
    knobRadius: 0.043,
    surface: 'ivory-bone',
    mirrorX: true,
    material: clay,
  });
  const ivoryRattle = createStretchableBone({
    id: 'ivory-lower-arm-left',
    length: 0.195,
    knobRadius: 0.039,
    surface: 'ivory-rattle',
    material: clay,
  });
  assert.equal(stretchableBoneTriangleCount(ivoryBone), 1454);
  assert.equal(stretchableBoneTriangleCount(ivoryRattle), 1698);
  assert.equal(ivoryBone.shaft.geometry, ivoryBoneDuplicate.shaft.geometry);
  assert.equal(ivoryBone.proximalKnob.geometry, ivoryBoneDuplicate.proximalKnob.geometry);
  assert.equal(ivoryBoneDuplicate.root.scale.x, -1);
  assert.equal(ivoryBone.root.userData.stretchableBoneRuntime.surface, 'ivory-bone');
  assert.equal(ivoryRattle.root.userData.stretchableBoneRuntime.surface, 'ivory-rattle');
  assert.equal(ivoryRattle.root.userData.stretchableBoneRuntime.distalKind, 'insertion-tip');
  assert.equal(ivoryBone.shaft.geometry.morphTargetsRelative, true);
  assert.equal(ivoryBone.shaft.geometry.morphAttributes.position.length, 1);
  assert.equal(ivoryBone.shaft.frustumCulled, false);
  const defaultImported = createStretchableBone({
    id: 'ivory-default-material',
    length: 0.22,
    knobRadius: 0.043,
    surface: 'ivory-bone',
  });
  assert.equal(defaultImported.shaft.material.flatShading, true);
  assert.throws(() => createStretchableBone({
    id: 'invalid-imported-shaft-contract',
    length: 0.22,
    knobRadius: 0.043,
    shaftRadius: 0.036,
    surface: 'ivory-bone',
  }), /shaftRadius is procedural-only/);
  near(thicknessInfluence(ivoryBone), 0);
  for (const [component, asset] of [
    [ivoryBone, MESHY_LIMB_BONE_ASSETS.ivoryBone],
    [ivoryRattle, MESHY_LIMB_BONE_ASSETS.ivoryRattle],
  ]) {
    for (const influence of [0, 1, 2]) {
      const expectedVolume = asset.thicknessMorph.closedRestVolume * (
        1 + 2 * asset.thicknessMorph.volumeA * influence +
        asset.thicknessMorph.volumeB * influence ** 2
      );
      near(closedRuntimeMorphVolume(component, influence), expectedVolume, 2e-9);
    }
  }
  assert.equal(ivoryBone.root.userData.stretchableBoneRuntime.sourceSha256,
    '13d5a1199abf1d39fa448ce9f2607e1358b5442ea27453ce542c1b25f543ed73');
  assert.equal(ivoryRattle.root.userData.stretchableBoneRuntime.sourceSha256,
    '17acdb80d7144ad39786517910f031117d4ff08c5800e93dfb09b166aef66310');
  const ivoryProximalRest = transform(ivoryBone.proximalKnob);
  const ivoryDistalRestScale = ivoryBone.distalKnob.scale.toArray();
  for (const scale of [STRETCHABLE_BONE_MIN_SCALE, 1, STRETCHABLE_BONE_MAX_SCALE]) {
    setStretchableBoneLength(ivoryBone, ivoryBone.baseLength * scale);
    near(ivoryBone.distalSocket.position.y, -ivoryBone.baseLength * scale);
    near(new THREE.Box3().setFromObject(ivoryBone.root).getSize(new THREE.Vector3()).y,
      ivoryBone.baseLength * scale, 2e-6);
    assert.deepEqual(transform(ivoryBone.proximalKnob), ivoryProximalRest);
    assert.deepEqual(ivoryBone.distalKnob.scale.toArray(), ivoryDistalRestScale);
    finiteTree(ivoryBone.root);
  }
  const ivoryResolved = resolveStretchableBone(ivoryBone.root);
  applyResolvedStretchableBoneLength(ivoryResolved, 1);
  near(ivoryBone.shaft.scale.y, ivoryBone.baseLength);
  near(stretchableBoneShaftLengthScale(ivoryResolved, 1), 1);
  near(stretchableBoneShaftLengthScale(ivoryResolved, 1.75),
    (1.75 - (1 - 0.49)) / 0.49);
  near(stretchableBoneShaftLengthRatio(ivoryResolved, 1, 1.75),
    stretchableBoneShaftLengthScale(ivoryResolved, 1.75));
  const ivoryVolume = MESHY_LIMB_BONE_ASSETS.ivoryBone.thicknessMorph;
  const volumeFactor = (influence) =>
    1 + 2 * ivoryVolume.volumeA * influence + ivoryVolume.volumeB * influence ** 2;
  for (const [ratio, baseline] of [
    [stretchableBoneShaftLengthRatio(ivoryResolved, 1, 1.75), 0],
    [stretchableBoneShaftLengthRatio(ivoryResolved, 1.2, 0.96), 0.3],
    [stretchableBoneShaftLengthRatio(ivoryResolved, 1.58, 2.765), 0],
    [stretchableBoneShaftLengthRatio(ivoryResolved, 0.58, 0.58 * 1.75), 0],
  ]) {
    const influence = stretchableBoneVolumeMorphInfluence(ivoryResolved, ratio, baseline);
    assert.ok(influence > -1, 'supported volume correction must not invert the shaft');
    near(volumeFactor(influence) * ratio, volumeFactor(baseline), 1e-9);
  }
  const guardedInfluence = stretchableBoneVolumeMorphInfluence(
    ivoryResolved,
    stretchableBoneShaftLengthRatio(ivoryResolved, 0.58, 0.58 * 1.75),
    -0.42,
  );
  near(guardedInfluence, -0.98);
  assert.ok(Number.isFinite(volumeFactor(guardedInfluence)));
  assert.ok(
    volumeFactor(guardedInfluence) *
      stretchableBoneShaftLengthRatio(ivoryResolved, 0.58, 0.58 * 1.75) >
      volumeFactor(-0.42),
    'non-inversion guard must prefer excess volume over an impossible/inverted solution',
  );
  const rattleResolved = resolveStretchableBone(ivoryRattle.root);
  const rattleRatio = stretchableBoneShaftLengthRatio(
    rattleResolved,
    0.58,
    0.58 * 1.75,
  );
  const rattleBaseline = -0.42;
  const rattleInfluence = stretchableBoneVolumeMorphInfluence(
    rattleResolved,
    rattleRatio,
    rattleBaseline,
  );
  const rattleVolume = MESHY_LIMB_BONE_ASSETS.ivoryRattle.thicknessMorph;
  const rattleVolumeFactor = (influence) =>
    1 + 2 * rattleVolume.volumeA * influence + rattleVolume.volumeB * influence ** 2;
  assert.ok(rattleInfluence > -1);
  near(rattleVolumeFactor(rattleInfluence) * rattleRatio,
    rattleVolumeFactor(rattleBaseline), 1e-9);
  near(ivoryBone.distalKnob.position.y,
    -ivoryBone.baseLength * ivoryResolved.metadata.stretchEnd);
  const rattleProximalRest = transform(ivoryRattle.proximalKnob);
  const rattleInsertionScale = ivoryRattle.distalKnob.scale.toArray();
  for (const scale of [STRETCHABLE_BONE_MIN_SCALE, 1, STRETCHABLE_BONE_MAX_SCALE]) {
    setStretchableBoneLength(ivoryRattle, ivoryRattle.baseLength * scale);
    near(ivoryRattle.distalSocket.position.y, -ivoryRattle.baseLength * scale);
    near(new THREE.Box3().setFromObject(ivoryRattle.root).getSize(new THREE.Vector3()).y,
      ivoryRattle.baseLength * scale, 2e-6);
    assert.deepEqual(transform(ivoryRattle.proximalKnob), rattleProximalRest);
    assert.deepEqual(ivoryRattle.distalKnob.scale.toArray(), rattleInsertionScale);
  }

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
    knobRadius: 0.043,
    surface: 'ivory-bone',
  });
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
  near(runtimeComponent.shaft.scale.y, importedShaftScaleY(runtimeComponent, 1.75));
  near(runtimeComponent.shaft.scale.x, bridgeProximal.scale[0]);
  near(runtimeComponent.shaft.scale.z, bridgeProximal.scale[2]);
  near(thicknessInfluence(runtimeComponent),
    stretchableBoneVolumeMorphInfluence(
      resolveStretchableBone(runtimeComponent.root),
      stretchableBoneShaftLengthRatio(
        resolveStretchableBone(runtimeComponent.root),
        1,
        1.75,
      ),
    ));
  near(runtimeComponent.distalKnob.position.y, importedDistalPositionY(runtimeComponent, 1.75));
  near(runtimeComponent.distalSocket.position.y, -0.22 * 1.75);
  assert.deepEqual(transform(runtimeComponent.proximalKnob), bridgeProximal);
  assert.deepEqual(runtimeComponent.distalKnob.scale.toArray(), bridgeDistalScale);
  bridge.applyDeformations({});
  near(endpoint.position.y, -0.22);
  near(runtimeComponent.shaft.scale.y, importedShaftScaleY(runtimeComponent, 1));
  near(runtimeComponent.shaft.scale.x, bridgeProximal.scale[0]);
  near(thicknessInfluence(runtimeComponent), 0);
  near(runtimeComponent.distalKnob.position.y, importedDistalPositionY(runtimeComponent, 1));

  const proportions = new CharacterProportionLayer(rigRoot);
  proportions.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    upperArmLength: 1.2,
    armThickness: 1.3,
    armKnobSize: 1.4,
  });
  near(endpoint.position.y, -0.22 * 1.2);
  near(runtimeComponent.shaft.scale.y, importedShaftScaleY(runtimeComponent, 1.2));
  near(runtimeComponent.shaft.scale.x, bridgeProximal.scale[0]);
  near(thicknessInfluence(runtimeComponent), 0.3);
  assert.deepEqual(runtimeComponent.proximalKnob.position.toArray(), bridgeProximal.position);
  assert.deepEqual(runtimeComponent.proximalKnob.quaternion.toArray(), bridgeProximal.quaternion);
  for (let axis = 0; axis < 3; axis++) {
    near(runtimeComponent.proximalKnob.scale.toArray()[axis], bridgeProximal.scale[axis] * 1.4);
    near(runtimeComponent.distalKnob.scale.toArray()[axis], bridgeDistalScale[axis] * 1.4);
  }
  near(runtimeComponent.distalKnob.position.y,
    importedDistalPositionY(runtimeComponent, 1.2) + runtimeComponent.baseLength *
      (1 - runtimeComponent.root.userData.stretchableBoneRuntime.stretchEnd) * 0.4);
  runtimeComponent.distalKnob.geometry.computeBoundingBox();
  near(
    runtimeComponent.distalKnob.position.y +
      runtimeComponent.distalKnob.geometry.boundingBox.min.y * runtimeComponent.distalKnob.scale.y,
    runtimeComponent.distalSocket.position.y,
    2e-7,
  );
  near(runtimeComponent.distalSocket.position.y, -0.22 * 1.2);
  proportions.clear();
  near(endpoint.position.y, -0.22);
  near(thicknessInfluence(runtimeComponent), 0);
  assert.deepEqual(transform(runtimeComponent.proximalKnob), bridgeProximal);
  assert.deepEqual(runtimeComponent.distalKnob.scale.toArray(), bridgeDistalScale);
  near(runtimeComponent.distalKnob.position.y, importedDistalPositionY(runtimeComponent, 1));

  bridge.applyDeformations({ 'deform.arm.upper.left.length': 0.8 });
  proportions.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    upperArmLength: 1.2,
    armThickness: 1.3,
    armKnobSize: 1.4,
  });
  near(endpoint.position.y, -0.22 * 0.8 * 1.2);
  near(runtimeComponent.shaft.scale.y, importedShaftScaleY(runtimeComponent, 0.8 * 1.2));
  near(runtimeComponent.distalKnob.position.y,
    importedDistalPositionY(runtimeComponent, 0.8 * 1.2) + runtimeComponent.baseLength *
      (1 - runtimeComponent.root.userData.stretchableBoneRuntime.stretchEnd) * 0.4);
  near(
    runtimeComponent.distalKnob.position.y +
      runtimeComponent.distalKnob.geometry.boundingBox.min.y * runtimeComponent.distalKnob.scale.y,
    runtimeComponent.distalSocket.position.y,
    2e-7,
  );
  near(runtimeComponent.distalSocket.position.y, -0.22 * 0.8 * 1.2);
  near(thicknessInfluence(runtimeComponent),
    stretchableBoneVolumeMorphInfluence(
      resolveStretchableBone(runtimeComponent.root),
      stretchableBoneShaftLengthRatio(
        resolveStretchableBone(runtimeComponent.root),
        1.2,
        0.8 * 1.2,
      ),
      0.3,
    ));
  for (let axis = 0; axis < 3; axis++) {
    near(runtimeComponent.proximalKnob.scale.toArray()[axis], bridgeProximal.scale[axis] * 1.4);
    near(runtimeComponent.distalKnob.scale.toArray()[axis], bridgeDistalScale[axis] * 1.4);
  }
  proportions.clear();
  near(endpoint.position.y, -0.22 * 0.8);
  near(thicknessInfluence(runtimeComponent),
    stretchableBoneVolumeMorphInfluence(
      resolveStretchableBone(runtimeComponent.root),
      stretchableBoneShaftLengthRatio(
        resolveStretchableBone(runtimeComponent.root),
        1,
        0.8,
      ),
    ));
  assert.deepEqual(runtimeComponent.proximalKnob.scale.toArray(), bridgeProximal.scale);
  assert.deepEqual(runtimeComponent.distalKnob.scale.toArray(), bridgeDistalScale);
  near(runtimeComponent.distalKnob.position.y, importedDistalPositionY(runtimeComponent, 0.8));
  bridge.applyDeformations({});
  near(endpoint.position.y, -0.22);
  bridge.applyDeformations({ 'deform.arm.upper.left.length': 1.75 });
  proportions.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, upperArmLength: 1.58 });
  near(endpoint.position.y, -0.22 * 2.765);
  near(runtimeComponent.shaft.scale.y, importedShaftScaleY(runtimeComponent, 2.765));
  near(runtimeComponent.distalKnob.position.y,
    importedDistalPositionY(runtimeComponent, 2.765));
  near(runtimeComponent.distalSocket.position.y, -0.22 * 2.765);
  near(thicknessInfluence(runtimeComponent),
    stretchableBoneVolumeMorphInfluence(
      resolveStretchableBone(runtimeComponent.root),
      stretchableBoneShaftLengthRatio(
        resolveStretchableBone(runtimeComponent.root),
        1.58,
        2.765,
      ),
    ));
  assert.deepEqual(runtimeComponent.proximalKnob.scale.toArray(), bridgeProximal.scale);
  proportions.clear();
  near(endpoint.position.y, -0.22 * 1.75);
  near(thicknessInfluence(runtimeComponent),
    stretchableBoneVolumeMorphInfluence(
      resolveStretchableBone(runtimeComponent.root),
      stretchableBoneShaftLengthRatio(
        resolveStretchableBone(runtimeComponent.root),
        1,
        1.75,
      ),
    ));
  bridge.applyDeformations({});
  near(endpoint.position.y, -0.22);
  near(thicknessInfluence(runtimeComponent), 0);
  const removeOverlay = bridge.setOverlay(({ applyDeformations }) => {
    applyDeformations({ 'deform.arm.upper.left.length': 1.4 });
  });
  bridge.applyOverlay(1 / 60);
  near(endpoint.position.y, -0.22 * 1.4);
  near(thicknessInfluence(runtimeComponent),
    stretchableBoneVolumeMorphInfluence(
      resolveStretchableBone(runtimeComponent.root),
      stretchableBoneShaftLengthRatio(
        resolveStretchableBone(runtimeComponent.root),
        1,
        1.4,
      ),
    ));
  bridge.prepareLegacyPose();
  near(endpoint.position.y, -0.22);
  near(thicknessInfluence(runtimeComponent), 0);
  removeOverlay();

  const design = {
    ...IDENTITY_CHARACTER_PROPORTIONS,
    upperArmLength: 1.2,
    armThickness: 1.3,
  };
  bridge.enterPreview();
  bridge.applyDeformations({ 'deform.arm.upper.left.length': 1.4 });
  proportions.apply(design);
  bridge.resetPreview();
  proportions.apply(design);
  near(endpoint.position.y, -0.22 * 1.2);
  near(thicknessInfluence(runtimeComponent), 0.3);
  proportions.clear();
  near(thicknessInfluence(runtimeComponent), 0);
  bridge.applyDeformations({ 'deform.arm.upper.left.length': 1.4 });
  proportions.apply(design);
  bridge.exitPreview();
  proportions.apply(design);
  near(endpoint.position.y, -0.22 * 1.2);
  near(thicknessInfluence(runtimeComponent), 0.3);
  proportions.clear();
  near(thicknessInfluence(runtimeComponent), 0);

  const removeDesignedOverlay = bridge.setOverlay(({ applyDeformations }) => {
    applyDeformations({ 'deform.arm.upper.left.length': 1.4 });
  });
  bridge.applyOverlay(1 / 60);
  proportions.apply(design);
  removeDesignedOverlay();
  proportions.apply(design);
  near(endpoint.position.y, -0.22 * 1.2);
  near(thicknessInfluence(runtimeComponent), 0.3);
  proportions.clear();
  near(endpoint.position.y, -0.22);
  near(thicknessInfluence(runtimeComponent), 0);
  finiteTree(rigRoot);

  const [
    playerSource,
    labSource,
    mainSource,
    specSource,
    packageSource,
    importerSource,
    generatedSource,
    provenanceSource,
  ] = await Promise.all([
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'src/main.ts'), 'utf8'),
    readFile(resolve(root, 'docs/STRETCH_BONE_SCULPT_SPEC.json'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
    readFile(resolve(root, 'tools/import-meshy-limb-bones.mjs'), 'utf8'),
    readFile(resolve(root, 'src/character/meshyLimbBone.generated.ts'), 'utf8'),
    readFile(resolve(root, 'public/characters/meshy-limb-bones/provenance.json'), 'utf8'),
  ]);
  assert.match(playerSource, /createStretchableBone\(/);
  assert.match(playerSource, /componentCount: this\.stretchableBones\.length/);
  assert.match(playerSource, /limbBoneRig: \{[\s\S]*?schemaVersion: 2/);
  assert.match(playerSource, /lengthMode: 'measured-piecewise-shaft'/);
  assert.match(playerSource, /procedural character requires 8 stretchable limb segments/);
  assert.equal((playerSource.match(/surface: 'ivory-bone'/g) ?? []).length, 1);
  assert.equal((playerSource.match(/surface: 'ivory-rattle'/g) ?? []).length, 3);
  assert.doesNotMatch(playerSource, /const upperArmGeo =/);
  assert.doesNotMatch(playerSource, /const foreArmGeo =/);
  assert.doesNotMatch(playerSource, /const shinGeo =/);
  assert.match(labSource, /Limb bone preview/);
  assert.match(labSource, /Length and thickness keep rigid ends intact/);
  assert.match(labSource, /knob-size sliders widen the authored knobs independently/);
  assert.match(mainSource, /getStretchableBoneDiagnostics/);
  const spec = JSON.parse(specSource);
  assert.equal(spec.targetId, 'stretchable-cartoon-limb-bone');
  assert.equal(spec.productionSurfaceOverride.active, true);
  assert.equal(spec.productionSurfaceOverride.upperArms, 'ivory-bone');
  assert.equal(spec.productionSurfaceOverride.forearmsThighsShins, 'ivory-rattle');
  assert.equal(spec.performanceBudget.fpsTarget, 60);
  assert.equal(spec.qualityTargets.mustMatch.includes(
    'measured shaft-only stretch with invariant rigid-end transforms'), true);
  assert.match(importerSource, /EXPECTED/);
  assert.match(importerSource, /clipPlane/);
  assert.match(generatedSource, /13d5a1199abf1d39fa448ce9f2607e1358b5442ea27453ce542c1b25f543ed73/);
  assert.match(generatedSource, /17acdb80d7144ad39786517910f031117d4ff08c5800e93dfb09b166aef66310/);
  const provenance = JSON.parse(provenanceSource);
  assert.equal(provenance.assets.ivoryBone.bakedTrianglesAfterBoundaryClipping, 1454);
  assert.equal(provenance.assets.ivoryRattle.bakedTrianglesAfterBoundaryClipping, 1698);
  near(provenance.assets.ivoryBone.thicknessMorphVolumePolynomial.A,
    MESHY_LIMB_BONE_ASSETS.ivoryBone.thicknessMorph.volumeA, 1e-14);
  near(provenance.assets.ivoryRattle.thicknessMorphVolumePolynomial.B,
    MESHY_LIMB_BONE_ASSETS.ivoryRattle.thicknessMorph.volumeB, 1e-14);
  assert.equal(provenance.generatedModuleSha256,
    '2ca24fa19b3506455f920582ca05bd784ac4d362957eb06df32346ce224a3377');
  assert.equal(createHash('sha256').update(generatedSource).digest('hex'),
    provenance.generatedModuleSha256);
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts['check:character-lab'], /test-stretchable-bone\.mjs/);

  console.log('PASS high-density stretchable bone geometry, invariant knobbles, deformation layers, and player integration');
} finally {
  await server.close();
}
