import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const noop = () => {};

function installHeadlessDom() {
  const storage = new Map();
  const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
  const makeElement = (tag = 'div') => ({
    tagName: String(tag).toUpperCase(), style: {}, classList, children: [],
    addEventListener: noop, removeEventListener: noop, setAttribute: noop,
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    remove: noop,
  });
  globalThis.localStorage = {
    get length() { return storage.size; },
    clear() { storage.clear(); },
    getItem(key) { return storage.get(String(key)) ?? null; },
    key(index) { return [...storage.keys()][index] ?? null; },
    removeItem(key) { storage.delete(String(key)); },
    setItem(key, value) { storage.set(String(key), String(value)); },
  };
  const context = new Proxy({
    canvas: null,
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: (_x, _y, width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    measureText: (text) => ({ width: String(text).length * 8 }),
  }, { get: (target, key) => key in target ? target[key] : noop });
  const makeCanvas = () => ({
    ...makeElement('canvas'), width: 1, height: 1,
    getContext() { context.canvas = this; return context; },
  });
  globalThis.document = {
    body: makeElement('body'), fonts: null,
    createElement(tag) { return tag === 'canvas' ? makeCanvas() : makeElement(tag); },
    createElementNS(_namespace, tag) { return this.createElement(tag); },
  };
  globalThis.window = {
    location: { search: '?lite', href: 'http://headless.invalid/?lite' },
    addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1,
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  globalThis.Image = class HeadlessImage {
    addEventListener(type, callback) { if (type === 'error') queueMicrotask(callback); }
    removeEventListener() {}
    set src(_value) { queueMicrotask(() => this.onerror?.(new Error('headless image'))); }
  };
  const NativeRequest = globalThis.Request;
  globalThis.Request = class HeadlessRequest extends NativeRequest {
    constructor(input, init) {
      super(typeof input === 'string' && input.startsWith('/')
        ? `http://headless.invalid${input}` : input, init);
    }
  };
  globalThis.fetch = async () => new Response('', { status: 404 });
}

installHeadlessDom();
const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) =>
  /mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!expectedAssetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!expectedAssetLog(args[0])) originalError(...args); };

const finiteObject = (object) => [
  ...object.position.toArray(),
  ...object.quaternion.toArray(),
  ...object.scale.toArray(),
].every(Number.isFinite);

