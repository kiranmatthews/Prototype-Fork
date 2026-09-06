import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import ts from "typescript";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
      createLinearGradient: () => ({ addColorStop: noop }),
      createPattern: () => ({}),
      createRadialGradient: () => ({ addColorStop: noop }),
      getImageData(_x, _y, width, height) {
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
      measureText: (text) => ({ width: String(text).length * 8 }),
    },
    { get: (target, key) => (key in target ? target[key] : noop) },
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

function functionNamed(sourceFile, name) {
  let match = null;
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) match = node;
  });
  assert.ok(match?.body, `missing function ${name}`);
  return match;
}

function methodNamed(sourceFile, className, name) {
  let match = null;
  sourceFile.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== className) return;
    match = node.members.find(
      (member) => ts.isMethodDeclaration(member) && member.name.getText(sourceFile) === name,
    ) ?? null;
  });
  assert.ok(match?.body, `missing ${className}.${name}`);
  return match;
}

function callsNamed(node, name) {
  const calls = [];
  const visit = (child) => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === name
    )
      calls.push(child);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return calls;
}

function callsProperty(node, owner, property) {
  const calls = [];
  const visit = (child) => {
    if (
      ts.isCallExpression(child) &&
      ts.isPropertyAccessExpression(child.expression) &&
      child.expression.expression.getText() === owner &&
      child.expression.name.text === property
    )
      calls.push(child);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return calls;
}

function topLevelVariable(fn, name) {
  for (const statement of fn.body.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name)
        return { declaration, statement };
    }
  }
  assert.fail(`${fn.name.text} does not capture ${name}`);
}

function bodyBoxAt(position, half) {
  return new THREE.Box3(
    new THREE.Vector3(
      position.x - half.x,
      position.y,
      position.z - half.z,
    ),
    new THREE.Vector3(
      position.x + half.x,
      position.y + half.y * 2,
      position.z + half.z,
    ),
  );
}

function boxCorners(box) {
  const corners = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z])
        corners.push(new THREE.Vector3(x, y, z));
  return corners;
}

function worldBoxInLocalSpace(worldBox, owner) {
  owner.updateWorldMatrix(true, false);
  return new THREE.Box3().setFromPoints(
    boxCorners(worldBox).map((corner) => owner.worldToLocal(corner)),
  );
}

function assertSupported(level, pose, label) {
  const ray = new THREE.Raycaster(
    pose.position.clone().add(new THREE.Vector3(0, 3, 0)),
    new THREE.Vector3(0, -1, 0),
    0,
    6,
  );
  const support = ray.intersectObjects(level.groundMeshes, false)[0];
  assert.ok(support, `${label} return point has no floor support`);
  assert.ok(
    Math.abs(pose.position.y - support.point.y - 0.1) < 1e-5,
    `${label} return feet are not seated just above their live support`,
  );
  return support;
}

installHeadlessDom();

