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
  const headPresentation = add('head-presentation', head);
  visual('head-volume', headPresentation);

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
    visual(`glove-stitch-a-${side}`, handRest, [0, -0.083, 0.068]);
    visual(`glove-stitch-b-${side}`, handRest, [0, -0.083, 0.068]);
    const hip = add(`hip-${side}`, hips, [sign * 0.115, 0, 0]);
    visual(`thigh-${side}`, hip, [0, -0.12, 0]);
    const knee = add(`knee-${side}`, hip, [0, -0.28, 0]);
    visual(`shin-${side}`, knee, [0, -0.11, 0]);
    const ankle = add(`ankle-${side}`, knee, [0, -0.25, 0]);
    visual(`foot-${side}`, ankle, [0, -0.04, 0.08]);
    visual(`sock-${side}`, knee, [0, -0.205, 0]);
    visual(`sock-cuff-${side}`, knee, [0, -0.177, 0]);
    add(`ear-${side}`, headPresentation, [sign * 0.1, 0.13, 0]);
    for (const part of ['white', 'iris', 'pupil', 'lash']) {
      visual(`eye-${part}-${side}`, headPresentation, [sign * 0.07, 0.03, 0.15]);
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
  headPresentation.add(ponytail);
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
  const collisionApi = await server.ssrLoadModule('/src/character/collisionDimensions.ts');
  const {
    CHARACTER_PROPORTION_CONTROLS,
    CHARACTER_PROPORTION_DEFAULTS_REVISION,
    CHARACTER_PROPORTION_STORAGE_KEY,
    CHARACTER_HAND_REST_REVISION,
    CharacterProportionSettings,
    DEFAULT_CHARACTER_PROPORTIONS,
    IDENTITY_CHARACTER_PROPORTIONS,
    clampCharacterProportions,
  } = settingsApi;
  const {
    BASE_CHARACTER_HITBOX_HEIGHT,
    characterCollisionHeight,
  } = collisionApi;

  assert.equal(CHARACTER_PROPORTION_CONTROLS.length, 35);
  assert.deepEqual(
    new Set(CHARACTER_PROPORTION_CONTROLS.map((control) => control.key)),
    new Set(Object.keys(DEFAULT_CHARACTER_PROPORTIONS)),
    'every persisted proportion has exactly one Character Lab slider',
  );
  assert.deepEqual(clampCharacterProportions({}), DEFAULT_CHARACTER_PROPORTIONS);
  assert.deepEqual(DEFAULT_CHARACTER_PROPORTIONS, {
    overallScale: 1,
    height: 1,
    bodyWidth: 1,
    bodyDepth: 1,
    headSize: 1.64,
    headWidth: 1.18,
    headDepth: 1.3,
    neckLength: 0.01,
    headForwardOffset: -0.105,
    headRestPitch: 0,
    torsoLength: 1,
    torsoWidth: 1.13,
    torsoDepth: 1.22,
    shoulderWidth: 0.76,
    upperArmRestAngle: -19,
    hipWidth: 0.93,
    upperArmLength: 1.01,
    forearmLength: 1.25,
    thighLength: 1.34,
    shinLength: 1.47,
    shortsWidth: 1.5,
    shortsHeight: 1.5,
    shortsDepth: 1.39,
    armThickness: 1.5,
    legThickness: 1.37,
    armKnobSize: 1.47,
    legKnobSize: 1.37,
    handSize: 1.36,
    wristRestPitch: 15,
    wristRestYaw: -167,
    wristRestRoll: 3,
    gloveXAcross: 0.025,
    gloveXAlong: 0.011,
    gloveXLift: -0.004,
    footSize: 1.53,
  });
  near(
    characterCollisionHeight({ ...DEFAULT_CHARACTER_PROPORTIONS, headSize: 1.55, neckLength: 0 }, 'skull'),
    BASE_CHARACTER_HITBOX_HEIGHT,
  );
  assert.ok(
    characterCollisionHeight({
      ...DEFAULT_CHARACTER_PROPORTIONS,
      thighLength: DEFAULT_CHARACTER_PROPORTIONS.thighLength + 0.2,
    }, 'skull') > BASE_CHARACTER_HITBOX_HEIGHT,
    'longer legs did not grow the gameplay hitbox',
  );
  assert.ok(
    characterCollisionHeight({
      ...DEFAULT_CHARACTER_PROPORTIONS,
      headSize: DEFAULT_CHARACTER_PROPORTIONS.headSize + 0.5,
    }, 'skull') > BASE_CHARACTER_HITBOX_HEIGHT,
    'larger head did not grow the gameplay hitbox',
  );
  assert.ok(
    characterCollisionHeight(DEFAULT_CHARACTER_PROPORTIONS, 'roo') <
      characterCollisionHeight(DEFAULT_CHARACTER_PROPORTIONS, 'skull'),
    'the shorter BoolieRoo rest mesh did not produce a shorter hitbox',
  );
  const clamped = clampCharacterProportions({
    headSize: 99,
    headWidth: 99,
    headDepth: 99,
    neckLength: -4,
    headForwardOffset: 99,
    headRestPitch: 99,
    upperArmRestAngle: 99,
    wristRestPitch: NaN,
    wristRestYaw: 999,
    armKnobSize: 99,
    legKnobSize: -2,
    shortsWidth: 99,
    shortsHeight: -2,
    gloveXAcross: 99,
    gloveXAlong: -99,
    gloveXLift: 99,
  });
  assert.equal(clamped.headSize, 4);
  assert.equal(clamped.headWidth, 3);
  assert.equal(clamped.headDepth, 3);
  assert.equal(clamped.neckLength, -4);
  assert.equal(clamped.headForwardOffset, 0.5);
  assert.equal(clamped.headRestPitch, 60);
  assert.equal(clamped.upperArmRestAngle, 75);
  assert.equal(clamped.wristRestPitch, 15);
  assert.equal(clamped.wristRestYaw, 180);
  assert.equal(clamped.armKnobSize, 1.62);
  assert.equal(clamped.legKnobSize, 1);
  assert.equal(clamped.shortsWidth, 1.5);
  assert.equal(clamped.shortsHeight, 0.65);
  assert.equal(clamped.gloveXAcross, 0.05);
  assert.equal(clamped.gloveXAlong, -0.05);
  assert.equal(clamped.gloveXLift, 0.025);

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
  assert.equal(settings.value.footSize, 1.53);
  assert.equal(settings.value.gloveXAcross, 0.025);
  assert.equal(settings.value.gloveXAlong, 0.011);
  assert.equal(settings.value.gloveXLift, -0.004);
  assert.equal(settings.value.headForwardOffset, DEFAULT_CHARACTER_PROPORTIONS.headForwardOffset);
  assert.equal(settings.value.headRestPitch, 0);
  assert.equal(settings.value.upperArmRestAngle, DEFAULT_CHARACTER_PROPORTIONS.upperArmRestAngle);
  assert.equal(settings.value.armKnobSize, 1.47,
    'untouched legacy values must adopt the authored defaults');
  assert.equal(settings.value.shortsWidth, 1.5,
    'older saved Character Lab values must gain clothing controls');
  assert.equal(settings.value.wristRestPitch, 15,
    'pre-release wrist tuning must migrate to the corrected anatomical base');
  assert.equal(settings.value.wristRestYaw, -167);
  assert.equal(settings.value.wristRestRoll, 3);
  let notifications = 0;
  settings.subscribe(() => notifications++);
  settings.patch({ handSize: 1.28 });
  assert.equal(notifications, 1);
  const persisted = JSON.parse(stored.values.get(CHARACTER_PROPORTION_STORAGE_KEY));
  assert.equal(persisted.version, 1);
  assert.equal(persisted.handRestRevision, CHARACTER_HAND_REST_REVISION);
  assert.equal(persisted.defaultsRevision, CHARACTER_PROPORTION_DEFAULTS_REVISION);
  assert.deepEqual(persisted.defaults, DEFAULT_CHARACTER_PROPORTIONS);
  assert.equal(persisted.settings.handSize, 1.28);
  const roundTrip = new CharacterProportionSettings(memoryStorage());
  roundTrip.importJson(settings.serialize(false));
  assert.deepEqual(roundTrip.value, settings.value);
  roundTrip.reset();
  assert.deepEqual(roundTrip.value, DEFAULT_CHARACTER_PROPORTIONS);

  const revision3Defaults = {
    ...IDENTITY_CHARACTER_PROPORTIONS,
    bodyWidth: 0.96,
    bodyDepth: 0.96,
    headSize: 1.4,
    headWidth: 1.23,
    headDepth: 1.23,
    neckLength: 0,
    headForwardOffset: 0,
    headRestPitch: 0,
    torsoLength: 0.95,
    torsoWidth: 1.21,
    torsoDepth: 1.04,
    shoulderWidth: 1.05,
    upperArmRestAngle: 0,
    hipWidth: 1.17,
    upperArmLength: 0.95,
    forearmLength: 1.38,
    thighLength: 1.34,
    shinLength: 1.47,
    armThickness: 1.5,
    legThickness: 1.37,
    armKnobSize: 1.43,
    legKnobSize: 1.33,
    handSize: 1.36,
    wristRestPitch: 13,
    wristRestYaw: -180,
    wristRestRoll: 6,
    gloveXAcross: 0,
    gloveXAlong: 0,
    gloveXLift: 0,
    footSize: 1.53,
  };
  const migratedRevision3 = new CharacterProportionSettings(memoryStorage({
    [CHARACTER_PROPORTION_STORAGE_KEY]: JSON.stringify({
      version: 1,
      handRestRevision: CHARACTER_HAND_REST_REVISION,
      defaultsRevision: 3,
      defaults: revision3Defaults,
      settings: { ...revision3Defaults, handSize: 1.28 },
    }),
  }));
  assert.equal(migratedRevision3.value.headSize, 1.64,
    'untouched revision-3 defaults migrate to the new authored silhouette');
  assert.equal(migratedRevision3.value.shortsWidth, 1.5);
  assert.equal(migratedRevision3.value.wristRestYaw, -167);
  assert.equal(migratedRevision3.value.gloveXAcross, 0.025);
  assert.equal(migratedRevision3.value.handSize, 1.28,
    'deliberate revision-3 edits remain user-owned during migration');

  const explicitAuthoredImport = new CharacterProportionSettings(memoryStorage());
  const { shortsWidth: _shortsWidth, shortsHeight: _shortsHeight, shortsDepth: _shortsDepth,
    ...authoredWithoutShorts } = DEFAULT_CHARACTER_PROPORTIONS;
  explicitAuthoredImport.importJson(JSON.stringify({
    version: 1,
    handRestRevision: CHARACTER_HAND_REST_REVISION,
    settings: authoredWithoutShorts,
  }));
  assert.deepEqual(explicitAuthoredImport.value, DEFAULT_CHARACTER_PROPORTIONS,
    'explicit authored payloads may omit neutral shorts controls');

  const scene = fixture();
  const baseline = snapshot(scene.root);
  const layer = new CharacterProportionLayer(scene.root);
  layer.apply(IDENTITY_CHARACTER_PROPORTIONS);
  assert.deepEqual(snapshot(scene.root), baseline, 'identity proportions are transform-identical');
  layer.clear();
  assert.deepEqual(snapshot(scene.root), baseline, 'clearing the identity layer is exact');
  layer.apply(DEFAULT_CHARACTER_PROPORTIONS);
  const authoredDefault = snapshot(scene.root);
  assert.notDeepEqual(authoredDefault, baseline, 'authored defaults must change the neutral rig');
  for (let iteration = 0; iteration < 100; iteration++) {
    layer.apply(DEFAULT_CHARACTER_PROPORTIONS);
  }
  assert.deepEqual(snapshot(scene.root), authoredDefault,
    '100 authored-default passes do not accumulate');
  layer.clear();
  assert.deepEqual(snapshot(scene.root), baseline, 'clearing the authored default layer is exact');

  const shaped = {
    ...DEFAULT_CHARACTER_PROPORTIONS,
    overallScale: 1.1,
    height: 1.2,
    bodyWidth: 0.9,
    bodyDepth: 1.15,
    headSize: 1.35,
    headWidth: 1.2,
    headDepth: 0.85,
    neckLength: 0.6,
    headForwardOffset: 0.22,
    headRestPitch: -24,
    torsoLength: 1.18,
    torsoWidth: 1.4,
    torsoDepth: 0.7,
    shoulderWidth: 1.25,
    upperArmRestAngle: 30,
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
    gloveXAcross: 0.02,
    gloveXAlong: -0.03,
    gloveXLift: 0.01,
    footSize: 1.18,
  };
  layer.apply(shaped);
  near(scene.rider.scale.x, 1.1 * 0.9);
  near(scene.rider.scale.y, 1.1 * 1.2);
  near(scene.rider.scale.z, 1.1 * 1.15);
  const headPresentation = scene.nodes.get('head-presentation');
  assert.deepEqual(scene.nodes.get('head').scale.toArray(), [1, 1, 1]);
  near(headPresentation.scale.x, 1.35 * 1.2);
  near(headPresentation.scale.y, 1.35);
  near(headPresentation.scale.z, 1.35 * 0.85);
  near(scene.nodes.get('neck').position.y, 0.25 * 1.18,
    1e-9);
  near(scene.nodes.get('head').position.y, 0.095);
  near(scene.nodes.get('head').position.z, 0);
  near(headPresentation.position.y, 0.095 * (0.6 - 1));
  near(headPresentation.position.z, 0.22);
  const expectedHeadPitch = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(-24), 0, 0),
  );
  near(Math.abs(headPresentation.quaternion.dot(expectedHeadPitch)), 1);
  assert.deepEqual(scene.nodes.get('neck-volume').scale.toArray(), [1, 1.18, 1],
    'torso length may stretch its marker, but neck height must not');
  near(scene.nodes.get('clavicle-left').position.x, 0.1 * 1.25);
  near(scene.nodes.get('clavicle-right').position.x, -0.1 * 1.25);
  near(scene.nodes.get('shoulder-left').rotation.z, THREE.MathUtils.degToRad(-30));
  near(scene.nodes.get('shoulder-right').rotation.z, THREE.MathUtils.degToRad(30));
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
  assert.deepEqual(scene.nodes.get('sock-left').scale.toArray(), [0.82, 0.8, 0.82]);
  assert.deepEqual(scene.nodes.get('sock-right').scale.toArray(), [0.82, 0.8, 0.82]);
  assert.deepEqual(scene.nodes.get('sock-cuff-left').scale.toArray(), [0.82, 0.8, 0.82]);
  assert.deepEqual(scene.nodes.get('sock-cuff-right').scale.toArray(), [0.82, 0.8, 0.82]);
  near(scene.nodes.get('knee-left').position.y, -0.28 * 1.3);
  near(scene.nodes.get('ankle-left').position.y, -0.25 * 0.8);
  assert.deepEqual(scene.nodes.get('ankle-left').scale.toArray(), [1.18, 1.18, 1.18]);
  assert.deepEqual(scene.nodes.get('ankle-right').scale.toArray(), [1.18, 1.18, 1.18]);
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
  for (const bar of ['a', 'b']) {
    const leftMark = scene.nodes.get(`glove-stitch-${bar}-left`).position;
    const rightMark = scene.nodes.get(`glove-stitch-${bar}-right`).position;
    near(leftMark.x, 0.02);
    near(rightMark.x, -0.02);
    near(leftMark.y, -0.113);
    near(rightMark.y, -0.113);
    near(leftMark.z, 0.078);
    near(rightMark.z, 0.078);
  }
  const once = snapshot(scene.root);
  for (let iteration = 0; iteration < 100; iteration++) layer.apply(shaped);
  assert.deepEqual(snapshot(scene.root), once, '100 proportion passes do not accumulate');
  scene.nodes.get('head').quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
  layer.apply(shaped);
  near(scene.nodes.get('head').rotation.y, 0.7, 1e-6);
  const resolvedHeadOffset = headPresentation.position.clone()
    .multiply(scene.nodes.get('head').scale)
    .applyQuaternion(scene.nodes.get('head').quaternion);
  near(resolvedHeadOffset.x, 0);
  near(resolvedHeadOffset.y, 0.095 * (0.6 - 1));
  near(resolvedHeadOffset.z, 0.22);
  near(Math.abs(headPresentation.quaternion.dot(expectedHeadPitch)), 1);
  layer.clear();
  const cleared = snapshot(scene.root);
  for (const [name, value] of baseline) {
    assert.deepEqual(cleared.get(name).position, value.position, `${name} position did not restore`);
    assert.deepEqual(cleared.get(name).scale, value.scale, `${name} scale did not restore`);
    if (
      name === 'head-presentation' ||
      name.startsWith('hand-rest-orientation-') ||
      name.startsWith('shoulder-')
    ) {
      assert.deepEqual(cleared.get(name).quaternion, value.quaternion, `${name} quaternion did not restore`);
    }
  }
  near(scene.nodes.get('head').rotation.y, 0.7, 1e-6);

  const authoredShoulderLeft = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.2, -0.1, 0.35),
  );
  const authoredShoulderRight = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-0.15, 0.08, -0.28),
  );
  scene.nodes.get('shoulder-left').quaternion.copy(authoredShoulderLeft);
  scene.nodes.get('shoulder-right').quaternion.copy(authoredShoulderRight);
  layer.apply(
    { ...IDENTITY_CHARACTER_PROPORTIONS, upperArmRestAngle: 75 },
    { upperArmRestAngleWeight: 0 },
  );
  near(Math.abs(scene.nodes.get('shoulder-left').quaternion.dot(authoredShoulderLeft)), 1);
  near(Math.abs(scene.nodes.get('shoulder-right').quaternion.dot(authoredShoulderRight)), 1);
  layer.clear();
  near(Math.abs(scene.nodes.get('shoulder-left').quaternion.dot(authoredShoulderLeft)), 1);
  near(Math.abs(scene.nodes.get('shoulder-right').quaternion.dot(authoredShoulderRight)), 1);
  scene.nodes.get('shoulder-left').quaternion.identity();
  scene.nodes.get('shoulder-right').quaternion.identity();

  // Persistent anatomy multiplies an already-authored temporary deformation:
  // 0.8 animation squash × 1.2 Character Lab length = 0.96 final reach.
  const dynamicKnee = scene.nodes.get('knee-left');
  const dynamicThigh = scene.nodes.get('thigh-left');
  dynamicKnee.position.y = -0.28 * 0.8;
  dynamicThigh.scale.y = 0.8;
  layer.apply({ ...IDENTITY_CHARACTER_PROPORTIONS, thighLength: 1.2 });
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
  assert.match(mainSource,
    /syncPresentation:[\s\S]{0,180}setCharacterUpperArmRestAngleWeight\([\s\S]{0,180}clip\?\.id === 'player\.idle'[\s\S]{0,120}\? 1 : 0/,
    'Animation Studio did not keep the resting arm angle off authored Run');
  assert.match(mainSource,
    /p2CharacterAnimationRuntime = createCharacterAnimationRuntime\([\s\S]{0,120}p2,[\s\S]{0,120}playerAnimationDocument/,
    'P2 must use the same animation runtime so its Run pose also excludes the idle arm angle');
  assert.match(mainSource, /location\.hash\.toLowerCase\(\)\.includes\("characterlab"\)/);
  assert.match(labSource, /CHARACTER LAB/);
  assert.match(labSource, /stature drives gameplay hitbox height/);
  assert.match(playerSource, /characterCollisionHeight\(/,
    'Player does not derive hitbox height from Character Lab settings');
  assert.match(playerSource, /spinBox\.min\.y \+ BASE_CHARACTER_HITBOX_HEIGHT/,
    'tall character hitboxes can expand a spin through multiple crate rows');
  assert.match(labSource, /Show animal tail/);
  assert.match(labSource, /toFixed\(inputs\.decimals\)/,
    'Character Lab number fields must preserve each control step precision');
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
