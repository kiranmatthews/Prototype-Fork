import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// This is deliberately a runtime test, not a second implementation of the
// editor schema. Vite loads the real TypeScript modules and the small DOM shim
// supplies only the canvas/image surface needed to build Levels in Node.
// Nothing is rendered, persisted to disk, or written to browser storage.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STRICT_HAND_BUILT = process.argv.includes("--strict-hand-built");
const inputPaths = process.argv
  .slice(2)
  .filter((arg) => arg !== "--strict-hand-built")
  .map((arg) => path.resolve(process.cwd(), arg));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function installHeadlessDom() {
  const storage = new Map();
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

  globalThis.window = {
    location: { search: "?lite" },
    addEventListener() {},
    removeEventListener() {},
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
        return { addColorStop() {} };
      },
      createPattern() {
        return {};
      },
      createRadialGradient() {
        return { addColorStop() {} };
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
        return key in target ? target[key] : () => {};
      },
    },
  );

  const makeCanvas = () => {
    const canvas = {
      height: 1,
      style: {},
      width: 1,
      getContext() {
        context.canvas = canvas;
        return context;
      },
    };
    return canvas;
  };

  globalThis.document = {
    fonts: null,
    createElement(tag) {
      return tag === "canvas"
        ? makeCanvas()
        : { style: {}, addEventListener() {}, removeEventListener() {} };
    },
    createElementNS(_namespace, tag) {
      return this.createElement(tag);
    },
  };

  globalThis.Image = class HeadlessImage {
    addEventListener(type, callback) {
      if (type === "error") queueMicrotask(callback);
    }
    removeEventListener() {}
    set src(_value) {
      queueMicrotask(() => this.onerror?.(new Error("headless image")));
    }
  };

  // Three's FileLoader constructs a Request before calling fetch. Resolve its
  // browser-relative model URL, then answer 404 so async art falls back to the
  // same placeholder geometry the game deliberately uses while assets load.
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

function round(value, places = 6) {
  if (!Number.isFinite(value)) return String(value);
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function numericArray(value) {
  return Array.from(value, (item) => round(Number(item)));
}

function arrayDigest(array) {
  if (!array) return null;
  let sum = 0;
  let abs = 0;
  let weighted = 0;
  for (let i = 0; i < array.length; i++) {
    const value = Number(array[i]);
    sum += value;
    abs += Math.abs(value);
    weighted += value * ((i % 97) + 1);
  }
  return [array.length, round(sum), round(abs), round(weighted)];
}

function geometryContract(geometry) {
  if (!geometry) return null;
  geometry.computeBoundingBox?.();
  const position = geometry.attributes?.position?.array;
  const index = geometry.index?.array;
  return {
    box: geometry.boundingBox
      ? [
          ...numericArray(geometry.boundingBox.min.toArray()),
          ...numericArray(geometry.boundingBox.max.toArray()),
        ]
      : null,
    index: arrayDigest(index),
    position: arrayDigest(position),
    type: geometry.type,
  };
}

function textureContract(texture) {
  if (!texture) return null;
  return {
    anisotropy: texture.anisotropy,
    center: texture.center ? numericArray(texture.center.toArray()) : null,
    colorSpace: texture.colorSpace,
    flipY: texture.flipY,
    format: texture.format,
    generateMipmaps: texture.generateMipmaps,
    magFilter: texture.magFilter,
    mapping: texture.mapping,
    minFilter: texture.minFilter,
    offset: texture.offset ? numericArray(texture.offset.toArray()) : null,
    premultiplyAlpha: texture.premultiplyAlpha,
    repeat: texture.repeat ? numericArray(texture.repeat.toArray()) : null,
    rotation: round(texture.rotation ?? 0),
    type: texture.type,
    unpackAlignment: texture.unpackAlignment,
    wrapS: texture.wrapS,
    wrapT: texture.wrapT,
  };
}

function materialContract(material) {
  if (!material) return null;
  if (Array.isArray(material)) return material.map(materialContract);
  const color = (key) =>
    material[key]?.isColor ? `#${material[key].getHexString()}` : null;
  return {
    alphaTest: round(material.alphaTest ?? 0),
    alphaToCoverage: material.alphaToCoverage,
    blending: material.blending,
    blendDst: material.blendDst,
    blendEquation: material.blendEquation,
    blendSrc: material.blendSrc,
    color: color("color"),
    colorWrite: material.colorWrite,
    depthFunc: material.depthFunc,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    dithering: material.dithering,
    emissive: color("emissive"),
    emissiveIntensity: round(material.emissiveIntensity ?? 1),
    flatShading: material.flatShading,
    fog: material.fog,
    map: textureContract(material.map),
    metalness: round(material.metalness ?? 0),
    opacity: round(material.opacity),
    polygonOffset: material.polygonOffset,
    polygonOffsetFactor: round(material.polygonOffsetFactor ?? 0),
    polygonOffsetUnits: round(material.polygonOffsetUnits ?? 0),
    premultipliedAlpha: material.premultipliedAlpha,
    roughness: round(material.roughness ?? 0),
    shininess: round(material.shininess ?? 0),
    side: material.side,
    specular: color("specular"),
    toneMapped: material.toneMapped,
    transparent: material.transparent,
    type: material.type,
    vertexColors: material.vertexColors,
    visible: material.visible,
    wireframe: material.wireframe,
  };
}

function objectContract(value, seen) {
  value.updateWorldMatrix?.(true, false);
  return {
    castShadow: value.castShadow,
    customDepthMaterial: materialContract(value.customDepthMaterial),
    customDistanceMaterial: materialContract(value.customDistanceMaterial),
    frustumCulled: value.frustumCulled,
    geometry: geometryContract(value.geometry),
    instanceColor: arrayDigest(value.instanceColor?.array),
    instanceMatrix: arrayDigest(value.instanceMatrix?.array),
    layers: value.layers?.mask,
    material: materialContract(value.material),
    matrixAutoUpdate: value.matrixAutoUpdate,
    matrixWorld: value.matrixWorld ? numericArray(value.matrixWorld.elements) : null,
    name: value.name,
    position: numericArray(value.position.toArray()),
    quaternion: numericArray(value.quaternion.toArray()),
    receiveShadow: value.receiveShadow,
    renderOrder: value.renderOrder,
    scale: numericArray(value.scale.toArray()),
    type: value.type,
    userData: contractValue(value.userData, seen),
    visible: value.visible,
  };
}

function sceneGraphContract(root) {
  root.updateMatrixWorld(true);
  const rows = [];
  const walk = (object, pathParts) => {
    rows.push({
      path: pathParts.join("/"),
      value: objectContract(object, new WeakSet()),
    });
    object.children.forEach((child, index) =>
      walk(child, [...pathParts, `${index}:${child.name || child.type}`]),
    );
  };
  walk(root, [root.name || root.type]);
  return rows;
}

const OMIT_OBJECT_KEYS = new Set([
  "geometry",
  "material",
  "parent",
  "children",
  "matrix",
  "matrixWorld",
  "matrixWorldInverse",
  "modelViewMatrix",
  "normalMatrix",
]);

function contractValue(value, seen = new WeakSet()) {
  if (value === undefined) return "<undefined>";
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") return round(value);
  if (typeof value === "function") return "<function>";
  if (ArrayBuffer.isView(value)) return numericArray(value);
  if (Array.isArray(value)) return value.map((item) => contractValue(item, seen));
  if (typeof value !== "object") return String(value);

  if (value.isVector2 || value.isVector3 || value.isVector4 || value.isQuaternion)
    return numericArray(value.toArray());
  if (value.isEuler)
    return [...numericArray(value.toArray().slice(0, 3)), value.order];
  if (value.isColor) return `#${value.getHexString()}`;
  if (value.isBox2 || value.isBox3)
    return [
      ...numericArray(value.min.toArray()),
      ...numericArray(value.max.toArray()),
    ];
  if (value.isBufferGeometry) return geometryContract(value);
  if (value.isMaterial) return materialContract(value);
  if (value.isTexture) return textureContract(value);
  if (value.isObject3D) return objectContract(value, seen);
  if (value instanceof Map) {
    return [...value.entries()].map(([key, item]) => [
      contractValue(key, seen),
      contractValue(item, seen),
    ]);
  }
  if (value instanceof Set) return [...value].map((item) => contractValue(item, seen));
  if (seen.has(value)) return "<cycle>";
  seen.add(value);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (OMIT_OBJECT_KEYS.has(key)) continue;
    out[key] = contractValue(value[key], seen);
  }
  seen.delete(value);
  return out;
}

