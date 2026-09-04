import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
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

function levelData({
  name = "Nitro clear fixture",
  nitros = 1,
  wood = 0,
  gate = true,
  yaw = 0,
  authoredSwitch = false,
  bonus = false,
} = {}) {
  const sideways = Math.abs(yaw) % 180 === 90;
  const spawn = sideways ? [-18, 0.1, 0] : [0, 0.1, 18];
  const finish = sideways ? [18, 0, 0] : [0, 0, -18];
  const components = [
    { t: "platform", p: [0, -0.5, 0], s: [44, 1, 44] },
    ...Array.from({ length: nitros }, (_, index) => ({
      t: "crate",
      p: sideways ? [-5 + index * 3, 0, 0] : [index * 3, 0, 0],
      kind: "nitro",
    })),
    ...Array.from({ length: wood }, (_, index) => ({
      t: "crate",
      p: sideways ? [2 + index * 3, 0, 3] : [-4 - index * 3, 0, 3],
      kind: "wood",
    })),
  ];
  if (authoredSwitch)
    components.push({
      t: "crate",
      p: sideways ? [12, 0, 0] : [0, 0, -12],
      kind: "nitrobang",
    });
  if (sideways)
    components.push({ t: "zone", p: [0, 0, 0], s: [44, 1, 12], dir: "E" });
  if (gate) components.push({ t: "gate", p: finish, yaw });
  return {
    v: 1,
    name,
    spawn,
    killY: -20,
    ...(bonus ? { hudMode: "bonus" } : {}),
    components,
    groups: [],
  };
}

function generatedSwitches(level) {
  return level.crates.filter((crate) => crate.systemicEndNitroBang === true);
}

function nitros(level) {
  return level.crates.filter((crate) => crate.nitro === true);
}

function activeFruit(player) {
  return player.fruits.filter((fruit) => fruit.phase !== "off").length;
}

