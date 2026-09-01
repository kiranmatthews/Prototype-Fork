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
  assert.ok(left.fingers.index.middle.rotation.x < 0);
  assert.ok(left.thumb.proximal.rotation.x < 0);

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
  assert.ok(spec.rig.fingerChains.every((chain) => chain.curlAxis[0] === -1));
  const requiredNegativeCurl = {
    fingerIndexProximal: -0.92,
    fingerIndexMiddle: -1.28,
    fingerIndexDistal: -1.08,
    fingerMiddleProximal: -0.96,
    fingerMiddleMiddle: -1.34,
    fingerMiddleDistal: -1.12,
    fingerOuterProximal: -0.9,
    fingerOuterMiddle: -1.26,
    fingerOuterDistal: -1.08,
    thumbProximal: -0.82,
    thumbDistal: -1.08,
  };
  const componentJoints = spec.componentTree.flatMap((component) => component.joints ?? []);
  for (const [jointId, requiredMinimum] of Object.entries(requiredNegativeCurl)) {
    const joint = componentJoints.find((candidate) => candidate.id === jointId);
    assert.ok(joint, `sculpt spec is missing ${jointId}`);
    if (joint.axis) assert.equal(joint.axis[0], -1, `${jointId} publishes the wrong curl axis`);
    const limits = joint.limitsRadians ?? joint.curlLimitsRadians;
    assert.ok(limits[0] <= requiredMinimum && limits[1] >= 0,
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
  assert.equal(player.stretchableBoneDiagnostics.triangles, 35072);
  near(player.stretchableBoneDiagnostics.minScale, 0.319);
  near(player.stretchableBoneDiagnostics.maxScale, 2.765);
  assert.deepEqual(new Set(player.stretchableBoneDiagnostics.ids), new Set([
    'upper-arm-left', 'lower-arm-left', 'upper-arm-right', 'lower-arm-right',
    'upper-leg-left', 'lower-leg-left', 'upper-leg-right', 'lower-leg-right',
  ]));
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