const near = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`);
};

const ancestorOf = (ancestor, child) => {
  for (let node = child.parent; node; node = node.parent) if (node === ancestor) return true;
  return false;
};

try {
  const api = await server.ssrLoadModule('/src/character/cartoonGlove.ts');
  const {
    CARTOON_GLOVE_POSES,
    blendCartoonGlovePose,
    createCartoonGlove,
    setCartoonGlovePose,
  } = api;

  const gloveMaterial = new THREE.MeshBasicMaterial({ color: 0xeee8dc });
  const stitchMaterial = new THREE.MeshBasicMaterial({ color: 0x1b1a19 });
  const left = createCartoonGlove('left', { glove: gloveMaterial, stitch: stitchMaterial });
  const right = createCartoonGlove('right', { glove: gloveMaterial, stitch: stitchMaterial });

  for (const rig of [left, right]) {
    assert.equal(Object.keys(rig.fingers).length, 3);
    assert.deepEqual(Object.keys(rig.fingers), ['index', 'middle', 'outer']);
    assert.equal(rig.bones.length, 12, '3×3 fingers + thumb metacarpal/proximal/distal');
    assert.equal(Object.keys(rig.joints).length, 12);
    assert.equal(new Set(rig.bones).size, 12);
    assert.equal(new Set(rig.bones.map((bone) => bone.name)).size, 12);
    assert.equal(rig.gripSocket.name, `socket-grip-${rig.side}`);
    assert.deepEqual(rig.gripSocket.position.toArray(), [0, -0.14, 0.045]);
    assert.equal(rig.gripSocket.parent, rig.root);
    assert.equal(rig.root.userData.sculptRuntime, undefined,
      'nested glove metadata must not masquerade as a complete sculpt runtime');
    assert.equal(rig.root.userData.cartoonGloveRig.digitCount, 3);
    for (const digit of ['index', 'middle', 'outer']) {
      const chain = rig.fingers[digit];
      assert.equal(chain.middle.parent, chain.proximal);
      assert.equal(chain.distal.parent, chain.middle);
      assert.equal(chain.tipSocket.parent, chain.distal);
      assert.ok(ancestorOf(rig.root, chain.distal));
      assert.equal(chain.tipSocket.name, `socket-finger-${digit}-${rig.side}`);
    }
    assert.equal(rig.thumb.metacarpal.parent, rig.root);
    assert.equal(rig.thumb.proximal.parent, rig.thumb.metacarpal);
    assert.equal(rig.thumb.distal.parent, rig.thumb.proximal);
    assert.equal(rig.thumb.tipSocket.parent, rig.thumb.distal);
    for (const bone of rig.bones) {
      assert.ok(finiteObject(bone), `${bone.name} has a non-finite bind transform`);
      assert.deepEqual(bone.scale.toArray(), [1, 1, 1]);
      if (bone !== rig.thumb.metacarpal) {
        near(bone.quaternion.x, 0);
        near(bone.quaternion.y, 0);
        near(bone.quaternion.z, 0);
        near(bone.quaternion.w, 1);
      }
    }
  }

  assert.ok(left.bones.every((bone) => !right.bones.includes(bone)),
    'left/right gloves share mutable bones');
  const handMetrics = [left, right].map((rig) => {
    let meshes = 0;
    let triangles = 0;
    const geometries = new Set();
    rig.root.traverse((object) => {
      if (!object.isMesh) return;
      meshes++;
      geometries.add(object.geometry);
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    return { meshes, triangles, geometries };
  });
  assert.deepEqual(handMetrics.map(({ meshes, triangles }) => ({ meshes, triangles })), [
    { meshes: 21, triangles: 3754 },
    { meshes: 21, triangles: 3754 },
  ]);
  assert.ok([...handMetrics[0].geometries].every((geometry) => handMetrics[1].geometries.has(geometry)),
    'mirrored hands do not share immutable geometry');
  near(left.fingers.index.proximal.position.x, -right.fingers.index.proximal.position.x);
  near(left.fingers.outer.proximal.position.x, -right.fingers.outer.proximal.position.x);
  near(left.thumb.metacarpal.position.x, -right.thumb.metacarpal.position.x);
  near(left.thumb.metacarpal.rotation.z, -right.thumb.metacarpal.rotation.z);

  const poseNames = ['open', 'relaxed', 'curl', 'fist', 'pinch', 'grab'];
  assert.deepEqual(Object.keys(CARTOON_GLOVE_POSES), poseNames);
  for (const name of poseNames) {
    for (const rig of [left, right]) {
      setCartoonGlovePose(rig, CARTOON_GLOVE_POSES[name]);
      rig.root.updateMatrixWorld(true);
      rig.root.traverse((object) => {
        assert.ok(finiteObject(object), `${name} made ${object.name} non-finite`);
      });
      for (const bone of rig.bones) {
        const limit = bone.userData.rotationLimit;
        for (const axis of ['x', 'y', 'z']) {
          assert.ok(
            bone.rotation[axis] >= limit[axis][0] - 1e-8 &&
              bone.rotation[axis] <= limit[axis][1] + 1e-8,
            `${name} drives ${bone.name}.${axis} outside its published rotation limit`,
          );
        }
      }
    }
  }

  setCartoonGlovePose(left, CARTOON_GLOVE_POSES.fist);
  const once = left.bones.map((bone) => bone.quaternion.toArray());
  for (let iteration = 0; iteration < 100; iteration++) {
    setCartoonGlovePose(left, CARTOON_GLOVE_POSES.fist);
  }
  assert.deepEqual(left.bones.map((bone) => bone.quaternion.toArray()), once,
    'absolute glove poses accumulate');

  const blended = blendCartoonGlovePose(
    CARTOON_GLOVE_POSES.open,
    CARTOON_GLOVE_POSES.fist,
    0.5,
  );
  near(blended.indexCurl, 0.5);
  near(blended.thumbCurl, 0.46);
  setCartoonGlovePose(left, blended);
  assert.ok(left.fingers.index.middle.rotation.x > 0);
  assert.ok(left.thumb.proximal.rotation.x > 0);

  setCartoonGlovePose(left, CARTOON_GLOVE_POSES.open);
  left.root.updateMatrixWorld(true);
  const openIndex = left.fingers.index.tipSocket.getWorldPosition(new THREE.Vector3());
  const openThumb = left.thumb.tipSocket.getWorldPosition(new THREE.Vector3());
  setCartoonGlovePose(left, CARTOON_GLOVE_POSES.pinch);
  left.root.updateMatrixWorld(true);
  const pinchIndex = left.fingers.index.tipSocket.getWorldPosition(new THREE.Vector3());
  const pinchThumb = left.thumb.tipSocket.getWorldPosition(new THREE.Vector3());
  assert.ok(pinchIndex.distanceTo(pinchThumb) < openIndex.distanceTo(openThumb),
    'pinch pose does not bring thumb and index together');

  const [playerSource, labSource, specSource, packageSource] = await Promise.all([
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'docs/CARTOON_GLOVE_SCULPT_SPEC.json'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
  ]);
  assert.match(playerSource, /createCartoonGlove\(anatomicalSide/);
  assert.match(playerSource, /this\.gloveLeft = glove;/);
  assert.match(playerSource, /this\.gloveRight = glove;/);
  assert.match(playerSource, /boneCountPerHand: 12/);
  assert.match(playerSource, /fingerIndexTip\$\{glove\.side/);
  assert.match(playerSource, /setCartoonGlovePose\(this\.gloveLeft, glovePose\)/);
  assert.match(playerSource, /setCartoonGlovePreviewPose\(name: CartoonGlovePoseName\)/);
  assert.doesNotMatch(playerSource, /const handGeo =/);
  assert.match(labSource, /\['open', 'relaxed', 'curl', 'fist', 'pinch', 'grab'\]/);
  assert.match(labSource, /\['Front', 'front'\][\s\S]*\['Hands', 'hands'\]/);
  assert.match(labSource, /\['Hand front', 'hands-front'\][\s\S]*\['Hand rear', 'hands-rear'\]/);
  const spec = JSON.parse(specSource);
  assert.equal(spec.rig.jointCountPerHand, 12);
  assert.deepEqual(spec.rig.requiredPoses, poseNames);
  assert.ok(spec.rig.fingerChains.every((chain) => chain.curlAxis[0] === 1));
  const requiredPositiveCurl = {
    fingerIndexProximal: 0.92,
    fingerIndexMiddle: 1.28,
    fingerIndexDistal: 1.08,
    fingerMiddleProximal: 0.96,
    fingerMiddleMiddle: 1.34,
    fingerMiddleDistal: 1.12,
    fingerOuterProximal: 0.9,
    fingerOuterMiddle: 1.26,
    fingerOuterDistal: 1.08,
    thumbProximal: 0.82,
    thumbDistal: 1.08,
  };
  const componentJoints = spec.componentTree.flatMap((component) => component.joints ?? []);
  for (const [jointId, requiredMaximum] of Object.entries(requiredPositiveCurl)) {
    const joint = componentJoints.find((candidate) => candidate.id === jointId);
    assert.ok(joint, `sculpt spec is missing ${jointId}`);
    if (joint.axis) assert.equal(joint.axis[0], 1, `${jointId} publishes the wrong curl axis`);
    const limits = joint.limitsRadians ?? joint.curlLimitsRadians;
    assert.ok(limits[0] <= 0 && limits[1] >= requiredMaximum,
      `${jointId} limits do not contain the shipped pose range`);
  }
  assert.equal(spec.preSpecAssessment.detailInventory.details.length, 6);
  assert.ok(handMetrics.reduce((total, hand) => total + hand.triangles, 0) <=
    spec.performanceBudget.targetTriangles);
  assert.ok(handMetrics.reduce((total, hand) => total + hand.meshes, 0) <=
    spec.performanceBudget.maxDrawCalls);
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts['check:character-lab'], /test-cartoon-glove\.mjs/);

  const [{ Player }, { RigBinding }] = await Promise.all([
    server.ssrLoadModule('/src/player.ts'),
    server.ssrLoadModule('/src/animation/index.ts'),
  ]);
  const player = new Player(new THREE.Scene());
  assert.deepEqual(player.cartoonGloveDiagnostics, {
    ready: true,
    bonesPerHand: 12,
    digitCountPerHand: 3,
    gripSockets: ['socket-grip-left', 'socket-grip-right'],
  });
  assert.equal(player.stretchableBoneDiagnostics.ready, true);
  assert.equal(player.stretchableBoneDiagnostics.componentCount, 8);
  assert.equal(player.stretchableBoneDiagnostics.triangles, 13096);
  assert.deepEqual(player.stretchableBoneDiagnostics.surfaces, {
    'ivory-rattle': 6,
    'ivory-bone': 2,
  });
  assert.equal(player.stretchableBones.every((component) =>
    component.shaft.material.flatShading === true), true,
  'production bone materials must derive normals from the deformed faces');
  const productionBones = new Map(player.stretchableBones.map((component) => [component.id, component]));
  const expectedSurfaces = {
    'upper-arm-left': 'ivory-bone',
    'upper-arm-right': 'ivory-bone',
    'lower-arm-left': 'ivory-rattle',
    'lower-arm-right': 'ivory-rattle',
    'upper-leg-left': 'ivory-rattle',
    'upper-leg-right': 'ivory-rattle',
    'lower-leg-left': 'ivory-rattle',
    'lower-leg-right': 'ivory-rattle',
  };
  for (const [id, surface] of Object.entries(expectedSurfaces)) {
    const component = productionBones.get(id);
    assert.ok(component, `missing production limb surface ${id}`);
    assert.equal(component.root.userData.stretchableBoneRuntime.surface, surface);
    assert.equal(component.root.scale.x, id.endsWith('-right') ? -1 : 1);
    if (surface === 'ivory-rattle') {
      assert.equal(component.root.userData.stretchableBoneRuntime.distalKind, 'insertion-tip');
    }
  }
  for (const ids of [
    ['upper-arm-left', 'upper-arm-right'],
    [
      'lower-arm-left', 'lower-arm-right',
      'upper-leg-left', 'upper-leg-right',
      'lower-leg-left', 'lower-leg-right',
    ],
  ]) {
    const first = productionBones.get(ids[0]);
    for (const id of ids.slice(1)) {
      const component = productionBones.get(id);
      assert.equal(component.shaft.geometry, first.shaft.geometry);
      assert.equal(component.proximalKnob.geometry, first.proximalKnob.geometry);
      assert.equal(component.distalKnob.geometry, first.distalKnob.geometry);
    }
  }
  const upperArmKnobs = productionBones.get('upper-arm-left');
  const forearmKnobs = productionBones.get('lower-arm-left');
  const thighKnobs = productionBones.get('upper-leg-left');
  const upperArmProximalBase = upperArmKnobs.proximalKnob.scale.clone();
  const upperArmDistalBase = upperArmKnobs.distalKnob.scale.clone();
  const upperArmDistalPositionBase = upperArmKnobs.distalKnob.position.clone();
  const upperArmSocketBase = upperArmKnobs.distalSocket.position.clone();
  const forearmProximalBase = forearmKnobs.proximalKnob.scale.clone();
  const forearmInsertionBase = forearmKnobs.distalKnob.scale.clone();
  const forearmInsertionPositionBase = forearmKnobs.distalKnob.position.clone();
  const thighProximalBase = thighKnobs.proximalKnob.scale.clone();
  const thighInsertionBase = thighKnobs.distalKnob.scale.clone();
  const thighInsertionPositionBase = thighKnobs.distalKnob.position.clone();
  const defaultArmKnobSize = player.characterProportions.armKnobSize;
  const defaultLegKnobSize = player.characterProportions.legKnobSize;
  player.setCharacterProportions({ armKnobSize: 1.4, legKnobSize: 1.5 });
  for (const [knob, base, factor] of [
    [upperArmKnobs.proximalKnob, upperArmProximalBase, 1.4 / defaultArmKnobSize],
    [upperArmKnobs.distalKnob, upperArmDistalBase, 1.4 / defaultArmKnobSize],
    [forearmKnobs.proximalKnob, forearmProximalBase, 1.4 / defaultArmKnobSize],
    [thighKnobs.proximalKnob, thighProximalBase, 1.5 / defaultLegKnobSize],
  ]) {
    near(knob.scale.x, base.x * factor);
    near(knob.scale.y, base.y * factor);
    near(knob.scale.z, base.z * factor);
  }
  near(upperArmKnobs.distalKnob.position.y,
    upperArmDistalPositionBase.y + upperArmKnobs.baseLength *
      (1 - upperArmKnobs.root.userData.stretchableBoneRuntime.stretchEnd) *
      (1.4 - defaultArmKnobSize));
  assert.deepEqual(upperArmKnobs.distalSocket.position.toArray(), upperArmSocketBase.toArray(),
    'knob sizing must not move the semantic elbow socket');
  assert.deepEqual(forearmKnobs.distalKnob.scale.toArray(), forearmInsertionBase.toArray(),
    'forearm insertion tip must remain fitted to the glove');
  assert.deepEqual(forearmKnobs.distalKnob.position.toArray(), forearmInsertionPositionBase.toArray());
  assert.deepEqual(thighKnobs.distalKnob.scale.toArray(), thighInsertionBase.toArray(),
    'leg insertion tip must remain fitted to the following joint/sock');
  assert.deepEqual(thighKnobs.distalKnob.position.toArray(), thighInsertionPositionBase.toArray());
  player.resetCharacterProportions();
  assert.deepEqual(upperArmKnobs.proximalKnob.scale.toArray(), upperArmProximalBase.toArray());
  assert.deepEqual(upperArmKnobs.distalKnob.scale.toArray(), upperArmDistalBase.toArray());
  assert.deepEqual(upperArmKnobs.distalKnob.position.toArray(), upperArmDistalPositionBase.toArray());
  near(player.stretchableBoneDiagnostics.minScale, 0.319);
  near(player.stretchableBoneDiagnostics.maxScale, 2.765);
  assert.deepEqual(player.meshyTorsoDiagnostics, {
    ready: true,
    triangles: 10889,
    sourceSha256: 'eb856706da34e7ffb2042599698c56aeda4db7783ed46c4775bad39cf4b10576',
    skinBones: [
      'torso-root', 'spine', 'chest', 'neck', 'clavicle-left', 'clavicle-right',
    ],
    textureState: 'loading',
    texturesLoaded: 0,
    textureError: null,
  });
  const torsoSurface = player.animationRig.root.getObjectByName('meshy-torso-surface');
  assert.equal(torsoSurface.isSkinnedMesh, true);
  assert.equal(torsoSurface.parent.name, 'procedural-rider');
  assert.equal(torsoSurface.geometry.getAttribute('skinWeight').count, 32667);
  assert.deepEqual(player.meshyHeadDiagnostics, {
    ready: true,
    triangles: 16536,
    sourceSha256: '7ce05ff91c0b33ff3845c0e5a24610eeb51d3851abf25167e22910ed93f0b234',
    textureState: 'loading',
    texturesLoaded: 0,
    textureError: null,
  });
  const headSurface = player.animationRig.root.getObjectByName('meshy-head-surface');
  const headBone = player.animationRig.root.getObjectByName('head');
  const neckBone = player.animationRig.root.getObjectByName('neck');
  const lookSocket = player.animationRig.root.getObjectByName('socket-look');
  const headCenter = player.animationRig.root.getObjectByName('socket-head-visual-center');
  assert.equal(headSurface.parent, headBone);
  near(lookSocket.position.y, 0.181);
  near(headCenter.position.y, 0.2);
  assert.equal(player.animationRig.root.getObjectByName('neck-volume'), undefined);
  const neckBase = neckBone.position.clone();
  const headSurfaceScaleBase = headSurface.scale.clone();
  const torsoScaleBase = torsoSurface.scale.clone();
  const torsoMorphBase = [...torsoSurface.morphTargetInfluences];
  player.setCharacterProportions({ neckLength: 0 });
  near(headBone.position.y, 0);
  assert.deepEqual(neckBone.position.toArray(), neckBase.toArray());
  assert.deepEqual(headSurface.scale.toArray(), headSurfaceScaleBase.toArray());
  assert.deepEqual(torsoSurface.scale.toArray(), torsoScaleBase.toArray());
  assert.deepEqual(torsoSurface.morphTargetInfluences, torsoMorphBase);
  player.setCharacterProportions({ neckLength: 1.8 });
  near(headBone.position.y, 0.095 * 1.8);
  assert.deepEqual(neckBone.position.toArray(), neckBase.toArray());
  assert.deepEqual(headSurface.scale.toArray(), headSurfaceScaleBase.toArray());
  player.resetCharacterProportions();
  assert.deepEqual(player.meshyShortsDiagnostics, {
    ready: true,
    triangles: 10732,
    sourceSha256: 'ca74185a56d5fd9552088486b59ea4c836e1ac8228919a3743760cb8468629e5',
    skinBones: ['hips', 'hip-left', 'hip-right'],
    textureState: 'loading',
    texturesLoaded: 0,
    textureError: null,
  });
  const shortsSurface = player.animationRig.root.getObjectByName('meshy-shorts-surface');
  assert.equal(shortsSurface.isSkinnedMesh, true);
  assert.equal(shortsSurface.parent.name, 'procedural-rider');
  const shortsScaleBase = shortsSurface.scale.clone();
  player.setCharacterProportions({ legThickness: 1.5 });
  assert.deepEqual(shortsSurface.scale.toArray(), shortsScaleBase.toArray());
  assert.deepEqual(shortsSurface.morphTargetInfluences, [0, 0, 0]);
  player.setCharacterProportions({
    legThickness: 1.5,
    shortsWidth: 1.4,
    shortsHeight: 1.25,
    shortsDepth: 0.75,
  });
  assert.deepEqual(shortsSurface.scale.toArray(), shortsScaleBase.toArray());
  near(shortsSurface.morphTargetInfluences[0], 0.4);
  near(shortsSurface.morphTargetInfluences[1], 0.25);
  near(shortsSurface.morphTargetInfluences[2], -0.25);
  player.resetCharacterProportions();
  assert.deepEqual(shortsSurface.morphTargetInfluences, [0, 0, 0]);
  assert.deepEqual(player.meshyFootwearDiagnostics, {
    ready: true,
    triangles: 6270,
    sourceSha256: 'd9b49aa72ada43f841bb824c3743e05cf19d0b295403f931ff3a821ce8464f43',
    sides: ['left', 'right'],
    sockSkinBones: [
      ['knee-left', 'ankle-left'],
      ['knee-right', 'ankle-right'],
    ],
    textureState: 'loading',
    texturesLoaded: 0,
    textureError: null,
  });
  const shoeLeft = player.animationRig.root.getObjectByName('meshy-shoe-surface-left');
  const shoeRight = player.animationRig.root.getObjectByName('meshy-shoe-surface-right');
  const sockLeft = player.animationRig.root.getObjectByName('meshy-sock-surface-left');
  const sockRight = player.animationRig.root.getObjectByName('meshy-sock-surface-right');
  const ankleLeft = player.animationRig.root.getObjectByName('ankle-left');
  const ankleRight = player.animationRig.root.getObjectByName('ankle-right');
  assert.equal(shoeLeft.parent, ankleLeft);
  assert.equal(shoeRight.parent, ankleRight);
  assert.equal(sockLeft.parent.name, 'procedural-rider');
  assert.equal(sockRight.parent.name, 'procedural-rider');
  assert.equal(sockLeft.isSkinnedMesh, true);
  assert.equal(sockRight.isSkinnedMesh, true);
  assert.equal(player.animationRig.root.getObjectByName('shoe-left'), undefined);
  assert.equal(player.animationRig.root.getObjectByName('shoe-right'), undefined);
  assert.equal(player.animationRig.root.getObjectByName('sole-left'), undefined);
  assert.equal(player.animationRig.root.getObjectByName('sole-right'), undefined);
  const shoeScaleBase = shoeLeft.scale.clone();
  player.setCharacterProportions({ legThickness: 1.5 });
  near(sockLeft.morphTargetInfluences[0], 0.5);
  near(sockRight.morphTargetInfluences[0], 0.5);
  assert.deepEqual(shoeLeft.scale.toArray(), shoeScaleBase.toArray());
  player.setCharacterProportions({ footSize: 1.4, legThickness: 1 });
  assert.deepEqual(ankleLeft.scale.toArray(), [1.4, 1.4, 1.4]);
  assert.deepEqual(ankleRight.scale.toArray(), [1.4, 1.4, 1.4]);
  near(sockLeft.morphTargetInfluences[0], 0);
  player.resetCharacterProportions();
  assert.deepEqual(ankleLeft.scale.toArray(), [1.53, 1.53, 1.53]);
  assert.deepEqual(ankleRight.scale.toArray(), [1.53, 1.53, 1.53]);
  near(sockLeft.morphTargetInfluences[0], 0.37);
  near(sockRight.morphTargetInfluences[0], 0.37);
  assert.deepEqual(new Set(player.stretchableBoneDiagnostics.ids), new Set([
    'upper-arm-left', 'lower-arm-left', 'upper-arm-right', 'lower-arm-right',
    'upper-leg-left', 'lower-leg-left', 'upper-leg-right', 'lower-leg-right',
  ]));
  const previewUpperArm = productionBones.get('upper-arm-left');
  player.setCharacterProportions({ upperArmLength: 1.2, armThickness: 1.3 });
  player.enterAnimationPreview();
  player.applyAnimationDeformations({ 'deform.arm.upper.left.length': 1.4 });
  player.syncCharacterAppearance();
  player.resetAnimationPreview();
  near(previewUpperArm.distalSocket.position.y, -previewUpperArm.baseLength * 1.2);
  near(previewUpperArm.shaft.morphTargetInfluences[0], 0.3);
  player.applyAnimationDeformations({ 'deform.arm.upper.left.length': 1.4 });
  player.syncCharacterAppearance();
  player.exitAnimationPreview();
  near(previewUpperArm.distalSocket.position.y, -previewUpperArm.baseLength * 1.2);
  near(previewUpperArm.shaft.morphTargetInfluences[0], 0.3);
  const removeOverlay = player.setAuthoredPoseOverlay(({ applyDeformations }) => {
    applyDeformations({ 'deform.arm.upper.left.length': 1.4 });
  });
  player.clearCharacterAppearance();
  player.playerAnimationBridge.applyOverlay(1 / 60);
  player.syncCharacterAppearance();
  removeOverlay();
  near(previewUpperArm.distalSocket.position.y, -previewUpperArm.baseLength * 1.2);
  near(previewUpperArm.shaft.morphTargetInfluences[0], 0.3);
  player.resetCharacterProportions();
  assert.equal(player.humanoidSkeletonRef.bones.length, 46,
    '22 conventional body bones + 24 semantic digit bones');
  const binding = RigBinding.fromSculptRuntime(player.animationRig.root);
  assert.equal(binding.definition.joints.length, 52,
    'existing 28 semantic controls + 24 hand bones');
  for (const side of ['Left', 'Right']) {
    const metacarpal = binding.definition.joints.find((joint) => joint.id === `thumbMetacarpal${side}`);
    const proximal = binding.definition.joints.find((joint) => joint.id === `thumbProximal${side}`);
    assert.equal(metacarpal.parentId, `wrist${side}`);
    assert.equal(proximal.parentId, `thumbMetacarpal${side}`);
    assert.notEqual(metacarpal.rest.position[0], 0);
    assert.notEqual(metacarpal.rest.quaternion[2], 0);
    assert.equal(player.animationRig.jointsById.get(`thumbMetacarpal${side}`).mirrorId,
      `thumbMetacarpal${side === 'Left' ? 'Right' : 'Left'}`);
  }

  console.log('PASS mirrored three-finger cartoon glove geometry, 24 digit bones, sockets, poses, and player integration');
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  await server.close();
}
