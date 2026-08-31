import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetRoot = resolve(root, 'public/characters/meshy-fox');
const fbxPath = resolve(assetRoot, 'meshy-fox.fbx');
const texturePath = resolve(assetRoot, 'Character_output.fbm/texture_0.png');
const provenancePath = resolve(assetRoot, 'provenance.json');
const modulePath = resolve(root, 'src/character/meshyFoxEvaluationModel.ts');
const playerPath = resolve(root, 'src/player.ts');
const mainPath = resolve(root, 'src/main.ts');
const studioPath = resolve(root, 'src/animationStudio.ts');
const packagePath = resolve(root, 'package.json');

const [fbx, texture, provenanceText, moduleSource, player, main, studio, packageText] =
  await Promise.all([
    readFile(fbxPath),
    readFile(texturePath),
    readFile(provenancePath, 'utf8'),
    readFile(modulePath, 'utf8'),
    readFile(playerPath, 'utf8'),
    readFile(mainPath, 'utf8'),
    readFile(studioPath, 'utf8'),
    readFile(packagePath, 'utf8'),
  ]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const provenance = JSON.parse(provenanceText);

assert.equal(fbx.length, 49_512_860);
assert.equal(sha256(fbx), '8d279f18322b1f54f14695fae1695f2e36013e451afb91e8c2b88f6900d2e348');
assert.equal(fbx.subarray(0, 21).toString('ascii'), 'Kaydara FBX Binary  \0');
assert.equal(fbx.readUInt8(21), 0x1a);
assert.equal(fbx.readUInt8(22), 0);
assert.equal(fbx.readUInt32LE(23), 7400, 'FBX binary version');

assert.equal(texture.length, 4_686_516);
assert.equal(sha256(texture), '123fe28d6e16b6eea310a0eb7c55889693dee2a78fc1e3862871e8abf1ed1973');
assert.equal(texture.subarray(1, 4).toString('ascii'), 'PNG');
assert.equal(texture.readUInt32BE(16), 2048);
assert.equal(texture.readUInt32BE(20), 2048);

assert.equal(provenance.asset.runtimeFileSha256, sha256(fbx));
assert.equal(provenance.asset.runtimeFileByteLength, fbx.length);
assert.equal(provenance.source.archiveSha256,
  'c1eb0d50f89481c4d0085513026cecaf7bc543b185342753761199d29acbcd5b');
assert.equal(provenance.license.status, 'not-declared-in-archive');
assert.equal(provenance.inventory.jointCount, 24);
assert.equal(provenance.inventory.weightedJointCount, 22);
assert.equal(provenance.inventory.triangleCount, 94_224);
assert.equal(provenance.inventory.verticesOverFourInfluences, 3911);
assert.equal(provenance.inventory.verticesDroppingOverFivePercent, 203);
assert.equal(provenance.texturePreview.runtimeSha256, sha256(texture));

function compileModule(source) {
  const output = ts.transpileModule(
    source.replaceAll('import.meta.env.BASE_URL', JSON.stringify('/')),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, (specifier) => {
    if (specifier === 'three') return THREE;
    if (specifier.endsWith('FBXLoader.js')) return { FBXLoader: class LoaderStub {} };
    throw new Error(`unexpected Meshy adapter import: ${specifier}`);
  });
  return module.exports;
}

const api = compileModule(moduleSource);
assert.equal(api.MESHY_FOX_MODEL_PATH, 'characters/meshy-fox/meshy-fox.fbx');
assert.equal(
  api.MESHY_FOX_PREVIEW_TEXTURE_PATH,
  'characters/meshy-fox/Character_output.fbm/texture_0.png',
);
assert.equal(api.MESHY_FOX_TARGET_HEIGHT, 1.81);
assert.equal(api.MESHY_FOX_TARGET_BONE_NAMES.length, 24);
assert.deepEqual(Object.keys(api.MESHY_FOX_TARGET_TO_SOURCE_BONE).sort(),
  [...api.MESHY_FOX_TARGET_BONE_NAMES].sort());
assert.equal(Object.values(api.MESHY_FOX_TARGET_TO_SOURCE_BONE)
  .filter((name) => name !== null).length, 22);
assert.deepEqual(api.MESHY_FOX_TARGET_TO_SOURCE_BONE, {
  Hips: 'hips',
  LeftUpLeg: 'hip-left', LeftLeg: 'knee-left', LeftFoot: 'ankle-left', LeftToeBase: 'toe-left',
  RightUpLeg: 'hip-right', RightLeg: 'knee-right', RightFoot: 'ankle-right', RightToeBase: 'toe-right',
  Spine02: 'torso-root', Spine01: 'spine', Spine: 'chest',
  LeftShoulder: 'clavicle-left', LeftArm: 'shoulder-left',
  LeftForeArm: 'elbow-left', LeftHand: 'wrist-left',
  RightShoulder: 'clavicle-right', RightArm: 'shoulder-right',
  RightForeArm: 'elbow-right', RightHand: 'wrist-right',
  neck: 'neck', Head: 'head', head_end: null, headfront: null,
});
assert.equal(api.MESHY_FOX_DEFORMATION_SEGMENTS.length, 10);

const EvaluationModel = api.MeshyFoxEvaluationModel;
for (const method of [
  'load', 'setVisible', 'rebindSource', 'updateAfterSourcePose', 'reset', 'dispose',
]) assert.equal(typeof EvaluationModel.prototype[method], 'function', `missing ${method}`);
for (const fragment of [
  "if (!url.startsWith('blob:')) return url;",
  'URL.revokeObjectURL(url)',
  'return this.previewTextureUrl;',
  'this.installTargetCanonicalPose(binding, restMatrices);',
  'new THREE.Quaternion().setFromUnitVectors(restDirection, desiredDirection)',
  'this.applyPresentationIk();',
  'mesh.frustumCulled = false;',
  'mesh.castShadow = true;',
  'mesh.receiveShadow = true;',
]) assert.ok(moduleSource.includes(fragment), `missing runtime contract: ${fragment}`);

function sourceFixture() {
  const root = new THREE.Group();
  const names = [...new Set(Object.values(api.MESHY_FOX_TARGET_TO_SOURCE_BONE)
    .filter((name) => name !== null))];
  const bones = names.map((name, index) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(0, index * 0.01, 0);
    root.add(bone);
    return bone;
  });
  const byName = new Map(bones.map((bone) => [bone.name, bone]));
  byName.get('head').position.y = 1.7;
  byName.get('toe-left').position.y = 0;
  byName.get('toe-right').position.y = 0;
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  return { root, skeleton };
}

