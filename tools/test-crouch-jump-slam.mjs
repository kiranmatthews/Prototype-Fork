import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createServer } from "vite";

const noop = () => {};

function installHeadlessDom() {
  const storage = new Map();
  const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
  const makeElement = (tag = "div") => ({
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
    ...makeElement("canvas"), width: 1, height: 1,
    getContext() { context.canvas = this; return context; },
  });
  globalThis.document = {
    body: makeElement("body"), fonts: null,
    createElement(tag) { return tag === "canvas" ? makeCanvas() : makeElement(tag); },
    createElementNS(_namespace, tag) { return this.createElement(tag); },
  };
  globalThis.window = {
    location: { search: "?lite", href: "http://headless.invalid/?lite" },
    addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1,
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => [] },
  });
  globalThis.Image = class HeadlessImage {
    addEventListener(type, callback) { if (type === "error") queueMicrotask(callback); }
    removeEventListener() {}
    set src(_value) { queueMicrotask(() => this.onerror?.(new Error("headless image"))); }
  };
  const NativeRequest = globalThis.Request;
  globalThis.Request = class HeadlessRequest extends NativeRequest {
    constructor(input, init) {
      super(typeof input === "string" && input.startsWith("/")
        ? `http://headless.invalid${input}` : input, init);
    }
  };
  globalThis.fetch = async () => new Response("", { status: 404 });
}

const held = ["jumpHeld", "grindHeld", "spinHeld", "grabHeld", "transferHeld"];
const edges = ["jumpPressed", "jumpReleased", "grindPressed", "spinPressed", "grabPressed", "restartPressed", "transferPressed"];
function makeInput(overrides = {}) {
  const input = { moveX: 0, moveY: 0 };
  for (const key of [...held, ...edges]) input[key] = false;
  Object.assign(input, overrides);
  input.consumeEdges = () => { for (const key of edges) input[key] = false; };
  return input;
}

function closeTo(actual, expected, message, tolerance = 1e-4) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

const flatLevelData = {
  v: 1,
  name: "Crouch jump slam guard",
  spawn: [0, 0.02, 0],
  killY: -20,
  components: [
    { t: "platform", p: [0, -0.5, 0], s: [20, 1, 20] },
    { t: "gate", p: [0, 0, -8] },
  ],
  groups: [],
};

installHeadlessDom();
const server = await createServer({ logLevel: "silent", server: { middlewareMode: true } });
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ""));
console.warn = (...args) => { if (!expectedAssetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!expectedAssetLog(args[0])) originalError(...args); };

