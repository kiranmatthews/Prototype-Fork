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

function decodeUint8(source) {
  const binary = atob(source);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) result[index] = binary.charCodeAt(index);
  return result;
}

function bounds(mesh) {
  mesh.parent.updateMatrixWorld(true);
  mesh.skeleton.update();
  const position = mesh.geometry.getAttribute('position');
  const point = new THREE.Vector3();
  const result = new THREE.Box3().makeEmpty();
  for (let index = 0; index < position.count; index++) {
    mesh.getVertexPosition(index, point);
    point.applyMatrix4(mesh.matrixWorld);
    result.expandByPoint(point);
  }
  return result;
}

function vertexWorld(mesh, index) {
  mesh.parent.updateMatrixWorld(true);
  mesh.skeleton.update();
  const point = new THREE.Vector3();
  mesh.getVertexPosition(index, point);
  return point.applyMatrix4(mesh.matrixWorld);
}

try {
  const shortsApi = await server.ssrLoadModule('/src/character/meshyShorts.ts');
  const { MESHY_SHORTS_ASSET } = await server.ssrLoadModule(
    '/src/character/meshyShorts.generated.ts');
  const { CharacterProportionLayer } = await server.ssrLoadModule(
    '/src/character/proportionLayer.ts');
  const { IDENTITY_CHARACTER_PROPORTIONS } = await server.ssrLoadModule(
    '/src/character/settings.ts');
  const {
    MESHY_SHORTS_REST_SCALE,
    createMeshyShorts,
    meshyShortsTextureDiagnostics,
  } = shortsApi;

  const mount = new THREE.Group();
  mount.name = 'procedural-rider';
  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.y = 0.71;
  mount.add(hips);
  const hipLeft = new THREE.Bone();
  hipLeft.name = 'hip-left';
  hipLeft.position.x = 0.115;
  hips.add(hipLeft);
  const hipRight = new THREE.Bone();
  hipRight.name = 'hip-right';
  hipRight.position.x = -0.115;
  hips.add(hipRight);
  mount.userData.sculptRuntime = { joints: {}, deformations: [] };

  const component = createMeshyShorts({ mount, hips, hipLeft, hipRight });
  const mesh = component.mesh;
  assert.equal(mesh.parent, mount);
  assert.equal(mesh.isSkinnedMesh, true);
  assert.equal(component.triangles, 10732);
  assert.equal(mesh.geometry.getAttribute('position').count, 32196);
  assert.equal(mesh.geometry.getAttribute('uv').count, 32196);
  assert.equal(mesh.geometry.getAttribute('normal'), undefined);
  assert.equal(mesh.geometry.getAttribute('skinIndex').count, 32196);
  assert.equal(mesh.geometry.getAttribute('skinWeight').count, 32196);
  assert.deepEqual(mesh.morphTargetDictionary, {
    'shorts-width': 0,
    'shorts-length': 1,
    'shorts-depth': 2,
  });
  assert.deepEqual(mesh.morphTargetInfluences, [0, 0, 0]);
  assert.deepEqual(component.skeleton.bones.map((bone) => bone.name),
    ['hips', 'hip-left', 'hip-right']);
  assert.equal(mesh.material.flatShading, true);
  assert.equal(mesh.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.deepEqual(meshyShortsTextureDiagnostics(), {
    state: 'loading', loaded: 0, requested: 4, error: null,
  });

  const skinIndex = mesh.geometry.getAttribute('skinIndex');
  const skinWeight = mesh.geometry.getAttribute('skinWeight');
  const position = mesh.geometry.getAttribute('position');
  const islandIds = decodeUint8(MESHY_SHORTS_ASSET.islandIdsBase64);
  const detailBones = new Map();
  let smoothLeft = 0;
  let smoothRight = 0;
  for (let index = 0; index < skinWeight.count; index++) {
    near(skinWeight.getX(index) + skinWeight.getY(index) +
      skinWeight.getZ(index) + skinWeight.getW(index), 1, 2e-7);
    if (islandIds[index] === 0) {
      const sideBone = skinIndex.getY(index);
      if (skinWeight.getY(index) > 0.2 && sideBone === 1) smoothLeft++;
      if (skinWeight.getY(index) > 0.2 && sideBone === 2) smoothRight++;
      assert.equal(sideBone, position.getX(index) >= 0 ? 1 : 2,
        'main cloth vertex was cross-weighted to the opposite leg');
    } else {
      assert.equal(skinWeight.getX(index), 1);
      assert.equal(skinWeight.getY(index), 0);
      const previous = detailBones.get(islandIds[index]);
      const bone = skinIndex.getX(index);
      if (previous === undefined) detailBones.set(islandIds[index], bone);
      else assert.equal(bone, previous, `detail island ${islandIds[index]} shears across bones`);
    }
  }
  assert.ok(smoothLeft > 500 && smoothRight > 500);
  assert.equal(detailBones.size, 44);

  const movingDetail = [...detailBones.entries()].find(([, bone]) => bone !== 0);
  assert.ok(movingDetail, 'at least one lower-side detail must follow an upper leg');
  const [movingDetailIsland, movingBone] = movingDetail;
  const movingClothVertex = [...Array(skinWeight.count).keys()].find((index) =>
    islandIds[index] === 0 && skinIndex.getY(index) === movingBone && skinWeight.getY(index) > 0.8);
  const movingDetailVertices = [...Array(islandIds.length).keys()].filter((index) =>
    islandIds[index] === movingDetailIsland).slice(0, 2);
  assert.notEqual(movingClothVertex, undefined);
  assert.equal(movingDetailVertices.length, 2);
  const movingHip = movingBone === 1 ? hipLeft : hipRight;
  const clothBefore = vertexWorld(mesh, movingClothVertex);
  const detailDistanceBefore = vertexWorld(mesh, movingDetailVertices[0]).distanceTo(
    vertexWorld(mesh, movingDetailVertices[1]));
  movingHip.rotation.z = movingBone === 1 ? 0.7 : -0.7;
  const clothAfter = vertexWorld(mesh, movingClothVertex);
  const detailDistanceAfter = vertexWorld(mesh, movingDetailVertices[0]).distanceTo(
    vertexWorld(mesh, movingDetailVertices[1]));
  assert.ok(clothBefore.distanceTo(clothAfter) > 0.02,
    'lower left cloth must follow the left upper-leg bone');
  near(detailDistanceAfter, detailDistanceBefore, 2e-6);
  movingHip.rotation.z = 0;
  mount.updateMatrixWorld(true);

  const restBounds = bounds(mesh);
  near(restBounds.min.x, -0.194, 2e-6);
  near(restBounds.max.x, 0.194, 2e-6);
  near(restBounds.min.y, 0.49059375, 2e-6);
  near(restBounds.max.y, 0.7656796875, 2e-6);
  near(restBounds.min.z, -0.118984375, 1e-5);
  near(restBounds.max.z, 0.1174609375, 1e-5);

  const layer = new CharacterProportionLayer(mount);
  layer.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    shortsWidth: 1.4,
    shortsHeight: 1.3,
    shortsDepth: 0.7,
    legThickness: 1.5,
  });
  assert.deepEqual(mesh.scale.toArray(), [
    MESHY_SHORTS_REST_SCALE,
    MESHY_SHORTS_REST_SCALE,
    MESHY_SHORTS_REST_SCALE,
  ]);
  near(mesh.morphTargetInfluences[0], 0.4);
  near(mesh.morphTargetInfluences[1], 0.3);
  near(mesh.morphTargetInfluences[2], -0.3);
  const shapedBounds = bounds(mesh);
  near(shapedBounds.max.y, restBounds.max.y, 2e-6);
  assert.ok(shapedBounds.min.y < restBounds.min.y);
  assert.ok(shapedBounds.getSize(new THREE.Vector3()).x > restBounds.getSize(new THREE.Vector3()).x);
  assert.ok(shapedBounds.getSize(new THREE.Vector3()).z < restBounds.getSize(new THREE.Vector3()).z);
  layer.clear();
  assert.deepEqual(mesh.morphTargetInfluences, [0, 0, 0]);

  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, legThickness: 1.62 });
  assert.deepEqual(mesh.morphTargetInfluences, [0, 0, 0],
    'leg thickness must not affect shorts');
  assert.deepEqual(mesh.scale.toArray(), [0.388, 0.388, 0.388]);
  layer.clear();

  const [
    generatedSource,
    provenanceSource,
    playerSource,
    labSource,
    mainSource,
    packageSource,
    ...textureBytes
  ] = await Promise.all([
    readFile(resolve(root, 'src/character/meshyShorts.generated.ts')),
    readFile(resolve(root, 'public/characters/meshy-shorts/provenance.json'), 'utf8'),
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'src/main.ts'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
    readFile(resolve(root, 'public/characters/meshy-shorts/base-color.png')),
    readFile(resolve(root, 'public/characters/meshy-shorts/normal.png')),
    readFile(resolve(root, 'public/characters/meshy-shorts/roughness.png')),
    readFile(resolve(root, 'public/characters/meshy-shorts/metallic.png')),
  ]);
  const provenance = JSON.parse(provenanceSource);
  assert.equal(MESHY_SHORTS_ASSET.sourceSha256,
    'ca74185a56d5fd9552088486b59ea4c836e1ac8228919a3743760cb8468629e5');
  assert.equal(sha256(generatedSource), provenance.generatedModuleSha256);
  assert.deepEqual(textureBytes.map(sha256), [
    provenance.webTextures.baseColor.sha256,
    provenance.webTextures.normal.sha256,
    provenance.webTextures.roughness.sha256,
    provenance.webTextures.metallic.sha256,
  ]);
  assert.match(playerSource, /createMeshyShorts\(/);
  assert.doesNotMatch(playerSource,
    /hipProfile|const pelvis =|const belt =|const buckle =|chainPts|thighGeo|pocketGeo|flapGeo/);
  assert.match(labSource, /\['Shorts', 'shorts'\]/);
  assert.match(mainSource, /getMeshyShortsDiagnostics/);
  assert.match(JSON.parse(packageSource).scripts['check:character-lab'],
    /test-meshy-shorts\.mjs/);

  console.log('PASS Meshy shorts geometry, rigid details, upper-leg skin, independent proportions, provenance, and player wiring');
} finally {
  await server.close();
}
