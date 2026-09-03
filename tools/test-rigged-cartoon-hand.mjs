import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetPath = resolve(root, 'public/characters/three-finger-hand/three-finger-hand.glb');
const bytes = await readFile(assetPath);
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const gltf = await new Promise((resolveGltf, reject) => {
  new GLTFLoader().parse(buffer, '', resolveGltf, reject);
});

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const near = (actual, expected, tolerance = 1e-5) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`);
};

try {
  const [surfaceApi, gloveApi, proportionApi, settingsApi] = await Promise.all([
    server.ssrLoadModule('/src/character/riggedCartoonHand.ts'),
    server.ssrLoadModule('/src/character/cartoonGlove.ts'),
    server.ssrLoadModule('/src/character/proportionLayer.ts'),
    server.ssrLoadModule('/src/character/settings.ts'),
  ]);
  const {
    RIGGED_CARTOON_HAND_ASSET_PATH,
    RIGGED_CARTOON_HAND_COLOR,
    RIGGED_CARTOON_HAND_CREDIT,
    RIGGED_CARTOON_HAND_MARK_COLOR,
    RIGGED_CARTOON_HAND_MARK_TRIANGLES_PER_HAND,
    attachAndSyncRiggedCartoonHandPair,
    createRiggedCartoonHandPairFromScene,
  } = surfaceApi;
  const {
    CARTOON_GLOVE_POSES,
    createCartoonGlove,
    removeProceduralCartoonGloveSurface,
    setCartoonGlovePose,
  } = gloveApi;
  const { CharacterProportionLayer } = proportionApi;
  const { IDENTITY_CHARACTER_PROPORTIONS } = settingsApi;

  assert.equal(RIGGED_CARTOON_HAND_ASSET_PATH,
    'characters/three-finger-hand/three-finger-hand.glb');
  assert.equal(RIGGED_CARTOON_HAND_CREDIT, 'Hand Rig by Andy Cuccaro');
  assert.equal(RIGGED_CARTOON_HAND_COLOR, 0xeee8dc);
  assert.equal(RIGGED_CARTOON_HAND_MARK_COLOR, 0x17181c);
  assert.equal(RIGGED_CARTOON_HAND_MARK_TRIANGLES_PER_HAND, 364);
  assert.equal(gltf.animations.length, 0, 'free hand source must not invent animation clips');

  const sourceMeshes = [];
  gltf.scene.traverse((object) => {
    if (object.isSkinnedMesh) sourceMeshes.push(object);
  });
  assert.equal(sourceMeshes.length, 4, 'two hands × skin/cloth material surfaces');
  assert.ok(gltf.scene.getObjectByName('thumb-metacarpal-left').position.x < 0,
    'authored left hand was assigned to the opposite wrist');
  assert.ok(gltf.scene.getObjectByName('thumb-metacarpal-right').position.x > 0,
    'mirrored right hand was assigned to the opposite wrist');
  let sourceTriangles = 0;
  let sourceVertices = 0;
  for (const mesh of sourceMeshes) {
    const geometry = mesh.geometry;
    sourceTriangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    sourceVertices += geometry.attributes.position.count;
    assert.deepEqual(Object.keys(geometry.attributes).sort(),
      ['normal', 'position', 'skinIndex', 'skinWeight'],
      'hand GLB retained unused UV or constant vertex-color data');
    assert.ok(geometry.index, 'lossless hand geometry must remain indexed');
    assert.equal(geometry.attributes.skinIndex.itemSize, 4);
    assert.equal(geometry.attributes.skinWeight.itemSize, 4);
    assert.equal(mesh.skeleton.bones.length, 13);
    const weights = geometry.attributes.skinWeight;
    for (let index = 0; index < weights.count; index++) {
      const row = [weights.getX(index), weights.getY(index), weights.getZ(index), weights.getW(index)];
      assert.ok(row.every((weight) => Number.isFinite(weight) && weight >= 0));
      near(row.reduce((sum, weight) => sum + weight, 0), 1, 2e-4);
    }
  }
  assert.equal(sourceTriangles, 25152);
  assert.equal(sourceVertices, 12584);

  const material = new THREE.MeshBasicMaterial();
  const stitch = new THREE.MeshBasicMaterial();
  const semanticLeft = createCartoonGlove('left', { glove: material, stitch });
  const semanticRight = createCartoonGlove('right', { glove: material, stitch });
  const pair = createRiggedCartoonHandPairFromScene(gltf.scene);
  semanticLeft.root.add(pair.left.root);
  semanticRight.root.add(pair.right.root);
  assert.equal(pair.triangleCount, 25152);
  assert.equal(pair.left.triangleCount, 12576);
  assert.equal(pair.right.triangleCount, 12576);
  assert.equal(pair.left.decorationTriangleCount, 364);
  assert.equal(pair.right.decorationTriangleCount, 364);
  assert.equal(pair.decorationTriangleCount, 728);
  assert.equal(pair.left.bonesByName.size, 13);
  assert.equal(pair.right.bonesByName.size, 13);
  assert.ok(pair.left.meshes.every((mesh) => mesh.frustumCulled === false));
  const whiteSurface = pair.left.meshes.find((mesh) => mesh.material.name === 'Basic Skin');
  assert.equal(whiteSurface.material.color.getHex(), RIGGED_CARTOON_HAND_COLOR);
  const whiteCuff = pair.left.meshes.find((mesh) => mesh.material.name === 'Cloth');
  assert.equal(whiteCuff.material.color.getHex(), RIGGED_CARTOON_HAND_COLOR);
  const dorsalMarks = [pair.left, pair.right].map((surface) =>
    surface.root.getObjectByName(`artist-hand-dorsal-x-${surface.side}`));
  assert.equal(dorsalMarks[0].parent, pair.left.root);
  assert.equal(dorsalMarks[1].parent, pair.right.root);
  near(dorsalMarks[0].position.x, -dorsalMarks[1].position.x);
  near(dorsalMarks[0].position.y, dorsalMarks[1].position.y);
  near(dorsalMarks[0].position.z, dorsalMarks[1].position.z);
  near(dorsalMarks[0].position.x, -0.025);
  near(dorsalMarks[0].position.y, -0.079);
  near(dorsalMarks[0].position.z, 0.044);
  const markRigRoot = new THREE.Group();
  markRigRoot.add(semanticLeft.root, semanticRight.root);
  const markLayer = new CharacterProportionLayer(markRigRoot);
  markLayer.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    gloveXAcross: 0.02,
    gloveXAlong: -0.03,
    gloveXLift: 0.01,
  });
  near(dorsalMarks[0].position.x, -0.005);
  near(dorsalMarks[1].position.x, 0.005);
  near(dorsalMarks[0].position.y, -0.109);
  near(dorsalMarks[1].position.y, -0.109);
  near(dorsalMarks[0].position.z, 0.054);
  near(dorsalMarks[1].position.z, 0.054);
  markLayer.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    gloveXAcross: 0.02,
    gloveXAlong: -0.03,
    gloveXLift: 0.01,
  });
  near(dorsalMarks[0].position.x, -0.005);
  markLayer.clear();
  near(dorsalMarks[0].position.x, -0.025);
  near(dorsalMarks[1].position.x, 0.025);
  near(dorsalMarks[0].position.y, -0.079);
  near(dorsalMarks[0].position.z, 0.044);
  for (const surface of [pair.left, pair.right]) {
    assert.equal(surface.decorations.length, 2);
    assert.ok(surface.decorations.every((bar) =>
      bar.material.color.getHex() === RIGGED_CARTOON_HAND_MARK_COLOR));
    assert.ok(surface.decorations.every((bar) =>
      bar.userData.handDorsalMark === true && bar.userData.characterPart === undefined));
    near(surface.decorations[0].rotation.z, -0.68);
    near(surface.decorations[1].rotation.z, 0.68);
    assert.equal(surface.decorations[0].geometry, surface.decorations[1].geometry);
  }

  const secondPair = createRiggedCartoonHandPairFromScene(gltf.scene);
  const firstMaterial = pair.left.meshes[0].material;
  const secondMaterial = secondPair.left.meshes[0].material;
  assert.notEqual(firstMaterial, secondMaterial, 'separate players share mutable hand materials');
  assert.equal(pair.left.meshes[0].geometry, secondPair.left.meshes[0].geometry,
    'immutable hand geometry should remain shared');
  const firstColor = firstMaterial.color.getHex();
  secondMaterial.color.setHex(0x123456);
  assert.equal(firstMaterial.color.getHex(), firstColor,
    'tinting a second player mutated the first player hand');
  const firstMarkMaterial = pair.left.decorations[0].material;
  const secondMarkMaterial = secondPair.left.decorations[0].material;
  assert.notEqual(firstMarkMaterial, secondMarkMaterial,
    'separate players share mutable dorsal-mark materials');
  secondMarkMaterial.color.setHex(0x654321);
  assert.equal(firstMarkMaterial.color.getHex(), RIGGED_CARTOON_HAND_MARK_COLOR);

  assert.equal(removeProceduralCartoonGloveSurface(semanticLeft), 21);
  let remainingProcedural = 0;
  semanticLeft.root.traverse((object) => {
    if (object.userData.characterPart) remainingProcedural++;
  });
  assert.equal(remainingProcedural, 0, 'superseded procedural glove surface remains attached');
  assert.equal(pair.left.root.getObjectByName('artist-hand-dorsal-x-left'), dorsalMarks[0],
    'fallback removal deleted the artist dorsal X');

  const artistIndex = pair.left.bonesByName.get('finger-index-distal-left');
  const leftMarkTransform = {
    position: dorsalMarks[0].position.toArray(),
    quaternion: dorsalMarks[0].quaternion.toArray(),
    scale: dorsalMarks[0].scale.toArray(),
  };
  setCartoonGlovePose(semanticLeft, CARTOON_GLOVE_POSES.open);
  pair.left.syncFrom(semanticLeft);
  pair.left.root.updateMatrixWorld(true);
  const open = artistIndex.getWorldQuaternion(new THREE.Quaternion());
  setCartoonGlovePose(semanticLeft, CARTOON_GLOVE_POSES.fist);
  pair.left.syncFrom(semanticLeft);
  setCartoonGlovePose(semanticRight, CARTOON_GLOVE_POSES.fist);
  pair.right.syncFrom(semanticRight);
  pair.left.root.updateMatrixWorld(true);
  const fist = artistIndex.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(open.angleTo(fist) > 0.5, 'semantic fist did not deform the artist hand skeleton');
  assert.deepEqual({
    position: dorsalMarks[0].position.toArray(),
    quaternion: dorsalMarks[0].quaternion.toArray(),
    scale: dorsalMarks[0].scale.toArray(),
  }, leftMarkTransform, 'finger animation moved the rigid dorsal X');

  const transformMaterial = new THREE.MeshBasicMaterial();
  const transformStitch = new THREE.MeshBasicMaterial();
  const transformLeft = createCartoonGlove('left', {
    glove: transformMaterial,
    stitch: transformStitch,
  });
  const transformRight = createCartoonGlove('right', {
    glove: transformMaterial,
    stitch: transformStitch,
  });
  const transformPair = createRiggedCartoonHandPairFromScene(gltf.scene);
  attachAndSyncRiggedCartoonHandPair(transformPair, transformLeft, transformRight);

  const rootPosition = (rootNode, bone) => {
    rootNode.updateWorldMatrix(true, true);
    return bone.getWorldPosition(new THREE.Vector3())
      .applyMatrix4(rootNode.matrixWorld.clone().invert());
  };
  const rootQuaternion = (rootNode, bone) => {
    const chain = [];
    for (let node = bone; node && node !== rootNode; node = node.parent) chain.push(node);
    assert.equal(chain.at(-1)?.parent, rootNode, `${bone.name} is not below ${rootNode.name}`);
    const result = new THREE.Quaternion();
    for (let index = chain.length - 1; index >= 0; index--) {
      result.multiply(chain[index].quaternion);
    }
    return result.normalize();
  };
  const artistRest = new Map(transformLeft.bones.map((semanticBone) => {
    const artistBone = transformPair.left.bonesByName.get(semanticBone.name);
    return [semanticBone.name, {
      position: rootPosition(transformPair.left.root, artistBone),
      quaternion: rootQuaternion(transformPair.left.root, artistBone),
      localScale: artistBone.scale.clone(),
    }];
  }));
  for (let index = 0; index < transformLeft.bones.length; index++) {
    const bone = transformLeft.bones[index];
    bone.position.add(new THREE.Vector3(
      (index % 3 - 1) * 0.001,
      (index + 1) * 0.0007,
      (index % 2 ? -1 : 1) * 0.0005,
    ));
    bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      0.015 * (index + 1),
      -0.008 * (index % 3),
      0.006 * (index % 2),
    ))).normalize();
    bone.scale.set(1 + index * 0.003, 1 - index * 0.002, 1 + index * 0.001);
  }
  transformPair.left.syncFrom(transformLeft);
  for (const semanticBone of transformLeft.bones) {
    const artistBone = transformPair.left.bonesByName.get(semanticBone.name);
    const semanticRestPosition = new THREE.Vector3().fromArray(
      semanticBone.userData.cartoonGloveRestRootPosition,
    );
    const semanticRestQuaternion = new THREE.Quaternion().fromArray(
      semanticBone.userData.cartoonGloveRestRootQuaternion,
    );
    const semanticRestScale = new THREE.Vector3().fromArray(
      semanticBone.userData.cartoonGloveRestLocalScale,
    );
    const artistBaseline = artistRest.get(semanticBone.name);
    const semanticDeltaPosition = rootPosition(transformLeft.root, semanticBone)
      .sub(semanticRestPosition);
    const artistDeltaPosition = rootPosition(transformPair.left.root, artistBone)
      .sub(artistBaseline.position);
    assert.ok(semanticDeltaPosition.distanceTo(artistDeltaPosition) < 2e-5,
      `${semanticBone.name} position delta did not reach the artist skin`);
    const semanticDeltaQuaternion = rootQuaternion(transformLeft.root, semanticBone)
      .multiply(semanticRestQuaternion.invert());
    const artistDeltaQuaternion = rootQuaternion(transformPair.left.root, artistBone)
      .multiply(artistBaseline.quaternion.clone().invert());
    assert.ok(semanticDeltaQuaternion.angleTo(artistDeltaQuaternion) < 2e-4,
      `${semanticBone.name} rotation delta did not reach the artist skin`);
    near(artistBone.scale.x / artistBaseline.localScale.x,
      semanticBone.scale.x / semanticRestScale.x, 2e-5);
    near(artistBone.scale.y / artistBaseline.localScale.y,
      semanticBone.scale.y / semanticRestScale.y, 2e-5);
    near(artistBone.scale.z / artistBaseline.localScale.z,
      semanticBone.scale.z / semanticRestScale.z, 2e-5);
  }

  const transactionLeft = createCartoonGlove('left', { glove: material, stitch });
  const transactionRight = createCartoonGlove('right', { glove: material, stitch });
  const failedLeftRoot = new THREE.Group();
  const failedRightRoot = new THREE.Group();
  assert.throws(() => attachAndSyncRiggedCartoonHandPair({
    left: { root: failedLeftRoot, syncFrom() { throw new Error('forced initial sync failure'); } },
    right: { root: failedRightRoot, syncFrom() {} },
  }, transactionLeft, transactionRight), /forced initial sync failure/);
  assert.equal(failedLeftRoot.parent, null, 'failed left artist hand stayed attached');
  assert.equal(failedRightRoot.parent, null, 'failed right artist hand stayed attached');

  for (const surface of [pair.left, pair.right]) {
    surface.root.updateMatrixWorld(true, true);
    surface.root.traverse((object) => {
      assert.ok([
        ...object.position.toArray(),
        ...object.quaternion.toArray(),
        ...object.scale.toArray(),
      ].every(Number.isFinite), `${surface.side} ${object.name} has non-finite transforms`);
    });
  }

  const leftBounds = new THREE.Box3().setFromObject(pair.left.root);
  const rightBounds = new THREE.Box3().setFromObject(pair.right.root);
  near(leftBounds.min.x, -rightBounds.max.x, 2e-4);
  near(leftBounds.max.x, -rightBounds.min.x, 2e-4);
  assert.ok(leftBounds.min.y < -0.15 && leftBounds.max.y < 0.05,
    'artist hand is not baked into wrist-local downward orientation');

  const provenance = JSON.parse(await readFile(
    resolve(root, 'public/characters/three-finger-hand/provenance.json'),
    'utf8',
  ));
  assert.equal(provenance.author, 'Andy Cuccaro');
  assert.equal(provenance.license, 'CC-BY-4.0');
  assert.equal(provenance.requiredCredit, RIGGED_CARTOON_HAND_CREDIT);
  assert.equal(provenance.runtime.triangles, 25152);
  assert.equal(provenance.runtime.indexedVerticesPerHand, 6292);
  assert.equal(provenance.outputBytes, bytes.length);
  assert.equal(provenance.outputSha256,
    createHash('sha256').update(bytes).digest('hex'));

  const [playerSource, labSource, importerSource, packageSource, creditsSource] = await Promise.all([
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'tools/import-three-finger-hand.py'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
    readFile(resolve(root, 'CREDITS.md'), 'utf8'),
  ]);
  assert.match(playerSource, /hand-rest-orientation-\$\{anatomicalSide\}/);
  assert.match(playerSource, /handRestOrientation\.rotation\.y = -side \* Math\.PI \/ 2/);
  assert.match(playerSource, /installRiggedCartoonHands/);
  assert.match(labSource, /Rest orientation is linked/);
  assert.match(importerSource, /export_influence_nb=4/);
  assert.match(importerSource, /export_texcoords=False/);
  assert.match(importerSource, /export_vertex_color="NONE"/);
  assert.match(importerSource, /"left", orient\)/);
  assert.match(importerSource, /"right", mirror_x @ orient\)/);
  assert.match(creditsSource, /Hand Rig by \[Andy Cuccaro\]/);
  assert.match(creditsSource, /CC BY 4\.0/);
  assert.match(JSON.parse(packageSource).scripts['check:character-lab'],
    /test-rigged-cartoon-hand\.mjs/);

  console.log('PASS attributed compact artist hand GLB, mirrored skins, semantic retarget, and wrist-rest wiring');
} finally {
  await server.close();
}