installHeadlessDom();
const server = await createServer({
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

const fixtures = [];
try {
  const { BUILTIN_LEVELS, Level } = await server.ssrLoadModule("/src/level.ts");
  const { Player } = await server.ssrLoadModule("/src/player.ts");
  const { swirls } = await server.ssrLoadModule("/src/swirls.ts");

  const create = (id, options = {}) => {
    const scene = new THREE.Scene();
    const data = levelData(options);
    const level = new Level(scene, { id, name: data.name, data });
    fixtures.push(level);
    return { scene, data, level };
  };

  // A finish-bearing Nitro level gets one uncounted, system-owned clear switch.
  const normal = create("nitro-clear-normal", { nitros: 2, wood: 1 });
  const normalSwitches = generatedSwitches(normal.level);
  assert.equal(normalSwitches.length, 1, "Nitro level did not get exactly one systemic switch");
  assert.equal(normal.level.crates.filter((crate) => crate.nitroBang).length, 1);
  assert.equal(normal.level.totalCrates, 3, "systemic switch entered the box tally");
  assert.deepEqual(
    {
      nitros: normal.level.nitroClearDiagnostics.nitros,
      switches: normal.level.nitroClearDiagnostics.switches,
      generated: normal.level.nitroClearDiagnostics.generated,
    },
    { nitros: 2, switches: 1, generated: 1 },
  );
  assert.ok(
    Number.isFinite(normal.level.nitroClearDiagnostics.gateDistance) &&
      normal.level.nitroClearDiagnostics.gateDistance > 0,
    "systemic switch has no finite finish-gate distance",
  );
  assert.ok(
    normalSwitches[0].mesh.position.z > -18,
    "yaw-0 systemic switch was not placed on the gate approach",
  );
  assert.ok(
    Math.abs(normalSwitches[0].box.min.y) < 0.15,
    "systemic switch is not seated on its supported deck",
  );

  // Runtime system furniture must not become authored editor data.
  assert.equal(
    normal.level.captureData().components.filter(
      (component) => component.t === "crate" && component.kind === "nitrobang",
    ).length,
    0,
    "generated switch leaked into data-level capture",
  );

  // Authored switches win and remain authored; no second systemic copy appears.
  const authored = create("nitro-clear-authored", {
    nitros: 1,
    authoredSwitch: true,
  });
  assert.equal(generatedSwitches(authored.level).length, 0);
  assert.deepEqual(
    {
      nitros: authored.level.nitroClearDiagnostics.nitros,
      switches: authored.level.nitroClearDiagnostics.switches,
      generated: authored.level.nitroClearDiagnostics.generated,
    },
    { nitros: 1, switches: 1, generated: 0 },
  );
  assert.equal(
    authored.level.captureData().components.filter(
      (component) => component.t === "crate" && component.kind === "nitrobang",
    ).length,
    1,
    "authored Nitro switch was removed from capture",
  );

  // A no-Nitro level, a gate-less level, and the hub never get the system box.
  const noNitro = create("nitro-clear-none", { nitros: 0, wood: 1 });
  assert.equal(generatedSwitches(noNitro.level).length, 0);
  assert.deepEqual(noNitro.level.nitroClearDiagnostics, {
    nitros: 0,
    switches: 0,
    generated: 0,
    gateDistance: null,
  });

  // Custom-level migration normally supplies a gate. Strip that migrated gate
  // at the build boundary to exercise the runtime no-gate policy directly.
  const originalBuildCustom = Level.prototype.buildCustom;
  Level.prototype.buildCustom = function buildWithoutGate(data) {
    data.components = data.components.filter((component) => component.t !== "gate");
    return originalBuildCustom.call(this, data);
  };
  let noGate;
  try {
    noGate = create("nitro-clear-no-gate", { nitros: 1, gate: false });
  } finally {
    Level.prototype.buildCustom = originalBuildCustom;
  }
  assert.equal(noGate.level.gateSpec, null);
  assert.equal(generatedSwitches(noGate.level).length, 0);
  assert.equal(noGate.level.nitroClearDiagnostics.nitros, 1);
  assert.equal(noGate.level.nitroClearDiagnostics.switches, 0);
  assert.equal(noGate.level.nitroClearDiagnostics.generated, 0);
  assert.equal(noGate.level.nitroClearDiagnostics.gateDistance, null);

  const hubScene = new THREE.Scene();
  const hub = new Level(hubScene, { id: "warproom", name: "The Warp Room" });
  fixtures.push(hub);
  assert.equal(hub.hudMode, "hub");
  assert.equal(generatedSwitches(hub).length, 0);
  assert.equal(hub.nitroClearDiagnostics.generated, 0);

  // Rotated gates use their actual approach side, not the default -Z corridor.
  const sideways = create("nitro-clear-sideways", { nitros: 1, yaw: 90 });
  const sideSwitch = generatedSwitches(sideways.level)[0];
  assert.ok(sideSwitch, "yaw-90 Nitro level has no systemic switch");
  assert.ok(
    sideSwitch.mesh.position.x < 18,
    "yaw-90 systemic switch was placed beyond rather than before the gate",
  );
  assert.ok(Math.abs(sideSwitch.box.min.y) < 0.15, "yaw-90 switch lost deck support");

  // Triggering spends but does not break/count the switch. Every Nitro enters
  // the player's tally exactly once and pays no fruit reward.
  const tallyPlayer = new Player(normal.scene);
  tallyPlayer.respawn(normal.level, true);
  const switchCrate = normalSwitches[0];
  normal.level.triggerBang(switchCrate);
  assert.equal(switchCrate.alive, true);
  assert.equal(switchCrate.bangUsed, true);
  assert.ok(nitros(normal.level).every((crate) => !crate.alive));
  assert.ok(normal.level.explosions.every((explosion) => explosion.safe));
  tallyPlayer.flushLevelCrateRewards(normal.level);
  assert.equal(tallyPlayer.cratesBroken, 2, "detonated Nitros did not enter the tally");
  assert.equal(activeFruit(tallyPlayer), 0, "detonated Nitros emitted fruit");
  assert.equal(normal.level.totalCrates, 3);

  const explosionCount = normal.level.explosions.length;
  normal.level.triggerBang(switchCrate);
  tallyPlayer.flushLevelCrateRewards(normal.level);
  assert.equal(tallyPlayer.cratesBroken, 2, "spent switch counted Nitros twice");
  assert.equal(normal.level.explosions.length, explosionCount, "spent switch detonated twice");

  normal.level.reset(true);
  assert.equal(switchCrate.bangUsed, false, "hard reset did not re-arm the switch");
  assert.ok(nitros(normal.level).every((crate) => crate.alive), "hard reset did not revive Nitros");
  tallyPlayer.cratesBroken = 0;
  normal.level.triggerBang(switchCrate);
  tallyPlayer.flushLevelCrateRewards(normal.level);
  assert.equal(tallyPlayer.cratesBroken, 2, "re-armed switch did not clear Nitros once");

  // Parent and bonus are separate Level owners. Neither green switch may reach
  // across the suspended-parent boundary.
  const parent = create("nitro-owner-parent", { nitros: 1 });
  const bonus = create("nitro-owner-bonus", { nitros: 1, bonus: true });
  const parentSwitch = generatedSwitches(parent.level)[0];
  const bonusSwitch = generatedSwitches(bonus.level)[0];
  assert.ok(parentSwitch && bonusSwitch);
  parent.level.setActive(false);
  parent.level.triggerBang(parentSwitch);
  assert.equal(nitros(parent.level)[0].alive, false);
  assert.equal(nitros(bonus.level)[0].alive, true, "parent switch detonated the bonus Nitro");
  assert.equal(bonus.level.consumeBlastBroken().length, 0);
  bonus.level.triggerBang(bonusSwitch);
  assert.equal(nitros(bonus.level)[0].alive, false);
  assert.equal(parent.level.consumeBlastBroken().length, 1);
  assert.equal(bonus.level.consumeBlastBroken().length, 1);

  // Hand-built capture has a different code path from data levels; its marker
  // must be filtered explicitly rather than serialized as authored furniture.
  const flatsScene = new THREE.Scene();
  const flats = new Level(flatsScene, { id: "flats", name: "Flats & Pipes" });
  fixtures.push(flats);
  assert.equal(generatedSwitches(flats).length, 1, "hand-built Nitro level lost its system switch");
  assert.equal(
    flats.captureData().components.filter(
      (component) => component.t === "crate" && component.kind === "nitrobang",
    ).length,
    0,
    "generated switch leaked through hand-built capture",
  );

  // Exercise the actual shipped registry and published overrides. A strict
  // support search is only useful if every current Nitro course can satisfy
  // it; this catches a switch silently disappearing after level geometry is
  // replaced or its gate rotates.
  const published = JSON.parse(
    await readFile(path.join(ROOT, "public/levels.json"), "utf8"),
  );
  const shippedEntries = [
    ...BUILTIN_LEVELS,
    ...(Array.isArray(published.levels) ? published.levels : []),
  ];
  for (const entry of shippedEntries) {
    const level = new Level(new THREE.Scene(), entry);
    fixtures.push(level);
    const diagnostics = level.nitroClearDiagnostics;
    if (diagnostics.nitros === 0) {
      assert.equal(
        diagnostics.generated,
        0,
        `${entry.name} received a useless generated Nitro switch`,
      );
      continue;
    }
    assert.equal(
      diagnostics.switches,
      1,
      `${entry.name} does not have exactly one Nitro clear switch`,
    );
    assert.equal(
      diagnostics.generated,
      1,
      `${entry.name} did not derive its Nitro clear switch`,
    );
    assert.ok(
      diagnostics.gateDistance >= 3 && diagnostics.gateDistance <= 25,
      `${entry.name} placed its Nitro switch outside the finish approach`,
    );
    const generated = generatedSwitches(level)[0];
    assert.ok(
      generated && Number.isFinite(generated.box.min.y),
      `${entry.name} generated an unsupported Nitro switch`,
    );
  }

  swirls.clear();
  console.log(
    "Validated systemic end Nitro switch placement, tally/reset semantics, Level ownership, and capture exclusion.",
  );
} finally {
  for (const level of fixtures.reverse()) {
    try {
      level.dispose();
    } catch {
      // A failed assertion should not hide the original failure behind teardown.
    }
  }
  // Player construction starts the same optional model loads as gameplay.
  // Their expected headless 404s settle just after the synchronous assertions;
  // keep the filter installed until those callbacks have drained.
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.warn = originalWarn;
  console.error = originalError;
  await server.close();
}
