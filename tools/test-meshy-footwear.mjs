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

function createLeg(mount, side, x) {
  const knee = new THREE.Bone();
  knee.name = `knee-${side}`;
  knee.position.set(x, 0.43, 0);
  mount.add(knee);
  const ankle = new THREE.Bone();
  ankle.name = `ankle-${side}`;
  ankle.position.y = -0.28;
  knee.add(ankle);
  const foot = new THREE.Object3D();
  foot.name = `socket-foot-${side}`;
  foot.position.set(0, -0.05, 0.065);
  ankle.add(foot);
  const heel = new THREE.Object3D();
  heel.name = `socket-heel-${side}`;
  heel.position.set(0, -0.05, -0.07);
  ankle.add(heel);
  const toe = new THREE.Bone();
  toe.name = `toe-${side}`;
  toe.position.set(0, -0.05, 0.16);
  ankle.add(toe);
  const toeSocket = new THREE.Object3D();
  toeSocket.name = `socket-toe-${side}`;
  toeSocket.position.set(0, 0, 0.04);
  toe.add(toeSocket);
  return { knee, ankle, toe, foot, heel, toeSocket };
}

function vertexWorld(mesh, index) {
  mesh.parent.updateWorldMatrix(true, true);
  mesh.skeleton.update();
  const point = new THREE.Vector3();
  mesh.getVertexPosition(index, point);
  return point.applyMatrix4(mesh.matrixWorld);
}

function rigidVertexWorld(mesh, index) {
  mesh.parent.updateWorldMatrix(true, true);
  return new THREE.Vector3().fromBufferAttribute(
    mesh.geometry.getAttribute('position'), index,
  ).applyMatrix4(mesh.matrixWorld);
}