const [mainSource, playerSource] = await Promise.all([
  readFile(path.join(ROOT, "src", "main.ts"), "utf8"),
  readFile(path.join(ROOT, "src", "player.ts"), "utf8"),
]);
const mainAst = ts.createSourceFile(
  "main.ts",
  mainSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const returningFunctions = [
  ["quitCurrentLevel", "bonusSession?.parentEntry.id??current.id"],
  ["quitAfterGameOver", "current.id"],
  ["continueFromResults", "current.id"],
];
for (const [name, expectedOrigin] of returningFunctions) {
  const fn = functionNamed(mainAst, name);
  const origin = topLevelVariable(fn, "originLevelId");
  const transitions = callsProperty(fn, "gameFlow", "transition");
  assert.equal(transitions.length, 1, `${name} does not own one transition`);
  assert.ok(
    origin.statement.pos < transitions[0].pos,
    `${name} captures its origin after starting the transition`,
  );
  assert.equal(
    origin.declaration.initializer.getText(mainAst).replaceAll(/\s/g, ""),
    expectedOrigin,
    `${name} captures the wrong campaign origin`,
  );
  const returnCalls = callsNamed(transitions[0], "returnToWarpRoom");
  assert.equal(returnCalls.length, 1, `${name} does not use the shared return helper once`);
  assert.equal(returnCalls[0].arguments[0]?.getText(mainAst), "originLevelId");
}
assert.equal(
  callsNamed(mainAst, "returnToWarpRoom").length,
  returningFunctions.length,
  "a Warp Room exit bypassed or duplicated the three shared return paths",
);

const returnHelper = functionNamed(mainAst, "returnToWarpRoom");
const returnHelperText = returnHelper.getText(mainAst).replaceAll(/\s/g, "");
assert.match(
  returnHelperText,
  /campaignLevelById\(originLevelId\)\?\.progressKey\?\?null/,
  "the return helper does not canonicalize fallback level ids through progressKey",
);
const helperSwitches = callsNamed(returnHelper, "switchLevel");
assert.equal(helperSwitches.length, 1);
assert.equal(helperSwitches[0].arguments[0]?.text, "warproom");
assert.equal(helperSwitches[0].arguments[3]?.getText(mainAst), "returnFromKey");

for (const name of ["startNewCampaign", "loadCampaign"]) {
  const fn = functionNamed(mainAst, name);
  assert.equal(
    callsNamed(fn, "returnToWarpRoom").length,
    0,
    `${name} incorrectly inherited an old level's gate`,
  );
  const switches = callsNamed(fn, "switchLevel");
  assert.equal(switches.length, 1, `${name} does not enter one generic Warp Room`);
  assert.equal(switches[0].arguments[0]?.text, "warproom");
  assert.equal(
    switches[0].arguments.length,
    3,
    `${name} passes a return gate instead of using the generic hub spawn`,
  );
}

// Position is selected before settle consumes the heading; settle authors the
// visual body facing before its semantic teleport snap reaches the camera.
const playerAst = ts.createSourceFile(
  "player.ts",
  playerSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const respawnText = methodNamed(playerAst, "Player", "respawn").getText(playerAst);
assert.ok(
  respawnText.indexOf("this.pos.copy(placement?.position") <
    respawnText.indexOf("this.settle(level, placement?.heading)"),
  "Player settles facing before applying the Warp Room return position",
);
const settleText = methodNamed(playerAst, "Player", "settle").getText(playerAst);
const facingAt = settleText.indexOf("this.visualYaw = facing");
const bodyAt = settleText.indexOf("this.bodyGroup.rotation.y = this.visualYaw");
const snapAt = settleText.indexOf("this.snapRenderInterpolation()", bodyAt);
assert.ok(facingAt >= 0 && facingAt < bodyAt && bodyAt < snapAt);

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) =>
  /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(
    String(value ?? ""),
  );
console.warn = (...args) => {
  if (!expectedAssetLog(args[0])) originalWarn(...args);
};
console.error = (...args) => {
  if (!expectedAssetLog(args[0])) originalError(...args);
};

let warpLevel = null;
try {
  const { BUILTIN_LEVELS, Level } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const {
    CAMPAIGN_ISLANDS,
    CAMPAIGN_LEVELS,
    CAMPAIGN_MAP_EDGES,
    CampaignStore,
    campaignLevelById,
  } = await server.ssrLoadModule(
    "/src/campaign.ts",
  );
  const { WorldMapController } = await server.ssrLoadModule(
    "/src/worldMapController.ts",
  );
  const { swirls } = await server.ssrLoadModule("/src/swirls.ts");

  assert.equal(CAMPAIGN_LEVELS.length, 9);
  assert.equal(
    new Set(CAMPAIGN_LEVELS.map(({ progressKey }) => progressKey)).size,
    CAMPAIGN_LEVELS.length,
    "campaign progress keys are not unique",
  );
  const directionSlots = new Set();
  for (const edge of CAMPAIGN_MAP_EDGES) {
    for (const [key, direction] of [
      [edge.from, edge.fromDirection],
      [edge.to, edge.toDirection],
    ]) {
      const slot = `${key}:${direction}`;
      assert.ok(!directionSlots.has(slot), `duplicate map direction slot ${slot}`);
      directionSlots.add(slot);
    }
  }

  const warpEntry = BUILTIN_LEVELS.find(({ id }) => id === "warproom");
  assert.ok(warpEntry, "Warp Room entry is missing");
  const scene = new THREE.Scene();
  swirls.attach(scene);
  warpLevel = new Level(scene, warpEntry);
  warpLevel.root.updateMatrixWorld(true);
  assert.equal(warpLevel.isCampaignMap, true, "legacy hub did not build the world map");
  assert.equal(warpLevel.campaignPortals.length, 0, "legacy portal gallery still constructed");
  assert.equal(
    warpLevel.groundMeshes.filter(({ name }) => name === "world map level hub").length,
    CAMPAIGN_LEVELS.length,
    "every campaign destination needs one supported map hub",
  );
  assert.ok(warpLevel.water, "world map did not reuse the campaign ocean shader");
  assert.ok(warpLevel.water.params.causticsFade >= 120);
  assert.ok(warpLevel.water.params.causticsStrength > 1);
  assert.ok(warpLevel.water.params.depthDistance >= 0.7);
  assert.ok(warpLevel.water.params.reflectionFresnel <= 3);
  assert.ok(warpLevel.water.reflectionScale >= 0.4);

  const mapNames = [];
  warpLevel.root.traverse(({ name }) => mapNames.push(name));
  assert.equal(
    mapNames.filter((name) => name === "world map shallow caustic shelf").length,
    CAMPAIGN_ISLANDS.length + 4,
    "the archipelago does not expose broad opaque seabeds to the ocean prepass",
  );
  assert.equal(
    mapNames.filter((name) => name === "world map hub foundation").length,
    CAMPAIGN_LEVELS.length,
    "elevated hubs are missing visual terrain support",
  );
  assert.equal(
    mapNames.filter((name) => name === "world map route bed").length,
    9,
    "a graph edge is missing its supported trail/rail bed",
  );
  const campaignIslands = [];
  const markerRims = [];
  const routeDashes = [];
  let reefHeads = null;
  let coralFingers = null;
  warpLevel.root.traverse((object) => {
    if (object.name.startsWith("world map campaign island ")) campaignIslands.push(object);
    else if (object.name === "world map luminous marker rim") markerRims.push(object);
    else if (object.name === "world map glowing route") routeDashes.push(object);
    else if (object.name === "world map shallow reef heads") reefHeads = object;
    else if (object.name === "world map shallow coral fingers") coralFingers = object;
  });
  assert.equal(campaignIslands.length, CAMPAIGN_ISLANDS.length);
  for (const island of CAMPAIGN_ISLANDS) {
    const mesh = campaignIslands.find(({ name }) => name.endsWith(island.id));
    assert.ok(mesh, `${island.id} has no cohesive campaign island mass`);
    const bounds = new THREE.Box3().setFromObject(mesh);
    for (const key of island.levelKeys) {
      const definition = CAMPAIGN_LEVELS.find((level) => level.progressKey === key);
      assert.ok(definition);
      assert.ok(
        bounds.min.x < definition.mapPosition[0] &&
          bounds.max.x > definition.mapPosition[0] &&
          bounds.min.z < definition.mapPosition[2] &&
          bounds.max.z > definition.mapPosition[2],
        `${key} lies outside its cohesive ${island.id} silhouette`,
      );
    }
  }
  assert.equal(markerRims.length, CAMPAIGN_LEVELS.length);
  assert.equal(routeDashes.length, CAMPAIGN_MAP_EDGES.length);
  for (const route of routeDashes) {
    route.geometry.computeBoundingBox();
    const size = route.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x > 0.6 && size.z > 1.1, "route dashes lost their chunky Crash 4 read");
  }
  assert.equal(reefHeads.count, CAMPAIGN_ISLANDS.length * 18 + 4 * 5);
  assert.ok(coralFingers.count >= reefHeads.count * 2);
  assert.ok(coralFingers.instanceMatrix.count >= reefHeads.count * 4);

  const directionVector = {
    up: [0, 1],
    down: [0, -1],
    left: [-1, 0],
    right: [1, 0],
  };
  for (const edge of CAMPAIGN_MAP_EDGES) {
    assert.equal(
      warpLevel.campaignMapNeighbor(
        edge.from,
        ...directionVector[edge.fromDirection],
        () => true,
      ),
      edge.to,
      `${edge.from} cannot traverse ${edge.fromDirection} to ${edge.to}`,
    );
    assert.equal(
      warpLevel.campaignMapNeighbor(
        edge.to,
        ...directionVector[edge.toDirection],
        () => true,
      ),
      edge.from,
      `${edge.to} cannot traverse ${edge.toDirection} to ${edge.from}`,
    );
  }

  // Native Three shorelines use FrontSide. The map's -Z ocean must author its
  // first triangle upward, or only the flat DoubleSide horizon remains visible.
  const ribbonGeometry = warpLevel.water.ribbon.geometry;
  const ribbonPosition = ribbonGeometry.getAttribute("position");
  const ribbonIndex = ribbonGeometry.getIndex();
  assert.ok(ribbonIndex);
  const a = new THREE.Vector3().fromBufferAttribute(ribbonPosition, ribbonIndex.getX(0));
  const b = new THREE.Vector3().fromBufferAttribute(ribbonPosition, ribbonIndex.getX(1));
  const c = new THREE.Vector3().fromBufferAttribute(ribbonPosition, ribbonIndex.getX(2));
  const facing = b.clone().sub(a).cross(c.clone().sub(a));
  assert.ok(facing.y > 0, "MatrixRex map ribbon is backface-culled from above");

  const shelves = [];
  warpLevel.root.traverse((object) => {
    if (object.name === "world map shallow caustic shelf") shelves.push(object);
  });
  for (const shelf of shelves) {
    shelf.geometry.computeBoundingBox();
    assert.ok(
      shelf.position.y + shelf.geometry.boundingBox.max.y < warpLevel.water.seaLevel,
      "a caustic shelf rises above the water instead of feeding opaque depth",
    );
  }

  const mountains = [];
  warpLevel.root.traverse((object) => {
    if (object.name === "world map mountain") mountains.push(object);
  });
  for (const definition of CAMPAIGN_LEVELS.filter(({ boss }) => boss)) {
    const [x, , z] = definition.mapPosition;
    for (const mountain of mountains) {
      const bounds = new THREE.Box3().setFromObject(mountain);
      assert.ok(
        x < bounds.min.x || x > bounds.max.x || z < bounds.min.z || z > bounds.max.z,
        `${definition.name} boss hub is embedded inside a mountain`,
      );
    }
  }

  const positionKeys = new Set();

  for (const definition of CAMPAIGN_LEVELS) {
    const pose = warpLevel.campaignPortalReturnPose(definition.progressKey);
    assert.ok(pose, `${definition.name} has no return pose`);
    positionKeys.add(pose.position.toArray().map((value) => value.toFixed(6)).join(","));

    assert.ok(
      Math.abs(pose.heading.length() - 1) < 1e-10,
      `${definition.name} return heading is not normalized`,
    );
    assert.ok(
      pose.heading.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-10,
      `${definition.name} map pose does not use the canonical map heading`,
    );

    const support = assertSupported(warpLevel, pose, definition.name);
    assert.equal(support.object.name, "world map level hub");
    const terrainRay = new THREE.Raycaster(
      pose.position.clone().add(new THREE.Vector3(0, 10, 0)),
      new THREE.Vector3(0, -1, 0),
    );
    const terrain = terrainRay.intersectObjects(campaignIslands, false)[0];
    assert.ok(terrain && terrain.point.y < pose.position.y - 0.18,
      `${definition.name} marker is buried in the island sculpt`);
    assert.deepEqual(
      pose.position.toArray(),
      [...definition.mapPosition],
      `${definition.name} return did not focus its authored hub`,
    );

    const baselinePosition = pose.position.toArray();
    const baselineHeading = pose.heading.toArray();
    const second = warpLevel.campaignPortalReturnPose(definition.progressKey);
    assert.notEqual(second.position, pose.position, `${definition.name} reused its position vector`);
    assert.notEqual(second.heading, pose.heading, `${definition.name} reused its heading vector`);
    pose.position.set(999, 999, 999);
    pose.heading.set(9, 9, 9);
    const pristine = warpLevel.campaignPortalReturnPose(definition.progressKey);
    assert.deepEqual(pristine.position.toArray(), baselinePosition);
    assert.deepEqual(pristine.heading.toArray(), baselineHeading);
  }
  assert.equal(
    positionKeys.size,
    CAMPAIGN_LEVELS.length,
    "two campaign progress keys share one return pose",
  );

  const testCourse = campaignLevelById("test");
  const testFallback = campaignLevelById("flats");
  assert.ok(testCourse && testFallback);
  assert.equal(testFallback.progressKey, "test-course");
  assert.equal(testFallback.progressKey, testCourse.progressKey);
  assert.deepEqual(
    warpLevel.campaignPortalReturnPose(testFallback.progressKey).position.toArray(),
    warpLevel.campaignPortalReturnPose(testCourse.progressKey).position.toArray(),
    "Test Course fallback did not canonicalize to its progress-key gate",
  );

  const onlyStart = new Set(["jungle"]);
  assert.equal(
    warpLevel.campaignMapNeighbor("jungle", 1, 0, (key) => onlyStart.has(key)),
    null,
    "a locked destination accepted map navigation",
  );
  const firstPair = new Set(["jungle", "test-course"]);
  assert.equal(
    warpLevel.campaignMapNeighbor("jungle", 1, 0, (key) => firstPair.has(key)),
    "test-course",
    "right did not select the first connected unlocked hub",
  );
  const branch = new Set(["test-course", "sky-bridge", "slipstream"]);
  assert.equal(
    warpLevel.campaignMapNeighbor("test-course", 0, 1, (key) => branch.has(key)),
    "slipstream",
    "up did not select the upper-screen branch",
  );
  assert.equal(
    warpLevel.campaignMapNeighbor("test-course", 0, -1, (key) => branch.has(key)),
    "sky-bridge",
    "down did not select the lower-screen branch",
  );

  const trailStart = warpLevel.campaignMapTravel("jungle", "test-course", 0);
  const trailEnd = warpLevel.campaignMapTravel("jungle", "test-course", 1);
  assert.ok(trailStart && trailEnd);
  assert.equal(trailStart.style, "trail");
  assert.ok(trailStart.duration > 0);
  assert.ok(
    trailStart.position.distanceTo(warpLevel.campaignMapPose("jungle").position) < 1e-10,
  );
  assert.ok(
    trailEnd.position.distanceTo(warpLevel.campaignMapPose("test-course").position) < 1e-10,
  );
  const boardSample = warpLevel.campaignMapTravel(
    "nightworks",
    "beachside-run",
    0.5,
  );
  assert.ok(boardSample);
  assert.equal(boardSample.style, "boardslide");
  assert.ok(boardSample.position.y > 5, "inter-island boardslide has no authored lift");
  const steepBoardSample = Array.from({ length: 101 }, (_, index) =>
    warpLevel.campaignMapTravel("nightworks", "beachside-run", index / 100),
  ).reduce((steepest, sample) =>
    Math.abs(sample.tangent.y) > Math.abs(steepest.tangent.y) ? sample : steepest,
  );
  assert.ok(
    Math.abs(steepBoardSample.tangent.y) > 0.2,
    "authored map rail lost its vertical tangent",
  );

  // Returning from a course still uses the semantic respawn snap, then the map
  // controller can author a canned rail pose without invoking gameplay input.
  const player = new Player(scene);
  const placement = warpLevel.campaignPortalReturnPose(testCourse.progressKey);
  const originalSnap = player.snapRenderInterpolation.bind(player);
  let stateAtSnap = null;
  player.snapRenderInterpolation = function snapWithAssertionPoint() {
    stateAtSnap = {
      position: this.pos.clone(),
      visualYaw: this.visualYaw,
      bodyYaw: this.bodyGroup.rotation.y,
    };
    originalSnap();
  };
  const snapVersion = player.renderSnapVersion;
  player.respawn(warpLevel, true, false, placement);
  assert.ok(stateAtSnap, "return placement never issued a semantic snap");
  assert.ok(stateAtSnap.position.distanceTo(placement.position) < 1e-10);
  const facingAtSnap = new THREE.Vector3(
    Math.sin(stateAtSnap.visualYaw + Math.PI),
    0,
    Math.cos(stateAtSnap.visualYaw + Math.PI),
  );
  assert.ok(facingAtSnap.distanceTo(placement.heading) < 1e-10);
  assert.ok(Math.abs(stateAtSnap.bodyYaw - stateAtSnap.visualYaw) < 1e-10);
  assert.equal(player.renderSnapVersion, snapVersion + 1);
  assert.ok(player.renderPosition.distanceTo(placement.position) < 1e-10);
  player.stepWorldMapPresentation(
    steepBoardSample.position,
    steepBoardSample.tangent,
    1 / 60,
    "boardslide",
  );
  assert.equal(player.state, "grind");
  assert.equal(player.surfaceName, "map boardslide rail");
  assert.ok(
    Math.abs(player.bodyGroup.rotation.x) > 0.03,
    "map boardslide deck and rider stayed horizontal on a steep rail",
  );
  const removeScaleOverlay = player.setAuthoredPoseOverlay(() => {});
  const originalScale = player.group.scale.clone();
  player.setWorldMapPresentationScale(3);
  player.stepWorldMapPresentation(placement.position, placement.heading, 1 / 60, "idle");
  player.commitRenderStep(warpLevel);
  player.applyRenderInterpolation(0.5);
  player.setWorldMapPresentationScale(null);
  player.stepWorldMapPresentation(placement.position, placement.heading, 1 / 60, "idle");
  assert.deepEqual(player.group.scale.toArray(), originalScale.toArray(),
    "an authored animation snapshot reapplied map scale after leaving the menu");
  removeScaleOverlay();

  const controllerStore = new CampaignStore();
  controllerStore.startEphemeral();
  const controllerModes = [];
  const selections = [];
  const entered = [];
  const sections = [];
  const fakePlayer = {
    group: new THREE.Group(),
    setWorldMapPresentationScale(scale) {
      this.group.scale.setScalar(scale ?? 1);
    },
    renderPosition: new THREE.Vector3(),
    stepWorldMapPresentation(position, _tangent, _dt, mode) {
      this.renderPosition.copy(position);
      controllerModes.push(mode);
    },
    snapRenderInterpolation() {},
  };
  const controller = new WorldMapController(controllerStore, fakePlayer, {
    onSelection: (key, moving, directions) => selections.push({ key, moving, directions }),
    onEnterLevel: (id) => entered.push(id),
    onOpenSection: (section) => sections.push(section),
  });
  controller.activate(warpLevel, null);
  assert.deepEqual(fakePlayer.group.scale.toArray(), [3, 3, 3]);
  assert.equal(controller.selectedKey, "jungle");
  assert.deepEqual(selections.at(-1).directions, {
    up: false,
    down: false,
    left: false,
    right: false,
  });
  controllerStore.commitClear("jungle", {
    crystal: false,
    boxGem: false,
    comboGem: false,
  });
  controller.refresh();
  assert.equal(selections.at(-1).directions.right, true);
  assert.equal(controller.navigate(1, 0), true);
  const neutralInput = {
    moveX: 0,
    moveY: 0,
    mapDirectionX: 0,
    mapDirectionY: 0,
    confirmPressed: false,
    jumpPressed: false,
    mapProgressPressed: false,
    grindPressed: false,
    mapSaveLoadPressed: false,
    spinPressed: false,
    mapQuitPressed: false,
    grabPressed: false,
  };
  for (let frame = 0; frame < 180 && controller.moving; frame++)
    controller.step(1 / 60, neutralInput);
  assert.equal(controller.selectedKey, "test-course");
  assert.equal(controllerStore.recommendedMapLevelKey(), "test-course");
  assert.ok(controllerModes.includes("walk"));

  for (const id of ["test", "sky", "slip"])
    controllerStore.commitClear(id, {
      crystal: false,
      boxGem: false,
      comboGem: false,
    });
  controller.activate(warpLevel, "slipstream");
  controllerModes.length = 0;
  assert.equal(controller.navigate(0, 1), true);
  for (let frame = 0; frame < 240 && controller.moving; frame++)
    controller.step(1 / 60, neutralInput);
  assert.equal(controller.selectedKey, "nightworks");
  assert.ok(controllerModes.includes("walk"), "boardslide has no canned mount/landing beat");
  assert.ok(controllerModes.includes("boardslide"), "boardslide rail pose was never presented");
  controller.revealUnlocks(["nightworks"]);
  const revealedNode = warpLevel.campaignWorldMap.nodeByKey.get("nightworks");
  assert.ok(revealedNode.unlockReveal > 2, "new path reveal did not arm its hub pulse");
  const revealBeforeTick = revealedNode.unlockReveal;
  warpLevel.update(0.25);
  assert.ok(revealedNode.unlockReveal < revealBeforeTick, "hub reveal animation did not advance");
  controller.enterSelected();
  controller.openSection("progress");
  assert.deepEqual(entered, ["dark"]);
  assert.deepEqual(sections, ["progress"]);
  controller.deactivate();
  assert.deepEqual(fakePlayer.group.scale.toArray(), [1, 1, 1], "map scale leaked into gameplay");
  controller.activate(warpLevel, "jungle");
  controller.activate(warpLevel, "jungle");
  assert.deepEqual(fakePlayer.group.scale.toArray(), [3, 3, 3], "repeated map activation compounded scale");
  controller.deactivate();

  console.log(
    "Validated cohesive island masses, Crash-style marker routes, visible MatrixRex shelves, supported hubs, reversible branching, controller travel, boardslide staging, persistent focus, exit routing, and snap-facing order.",
  );
  swirls.clear();
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  warpLevel?.dispose();
  await server.close();
}
