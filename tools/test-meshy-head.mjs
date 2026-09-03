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

try {
  const headApi = await server.ssrLoadModule('/src/character/meshyHead.ts');
  const alternateHeadApi = await server.ssrLoadModule('/src/character/meshyBoolieRooHead.ts');
  const { MESHY_HEAD_ASSET } = await server.ssrLoadModule(
    '/src/character/meshyHead.generated.ts');
  const { MESHY_BOOLIEROO_HEAD_ASSET } = await server.ssrLoadModule(
    '/src/character/meshyBoolieRooHead.generated.ts');
  const { CharacterProportionLayer } = await server.ssrLoadModule(
    '/src/character/proportionLayer.ts');
  const { IDENTITY_CHARACTER_PROPORTIONS } = await server.ssrLoadModule(
    '/src/character/settings.ts');
  const {
    MESHY_HEAD_REST_SCALE,
    createMeshyHead,
    meshyHeadTextureDiagnostics,
  } = headApi;

  const component = createMeshyHead();
  const alternate = alternateHeadApi.createMeshyBoolieRooHead();
  assert.equal(component.triangles, 16536);
  assert.equal(component.mesh.geometry.getAttribute('position').count, 9930);
  assert.equal(component.mesh.geometry.getAttribute('uv').count, 9930);
  assert.equal(component.mesh.geometry.getIndex().count, 49608);
  assert.equal(MESHY_HEAD_ASSET.indexedVertices, 9930);
  assert.equal(component.mesh.geometry.getAttribute('normal'), undefined);
  assert.equal(component.mesh.material.flatShading, true);
  assert.equal(component.mesh.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(component.mesh.material.normalMap, null);
  assert.equal(component.mesh.material.roughnessMap.colorSpace, THREE.NoColorSpace);
  assert.equal(component.mesh.material.metalnessMap, null);
  assert.equal(component.mesh.material.metalness, 0);
  assert.deepEqual(meshyHeadTextureDiagnostics(), {
    state: 'loading', loaded: 0, requested: 2, error: null,
  });
  component.mesh.geometry.computeBoundingBox();
  assert.deepEqual(component.mesh.geometry.boundingBox.min.toArray(),
    [-0.427734375, 0, -0.369140625]);
  assert.deepEqual(component.mesh.geometry.boundingBox.max.toArray(),
    [0.427734375, 1, 0.375]);
  near(component.mesh.scale.x, MESHY_HEAD_REST_SCALE);
  near(component.mesh.scale.y, MESHY_HEAD_REST_SCALE);
  near(component.mesh.scale.z, MESHY_HEAD_REST_SCALE);
  assert.equal(alternate.triangles, 15634);
  assert.equal(alternate.mesh.geometry.getAttribute('position').count, 9689);
  assert.equal(alternate.mesh.geometry.getAttribute('uv').count, 9689);
  assert.equal(alternate.mesh.geometry.getIndex().count, 46902);
  assert.equal(MESHY_BOOLIEROO_HEAD_ASSET.indexedVertices, 9689);
  alternate.mesh.geometry.computeBoundingBox();
  assert.deepEqual(alternate.mesh.geometry.boundingBox.min.toArray(),
    [-0.5, 0, -0.259765625]);
  assert.deepEqual(alternate.mesh.geometry.boundingBox.max.toArray(),
    [0.5, 0.7890625, 0.26171875]);
  near(alternate.mesh.scale.x, 0.46);
  assert.equal(alternate.mesh.material.normalMap, null);
  assert.equal(alternate.mesh.material.roughnessMap.colorSpace, THREE.NoColorSpace);
  assert.equal(alternate.mesh.material.metalnessMap, null);
  assert.equal(alternate.mesh.material.metalness, 0);
  assert.deepEqual(alternateHeadApi.meshyBoolieRooHeadTextureDiagnostics(), {
    state: 'loading', loaded: 0, requested: 2, error: null,
  });

  const rider = new THREE.Group();
  rider.name = 'procedural-rider';
  const chest = new THREE.Bone();
  chest.name = 'chest';
  chest.position.y = 1.06;
  rider.add(chest);
  const torsoMarker = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.3));
  torsoMarker.name = 'torso-marker';
  chest.add(torsoMarker);
  const neck = new THREE.Bone();
  neck.name = 'neck';
  neck.position.y = 0.265;
  chest.add(neck);
  const head = new THREE.Bone();
  head.name = 'head';
  head.position.y = 0.095;
  neck.add(head);
  const headPresentation = new THREE.Group();
  headPresentation.name = 'head-presentation';
  head.add(headPresentation);
  headPresentation.add(component.mesh);
  headPresentation.add(alternate.mesh);
  rider.userData.sculptRuntime = { joints: {}, deformations: [] };
  const layer = new CharacterProportionLayer(rider);

  const neckBase = neck.position.clone();
  const torsoPositionBase = torsoMarker.position.clone();
  const torsoScaleBase = torsoMarker.scale.clone();
  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, neckLength: 0 });
  near(head.position.y, 0.095);
  near(headPresentation.position.y, -0.095);
  assert.deepEqual(neck.position.toArray(), neckBase.toArray());
  assert.deepEqual(torsoMarker.position.toArray(), torsoPositionBase.toArray());
  assert.deepEqual(torsoMarker.scale.toArray(), torsoScaleBase.toArray());
  assert.deepEqual(head.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(headPresentation.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(component.mesh.scale.toArray(), [0.4, 0.4, 0.4]);
  layer.clear();
  near(head.position.y, 0.095);
  near(headPresentation.position.y, 0);

  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, neckLength: 1.8 });
  near(head.position.y, 0.095);
  near(headPresentation.position.y, 0.095 * 0.8);
  assert.deepEqual(neck.position.toArray(), neckBase.toArray());
  assert.deepEqual(head.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(component.mesh.scale.toArray(), [0.4, 0.4, 0.4]);
  layer.clear();

  head.position.y = 0.115;
  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, neckLength: 1.8 });
  near(head.position.y, 0.115);
  near(headPresentation.position.y, 0.095 * 0.8);
  layer.clear();
  near(head.position.y, 0.115);
  head.position.y = 0.095;

  const torsoMarkerScale = torsoMarker.scale.clone();
  const neckPosition = neck.position.clone();
  layer.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    neckLength: -3,
    headForwardOffset: 0.35,
    headRestPitch: -20,
  });
  near(head.position.y, 0.095);
  near(head.position.z, 0);
  near(headPresentation.position.y, -0.38);
  near(headPresentation.position.z, 0.35);
  const expectedNeutralPitch = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(-20), 0, 0),
  );
  near(Math.abs(headPresentation.quaternion.dot(expectedNeutralPitch)), 1);
  assert.deepEqual(neck.position.toArray(), neckPosition.toArray());
  assert.deepEqual(torsoMarker.scale.toArray(), torsoMarkerScale.toArray());
  assert.deepEqual(component.mesh.scale.toArray(), [0.4, 0.4, 0.4]);
  assert.deepEqual(alternate.mesh.scale.toArray(), [0.46, 0.46, 0.46]);
  layer.clear();
  near(head.position.y, 0.095);
  near(head.position.z, 0);
  near(headPresentation.position.length(), 0);
  near(Math.abs(headPresentation.quaternion.dot(new THREE.Quaternion())), 1);

  const authoredHead = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.18, 0.62, -0.09),
  );
  head.quaternion.copy(authoredHead);
  layer.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    neckLength: 0.5,
    headForwardOffset: 0.3,
    headRestPitch: -25,
  });
  near(Math.abs(head.quaternion.dot(authoredHead)), 1,
    1e-10);
  const parentFrameOffset = headPresentation.position.clone()
    .multiply(head.scale)
    .applyQuaternion(head.quaternion);
  near(parentFrameOffset.x, 0, 1e-10);
  near(parentFrameOffset.y, -0.0475, 1e-10);
  near(parentFrameOffset.z, 0.3, 1e-10);
  const authoredNeutralPitch = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(-25), 0, 0),
  );
  near(Math.abs(headPresentation.quaternion.dot(authoredNeutralPitch)), 1);
  layer.clear();
  near(Math.abs(head.quaternion.dot(authoredHead)), 1);
  near(headPresentation.position.length(), 0);
  head.quaternion.identity();

  layer.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    headSize: 1.25,
    headWidth: 1.2,
    headDepth: 0.8,
  });
  near(head.position.y, 0.095);
  assert.deepEqual(head.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(headPresentation.scale.toArray(), [1.5, 1.25, 1]);
  assert.deepEqual(component.mesh.scale.toArray(), [0.4, 0.4, 0.4]);
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
    readFile(resolve(root, 'src/character/meshyHead.generated.ts')),
    readFile(resolve(root, 'public/characters/meshy-head/provenance.json'), 'utf8'),
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'src/main.ts'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
    readFile(resolve(root, 'public/characters/meshy-head/base-color.webp')),
    readFile(resolve(root, 'public/characters/meshy-head/roughness.webp')),
  ]);
  const provenance = JSON.parse(provenanceSource);
  assert.equal(MESHY_HEAD_ASSET.sourceSha256,
    '7ce05ff91c0b33ff3845c0e5a24610eeb51d3851abf25167e22910ed93f0b234');
  assert.equal(sha256(generatedSource), provenance.generatedModuleSha256);
  assert.deepEqual(textureBytes.map(sha256), [
    provenance.webTextures.baseColor.sha256,
    provenance.webTextures.roughness.sha256,
  ]);
  assert.match(playerSource, /createMeshyHead\(/);
  assert.match(playerSource, /createMeshyBoolieRooHead\(/);
  assert.match(playerSource, /import\('\.\/character\/meshyBoolieRooHead'\)/,
    'alternate head must remain a first-selection dynamic import');
  assert.match(playerSource, /setCharacterHeadStyle/);
  assert.match(playerSource, /socket-head-visual-center/);
  assert.match(playerSource, /headLookSocket\.getWorldQuaternion/);
  const finalOverlayIndex = playerSource.indexOf('this.playerAnimationBridge.applyOverlay(dt);');
  const finalAppearanceIndex = playerSource.indexOf(
    'this.syncCharacterAppearance();',
    finalOverlayIndex,
  );
  const maskSocketSampleIndex = playerSource.indexOf(
    'this.headVisualCenter.getWorldPosition(this.maskAnchor)',
    finalAppearanceIndex,
  );
  const finalSolePlantIndex = playerSource.indexOf(
    'this.plantOnDeck(underW);',
    finalAppearanceIndex,
  );
  assert.ok(finalOverlayIndex >= 0 && finalAppearanceIndex > finalOverlayIndex);
  assert.ok(finalSolePlantIndex > finalAppearanceIndex);
  assert.ok(maskSocketSampleIndex > finalSolePlantIndex,
    'mask sockets must be sampled after authored head/profile and final root corrections');
  assert.doesNotMatch(playerSource,
    /neck-volume|const skull =|const muzzle =|eye-white-|earOuterGeo|const crown =/);
  assert.match(labSource, /\['Head', 'head'\]/);
  assert.match(labSource, /\['alternate', 'BoolieRoo'\]/);
  assert.match(mainSource, /getMeshyHeadDiagnostics/);
  assert.match(mainSource, /getAlternateHeadDiagnostics/);
  assert.match(JSON.parse(packageSource).scripts['check:character-lab'],
    /test-meshy-head\.mjs/);

  const [alternateGenerated, alternateProvenanceSource, ...alternateTextureBytes] =
    await Promise.all([
      readFile(resolve(root, 'src/character/meshyBoolieRooHead.generated.ts')),
      readFile(resolve(root, 'public/characters/meshy-boolieroo-head/provenance.json'), 'utf8'),
      readFile(resolve(root, 'public/characters/meshy-boolieroo-head/base-color.webp')),
      readFile(resolve(root, 'public/characters/meshy-boolieroo-head/roughness.webp')),
    ]);
  const alternateProvenance = JSON.parse(alternateProvenanceSource);
  assert.equal(MESHY_BOOLIEROO_HEAD_ASSET.sourceSha256,
    '3785121eba8296c773d3d41834ae2e44eb4b7da471576772fe4eea0c1d9aacf3');
  assert.equal(sha256(alternateGenerated), alternateProvenance.generatedModuleSha256);
  assert.deepEqual(alternateTextureBytes.map(sha256), [
    alternateProvenance.webTextures.baseColor.sha256,
    alternateProvenance.webTextures.roughness.sha256,
  ]);
  assert.equal(
    alternateProvenance.sourceArchive.file,
    'Meshy_AI_BoolieRoo_0902221249_texture_fbx.zip',
  );
  const alternateImporterSource = await readFile(
    resolve(root, 'tools/import-meshy-boolieroo-head.mjs'),
    'utf8',
  );
  for (const productionSource of [
    playerSource,
    labSource,
    alternateGenerated.toString('utf8'),
    alternateProvenanceSource,
    alternateImporterSource,
  ]) {
    assert.doesNotMatch(
      productionSource,
      /Coco_Bandicoot|meshy-coco-head|meshyCocoHead|MESHY_COCO/,
      'Meshy auto-assigned source name leaked back into production',
    );
  }

  console.log('PASS Meshy head geometry, textures, semantic attachment, pure neck gap, provenance, and player wiring');
} finally {
  await server.close();
}