const GAMEPLAY_COLLECTIONS = [
  "groundMeshes",
  "walls",
  "killBoxes",
  "pitBoxes",
  "tumbleBoxes",
  "rails",
  "crateRails",
  "halfpipes",
  "zones",
  "crates",
  "enemies",
  "stones",
  "checkpoints",
  "pickups",
  "movers",
  "crumbles",
  "ropes",
  "crushers",
  "pendulums",
  "ropeSwings",
  "torches",
  "phasePads",
  "movingRails",
  "trickGates",
  "trickRails",
  "returnPortals",
  "grindosauri",
  "angryBalls",
];

function roadRibbonContract(road) {
  if (!road) return null;
  const samples = [];
  for (const t of [0, 0.125, 0.5, 0.875, 1]) {
    for (const [offset, height] of [
      [0, 0],
      [1.25, 0.75],
    ]) {
      const point = road.frame(t, offset, height);
      samples.push([t, offset, height, ...numericArray(point.toArray())]);
    }
  }
  return { len: round(road.len), samples, width: round(road.width) };
}

function waterContract(water) {
  if (!water) return null;
  return {
    debug: contractValue(water.debug),
    group: sceneGraphContract(water.group),
    params: contractValue(water.params),
    quality: water.quality,
    seaLevel: round(water.seaLevel),
    shore: contractValue(water.shore),
    stats: contractValue(water.stats),
    type: water.constructor?.name,
  };
}

function levelContract(level) {
  const contract = {
    activeCheckpoint: contractValue(level.activeCheckpoint),
    allBalanceCrates: level.allBalanceCrates,
    batchDecor: level.batchDecor,
    boulder: contractValue(level.boulder),
    chaseCam: level.chaseCam,
    clockPickup: contractValue(level.clockPickup),
    clockSpot: contractValue(level.clockSpot),
    coastBoundary: contractValue(level.coastBoundary),
    comboGem: contractValue(level.comboGem),
    comboOrb: contractValue(level.comboOrb),
    crystalPickup: contractValue(level.crystalPickup),
    endWallZ: round(level.endWallZ),
    finishBox: contractValue(level.finishBox),
    finishGlow: contractValue(level.finishGlow),
    finishZ: round(level.finishZ),
    gateSpec: contractValue(level.gateSpec),
    gateYaw: round(level.gateYaw),
    gemPickup: contractValue(level.gemPickup),
    keepPlayFog: level.keepPlayFog,
    killY: round(level.killY),
    laneArc: contractValue(level.laneArc),
    lanePts: contractValue(level.lanePts),
    liteDecor: level.liteDecor,
    name: level.name,
    noFogLevel: level.noFogLevel,
    orbSpot: contractValue(level.orbSpot),
    perfectGrindBoost: level.perfectGrindBoost,
    pitPolyByBox: contractValue(level.pitPolyByBox),
    roadRibbon: roadRibbonContract(level.roadRibbon),
    root: sceneGraphContract(level.pickRoot),
    skyPreset: level.skyPreset,
    spawnPos: contractValue(level.spawnPos),
    theme: contractValue(level.theme),
    warpPads: contractValue(level.warpPads),
    water: waterContract(level.water),
  };
  for (const key of GAMEPLAY_COLLECTIONS)
    contract[key] = contractValue(level[key]);
  return contract;
}

