import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const noop = () => {};
globalThis.document = {
  createElementNS: () => ({ addEventListener: noop, removeEventListener: noop, set src(_value) {} }),
};
globalThis.window = { location: { href: 'http://headless.invalid/' } };

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const near = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`);
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function rigFixture() {
  const mount = new THREE.Group();
  mount.name = 'procedural-rider';
  const torsoRoot = new THREE.Bone();
  torsoRoot.name = 'torso-root';
  torsoRoot.position.y = 0.71;
  mount.add(torsoRoot);
  const spine = new THREE.Bone();
  spine.name = 'spine';
  spine.position.y = 0.11;
  torsoRoot.add(spine);
  const chest = new THREE.Bone();
  chest.name = 'chest';
  chest.position.y = 0.24;
  spine.add(chest);
  const neck = new THREE.Bone();
  neck.name = 'neck';
  neck.position.y = 0.265;
  chest.add(neck);
  const clavicleLeft = new THREE.Bone();
  clavicleLeft.name = 'clavicle-left';
  clavicleLeft.position.set(0.1, 0.16, 0);
  chest.add(clavicleLeft);
  const clavicleRight = new THREE.Bone();
  clavicleRight.name = 'clavicle-right';
  clavicleRight.position.set(-0.1, 0.16, 0);
  chest.add(clavicleRight);
  mount.userData.sculptRuntime = {
    schemaVersion: 1,
    rigId: 'meshy-torso-test',
    rigName: 'Meshy Torso Test',
    joints: {
      torsoRoot: torsoRoot.name,
      spine: spine.name,
      chest: chest.name,
      neck: neck.name,
      clavicleLeft: clavicleLeft.name,
      clavicleRight: clavicleRight.name,
    },
    deformations: [
      {
        controlId: 'deform.torso.length',
        jointId: 'spine',
        downstreamJointIds: ['chest'],
        lengthAxis: [0, 1, 0],
        min: 0.55,
        max: 1.5,
        volume: 'preserve-cross-section-area',
      },
      {
        controlId: 'deform.torso.length',
        jointId: 'chest',
        downstreamJointIds: ['neck', 'clavicleLeft', 'clavicleRight'],
        lengthAxis: [0, 1, 0],
        min: 0.55,
        max: 1.5,
        volume: 'preserve-cross-section-area',
      },
    ],
  };
  return { mount, torsoRoot, spine, chest, neck, clavicleLeft, clavicleRight };
}

function skinnedBounds(mesh) {
  mesh.parent.updateMatrixWorld(true);
  mesh.skeleton.update();
  const position = mesh.geometry.getAttribute('position');
  const point = new THREE.Vector3();
  const bounds = new THREE.Box3().makeEmpty();
  for (let index = 0; index < position.count; index++) {
    mesh.getVertexPosition(index, point);
    point.applyMatrix4(mesh.matrixWorld);
    bounds.expandByPoint(point);
  }
  return bounds;
}

try {
  const torsoApi = await server.ssrLoadModule('/src/character/meshyTorso.ts');
  const { PlayerAnimationBridge } = await server.ssrLoadModule('/src/animation/bridge.ts');
  const { CharacterProportionLayer } = await server.ssrLoadModule(
    '/src/character/proportionLayer.ts');
  const { IDENTITY_CHARACTER_PROPORTIONS } = await server.ssrLoadModule(
    '/src/character/settings.ts');
  const { MESHY_TORSO_ASSET } = await server.ssrLoadModule(
    '/src/character/meshyTorso.generated.ts');
  const {
    MESHY_TORSO_REST_SCALE,
    createMeshyTorso,
    meshyTorsoTextureDiagnostics,
    meshyTorsoLengthRatio,
  } = torsoApi;

  const rig = rigFixture();
  const component = createMeshyTorso(rig);
  assert.equal(component.mesh.parent, rig.mount);
  assert.equal(component.mesh.isSkinnedMesh, true);
  assert.equal(component.triangles, 10889);
  assert.equal(component.mesh.geometry.getAttribute('position').count, 6758);
  assert.equal(component.mesh.geometry.getAttribute('normal'), undefined);
  assert.equal(component.mesh.geometry.getAttribute('uv').count, 6758);
  assert.equal(component.mesh.geometry.getAttribute('skinIndex').count, 6758);
  assert.equal(component.mesh.geometry.getAttribute('skinWeight').count, 6758);
  assert.equal(component.mesh.geometry.getIndex().count, 32667);
  assert.equal(MESHY_TORSO_ASSET.indexedVertices, 6758);
  assert.equal(component.mesh.geometry.morphAttributes.position.length, 2);
  assert.equal(component.mesh.geometry.morphTargetsRelative, true);
  assert.deepEqual(component.mesh.morphTargetDictionary, {
    'torso-width': 0,
    'torso-depth': 1,
  });
  assert.deepEqual(component.mesh.morphTargetInfluences, [0, 0]);
  assert.deepEqual(component.skeleton.bones.map((bone) => bone.name), [
    'torso-root', 'spine', 'chest', 'neck', 'clavicle-left', 'clavicle-right',
  ]);
  assert.equal(component.mesh.frustumCulled, false);
  assert.equal(component.mesh.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(component.mesh.material.normalMap, null);
  assert.equal(component.mesh.material.roughnessMap.colorSpace, THREE.NoColorSpace);
  assert.equal(component.mesh.material.metalnessMap, null);
  assert.equal(component.mesh.material.metalness, 0);
  assert.equal(component.mesh.material.flatShading, true);
  assert.deepEqual(meshyTorsoTextureDiagnostics(), {
    state: 'loading', loaded: 0, requested: 2, error: null,
  });

  const weights = component.mesh.geometry.getAttribute('skinWeight');
  const indices = component.mesh.geometry.getAttribute('skinIndex');
  let clavicleWeighted = 0;
  for (let index = 0; index < weights.count; index++) {
    const total = weights.getX(index) + weights.getY(index) +
      weights.getZ(index) + weights.getW(index);
    near(total, 1, 2e-7);
    for (const value of [
      indices.getX(index), indices.getY(index), indices.getZ(index), indices.getW(index),
    ]) assert.ok(value >= 0 && value < 6);
    if (weights.getZ(index) > 0.05) clavicleWeighted++;
  }
  assert.ok(clavicleWeighted > 500, 'upper outer surface must follow the clavicles');

  const restBounds = skinnedBounds(component.mesh);
  near(restBounds.min.y, 0.71, 2e-6);
  near(restBounds.max.y, 1.325, 2e-6);
  near(restBounds.getSize(new THREE.Vector3()).x, 0.6875 * 0.615, 2e-6);
  const restCenter = restBounds.getCenter(new THREE.Vector3());
  rig.mount.position.set(2, 3, 4);
  rig.mount.rotation.y = 0.4;
  rig.mount.scale.setScalar(2);
  rig.mount.updateMatrixWorld(true);
  const transformedBounds = skinnedBounds(component.mesh);
  const expectedCenter = restCenter.clone().applyMatrix4(rig.mount.matrixWorld);
  const transformedCenter = transformedBounds.getCenter(new THREE.Vector3());
  near(transformedCenter.x, expectedCenter.x, 3e-3);
  near(transformedCenter.y, expectedCenter.y, 2e-6);
  near(transformedCenter.z, expectedCenter.z, 3e-3);
  near(transformedBounds.getSize(new THREE.Vector3()).y,
    restBounds.getSize(new THREE.Vector3()).y * 2, 2e-6);
  rig.mount.position.set(0, 0, 0);
  rig.mount.rotation.set(0, 0, 0);
  rig.mount.scale.setScalar(1);
  rig.mount.updateMatrixWorld(true);

  const playerRoot = new THREE.Group();
  playerRoot.add(rig.mount);
  const bridge = new PlayerAnimationBridge(playerRoot, rig.mount);
  bridge.applyDeformations({ 'deform.torso.length': 1.5 });
  near(rig.chest.position.y, 0.24 * 1.5);
  near(rig.neck.position.y, 0.265 * 1.5);
  near(component.mesh.scale.x,
    MESHY_TORSO_REST_SCALE);
  near(component.mesh.scale.y, MESHY_TORSO_REST_SCALE);
  const tallTransverse = 1 / Math.sqrt(meshyTorsoLengthRatio(1.5));
  near(component.mesh.morphTargetInfluences[0], tallTransverse - 1);
  near(component.mesh.morphTargetInfluences[1], tallTransverse - 1);
  const tallBounds = skinnedBounds(component.mesh);
  near(tallBounds.min.y, restBounds.min.y, 4e-4);
  assert.ok(tallBounds.max.y > 1.5, `stretched torso top only reached ${tallBounds.max.y}`);
  near(tallBounds.getSize(new THREE.Vector3()).x,
    restBounds.getSize(new THREE.Vector3()).x * tallTransverse, 3e-4);
  component.mesh.morphTargetInfluences.push(0.37);

  bridge.applyDeformations({ 'deform.torso.length': 0.55 });
  near(component.mesh.morphTargetInfluences[2], 0.37);
  const shortTransverse = 1 / Math.sqrt(meshyTorsoLengthRatio(0.55));
  near(component.mesh.morphTargetInfluences[0], shortTransverse - 1);
  near(component.mesh.morphTargetInfluences[1], shortTransverse - 1);
  const shortBounds = skinnedBounds(component.mesh);
  near(shortBounds.min.y, restBounds.min.y, 4e-4);
  assert.ok(shortBounds.max.y < 1.18, `squashed torso top only reached ${shortBounds.max.y}`);
  bridge.applyDeformations({});
  near(component.mesh.scale.x, MESHY_TORSO_REST_SCALE);
  near(component.mesh.morphTargetInfluences[0], 0);
  near(component.mesh.morphTargetInfluences[1], 0);

  bridge.applyDeformations({ 'deform.torso.length': 0.8 });
  const proportions = new CharacterProportionLayer(rig.mount);
  proportions.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    torsoLength: 1.2,
    torsoWidth: 1.3,
    torsoDepth: 0.8,
  });
  const composedTransverse = Math.sqrt(
    meshyTorsoLengthRatio(1.2) / meshyTorsoLengthRatio(0.8 * 1.2),
  );
  near(component.mesh.scale.x, MESHY_TORSO_REST_SCALE);
  near(component.mesh.scale.y, MESHY_TORSO_REST_SCALE);
  near(component.mesh.scale.z, MESHY_TORSO_REST_SCALE);
  near(component.mesh.morphTargetInfluences[0], composedTransverse * 1.3 - 1);
  near(component.mesh.morphTargetInfluences[1], composedTransverse * 0.8 - 1);
  const composedBounds = skinnedBounds(component.mesh).getSize(new THREE.Vector3());
  assert.ok(composedBounds.x > restBounds.getSize(new THREE.Vector3()).x);
  assert.ok(composedBounds.z < restBounds.getSize(new THREE.Vector3()).z);
  near(rig.chest.position.y, 0.24 * 0.8 * 1.2);
  component.mesh.morphTargetInfluences[2] = 0.63;
  proportions.clear();
  const animationTransverse = 1 / Math.sqrt(meshyTorsoLengthRatio(0.8));
  near(component.mesh.morphTargetInfluences[0], animationTransverse - 1);
  near(component.mesh.morphTargetInfluences[1], animationTransverse - 1);
  near(component.mesh.morphTargetInfluences[2], 0.63, 1e-10);
  bridge.applyDeformations({});
  near(component.mesh.scale.x, MESHY_TORSO_REST_SCALE);
  near(component.mesh.morphTargetInfluences[0], 0);
  near(component.mesh.morphTargetInfluences[1], 0);
  near(component.mesh.morphTargetInfluences[2], 0.63, 1e-10);

  const [
    generatedSource,
    provenanceSource,
    playerSource,
    labSource,
    mainSource,
    packageSource,
    ...textureBytes
  ] = await Promise.all([
    readFile(resolve(root, 'src/character/meshyTorso.generated.ts')),
    readFile(resolve(root, 'public/characters/meshy-torso/provenance.json'), 'utf8'),
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'src/main.ts'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
    readFile(resolve(root, 'public/characters/meshy-torso/base-color.webp')),
    readFile(resolve(root, 'public/characters/meshy-torso/roughness.webp')),
  ]);
  const provenance = JSON.parse(provenanceSource);
  assert.equal(MESHY_TORSO_ASSET.sourceSha256,
    'eb856706da34e7ffb2042599698c56aeda4db7783ed46c4775bad39cf4b10576');
  assert.equal(sha256(generatedSource), provenance.generatedModuleSha256);
  assert.deepEqual(textureBytes.map(sha256), [
    provenance.webTextures.baseColor.sha256,
    provenance.webTextures.roughness.sha256,
  ]);
  assert.match(playerSource, /createMeshyTorso\(/);
  assert.doesNotMatch(playerSource, /Crop tank|little heart print|waistProfile/);
  assert.match(labSource, /\['Torso', 'torso'\]/);
  assert.match(labSource, /Meshy torso/);
  assert.match(mainSource, /getMeshyTorsoDiagnostics/);
  assert.match(JSON.parse(packageSource).scripts['check:character-lab'],
    /test-meshy-torso\.mjs/);

  console.log('PASS Meshy torso geometry, textures, six-bone skin, squash/stretch, proportions, provenance, and player wiring');
} finally {
  await server.close();
}