const fixtures = [];
try {
  const { Level, findLevel } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { Replayer } = await server.ssrLoadModule("/src/replay.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");
  const {
    RigBinding,
    FORWARD_ROLL_TUCK_INPUT,
    UNITY_CROUCH_CRAWL_CLIP_IDS,
    UNITY_SLAM_ANTICIPATION_POSE_DEGREES,
    UNITY_SLAM_FALL_POSE_DEGREES,
    createPlayerStarterAnimationSuite,
    parseAnimationSuite,
    reconcilePlayerStarterAnimationSuite,
    sampleForwardRollPresentation,
  } = await server.ssrLoadModule("/src/animation/index.ts");
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule(
    "/src/characterAnimationRuntime.ts",
  );
  const dt = CONST.fixedStep;

  const level = new Level(new THREE.Scene(), {
    id: "crouch-jump-slam-guard",
    name: flatLevelData.name,
    data: flatLevelData,
  });
  const player = new Player(level.scene);
  player.enterLevel("crouch-jump-slam-guard");
  player.respawn(level, true);
  fixtures.push(level);

  const tick = (input) => {
    player.step(dt, input, level);
    level.update(dt);
    input.consumeEdges();
  };
  tick(makeInput());
  assert.equal(player.state, "ride");
  assert.equal(player.grounded, true);

  tick(makeInput({ grabHeld: true, grabPressed: true }));
  assert.equal(player.crawling, true, "grounded Circle press did not enter crouch");
  tick(makeInput({ grabHeld: true }));
  tick(makeInput({ grabHeld: true, jumpHeld: true, jumpPressed: true }));
  for (let frame = 0; frame < 7; frame++)
    tick(makeInput({ grabHeld: true, jumpHeld: true }));
  tick(makeInput({ grabHeld: true, jumpReleased: true }));

  assert.equal(player.state, "air", "crouch charge did not launch");
  assert.equal(player.lastJumpType, "Crouch Jump");
  assert.ok(player.vVel > TUNING.jumpMinVelocity, "crouch jump lost its height boost");
  assert.equal(player.slamActive, false, "launch tick was already classified as a body slam");

  const launchVelocity = player.vVel;
  tick(makeInput({ grabHeld: true }));
  assert.equal(player.state, "air", "inherited crouch hold cancelled the jump before it left the floor");
  assert.equal(player.slamActive, false, "ground-originated Circle hold became a body slam in air");
  assert.equal(player.slamFlatT, 0, "ground-originated Circle hold registered a body-slam impact");
  assert.ok(player.pos.y > 0, "crouch jump did not leave the floor on its first air tick");
  assert.ok(player.starTimer > 0, "crouch jump lost its boosted star-pose identity");
  assert.ok(player.vVel > 0 && player.vVel < launchVelocity, "crouch jump did not continue its rising arc");

  tick(makeInput());
  tick(makeInput({ grabHeld: true, grabPressed: true }));
  assert.equal(player.slamActive, true, "a fresh airborne Circle press no longer starts body slam");

  const boardPlayer = new Player(level.scene);
  const boardAnimationBinding = RigBinding.fromSculptRuntime(
    boardPlayer.animationRig.root,
    { strict: false },
  );
  const oldAirborneClips = JSON.parse(await readFile(new URL(
    "./fixtures/player-airborne-catalog-v6.json",
    import.meta.url,
  ), "utf8"));
  const oldAirborneById = new Map(oldAirborneClips.map((clip) => [clip.id, clip]));
  const currentLiveSuite = createPlayerStarterAnimationSuite(boardAnimationBinding.definition);
  const normalizedLiveV7Draft = parseAnimationSuite({
    ...currentLiveSuite,
    clips: currentLiveSuite.clips.map((clip) => oldAirborneById.get(clip.id) ?? clip),
    metadata: { ...currentLiveSuite.metadata, playerStarterCatalogVersion: 7 },
  });
  const upgradedLiveDraft = reconcilePlayerStarterAnimationSuite(
    normalizedLiveV7Draft,
    boardAnimationBinding.definition,
  );
  for (const clipId of ["player.jump", "player.double-jump", "player.fall"]) {
    assert.equal(
      upgradedLiveDraft.clips.find((clip) => clip.id === clipId)?.metadata.progressSource,
      "gameplay-actionProgress",
      `live saved ${clipId} did not migrate to phase timing`,
    );
  }
  assert.equal(
    upgradedLiveDraft.clips.find((clip) => clip.id === "player.land")?.metadata.deformationArc,
    "neutral fall -> cushion squash -> rebound -> settle",
    "live saved landing clip did not migrate to the cushion arc",
  );
  const oldForwardRollClips = JSON.parse(await readFile(new URL(
    "./fixtures/player-forward-roll-catalog-v8.json",
    import.meta.url,
  ), "utf8"));
  const oldForwardRollById = new Map(oldForwardRollClips.map((clip) => [clip.id, clip]));
  const normalizedLiveV8Draft = parseAnimationSuite({
    ...currentLiveSuite,
    clips: currentLiveSuite.clips.map((clip) => oldForwardRollById.get(clip.id) ?? clip),
    metadata: { ...currentLiveSuite.metadata, playerStarterCatalogVersion: 8 },
  });
  const upgradedForwardRollDraft = reconcilePlayerStarterAnimationSuite(
    normalizedLiveV8Draft,
    boardAnimationBinding.definition,
  );
  for (const clipId of ["player.jump", "player.fall"]) {
    const clip = upgradedForwardRollDraft.clips.find((candidate) => candidate.id === clipId);
    assert.equal(clip?.proceduralOrder, "keyed-then-procedural");
    assert.equal(clip?.proceduralDrivers.filter((driver) =>
      driver.source === FORWARD_ROLL_TUCK_INPUT).length, 9,
      `live saved ${clipId} did not migrate its forward-roll squash layer`);
  }
  closeTo(
    sampleForwardRollPresentation(
      CONST.flipDuration * (1 - 0.475),
      CONST.flipDuration,
    ).tuck,
    1,
    "forward-roll clock did not peak at the inverted ball frame",
  );
  const oldLowPoseClips = JSON.parse(await readFile(new URL(
    "./fixtures/player-crouch-crawl-catalog-v10.json",
    import.meta.url,
  ), "utf8"));
  const oldLowPoseById = new Map(oldLowPoseClips.map((clip) => [clip.id, clip]));
  const normalizedLiveV10LowPoseDraft = parseAnimationSuite({
    ...currentLiveSuite,
    clips: currentLiveSuite.clips.map((clip) => oldLowPoseById.get(clip.id) ?? clip),
    metadata: { ...currentLiveSuite.metadata, playerStarterCatalogVersion: 10 },
  });
  const upgradedLiveLowPoses = reconcilePlayerStarterAnimationSuite(
    normalizedLiveV10LowPoseDraft,
    boardAnimationBinding.definition,
  );
  assert.equal(upgradedLiveLowPoses.clips.find((clip) =>
    clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crouch)?.name,
    "Crouch Idle — Unity PunkyFox");
  assert.equal(upgradedLiveLowPoses.clips.find((clip) =>
    clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl)?.name,
    "Crawl — Unity PunkyFox");

  const lowPosePlayer = new Player(level.scene);
  lowPosePlayer.enterLevel("crouch-jump-slam-guard");
  lowPosePlayer.respawn(level, true);
  const lowPoseBinding = RigBinding.fromSculptRuntime(
    lowPosePlayer.animationRig.root,
    { strict: false },
  );
  const lowPoseRuntime = createCharacterAnimationRuntime(
    lowPosePlayer,
    createPlayerStarterAnimationSuite(lowPoseBinding.definition),
  );
  const tickLowPose = (input) => {
    lowPosePlayer.step(dt, input, level);
    level.update(dt);
    input.consumeEdges();
  };
  tickLowPose(makeInput());
  assert.equal(lowPoseRuntime.activeClipId, "player.idle");
  tickLowPose(makeInput({ grabHeld: true, grabPressed: true }));
  assert.equal(lowPosePlayer.animationClipHint, UNITY_CROUCH_CRAWL_CLIP_IDS.crouch);
  assert.equal(lowPoseRuntime.activeClipId, UNITY_CROUCH_CRAWL_CLIP_IDS.crouch);
  closeTo(lowPoseRuntime.diagnostics.transitionBlendWeight, 0,
    "standing-to-crouch did not begin Unity's rapid blend");
  lowPosePlayer.syncVisual(makeInput({ grabHeld: true }), 5 / 60);
  closeTo(lowPoseRuntime.diagnostics.transitionBlendWeight, 1,
    "standing-to-crouch did not finish Unity's five-frame blend");
  closeTo(lowPosePlayer.bodyGroup.rotation.x, 0,
    "legacy outer crawl pitch stacked onto the Unity crouch clip");
  closeTo(lowPosePlayer.bodyGroup.position.y, 0,
    "legacy outer crawl drop stacked onto the Unity crouch clip");
  closeTo(lowPosePlayer.bodyGroup.scale.y, 1.36,
    "legacy whole-body crawl compression stacked onto the Unity crouch clip");

  // The production controller zeros walkVelocity while crawling and keeps
  // forward-only speed at zero for a pure sideways crawl. Let two real fixed
  // steps generate lastPlanar from displacement instead of injecting velocity.
  // A large residual slidePose reproduces the slide->held-Circle handoff: the
  // actual crawl state must win immediately over that decaying visual tail.
  lowPosePlayer.slidePose = 1;
  tickLowPose(makeInput({ grabHeld: true, moveX: 1 }));
  tickLowPose(makeInput({ grabHeld: true, moveX: 1 }));
  assert.equal(lowPosePlayer.walkVelocity.length(), 0,
    "crawl fixture unexpectedly retained walkVelocity");
  closeTo(lowPosePlayer.speed, 0,
    "pure lateral crawl unexpectedly wrote forward speed");
  assert.ok(lowPosePlayer.slidePose > 0.25,
    "slide->crawl fixture lost the residual slide presentation state");
  assert.equal(lowPosePlayer.animationClipHint, UNITY_CROUCH_CRAWL_CLIP_IDS.crawl,
    "pure lateral measured movement did not select Unity Crawl");
  assert.equal(lowPoseRuntime.activeClipId, UNITY_CROUCH_CRAWL_CLIP_IDS.crawl);
  closeTo(lowPoseRuntime.diagnostics.transitionBlendWeight, 0,
    "crouch-to-crawl did not begin Unity's rapid blend");
  lowPosePlayer.syncVisual(makeInput({ moveX: 1 }), 5 / 60);
  closeTo(lowPoseRuntime.diagnostics.transitionBlendWeight, 1,
    "crouch-to-crawl did not finish Unity's five-frame blend");

  // A preserved v10 low-pose clip has no source-ownership marker and was
  // authored against the former parent drop/pitch/compression. It must retain
  // that composition instead of inheriting the Unity clip's neutral parent.
  lowPoseRuntime.dispose();
  const legacyLowPosePlayer = new Player(level.scene);
  legacyLowPosePlayer.respawn(level, true);
  const legacyLowPoseBinding = RigBinding.fromSculptRuntime(
    legacyLowPosePlayer.animationRig.root,
    { strict: false },
  );
  const legacyLowPoseRuntime = createCharacterAnimationRuntime(
    legacyLowPosePlayer,
    {
      ...normalizedLiveV10LowPoseDraft,
      rig: legacyLowPoseBinding.definition,
      clips: normalizedLiveV10LowPoseDraft.clips.map((clip) => ({
        ...clip,
        rigId: legacyLowPoseBinding.definition.id,
      })),
    },
  );
  legacyLowPosePlayer.crawling = true;
  legacyLowPosePlayer.crawlPose = 1;
  legacyLowPosePlayer.speed = 0;
  legacyLowPosePlayer.walkVelocity.set(0, 0, 0);
  legacyLowPosePlayer.syncVisual(makeInput({ grabHeld: true }), dt);
  closeTo(legacyLowPosePlayer.bodyGroup.rotation.x, 0.16,
    "preserved v10 crouch lost its legacy parent pitch");
  closeTo(legacyLowPosePlayer.bodyGroup.position.y, -0.36,
    "preserved v10 crouch lost its legacy parent drop");
  closeTo(legacyLowPosePlayer.bodyGroup.scale.y, 1.36 * 0.94,
    "preserved v10 crouch lost its legacy parent compression");

  // A real saved suite can be mixed: untouched Crouch upgrades to Unity while
  // an edited v10 Crawl is preserved. Parent ownership must crossfade with the
  // joints instead of snapping legacy shaping on at the route switch.
  const mixedLowPosePlayer = new Player(level.scene);
  mixedLowPosePlayer.respawn(level, true);
  const mixedLowPoseBinding = RigBinding.fromSculptRuntime(
    mixedLowPosePlayer.animationRig.root,
    { strict: false },
  );
  const mixedLowPoseSuite = {
    ...currentLiveSuite,
    rig: mixedLowPoseBinding.definition,
    clips: currentLiveSuite.clips.map((clip) => ({
      ...(clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl
        ? oldLowPoseById.get(clip.id)
        : clip),
      rigId: mixedLowPoseBinding.definition.id,
    })),
  };
  const mixedLowPoseRuntime = createCharacterAnimationRuntime(
    mixedLowPosePlayer,
    mixedLowPoseSuite,
  );
  mixedLowPosePlayer.crawling = true;
  mixedLowPosePlayer.crawlPose = 1;
  mixedLowPosePlayer.speed = 0;
  mixedLowPosePlayer.walkVelocity.set(0, 0, 0);
  mixedLowPosePlayer.lastPlanar = 0;
  mixedLowPosePlayer.syncVisual(makeInput({ grabHeld: true }), dt);
  assert.equal(mixedLowPoseRuntime.activeClipId, UNITY_CROUCH_CRAWL_CLIP_IDS.crouch);
  closeTo(mixedLowPosePlayer.bodyGroup.rotation.x, 0,
    "Unity Crouch did not own the mixed suite's parent pose");

  const moveMixedLowPose = () => {
    mixedLowPosePlayer.prevPos.copy(mixedLowPosePlayer.pos);
    mixedLowPosePlayer.pos.x += TUNING.crawlSpeed * dt;
    mixedLowPosePlayer.lastPlanar = TUNING.crawlSpeed;
    mixedLowPosePlayer.syncVisual(makeInput({ grabHeld: true, moveX: 1 }), dt);
  };
  moveMixedLowPose();
  assert.equal(mixedLowPoseRuntime.activeClipId, UNITY_CROUCH_CRAWL_CLIP_IDS.crawl);
  closeTo(mixedLowPoseRuntime.diagnostics.transitionBlendWeight, 0,
    "mixed low-pose switch did not begin on its outgoing source pose");
  closeTo(mixedLowPosePlayer.bodyGroup.rotation.x, 0,
    "mixed low-pose switch snapped legacy pitch on before its joint blend");
  moveMixedLowPose();
  const mixedBlend = mixedLowPoseRuntime.diagnostics.transitionBlendWeight;
  assert.ok(mixedBlend > 0 && mixedBlend < 1,
    "mixed low-pose ownership fixture skipped its crossfade interior");
  closeTo(mixedLowPosePlayer.bodyGroup.rotation.x, 0.75 * mixedBlend,
    "mixed low-pose parent pitch did not match the joint crossfade");
  closeTo(mixedLowPosePlayer.bodyGroup.position.y, -0.2 * mixedBlend,
    "mixed low-pose parent drop did not match the joint crossfade");
  closeTo(mixedLowPosePlayer.bodyGroup.scale.y, 1.36 * (1 - 0.06 * mixedBlend),
    "mixed low-pose parent compression did not match the joint crossfade");
  const boardAnimationRuntime = createCharacterAnimationRuntime(
    boardPlayer,
    createPlayerStarterAnimationSuite(boardAnimationBinding.definition),
  );
  const assertJointEuler = (jointId, degrees, message) => {
    const node = boardPlayer.animationRig.jointsById.get(jointId)?.node;
    assert.ok(node, `missing animated joint ${jointId}`);
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(degrees[0]),
      THREE.MathUtils.degToRad(degrees[1]),
      THREE.MathUtils.degToRad(degrees[2]),
      "XYZ",
    ));
    closeTo(Math.abs(node.quaternion.dot(expected)), 1, message, 1e-5);
  };
  const prepareBoardAir = () => {
    boardPlayer.respawn(level, true);
    boardPlayer.state = "air";
    boardPlayer.grounded = false;
    boardPlayer.freeSkate = true;
    boardPlayer.airFromSkate = true;
    boardPlayer.airGrav = "board";
    boardPlayer.boardOllieAir = true;
    boardPlayer.pos.set(0, 4, 0);
    boardPlayer.prevPos.copy(boardPlayer.pos);
    boardPlayer.vVel = 8;
    boardPlayer.speed = 5;
  };
  const tickBoard = (input) => {
    boardPlayer.step(dt, input, level);
    level.update(dt);
    input.consumeEdges();
  };
  prepareBoardAir();
  tickBoard(makeInput({ moveY: -1, grabHeld: true }));
  assert.equal(boardPlayer.slamActive, false, "held board grab became a slam after moving the stick down");
  assert.equal(boardPlayer.freeSkate, true, "held board grab unexpectedly stowed the board");

  prepareBoardAir();
  tickBoard(makeInput({ moveY: -1, grabHeld: true, grabPressed: true }));
  assert.equal(boardPlayer.slamActive, true, "fresh Circle+down no longer starts a board-air slam");
  assert.equal(boardPlayer.freeSkate, false, "board-air slam did not stow the board");
  assert.equal(boardPlayer.airFromSkate, false, "board-air slam retained skate-air ownership");
  assert.equal(boardAnimationRuntime.activeClipId, "player.slam");
  closeTo(
    boardAnimationRuntime.diagnostics.timelineTime,
    boardPlayer.animationIntent.motion.actionProgress,
    "slam anticipation did not scrub from gameplay phase",
  );
  assert.ok(boardAnimationRuntime.diagnostics.timelineTime < 0.03,
    "first slam frame skipped the Unity anticipation hold");
  assertJointEuler("shoulderLeft", UNITY_SLAM_ANTICIPATION_POSE_DEGREES.shoulderLeft,
    "Unity anticipation did not reach the left shoulder");
  assertJointEuler("shoulderRight", UNITY_SLAM_ANTICIPATION_POSE_DEGREES.shoulderRight,
    "Unity anticipation did not reach the right shoulder");
  assertJointEuler("hipLeft", [UNITY_SLAM_ANTICIPATION_POSE_DEGREES.hipLeft, 0, 0],
    "Unity anticipation did not tuck the left thigh");
  assertJointEuler("kneeRight", [UNITY_SLAM_ANTICIPATION_POSE_DEGREES.kneeRight, 0, 0],
    "Unity anticipation did not fold the right knee");

  boardPlayer.slamHangT = 0;
  tickBoard(makeInput());
  closeTo(boardAnimationRuntime.diagnostics.timelineTime, 0.66,
    "slam fall pose did not scrub from gameplay phase");
  assertJointEuler("shoulderLeft", UNITY_SLAM_FALL_POSE_DEGREES.shoulderLeft,
    "Unity fall did not reach the left shoulder");
  assertJointEuler("hipRight", [UNITY_SLAM_FALL_POSE_DEGREES.hipRight, 0, 0],
    "Unity fall did not straighten the right thigh");
  assertJointEuler("kneeLeft", [UNITY_SLAM_FALL_POSE_DEGREES.kneeLeft, 0, 0],
    "Unity fall did not straighten the left knee");

  const doublePlayer = new Player(level.scene);
  const doubleBinding = RigBinding.fromSculptRuntime(
    doublePlayer.animationRig.root,
    { strict: false },
  );
  const doubleRuntime = createCharacterAnimationRuntime(
    doublePlayer,
    createPlayerStarterAnimationSuite(doubleBinding.definition),
  );
  doublePlayer.respawn(level, true);
  doublePlayer.state = "air";
  doublePlayer.grounded = false;
  doublePlayer.freeSkate = false;
  doublePlayer.airFromSkate = false;
  doublePlayer.airGrav = "foot";
  doublePlayer.pos.set(0, 4, 0);
  doublePlayer.prevPos.copy(doublePlayer.pos);
  doublePlayer.vVel = 8;
  doublePlayer.launchVy = TUNING.jumpVelocity;
  doublePlayer.airborneT = 0.15;
  doublePlayer.flipTimer = CONST.flipDuration * 0.7;
  doublePlayer.airJumpUsed = false;
  doublePlayer.doubleJumpAir = false;
  const tickDouble = (input) => {
    doublePlayer.step(dt, input, level);
    level.update(dt);
    input.consumeEdges();
  };
  tickDouble(makeInput());
  assert.equal(doubleRuntime.activeClipId, "player.jump");
  assert.ok(doublePlayer.flipTimer > 0, "running first-jump roll fixture was not active");
  doublePlayer.flipTimer = CONST.flipDuration * (1 - 0.475) + dt;
  doublePlayer.vVel = 1;
  tickDouble(makeInput());
  closeTo(
    doublePlayer.animationIntent.motion.inputs[FORWARD_ROLL_TUCK_INPUT],
    1,
    "forward roll did not reach maximum curl while rising",
  );
  assert.equal(doubleRuntime.activeClipId, "player.jump");
  doublePlayer.flipTimer = CONST.flipDuration * (1 - 0.475) + dt;
  doublePlayer.vVel = -0.01;
  tickDouble(makeInput());
  closeTo(
    doublePlayer.animationIntent.motion.inputs[FORWARD_ROLL_TUCK_INPUT],
    1,
    "forward-roll curl popped at the Jump-to-Fall route switch",
  );
  assert.equal(doubleRuntime.activeClipId, "player.fall");
  tickDouble(makeInput({ jumpPressed: true, jumpHeld: true }));
  tickDouble(makeInput({ jumpReleased: true }));
  assert.equal(doublePlayer.lastJumpType, "Double Jump");
  assert.equal(doublePlayer.doubleJumpAir, true);
  assert.equal(doublePlayer.flipTimer, 0, "first-jump somersault survived the double pop");
  assert.equal(doublePlayer.animationIntent.motion.inputs[FORWARD_ROLL_TUCK_INPUT], 0,
    "forward-roll squash leaked into the split double jump");
  assert.equal(doublePlayer.animationClipHint, "player.double-jump");
  assert.equal(doubleRuntime.activeClipId, "player.double-jump");
  closeTo(
    doubleRuntime.diagnostics.timelineTime,
    doublePlayer.animationIntent.motion.actionProgress,
    "double-jump clip did not restart at the second pop's gameplay phase",
  );
  assert.ok(doubleRuntime.diagnostics.timelineTime < 0.05,
    "double-jump clip entered too far beyond its launch pose");
  closeTo(doublePlayer.bodyGroup.rotation.x, 0,
    "double jump retained a visible forward body roll", 1e-6);
  const doubleHipLeft = doublePlayer.animationRig.jointsById.get("hipLeft")?.node;
  const doubleHipRight = doublePlayer.animationRig.jointsById.get("hipRight")?.node;
  assert.ok(doubleHipLeft && doubleHipRight, "double-jump hip tracks were not bound");
  const doubleLeftDirection = new THREE.Vector3(0, -1, 0)
    .applyQuaternion(doubleHipLeft.quaternion);
  const doubleRightDirection = new THREE.Vector3(0, -1, 0)
    .applyQuaternion(doubleHipRight.quaternion);
  assert.ok(doubleLeftDirection.x > 0.6,
    "double-jump left leg did not split outward");
  assert.ok(doubleRightDirection.x < -0.6,
    "double-jump right leg did not split outward");

  // Optional supplied-replay check. The committed synthetic case keeps CI
  // self-contained; passing the bug-report file pins its original fixed-step
  // evidence too: frame 868 launches, frame 869 inherits the grounded hold.
  if (process.argv[2]) {
    const replay = JSON.parse(await readFile(process.argv[2], "utf8"));
    const entry = findLevel(replay.level);
    assert.ok(entry, `replay level ${replay.level} is not registered`);
    const replayLevel = new Level(new THREE.Scene(), entry);
    const replayPlayer = new Player(replayLevel.scene);
    fixtures.push(replayLevel);
    replayPlayer.enterLevel(entry.id);
    replayPlayer.endlessDeaths = replay.endlessDeaths === true;
    replayPlayer.respawn(replayLevel, true);
    const input = makeInput();
    const replayer = new Replayer();
    replayer.begin(replay);
    const samples = new Map();
    while (replayer.active && replayer.frame <= 869) {
      const frame = replayer.frame;
      if (!replayer.feed(input, replayPlayer.camDir)) break;
      replayPlayer.step(dt, input, replayLevel);
      replayLevel.update(dt);
      if (frame >= 868) {
        samples.set(frame, {
          state: replayPlayer.state,
          grounded: replayPlayer.grounded,
          jump: replayPlayer.lastJumpType,
          slam: replayPlayer.slamActive,
          slamFlat: replayPlayer.slamFlatT,
          star: replayPlayer.starTimer,
          y: replayPlayer.pos.y,
          vVel: replayPlayer.vVel,
          grabHeld: input.grabHeld,
          grabPressed: input.grabPressed,
          jumpReleased: input.jumpReleased,
        });
      }
      input.consumeEdges();
    }
    assert.deepEqual(
      {
        state: samples.get(868)?.state,
        grounded: samples.get(868)?.grounded,
        jump: samples.get(868)?.jump,
        slam: samples.get(868)?.slam,
        grabHeld: samples.get(868)?.grabHeld,
        jumpReleased: samples.get(868)?.jumpReleased,
      },
      {
        state: "air",
        grounded: false,
        jump: "Crouch Jump",
        slam: false,
        grabHeld: true,
        jumpReleased: true,
      },
      "supplied replay did not reproduce the crouch-jump launch frame",
    );
    assert.deepEqual(
      {
        state: samples.get(869)?.state,
        slam: samples.get(869)?.slam,
        slamFlat: samples.get(869)?.slamFlat,
        grabHeld: samples.get(869)?.grabHeld,
        grabPressed: samples.get(869)?.grabPressed,
      },
      { state: "air", slam: false, slamFlat: 0, grabHeld: true, grabPressed: false },
      "supplied replay turned the inherited crouch hold into a body slam",
    );
    closeTo(samples.get(868)?.vVel, 17.1, "supplied replay crouch launch velocity");
    closeTo(samples.get(869)?.vVel, 16.55, "supplied replay first rising velocity");
    closeTo(samples.get(869)?.y, 0.2758333333, "supplied replay first rising position");
    assert.ok(samples.get(869)?.star > 0, "supplied replay lost the crouch-jump star pose");
    replayer.end();
  }

  console.log("Validated Unity crouch/crawl routing, crouch-jump slam priority, forward-roll curl, and split double jump.");
  doubleRuntime.dispose();
  boardAnimationRuntime.dispose();
  legacyLowPoseRuntime.dispose();
  mixedLowPoseRuntime.dispose();
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  for (const level of fixtures) level.dispose();
  await server.close();
}