function changedTopLevelKeys(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

function extractLevelCases(payload, source) {
  if (payload?.v === 2 && Array.isArray(payload.levels)) {
    return payload.levels.flatMap((entry, index) =>
      entry?.data
        ? [
            {
              data: entry.data,
              id: String(entry.id ?? `entry-${index}`),
              name: String(entry.name ?? entry.data.name ?? `entry ${index}`),
              source,
            },
          ]
        : [],
    );
  }
  if (payload?.data?.v === 1 && Array.isArray(payload.data.components)) {
    return [
      {
        data: payload.data,
        id: String(payload.id ?? "entry"),
        name: String(payload.name ?? payload.data.name ?? "entry"),
        source,
      },
    ];
  }
  if (payload?.v === 1 && Array.isArray(payload.components)) {
    return [
      {
        data: payload,
        id: "level",
        name: String(payload.name ?? "level"),
        source,
      },
    ];
  }
  throw new Error(`${source}: expected CustomLevelData, LevelEntry, or v2 level pack`);
}

const NEW_PRIMITIVE_FIXTURE = {
  v: 1,
  name: "Editor Primitive Sentinel",
  spawn: [0, 0.6, 16],
  killY: -20,
  sky: "night",
  components: [
    { t: "platform", p: [0, -0.5, -20], s: [190, 1, 90], tex: "stone" },

    // Every new primitive once with only its required fields: omitted values
    // are part of the editor/runtime contract, not missing test coverage.
    { t: "woodpath", p: [-82, 0.1, 10] },
    { t: "wallpath", p: [-74, 0.1, 10] },
    { t: "trampoline", p: [-40, 0, 10] },
    { t: "speedpad", p: [-28, 0, 10] },
    { t: "trickgate", p: [-16, 3, 10] },
    { t: "trickrail", p: [-4, 1, 10] },
    { t: "returnportal", p: [10, 0, 10] }, // intentionally no `to`
    { t: "grindosaurus", p: [24, 0, 10] },
    { t: "angryball", p: [38, 0, 10] },

    // Explicit path, bank, support, size and yaw variants cover the alternate
    // build branches the defaults above do not enter.
    {
      t: "woodpath",
      p: [-64, 0.2, -6],
      s: [1, 0.26, 1],
      w: 5.5,
      widths: [5.5, 7, 4.5, 6],
      pts: [
        [0, 0, 0, 0, 0],
        [3, -7, 0, 1.2, 12],
        [-2, -15, 0, 2.4, -9],
        [2, -24, 0, 1, 4],
      ],
      curve: "spline",
      scaffold: true,
      supports: true,
      rails: true,
      terrainSupports: true,
      spacing: 0.7,
      baySpacing: 4.2,
      supportDepth: 4,
      seed: 19,
    },
    {
      t: "wallpath",
      p: [-74, 0.2, -18],
      pts: [
        [0, 8, 0, 0],
        [4, 2, 1.5, 0.8],
        [-3, -5, 1.2, 1.6],
        [0, -12, 0, 0.4],
      ],
      w: 1.4,
      rise: 6.5,
      collisionHeight: 5.8,
      curve: "spline",
      solid: false,
      color: "#8f806c",
      tex: "stone",
    },
    {
      t: "wallpath",
      p: [-54, 0.2, -28],
      pts: [[0, 8], [5, 2], [-4, -5], [0, -12]],
      w: 1,
      rise: 4,
      curve: "spline",
      invisible: true,
    },
    {
      t: "trampoline",
      p: [-40, 0, -10],
      s: [7, 0.6, 3],
      yaw: 37,
      speed: 19,
      amp: 1.4,
    },
    {
      t: "speedpad",
      p: [-28, 0, -10],
      s: [6, 0.35, 3],
      yaw: 91,
      speed: 53,
      cycle: 2.4,
    },
    {
      t: "trickgate",
      p: [-16, 3, -10],
      s: [7, 6, 0.4],
      yaw: -43,
      radius: 2.6,
      trick: "shove",
    },
    // Every serialized trick value must survive unchanged and build its gate.
    // Browser smoke covers the derived membrane/editor copy; `shove` is in the
    // rotated gate above and the omitted default is in the sparse fixture.
    { t: "trickgate", p: [-24, 3, -20], trick: "kick", nm: "named kick lock" },
    { t: "trickgate", p: [-8, 3, -20], trick: "heel" },
    { t: "trickgate", p: [8, 3, -20], trick: "imposs" },
    { t: "trickgate", p: [24, 3, -20], trick: "varial" },
    {
      t: "trickrail",
      p: [-4, 1, -10],
      len: 9,
      yaw: 65,
      trick: "heel",
    },
    {
      t: "trickrail",
      p: [4, 1, -10],
      pts: [
        [0, 0, 0, 0],
        [3, -5, 1.2, 1],
        [-1, -11, 0, 2],
      ],
      trick: "kick",
    },
    {
      t: "returnportal",
      p: [10, 0, -10],
      s: [5, 6, 1.5],
      yaw: 33,
      to: [18, 2, -28],
      exitYaw: 127,
      airOnly: true,
    },
    {
      t: "grindosaurus",
      p: [28, 0, -10],
      yaw: 90,
      range: 7,
      speed: 2.25,
      coverage: 0.8,
    },
    {
      t: "angryball",
      p: [44, 0, -10],
      yaw: -55,
      w: 4,
      rise: 6,
      radius: 1.1,
      range: 17,
      speed: 9,
      amp: 2,
    },
    { t: "camnode", p: [-8, 4, 15], radius: 0 },
    { t: "camnode", p: [0, 5, 0], radius: 4 },
    { t: "camnode", p: [8, 6, -18], radius: 0 },
    { t: "gate", p: [0, 0, -52], yaw: 21 },
    { t: "clock", p: [2, 0, 13] },
    { t: "comboorb", p: [-2, 0, 13] },
  ],
  groups: [],
};

const MALFORMED_GROUP_FIXTURE = {
  v: 1,
  name: "Malformed Group Sentinel",
  spawn: [0, 0.6, 8],
  killY: -12,
  components: [
    { t: "platform", p: [0, -0.5, 0], s: [20, 1, 24], grp: 999 },
    { t: "wall", p: [4, 0, -2], s: [1, 3, 4], grp: 1 },
    { t: "gate", p: [0, 0, -9] },
    { t: "clock", p: [2, 0, 4] },
    { t: "comboorb", p: [-2, 0, 4] },
  ],
  groups: [
    { id: 1, parent: 2, nm: "cycle A" },
    { id: 2, parent: 1, nm: "cycle B" },
    { id: 2, parent: 88, nm: "duplicate id" },
    { id: 3, parent: 99, nm: "dangling parent" },
    { id: 4, parent: 4, nm: "self parent" },
  ],
};

const CRATE_STACK_BRIDGE_FIXTURE = {
  v: 1,
  name: "Crate Stack Bridge Sentinel",
  spawn: [-12, 0.6, 2],
  killY: -12,
  components: [
    { t: "platform", p: [-12, -0.5, 0], s: [8, 1, 8] },
    // Deliberately serialized TOP-FIRST: runtime support must not depend on
    // component order, and editor entry/save must not reorder the JSON.
    { t: "crate", p: [0, 1.92, 0], kind: "metal" },
    { t: "crate", p: [0, 0.96, 0], kind: "wood" },
    { t: "crate", p: [0, 0, 0], kind: "wood" },
    // Same projected column, disconnected upper deck: it is NOT part of the
    // lower touching stack and must retain its own platform floor.
    { t: "platform", p: [0, 9.5, 0], s: [4, 1, 4] },
    { t: "crate", p: [0, 10, 0], kind: "metal" },
    // One shallow local-height chain crossing several rounded-Y buckets.
    { t: "crate", p: [5, 0, -5], kind: "wood" },
    { t: "crate", p: [5, 0.12, -4.04], kind: "wood" },
    { t: "crate", p: [5, 0.24, -3.08], kind: "wood" },
    { t: "crate", p: [5, 0.36, -2.12], kind: "wood" },
    // Crosses the old Math.round(*10) bucket at .05 while remaining aligned
    // within two millimetres and one valid local height step.
    { t: "crate", p: [10, 5, 0.049], kind: "wood" },
    { t: "crate", p: [10.96, 5.12, 0.051], kind: "wood" },
    // Offset support uses the same .6 footprint law as settling. The buried
    // lower lid must not publish a grind edge through the upper crate.
    { t: "crate", p: [15, 0, 0], kind: "wood" },
    { t: "crate", p: [15.5, 0.96, 0], kind: "metal" },
    // Geometry-identical comparison stack, serialized BOTTOM-FIRST.
    { t: "crate", p: [20, 0, 0], kind: "wood" },
    { t: "crate", p: [20, 0.96, 0], kind: "wood" },
    { t: "crate", p: [20, 1.92, 0], kind: "metal" },
    // Two touching parallel rows straddling the old rounded occupancy bucket.
    { t: "crate", p: [30, 7, 0.091], kind: "wood" },
    { t: "crate", p: [30.96, 7, 0.091], kind: "wood" },
    { t: "crate", p: [30, 7, 1.049], kind: "wood" },
    { t: "crate", p: [30.96, 7, 1.049], kind: "wood" },
    { t: "gate", p: [-12, 0, -3] },
    { t: "clock", p: [-10, 0, 2] },
    { t: "comboorb", p: [-14, 0, 2] },
  ],
  groups: [],
};

function assertCrateStackBridge(canonical, level) {
  assert.deepStrictEqual(
    canonical.components
      .filter((component) => component.t === "crate")
      .slice(0, 3)
      .map((component) => component.p[1]),
    [1.92, 0.96, 0],
    "normalization reordered the deliberately top-first stack",
  );
  if (!level) return;
  assert.equal(level.crates.length, 19);
  assert.equal(level.crates[0].metal, true, "stackable metal crate lost its kind");
  for (let index = 0; index < 3; index++) {
    assert.equal(
      round(level.crates[index].mesh.userData.groundBaseY),
      0,
      `top-first stack member ${index} inherited the wrong column floor`,
    );
  }
  assert.equal(
    round(level.crates[3].mesh.userData.groundBaseY),
    10,
    "independent upper-deck crate inherited the lower stack floor",
  );
  const bridgeRails = level.crateRails.filter(
    (rail) => level.crateRunFor(rail)?.length === 4,
  );
  assert.equal(bridgeRails.length, 2, "sloped crate row did not form two exposed rails");
  for (const rail of bridgeRails) {
    assert.equal(rail.points.length, 6, "crate bridge rail must follow every lid");
    assert.deepStrictEqual(
      rail.points.slice(1, -1).map((point) => round(point.y)),
      [0.96, 1.08, 1.2, 1.32],
      "crate bridge rail flattened or split its lid-height chain",
    );
  }
  const boundaryRails = level.crateRails.filter(
    (rail) => level.crateRunFor(rail)?.includes(level.crates[8]),
  );
  assert.equal(boundaryRails.length, 2, "cross-bucket aligned row lost its rails");
  assert.ok(
    boundaryRails.every((rail) => level.crateRunFor(rail)?.includes(level.crates[9])),
    "cross-bucket row split its two members",
  );
  assert.ok(
    level.crateRails.every(
      (rail) => !level.crateRunFor(rail)?.includes(level.crates[10]),
    ),
    "offset-supported lower crate exposed a buried rail",
  );
  const parallelRails = level.crateRails.filter((rail) =>
    level.crateRunFor(rail)?.some((crate) => level.crates.slice(15, 19).includes(crate)),
  );
  assert.equal(
    parallelRails.length,
    4,
    "touching cross-bucket 2x2 grid exposed an internal side rail",
  );

  const [top, middle, bottom] = level.crates;
  const compareBottom = level.crates[12];
  const compareMiddle = level.crates[13];
  const compareTop = level.crates[14];
  const authoredY = [top, middle, bottom].map((crate) => round(crate.mesh.position.y));
  const compareAuthoredY = [compareTop, compareMiddle, compareBottom].map(
    (crate) => round(crate.mesh.position.y),
  );
  level.breakCrate(bottom);
  level.breakCrate(compareBottom);
  for (let tick = 0; tick < 180; tick++) {
    level.update(1 / 60);
    assert.equal(
      round(top.mesh.position.y),
      round(compareTop.mesh.position.y),
      `top-first and bottom-first top diverged on tick ${tick}`,
    );
    assert.equal(
      round(middle.mesh.position.y),
      round(compareMiddle.mesh.position.y),
      `top-first and bottom-first middle diverged on tick ${tick}`,
    );
  }
  assert.equal(bottom.alive, false, "bottom support did not break");
  assert.equal(round(middle.mesh.position.y), 0.48, "middle crate did not settle to floor");
  assert.equal(round(top.mesh.position.y), 1.44, "metal lid did not settle onto middle crate");
  assert.equal(compareBottom.alive, false, "comparison bottom support did not break");
  for (const crate of [top, middle]) {
    assert.equal(crate.fallVel, undefined, "settled crate retained fall velocity");
    assert.deepStrictEqual(
      numericArray(crate.box.getCenter(new THREE.Vector3()).toArray()),
      numericArray(crate.mesh.position.toArray()),
      "settled crate mesh/collider diverged",
    );
  }
  level.reset(true);
  assert.deepStrictEqual(
    [top, middle, bottom].map((crate) => round(crate.mesh.position.y)),
    authoredY,
    "hard reset did not restore top-first stack homes",
  );
  assert.deepStrictEqual(
    [compareTop, compareMiddle, compareBottom].map((crate) => round(crate.mesh.position.y)),
    compareAuthoredY,
    "hard reset did not restore bottom-first stack homes",
  );
}

function assertPrimitiveFixture(canonical, level) {
  assert.equal(
    canonical.components.find((component) => component.t === "returnportal")
      .to,
    undefined,
    "normalization materialized an omitted portal destination",
  );
  if (!level) return;
  assert.equal(
    level.groundMeshes.filter((mesh) => mesh.userData.woodPathComp).length,
    2,
    "wood path default/path variants were not both built",
  );
  const wallPaths = [];
  level.root.traverse((object) => {
    if (object.userData.wallPathComp) wallPaths.push(object);
  });
  assert.equal(wallPaths.length, 3, "wallpath default/curved/ghost variants were not built");
  const solidWall = wallPaths.find(
    (object) =>
      object.userData.wallPathComp.solid !== false &&
      !object.userData.wallPathComp.pts,
  );
  const sceneryWall = wallPaths.find((object) => object.userData.wallPathComp.solid === false);
  const ghostWall = wallPaths.find((object) => object.userData.wallPathComp.invisible === true);
  assert.ok(solidWall?.userData.wallPathCollision > 0, "sparse wallpath lost its collider");
  assert.equal(
    sceneryWall?.userData.wallPathCollision,
    0,
    "visual-only wallpath unexpectedly generated collision",
  );
  assert.ok(ghostWall?.userData.wallPathCollision > 4, "curved ghost wall lost collision");
  assert.equal(ghostWall?.visible, false, "invisible wallpath was visible in play/editor build");
  const runtime = level.walls
    .map((box) => level.wallPathForBox(box))
    .find((candidate) => candidate?.spine.length > 2);
  assert.ok(runtime, "curved wallpath collision lost logical path metadata");
  const contact = level.closestWallPath(runtime, -54, -28);
  const sample = level.wallPathSample(runtime, contact.s);
  assert.ok(Number.isFinite(sample.tx) && Number.isFinite(sample.nx));
  const firstNode = runtime.spine[0];
  const secondNode = runtime.spine[1];
  const firstLength = Math.hypot(
    secondNode.x - firstNode.x,
    secondNode.z - firstNode.z,
  );
  const firstTx = (secondNode.x - firstNode.x) / firstLength;
  const firstTz = (secondNode.z - firstNode.z) / firstLength;
  const cap = level.closestWallPath(
    runtime,
    firstNode.x - firstTx * 2,
    firstNode.z - firstTz * 2,
    0,
  );
  assert.equal(cap.cap, true, "open wallpath endpoint did not resolve as a cap");
  assert.ok(cap.nx * firstTx + cap.nz * firstTz < -0.9, "start cap normal is wrong");
  const offCenterCap = level.closestWallPath(
    runtime,
    firstNode.x - firstTx * 2 - firstTz * 4,
    firstNode.z - firstTz * 2 + firstTx * 4,
    0,
  );
  assert.equal(round(offCenterCap.distance), 2, "cap used radial instead of longitudinal depth");
  assert.equal(round(offCenterCap.crossDistance), 4, "cap lost lateral offset");
  let previous = sample;
  for (let index = 1; index <= 20; index++) {
    const next = level.wallPathSample(
      runtime,
      contact.s + (runtime.length * index) / 20,
    );
    assert.ok(Number.isFinite(next.x) && Number.isFinite(next.tx));
    assert.ok(
      previous.tx * next.tx + previous.tz * next.tz > -0.5,
      "wallpath tangent flipped discontinuously",
    );
    previous = next;
  }
  const trampolines = level.groundMeshes.filter(
    (mesh) => mesh.name === "trampoline",
  );
  const speedPads = level.groundMeshes.filter((mesh) => mesh.name === "speedpad");
  assert.equal(trampolines.length, 2);
  assert.equal(speedPads.length, 2);
  assert.equal(trampolines[0].userData.trampolineBounce, 16);
  assert.equal(trampolines[0].userData.trampolineHeldMult, 1.25);
  assert.equal(speedPads[0].userData.speedPadSpeed, 48);
  assert.equal(speedPads[0].userData.speedPadHold, 3.9);
  assert.equal(level.trickGates.length, 6);
  assert.equal(level.trickGates[0].radius, 2.2);
  assert.equal(level.trickGates[0].halfDepth, 0.3);
  assert.equal(level.trickGates[0].trick, "kick");
  assert.deepStrictEqual(
    level.trickGates.map((gate) => gate.trick),
    ["kick", "shove", "kick", "heel", "imposs", "varial"],
  );
  assert.equal(level.trickRails.length, 3);
  assert.equal(level.trickRails[0].rail.totalLength, 12);
  assert.equal(level.returnPortals.length, 2);
  assert.deepStrictEqual(level.returnPortals[0].destination.toArray(), [10, 0, 10]);
  assert.equal(round(level.returnPortals[1].yaw), round((33 * Math.PI) / 180));
  assert.deepStrictEqual(level.returnPortals[1].destination.toArray(), [18, 2, -28]);
  assert.equal(level.returnPortals[1].airOnly, true);
  assert.equal(level.grindosauri.length, 2);
  assert.equal(level.grindosauri[0].minimum, -4);
  assert.equal(level.grindosauri[0].maximum, 4);
  assert.equal(level.grindosauri[0].speed, 1.5);
  assert.equal(level.grindosauri[0].requiredCoverage, 0.65);
  assert.equal(level.angryBalls.length, 2);
  assert.equal(level.angryBalls[0].flatHalf, 3);
  assert.equal(level.angryBalls[0].pipeRadius, 4.6);
  assert.equal(level.angryBalls[0].ballRadius, 0.8);
  assert.equal(level.angryBalls[0].activationRadius, 12);
  assert.equal(level.angryBalls[0].speed, 7);
  assert.ok(level.lanePts.length >= 3, "camera path was not rebuilt");
}

function assertBendyWallBuilder(buildBendyWallGeometry, THREE) {
  const base = { t: "wallpath", p: [0, 0, 0], w: 1.2, rise: 5 };
  const straight = buildBendyWallGeometry({
    ...base,
    pts: [[0, 0], [0, -186]],
  });
  assert.equal(straight.collision.length, 1, "long cardinal wallpath was needlessly sliced");
  assert.equal(round(straight.collision[0].max.y), 4.8, "wall collision top was not tucked");

  const diagonal = buildBendyWallGeometry({
    ...base,
    pts: [[0, 0], [20, -20]],
  });
  assert.ok(diagonal.collision.length >= 18, "diagonal wallpath was not collision-subdivided");
  for (const box of diagonal.collision) {
    const size = box.getSize(new THREE.Vector3());
    assert.ok(size.x < 4 && size.z < 4, "diagonal wallpath grew a broad invisible AABB");
  }

  const climbingCardinal = buildBendyWallGeometry({
    ...base,
    pts: [[0, 0, 0, 0], [0, -30, 0, 20]],
  });
  assert.ok(
    climbingCardinal.collision.length >= 33,
    "climbing cardinal wallpath was not vertically subdivided",
  );
  for (const box of climbingCardinal.collision)
    assert.ok(
      box.max.y - box.min.y < 6,
      "climbing wallpath produced a tall phantom collider",
    );

  const twoNodeClosed = buildBendyWallGeometry({
    ...base,
    closed: true,
    pts: [[0, 0], [0, -12]],
  });
  assert.equal(twoNodeClosed.collision.length, 1, "two-node closed wall doubled back on itself");
  assert.equal(twoNodeClosed.closed, false, "two-node wall retained an invalid closed runtime");

  const repeatedClose = buildBendyWallGeometry({
    ...base,
    closed: true,
    pts: [[-6, -6], [6, -6], [6, 6], [-6, 6], [-6, -6]],
  });
  assert.equal(repeatedClose.spine.length, 4, "redundant closed endpoint survived");
  assert.equal(repeatedClose.collision.length, 4, "closed wall seam duplicated collision");
  assert.equal(repeatedClose.closed, true);

  const yawedKnots = buildBendyWallGeometry({
    ...base,
    yaw: 90,
    pts: [[2, 0], [2, -4]],
  });
  assert.equal(round(yawedKnots.spine[0].x), 2, "explicit wall knots were double-rotated by yaw");
  const yawedFallback = buildBendyWallGeometry({
    ...base,
    yaw: 90,
  });
  assert.ok(
    Math.abs(yawedFallback.spine[1].x - yawedFallback.spine[0].x) > 20,
    "sparse straight wallpath ignored yaw",
  );

  const verticalDuplicate = buildBendyWallGeometry({
    ...base,
    pts: [[0, 0, 0, 0], [0, 0, 0, 4], [0, -8, 0, 4]],
  });
  assert.equal(
    verticalDuplicate.spine.length,
    2,
    "zero-horizontal wall segment survived path cleanup",
  );

  const hairpin = buildBendyWallGeometry({
    ...base,
    pts: [[0, 0], [8, 0, 2], [0.05, 0.08, 2], [8, 0.16]],
  });
  for (const attribute of [
    hairpin.geometry.getAttribute("position"),
    hairpin.geometry.getAttribute("uv"),
  ])
    for (const value of attribute.array)
      assert.ok(Number.isFinite(value), "hairpin wall generated non-finite geometry");

  const scenery = buildBendyWallGeometry({
    ...base,
    solid: false,
    curve: "spline",
    pts: [[0, 0], [4, -8], [-3, -16], [0, -24]],
  });
  assert.equal(scenery.collision.length, 0, "solid:false wallpath generated collision");
}

function assertMalformedGroups(canonical) {
  assert.deepStrictEqual(
    canonical.groups.map((group) => group.id),
    [1, 2, 3, 4],
    "duplicate group ids were not removed stably",
  );
  const ids = new Set(canonical.groups.map((group) => group.id));
  for (const group of canonical.groups) {
    assert.notEqual(group.parent, group.id, "self-parent survived normalization");
    if (group.parent !== undefined)
      assert.ok(ids.has(group.parent), "dangling group parent survived normalization");
    const visited = new Set([group.id]);
    let current = group;
    while (current.parent !== undefined) {
      assert.ok(!visited.has(current.parent), "group cycle survived normalization");
      visited.add(current.parent);
      current = canonical.groups.find((item) => item.id === current.parent);
    }
  }
  assert.equal(
    canonical.components[0].grp,
    undefined,
    "dangling component group survived normalization",
  );
  assert.equal(canonical.components[1].grp, 1, "valid component group was lost");
}

installHeadlessDom();
const [{ createServer }, THREE] = await Promise.all([
  import("vite"),
  import("three"),
]);
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  root: ROOT,
  server: { middlewareMode: true },
});

