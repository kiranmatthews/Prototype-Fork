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
  const { CAMPAIGN_LEVELS, campaignLevelById } = await server.ssrLoadModule(
    "/src/campaign.ts",
  );
  const { swirls } = await server.ssrLoadModule("/src/swirls.ts");

  assert.equal(CAMPAIGN_LEVELS.length, 9);
  assert.equal(
    new Set(CAMPAIGN_LEVELS.map(({ progressKey }) => progressKey)).size,
    CAMPAIGN_LEVELS.length,
    "campaign progress keys are not unique",
  );

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
    boardSample.position,
    boardSample.tangent,
    1 / 60,
    "boardslide",
  );
  assert.equal(player.state, "grind");
  assert.equal(player.surfaceName, "map boardslide rail");

  console.log(
    "Validated map hub return focus/support, locked branching navigation, trail/boardslide sampling, fallback identity, exit routing, and snap-facing order.",
  );
  swirls.clear();
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  warpLevel?.dispose();
  await server.close();
}
