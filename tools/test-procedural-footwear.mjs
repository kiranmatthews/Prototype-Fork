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

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`);
}

function localBounds(mesh) {
  mesh.geometry.computeBoundingBox();
  mesh.updateMatrix();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);
}

function makeRig(side, x) {
  const mount = new THREE.Group();
  const knee = new THREE.Bone();
  knee.name = `knee-${side}`;
  knee.position.set(x, 0.43, 0);
  mount.add(knee);
  const ankle = new THREE.Bone();
  ankle.name = `ankle-${side}`;
  ankle.position.y = -0.28;
  knee.add(ankle);
  return { mount, knee, ankle };
}

installHeadlessDom();
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!expectedAssetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!expectedAssetLog(args[0])) originalError(...args); };

try {
  const footwearApi = await server.ssrLoadModule('/src/character/proceduralFootwear.ts');
  const {
    PROCEDURAL_FOOTWEAR_CONTACT,
    PROCEDURAL_FOOTWEAR_PALETTE,
    PROCEDURAL_FOOTWEAR_SCHEMA_VERSION,
    PROCEDURAL_FOOTWEAR_STYLE_ID,
    createProceduralFootwear,
  } = footwearApi;
  assert.equal(PROCEDURAL_FOOTWEAR_SCHEMA_VERSION, 1);
  assert.equal(PROCEDURAL_FOOTWEAR_STYLE_ID, 'legacy-skate-meshy-palette-v1');
  assert.deepEqual(PROCEDURAL_FOOTWEAR_CONTACT, {
    soleY: -0.05, heelZ: -0.07, footCenterZ: 0.065, toeZ: 0.2,
  });
  assert.deepEqual(PROCEDURAL_FOOTWEAR_PALETTE, {
    upper: 0x111111,
    sock: 0x692124,
    cuff: 0x52181c,
    accent: 0xf3f1f4,
    outsole: 0xefe6d6,
    foxing: 0x17181c,
  });

  const leftRig = makeRig('left', 0.115);
  const rightRig = makeRig('right', -0.115);
  const left = createProceduralFootwear({ knee: leftRig.knee, ankle: leftRig.ankle, side: 'left' });
  const right = createProceduralFootwear({ knee: rightRig.knee, ankle: rightRig.ankle, side: 'right' });
  for (const [component, rig, side] of [
    [left, leftRig, 'left'],
    [right, rightRig, 'right'],
  ]) {
    assert.equal(component.side, side);
    assert.equal(component.sock.parent, rig.knee);
    assert.equal(component.cuff.parent, rig.knee);
    assert.equal(component.ankleRoot.parent, rig.ankle);
    assert.equal(component.shoe.parent, component.ankleRoot);
    assert.equal(component.sole.parent, component.ankleRoot);
    assert.equal(component.foxing.parent, component.ankleRoot);
    assert.equal(component.laces.length, 2);
    assert.equal(component.sideStripes.length, 2);
    assert.equal(component.triangleCount, 888);
    assert.equal(component.shoe.material.color.getHex(), 0x111111);
    assert.equal(component.sock.material.color.getHex(), 0x692124);
    assert.equal(component.cuff.material.color.getHex(), 0x52181c);
    assert.equal(component.sole.material.color.getHex(), 0xefe6d6);
    assert.equal(component.foxing.material.color.getHex(), 0x17181c);
    assert.ok(component.laces.every((lace) => lace.material.color.getHex() === 0xf3f1f4));
    assert.ok(component.sideStripes.every((stripe) => stripe.material.color.getHex() === 0xf3f1f4));
    component.ankleRoot.traverse((object) => {
      if (!object.isMesh) return;
      assert.equal(object.userData.footwearSurface, true);
      assert.equal(object.userData.anatomicalSide, side);
      assert.equal(object.material.flatShading, true);
      assert.equal(object.material.map, null, `${object.name} unexpectedly loads a texture`);
    });
  }
  assert.equal(left.triangleCount, right.triangleCount);
  assert.equal(left.shoe.geometry, right.shoe.geometry);
  assert.equal(left.sole.geometry, right.sole.geometry);
  assert.equal(left.sock.geometry, right.sock.geometry);
  assert.equal(left.shoe.material, right.shoe.material);

  assert.deepEqual(left.shoe.scale.toArray(), [0.85, 0.5, 1.5]);
  assert.deepEqual(left.shoe.position.toArray(), [0, -0.006, 0.065]);
  assert.deepEqual(left.sock.position.toArray(), [0, -0.205, 0]);
  assert.deepEqual(left.cuff.position.toArray(), [0, -0.177, 0]);
  near(left.sock.geometry.parameters.radiusTop, 0.045);
  near(left.sock.geometry.parameters.radiusBottom, 0.052);
  const soleBounds = localBounds(left.sole);
  near(soleBounds.min.y, -0.05005, 2e-5);
  near(soleBounds.max.y, -0.01495, 2e-5);
  near(soleBounds.min.z, -0.07, 2e-5);
  near(soleBounds.max.z, 0.2, 2e-5);
  const foxingBounds = localBounds(left.foxing);
  assert.ok(foxingBounds.min.y > -0.05, 'foxing changed the sole contact plane');
  assert.ok(foxingBounds.min.z <= -0.07 && foxingBounds.max.z >= 0.2,
    'foxing does not frame the complete outsole');

  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const player = new Player(new THREE.Scene());
  assert.equal(player.proceduralFootwearDiagnostics.ready, true);
  assert.equal(player.proceduralFootwearDiagnostics.triangles, 1776);
  assert.equal(player.proceduralFootwearDiagnostics.styleId, PROCEDURAL_FOOTWEAR_STYLE_ID);
  assert.deepEqual(player.proceduralFootwearDiagnostics.sides, ['left', 'right']);
  assert.deepEqual(player.proceduralFootwearDiagnostics.shoeAttachments, ['ankle-left', 'ankle-right']);
  assert.deepEqual(player.proceduralFootwearDiagnostics.sockAttachments, ['knee-left', 'knee-right']);
  assert.equal(player.proceduralFootwearDiagnostics.triangles, left.triangleCount * 2);
  const rigRoot = player.animationRig.root;
  const ankleLeft = rigRoot.getObjectByName('ankle-left');
  const kneeLeft = rigRoot.getObjectByName('knee-left');
  const playerShoe = rigRoot.getObjectByName('shoe-left');
  const playerSock = rigRoot.getObjectByName('sock-left');
  assert.equal(playerShoe.parent.parent, ankleLeft);
  assert.equal(playerSock.parent, kneeLeft);
  rigRoot.updateWorldMatrix(true, true);
  const lowerLeg = player.stretchableBones.find((component) =>
    component.id === 'lower-leg-left');
  const sockBounds = new THREE.Box3().setFromObject(playerSock);
  const insertionBounds = new THREE.Box3().setFromObject(lowerLeg.distalKnob);
  assert.ok(sockBounds.min.x <= insertionBounds.min.x && sockBounds.max.x >= insertionBounds.max.x,
    'sock does not laterally contain the lower-leg insertion tip');
  assert.ok(sockBounds.min.z <= insertionBounds.min.z && sockBounds.max.z >= insertionBounds.max.z,
    'sock does not depth-contain the lower-leg insertion tip');
  for (const [name, expected] of [
    ['socket-foot-left', [0, -0.05, 0.065]],
    ['socket-heel-left', [0, -0.05, -0.07]],
    ['toe-left', [0, -0.05, 0.16]],
    ['socket-toe-left', [0, 0, 0.04]],
  ]) assert.deepEqual(rigRoot.getObjectByName(name).position.toArray(), expected);
  const footprint = player.soleFootprint(ankleLeft);
  assert.ok(footprint.length >= 4);
  near(Math.min(...footprint.map((point) => point.y)), -0.05005, 2e-5);
  assert.ok(Math.min(...footprint.map((point) => point.z)) <= -0.0699);
  assert.ok(Math.max(...footprint.map((point) => point.z)) >= 0.1999);

  // Compare the real animated rider with and without the on-foot seating
  // pass. The actual soles must stay above ground, while running, skating and
  // airborne poses must remain identical to the existing presentation.
  const { RigBinding, createPlayerStarterAnimationSuite } =
    await server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } =
    await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const baseline = new Player(new THREE.Scene());
  baseline.seatOnFoot = noop;
  const riders = [baseline, player];
  const runtimes = riders.map((rider) => createCharacterAnimationRuntime(rider,
    createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(
      rider.animationRig.root, { strict: false },
    ).definition)));
  const soleHeights = (rider) => {
    rider.group.updateWorldMatrix(true, true);
    return ['left', 'right'].map((side) => {
      const sole = rider.group.getObjectByName(`sole-${side}`);
      const positions = sole.geometry.attributes.position;
      const point = new THREE.Vector3();
      let minY = Infinity;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(sole.matrixWorld);
        minY = Math.min(minY, point.y - rider.pos.y);
      }
      return minY;
    });
  };
  const input = { moveX: 0, moveY: 0, lookX: 0, lookY: 0 };
  const metrics = {};
  try {
    for (const [mode, speed, skating, grounded] of [
      ['idle', 0, false, true], ['walk', 3, false, true], ['run', 9, false, true],
      ['skate-idle', 0, true, true], ['skate', 12, true, true],
      ['board-air', 12, true, false], ['foot-air', 0, false, false],
    ]) {
      let lowered = 0, minimum = Infinity, maximum = -Infinity;
      for (let frame = 0; frame < 180; frame++) {
        for (const rider of riders) {
          rider.state = grounded ? 'ride' : 'air';
          rider.grounded = grounded;
          rider.freeSkate = skating;
          rider.airFromSkate = skating;
          rider.speed = speed;
          rider.walkVelocity.set(0, 0, skating ? 0 : -speed);
          rider.prevPos.copy(rider.pos);
          rider.pos.z -= speed / 60;
          rider.runTime += 1 / 60;
          rider.rawInput = input;
          rider.syncVisual(input, 1 / 60);
        }
        const before = soleHeights(baseline), after = soleHeights(player);
        assert.deepEqual(player.pos.toArray(), baseline.pos.toArray(), 'seating changed physics');
        assert.deepEqual(player.boardG.matrixWorld.elements, baseline.boardG.matrixWorld.elements,
          'on-foot seating moved the skateboard');
        near(after[0] - after[1], before[0] - before[1], 1e-8);
        if (mode === 'run' || skating || !grounded) {
          near(after[0], before[0], 1e-8);
          near(after[1], before[1], 1e-8);
          assert.deepEqual(player.riderG.matrixWorld.elements, baseline.riderG.matrixWorld.elements,
            `${mode}: protected rider presentation changed`);
        } else if (frame >= 60) {
          const low = Math.min(...after);
          assert.ok(low >= Math.min(0.0059, ...before) - 1e-8,
            `${mode} frame ${frame}: sole ${low}, original ${Math.min(...before)}`);
          lowered += Math.min(...before) - low;
          minimum = Math.min(minimum, low);
          maximum = Math.max(maximum, low);
        }
      }
      if (mode !== 'run' && !skating && grounded) {
        assert.ok(lowered / 120 > 0.07, `${mode}: hover was not reduced`);
        if (mode === 'idle') assert.ok(maximum < 0.04, 'idle still hovers');
        metrics[mode] = { minimum, maximum, meanLowering: lowered / 120 };
      }
    }
  } finally {
    for (const runtime of runtimes) runtime.dispose();
  }
  console.log('On-foot seating:', metrics);

  const { sampleSkateMount, SKATE_MOUNT_DURATION, SKATE_MOUNT_TIMING } =
    await server.ssrLoadModule('/src/skateMount.ts');
  assert.deepEqual(sampleSkateMount(0), { lift: 0, tuck: 0, settle: 0 });
  assert.deepEqual(sampleSkateMount(SKATE_MOUNT_DURATION), sampleSkateMount(-1));
  near(sampleSkateMount(SKATE_MOUNT_TIMING.airTime / 2).lift, 0.28);
  near(sampleSkateMount(SKATE_MOUNT_TIMING.airTime + SKATE_MOUNT_TIMING.settleTime / 2).settle, 1);
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const mountLevel = new Level(new THREE.Scene(), { id: 'mount-check', name: 'Mount check', data: {
    v: 1, name: 'Mount check', spawn: [0, 0.02, 0], killY: -20, groups: [],
    components: [
      { t: 'platform', p: [0, -0.5, -100], s: [100, 1, 240] },
      { t: 'gate', p: [0, 0, -210] },
    ],
  } });
  const mountRiders = [new Player(mountLevel.scene), new Player(mountLevel.scene)];
  const originalVisual = mountRiders[0].syncVisual.bind(mountRiders[0]);
  mountRiders[0].syncVisual = (input, dt) => {
    mountRiders[0].skateMountT = -1;
    originalVisual(input, dt);
  };
  const mountRuntimes = mountRiders.map(rider => createCharacterAnimationRuntime(rider,
    createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(rider.animationRig.root,
      { strict: false }).definition)));
  const mountInput = patch => Object.assign({
    moveX: 0, moveY: 0, lookX: 0, lookY: 0,
    jumpHeld: false, jumpPressed: false, jumpReleased: false,
    grindHeld: false, grindPressed: false, spinHeld: false, spinPressed: false,
    grabHeld: false, grabPressed: false, transferHeld: false, transferPressed: false,
    restartPressed: false, consumeEdges: noop,
  }, patch);
  const physics = rider => [rider.state, rider.grounded, rider.freeSkate,
    ...rider.pos.toArray(), rider.speed, rider.vVel, ...rider.walkVelocity.toArray(),
    rider.charging, rider.chargePlanted, rider.skateCharge];
  const mountStep = (patch = {}) => {
    for (const rider of mountRiders) rider.step(1 / 60, mountInput(patch), mountLevel);
    mountLevel.update(1 / 60);
    assert.deepEqual(physics(mountRiders[1]), physics(mountRiders[0]), 'mount hop changed gameplay');
    for (const rider of mountRiders) rider.group.updateWorldMatrix(true, true);
    assert.deepEqual(mountRiders[1].boardG.matrixWorld.elements, mountRiders[0].boardG.matrixWorld.elements,
      'mount hop moved the board');
  };
  const resetMount = () => {
    for (const rider of mountRiders) {
      rider.enterLevel('mount-check');
      rider.respawn(mountLevel, true);
    }
    for (let i = 0; i < 30; i++) mountStep();
  };
  const mountedSoleGap = rider => {
    const inverse = rider.boardG.matrixWorld.clone().invert();
    const point = new THREE.Vector3();
    let minimum = Infinity;
    for (const {sole} of rider.proceduralFootwear) {
      const positions = sole.geometry.getAttribute('position');
      for (let i=0;i<positions.count;i++) {
        point.fromBufferAttribute(positions,i).applyMatrix4(sole.matrixWorld).applyMatrix4(inverse);
        minimum = Math.min(minimum,point.y-rider.boardG.userData.gripTop);
      }
    }
    return minimum;
  };
  try {
    const mounted = mountRiders[1];
    for (const mode of ['static charge', 'moving charge', 'automatic momentum']) {
      resetMount();
      if (mode === 'moving charge') for (let i = 0; i < 75; i++) mountStep({moveY:1});
      if (mode === 'automatic momentum') for (const rider of mountRiders) {
        rider.speed = 12;
        rider.walkVelocity.set(0, 0, -12);
      }
      let startFrame = -1, starts = 0, wasActive = false, peakLift = 0, peakSoleGap = 0;
      for (let frame = 0; frame < 100; frame++) {
        mountStep(mode === 'automatic momentum' ? {} : {moveY:1,jumpHeld:true,jumpPressed:frame===0});
        const active = mounted.skateMountT >= 0;
        if (active && !wasActive) { startFrame = frame; starts++; }
        wasActive = active;
        if (active) {
          assert.equal(mounted.grounded, true, 'visual hop left the physics ground');
          peakLift = Math.max(peakLift, sampleSkateMount(mounted.skateMountT).lift);
          const gap=mountedSoleGap(mounted);
          peakSoleGap=Math.max(peakSoleGap,gap);
          assert.ok(gap>-0.015,`${mode}: mounting shoe passed through deck (${gap})`);
        }
      }
      assert.equal(starts, 1, `${mode}: hop did not play exactly once`);
      if (mode !== 'automatic momentum') assert.ok(startFrame >= 32, `${mode}: hop started before commitment`);
      else assert.equal(startFrame, 0, 'automatic mount did not hop at the transition');
      assert.ok(peakLift > 0.27, `${mode}: hop never rose`);
      assert.ok(peakSoleGap>0.2,`${mode}: deck planting canceled the visible hop`);
      assert.equal(mounted.skateMountT, -1, `${mode}: hop never finished`);
      near(mounted.riderG.position.distanceTo(mountRiders[0].riderG.position), 0, 1e-8);
      for (const name of ['hip-left','hip-right','knee-left','knee-right','shoulder-left','shoulder-right']) {
        const a=mounted.group.getObjectByName(name),b=mountRiders[0].group.getObjectByName(name);
        near(a.quaternion.angleTo(b.quaternion),0,1e-7);
      }
      console.log(`Mount hop: ${mode}, start frame ${startFrame}, peak ${peakLift.toFixed(3)}m; gameplay and board unchanged`);
    }
    resetMount();
    for (let i = 0; i < 10; i++) mountStep({moveY:1,jumpHeld:true,jumpPressed:i===0});
    assert.equal(mounted.skateMountT,-1,'quick charge triggered a mount hop');
    mountStep({moveY:1,jumpReleased:true});
    assert.equal(mounted.skateMountT,-1,'normal jump triggered a mount hop');
    resetMount();
    for (let i = 0; i < 38; i++) mountStep({moveY:1,jumpHeld:true,jumpPressed:i===0});
    assert.ok(mounted.skateMountT>=0,'interruption fixture did not mount');
    mountStep({moveY:1,jumpReleased:true});
    assert.equal(mounted.state,'air');
    assert.equal(mounted.skateMountT,-1,'real ollie retained the mount hop');
    resetMount();
    for (let i = 0; i < 38; i++) mountStep({moveY:1,jumpHeld:true,jumpPressed:i===0});
    mounted.respawn(mountLevel,true);
    assert.equal(mounted.skateMountT,-1,'respawn retained a stale mount hop');
  } finally {
    for (const runtime of mountRuntimes) runtime.dispose();
    mountLevel.dispose();
  }

  const [playerSource, labSource, mainSource, packageSource, moduleSource] = await Promise.all([
    readFile(resolve(root, 'src/player.ts'), 'utf8'),
    readFile(resolve(root, 'src/characterLab.ts'), 'utf8'),
    readFile(resolve(root, 'src/main.ts'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
    readFile(resolve(root, 'src/character/proceduralFootwear.ts'), 'utf8'),
  ]);
  assert.match(playerSource, /createProceduralFootwear/);
  assert.doesNotMatch(playerSource, /createMeshyFootwear|meshyFootwearTextureDiagnostics/);
  assert.match(playerSource, /kind: 'procedural-cartoon-skate-footwear'/);
  assert.match(labSource, /Procedural footwear ready/);
  assert.doesNotMatch(labSource, /Meshy footwear ready|meshy-shoe-surface/);
  assert.match(mainSource, /getProceduralFootwearDiagnostics/);
  assert.doesNotMatch(mainSource, /getMeshyFootwearDiagnostics/);
  assert.doesNotMatch(moduleSource, /TextureLoader|meshy-footwear\//);
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts['check:character-lab'], /test-procedural-footwear\.mjs/);
  assert.doesNotMatch(packageJson.scripts['check:character-lab'], /test-meshy-footwear\.mjs/);

  console.log('PASS legacy procedural footwear restoration, Meshy-derived palette, rig hierarchy, proportions, and sole planting envelope');
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  await server.close();
}