let failures = 0;
const fail = (label, error) => {
  failures++;
  console.error(`FAIL ${label}`);
  console.error(`     ${error instanceof Error ? error.message : String(error)}`);
};

function assertIslandHopper(data, level) {
  assert.deepEqual(data.ocean, {
    p: [106, -0.36, -168],
    length: 500,
    yaw: 0,
    seaward: -1,
    width: 220,
    overlap: 6,
    longitudinalSegments: 128,
    lateralSegments: 128,
    sourceCoordinates: "unity",
  });
  assert.equal(data.shoreFoam?.length, 5);
  assert.equal(
    data.components.some(
      (component) =>
        component.nm === "shallow tropical ocean" ||
        component.nm === "deep water death",
    ),
    false,
  );
  assert.equal(
    data.components.filter((component) => component.shoreProfile).length,
    5,
  );
  assert.ok(
    data.components
      .filter((component) => component.t === "woodpath")
      .every(
        (component) =>
          component.structureStyle === "island" &&
          component.baySpacing === 4.5 &&
          component.supportBaseY === -3.6,
      ),
  );
  if (!level) return;

  assert.ok(level.water, "Island Hopper did not instantiate MatrixRex ocean");
  if (window.location.search.includes("lite")) {
    assert.equal(level.water.stats.quality, "lite");
  } else {
    assert.equal(level.water.stats.quality, "full");
    assert.equal(level.water.stats.shoreSamples, 129);
    assert.equal(level.water.stats.verts, 17_028);
    assert.equal(level.water.stats.tris, 33_280);
  }
  assert.deepEqual(
    {
      ...level.shoreFoamDiagnostics,
      time: 0,
    },
    {
      ovalCount: 5,
      segmentsPerOval: 72,
      vertexCount: 720,
      triangleCount: 720,
      drawCalls: 1,
      sourceZSign: -1,
      renderOrder: 1,
      time: 0,
      disposed: false,
    },
  );
  assert.equal(
    level.groundMeshes.filter((mesh) => mesh.userData.shoreProfile).length,
    5,
  );
  for (const crate of level.crates) {
    assert.ok(
      Math.abs(crate.box.min.y - 1.05) < 1e-5,
      `Island crate at x=${crate.mesh.position.x.toFixed(2)} seated at ${crate.box.min.y}`,
    );
    assert.ok(
      Math.abs(crate.mesh.position.y - 1.53) < 1e-5,
      "Island crate center no longer matches boardwalk top + half-height",
    );
  }
  const partMeshes = [];
  level.pickRoot.traverse((object) => {
    if (object.userData.woodPathPartRole) partMeshes.push(object);
  });
  assert.equal(
    partMeshes.filter((mesh) => mesh.userData.woodPathPartRole === "plank").length,
    11,
  );
  assert.equal(
    partMeshes.filter((mesh) => mesh.userData.woodPathPartRole === "pole").length,
    11,
  );
  const roles = partMeshes.flatMap((mesh) => mesh.userData.woodPathRoles ?? []);
  for (const role of [
    "support-post",
    "crossbeam",
    "handrail-post",
    "top-ledger",
    "side-brace",
    "midheight-cross-brace",
    "top-rail",
  ])
    assert.ok(roles.includes(role), `Island boardwalk is missing ${role}`);
  const collisionDecks = level.groundMeshes.filter(
    (mesh) => mesh.userData.collisionOnly,
  );
  assert.equal(collisionDecks.length, 11);
  assert.ok(
    collisionDecks.every((mesh) =>
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).every(
        (material) => material.colorWrite === false,
      ),
    ),
    "a rendered swept deck can z-fight the visible board palette",
  );
}

