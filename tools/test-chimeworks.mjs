import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

const noop = () => {};
function installHeadlessDom() {
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
    toggleAttribute: noop,
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
      return storage.get(String(key)) ?? null;
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


const input = () => {
  const value = { moveX: 0, moveY: 1 };
  for (const key of [
    "jumpHeld", "grindHeld", "spinHeld", "grabHeld", "transferHeld",
    "jumpPressed", "jumpReleased", "grindPressed", "spinPressed",
    "grabPressed", "restartPressed", "transferPressed",
  ]) value[key] = false;
  value.consumeEdges = () => {
    for (const key of Object.keys(value)) if (/Pressed|Released/.test(key)) value[key] = false;
  };
  return value;
};

installHeadlessDom();
const server = await createServer({ logLevel: "silent", server: { middlewareMode: true } });
const originalWarn = console.warn, originalError = console.error;
const expectedAssetLog = value => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ""));
console.warn = (...args) => { if (!expectedAssetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!expectedAssetLog(args[0])) originalError(...args); };
let level;
try {
  const { Level, BUILTIN_LEVELS, normalizeCustomLevelData } = await server.ssrLoadModule("/src/level.ts");
  const { ASTRA_CHIMEWORKS_LEVEL: data, CHIMEWORKS_ROUTE: route } = await server.ssrLoadModule("/src/levels/astra-chimeworks.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { TUNING, CONST } = await server.ssrLoadModule("/src/tuning.ts");
  const scene = new THREE.Scene();
  const entry = BUILTIN_LEVELS.find(entry => entry.id === "astra-chimeworks");
  assert.ok(entry && entry.data === data, "benchmark course is not registered against its source data");
  assert.ok(normalizeCustomLevelData(data), "source component contract was rejected");
  level = new Level(scene, entry);
  level.update(0);
  scene.updateMatrixWorld(true);
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const ray = new THREE.Raycaster();
  function ground(x, z, fromY = 100) {
    ray.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObjects(level.groundMeshes.filter(mesh => !mesh.userData.finishPad), false)[0] ?? null;
  }
  const supported = (p, name, tolerance = 0.35) => {
    const hit = ground(p[0], p[2], p[1] + 1);
    check(hit && Math.abs(hit.point.y - p[1]) <= tolerance,
      name + " is unsupported: authored " + p.join(",") + "; ground " + hit?.point.y);
  };
  supported(data.spawn, "spawn");
  const checkpoints = data.components.filter(c => c.t === "checkpoint");
  check(checkpoints.length >= 4, "long course needs frequent recovery points");
  for (const checkpoint of checkpoints) supported(checkpoint.p, "checkpoint");
  const gates = data.components.filter(c => c.t === "gate");
  check(gates.length === 1, "course must have one finish");
  supported(gates[0].p, "finish");
  check(data.killY < Math.min(...data.components.filter(c => c.t === "platform").map(c => c.p[1])) - 15,
    "kill plane is too near the lowest safe deck");

  // These are holes in collision, not dark scenery painted over an invisible floor.
  for (const [name, x, z] of [
    ["first leap", -12, -161], ["final leap", 14, -617],
    ...route.keyPositions.slice(0, -1).map((p, i) => ["key gap " + (i + 1), 18, p[2] - 5]),
    ["moving key gap 1", 18, -377.2], ["moving key gap 2", 18, -387],
    ["moving key gap 3", 18, -397], ["moving key exit gap", 18, -406.7],
  ]) check(!ground(x, z), name + " is secretly floored");

  // Probe actual built surfaces, including the last metre where malformed
  // terrain caps used to introduce an unplanned step/drop.
  const surfaces = [];
  for (const c of data.components.filter(c => c.t === "terrain" || c.t === "vertramp")) {
    const points = c.pts.map(p => [c.p[0] + p[0], c.p[1] + (p[3] ?? 0), c.p[2] + p[1]]);
    let samples = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) * 2);
      for (let j = 0; j <= n; j++) {
        const t = j / n;
        const p = a.map((value, axis) => value + (b[axis] - value) * t);
        const hit = ground(p[0], p[2], p[1] + 3);
        check(hit && Math.abs(hit.point.y - p[1]) < 1.5, c.nm + " broken centreline near " + p.join(","));
        samples++;
      }
    }
    surfaces.push({ name: c.nm, samples });
  }

  // Sloping crates may start slightly above a surface and settle, but not
  // inside it. Use the runtime box rather than guessed visual centre heights.
  for (const crate of level.crates) {
    const p = crate.mesh.position;
    const hit = ground(p.x, p.z, p.y + 2);
    check(hit !== null, "unsupported crate at " + p.toArray().join(","));
    if (hit) check(crate.box.min.y >= hit.point.y - 0.2 && crate.box.min.y <= hit.point.y + 0.8,
      "crate does not meet deck near " + p.toArray().join(",") + ": crate bottom=" + crate.box.min.y + " deck=" + hit.point.y);
  }
  check(level.crates.filter(c => c.nitro).length === 2, "hammer hazards changed unexpectedly");
  check(level.crates.filter(c => c.nitroBang).length === 1, "Nitros require exactly one finish switch");
  check(level.crumbles.length === 2 && level.crumbles.every(c => c.shakeTime >= 1),
    "xylophone crumble timing is too abrupt");
  for (const c of data.components.filter(c => c.t === "trampoline" || c.t === "speedpad")) {
    const hit = ground(c.p[0], c.p[2], c.p[1] + 1);
    const mechanic = c.t === "trampoline" ? "trampolineBounce" : "speedPadSpeed";
    check(hit?.object.userData[mechanic] !== undefined,
      c.nm + " is hidden under competing ground collision (" + hit?.object.name + ")");
  }

  const moving = level.movers;
  check(moving.length === 3, "three sliding keys are required");
  for (let i = 0; i <= 64; i++) {
    level.time = i / 64 * Math.PI * 2 / 0.7;
    level.update(0);
    for (const mover of moving) {
      const hit = ground(18, mover.mesh.position.z, 32);
      check(hit && Math.abs(hit.point.y - 29) < 0.01, "moving key loses the common central jumping lane");
    }
  }
  level.time = 0;
  level.update(0);
  const strings = level.rails.filter(rail =>
    [7, 29].includes(rail.points[0].x) && Math.abs(rail.points[0].z + 235) < 0.01);
  check(strings.length === 2, "both expert strings must be real grind rails");
  for (const rail of strings) {
    const first = rail.points[0], last = rail.points.at(-1);
    const firstGround = ground(first.x, first.z, first.y + 2);
    const lastGround = ground(last.x, last.z, last.y + 2);
    check(firstGround && first.y - firstGround.point.y <= TUNING.railSnapDistance, "string entry cannot be caught from takeoff deck");
    check(lastGround && last.y - lastGround.point.y <= TUNING.railSnapDistance, "string exit does not meet reunion stage");
    check(rail.points.every((p, i) => i === 0 || p.z < rail.points[i - 1].z), "string backtracks");
    check(rail.totalLength > 75 && rail.totalLength < 90, "string shortcut length is malformed");
  }

  // Real Player fixed-step integration, with production tuning untouched.
  // Starting near each lip isolates the authored jump from human timing.
  const jumps = [];
  function jump(name, start, speed, board, receiver, slope = 0) {
    level.reset(true);
    level.time = 0;
    level.update(0);
    scene.updateMatrixWorld(true);
    const player = new Player(scene);
    const controls = input();
    player.rawInput = controls;
    player.pos.fromArray(start);
    player.prevPos.copy(player.pos);
    player.axisF.set(0, 0, -1); player.axisL.set(1, 0, 0);
    player.state = "ride"; player.grounded = true;
    player.freeSkate = board; player.skateOn = board;
    player.speed = speed; player.walkVelocity.set(0, 0, -speed);
    player.lastTy = slope;
    player.chargeTimer = TUNING.jumpChargeTime; player.charging = true;
    player.dirHoldT = TUNING.flipHoldTime + 0.1;
    player.chargedJump(CONST.fixedStep);
    const initialY = player.pos.y;
    let peak = initialY, landed = false, finished = false;
    for (let frame = 0; frame < 180; frame++) {
      player.step(CONST.fixedStep, controls, level);
      level.update(CONST.fixedStep);
      peak = Math.max(peak, player.pos.y);
      if (player.grounded && frame > 1) { landed = true; break; }
      if (player.state === "finished") { finished = true; break; }
      if (["dead", "bail"].includes(player.state) || player.pos.y < receiver.y - 4) break;
    }
    const ok = (landed || finished) && player.pos.z <= receiver.near && player.pos.z >= receiver.far
      && player.pos.x >= receiver.left && player.pos.x <= receiver.right
      && (finished || Math.abs(player.pos.y - receiver.y) < 0.6);
    jumps.push({ name, landed: ok, state: player.state, peak: +(peak - initialY).toFixed(2), at: player.pos.toArray().map(v => +v.toFixed(2)) });
    check(ok, name + " failed: " + JSON.stringify(jumps.at(-1)));
    scene.remove(player.group);
  }
  jump("first six-metre skate leap", [-12, 31.96, -157.7], 23, true,
    { near: -164, far: -185, left: -21, right: -3, y: 29 }, 1 / Math.sqrt(37));
  jump("final charged skate leap", [14, 7.17, -613.7], 28, true,
    { near: -620, far: -664, left: 1, right: 27, y: 5 }, 1.2 / Math.hypot(8, 1.2));
  jump("foot key entry", [18, 26.04, -237.8], TUNING.walkSpeed, false,
    { near: -240.5, far: -247.5, left: 12, right: 21, y: 26.3 });
  for (let i = 0; i < route.keyPositions.length - 1; i++) {
    const a = route.keyPositions[i], b = route.keyPositions[i + 1];
    jump("foot key hop " + (i + 1), [18, a[1] + 0.04, a[2] - 3.3], TUNING.walkSpeed, false,
      { near: b[2] + 3.5, far: b[2] - 3.5, left: b[0] - 4.5, right: b[0] + 4.5, y: b[1] });
  }
  jump("foot key exit", [18, 28.74, -307.3], TUNING.walkSpeed, false,
    { near: -309, far: -335, left: 3, right: 33, y: 29 });
  for (let i = 0; i < 3; i++) {
    const z = -382 - i * 10;
    jump("moving key hop " + (i + 1), [18, 29.04, i === 0 ? -375.7 : z + 6.7], TUNING.walkSpeed, false,
      { near: z + 3.5, far: z - 3.5, left: 10.8, right: 25.2, y: 29 });
  }
  jump("moving key exit", [18, 29.04, -405.3], TUNING.walkSpeed, false,
    { near: -408, far: -428, left: 8, right: 28, y: 28 });

  // The optional solo uses the actual trampoline contact arbitration, not a
  // synthetic jump impulse. Hold Jump on contact, steer right, then release
  // the directional input over the reward shelf; its life box is stompable.
  level.reset(true); level.time = 0; level.update(0);
  const soloPlayer = new Player(scene), soloInput = input();
  soloInput.moveX = 1; soloInput.moveY = 0; soloInput.jumpHeld = true;
  soloPlayer.rawInput = soloInput;
  soloPlayer.pos.set(28, 29.45, -332); soloPlayer.prevPos.copy(soloPlayer.pos);
  soloPlayer.axisF.set(0, 0, -1); soloPlayer.axisL.set(1, 0, 0);
  soloPlayer.state = "air"; soloPlayer.grounded = false; soloPlayer.vVel = -1;
  let trampolineLaunched = false, soloLanded = false, soloPeak = 29.45;
  for (let frame = 0; frame < 300; frame++) {
    if (soloPlayer.pos.x >= 35) soloInput.moveX = 0;
    if (trampolineLaunched) soloInput.jumpHeld = false;
    soloPlayer.step(CONST.fixedStep, soloInput, level); level.update(CONST.fixedStep);
    if (soloPlayer.vVel >= 19.9) trampolineLaunched = true;
    soloPeak = Math.max(soloPeak, soloPlayer.pos.y);
    if (trampolineLaunched && soloPlayer.grounded && Math.abs(soloPlayer.pos.y - 33) < 0.1) {
      soloLanded = true; break;
    }
    if (soloPlayer.isBailing || soloPlayer.pos.y < 27) break;
  }
  const soloLanding = soloPlayer.pos.toArray().map(v => +v.toFixed(2));
  check(trampolineLaunched && soloLanded && soloPlayer.pos.x >= 32 && soloPlayer.pos.x <= 38,
    "held-Jump trampoline cannot deliver the reward shelf: " + JSON.stringify({ trampolineLaunched, soloLanded, at: soloLanding, state: soloPlayer.state }));
  let soloReturned = false;
  if (soloLanded) {
    // Back-left passes outside the bounce pad, dropping onto the broad stage.
    soloInput.moveX = -1; soloInput.moveY = -1;
    for (let frame = 0; frame < 180; frame++) {
      soloPlayer.step(CONST.fixedStep, soloInput, level); level.update(CONST.fixedStep);
      if (soloPlayer.grounded && Math.abs(soloPlayer.pos.y - 29) < 0.1 && soloPlayer.pos.x < 32) {
        soloReturned = true; break;
      }
      if (soloPlayer.isBailing || soloPlayer.pos.y < 27) break;
    }
  }
  check(soloReturned, "optional solo cannot return cleanly to the reunion stage: " + soloPlayer.pos.toArray().join(","));
  const solo = { trampolineLaunched, shelf: soloLanding, peak: +soloPeak.toFixed(2), returned: soloReturned,
    reunion: soloPlayer.pos.toArray().map(v => +v.toFixed(2)) };
  scene.remove(soloPlayer.group);

  // A held-forward run must negotiate the broad downhill bends using the
  // shipped 60-degree/second high-speed carve, without an AI steering helper.
  const downhillRuns = [];
  for (const [name, start, finishZ] of [
    ["overture", [0, 48.04, -12], -148],
    ["crescendo", [18, 28.04, -427], -605.5],
  ]) {
    level.reset(true); level.time = 0; level.update(0);
    const player = new Player(scene), controls = input();
    controls.jumpHeld = true;
    player.rawInput = controls; player.pos.fromArray(start); player.prevPos.copy(player.pos);
    const heading = level.laneDirAt(...start);
    player.axisF.set(heading.x, 0, heading.z); player.axisL.set(-heading.z, 0, heading.x);
    player.state = "ride"; player.grounded = true;
    player.freeSkate = true; player.skateOn = true; player.speed = TUNING.maxSpeed;
    player.groundHit = player.queryGround(level);
    if (player.groundHit) player.rideNormal.copy(player.groundHit.normal);
    let reached = false, boosted = false, frames = 0, peakSpeed = player.speed;
    for (; frames < 1200; frames++) {
      player.step(CONST.fixedStep, controls, level); level.update(CONST.fixedStep);
      peakSpeed = Math.max(peakSpeed, player.speed);
      if (player.activeSpeedPadId !== 0) boosted = true;
      if (player.pos.z <= finishZ) { reached = true; break; }
      if (player.isBailing || player.pos.y < 0 || player.state === "dead") break;
    }
    check(reached, "held-forward skate cannot follow " + name + " under factory grip: " + JSON.stringify({ at: player.pos.toArray(), state: player.state }));
    if (name === "crescendo") check(boosted, "final boost pad is not contacted by the real downhill run");
    downhillRuns.push({ name, reached, boosted, seconds: +(frames * CONST.fixedStep).toFixed(2),
      peakSpeed: +peakSpeed.toFixed(2), at: player.pos.toArray().map(v => +v.toFixed(2)) });
    scene.remove(player.group);
  }

  const grinds = [];
  for (const rail of strings) {
    level.reset(true); level.time = 0; level.update(0);
    const player = new Player(scene), controls = input();
    controls.grindHeld = true;
    player.rawInput = controls;
    player.pos.set(rail.points[0].x, 26.04, -234.5);
    player.prevPos.copy(player.pos);
    player.axisF.set(0, 0, -1); player.axisL.set(1, 0, 0);
    player.state = "ride"; player.grounded = true;
    player.freeSkate = true; player.skateOn = true; player.speed = 23;
    player.lastVelX = 0; player.lastVelZ = -23;
    player.railCand = { rail, ...rail.closest(player.pos) };
    check(player.tryGrind(true, level), "expert string cannot be acquired with forward grind input");
    let highestT = 0, peakBalance = 0, landed = false;
    for (let frame = 0; frame < 480; frame++) {
      // Ordinary counter-steering, not overriding the meter or the tuning.
      controls.moveX = Math.abs(player.balance) > 0.03 ? -Math.sign(player.balance) * 0.65 : 0;
      player.step(CONST.fixedStep, controls, level); level.update(CONST.fixedStep);
      highestT = Math.max(highestT, player.grindT);
      peakBalance = Math.max(peakBalance, Math.abs(player.balance));
      if (highestT > rail.totalLength - 0.5 && player.grounded) { landed = true; break; }
      if (player.isBailing || player.pos.y < 24) break;
    }
    check(landed && player.pos.z < -314 && player.pos.z > -334 && Math.abs(player.pos.y - 29) < 0.1,
      "expert string does not deliver a clean stage landing: " + JSON.stringify({ x: rail.points[0].x, highestT, state: player.state, at: player.pos.toArray() }));
    grinds.push({ x: rail.points[0].x, landed, peakBalance: +peakBalance.toFixed(3), at: player.pos.toArray().map(v => +v.toFixed(2)) });
    scene.remove(player.group);
  }

  // Full 3D deck-height camera nodes must always point down this monotonic route.
  const cursor = { s: -1 };
  let maximumTurn = 0, maximumTurnAt = null, previous = null;
  for (let z = 16; z >= -642; z -= 1) {
    const cams = data.components.filter(c => c.t === "camnode");
    let segment = 0;
    while (segment < cams.length - 2 && cams[segment + 1].p[2] > z) segment++;
    const a = cams[segment].p, b = cams[segment + 1].p;
    const t = Math.max(0, Math.min(1, (a[2] - z) / (a[2] - b[2] || 1)));
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const heading = level.laneDirAt(x, y, z, cursor);
    check(heading && heading.z < -0.65, "camera points away from the authored route near z=" + z);
    if (previous && heading) {
      const turn = Math.acos(Math.max(-1, Math.min(1, heading.x * previous.x + heading.z * previous.z))) * 180 / Math.PI;
      if (turn > maximumTurn) { maximumTurn = turn; maximumTurnAt = z; }
    }
    previous = heading;
  }
  check(maximumTurn < 5, "camera has an abrupt turn: " + maximumTurn + " degrees per metre");
  const cameraNodes = data.components.filter(c => c.t === "camnode");
  const routeLength = cameraNodes.reduce((sum, c, i) => i === 0 ? sum : sum +
    Math.hypot(...c.p.map((v, axis) => v - cameraNodes[i - 1].p[axis])), 0);
  const routeStation = z => {
    let station = 0;
    for (let i = 1; i < cameraNodes.length; i++) {
      const a = cameraNodes[i - 1].p, b = cameraNodes[i].p;
      const length = Math.hypot(...b.map((v, axis) => v - a[axis]));
      if (z <= a[2] && z >= b[2]) return station + length * (a[2] - z) / (a[2] - b[2]);
      station += length;
    }
    return station;
  };
  const metadata = { components: data.components.length, crates: level.totalCrates,
    authoredCrates: data.components.filter(c => c.t === "crate").length,
    looseFruit: data.components.filter(c => c.t === "wumpa").length,
    cameraRouteMetres: +routeLength.toFixed(1),
    spawnToFinishMetres: +(routeStation(gates[0].p[2]) - routeStation(data.spawn[2])).toFixed(1) };
  console.log(JSON.stringify({ metadata, surfaces, checkpoints: checkpoints.length, strings: strings.length,
    maximumCameraTurnDegreesPerMetre: +maximumTurn.toFixed(2), maximumTurnAt, jumps, solo, grinds, downhillRuns }, null, 2));
  assert.deepEqual(errors, [], "The Chimeworks geometry/playability audit failed");
  console.log("Validated The Chimeworks: source geometry, support, genuine gaps, moving keys, camera, " + jumps.length + " real-player jumps, trampoline solo/return, both full-length grind shortcuts and factory-grip downhill runs.");
} finally {
  level?.dispose();
  await server.close();
  console.warn = originalWarn; console.error = originalError;
}
