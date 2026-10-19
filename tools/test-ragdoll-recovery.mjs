import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

function installHeadlessDom() {
  const noop = () => {};
  const storage = new Map();
  const classList = {
    add: noop,
    remove: noop,
    toggle: noop,
    contains: () => false,
  };
  const makeElement = (tag = "div") => ({
    tagName: String(tag).toUpperCase(),
    style: {},
    classList,
    children: [],
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...children) {
      this.children.push(...children);
    },
    remove: noop,
    click: noop,
  });

  globalThis.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key) {
      return storage.has(String(key)) ? storage.get(String(key)) : null;
    },
    key(index) {
      return [...storage.keys()][index] ?? null;
    },
    removeItem(key) {
      storage.delete(String(key));
    },
    setItem(key, value) {
      storage.set(String(key), String(value));
    },
  };

  const context = new Proxy(
    {
      canvas: null,
      createImageData(width, height) {
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
      createLinearGradient() {
        return { addColorStop: noop };
      },
      createPattern() {
        return {};
      },
      createRadialGradient() {
        return { addColorStop: noop };
      },
      getImageData(_x, _y, width, height) {
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
      measureText(text) {
        return { width: String(text).length * 8 };
      },
    },
    {
      get(target, key) {
        return key in target ? target[key] : noop;
      },
    },
  );
  const makeCanvas = () => ({
    ...makeElement("canvas"),
    width: 1,
    height: 1,
    getContext() {
      context.canvas = this;
      return context;
    },
  });

  globalThis.document = {
    body: makeElement("body"),
    fonts: null,
    createElement(tag) {
      return tag === "canvas" ? makeCanvas() : makeElement(tag);
    },
    createElementNS(_namespace, tag) {
      return this.createElement(tag);
    },
  };
  globalThis.window = {
    location: { search: "?lite", href: "http://headless.invalid/?lite" },
    devicePixelRatio: 1,
    addEventListener: noop,
    removeEventListener: noop,
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  globalThis.Image = class HeadlessImage {
    addEventListener(type, callback) {
      if (type === "error") queueMicrotask(callback);
    }
    removeEventListener() {}
    set src(_value) {
      queueMicrotask(() => this.onerror?.(new Error("headless image")));
    }
  };
  const NativeRequest = globalThis.Request;
  globalThis.Request = class HeadlessRequest extends NativeRequest {
    constructor(input, init) {
      super(
        typeof input === "string" && input.startsWith("/")
          ? `http://headless.invalid${input}`
          : input,
        init,
      );
    }
  };
  globalThis.fetch = async () => new Response("", { status: 404 });
}

const channels = [
  "jumpHeld",
  "grindHeld",
  "spinHeld",
  "grabHeld",
  "jumpPressed",
  "jumpReleased",
  "grindPressed",
  "spinPressed",
  "grabPressed",
  "restartPressed",
  "transferHeld",
  "transferPressed",
];
const edgeChannels = [
  "jumpPressed",
  "jumpReleased",
  "grindPressed",
  "spinPressed",
  "grabPressed",
  "restartPressed",
  "transferPressed",
];

function makeInput(overrides = {}) {
  const input = { moveX: 0, moveY: 0 };
  for (const key of channels) input[key] = false;
  Object.assign(input, overrides);
  input.consumeEdges = () => {
    for (const key of edgeChannels) input[key] = false;
  };
  return input;
}

function closeTo(actual, expected, message, tolerance = 1e-7) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function installRandomSequence(player, values, fallback = 0.5) {
  let draws = 0;
  player.simRand = () => {
    const value = draws < values.length ? values[draws] : fallback;
    draws++;
    return value;
  };
  return () => draws;
}

installHeadlessDom();
const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) =>
  /GLB|skull mask failed|crossbones failed|procedural skateboard trucks|spin model failed/.test(
    String(value ?? ""),
  );
console.warn = (...args) => {
  if (!expectedAssetLog(args[0])) originalWarn(...args);
};
console.error = (...args) => {
  if (!expectedAssetLog(args[0])) originalError(...args);
};

const fixtures = [];
let restoreTuning = null;

try {
  const { sampleBailRecovery, BAIL_RECOVERY_SPRAWL_PITCH } =
    await server.ssrLoadModule("/src/bailRecovery.ts");
  const { Level } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");

  // Pure recovery curve: invalid/early input starts in the authored sprawl,
  // temporary pose channels close cleanly, and one complete forward rotation
  // reaches the identity attitude without ever reversing.
  const start = sampleBailRecovery(0);
  const end = sampleBailRecovery(1);
  const invalid = sampleBailRecovery(Number.NaN);
  closeTo(start.forwardRoll, BAIL_RECOVERY_SPRAWL_PITCH, "recovery start pitch");
  closeTo(invalid.forwardRoll, start.forwardRoll, "invalid progress clamps to start");
  closeTo(end.forwardRoll, Math.PI * 2, "recovery completes one forward roll");
  for (const key of ["tuck", "plant", "stride", "shoulder"]) {
    closeTo(start[key], 0, `${key} starts neutral`);
    closeTo(end[key], 0, `${key} ends neutral`);
  }
  closeTo(start.drive, 0, "automatic drive starts at zero");
  closeTo(end.drive, 1, "automatic drive reaches full run-out");
  let priorRoll = -Infinity;
  let sawForwardMotion = false;
  for (let i = 0; i <= 240; i++) {
    const roll = sampleBailRecovery(i / 240).forwardRoll;
    assert.ok(roll + 1e-12 >= priorRoll, "forward recovery rotation reversed");
    if (roll > priorRoll + 1e-6 && priorRoll !== -Infinity) sawForwardMotion = true;
    priorRoll = roll;
  }
  assert.equal(sawForwardMotion, true, "forward recovery rotation never advanced");

  const reusableRecovery = sampleBailRecovery(0);
  assert.equal(sampleBailRecovery(.37, reusableRecovery), reusableRecovery,
    "recovery sampler replaced its caller-owned output");
  assert.deepEqual(reusableRecovery, sampleBailRecovery(.37));

  const { CharacterInteractionBounds } = await server.ssrLoadModule('/src/character/interactionBounds.ts');
  const contactMeasure = new CharacterInteractionBounds(null);
  const contactRoot = new THREE.Group();
  const contactMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.MeshBasicMaterial());
  contactRoot.add(contactMesh);
  const contactNormal = new THREE.Vector3(.4, .8, -.3).normalize(), contactPoint = new THREE.Vector3(.2, -.3, .7);
  const contactFast = new THREE.Vector3(), contactReference = new THREE.Vector3(), contactBounds = new THREE.Box3();
  for (let pose = 0; pose < 30; pose++) {
    contactMesh.rotation.set(pose * .09, pose * -.13, pose * .017);
    contactMesh.scale.set(pose % 2 ? -1.4 : 1.4, .6, 1.8);
    contactMesh.position.set(Math.sin(pose), .3 * pose, -.2);
    contactRoot.updateMatrixWorld(true);
    const fast = contactMeasure.sampledPlaneDistance(contactRoot, contactNormal, contactPoint, contactFast);
    const reference = contactMeasure.sampledPlaneDistance(contactRoot, contactNormal, contactPoint, contactReference, contactBounds);
    closeTo(fast, reference, "cached local-plane support matches world hull", 1e-10);
    closeTo(contactFast.distanceTo(contactReference), 0, "cached support point matches world hull", 1e-10);
  }
  let contactVertexReads = 0;
  const originalVertexGetter = THREE.Mesh.prototype.getVertexPosition;
  try {
    THREE.Mesh.prototype.getVertexPosition = function(index, out) {
      contactVertexReads++;return originalVertexGetter.call(this, index, out);
    };
    for (let pose = 0; pose < 60; pose++) {
      contactRoot.rotation.x += .01;contactRoot.updateMatrixWorld(true);
      contactMeasure.sampledPlaneDistance(contactRoot, contactNormal, contactPoint);
    }
    assert.equal(contactVertexReads, 0, "warm rigid contact re-read mesh vertices");
    contactMesh.geometry.attributes.position.setXYZ(0, 1, -4, 2);
    contactMesh.geometry.attributes.position.needsUpdate = true;
    const updated = contactMeasure.sampledPlaneDistance(contactRoot, contactNormal, contactPoint);
    assert.ok(contactVertexReads > 0, "edited rigid contact kept stale geometry");
    closeTo(updated, contactMeasure.sampledPlaneDistance(contactRoot, contactNormal, contactPoint, undefined, contactBounds),
      "edited cached local-plane support matches world hull", 1e-10);
  } finally { THREE.Mesh.prototype.getVertexPosition = originalVertexGetter; }
  const localBox = new THREE.Box3(new THREE.Vector3(-.7, -1.3, .2), new THREE.Vector3(1.2, .4, 2.1));
  for (let pose = 0; pose < 60; pose++) {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(pose*.2, -pose*.1, .3),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(pose*.3, -pose*.21, pose*.11)),
      new THREE.Vector3(pose%2 ? -1.3 : 1.3, .4+pose*.04, 2.1));
    if (pose % 3 === 0) transform.elements[4] += .31; // affine shear
    if (pose % 7 === 0) transform.elements[3] = .001; // original projective fallback
    const reference = localBox.clone().applyMatrix4(transform);
    const actual = contactMeasure.transformBounds(localBox, transform);
    closeTo(actual.min.distanceTo(reference.min), 0, "affine lower box extrema", 1e-10);
    closeTo(actual.max.distanceTo(reference.max), 0, "affine upper box extrema", 1e-10);
  }
  contactMesh.geometry.dispose();contactMesh.material.dispose();

  const tuningSnapshot = {
    bailRollOutSpeed: TUNING.bailRollOutSpeed,
    ragFlailJumpChance: TUNING.ragFlailJumpChance,
    ragFlailJumpVelocity: TUNING.ragFlailJumpVelocity,
    ragFlailSteerChance: TUNING.ragFlailSteerChance,
    ragFlailSteerSpeed: TUNING.ragFlailSteerSpeed,
    ragFlailSteerJitter: TUNING.ragFlailSteerJitter,
  };
  restoreTuning = () => Object.assign(TUNING, tuningSnapshot);

  const levelData = {
    v: 1,
    name: "Ragdoll recovery fixture",
    spawn: [0, 0.05, 0],
    killY: -20,
    components: [
      { t: "platform", p: [0, -0.5, 0], s: [40, 1, 40] },
      { t: "gate", p: [0, 0.5, -12] },
    ],
  };

  const createFixture = (components = []) => {
    const scene = new THREE.Scene();
    const level = new Level(scene, {
      id: "ragdoll-recovery-test",
      name: levelData.name,
      data: { ...levelData, components: [...levelData.components, ...components] },
    });
    level.update(0);
    scene.updateMatrixWorld(true);
    const player = new Player(scene);
    if (player.special) {
      player.special.value = 0;
      player.special.step = () => {};
      player.special.award = () => false;
    }
    player.pos.set(0, 0, 0);
    player.prevPos.copy(player.pos);
    player.axisF.set(0, 0, -1);
    player.axisL.set(1, 0, 0);
    player.speed = 0;
    player.vVel = 0;
    player.state = "ride";
    player.grounded = true;
    player.groundHit = player.queryGround(level);
    assert.ok(player.groundHit, "fixture has no ground support");
    player.rideNormal.copy(player.groundHit.normal);
    player.syncVisual(makeInput(), 0);
    scene.updateMatrixWorld(true);
    const fixture = { scene, level, player };
    fixtures.push(fixture);
    return fixture;
  };

  // The rebound belongs to the actual support plane. Measure both retained
  // tangential velocity and normal restitution on flat/uphill/downhill banks;
  // no contact may add linear energy or consume gameplay RNG.
  const contactResponse = createFixture();
  const contactPlayer = contactResponse.player;
  assert.equal(contactPlayer.beginPvpKnockdown(0, 1), true);
  const contactRng = installRandomSequence(contactPlayer, []);
  for (const normal of [new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(.5, .866025403784, 0).normalize(),
    new THREE.Vector3(-.5, .866025403784, 0).normalize()]) {
    const incident = new THREE.Vector3(8, -12, -6);
    contactPlayer.axisF.set(incident.x, 0, incident.z).normalize();
    contactPlayer.speed = Math.hypot(incident.x, incident.z);
    contactPlayer.vVel = incident.y;
    contactPlayer.ragBounces = 0;
    assert.equal(contactPlayer.resolveRagdollGroundBounce({...contactPlayer.groundHit, normal}), true);
    const outgoing = contactPlayer.axisF.clone().multiplyScalar(contactPlayer.speed).setY(contactPlayer.vVel);
    closeTo(outgoing.dot(normal), -incident.dot(normal) * TUNING.ragBounce,
      "contact-normal restitution", 1e-6);
    const beforeTangent = incident.clone().addScaledVector(normal, -incident.dot(normal));
    const afterTangent = outgoing.clone().addScaledVector(normal, -outgoing.dot(normal));
    closeTo(afterTangent.distanceTo(beforeTangent.multiplyScalar(.72)), 0,
      "contact tangent drag", 1e-6);
    assert.ok(outgoing.lengthSq() <= incident.lengthSq(), "ground bounce added energy");
  }
  assert.equal(contactRng(), 0, "ground bounce consumed gameplay RNG");
  contactPlayer.axisF.set(1, 0, 0);contactPlayer.speed = 20;contactPlayer.vVel = -2;contactPlayer.ragBounces = 0;
  assert.equal(contactPlayer.resolveRagdollGroundBounce({...contactPlayer.groundHit,
    normal: new THREE.Vector3(.6, .8, 0)}), false, "separating bank contact bounced again");
  contactPlayer.axisF.set(0, 0, -1);contactPlayer.speed = 8;contactPlayer.vVel = -20;contactPlayer.ragBounces = 3;
  assert.equal(contactPlayer.resolveRagdollGroundBounce(contactPlayer.groundHit), false,
    "three-impact bounce budget was exceeded");

  // Rotating about the combined angular velocity has no sequential-axis
  // bias. One long advance and 12 subdivisions must describe the same arc.
  contactPlayer.axisF.set(.6, 0, -.8);contactPlayer.axisL.set(.8, 0, .6);
  contactPlayer.speed = 8;contactPlayer.ragAngVel.set(12, 7, -9);contactPlayer.ragQ.identity();
  contactPlayer.integrateRagdollRotation(.2);
  const oneStepRotation = contactPlayer.ragQ.clone();
  contactPlayer.ragQ.identity();
  for (let i = 0; i < 12; i++) contactPlayer.integrateRagdollRotation(.2 / 12);
  closeTo(Math.abs(contactPlayer.ragQ.dot(oneStepRotation)), 1, "subdivided angular integration", 1e-10);
  for (let i = 0; i < 6000; i++) contactPlayer.integrateRagdollRotation(CONST.fixedStep);
  closeTo(contactPlayer.ragQ.length(), 1, "long tumble quaternion drift", 1e-12);

  // The visible grounded body contacts geometry after all animated limbs and
  // elasticity are posed. Sparse support is bounded, uses no exact vertex
  // scan and cannot move the gameplay capsule or discarded board.
  const seated = createFixture();
  const seatedPlayer = seated.player;
  assert.equal(seatedPlayer.beginPvpKnockdown(0, 1), true);
  seatedPlayer.state = "ride";seatedPlayer.grounded = true;
  seatedPlayer.ragBlend = 1;seatedPlayer.ragAngVel.set(5, 3, 4);
  const exactClearance = seatedPlayer.interactionMeasure.minimumPlaneDistance.bind(seatedPlayer.interactionMeasure);
  seatedPlayer.interactionMeasure.minimumPlaneDistance = () => {throw new Error("bail scanned all vertices");};
  let maxContactSamples = 0;
  for (const normal of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(.35, .93675, 0).normalize()]) {
    seatedPlayer.groundHit = {...seatedPlayer.groundHit, normal};
    seatedPlayer.rideNormal.copy(normal);
    for (let frame = 0; frame < 24; frame++) {
      seatedPlayer.ragQ.setFromEuler(new THREE.Euler(frame * .21, frame * -.07, frame * .13));
      seatedPlayer.syncVisual(makeInput(), CONST.fixedStep);
      const positionBefore = seatedPlayer.pos.clone();
      seatedPlayer.seatBailOnGround(CONST.fixedStep);
      maxContactSamples = Math.max(maxContactSamples, seatedPlayer.interactionMeasure.supportSamples);
      const clearance = exactClearance(seatedPlayer.riderG, normal,
        new THREE.Vector3(seatedPlayer.pos.x, seatedPlayer.groundHit.y, seatedPlayer.pos.z));
      assert.ok(clearance >= -.012, `supported tumble clips ground by ${-clearance}m`);
      assert.equal(seatedPlayer.pos.distanceTo(positionBefore), 0, "presentation contact moved collision");
    }
  }
  assert.ok(maxContactSamples > 0 && maxContactSamples < 12000,
    `bail support escaped its cached sparse probe budget (${maxContactSamples})`);
  const seatedBounds = new THREE.Box3(), seatedReference = new THREE.Box3();
  for (const progress of [0, .15, .3, .5, .8, .95]) {
    seatedPlayer.bailRecoveryPose = progress;
    seatedPlayer.bailRecoverT = progress > 0 ? progress * .72 : -1;
    seatedPlayer.finishVisualStep(makeInput(), CONST.fixedStep);
    seatedBounds.copy(seatedPlayer.characterBounds);
    seated.scene.updateMatrixWorld(true);
    seatedPlayer.interactionMeasure.measure(seatedPlayer.riderG, seatedReference);
    closeTo(seatedBounds.min.distanceTo(seatedReference.min), 0, "translated seated lower bounds", 1e-8);
    closeTo(seatedBounds.max.distanceTo(seatedReference.max), 0, "translated seated upper bounds", 1e-8);
    const planePoint = new THREE.Vector3(seatedPlayer.pos.x, seatedPlayer.groundHit.y, seatedPlayer.pos.z);
    const planeNormal = seatedPlayer.groundHit.normal, fastContact = new THREE.Vector3(), referenceContact = new THREE.Vector3();
    const fastPlane = seatedPlayer.interactionMeasure.sampledPlaneDistance(seatedPlayer.riderG, planeNormal,
      planePoint, fastContact, undefined, true);
    const referencePlane = seatedPlayer.interactionMeasure.sampledPlaneDistance(seatedPlayer.riderG, planeNormal,
      planePoint, referenceContact, new THREE.Box3());
    closeTo(fastPlane, referencePlane, "pruned posed-skin support distance", 1e-9);
    closeTo(fastContact.distanceTo(referenceContact), 0, "pruned posed-skin support point", 1e-9);
  }
  seatedPlayer.grounded = false;seatedPlayer.seatBailOnGround(CONST.fixedStep);
  assert.equal(seatedPlayer.bailSupportOffset, 0, "lost support retained floor correction");

  const createFirstImpact = ({ input = makeInput() } = {}) => {
    const fixture = createFixture();
    const { player, level } = fixture;
    assert.equal(player.beginPvpKnockdown(0, 1), true, "failed to arm knockdown");
    player.pos.set(0, 0.04, 0);
    player.prevPos.copy(player.pos);
    player.vVel = -8;
    player.speed = 0;
    player.state = "air";
    player.grounded = false;
    const getDraws = installRandomSequence(player, [0, 0.5, 0.5, 0.5]);
    player.step(CONST.fixedStep, input, level);
    level.update(CONST.fixedStep);
    return { ...fixture, input, getDraws };
  };

  // Held direction owns the airborne rescue trajectory even before the first
  // impact. It is deterministic and consumes no flaky-input RNG; the physical
  // contact still arms exactly one extra post-impact fish-jump/steer pulse.
  const impactInput = makeInput({ jumpPressed: true, moveX: 1 });
  const armed = createFirstImpact({ input: impactInput });
  assert.equal(armed.player.ragdollImpactCount, 1, "first contact did not arm input");
  assert.equal(armed.player.ragdollFishJumps, 0, "pre-impact X produced a fish jump");
  assert.equal(armed.getDraws(), 0, "pre-impact input consumed gameplay RNG");
  assert.ok(armed.player.axisF.x > 0.99, "pre-impact rescue steering missed screen-right");
  closeTo(armed.player.axisF.z, 0, "pre-impact rescue steering kept stale forward heading");
  impactInput.consumeEdges();
  const heldThroughImpact = makeInput({ moveX: 1 });
  armed.player.rawInput = heldThroughImpact;
  const headingBeforeHeldPulse = armed.player.axisF.clone();
  const heldSteerDraws = installRandomSequence(armed.player, [0, 0.5, 0.5, 0.5]);
  armed.player.stepRagdollFlailInput(heldThroughImpact, armed.level);
  assert.equal(heldSteerDraws(), 0, "held-through-impact stick spent a steer roll");
  closeTo(
    armed.player.axisF.distanceTo(headingBeforeHeldPulse),
    0,
    "held-through-impact stick spent the extra flaky pulse",
  );
  armed.player.rawInput = makeInput();
  armed.player.stepRagdollFlailInput(armed.player.rawInput, armed.level);

  // A bail created by the contact itself skips the already-bailing pre-impact
  // input pass. Impact recording must still latch the held stick so the next
  // frame cannot masquerade it as a fresh steering pulse.
  const contactCreated = createFixture();
  const contactHeld = makeInput({ moveX: 1 });
  contactCreated.player.rawInput = contactHeld;
  assert.equal(contactCreated.player.beginPvpKnockdown(0, 1), true);
  contactCreated.player.noteRagdollGroundImpact();
  const contactSteerDraws = installRandomSequence(
    contactCreated.player,
    [0, 0.5, 0.5, 0.5],
  );
  contactCreated.player.stepRagdollFlailInput(contactHeld, contactCreated.level);
  assert.equal(contactSteerDraws(), 0, "contact-created bail accepted held steering");

  // Forced success: the next fresh X edge after impact gains upward velocity.
  TUNING.ragFlailJumpChance = 1;
  const successBeforeVy = armed.player.vVel;
  const successInput = makeInput({ jumpPressed: true });
  const successDraws = installRandomSequence(armed.player, [0.2, 0.5]);
  armed.player.step(CONST.fixedStep, successInput, armed.level);
  armed.level.update(CONST.fixedStep);
  assert.equal(armed.player.ragdollFishJumps, 1, "forced fish jump did not succeed");
  assert.ok(armed.player.vVel > successBeforeVy, "fish jump did not add upward speed");
  assert.ok(armed.player.vVel <= 10, "fish jump exceeded its vertical cap");
  assert.equal(successDraws(), 2, "successful fish jump used the wrong RNG budget");

  // Forced failure consumes the impact's one attempt. Raising the chance and
  // pressing again before another impact cannot reroll it.
  const failed = createFirstImpact();
  failed.input.consumeEdges();
  TUNING.ragFlailJumpChance = 0;
  const failureInput = makeInput({ jumpPressed: true });
  failed.player.rawInput = failureInput;
  const failureDraws = installRandomSequence(failed.player, [0]);
  const failureVy = failed.player.vVel;
  failed.player.stepRagdollFlailInput(failureInput, failed.level);
  assert.equal(failed.player.ragdollFishJumps, 0, "zero-chance fish jump succeeded");
  closeTo(failed.player.vVel, failureVy, "failed fish jump changed vertical speed");
  assert.equal(failureDraws(), 0, "zero chance consumed shared gameplay RNG");
  TUNING.ragFlailJumpChance = 1;
  const noRerollDraws = installRandomSequence(failed.player, [0, 0.5]);
  failed.player.stepRagdollFlailInput(failureInput, failed.level);
  assert.equal(failed.player.ragdollFishJumps, 0, "same impact rerolled a failed jump");
  assert.equal(noRerollDraws(), 0, "same impact consumed RNG twice");

  // A successful direction pulse responds in the requested screen-right
  // direction, keeps an orthonormal travel frame, and cannot increase a speed
  // that already exceeds downhillMax. That impact cannot steer twice.
  const steered = createFirstImpact();
  TUNING.ragFlailSteerChance = 1;
  TUNING.ragFlailSteerJitter = 0;
  steered.player.axisF.set(0, 0, -1);
  steered.player.axisL.set(1, 0, 0);
  steered.player.speed = TUNING.downhillMax + 5;
  const steerInput = makeInput({ moveX: 1 });
  steered.player.rawInput = steerInput;
  const steerDraws = installRandomSequence(steered.player, [0, 0.5, 0.9, 0.9]);
  const speedCap = steered.player.speed;
  steered.player.stepRagdollFlailInput(steerInput, steered.level);
  assert.equal(steerDraws(), 4, "successful steering used the wrong RNG budget");
  assert.ok(steered.player.axisF.x > 0.1, "steer pulse did not turn screen-right");
  assert.ok(steered.player.axisF.z < -0.1, "steer pulse discarded all forward carry");
  assert.ok(steered.player.speed <= speedCap + 1e-9, "steer pulse exceeded its speed cap");
  closeTo(steered.player.axisF.length(), 1, "steered forward axis is not unit length");
  closeTo(steered.player.axisL.length(), 1, "steered lateral axis is not unit length");
  closeTo(steered.player.axisF.dot(steered.player.axisL), 0, "steered axes are not perpendicular");
  const headingAfterFirstSteer = steered.player.axisF.clone();
  const speedAfterFirstSteer = steered.player.speed;
  const secondSteerInput = makeInput({ moveX: -1 });
  steered.player.rawInput = secondSteerInput;
  const secondSteerDraws = installRandomSequence(steered.player, [0, 0.5, 0.9, 0.9]);
  steered.player.stepRagdollFlailInput(secondSteerInput, steered.level);
  assert.equal(secondSteerDraws(), 0, "same impact rerolled steering");
  closeTo(steered.player.axisF.distanceTo(headingAfterFirstSteer), 0, "same impact steered twice");
  closeTo(steered.player.speed, speedAfterFirstSteer, "same impact changed speed twice");

  // Two successful fish jumps exhaust the lifetime budget. A third actual
  // contact may arm other flail behavior, but must not draw or launch again.
  const capped = createFirstImpact();
  TUNING.ragFlailJumpChance = 1;
  const jumpOnce = makeInput({ jumpPressed: true });
  capped.player.rawInput = jumpOnce;
  installRandomSequence(capped.player, [0, 0.5]);
  capped.player.stepRagdollFlailInput(jumpOnce, capped.level);
  assert.equal(capped.player.ragdollFishJumps, 1);
  capped.player.noteRagdollGroundImpact();
  const jumpTwice = makeInput({ jumpPressed: true });
  capped.player.rawInput = jumpTwice;
  installRandomSequence(capped.player, [0, 0.5]);
  capped.player.stepRagdollFlailInput(jumpTwice, capped.level);
  assert.equal(capped.player.ragdollFishJumps, 2);
  capped.player.noteRagdollGroundImpact();
  const jumpThrice = makeInput({ jumpPressed: true });
  capped.player.rawInput = jumpThrice;
  const thirdJumpDraws = installRandomSequence(capped.player, [0, 0.5]);
  const cappedVy = capped.player.vVel;
  capped.player.stepRagdollFlailInput(jumpThrice, capped.level);
  assert.equal(capped.player.ragdollFishJumps, 2, "fish-jump cap was bypassed");
  assert.equal(thirdJumpDraws(), 0, "exhausted fish jump consumed RNG");
  closeTo(capped.player.vVel, cappedVy, "exhausted fish jump changed velocity");

  // Once procedural recovery owns the body, neither X nor direction may steal
  // it back, even if ragActive is deliberately left true for this guard test.
  const recovering = createFirstImpact();
  recovering.player.bailRecoverT = 0.2;
  recovering.player.bailRecoveryPose = 0.25;
  recovering.player.ragActive = true;
  const recoverInput = makeInput({ jumpPressed: true, moveX: 1 });
  recovering.player.rawInput = recoverInput;
  const recoveryDraws = installRandomSequence(recovering.player, [0, 0.5, 0.5, 0.5]);
  const recoverHeading = recovering.player.axisF.clone();
  const recoverVy = recovering.player.vVel;
  recovering.player.stepRagdollFlailInput(recoverInput, recovering.level);
  assert.equal(recoveryDraws(), 0, "procedural recovery rolled flail RNG");
  assert.equal(recovering.player.ragdollFishJumps, 0, "recovery accepted a fish jump");
  closeTo(recovering.player.axisF.distanceTo(recoverHeading), 0, "recovery accepted steering");
  closeTo(recovering.player.vVel, recoverVy, "recovery changed vertical speed");

  // If support disappears halfway through the roll, the renewed ragdoll owns
  // the exact visible rider orientation AND waist point. Capturing only the
  // quaternion leaves the metre-scale recovery root correction behind.
  const interrupted = createFixture();
  assert.equal(interrupted.player.beginPvpKnockdown(0, 1), true);
  interrupted.player.state = "ride";
  interrupted.player.grounded = true;
  interrupted.player.groundHit = interrupted.player.queryGround(interrupted.level);
  interrupted.player.rideNormal.copy(interrupted.player.groundHit.normal);
  interrupted.player.bailDownT = 0.5;
  interrupted.player.bailRecoverDuration = 0.72;
  interrupted.player.bailRecoverT = 0.36;
  interrupted.player.bailRecoveryPose = 0.5;
  interrupted.player.ragActive = false;
  interrupted.player.ragBlend = 0;
  interrupted.player.syncVisual(makeInput(), CONST.fixedStep);
  interrupted.scene.updateMatrixWorld(true);
  const waistBeforeLoss = new THREE.Vector3(0, 0.82, 0).applyMatrix4(
    interrupted.player.riderG.matrixWorld,
  );
  interrupted.player.state = "air";
  interrupted.player.grounded = false;
  interrupted.player.groundHit = null;
  interrupted.player.vVel = 1;
  interrupted.player.step(CONST.fixedStep, makeInput(), interrupted.level);
  interrupted.scene.updateMatrixWorld(true);
  const waistAfterLoss = new THREE.Vector3(0, 0.82, 0).applyMatrix4(
    interrupted.player.riderG.matrixWorld,
  );
  const supportLossDelta = waistAfterLoss.distanceTo(waistBeforeLoss);
  assert.ok(
    supportLossDelta < 0.25,
    `support loss dropped the recovery root trajectory (${supportLossDelta}; before=${waistBeforeLoss.toArray()}; after=${waistAfterLoss.toArray()}; anchor=${interrupted.player.ragPoseAnchor.toArray()}; anchorW=${interrupted.player.ragPoseAnchorW}; body=${interrupted.player.bodyGroup.position.toArray()})`,
  );

  // Full fixed-step integration: a supported knockdown with completely neutral
  // input starts recovery, rolls forward, and hands genuine forward velocity
  // and displacement into the ordinary running state.
  const runOut = createFixture();
  // The roll must close its waist-pivot offset before the later Idle/Walk
  // sole correction seats the upright rider. A seated walk no longer has a
  // zero rider-root translation, so do not conflate those two pose layers.
  const recoveryRootBeforeSeating = new THREE.Vector3();
  const seatOnFoot = runOut.player.seatOnFoot.bind(runOut.player);
  runOut.player.seatOnFoot = () => {
    recoveryRootBeforeSeating.copy(runOut.player.riderG.position);
    seatOnFoot();
  };
  const neutral = makeInput();
  assert.equal(runOut.player.beginPvpKnockdown(0, 1), true);
  runOut.player.state = "ride";
  runOut.player.grounded = true;
  runOut.player.vVel = 0;
  runOut.player.pos.set(0, 0, 0);
  runOut.player.prevPos.copy(runOut.player.pos);
  runOut.player.axisF.set(0, 0, -1);
  runOut.player.axisL.set(1, 0, 0);
  runOut.player.speed = 0;
  runOut.player.groundHit = runOut.player.queryGround(runOut.level);
  assert.ok(runOut.player.groundHit);
  runOut.player.rideNormal.copy(runOut.player.groundHit.normal);
  const startZ = runOut.player.pos.z;
  let observedRecovery = false;
  let peakRecoverySpeed = 0;
  let recoveryEntryOffset = null;
  let peakRiderOffset = 0;
  for (let step = 0; step < 120 && runOut.player.bailTimeLeft > 0; step++) {
    assert.equal(neutral.moveX, 0);
    assert.equal(neutral.moveY, 0);
    assert.equal(neutral.jumpPressed, false);
    runOut.player.step(CONST.fixedStep, neutral, runOut.level);
    runOut.level.update(CONST.fixedStep);
    neutral.consumeEdges();
    if (!observedRecovery && runOut.player.bailRecoveryK > 0) {
      observedRecovery = true;
      recoveryEntryOffset = runOut.player.riderG.position.length();
    }
    peakRiderOffset = Math.max(peakRiderOffset, runOut.player.riderG.position.length());
    peakRecoverySpeed = Math.max(peakRecoverySpeed, Math.abs(runOut.player.speed));
  }
  assert.equal(runOut.player.bailTimeLeft, 0, "neutral recovery did not finish");
  assert.equal(observedRecovery, true, "neutral recovery never entered the roll phase");
  assert.ok(recoveryEntryOffset < 0.3, "recovery root teleported at roll entry");
  assert.ok(peakRiderOffset > 0.2, "recovery never moved around its waist pivot");
  assert.ok(recoveryRootBeforeSeating.length() < 0.12, "recovery root did not close at 2pi");
  assert.ok(peakRecoverySpeed > 0.5, "neutral recovery never generated run-out speed");
  assert.ok(runOut.player.pos.z < startZ - 0.1, "neutral recovery stayed anchored at its feet");
  assert.ok(runOut.player.walkVelocity.z < -0.1, "recovery did not hand forward carry to walking");
  assert.ok(runOut.player.speed > 0.1, "recovery ended without forward run speed");

  // A wall-style rebound may be represented as negative speed on its old
  // approach axis. Recovery must canonicalize that exact velocity before its
  // automatic drive, or the roll turns around and runs back into the wall.
  const rebound = createFixture();
  assert.equal(rebound.player.beginPvpKnockdown(0, 1), true);
  rebound.player.state = "ride";
  rebound.player.grounded = true;
  rebound.player.groundHit = rebound.player.queryGround(rebound.level);
  rebound.player.rideNormal.copy(rebound.player.groundHit.normal);
  rebound.player.axisF.set(0, 0, -1);
  rebound.player.axisL.set(1, 0, 0);
  rebound.player.speed = -4;
  rebound.player.bailDownT = 0.7;
  rebound.player.bailGroundT = 0.12;
  rebound.player.step(CONST.fixedStep, makeInput(), rebound.level);
  assert.ok(rebound.player.bailRecoveryK > 0, "rebound did not start recovery");
  assert.ok(rebound.player.speed >= 0, "rebound recovery kept negative speed");
  assert.ok(rebound.player.axisF.z > 0.9, "rebound recovery reversed toward the obstacle");

  const { softSkateRebound, sampleSoftSkateImpact, SOFT_SKATE_IMPACT_SECONDS } = await server.ssrLoadModule('/src/skateImpact.ts');
  for (const [vx,vz,nx,nz] of [[0,-8,0,1],[8,0,-1,0],[-8,0,1,0],[5,-2,0,1],[0,-.2,0,1]]) {
    const response=softSkateRebound(vx,vz,nx,nz);
    assert.ok(response);
    assert.ok(response.x*nx+response.z*nz>0,'soft contact did not rebound outward');
    const ratio=Math.hypot(response.x,response.z)/Math.hypot(vx,vz);
    assert.ok(ratio>=.45-1e-8&&ratio<=.97+1e-8,'soft contact created energy or discarded all motion');
  }
  assert.equal(softSkateRebound(0,8,0,1),null,'moving away retriggered impact');
  assert.equal(softSkateRebound(0,0,0,1),null);
  assert.equal(softSkateRebound(0,-8,0,0),null);
  assert.deepEqual(sampleSoftSkateImpact(0),{brace:0,wobble:0});
  assert.deepEqual(sampleSoftSkateImpact(SOFT_SKATE_IMPACT_SECONDS),{brace:0,wobble:0});
  assert.ok(sampleSoftSkateImpact(.25).brace>.5,'impact pose has no readable brace');

  const wall={t:'wall',p:[0,0,-2],s:[10,3,.4]};
  const soft=createFixture([wall]);
  soft.player.freeSkate=true;soft.player.speed=8;
  for(let frame=0;frame<90&&soft.player.softSkateImpactT<=0;frame++)soft.player.step(CONST.fixedStep,makeInput({moveY:1}),soft.level);
  assert.ok(soft.player.softSkateImpactT>0,'real low-speed wall collision missed the soft response');
  assert.equal(soft.player.isBailing,false);assert.equal(soft.player.boardRolling,true);
  assert.ok(soft.player.speed>0&&soft.player.axisF.z>0,'wall did not leave outward skating velocity');
  const afterImpact=soft.player.pos.clone();
  for(let frame=0;frame<15;frame++)soft.player.step(CONST.fixedStep,makeInput({moveY:1}),soft.level);
  assert.equal(soft.player.boardRolling,true,'held approach input auto-dismounted after the bump');
  assert.ok(soft.player.pos.z>afterImpact.z+.1,'rider did not actually roll away');
  assert.equal(soft.player.flyBoard?.visible??false,false,'soft impact discarded the board');
  for(let frame=0;frame<180;frame++)soft.player.step(CONST.fixedStep,makeInput({grabHeld:true}),soft.level);
  assert.equal(soft.player.boardRolling,false,'impact grace prevented an intentional brake/dismount');

  const fast=createFixture([wall]);fast.player.freeSkate=true;fast.player.speed=TUNING.wallBailSpeed+5;
  for(let frame=0;frame<90&&!fast.player.isBailing;frame++)fast.player.step(CONST.fixedStep,makeInput(),fast.level);
  assert.equal(fast.player.isBailing,true,'high-speed wall bail was replaced with a soft hit');
  assert.equal(fast.player.softSkateImpactT,0);

  const foot=createFixture([wall]);
  for(let frame=0;frame<60;frame++)foot.player.step(CONST.fixedStep,makeInput({moveY:1}),foot.level);
  assert.equal(foot.player.boardRolling,false);assert.equal(foot.player.softSkateImpactT,0,'walking acquired a skate rebound');

  const repair=createFixture();repair.player.freeSkate=true;repair.player.speed=8;
  assert.equal(repair.player.pushOutOf(new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,3,1))),true);
  assert.equal(repair.player.speed,8);assert.equal(repair.player.softSkateImpactT,0,'start-inside repair became a collision impulse');

  const crawlSpeed = createFixture();
  crawlSpeed.player.freeSkate = true;
  crawlSpeed.player.speed = 0.11;
  crawlSpeed.player.rawInput = makeInput();
  assert.equal(crawlSpeed.player.softSkateImpact(0, 1, 0.11), true);
  for (let frame = 0; frame < 15; frame++) crawlSpeed.player.step(CONST.fixedStep, makeInput(), crawlSpeed.level);
  assert.equal(crawlSpeed.player.boardRolling, true, 'near-stop impact dismounted during its recovery');
  assert.ok(crawlSpeed.player.speed > 0 && crawlSpeed.player.pos.z > 0, 'near-stop rebound lost all motion');

  for (const component of [
    {t:'wallpath',p:[0,0,-2],pts:[[-5,0,0],[5,0,0]],w:.4,rise:3},
    {t:'rail',p:[0,.7,-2],len:10,yaw:90},
  ]) {
    const f=createFixture([component]);f.player.freeSkate=true;f.player.speed=8;
    for(let frame=0;frame<90&&f.player.softSkateImpactT<=0;frame++)f.player.step(CONST.fixedStep,makeInput({moveY:1}),f.level);
    assert.ok(f.player.softSkateImpactT>0,component.t+' skipped soft impact');
    assert.equal(f.player.boardRolling,true);assert.equal(f.player.isBailing,false);
    f.player.respawn(f.level,true);assert.equal(f.player.softSkateImpactT,0,'respawn retained impact state');
  }

  console.log(
    `Validated slope-normal bounces, finite tumble/contact (${maxContactSamples} sparse probes), ragdoll recovery, soft skating rebounds, mounted run-out, braking, and high-speed bails.`,
  );
} finally {
  restoreTuning?.();
  for (const { level } of fixtures) level.dispose();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
