import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import process from "node:process";
import * as THREE from "three";
import { acceleratedRaycast } from "three-mesh-bvh";
import { createServer } from "vite";

function installHeadlessDom() {
  const storage = new Map();
  globalThis.localStorage = {
    get length() { return storage.size; },
    clear() { storage.clear(); },
    getItem(key) { return storage.has(String(key)) ? storage.get(String(key)) : null; },
    key(index) { return [...storage.keys()][index] ?? null; },
    removeItem(key) { storage.delete(String(key)); },
    setItem(key, value) { storage.set(String(key), String(value)); },
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
        return { width, height, data: new Uint8ClampedArray(width * height * 4) };
      },
      createLinearGradient() { return { addColorStop() {} }; },
      createPattern() { return {}; },
      createRadialGradient() { return { addColorStop() {} }; },
      getImageData(_x, _y, width, height) {
        return { width, height, data: new Uint8ClampedArray(width * height * 4) };
      },
      measureText(text) { return { width: String(text).length * 8 }; },
    },
    { get(target, key) { return key in target ? target[key] : () => {}; } },
  );
  const makeCanvas = () => {
    const canvas = {
      height: 1,
      style: {},
      width: 1,
      getContext() { context.canvas = canvas; return context; },
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
    createElementNS(_namespace, tag) { return this.createElement(tag); },
  };
  globalThis.Image = class HeadlessImage {
    addEventListener(type, callback) {
      if (type === "error") queueMicrotask(callback);
    }
    removeEventListener() {}
    set src(_value) { queueMicrotask(() => this.onerror?.(new Error("headless image"))); }
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

function digestAttribute(attribute) {
  if (!attribute) return null;
  const view = new Uint8Array(
    attribute.array.buffer,
    attribute.array.byteOffset,
    attribute.array.byteLength,
  );
  return createHash("sha256").update(view).digest("hex");
}

function geometryContract(geometry) {
  return {
    index: digestAttribute(geometry.getIndex()),
    position: digestAttribute(geometry.getAttribute("position")),
    drawRange: { ...geometry.drawRange },
    groups: geometry.groups.map((group) => ({ ...group })),
  };
}

function compareHits(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: hit count`);
  for (let index = 0; index < actual.length; index++) {
    const a = actual[index];
    const e = expected[index];
    assert.equal(a.object, e.object, `${label}: object ${index}`);
    assert.ok(Math.abs(a.distance - e.distance) <= 1e-6, `${label}: distance ${index}`);
    assert.ok(a.point.distanceTo(e.point) <= 1e-6, `${label}: point ${index}`);
    assert.equal(a.faceIndex, e.faceIndex, `${label}: face index ${index}`);
    assert.equal(a.face?.materialIndex, e.face?.materialIndex, `${label}: material ${index}`);
    assert.ok(
      (a.face?.normal ?? new THREE.Vector3()).distanceTo(
        e.face?.normal ?? new THREE.Vector3(),
      ) <= 1e-6,
      `${label}: face normal ${index}`,
    );
  }
}

function cast(mesh, raycaster, raycast) {
  mesh.raycast = raycast;
  return raycaster.intersectObject(mesh, false);
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}

function timedRayBatch(mesh, raycast, rays) {
  mesh.raycast = raycast;
  const raycaster = new THREE.Raycaster();
  const started = performance.now();
  let hitCount = 0;
  for (const [origin, direction, far] of rays) {
    raycaster.set(origin, direction);
    raycaster.near = 0;
    raycaster.far = far;
    hitCount += raycaster.intersectObject(mesh, false).length;
  }
  return { elapsed: performance.now() - started, hitCount };
}

installHeadlessDom();
const server = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { accelerateGroundMeshes, disposeGroundAcceleration } =
    await server.ssrLoadModule("/src/groundAcceleration.ts");

  // Exact Beachfront topology: 64 lateral by 370 longitudinal quads.
  const geometry = new THREE.PlaneGeometry(64, 370, 64, 370);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    positions.setY(index, 0.18 * Math.sin(x * 0.23) + 0.11 * Math.sin(z * 0.07));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.clearGroups();
  const indexCount = geometry.getIndex().count;
  geometry.addGroup(0, Math.floor(indexCount / 2 / 3) * 3, 0);
  geometry.addGroup(Math.floor(indexCount / 2 / 3) * 3, Infinity, 1);
  const materials = [
    new THREE.MeshBasicMaterial({ side: THREE.FrontSide }),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  ];
  const mesh = new THREE.Mesh(geometry, materials);
  const parent = new THREE.Group();
  parent.position.set(4, 1.3, -9);
  parent.rotation.set(0.04, 0.31, -0.02);
  parent.scale.set(1.15, 0.9, 0.82);
  parent.add(mesh);
  parent.updateMatrixWorld(true);

  const stockRaycast = THREE.Mesh.prototype.raycast;
  const before = geometryContract(geometry);
  const acceleration = accelerateGroundMeshes([mesh], 1);
  assert.equal(acceleration.stats.acceleratedMeshes, 1);
  assert.equal(acceleration.stats.uniqueGeometries, 1);
  assert.equal(acceleration.stats.triangles, 47_360);
  assert.ok(geometry.boundsTree?.indirect, "ground BVH must preserve the index indirectly");
  assert.deepEqual(geometryContract(geometry), before, "BVH mutated geometry buffers");

  const probes = [
    [new THREE.Vector3(4, 20, -9), new THREE.Vector3(0, -1, 0), 40],
    [new THREE.Vector3(10.37, 20, 30.19), new THREE.Vector3(0, -1, 0), 50],
    [new THREE.Vector3(-8.43, 20, -78.17), new THREE.Vector3(0, -1, 0), 50],
    [new THREE.Vector3(200, 20, 200), new THREE.Vector3(0, -1, 0), 50],
    [new THREE.Vector3(4, -20, -9), new THREE.Vector3(0, 1, 0), 50],
  ];
  for (let index = 0; index < probes.length; index++) {
    const [origin, direction, far] = probes[index];
    const raycaster = new THREE.Raycaster(origin, direction, 0, far);
    const expected = cast(mesh, raycaster, stockRaycast);
    const actual = cast(mesh, raycaster, acceleratedRaycast);
    compareHits(actual, expected, `synthetic probe ${index}`);
  }

  // Rigid motion and nested non-uniform scale require no BVH rebuild.
  parent.position.add(new THREE.Vector3(7, 3, -4));
  parent.rotation.y -= 0.47;
  parent.scale.set(-1.05, 1.2, 0.93);
  parent.updateMatrixWorld(true);
  const movedProbe = new THREE.Raycaster(
    new THREE.Vector3(10, 30, -10),
    new THREE.Vector3(0, -1, 0),
    0,
    80,
  );
  compareHits(
    cast(mesh, movedProbe, acceleratedRaycast),
    cast(mesh, movedProbe, stockRaycast),
    "nested moved mesh",
  );

  // Warm and benchmark a deterministic 80/20 hit/miss corpus.
  parent.position.set(0, 0, 0);
  parent.rotation.set(0, 0, 0);
  parent.scale.set(1, 1, 1);
  parent.updateMatrixWorld(true);
  const rays = [];
  for (let index = 0; index < 40; index++) {
    const hit = index % 5 !== 0;
    const x = hit ? -30 + ((index * 17.17) % 60) : 90 + index;
    const z = hit ? -175 + ((index * 43.31) % 350) : 260 + index;
    rays.push([
      new THREE.Vector3(x, 18, z),
      new THREE.Vector3(0, -1, 0),
      40,
    ]);
  }
  timedRayBatch(mesh, stockRaycast, rays.slice(0, 8));
  timedRayBatch(mesh, acceleratedRaycast, rays.slice(0, 8));
  const stockTimes = [];
  const acceleratedTimes = [];
  for (let round = 0; round < 5; round++) {
    const first = round % 2 === 0
      ? [stockRaycast, stockTimes]
      : [acceleratedRaycast, acceleratedTimes];
    const second = round % 2 === 0
      ? [acceleratedRaycast, acceleratedTimes]
      : [stockRaycast, stockTimes];
    for (const [raycast, output] of [first, second]) {
      const result = timedRayBatch(mesh, raycast, rays);
      output.push(result.elapsed);
      assert.equal(result.hitCount, 32, "benchmark hit corpus changed");
    }
  }
  const stockMedian = median(stockTimes);
  const acceleratedMedian = median(acceleratedTimes);
  const speedup = stockMedian / Math.max(acceleratedMedian, 1e-6);
  assert.ok(speedup >= 8, `ground BVH speedup ${speedup.toFixed(1)}x is below 8x`);

  // Exercise the actual Level lifecycle and the exact source Beachfront mesh.
  const { Level, BUILTIN_LEVELS, findLevel } = await server.ssrLoadModule(
    "/src/level.ts",
  );
  const entry = findLevel("beachfront");
  assert.ok(entry, "Unity Beachfront built-in missing");
  const level = new Level(new THREE.Scene(), entry);
  assert.ok(level.groundAccelerationStats.triangles >= 47_360);
  assert.ok(level.groundAccelerationStats.acceleratedMeshes >= 1);
  const denseGround = level.groundMeshes.filter(
    (ground) =>
      ((ground.geometry.getIndex()?.count ??
        ground.geometry.getAttribute("position")?.count ?? 0) / 3) >= 128,
  );
  assert.ok(denseGround.length > 0);
  assert.ok(denseGround.every((ground) => ground.geometry.boundsTree));
  const acceleratedGroundRaycasts = level.groundMeshes.map(
    (ground) => ground.raycast,
  );
  const groundBundle = [
    [0, 0, 120],
    [0, 0, 12],
    [0.55, 0, 12],
    [-0.55, 0, 12],
    [0, 0.55, 12],
    [0, -0.55, 12],
  ];
  const timeGroundBundle = (stock) => {
    level.groundMeshes.forEach((ground, index) => {
      ground.raycast = stock ? stockRaycast : acceleratedGroundRaycasts[index];
    });
    const raycaster = new THREE.Raycaster();
    const started = performance.now();
    let hits = 0;
    for (const [ox, oz, far] of groundBundle) {
      raycaster.set(
        new THREE.Vector3(
          level.spawnPos.x + ox,
          level.spawnPos.y + 2.5,
          level.spawnPos.z + oz,
        ),
        new THREE.Vector3(0, -1, 0),
      );
      raycaster.far = far;
      hits += raycaster.intersectObjects(level.groundMeshes, false).length;
    }
    return { elapsed: performance.now() - started, hits };
  };
  timeGroundBundle(true);
  timeGroundBundle(false);
  const stockBundles = [];
  const acceleratedBundles = [];
  for (let round = 0; round < 7; round++) {
    const stockBundle = timeGroundBundle(true);
    const acceleratedBundle = timeGroundBundle(false);
    assert.equal(
      acceleratedBundle.hits,
      stockBundle.hits,
      "Beachfront ground bundle changed hit count",
    );
    stockBundles.push(stockBundle.elapsed);
    acceleratedBundles.push(acceleratedBundle.elapsed);
  }
  const stockBundleMedian = median(stockBundles);
  const acceleratedBundleMedian = median(acceleratedBundles);
  const levelSpeedup = stockBundleMedian / Math.max(acceleratedBundleMedian, 1e-6);
  assert.ok(levelSpeedup >= 8, `Beachfront ground bundle speedup ${levelSpeedup.toFixed(1)}x`);
  assert.ok(
    acceleratedBundleMedian <= 1.5,
    `Beachfront accelerated six-ray bundle took ${acceleratedBundleMedian.toFixed(2)}ms`,
  );
  const ownedTrees = denseGround.map((ground) => ground.geometry);
  level.dispose();
  assert.ok(ownedTrees.every((ground) => !ground.boundsTree));

  let checkedLevels = 0;
  let checkedDenseMeshes = 0;
  let slowestBuild = { id: "", ms: 0 };
  for (const builtIn of BUILTIN_LEVELS) {
    const candidate = new Level(new THREE.Scene(), builtIn);
    if (candidate.groundAccelerationStats.buildMs > slowestBuild.ms) {
      slowestBuild = {
        id: builtIn.id,
        ms: candidate.groundAccelerationStats.buildMs,
      };
    }
    for (const ground of candidate.groundMeshes) {
      const triangles =
        (ground.geometry.getIndex()?.count ??
          ground.geometry.getAttribute("position")?.count ?? 0) / 3;
      if (triangles < 128) continue;
      checkedDenseMeshes++;
      assert.ok(
        ground.geometry.boundsTree,
        `${builtIn.id}: dense ${ground.name || ground.geometry.type} lacks BVH`,
      );
      assert.equal(
        ground.raycast,
        acceleratedRaycast,
        `${builtIn.id}: dense ground retained stock raycast`,
      );
    }
    checkedLevels++;
    candidate.dispose();
  }

  disposeGroundAcceleration(acceleration.ownedGeometries, new Set());
  assert.ok(!geometry.boundsTree);
  geometry.dispose();
  materials.forEach((material) => material.dispose());

  console.log(
    `Validated universal ground BVH parity and lifecycle; ` +
      `${speedup.toFixed(1)}x synthetic ray speedup ` +
      `(${stockMedian.toFixed(2)}ms -> ${acceleratedMedian.toFixed(2)}ms per 40 rays); ` +
      `${levelSpeedup.toFixed(1)}x Beachfront six-ray speedup ` +
      `(${stockBundleMedian.toFixed(2)}ms -> ${acceleratedBundleMedian.toFixed(2)}ms); ` +
      `${checkedDenseMeshes} dense meshes across ${checkedLevels} built-ins prewarmed; ` +
      `slowest BVH build ${slowestBuild.id} ${slowestBuild.ms.toFixed(1)}ms.`,
  );
} finally {
  await server.close();
}

process.exit(0);