function targetFixture() {
  const scene = new THREE.Group();
  const armature = new THREE.Group();
  const bones = new Map(api.MESHY_FOX_TARGET_BONE_NAMES.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    return [name, bone];
  }));
  const attach = (child, parent, position) => {
    child.position.fromArray(position);
    parent.add(child);
  };
  attach(bones.get('Hips'), armature, [0, 105, 0]);
  attach(bones.get('LeftUpLeg'), bones.get('Hips'), [12, 0, 0]);
  attach(bones.get('LeftLeg'), bones.get('LeftUpLeg'), [0, -40, 0]);
  attach(bones.get('LeftFoot'), bones.get('LeftLeg'), [0, -45, 0]);
  attach(bones.get('LeftToeBase'), bones.get('LeftFoot'), [0, -15, 8]);
  attach(bones.get('RightUpLeg'), bones.get('Hips'), [-12, 0, 0]);
  attach(bones.get('RightLeg'), bones.get('RightUpLeg'), [0, -40, 0]);
  attach(bones.get('RightFoot'), bones.get('RightLeg'), [0, -45, 0]);
  attach(bones.get('RightToeBase'), bones.get('RightFoot'), [0, -15, 8]);
  attach(bones.get('Spine02'), bones.get('Hips'), [0, 0, 0]);
  attach(bones.get('Spine01'), bones.get('Spine02'), [0, 22, 0]);
  attach(bones.get('Spine'), bones.get('Spine01'), [0, 22, 0]);
  attach(bones.get('LeftShoulder'), bones.get('Spine'), [10, 10, 0]);
  attach(bones.get('LeftArm'), bones.get('LeftShoulder'), [10, 0, 0]);
  attach(bones.get('LeftForeArm'), bones.get('LeftArm'), [24, -8, 0]);
  attach(bones.get('LeftHand'), bones.get('LeftForeArm'), [24, 0, 0]);
  attach(bones.get('RightShoulder'), bones.get('Spine'), [-10, 10, 0]);
  attach(bones.get('RightArm'), bones.get('RightShoulder'), [-10, 0, 0]);
  attach(bones.get('RightForeArm'), bones.get('RightArm'), [-24, -8, 0]);
  attach(bones.get('RightHand'), bones.get('RightForeArm'), [-24, 0, 0]);
  attach(bones.get('neck'), bones.get('Spine'), [0, 18, 0]);
  attach(bones.get('Head'), bones.get('neck'), [0, 15, 0]);
  attach(bones.get('head_end'), bones.get('Head'), [0, 15, 0]);
  attach(bones.get('headfront'), bones.get('Head'), [0, 5, 8]);

  const geometry = new THREE.BoxGeometry(100, 197, 40);
  geometry.translate(0, 98.5, 0);
  const vertexCount = geometry.getAttribute('position').count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index++) skinWeights[index * 4] = 1;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  const skeleton = new THREE.Skeleton(api.MESHY_FOX_TARGET_BONE_NAMES.map((name) => bones.get(name)));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  scene.add(armature, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(skeleton);
  return scene;
}

