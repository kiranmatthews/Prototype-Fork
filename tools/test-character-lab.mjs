import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
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

const near = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`);
};

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    values,
  };
}

function fixture() {
  const rootNode = new THREE.Group();
  rootNode.name = 'player-visual';
  const rider = new THREE.Group();
  rider.name = 'procedural-rider';
  rootNode.add(rider);

  const nodes = new Map();
  const add = (name, parent, position = [0, 0, 0]) => {
    const node = new THREE.Bone();
    node.name = name;
    node.position.fromArray(position);
    parent.add(node);
    nodes.set(name, node);
    return node;
  };
  const visual = (name, parent, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1));
    mesh.name = name;
    mesh.position.fromArray(position);
    parent.add(mesh);
    nodes.set(name, mesh);
    return mesh;
  };

  const hips = add('hips', rider, [0, 0.7, 0]);
  visual('pelvis-volume', hips);
  const torsoSurface = visual('meshy-torso-surface', rider, [0, 1.0175, 0]);
  torsoSurface.scale.setScalar(0.615);
  const torsoPosition = torsoSurface.geometry.getAttribute('position');
  const torsoWidthMorph = new THREE.Float32BufferAttribute(
    new Float32Array(torsoPosition.count * 3), 3);
  torsoWidthMorph.name = 'torso-width';
  const torsoDepthMorph = new THREE.Float32BufferAttribute(
    new Float32Array(torsoPosition.count * 3), 3);
  torsoDepthMorph.name = 'torso-depth';
  torsoSurface.geometry.morphAttributes.position = [torsoWidthMorph, torsoDepthMorph];
  torsoSurface.geometry.morphTargetsRelative = true;
  torsoSurface.updateMorphTargets();
  const shortsSurface = visual('meshy-shorts-surface', rider, [0, 0.627, 0]);
  shortsSurface.scale.setScalar(0.388);
  const shortsPosition = shortsSurface.geometry.getAttribute('position');
  const shortsMorphs = ['shorts-width', 'shorts-length', 'shorts-depth'].map((name) => {
    const attribute = new THREE.Float32BufferAttribute(
      new Float32Array(shortsPosition.count * 3), 3);
    attribute.name = name;
    return attribute;
  });
  shortsSurface.geometry.morphAttributes.position = shortsMorphs;
  shortsSurface.geometry.morphTargetsRelative = true;
  shortsSurface.updateMorphTargets();
  const torsoRoot = add('torso-root', hips);
  const spine = add('spine', torsoRoot, [0, 0.12, 0]);
  visual('waist-volume', spine, [0, 0.08, 0]);
  const chest = add('chest', spine, [0, 0.24, 0]);
  visual('chest-volume', chest, [0, 0.1, 0]);
  visual('neck-volume', chest, [0, 0.25, 0]);
  const neck = add('neck', chest, [0, 0.25, 0]);
  const head = add('head', neck, [0, 0.095, 0]);
  visual('head-volume', head);

  const joints = { hips: 'hips', torsoRoot: 'torso-root', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head' };
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? 1 : -1;
    const clavicle = add(`clavicle-${side}`, chest, [sign * 0.1, 0.14, 0]);
    const shoulder = add(`shoulder-${side}`, clavicle, [sign * 0.2, 0, 0]);
    visual(`upper-arm-${side}`, shoulder, [0, -0.1, 0]);
    const elbow = add(`elbow-${side}`, shoulder, [0, -0.22, 0]);
    visual(`forearm-${side}`, elbow, [0, -0.09, 0]);
    const wrist = add(`wrist-${side}`, elbow, [0, -0.19, 0]);
    const handRest = new THREE.Group();
    handRest.name = `hand-rest-orientation-${side}`;
    handRest.rotation.y = -sign * Math.PI / 2;
    wrist.add(handRest);
    nodes.set(handRest.name, handRest);
    visual(`hand-${side}`, handRest, [0, -0.05, 0]);
    const hip = add(`hip-${side}`, hips, [sign * 0.115, 0, 0]);
    visual(`thigh-${side}`, hip, [0, -0.12, 0]);
    const knee = add(`knee-${side}`, hip, [0, -0.28, 0]);
    visual(`shin-${side}`, knee, [0, -0.11, 0]);
    const ankle = add(`ankle-${side}`, knee, [0, -0.25, 0]);
    visual(`foot-${side}`, ankle, [0, -0.04, 0.08]);
    const sockSurface = visual(`meshy-sock-surface-${side}`, rider, [sign * 0.115, 0.15, 0]);
    const sockPosition = sockSurface.geometry.getAttribute('position');
    const sockThicknessMorph = new THREE.Float32BufferAttribute(
      new Float32Array(sockPosition.count * 3), 3);
    sockThicknessMorph.name = 'sock-thickness';
    sockSurface.geometry.morphAttributes.position = [sockThicknessMorph];
    sockSurface.geometry.morphTargetsRelative = true;
    sockSurface.updateMorphTargets();
    add(`ear-${side}`, head, [sign * 0.1, 0.13, 0]);
    for (const part of ['white', 'iris', 'pupil', 'lash']) {
      visual(`eye-${part}-${side}`, head, [sign * 0.07, 0.03, 0.15]);
    }
    Object.assign(joints, {
      [`clavicle${side === 'left' ? 'Left' : 'Right'}`]: `clavicle-${side}`,
      [`shoulder${side === 'left' ? 'Left' : 'Right'}`]: `shoulder-${side}`,
      [`elbow${side === 'left' ? 'Left' : 'Right'}`]: `elbow-${side}`,
      [`wrist${side === 'left' ? 'Left' : 'Right'}`]: `wrist-${side}`,
      [`hip${side === 'left' ? 'Left' : 'Right'}`]: `hip-${side}`,
      [`knee${side === 'left' ? 'Left' : 'Right'}`]: `knee-${side}`,
      [`ankle${side === 'left' ? 'Left' : 'Right'}`]: `ankle-${side}`,
    });
  }
  const ponytail = new THREE.Group();
  ponytail.name = 'ponytail-base';
  head.add(ponytail);
  nodes.set(ponytail.name, ponytail);

  const deformation = (controlId, jointId, endpointId, axis) => ({
    controlId,
    jointId,
    downstreamJointIds: [endpointId],
    lengthAxis: axis,
  });
  rootNode.userData.sculptRuntime = {
    joints,
    deformations: [
      deformation('deform.torso.length', 'spine', 'chest', [0, 1, 0]),
      deformation('deform.torso.length', 'chest', 'neck', [0, 1, 0]),
      deformation('deform.arm.upper.left.length', 'shoulderLeft', 'elbowLeft', [0, -1, 0]),
      deformation('deform.arm.lower.left.length', 'elbowLeft', 'wristLeft', [0, -1, 0]),
      deformation('deform.arm.upper.right.length', 'shoulderRight', 'elbowRight', [0, -1, 0]),
      deformation('deform.arm.lower.right.length', 'elbowRight', 'wristRight', [0, -1, 0]),
      deformation('deform.leg.upper.left.length', 'hipLeft', 'kneeLeft', [0, -1, 0]),
      deformation('deform.leg.lower.left.length', 'kneeLeft', 'ankleLeft', [0, -1, 0]),
      deformation('deform.leg.upper.right.length', 'hipRight', 'kneeRight', [0, -1, 0]),
      deformation('deform.leg.lower.right.length', 'kneeRight', 'ankleRight', [0, -1, 0]),
    ],
  };
  return { root: rootNode, rider, nodes };
}

function snapshot(rootNode) {
  const result = new Map();
  rootNode.traverse((object) => {
    result.set(object.name || object.uuid, {
      position: object.position.toArray(),
      scale: object.scale.toArray(),
      quaternion: object.quaternion.toArray(),
      morphTargetInfluences: [...((object).morphTargetInfluences ?? [])],
    });
  });
  return result;
}

try {
  const settingsApi = await server.ssrLoadModule('/src/character/settings.ts');
  const { CharacterProportionLayer } = await server.ssrLoadModule('/src/character/proportionLayer.ts');
  const {
    CHARACTER_PROPORTION_CONTROLS,
    CHARACTER_PROPORTION_STORAGE_KEY,
    CHARACTER_HAND_REST_REVISION,
    CharacterProportionSettings,
    DEFAULT_CHARACTER_PROPORTIONS,
    clampCharacterProportions,
  } = settingsApi;

  assert.equal(CHARACTER_PROPORTION_CONTROLS.length, 29);
  assert.deepEqual(
    new Set(CHARACTER_PROPORTION_CONTROLS.map((control) => control.key)),
    new Set(Object.keys(DEFAULT_CHARACTER_PROPORTIONS)),
    'every persisted proportion has exactly one Character Lab slider',
  );
  assert.deepEqual(clampCharacterProportions({}), DEFAULT_CHARACTER_PROPORTIONS);
  const clamped = clampCharacterProportions({
    headSize: 99,
    neckLength: -4,
    wristRestPitch: NaN,
    wristRestYaw: 999,
    armKnobSize: 99,
    legKnobSize: -2,
    shortsWidth: 99,
    shortsHeight: -2,
  });
  assert.equal(clamped.headSize, 1.55);
  assert.equal(clamped.neckLength, 0);
  assert.equal(clamped.wristRestPitch, 0);
  assert.equal(clamped.wristRestYaw, 180);
  assert.equal(clamped.armKnobSize, 1.62);
  assert.equal(clamped.legKnobSize, 1);
  assert.equal(clamped.shortsWidth, 1.5);
  assert.equal(clamped.shortsHeight, 0.65);

  const stored = memoryStorage({
    [CHARACTER_PROPORTION_STORAGE_KEY]: JSON.stringify({
      version: 1,
      settings: {
        headSize: 1.31,
        shoulderWidth: 1.2,
        wristRestPitch: 22,
        wristRestYaw: -90,
        wristRestRoll: -4,
      },
    }),
  });
  const settings = new CharacterProportionSettings(stored);
  assert.equal(settings.value.headSize, 1.31);
  assert.equal(settings.value.shoulderWidth, 1.2);
  assert.equal(settings.value.footSize, 1);
  assert.equal(settings.value.armKnobSize, 1,
    'older saved Character Lab values must gain the additive knob controls');
  assert.equal(settings.value.shortsWidth, 1,
    'older saved Character Lab values must gain clothing controls');
  assert.equal(settings.value.wristRestPitch, 0,
    'pre-release wrist tuning must migrate to the corrected anatomical base');
  assert.equal(settings.value.wristRestYaw, 0);
  assert.equal(settings.value.wristRestRoll, 0);
  let notifications = 0;
  settings.subscribe(() => notifications++);
  settings.patch({ handSize: 1.28 });
  assert.equal(notifications, 1);
  const persisted = JSON.parse(stored.values.get(CHARACTER_PROPORTION_STORAGE_KEY));
  assert.equal(persisted.version, 1);
  assert.equal(persisted.handRestRevision, CHARACTER_HAND_REST_REVISION);
  assert.equal(persisted.settings.handSize, 1.28);
  const roundTrip = new CharacterProportionSettings(memoryStorage());
  roundTrip.importJson(settings.serialize(false));
  assert.deepEqual(roundTrip.value, settings.value);
  roundTrip.reset();
  assert.deepEqual(roundTrip.value, DEFAULT_CHARACTER_PROPORTIONS);

  const scene = fixture();
  const baseline = snapshot(scene.root);
  const layer = new CharacterProportionLayer(scene.root);
  layer.apply(DEFAULT_CHARACTER_PROPORTIONS);
  assert.deepEqual(snapshot(scene.root), baseline, 'default proportions are transform-identical');
  layer.clear();
  assert.deepEqual(snapshot(scene.root), baseline, 'clearing the default layer is exact');

  const shaped = {
    ...DEFAULT_CHARACTER_PROPORTIONS,
    overallScale: 1.1,
    height: 1.2,
    bodyWidth: 0.9,
    bodyDepth: 1.15,
    headSize: 1.35,
    headWidth: 1.2,
    neckLength: 0.6,
    torsoLength: 1.18,
    torsoWidth: 1.4,
    torsoDepth: 0.7,
    shoulderWidth: 1.25,
    hipWidth: 1.3,
    upperArmLength: 1.2,
    forearmLength: 0.85,
    thighLength: 1.3,
    shinLength: 0.8,
    armThickness: 1.22,
    legThickness: 0.82,
    shortsWidth: 1.3,
    shortsHeight: 1.2,
    shortsDepth: 0.8,
    handSize: 1.25,
    wristRestPitch: 20,
    wristRestYaw: 30,
    wristRestRoll: 40,
    footSize: 1.18,
  };
  layer.apply(shaped);
  near(scene.rider.scale.x, 1.1 * 0.9);
  near(scene.rider.scale.y, 1.1 * 1.2);
  near(scene.rider.scale.z, 1.1 * 1.15);
  near(scene.nodes.get('head').scale.x, 1.35 * 1.2);
  near(scene.nodes.get('head').scale.y, 1.35);
  near(scene.nodes.get('neck').position.y, 0.25 * 1.18,
    1e-9);
  near(scene.nodes.get('head').position.y, 0.095 * 0.6);
  assert.deepEqual(scene.nodes.get('neck-volume').scale.toArray(), [1, 1.18, 1],
    'torso length may stretch its marker, but neck height must not');
  near(scene.nodes.get('clavicle-left').position.x, 0.1 * 1.25);
  near(scene.nodes.get('clavicle-right').position.x, -0.1 * 1.25);
  near(scene.nodes.get('hip-left').position.x, 0.115 * 1.3);
  near(scene.nodes.get('hip-right').position.x, -0.115 * 1.3);
  near(scene.nodes.get('meshy-torso-surface').scale.x, 0.615);
  near(scene.nodes.get('meshy-torso-surface').scale.y, 0.615);
  near(scene.nodes.get('meshy-torso-surface').scale.z, 0.615);
  near(scene.nodes.get('meshy-torso-surface').morphTargetInfluences[0], 0.4);
  near(scene.nodes.get('meshy-torso-surface').morphTargetInfluences[1], -0.3);
  assert.deepEqual(scene.nodes.get('pelvis-volume').scale.toArray(), [1, 1, 1],
    'torso width/depth must not resize shorts or butt surfaces under hips');
  assert.deepEqual(scene.nodes.get('meshy-shorts-surface').scale.toArray(),
    [0.388, 0.388, 0.388]);
  near(scene.nodes.get('meshy-shorts-surface').morphTargetInfluences[0], 0.3);
  near(scene.nodes.get('meshy-shorts-surface').morphTargetInfluences[1], 0.2);
  near(scene.nodes.get('meshy-shorts-surface').morphTargetInfluences[2], -0.2);
  near(scene.nodes.get('meshy-sock-surface-left').morphTargetInfluences[0], -0.18);
  near(scene.nodes.get('meshy-sock-surface-right').morphTargetInfluences[0], -0.18);
  near(scene.nodes.get('knee-left').position.y, -0.28 * 1.3);
  near(scene.nodes.get('ankle-left').position.y, -0.25 * 0.8);
  near(scene.nodes.get('wrist-left').scale.x, 1.25);
  const leftHandRest = scene.nodes.get('hand-rest-orientation-left');
  const rightHandRest = scene.nodes.get('hand-rest-orientation-right');
  const expectedLeftHandRest = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0, 'XYZ'))
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(20),
    THREE.MathUtils.degToRad(30),
    THREE.MathUtils.degToRad(40),
    'XYZ',
  )));
  const expectedRightHandRest = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(0, Math.PI / 2, 0, 'XYZ'))
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(20),
    THREE.MathUtils.degToRad(-30),
    THREE.MathUtils.degToRad(-40),
    'XYZ',
  )));
  near(Math.abs(leftHandRest.quaternion.dot(expectedLeftHandRest)), 1);
  near(Math.abs(rightHandRest.quaternion.dot(expectedRightHandRest)), 1);
  const once = snapshot(scene.root);
  for (let iteration = 0; iteration < 100; iteration++) layer.apply(shaped);
  assert.deepEqual(snapshot(scene.root), once, '100 proportion passes do not accumulate');
  scene.nodes.get('head').quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
  layer.apply(shaped);
  near(scene.nodes.get('head').rotation.y, 0.7, 1e-6);
  layer.clear();
  const cleared = snapshot(scene.root);
  for (const [name, value] of baseline) {
    assert.deepEqual(cleared.get(name).position, value.position, `${name} position did not restore`);
    assert.deepEqual(cleared.get(name).scale, value.scale, `${name} scale did not restore`);
    if (name.startsWith('hand-rest-orientation-')) {
      assert.deepEqual(cleared.get(name).quaternion, value.quaternion, `${name} quaternion did not restore`);
    }
  }
  near(scene.nodes.get('head').rotation.y, 0.7, 1e-6);

  // Persistent anatomy multiplies an already-authored temporary deformation:
  // 0.8 animation squash × 1.2 Character Lab length = 0.96 final reach.
  const dynamicKnee = scene.nodes.get('knee-left');
  const dynamicThigh = scene.nodes.get('thigh-left');
  dynamicKnee.position.y = -0.28 * 0.8;
  dynamicThigh.scale.y = 0.8;
  layer.apply({ ...DEFAULT_CHARACTER_PROPORTIONS, thighLength: 1.2 });
  near(dynamicKnee.position.y, -0.28 * 0.8 * 1.2);
  near(dynamicThigh.scale.y, 0.8 * 1.2);
  layer.clear();
  near(dynamicKnee.position.y, -0.28 * 0.8);
  near(dynamicThigh.scale.y, 0.8);
  dynamicKnee.position.y = -0.28;
  dynamicThigh.scale.y = 1;

  for (const edge of ['min', 'max']) {
    const extremes = { ...DEFAULT_CHARACTER_PROPORTIONS };
    for (const control of CHARACTER_PROPORTION_CONTROLS) extremes[control.key] = control[edge];
    layer.apply(extremes);
    scene.root.updateMatrixWorld(true);
    scene.root.traverse((object) => {
      assert.ok([...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()]
        .every(Number.isFinite), `${object.name} became non-finite at ${edge} proportions`);
    });
  }
  layer.clear();

  const removed = [
    'src/character/quaterniusEvaluationModel.ts',
    'src/character/meshyFoxEvaluationModel.ts',
    'public/characters/quaternius-female/mannequin-f.glb',
    'public/characters/meshy-fox/meshy-fox.fbx',
    'public/characters/meshy-fox/Character_output.fbm/texture_0.png',
    'public/models/fox.glb',
    'public/models/roo.glb',
  ];
  for (const path of removed) {
    await assert.rejects(access(resolve(root, path)), undefined, `${path} should be removed`);
  }
  await access(resolve(root, 'public/animations/quaternius-jog-fwd/provenance.json'));
  await access(resolve(root, 'src/animation/quaterniusJogFwd.generated.ts'));

  const [playerSource, mainSource, studioSource, labSource, packageSource] = await Promise.all([
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/main.ts'), 'utf8'),
    readFile(resolve(root, 'src/animationStudio.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
  ]);
  for (const forbidden of ['quaterniusEvaluationModel', 'meshyFoxEvaluationModel', 'MESHY FOX', 'FEMALE…']) {
    assert.equal(playerSource.includes(forbidden), false, `Player still contains ${forbidden}`);
  }
  assert.equal(studioSource.includes('presentationSurface'), false,
    'Animation Studio still exposes removed comparison surfaces');
  assert.match(mainSource, /label: "CHARACTER"/);
  assert.match(mainSource, /openCharacterLabTool/);
  assert.match(mainSource, /location\.hash\.toLowerCase\(\)\.includes\("characterlab"\)/);
  assert.match(labSource, /CHARACTER LAB/);
  assert.match(labSource, /collision remain separate/);
  assert.match(labSource, /Show animal tail/);
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts['check:character-lab'], /test-character-lab\.mjs/);
  assert.match(packageJson.scripts['check:character-lab'], /test-cartoon-glove\.mjs/);
  assert.match(packageJson.scripts['check:character-lab'], /test-stretchable-bone\.mjs/);
  assert.match(packageJson.scripts.build, /npm run check:character-lab/);
  assert.doesNotMatch(packageJson.scripts.build, /check:character-evaluation/);

  console.log(
    `PASS Character Lab settings, reversible proportion layer, persistence, extremes, UI wiring, and comparison-asset removal`,
  );
} finally {
  await server.close();
}
