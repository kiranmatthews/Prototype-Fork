import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = JSON.parse(
  await readFile(`${root}tools/fixtures/ledge-jungle-replay.json`, "utf8"),
);
assert.equal(fixture.level, "jungle");
assert.equal(fixture.frames, 4788);

function installHeadlessDom() {
  const storage = new Map();
  const noop = () => {};
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
    { get(target, key) { return key in target ? target[key] : noop; } },
  );
  const makeCanvas = () => ({
    ...makeElement("canvas"),
    height: 1,
    width: 1,
    getContext() {
      context.canvas = this;
      return context;
    },
  });
  const body = makeElement("body");
  globalThis.document = {
    body,
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
    addEventListener: noop,
    removeEventListener: noop,
    devicePixelRatio: 1,
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

function makeInput() {
  const input = { moveX: 0, moveY: 0 };
  for (const key of channels) input[key] = false;
  input.consumeEdges = () => {
    for (const key of edgeChannels) input[key] = false;
  };
  return input;
}

function capture(player) {
  const anchor = player.ledgeAnchor?.clone() ?? new THREE.Vector3();
  const normal = player.ledgeNormal?.clone() ?? new THREE.Vector3();
  const landing = player.ledgeLanding?.clone() ?? new THREE.Vector3();
  const climbTo = player.ledgeClimbTo?.clone() ?? new THREE.Vector3();
  return {
    state: player.state,
    grounded: player.grounded,
    pos: player.pos.clone(),
    phase: player.ledgePhase,
    anchor,
    normal,
    landing,
    climbTo,
  };
}

installHeadlessDom();
const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) => {
  const message = String(value ?? "");
  return (
    message.includes("GLB") ||
    message.includes("skull mask failed") ||
    message.includes("crossbones failed") ||
    message.includes("procedural skateboard trucks") ||
    message.includes("spin model failed")
  );
};
console.warn = (...args) => {
  if (!expectedAssetLog(args[0])) originalWarn(...args);
};
console.error = (...args) => {
  if (expectedAssetLog(args[0])) return;
  originalError(...args);
};