try {
  const levelModule = await server.ssrLoadModule("/src/level.ts");
  const {
    BUILTIN_LEVELS,
    SKY_BRIDGE_FOG_FAR,
    SKY_BRIDGE_FOG_NEAR,
    buildBendyWallGeometry,
    Level,
    findLevel,
    getEditData,
    migrateCustomLevel,
    normalizeCustomLevelData,
    persistEditData,
    setEditorBuild,
    setUserLevels,
    starterCustomLevel,
  } = levelModule;
  assertBendyWallBuilder(buildBendyWallGeometry, THREE);
  const playerSource = await readFile(path.join(ROOT, "src", "player.ts"), "utf8");
  for (const contract of [
    "level.wallPathForBox(w)",
    "level.closestWallPath(",
    "level.wallPathSample(",
    "this.wallPathS + this.wallPathDir * this.wallSpeed * dt",
    "this.pushOutOfWallPath(w, wallPath, level)",
  ])
    assert.ok(
      playerSource.includes(contract),
      `path-aware wallride integration missing ${contract}`,
    );

  const cases = [
    {
      data: starterCustomLevel(),
      id: "starter",
      name: "Starter Custom Level",
      source: "starterCustomLevel()",
    },
    {
      data: NEW_PRIMITIVE_FIXTURE,
      id: "new-primitives",
      name: NEW_PRIMITIVE_FIXTURE.name,
      source: "sparse fixture",
      verify: assertPrimitiveFixture,
    },
    {
      data: MALFORMED_GROUP_FIXTURE,
      id: "malformed-groups",
      name: MALFORMED_GROUP_FIXTURE.name,
      source: "sparse fixture",
      verify: assertMalformedGroups,
    },
    {
      data: CRATE_STACK_BRIDGE_FIXTURE,
      id: "crate-stack-bridge",
      name: CRATE_STACK_BRIDGE_FIXTURE.name,
      source: "sparse fixture",
      verify: assertCrateStackBridge,
    },
    ...BUILTIN_LEVELS.filter((entry) => entry.data).map((entry) => ({
      data: entry.data,
      id: entry.id,
      name: entry.name,
      source: "source-owned built-in",
      verify: entry.id === "island-hopper" ? assertIslandHopper : undefined,
    })),
  ];

  const packPath = path.join(ROOT, "public", "levels.json");
  cases.push(
    ...extractLevelCases(
      JSON.parse(await readFile(packPath, "utf8")),
      path.relative(ROOT, packPath),
    ),
  );
  for (const inputPath of inputPaths) {
    cases.push(
      ...extractLevelCases(
        JSON.parse(await readFile(inputPath, "utf8")),
        path.relative(ROOT, inputPath),
      ),
    );
  }

  // Sky Bridge's extreme sightline is identity-owned, not builder-owned: the
  // hand-built source and the published component-data override must both keep
  // playable planks inside the same dense cloud fog.
  const sourceSky = BUILTIN_LEVELS.find((entry) => entry.id === "sky");
  const dataSky = cases.find((entry) => entry.id === "sky");
  assert.ok(sourceSky, "source Sky Bridge entry is missing");
  assert.ok(dataSky, "published Sky Bridge data is missing");
  for (const [label, entry] of [
    ["source", sourceSky],
    ["published", { id: "sky", name: dataSky.name, data: clone(dataSky.data) }],
  ]) {
    const skyLevel = new Level(new THREE.Scene(), entry);
    try {
      assert.equal(skyLevel.keepPlayFog, true, `${label} Sky Bridge stripped play fog`);
      assert.equal(skyLevel.theme.fogNear, SKY_BRIDGE_FOG_NEAR);
      assert.equal(skyLevel.theme.fogFar, SKY_BRIDGE_FOG_FAR);
      assert.ok(
        skyLevel.theme.fogFar - skyLevel.theme.fogNear <= 20,
        `${label} Sky Bridge visibility envelope is not extreme`,
      );
      for (const mesh of skyLevel.groundMeshes) {
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          assert.notEqual(
            material.fog,
            false,
            `${label} Sky Bridge ground opted out of fog`,
          );
      }
    } finally {
      skyLevel.dispose();
    }
  }
  const skyCopy = new Level(new THREE.Scene(), {
    id: "u-sky-copy",
    name: "Sky-shaped user copy",
    data: clone(dataSky.data),
  });
  try {
    assert.equal(skyCopy.keepPlayFog, false, "Sky fog leaked to a user-level id");
    assert.notEqual(skyCopy.theme.fogFar, SKY_BRIDGE_FOG_FAR);
  } finally {
    skyCopy.dispose();
  }

  let serial = 0;
  for (const testCase of cases) {
    const untouched = JSON.stringify(testCase.data);
    const canonical = normalizeCustomLevelData(clone(testCase.data));
    try {
      assert.ok(canonical, "normalizeCustomLevelData rejected valid level JSON");
      const twiceMigrated = migrateCustomLevel(clone(canonical));
      assert.deepStrictEqual(
        twiceMigrated,
        canonical,
        "migrateCustomLevel is not idempotent",
      );
      assert.equal(
        JSON.stringify(testCase.data),
        untouched,
        "migration/build setup mutated the source fixture",
      );
      testCase.verify?.(canonical, null);
    } catch (error) {
      fail(`${testCase.source}:${testCase.id}:normalization`, error);
      continue;
    }

    // `?lite` is read when each Level instance is created. Exercise the exact
    // editor/play sequence independently in both query modes: mobile-lite can
    // take different batching/detail paths from the full renderer.
    for (const mode of [
      { name: "lite", search: "?lite" },
      { name: "full", search: "" },
    ]) {
      const label = `${testCase.source}:${testCase.id}:${mode.name}`;
      let beforeLevel;
      let editingLevel;
      let afterLevel;
      try {
        window.location.search = mode.search;

        // getEditData + the editor's second migrate call is its exact enter seam.
        const editorId = `__editor_roundtrip_${serial++}`;
        setUserLevels([
          { id: editorId, name: testCase.name, data: clone(canonical) },
        ]);
        const editorData = migrateCustomLevel(getEditData(editorId));
        assert.deepStrictEqual(editorData, canonical, "editor enter changed JSON");
        assert.deepStrictEqual(
          findLevel(editorId).data,
          canonical,
          "editor enter changed stored JSON",
        );

        setEditorBuild(false);
        beforeLevel = new Level(new THREE.Scene(), {
          id: editorId,
          name: testCase.name,
          data: clone(canonical),
        });
        assert.deepStrictEqual(
          beforeLevel.captureData(),
          canonical,
          "play build/capture changed JSON",
        );
        testCase.verify?.(canonical, beforeLevel);
        const beforeContract = levelContract(beforeLevel);

        setEditorBuild(true);
        editingLevel = new Level(new THREE.Scene(), {
          id: editorId,
          name: testCase.name,
          data: clone(editorData),
        });
        assert.deepStrictEqual(
          editingLevel.captureData(),
          canonical,
          "editor build/capture changed JSON",
        );
        testCase.verify?.(canonical, editingLevel);
        // Material, transform, shadow and special-state traversal must succeed
        // in the loose/pickable editor build too, even though batching differs.
        levelContract(editingLevel);
        editingLevel.dispose();
        editingLevel = undefined;

        // Exercise the autosave seam too. A no-op commit must not introduce a
        // storage-only representation that changes the next play build.
        persistEditData(editorId, JSON.stringify(editorData));
        assert.deepStrictEqual(
          findLevel(editorId).data,
          canonical,
          "no-op autosave changed stored JSON",
        );

        setEditorBuild(false);
        afterLevel = new Level(new THREE.Scene(), {
          id: editorId,
          name: testCase.name,
          data: clone(findLevel(editorId).data),
        });
        assert.deepStrictEqual(
          afterLevel.captureData(),
          canonical,
          "post-editor play capture changed JSON",
        );
        testCase.verify?.(canonical, afterLevel);
        assert.deepStrictEqual(
          levelContract(afterLevel),
          beforeContract,
          "post-editor visual/gameplay/collision contract changed",
        );
        console.log(`PASS ${label} (${canonical.components.length} components)`);
      } catch (error) {
        fail(label, error);
      } finally {
        editingLevel?.dispose();
        afterLevel?.dispose();
        beforeLevel?.dispose();
        setEditorBuild(false);
      }
    }
  }

  // Legacy hand-built levels enter the editor through Level.captureData().
  // Their bespoke builder state cannot be inferred from JSON equality, so
  // compare the gameplay/collision contract before and after that conversion.
  // This is diagnostic by default because the repository currently ships
  // known incomplete historic captures; --strict-hand-built turns each delta
  // into a failure and is the regression gate once those captures themselves
  // are made lossless. A lazy, unsaved preview can keep no-op entry safe while
  // this separate capture-fidelity audit still reports conversion limitations.
  window.location.search = "?lite";
  for (const entry of BUILTIN_LEVELS.filter((item) => !item.data)) {
    let original;
    let rebuilt;
    const label = `hand-built capture:${entry.id}`;
    try {
      setEditorBuild(false);
      original = new Level(new THREE.Scene(), entry);
      const captured = migrateCustomLevel(clone(original.captureData()));
      if (entry.id === "jungle") {
        const wallPaths = captured.components.filter(
          (component) => component.t === "wallpath",
        );
        assert.equal(wallPaths.length, 22, "Jungle wallpaths were dropped or duplicated");
        assert.equal(
          wallPaths.filter((component) => component.solid === false).length,
          18,
          "Jungle earth banks lost visual-only wallpath identity",
        );
        const structural = wallPaths.filter((component) => component.solid !== false);
        assert.deepStrictEqual(
          structural.map((component) => [
            component.p,
            component.pts,
            component.w,
            component.rise,
            component.collisionHeight,
          ]),
          [
            [[-9, 0, -300], [[0, 0], [0, -186]], 1.2, 16, 16],
            [[9, 0, -300], [[0, 0], [0, -186]], 1.2, 16, 16],
            [[-7.6, 0, -676], [[0, 0], [0, -42]], 1.2, 6, 6],
            [[7.6, 0, -676], [[0, 0], [0, -42]], 1.2, 6, 6],
          ],
          "Jungle structural wallpath footprint drifted",
        );
      }
      rebuilt = new Level(new THREE.Scene(), {
        id: entry.id,
        name: entry.name,
        data: clone(captured),
      });
      assert.deepStrictEqual(
        rebuilt.captureData(),
        captured,
        "captured JSON is not stable after rebuild",
      );
      const changed = changedTopLevelKeys(
        levelContract(original),
        levelContract(rebuilt),
      );
      if (changed.length) {
        const message = `contract differs in ${changed.join(", ")}`;
        if (STRICT_HAND_BUILT) fail(label, message);
        else console.warn(`WARN ${label}: ${message}`);
      } else {
        console.log(`PASS ${label} (${captured.components.length} components)`);
      }
    } catch (error) {
      fail(label, error);
    } finally {
      rebuilt?.dispose();
      original?.dispose();
    }
  }
} finally {
  await server.close();
}

if (failures) {
  console.error(`\n${failures} editor round-trip check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(
    "\nData-backed editor round-trip JSON and gameplay contracts are stable.",
  );
  if (!STRICT_HAND_BUILT)
    console.log(
      "Hand-built capture warnings are diagnostic; run with --strict-hand-built to gate them.",
    );
}
