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
  const alternateHeadApi = await server.ssrLoadModule('/src/character/meshyCocoHead.ts');
  const { MESHY_HEAD_ASSET } = await server.ssrLoadModule(
    '/src/character/meshyHead.generated.ts');
  const { MESHY_COCO_HEAD_ASSET } = await server.ssrLoadModule(
    '/src/character/meshyCocoHead.generated.ts');
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
  const alternate = alternateHeadApi.createMeshyCocoHead();
  assert.equal(component.triangles, 16536);
  assert.equal(component.mesh.geometry.getAttribute('position').count, 49608);
  assert.equal(component.mesh.geometry.getAttribute('uv').count, 49608);
  assert.equal(component.mesh.geometry.getAttribute('normal'), undefined);
  assert.equal(component.mesh.material.flatShading, true);
  assert.equal(component.mesh.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(component.mesh.material.normalMap.colorSpace, THREE.NoColorSpace);
  assert.deepEqual(meshyHeadTextureDiagnostics(), {
    state: 'loading', loaded: 0, requested: 4, error: null,
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
  assert.equal(alternate.mesh.geometry.getAttribute('position').count, 46902);
  assert.equal(alternate.mesh.geometry.getAttribute('uv').count, 46902);
  alternate.mesh.geometry.computeBoundingBox();
  assert.deepEqual(alternate.mesh.geometry.boundingBox.min.toArray(),
    [-0.5, 0, -0.259765625]);
  assert.deepEqual(alternate.mesh.geometry.boundingBox.max.toArray(),
    [0.5, 0.7890625, 0.26171875]);
  near(alternate.mesh.scale.x, 0.46);

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
  head.add(component.mesh);
  head.add(alternate.mesh);
  rider.userData.sculptRuntime = { joints: {}, deformations: [] };
  const layer = new CharacterProportionLayer(rider);

  const neckBase = neck.position.clone();
  const torsoPositionBase = torsoMarker.position.clone();
  const torsoScaleBase = torsoMarker.scale.clone();
  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, neckLength: 0 });
  near(head.position.y, 0);
  assert.deepEqual(neck.position.toArray(), neckBase.toArray());
  assert.deepEqual(torsoMarker.position.toArray(), torsoPositionBase.toArray());
  assert.deepEqual(torsoMarker.scale.toArray(), torsoScaleBase.toArray());
  assert.deepEqual(head.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(component.mesh.scale.toArray(), [0.4, 0.4, 0.4]);
  layer.clear();
  near(head.position.y, 0.095);

  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, neckLength: 1.8 });
  near(head.position.y, 0.095 * 1.8);
  assert.deepEqual(neck.position.toArray(), neckBase.toArray());
  assert.deepEqual(head.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(component.mesh.scale.toArray(), [0.4, 0.4, 0.4]);
  layer.clear();

  head.position.y = 0.115;
  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, neckLength: 1.8 });
  near(head.position.y, 0.115 + 0.095 * 0.8);
  layer.clear();
  near(head.position.y, 0.115);
  head.position.y = 0.095;

  layer.apply({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    headSize: 1.25,
    headWidth: 1.2,
    headDepth: 0.8,
  });
  near(head.position.y, 0.095);
  assert.deepEqual(head.scale.toArray(), [1.5, 1.25, 1]);
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
    readFile(resolve(root, 'public/characters/meshy-head/base-color.png')),
    readFile(resolve(root, 'public/characters/meshy-head/normal.png')),
    readFile(resolve(root, 'public/characters/meshy-head/roughness.png')),
    readFile(resolve(root, 'public/characters/meshy-head/metallic.png')),
  ]);
  const provenance = JSON.parse(provenanceSource);
  assert.equal(MESHY_HEAD_ASSET.sourceSha256,
    '7ce05ff91c0b33ff3845c0e5a24610eeb51d3851abf25167e22910ed93f0b234');
  assert.equal(sha256(generatedSource), provenance.generatedModuleSha256);
  assert.deepEqual(textureBytes.map(sha256), [
    provenance.webTextures.baseColor.sha256,
    provenance.webTextures.normal.sha256,
    provenance.webTextures.roughness.sha256,
    provenance.webTextures.metallic.sha256,
  ]);
  assert.match(playerSource, /createMeshyHead\(/);
  assert.match(playerSource, /createMeshyCocoHead\(/);
  assert.match(playerSource, /setCharacterHeadStyle/);
  assert.match(playerSource, /socket-head-visual-center/);
  assert.match(playerSource, /headLookSocket\.getWorldQuaternion/);
  assert.doesNotMatch(playerSource,
    /neck-volume|const skull =|const muzzle =|eye-white-|earOuterGeo|const crown =/);
  assert.match(labSource, /\['Head', 'head'\]/);
  assert.match(labSource, /\['alternate', 'Alternate'\]/);
  assert.match(mainSource, /getMeshyHeadDiagnostics/);
  assert.match(mainSource, /getAlternateHeadDiagnostics/);
  assert.match(JSON.parse(packageSource).scripts['check:character-lab'],
    /test-meshy-head\.mjs/);

  const [alternateGenerated, alternateProvenanceSource, ...alternateTextureBytes] =
    await Promise.all([
      readFile(resolve(root, 'src/character/meshyCocoHead.generated.ts')),
      readFile(resolve(root, 'public/characters/meshy-coco-head/provenance.json'), 'utf8'),
      readFile(resolve(root, 'public/characters/meshy-coco-head/base-color.png')),
      readFile(resolve(root, 'public/characters/meshy-coco-head/normal.png')),
      readFile(resolve(root, 'public/characters/meshy-coco-head/roughness.png')),
      readFile(resolve(root, 'public/characters/meshy-coco-head/metallic.png')),
    ]);
  const alternateProvenance = JSON.parse(alternateProvenanceSource);
  assert.equal(MESHY_COCO_HEAD_ASSET.sourceSha256,
    '3785121eba8296c773d3d41834ae2e44eb4b7da471576772fe4eea0c1d9aacf3');
  assert.equal(sha256(alternateGenerated), alternateProvenance.generatedModuleSha256);
  assert.deepEqual(alternateTextureBytes.map(sha256), [
    alternateProvenance.webTextures.baseColor.sha256,
    alternateProvenance.webTextures.normal.sha256,
    alternateProvenance.webTextures.roughness.sha256,
    alternateProvenance.webTextures.metallic.sha256,
  ]);

  console.log('PASS Meshy head geometry, textures, semantic attachment, pure neck gap, provenance, and player wiring');
} finally {
  await server.close();
}