try {
  const { Level, findLevel, normalizeCustomLevelData } =
    await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { Replayer } = await server.ssrLoadModule("/src/replay.ts");
  const { CONST, TUNING } = await server.ssrLoadModule("/src/tuning.ts");
  const {
    ledgeBasis,
    ledgeBlockerIntersects,
    ledgeBodyBox,
    ledgeCatchEnvelope,
    ledgeGripIntent,
    ledgeLandingPoint,
    ledgeTraversePoint,
  } = await server.ssrLoadModule("/src/ledgeTraversal.ts");

  // Exact diagonal normal from the attached failing take: all movement must
  // stay in normal/tangent space, never collapse to an X-or-Z branch.
  const replayNormal = new THREE.Vector3(
    0.08018534728595439,
    0,
    0.9967799707461176,
  );
  const basis = ledgeBasis(replayNormal, 0.5, 0.5);
  const anchor = new THREE.Vector3(-1.695248085, -0.59423062, -38.97382037);
  const landing = ledgeLandingPoint(
    new THREE.Vector3(),
    anchor,
    basis,
    0.42,
    0.65576938,
  );
  const landingDelta = landing.clone().sub(anchor).setY(0);
  assert.ok(
    Math.abs(landingDelta.x * basis.tx + landingDelta.z * basis.tz) < 1e-9,
    "diagonal mantle target drifted along the ledge",
  );
  assert.ok(
    -(landingDelta.x * basis.nx + landingDelta.z * basis.nz) > 0.9,
    "diagonal mantle did not travel inward",
  );
  const right = ledgeTraversePoint(
    new THREE.Vector3(),
    anchor,
    basis,
    0.8,
  );
  assert.ok(right.distanceTo(anchor) > 0.79);
  assert.ok(
    (right.x - anchor.x) * basis.tx + (right.z - anchor.z) * basis.tz > 0.79,
  );

  // Grip input is resolved in the ledge's tangent/normal frame for every
  // cardinal face. A sideways ledge therefore uses up/down for traversal and
  // left/right for a deliberate release, rather than inheriting front-only
  // assumptions.
  for (const { normal: n, world, shim, away, label } of [
    { normal: [0, 1], world: [1, 0], shim: 1, away: 0, label: "+Z right" },
    { normal: [0, 1], world: [0, 1], shim: 0, away: 1, label: "+Z away" },
    { normal: [0, -1], world: [1, 0], shim: -1, away: 0, label: "-Z right" },
    { normal: [0, -1], world: [0, -1], shim: 0, away: 1, label: "-Z away" },
    { normal: [1, 0], world: [0, -1], shim: 1, away: 0, label: "+X up" },
    { normal: [1, 0], world: [1, 0], shim: 0, away: 1, label: "+X away" },
    { normal: [-1, 0], world: [0, -1], shim: -1, away: 0, label: "-X up" },
    { normal: [-1, 0], world: [-1, 0], shim: 0, away: 1, label: "-X away" },
  ]) {
    const intent = ledgeGripIntent(
      world[0],
      world[1],
      ledgeBasis({ x: n[0], z: n[1] }, 0.5, 0.5),
    );
    assert.ok(Math.abs(intent.shim - shim) < 1e-9, `${label} shim projection changed`);
    assert.ok(Math.abs(intent.away - away) < 1e-9, `${label} away projection changed`);
    assert.equal(intent.pullingAway, away === 1, `${label} release intent changed`);
    assert.equal(intent.pullingToward, false, `${label} unexpectedly requested a climb`);
  }
  for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const toward = ledgeGripIntent(
      -nx,
      -nz,
      ledgeBasis({ x: nx, z: nz }, 0.5, 0.5),
    );
    assert.equal(toward.pullingToward, true,
      `inward input did not request a climb for normal ${nx},${nz}`);
    assert.equal(toward.pullingAway, false);
  }
  const cornerIntent = ledgeGripIntent(
    0,
    -1,
    ledgeBasis({ x: -Math.SQRT1_2, z: -Math.SQRT1_2 }, 0.5, 0.5),
  );
  assert.ok(Math.abs(cornerIntent.shim + Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(cornerIntent.away - Math.SQRT1_2) < 1e-9);
  assert.equal(
    cornerIntent.pullingAway,
    false,
    "equal corner shimmy/away input released the grip",
  );
  assert.equal(cornerIntent.pullingToward, false,
    "equal corner shimmy/normal input requested a climb");

  const body = ledgeBodyBox(
    new THREE.Box3(),
    new THREE.Vector3(0, 1, 0),
    CONST.playerHalf,
  );
  const support = new THREE.Box3(
    new THREE.Vector3(-2, -1, -2),
    new THREE.Vector3(2, 1.05, 2),
  );
  const lowCeiling = new THREE.Box3(
    new THREE.Vector3(-0.4, 1.45, -0.4),
    new THREE.Vector3(0.4, 1.75, 0.4),
  );
  assert.equal(ledgeBlockerIntersects(support, body, 1), false);
  assert.equal(ledgeBlockerIntersects(lowCeiling, body, 1), true);

  // Jungle Gate is the one source course whose receiving terraces opt into a
  // wider accessibility envelope. Zero must retain every shipped global
  // value; full assist is generous enough for the authored Perfect Boing but
  // does not turn an ordinary arrow bounce into a shortcut.
  assert.deepEqual(ledgeCatchEnvelope(TUNING.ledgeReach, 0), {
    reach: TUNING.ledgeReach,
    minimumAirRise: 0.7,
    maximumRisingSpeed: 1.5,
    nearMiss: 0.14,
    forwardProbe: 0.62,
    airIntoThreshold: 0.2,
    groundedIntoThreshold: 0.65,
  });
  const fullAssist = ledgeCatchEnvelope(TUNING.ledgeReach, 1);
  for (const [key, expected] of Object.entries({
    reach: TUNING.ledgeReach + 1.4,
    minimumAirRise: 0.45,
    maximumRisingSpeed: 6,
    nearMiss: 0.4,
    forwardProbe: 0.92,
    airIntoThreshold: 0.08,
    groundedIntoThreshold: 0.45,
  }))
    assert.ok(
      Math.abs(fullAssist[key] - expected) < 1e-9,
      `full ledge assist ${key} drifted`,
    );

  const jungleGateEntry = findLevel("jungle-gate-run");
  assert.ok(jungleGateEntry?.data, "Jungle Gate source data is missing");
  const invalidAssist = structuredClone(jungleGateEntry.data);
  invalidAssist.ledgeAssist = 1.01;
  assert.equal(
    normalizeCustomLevelData(invalidAssist),
    null,
    "out-of-range level ledge assistance must be rejected",
  );

  const gateScene = new THREE.Scene();
  const gateLevel = new Level(gateScene, jungleGateEntry);
  assert.equal(gateLevel.ledgeAssist, 1);
  assert.equal(gateLevel.captureData().ledgeAssist, 1);
  const receivingFaces = [
    { x: 20.5, roughY: 8.75 },
    { x: 142.5, roughY: 14.75 },
  ];
  const faceFor = ({ x, roughY }) =>
    gateLevel.walls.find(
      (wall) =>
        Math.abs(wall.min.x - x) < 1e-6 &&
        Math.abs(wall.max.y - roughY) < 1e-6 &&
        wall.min.z < 0 &&
        wall.max.z > 0,
    );
  const prepareCatch = (player, face, rise = 2.4) => {
    player.rawInput = makeInput();
    player.state = "air";
    player.grounded = false;
    player.pos.set(face.min.x - 0.35, face.max.y - rise, 0);
    player.lastVelX = 9;
    player.lastVelZ = 0;
    player.vVel = 4;
  };
  for (const receiving of receivingFaces) {
    const face = faceFor(receiving);
    assert.ok(face, `missing receiving platform face at x=${receiving.x}`);

    const baselinePlayer = new Player(gateScene);
    prepareCatch(baselinePlayer, face);
    gateLevel.ledgeAssist = 0;
    assert.equal(
      baselinePlayer.tryLedgeGrab(face, gateLevel),
      false,
      "the global envelope unexpectedly caught the source-problem approach",
    );

    const assistedPlayer = new Player(gateScene);
    prepareCatch(assistedPlayer, face);
    gateLevel.ledgeAssist = 1;
    assert.equal(
      assistedPlayer.tryLedgeGrab(face, gateLevel),
      true,
      "Jungle Gate assist did not catch the receiving terrace",
    );
    assert.equal(assistedPlayer.state, "hang");
    assert.ok(Math.abs(assistedPlayer.ledgeLip - (receiving.roughY + 0.25)) < 1e-5);
    assert.ok(
      Math.abs(
        assistedPlayer.ledgeAnchor.y -
          (receiving.roughY + 0.25 - 1.25),
      ) < 1e-5,
      "assisted catch did not anchor hands at the true platform lip",
    );
    const climbInput = makeInput();
    climbInput.jumpPressed = true;
    for (let step = 0; step < 60 && assistedPlayer.state === "hang"; step++) {
      assistedPlayer.rawInput = climbInput;
      assistedPlayer.stepHang(CONST.fixedStep, climbInput, gateLevel);
      climbInput.consumeEdges();
    }
    assert.equal(
      assistedPlayer.state,
      "air",
      "assisted receiving catch did not complete its mantle",
    );
    assert.ok(
      assistedPlayer.pos.x > face.min.x,
      "assisted mantle did not finish inward on the receiving terrace",
    );

    const ordinaryBounce = new Player(gateScene);
    prepareCatch(ordinaryBounce, face, 4.1);
    assert.equal(
      ordinaryBounce.tryLedgeGrab(face, gateLevel),
      false,
      "full assist let an ordinary Boing bypass the Perfect-Boing climb",
    );

    const grindOwner = new Player(gateScene);
    prepareCatch(grindOwner, face);
    grindOwner.rawInput.grindHeld = true;
    assert.equal(
      grindOwner.tryLedgeGrab(face, gateLevel),
      false,
      "ledge assist stole a receiving face from grind intent",
    );

    const comboOwner = new Player(gateScene);
    prepareCatch(comboOwner, face);
    comboOwner.comboRun = true;
    assert.equal(
      comboOwner.tryLedgeGrab(face, gateLevel),
      false,
      "ledge assist banked a live combo-run string",
    );
  }

  // Exercise the actual first/second Arrow-climb timing: fall onto the real
  // metal Arrow lid with Jump held, then let normal 9u/s side-view air drive
  // carry the Perfect Boing to the receiving terrace. This guards the full
  // collision/timing route instead of only calling the lip resolver directly.
  const simulatePerfectBoing = (crateX) => {
    gateLevel.reset(true);
    gateLevel.update(0);
    gateLevel.ledgeAssist = 1;
    const crate = gateLevel.crates.find(
      (candidate) =>
        candidate.metalBounce && Math.abs(candidate.mesh.position.x - crateX) < 1e-6,
    );
    assert.ok(crate, `missing Jungle Gate Arrow crate at x=${crateX}`);
    const player = new Player(gateScene);
    player.enterLevel("jungle-gate-run");
    player.respawn(gateLevel, true);
    player.pos.set(crateX, crate.box.max.y + 0.22, 0);
    player.prevPos.copy(player.pos);
    player.state = "air";
    player.grounded = false;
    player.vVel = -3;
    const input = makeInput();
    input.moveX = 1;
    input.jumpHeld = true;
    let perfectLaunch = false;
    let maximumY = player.pos.y;
    for (let frame = 0; frame < 240; frame++) {
      player.step(CONST.fixedStep, input, gateLevel);
      gateLevel.update(CONST.fixedStep);
      maximumY = Math.max(maximumY, player.pos.y);
      if (player.vVel > 18) perfectLaunch = true;
      input.consumeEdges();
      if (player.state === "hang" || player.state === "dead") break;
    }
    return { player, perfectLaunch, maximumY };
  };
  for (const [crateX, targetLip] of [
    [13.5, 9],
    [135.5, 15],
  ]) {
    const result = simulatePerfectBoing(crateX);
    assert.equal(result.perfectLaunch, true, `Arrow ${crateX} did not Perfect Boing`);
    assert.equal(
      result.player.state,
      "hang",
      `Perfect Boing at x=${crateX} did not catch its receiving terrace; ` +
        `ended ${result.player.state} at (${result.player.pos.x.toFixed(2)}, ` +
        `${result.player.pos.y.toFixed(2)}) after apex ${result.maximumY.toFixed(2)}`,
    );
    assert.ok(Math.abs(result.player.ledgeLip - targetLip) < 1e-4);
  }

  // A mounted rider who catches a ledge has committed both hands to
  // traversal. The deck must keep flying independently instead of being
  // hidden for the hang and then magically reappearing underfoot.
  const mountedFace = faceFor(receivingFaces[0]);
  assert.ok(mountedFace, "missing mounted ledge-transfer fixture face");
  const mountedCatch = new Player(gateScene);
  prepareCatch(mountedCatch, mountedFace);
  mountedCatch.freeSkate = true;
  mountedCatch.airFromSkate = true;
  mountedCatch.airGrav = "board";
  mountedCatch.boardOllieAir = true;
  mountedCatch.skateOn = true;
  mountedCatch.speed = 12;
  mountedCatch.vVel = -2;
  mountedCatch.axisF.set(1, 0, 0);
  mountedCatch.axisL.set(0, 0, -1); // free-skate stores heading-left
  mountedCatch.syncVisual(mountedCatch.rawInput, 0);
  gateScene.updateMatrixWorld(true);
  assert.equal(
    mountedCatch.tryLedgeGrab(mountedFace, gateLevel),
    true,
    "mounted fixture did not catch the ledge",
  );
  assert.equal(mountedCatch.state, "hang");
  assert.equal(mountedCatch.freeSkate, false, "ledge catch kept skate authority");
  assert.equal(mountedCatch.skateOn, false);
  assert.equal(mountedCatch.airFromSkate, false);
  assert.equal(mountedCatch.airGrav, "foot");
  assert.equal(mountedCatch.boardOllieAir, false);
  assert.equal(mountedCatch.bailDownT, 0, "clean ledge transfer became a bail");
  assert.ok(mountedCatch.flyBoard?.visible, "ledge catch did not release the deck");
  assert.ok(
    mountedCatch.flyBoardVel.distanceTo(new THREE.Vector3(12, -2, 0)) < 1e-9,
    "loose deck did not inherit the catch velocity",
  );
  assert.equal(
    mountedCatch.ledgeControlRightSign,
    -1,
    "mounted catch forgot the skating control frame",
  );

  // Detaching flips freeSkate immediately, but must not flip the stick's
  // left/right meaning while the hands are already on the wall.
  const shimInput = makeInput();
  shimInput.moveX = 1;
  mountedCatch.rawInput = shimInput;
  const mountedBasis = ledgeBasis(
    mountedCatch.ledgeNormal,
    CONST.playerHalf.x,
    CONST.playerHalf.z,
  );
  const expectedShim = THREE.MathUtils.clamp(
    -mountedCatch.axisL.x * mountedBasis.tx -
      mountedCatch.axisL.z * mountedBasis.tz,
    -1,
    1,
  );
  assert.ok(Math.abs(expectedShim) > 0.5, "mounted shimmy fixture is degenerate");
  mountedCatch.stepHang(CONST.fixedStep, shimInput, gateLevel);
  assert.equal(
    Math.sign(mountedCatch.ledgeShimmy),
    Math.sign(expectedShim),
    "deck detach reversed the first shimmy input",
  );

  const makeSideGrip = () => {
    const player = new Player(gateScene);
    prepareCatch(player, mountedFace);
    player.axisF.set(0, 0, -1);
    player.axisL.set(1, 0, 0);
    assert.equal(player.tryLedgeGrab(mountedFace, gateLevel), true);
    return player;
  };
  const cornerGrip = makeSideGrip();
  cornerGrip.ledgeNormal.set(-Math.SQRT1_2, 0, -Math.SQRT1_2);
  const cornerInput = makeInput();
  cornerInput.moveY = 1;
  for (let frame = 0; frame < 7; frame++) {
    cornerGrip.rawInput = cornerInput;
    cornerGrip.stepHang(CONST.fixedStep, cornerInput, gateLevel);
  }
  assert.equal(cornerGrip.state, "hang", "sideways corner shimmy dropped the player");
  assert.equal(cornerGrip.ledgeAwayT, 0, "corner shimmy accumulated away-release time");
  assert.ok(cornerGrip.ledgeShimmy < -0.5, "corner input no longer requested a shimmy");

  const outwardGrip = makeSideGrip();
  const outwardInput = makeInput();
  outwardInput.moveX = -1;
  for (let frame = 0; frame < 7; frame++) {
    outwardGrip.rawInput = outwardInput;
    outwardGrip.stepHang(CONST.fixedStep, outwardInput, gateLevel);
  }
  assert.equal(outwardGrip.state, "air", "pure outward input no longer released a side ledge");

  const inwardGrip = makeSideGrip();
  const inwardInput = makeInput();
  inwardInput.moveX = 1;
  for (let frame = 0; frame < 8; frame++) {
    inwardGrip.rawInput = inwardInput;
    inwardGrip.stepHang(CONST.fixedStep, inwardInput, gateLevel);
  }
  assert.equal(inwardGrip.ledgePhase, "climb",
    "inward side-ledge input did not start the mantle");
  assert.equal(inwardGrip.ledgeAwayT, 0, "inward input accumulated away-release time");

  // Jump identity follows board ownership, not velocity. This is the exact
  // low-speed contradiction exposed by the Coastal Street replay: a mounted
  // rider must ollie, while a fast deckless runner retains the foot jump.
  const jumpFixture = (freeSkate, speed) => {
    const player = new Player(gateScene);
    player.rawInput = makeInput();
    player.state = "ride";
    player.grounded = true;
    player.freeSkate = freeSkate;
    player.skateOn = freeSkate;
    player.speed = speed;
    player.pos.set(0, 2, 0);
    player.prevPos.copy(player.pos);
    player.chargeTimer = TUNING.jumpChargeTime * 0.4;
    player.charging = true;
    player.dirHoldT = TUNING.flipHoldTime + 0.1;
    player.chargedJump(CONST.fixedStep);
    return player;
  };
  const slowMounted = jumpFixture(true, TUNING.walkSpeed * 0.7);
  assert.equal(slowMounted.lastJumpType, "Board Ollie");
  assert.equal(slowMounted.boardOllieAir, true);
  assert.equal(slowMounted.airFromSkate, true);
  assert.equal(slowMounted.airGrav, "board");
  assert.equal(slowMounted.flipTimer, 0, "mounted ollie inherited a body flip");

  const fastDeckless = jumpFixture(false, TUNING.walkSpeed + 4);
  assert.equal(fastDeckless.lastJumpType, "Forward Flip");
  assert.equal(fastDeckless.boardOllieAir, false);
  assert.equal(fastDeckless.airFromSkate, false);
  assert.equal(fastDeckless.airGrav, "foot");
  gateLevel.dispose();

  const checkpoints = new Set([
    4351, 4352, 4389, 4360, 4442, 4450, 4497, 4503, 4554, 4565, 4595,
    4620,
  ]);
  async function runReplay(data, beforeFrame, stopAfter = Number.POSITIVE_INFINITY) {
    const scene = new THREE.Scene();
    const entry = findLevel(data.level);
    assert.ok(entry, "Jungle replay level is missing");
    const level = new Level(scene, entry);
    const player = new Player(scene);
    // Keep this historical traversal take scoped to ledge physics even as new
    // trick economies are added to Player after the replay was recorded.
    if (player.special) {
      player.special.value = 0;
      player.special.step = () => {};
      player.special.award = () => false;
    }
    player.enterLevel(entry.id);
    player.endlessDeaths = data.endlessDeaths === true;
    player.respawn(level, true);
    const input = makeInput();
    const replayer = new Replayer();
    replayer.begin(data);
    // This historical take validates ledge traversal, not newer wipeout
    // agency. Keep the pre-feature stationary recovery/no-flail semantics so
    // a bail thousands of frames earlier cannot rewrite the authored approach
    // to the ledge under test.
    const wipeoutTuning = {
      bailRollOutSpeed: TUNING.bailRollOutSpeed,
      ragFlailJumpChance: TUNING.ragFlailJumpChance,
      ragFlailSteerChance: TUNING.ragFlailSteerChance,
    };
    TUNING.bailRollOutSpeed = 0;
    TUNING.ragFlailJumpChance = 0;
    TUNING.ragFlailSteerChance = 0;
    const rows = new Map();
    try {
      while (replayer.active) {
        const frame = replayer.frame;
        beforeFrame?.(frame, player, level);
        if (!replayer.feed(input, player.camDir)) break;
        // The current game deliberately gives an airborne wipeout dependable
        // held-direction control. This pre-feature recording is retained only
        // as a ledge traversal fixture, so keep its much earlier bail neutral
        // instead of letting the new rescue mechanic rewrite the approach.
        if (
          player.state === "air" &&
          !player.grounded &&
          (player.bailTimeLeft > 0 ||
            player.emergencyEjectCharging ||
            player.emergencyEjectLandingPending)
        ) {
          input.moveX = 0;
          input.moveY = 0;
        }
        player.step(CONST.fixedStep, input, level);
        level.update(CONST.fixedStep);
        if (checkpoints.has(frame)) rows.set(frame, capture(player));
        input.consumeEdges();
        if (frame >= stopAfter) {
          replayer.end();
          break;
        }
      }
    } finally {
      Object.assign(TUNING, wipeoutTuning);
    }
    const final = capture(player);
    level.dispose();
    return { rows, final };
  }

  const traversalFixture = structuredClone(fixture);
  // This legacy take held screen-up immediately after the catch. Under the
  // corrected wall-relative mapping that now means "toward landing: climb";
  // neutralize that stale hold and its later one-frame repeat so the explicit
  // left/right shimmy section can keep validating long-edge traversal.
  for (let frame = 4350; frame <= 4381; frame++)
    traversalFixture.my[frame] = 0;
  traversalFixture.my[4499] = 0;
  const baseline = await runReplay(traversalFixture);
  assert.equal(baseline.rows.get(4351).state, "hang");
  const normal = baseline.rows.get(4351).normal.normalize();
  const tangent = new THREE.Vector3(normal.z, 0, -normal.x);
  const displacement = (from, to) =>
    baseline.rows.get(to).anchor.clone().sub(baseline.rows.get(from).anchor);
  const rightOne = displacement(4389, 4442);
  const leftOne = displacement(4450, 4497);
  const rightTwo = displacement(4503, 4554);
  assert.ok(rightOne.dot(tangent) > 0.5, "first right shimmy did not progress");
  assert.ok(leftOne.dot(tangent) < -0.5, "left shimmy did not reverse progress");
  assert.ok(rightTwo.dot(tangent) > 0.5, "second right shimmy did not progress");
  assert.ok(
    rightOne.length() > 1.5,
    "long mesh traversal stopped before the authored edge ended",
  );
  assert.ok(
    Math.abs(baseline.rows.get(4442).normal.x) < 0.03,
    "local ledge frame kept the oblique approach drift",
  );
  const climb = baseline.rows.get(4565);
  assert.equal(climb.phase, "climb", "jump did not commit the climb");
  const climbDelta = climb.climbTo.clone().sub(climb.anchor).setY(0);
  assert.ok(
    Math.abs(climbDelta.dot(tangent)) < 0.03,
    "climb target moved sideways instead of inward",
  );
  assert.ok(-climbDelta.dot(normal) > 0.85, "climb target did not clear the lip");

  // Hang/climb state rides the same lastDelta channel as grounded mover
  // contact; otherwise the platform walks away while grounded=false.
  const moverDelta = new THREE.Vector3(0.3, 0.2, -0.1);
  const moverRun = await runReplay(
    structuredClone(fixture),
    (frame, player, level) => {
      if (frame !== 4352) return;
      player.ledgeMoverId = 999;
      level.moverDelta = () => moverDelta;
    },
    4352,
  );
  assert.ok(
    moverRun.rows
      .get(4352)
      .anchor.clone()
      .sub(moverRun.rows.get(4351).anchor)
      .distanceTo(moverDelta) < 1e-9,
    "moving support did not carry the hang anchor",
  );
  assert.ok(
    moverRun.rows
      .get(4352)
      .landing.clone()
      .sub(moverRun.rows.get(4351).landing)
      .distanceTo(moverDelta) < 1e-9,
    "moving support did not carry the mantle landing",
  );

  // The old target fell unless forward input rescued it after the animation.
  const neutral = structuredClone(traversalFixture);
  for (let frame = 4565; frame < neutral.frames; frame++) neutral.my[frame] = 0;
  const neutralRun = await runReplay(neutral);
  const neutralEnd = neutralRun.rows.get(4620);
  assert.equal(neutralEnd.state, "ride");
  assert.equal(neutralEnd.grounded, true);
  assert.ok(neutralEnd.pos.z < -39.5, "neutral climb finished outside the ledge");

  // Holding X through the collision frame must queue the mantle; no release
  // and second press should be required after the hands catch.
  const heldCatch = structuredClone(traversalFixture);
  for (let frame = 4351; frame <= 4375; frame++) heldCatch.b[frame] |= 1;
  const heldRun = await runReplay(heldCatch);
  assert.equal(heldRun.rows.get(4351).state, "hang");
  assert.equal(
    heldRun.rows.get(4360).phase,
    "climb",
    "held-through-catch jump intent was lost",
  );

  // A real low ceiling blocks only the climb. The grip remains live and can
  // traverse away from that deliberate traverse-only section.
  const blocked = structuredClone(traversalFixture);
  for (let frame = 4555; frame <= 4565; frame++) {
    blocked.mx[frame] = 0;
    blocked.my[frame] = 0;
  }
  for (let frame = 4566; frame < blocked.frames; frame++) {
    blocked.mx[frame] = -1;
    blocked.my[frame] = 0;
    blocked.b[frame] = 0;
  }
  let installedBlocker = false;
  const blockedRun = await runReplay(blocked, (frame, player, level) => {
    if (frame !== 4565 || installedBlocker) return;
    installedBlocker = true;
    const point = player.ledgeLanding.clone();
    level.walls.push(
      new THREE.Box3(
        new THREE.Vector3(point.x - 0.4, point.y + 0.22, point.z - 0.4),
        new THREE.Vector3(point.x + 0.4, point.y + 0.78, point.z + 0.4),
      ),
    );
  });
  assert.equal(blockedRun.rows.get(4565).phase, "grip");
  assert.equal(blockedRun.rows.get(4595).state, "hang");
  assert.equal(blockedRun.rows.get(4595).phase, "grip");
  assert.ok(
    blockedRun.rows
      .get(4595)
      .anchor.distanceTo(blockedRun.rows.get(4565).anchor) > 0.5,
    "traverse-only blocker also stopped ledge traversal",
  );

  console.log(
    "Validated wall-relative grip intent, sideways corner traversal/release, board-to-ledge detach, mounted jump identity, both Jungle Gate Perfect-Boing catches/mantles, refit traversal, mover carry, neutral/held climbs, and traverse-only clearance.",
  );
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn;
  console.error = originalError;
}