// Regression: the Animation Studio can capture this root before the async FBX
// arrives and later restore its old scale of 1. The adapter must reclaim its
// measured fit on every sync instead of leaving a 197-metre skin around the
// camera.
{
  const source = sourceFixture();
  const parent = new THREE.Group();
  const model = EvaluationModel.fromScene(targetFixture(), {
    parent,
    sourceRoot: source.root,
    sourceSkeleton: source.skeleton,
    visible: true,
    loader: {},
  });
  const expectedFit = api.MESHY_FOX_TARGET_HEIGHT / 197;
  assert.ok(Math.abs(model.diagnostics.fitScale - expectedFit) < 1e-9);
  for (const reclaim of [
    () => model.setVisible(true),
    () => model.updateAfterSourcePose(),
    () => model.reset(),
  ]) {
    model.root.scale.set(1, 2, 3);
    reclaim();
    assert.ok(model.root.scale.toArray().every((value) => Math.abs(value - expectedFit) < 1e-9),
      'Meshy adapter must reclaim its fitted root scale after a stale snapshot');
  }
  model.dispose();
}

assert.match(player,
  /type CharacterPresentationMode =[\s\S]*'procedural'[\s\S]*'quaternius-female'[\s\S]*'meshy-fox';/);
assert.ok(player.includes('this.installMeshyFoxEvaluationModel();'));
assert.ok(player.includes("'quaternius-female': 'meshy-fox'"));
assert.ok(player.includes("'meshy-fox': 'procedural'"));
assert.ok(player.includes("procedural: 'quaternius-female'"));
assert.ok(player.includes("if (mode === 'meshy-fox') this.ensureMeshyFoxLoad();"));
assert.ok(player.includes('if (showMeshy) meshy.updateAfterSourcePose();'));
assert.ok(player.includes('meshy?.setVisible(showMeshy);'));
assert.ok(player.includes('this.meshyFoxEvaluationModel?.rebindSource('));
assert.match(main, /mode: 'procedural' \| 'quaternius-female' \| 'meshy-fox'/);
assert.ok(studio.includes("button.toggleAttribute('data-loading', !state.ready);"));
assert.ok(studio.includes("button.setAttribute('aria-busy', state.ready ? 'false' : 'true');"));

const packageJson = JSON.parse(packageText);
assert.match(packageJson.scripts['check:character-evaluation'],
  /test-meshy-fox-evaluation\.mjs/);

console.log(
  `PASS Meshy fox native FBX comparison surface: ${fbx.length} bytes, ` +
  `${provenance.inventory.triangleCount} triangles, ${provenance.inventory.jointCount} bones`,
);