try {
  const footwearApi = await server.ssrLoadModule('/src/character/meshyFootwear.ts');
  const { MESHY_FOOTWEAR_ASSET } = await server.ssrLoadModule(
    '/src/character/meshyFootwear.generated.ts');
  const { CharacterProportionLayer } = await server.ssrLoadModule(
    '/src/character/proportionLayer.ts');
  const { IDENTITY_CHARACTER_PROPORTIONS } = await server.ssrLoadModule(
    '/src/character/settings.ts');
  const {
    MESHY_FOOTWEAR_REST_SCALE,
    MESHY_FOOTWEAR_TOTAL_TRIANGLES,
    createMeshyFootwear,
    meshyFootwearTextureDiagnostics,
  } = footwearApi;

  assert.equal(MESHY_FOOTWEAR_REST_SCALE, 0.27);
  assert.equal(MESHY_FOOTWEAR_TOTAL_TRIANGLES, 3135);
  assert.equal(MESHY_FOOTWEAR_ASSET.vertices, 9405);
  assert.equal(MESHY_FOOTWEAR_ASSET.uniquePositions, 1677);
  assert.equal(MESHY_FOOTWEAR_ASSET.triangles, 3135);
  assert.deepEqual(MESHY_FOOTWEAR_ASSET.islandTriangleCounts,
    [1898, 631, 156, 152, 138, 82, 78]);
  assert.equal(MESHY_FOOTWEAR_ASSET.sockIslandId, 1);
  assert.deepEqual(MESHY_FOOTWEAR_ASSET.runtimeBounds, {
    min: [-0.265625, -0.3242189884185791, -0.5],
    max: [0.26757800579071045, 0.32617199420928955, 0.5],
  });

  const mount = new THREE.Group();
  mount.name = 'procedural-rider';
  mount.userData.sculptRuntime = { joints: {}, deformations: [] };
  const leftLeg = createLeg(mount, 'left', 0.115);
  const rightLeg = createLeg(mount, 'right', -0.115);
  const left = createMeshyFootwear({
    mount,
    knee: leftLeg.knee,
    ankle: leftLeg.ankle,
    side: 'left',
  });
  const right = createMeshyFootwear({
    mount,
    knee: rightLeg.knee,
    ankle: rightLeg.ankle,
    side: 'right',
  });

  assert.equal(left.side, 'left');
  assert.equal(right.side, 'right');
  assert.equal(left.triangles, 3135);
  assert.equal(right.triangles, 3135);
  assert.equal(left.shoe.parent, leftLeg.ankle,
    'shoe must remain an ankle descendant for outsole planting');
  assert.equal(left.sock.parent, mount);
  assert.equal(left.sock.isSkinnedMesh, true);
  assert.deepEqual(left.skeleton.bones.map((bone) => bone.name),
    ['knee-left', 'ankle-left']);
  assert.deepEqual(right.skeleton.bones.map((bone) => bone.name),
    ['knee-right', 'ankle-right']);
  assert.equal(left.shoe.geometry.getAttribute('position').count, 2504 * 3);
  assert.equal(left.sock.geometry.getAttribute('position').count, 631 * 3);
  assert.equal(left.shoe.geometry.getAttribute('normal').count, 2504 * 3);
  assert.equal(left.sock.geometry.getAttribute('normal').count, 631 * 3);
  assert.equal(left.shoe.geometry.getAttribute('uv').count, 2504 * 3);
  assert.equal(left.sock.geometry.getAttribute('uv').count, 631 * 3);
  assert.equal(left.shoe.geometry.index, null);
  assert.equal(left.sock.geometry.index, null);
  assert.equal(left.shoe.material, left.sock.material);
  assert.equal(left.shoe.material, right.shoe.material);
  assert.equal(left.shoe.material.flatShading, false);
  assert.equal(left.shoe.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(left.shoe.material.normalMap.colorSpace, THREE.NoColorSpace);
  assert.deepEqual(meshyFootwearTextureDiagnostics(), {
    state: 'loading', loaded: 0, requested: 4, error: null,
  });

  const leftBounds = left.shoe.geometry.boundingBox.clone().union(
    left.sock.geometry.boundingBox,
  );
  near(leftBounds.min.x, -0.07171875, 2e-8);
  near(leftBounds.max.x, 0.07224606156349182, 2e-8);
  near(leftBounds.min.y, -0.05, 2e-8);
  near(leftBounds.max.y, 0.12560556828975678, 2e-8);
  near(leftBounds.min.z, -0.07, 2e-8);
  near(leftBounds.max.z, 0.2, 2e-8);
  const rightBounds = right.shoe.geometry.boundingBox.clone().union(
    right.sock.geometry.boundingBox,
  );
  near(rightBounds.min.x, -leftBounds.max.x, 2e-8);
  near(rightBounds.max.x, -leftBounds.min.x, 2e-8);
  near(rightBounds.min.y, leftBounds.min.y, 2e-8);
  near(rightBounds.max.y, leftBounds.max.y, 2e-8);
  near(rightBounds.min.z, leftBounds.min.z, 2e-8);
  near(rightBounds.max.z, leftBounds.max.z, 2e-8);
  assert.deepEqual(leftLeg.foot.position.toArray(), [0, -0.05, 0.065]);
  assert.deepEqual(leftLeg.heel.position.toArray(), [0, -0.05, -0.07]);
  assert.deepEqual(leftLeg.toe.position.toArray(), [0, -0.05, 0.16]);
  assert.deepEqual(leftLeg.toeSocket.position.toArray(), [0, 0, 0.04]);

  const leftPosition = left.shoe.geometry.getAttribute('position');
  const rightPosition = right.shoe.geometry.getAttribute('position');
  const leftNormal = left.shoe.geometry.getAttribute('normal');
  const rightNormal = right.shoe.geometry.getAttribute('normal');
  const leftUv = left.shoe.geometry.getAttribute('uv');
  const rightUv = right.shoe.geometry.getAttribute('uv');
  for (const [leftIndex, rightIndex] of [[0, 0], [1, 2], [2, 1]]) {
    near(rightPosition.getX(rightIndex), -leftPosition.getX(leftIndex), 1e-8);
    near(rightPosition.getY(rightIndex), leftPosition.getY(leftIndex), 1e-8);
    near(rightPosition.getZ(rightIndex), leftPosition.getZ(leftIndex), 1e-8);
    near(rightNormal.getX(rightIndex), -leftNormal.getX(leftIndex), 1e-8);
    near(rightNormal.getY(rightIndex), leftNormal.getY(leftIndex), 1e-8);
    near(rightNormal.getZ(rightIndex), leftNormal.getZ(leftIndex), 1e-8);
    near(rightUv.getX(rightIndex), leftUv.getX(leftIndex), 1e-8);
    near(rightUv.getY(rightIndex), leftUv.getY(leftIndex), 1e-8);
  }

  assert.deepEqual(left.sock.morphTargetDictionary, { 'sock-thickness': 0 });
  assert.deepEqual(left.sock.morphTargetInfluences, [0]);
  const sockPosition = left.sock.geometry.getAttribute('position');
  const sockMorph = left.sock.geometry.morphAttributes.position[0];
  const skinIndex = left.sock.geometry.getAttribute('skinIndex');
  const skinWeight = left.sock.geometry.getAttribute('skinWeight');
  let bottomIndex = 0;
  let topIndex = 0;
  for (let index = 0; index < sockPosition.count; index++) {
    if (sockPosition.getY(index) < sockPosition.getY(bottomIndex)) bottomIndex = index;
    if (sockPosition.getY(index) > sockPosition.getY(topIndex)) topIndex = index;
    assert.equal(skinIndex.getX(index), 0);
    assert.equal(skinIndex.getY(index), 1);
    near(skinWeight.getX(index) + skinWeight.getY(index), 1, 2e-7);
    assert.ok(skinWeight.getX(index) >= 0 && skinWeight.getX(index) <= 1);
    assert.ok(skinWeight.getY(index) >= 0 && skinWeight.getY(index) <= 1);
  }
  near(skinWeight.getX(bottomIndex), 0);
  near(skinWeight.getY(bottomIndex), 1);
  near(skinWeight.getX(topIndex), 1);
  near(skinWeight.getY(topIndex), 0);
  near(sockMorph.getX(bottomIndex), 0);
  near(sockMorph.getZ(bottomIndex), 0);
  assert.ok(Math.abs(sockMorph.getX(topIndex)) + Math.abs(sockMorph.getZ(topIndex)) > 0.005);

  mount.updateWorldMatrix(true, true);
  left.skeleton.update();
  const shoeBefore = rigidVertexWorld(left.shoe, 0);
  const sockBottomBefore = vertexWorld(left.sock, bottomIndex);
  const sockTopBefore = vertexWorld(left.sock, topIndex);
  leftLeg.ankle.rotation.x = 0.55;
  mount.updateWorldMatrix(true, true);
  left.skeleton.update();
  const shoeAfter = rigidVertexWorld(left.shoe, 0);
  const sockBottomAfter = vertexWorld(left.sock, bottomIndex);
  const sockTopAfter = vertexWorld(left.sock, topIndex);
  assert.ok(shoeBefore.distanceTo(shoeAfter) > 0.01,
    'shoe must follow ankle rotation');
  assert.ok(sockBottomBefore.distanceTo(sockBottomAfter) > 0.005,
    'hidden sock base must follow ankle rotation');
  near(sockTopBefore.distanceTo(sockTopAfter), 0, 2e-6);
  leftLeg.ankle.rotation.x = 0;
  mount.updateWorldMatrix(true, true);

  const layer = new CharacterProportionLayer(mount);
  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, legThickness: 1.5 });
  near(left.sock.morphTargetInfluences[0], 0.5);
  near(right.sock.morphTargetInfluences[0], 0.5);
  assert.deepEqual(left.shoe.scale.toArray(), [1, 1, 1],
    'leg thickness must not scale the shoe');
  layer.clear();
  near(left.sock.morphTargetInfluences[0], 0);
  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, footSize: 1.4 });
  assert.deepEqual(leftLeg.ankle.scale.toArray(), [1.4, 1.4, 1.4]);
  assert.deepEqual(rightLeg.ankle.scale.toArray(), [1.4, 1.4, 1.4]);
  near(left.sock.morphTargetInfluences[0], 0);
  layer.clear();
  assert.deepEqual(leftLeg.ankle.scale.toArray(), [1, 1, 1]);

  const [
    generatedSource,
    provenanceSource,
    playerSource,
    labSource,
    mainSource,
    packageSource,
    ...textureBytes
  ] = await Promise.all([
    readFile(resolve(root, 'src/character/meshyFootwear.generated.ts')),
    readFile(resolve(root, 'public/characters/meshy-footwear/provenance.json'), 'utf8'),
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'src/main.ts'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
    readFile(resolve(root, 'public/characters/meshy-footwear/base-color.png')),
    readFile(resolve(root, 'public/characters/meshy-footwear/normal.png')),
    readFile(resolve(root, 'public/characters/meshy-footwear/roughness.png')),
    readFile(resolve(root, 'public/characters/meshy-footwear/metallic.png')),
  ]);
  const provenance = JSON.parse(provenanceSource);
  assert.equal(MESHY_FOOTWEAR_ASSET.sourceSha256,
    'd9b49aa72ada43f841bb824c3743e05cf19d0b295403f931ff3a821ce8464f43');
  assert.equal(provenance.sourceArchive.sha256,
    'db0c703a336f51164e291df025d10205a98d569d27d198fb6b640eee2e5fb011');
  assert.equal(provenance.meshyUploadId, '01a05ba7-51f9-70f1-8b0f-8219b463ee92');
  assert.equal(sha256(generatedSource), provenance.generatedModuleSha256);
  assert.deepEqual(textureBytes.map(sha256), [
    provenance.webTextures.baseColor.sha256,
    provenance.webTextures.normal.sha256,
    provenance.webTextures.roughness.sha256,
    provenance.webTextures.metallic.sha256,
  ]);
  assert.match(playerSource, /createMeshyFootwear\(/);
  assert.match(playerSource, /get meshyFootwearDiagnostics/);
  assert.doesNotMatch(playerSource,
    /sockGeo|sockStripeGeo|shoeGeo|strapGeo|soleGeo|SHOE_PINK/);
  for (const socketName of [
    'socket-foot-${anatomicalSide}',
    'socket-heel-${anatomicalSide}',
    'socket-toe-${anatomicalSide}',
  ]) assert.ok(playerSource.includes(socketName));
  assert.match(labSource, /\['Shoes', 'footwear'\]/);
  assert.match(mainSource, /getMeshyFootwearDiagnostics/);
  assert.match(JSON.parse(packageSource).scripts['check:character-lab'],
    /test-meshy-footwear\.mjs/);

  console.log('PASS Meshy footwear split, mirrored shoe, knee/ankle sock skin, contacts, proportions, provenance, and player wiring');
} finally {
  await server.close();
}
