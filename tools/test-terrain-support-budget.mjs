import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import * as THREE from "three";

// Real Level construction and raycasting; the shared shim replaces only DOM
// images/canvas. No timing threshold, skipped intersections or WebGL required.
const harness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(harness.slice(harness.indexOf("function installHeadlessDom()"),
  harness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true, hmr: false, ws: false } });
const originalTriangle = THREE.Ray.prototype.intersectTriangle;
const originalIntersections = THREE.Raycaster.prototype.intersectObjects;
let active = null;
let stock = false;
THREE.Ray.prototype.intersectTriangle = function (...args) {
  if (active) active.triangleTests++;
  return originalTriangle.apply(this, args);
};
THREE.Raycaster.prototype.intersectObjects = function (objects, ...args) {
  if (!active) return originalIntersections.call(this, objects, ...args);
  active.probes++;
  active.candidateTriangles = objects.reduce((sum, mesh) => sum +
    (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
  const raycasts = objects.map(mesh => mesh.raycast);
  const nearest = this.firstHitOnly;
  if (stock) {
    for (const mesh of objects) mesh.raycast = THREE.Mesh.prototype.raycast;
    this.firstHitOnly = false;
  } else {
    assert.equal(nearest, true, "the private support lookup must request only nearest hits");
    for (const mesh of objects) if ((mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 >= 128)
      assert.ok(mesh.geometry.boundsTree, "dense support was queried before acceleration");
  }
  try {
    const hits = originalIntersections.call(this, objects, ...args);
    active.hits.push(hits[0]?.point.y ?? null);
    active.maxHits = Math.max(active.maxHits, hits.length);
    return hits;
  } finally {
    objects.forEach((mesh, index) => { mesh.raycast = raycasts[index]; });
    this.firstHitOnly = nearest;
  }
};

const meshComponent = (repeat = false, count = 2048) => {
  if (repeat) return { t: "mesh", p: [0, 0, 0],
    vertices: [-100, 0, 50, 100, 0, 50, 0, 0, -200],
    indices: Array.from({ length: count * 3 }, (_, i) => i % 3), edgeGrinding: false };
  const side = Math.sqrt(count / 2), vertices = [], indices = [];
  for (let z = 0; z <= side; z++) for (let x = 0; x <= side; x++)
    vertices.push(-20 + x * 40 / side, 0, 20 - z * 160 / side);
  for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
    const a = z * (side + 1) + x, b = a + 1, c = a + side + 1, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  return { t: "mesh", p: [0, 0, 0], vertices, indices, edgeGrinding: false };
};
const timber = (length = 120, extra = {}) => ({ t: "woodpath", p: [0, 8, 0],
  pts: [[0, 0], [0, -length]], supports: true, terrainSupports: true, rails: false, w: 6, ...extra });
const dataFor = components => ({ v: 1, name: "Terrain support regression", spawn: [0, 8.1, 0],
  killY: -30, components: [...components, { t: "gate", p: [0, 8, -15] }] });
let Level, originalWood;
try {
  const api = await server.ssrLoadModule("/src/level.ts");
  const budget = await server.ssrLoadModule("/src/terrainSupportBudget.ts");
  ({ Level } = api);
  originalWood = Level.prototype.buildWoodPath;
  Level.prototype.buildWoodPath = function (c) {
    const row = { probes: 0, triangleTests: 0, candidateTriangles: 0, hits: [], maxHits: 0 };
    active = row;
    try { return originalWood.call(this, c); }
    finally { active = null; (this.supportMeasurements ??= []).push(row); }
  };
  const build = data => new Level(new THREE.Scene(), { id: "support-test", name: data.name, data });
  const owned = level => [...level.acceleratedGroundGeometries];

  const gridData = dataFor([...Array.from({ length: 4 }, () => meshComponent()), timber()]);
  assert.ok(api.normalizeCustomLevelData(gridData));
  stock = true;
  const stockLevel = build(gridData), baseline = stockLevel.supportMeasurements[0];
  stockLevel.dispose();
  stock = false;
  const gridLevel = build(gridData), accelerated = gridLevel.supportMeasurements[0];
  assert.equal(baseline.probes, 56);
  assert.equal(baseline.triangleTests, 56 * 8192);
  assert.deepEqual(accelerated.hits, baseline.hits, "BVH changed support heights");
  assert.ok(accelerated.triangleTests < baseline.triangleTests / 50,
    `ordinary grid did not reduce triangle visits: ${JSON.stringify(accelerated)}`);
  assert.equal(owned(gridLevel).length, 5, "final BVH pass lost the four early terrain trees");
  assert.equal(gridLevel.groundAccelerationStats.uniqueGeometries, 5);
  assert.equal(gridLevel.terrainSupportTriangleTests, 56 * accelerated.candidateTriangles);
  assert.ok(gridLevel.terrainSupportRayWork >= accelerated.triangleTests);
  for (const mesh of gridLevel.groundMeshes.filter(mesh => mesh.name === "triangle surface")) {
    assert.ok(mesh.geometry.boundsTree.indirect);
    assert.deepEqual(Array.from(mesh.geometry.index.array), gridData.components[0].indices);
  }
  const released = owned(gridLevel), disposalCounts = new Map();
  for (const geometry of released) geometry.addEventListener("dispose", () => {
    assert.equal(geometry.boundsTree, null, "geometry was freed before its owned BVH");
    disposalCounts.set(geometry, (disposalCounts.get(geometry) ?? 0) + 1);
  });
  gridLevel.dispose();
  assert.ok(released.every(geometry => !geometry.boundsTree && disposalCounts.get(geometry) === 1));

  // Adversarial leaves still need a hard budget; nearest-only alone cannot
  // reduce triangle tests when all faces occupy exactly the same bounds.
  const overlapData = dataFor([meshComponent(true, 4096), timber()]);
  stock = true;
  const overlapStock = build(overlapData), overlapExpected = overlapStock.supportMeasurements[0];
  overlapStock.dispose();
  stock = false;
  const overlap = build(overlapData), overlapActual = overlap.supportMeasurements[0];
  assert.deepEqual(overlapActual.hits, overlapExpected.hits);
  assert.equal(overlapActual.triangleTests, 56 * 4096);
  assert.equal(overlapActual.maxHits, 1);
  assert.equal(overlapExpected.maxHits, 4096);
  assert.ok(overlap.terrainSupportRayWork >= overlapActual.triangleTests);
  overlap.dispose();
  assert.equal(new THREE.Raycaster().firstHitOnly, undefined, "support optimization changed the global ray contract");

  // Different sides, transforms and overlapping heights still choose the
  // highest support beneath the deck. General raycasters retain all faces.
  const transformedData = dataFor([
    { ...meshComponent(true, 256), s: [1.2, 0.7, 1.1], yaw: 11, doubleSided: true },
    { ...meshComponent(true, 256), p: [0, 2, 0], s: [1.3, 2, 1.2], yaw: -7 }, timber(24),
  ]);
  stock = true;
  const transformedStock = build(transformedData), transformedHeights = transformedStock.supportMeasurements[0].hits;
  transformedStock.dispose();
  stock = false;
  const transformed = build(transformedData);
  assert.deepEqual(transformed.supportMeasurements[0].hits, transformedHeights);
  assert.ok(transformedHeights.every(y => Math.abs(y - 2) < 1e-6));
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0))
    .intersectObjects(transformed.groundMeshes.filter(mesh => !mesh.userData.woodPathComp), false).length, 512);
  transformed.dispose();

  const hostile = dataFor([...Array.from({ length: 25 }, () => meshComponent(true, 4000)), timber(600)]);
  assert.ok(new TextEncoder().encode(JSON.stringify(hostile)).length < 650_000);
  assert.equal(api.normalizeCustomLevelData(hostile), null, "27 million overlapping triangle tests passed import validation");
  assert.equal(api.normalizeCustomLevelData({ ...hostile, components: [...hostile.components].reverse() }), null);
  assert.equal(budget.terrainSupportMeshOverlap(meshComponent(true, 4096)), 4096);
  const unindexedOverlap = { t: "mesh", p: [0, 0, 0], edgeGrinding: false,
    vertices: Array.from({ length: 1365 }, () => [-100, 0, 50, 100, 0, 50, 0, 0, -200]).flat() };
  assert.equal(budget.terrainSupportMeshOverlap(unindexedOverlap), 1365);
  assert.equal(api.normalizeCustomLevelData(dataFor([
    ...Array.from({ length: 25 }, () => unindexedOverlap), timber(600),
  ])), null, "nonindexed faces bypassed overlap accounting");
  assert.equal(budget.terrainSupportMeshOverlap({ ...meshComponent(true, 4096), solid: false }), 0);
  assert.equal(budget.requiresTerrainSupportBuildCheck(gridData), true);
  hostile.components[25].supports = false;
  hostile.components[25].rails = true;
  assert.equal(api.normalizeCustomLevelData(hostile), null, "handrail-only support probes escaped the boundary");
  hostile.components[25].rails = false;
  assert.ok(api.normalizeCustomLevelData(hostile), "disabled terrain probes were incorrectly charged");
  assert.equal(budget.requiresTerrainSupportBuildCheck(hostile), false);
  const cumulative = dataFor([...Array.from({ length: 4 }, () => meshComponent(true)),
    ...Array.from({ length: 5 }, () => timber())]);
  assert.equal(api.normalizeCustomLevelData(cumulative), null, "support budget reset per path");

  // The runtime backstop does not trust a boundary formula. Bypass the public
  // parser here and prove it stops within the budget on the fifth path, disposing the
  // terrain trees acquired before the constructor threw.
  const install = Level.prototype.installGroundAcceleration;
  const failedTrees = new Set();
  const failedDisposals = new Map();
  let failedLevel;
  Level.prototype.installGroundAcceleration = function (...args) {
    install.apply(this, args);
    for (const geometry of owned(this)) if (!failedTrees.has(geometry)) {
      failedTrees.add(geometry);
      geometry.addEventListener("dispose", () => failedDisposals.set(geometry,
        (failedDisposals.get(geometry) ?? 0) + 1));
    }
    failedLevel = this;
  };
  const failedScene = new THREE.Scene();
  try {
    assert.throws(() => new Level(failedScene, { id: "rejected-support", name: cumulative.name, data: cumulative }),
      /Terrain support probing exceeds/);
  } finally { Level.prototype.installGroundAcceleration = install; }
  assert.ok(failedTrees.size >= 4, "test did not exercise early tree ownership");
  assert.ok(failedLevel.supportMeasurements.reduce((n, row) => n + row.probes, 0) < 280);
  assert.ok(failedLevel.supportMeasurements.reduce((n, row) => n + row.triangleTests, 0) <=
    budget.MAX_TERRAIN_SUPPORT_TRIANGLE_TESTS, "runtime visited triangles beyond its work limit");
  assert.ok([...failedTrees].every(geometry => !geometry.boundsTree), "rejected constructor leaked early BVHs");
  assert.ok([...failedTrees].every(geometry => failedDisposals.get(geometry) === 1),
    "rejected constructor must release every accelerated geometry exactly once");
  assert.equal(failedScene.children.length, 0, "rejected constructor left partial geometry attached");
  const rawExcess = dataFor([...Array.from({ length: 25 }, () => meshComponent()), timber(1600)]);
  assert.equal(api.normalizeCustomLevelData(rawExcess), null, "spatial filtering bypassed the broad raw buffer limit");
  const rawScene = new THREE.Scene();
  assert.throws(() => new Level(rawScene, { id: "raw-excess", name: rawExcess.name, data: rawExcess }),
    /Terrain support probing exceeds/);
  assert.equal(rawScene.children.length, 0);

  // Resource-preserving replacement transfers tree ownership to the survivor.
  const old = build(gridData), next = build(dataFor([{ t: "platform", p: [0, 0, 0] }]));
  const sharedMesh = old.groundMeshes.find(mesh => !mesh.userData.woodPathComp);
  const sharedTree = sharedMesh.geometry.boundsTree;
  const sharedCopy = new THREE.Mesh(sharedMesh.geometry, sharedMesh.material);
  next.root.add(sharedCopy); next.groundMeshes.push(sharedCopy);
  next.installGroundAcceleration(next.groundMeshes);
  old.dispose(next);
  assert.equal(sharedMesh.geometry.boundsTree, sharedTree);
  assert.ok(next.acceleratedGroundGeometries.has(sharedMesh.geometry));
  next.dispose();
  assert.equal(sharedMesh.geometry.boundsTree, null);

  // Formula coverage is checked against actual generated ground, including
  // fillets, fixed island tessellation, both vert-ramp implementations and
  // component order. No estimated count is accepted as its own oracle.
  const fixtures = [
    { t: "terrain", p: [0, 0, 0], pts: [[0, 0], [0, -120]], berms: true },
    { t: "terrain", p: [0, 0, 0], pts: [[0, 0], [3, -40], [0, -120]], curve: "spline", yaw: 37 },
    ...[false, true].map(shoreProfile => ({ t: "platform", p: [0, 0, 0], shoreProfile,
      pts: [[-8, 8, 2], [8, 8, 2], [8, -20, 2], [-8, -20, 2]] })),
    { t: "wall", p: [0, 0, 0], pts: [[-8, 8, 2], [8, 8, 2], [8, -20, 2], [-8, -20, 2]] },
    ...["quarter", "half"].flatMap(vkind => [
      { t: "vertramp", p: [0, 0, 0], len: 80, vkind },
      { t: "vertramp", p: [0, 0, 0], len: 80, vkind, deck: 2, yaw: 33 },
      { t: "vertramp", p: [0, 0, 0], vkind, deck: 2, curve: "spline", closed: true,
        pts: [[-8, 8], [8, 8], [8, -20], [-8, -20]] },
    ]),
    ...["rock", "bonusplatform", "worldmap", "ramp", "metal", "mover", "crumble", "trampoline", "speedpad"]
      .map(t => ({ t, p: [0, 0, 0] })),
  ];
  for (const component of fixtures) {
    const fixture = api.normalizeCustomLevelData(dataFor([timber(4.5), component]));
    assert.ok(fixture, `ordinary ${component.t} fixture must normalize`);
    let estimate = 0;
    for (const c of fixture.components) {
      let length = c.t === "terrain" ? 40 : c.len ?? 30;
      if (c.pts) {
        const points = c.closed ? [...c.pts, c.pts[0]] : c.pts;
        length = points.slice(1).reduce((sum, point, index) => sum + Math.hypot(
          point[0] - points[index][0], point[1] - points[index][1],
          (point[3] ?? 0) - (points[index][3] ?? 0)), 0);
      }
      const dense = c.pts?.reduce((sum, point) => sum + ((point[2] ?? 0) > 0.01 ? 7 : 1), 0) ?? 2;
      estimate += budget.terrainSupportGroundTriangles(c, length, dense);
    }
    const level = build(fixture);
    assert.ok(estimate >= level.supportMeasurements[0].candidateTriangles,
      `${JSON.stringify(component)} undercounted actual ground: ${estimate} < ${level.supportMeasurements[0].candidateTriangles}`);
    level.dispose();
  }

  let sourceCaptures = 0;
  for (const entry of api.BUILTIN_LEVELS) {
    if (entry.data) assert.ok(api.normalizeCustomLevelData(entry.data), `${entry.id} source rejected`);
    const level = new Level(new THREE.Scene(), entry);
    if (entry.id === "beachfront") {
      assert.ok(level.terrainSupportTriangleTests > budget.MAX_TERRAIN_SUPPORT_TRIANGLE_TESTS,
        "native compatibility test did not exercise spatial filtering");
      assert.ok(level.terrainSupportRayWork < budget.MAX_TERRAIN_SUPPORT_TRIANGLE_TESTS);
      const actual = level.supportMeasurements.reduce((n, row) => n + row.triangleTests, 0);
      assert.ok(level.terrainSupportRayWork >= actual, "native query work was undercounted");
    }
    assert.ok(api.normalizeCustomLevelData(level.captureData()), `${entry.id} native capture rejected`);
    sourceCaptures++;
    level.dispose();
  }
  const published = JSON.parse(await readFile(new URL("../public/levels.json", import.meta.url), "utf8")).levels;
  for (const entry of published)
    assert.ok(api.normalizeCustomLevelData(entry.data), `${entry.id} published data rejected`);
  console.log(`Terrain support: ${baseline.triangleTests} → ${accelerated.triangleTests} triangle visits; ` +
    `adversarial import/runtime rejection, ownership/disposal, ${fixtures.length} generator fixtures, ` +
    `${sourceCaptures} source/native captures and ${published.length} published entries passed.`);
} finally {
  if (Level && originalWood) Level.prototype.buildWoodPath = originalWood;
  THREE.Ray.prototype.intersectTriangle = originalTriangle;
  THREE.Raycaster.prototype.intersectObjects = originalIntersections;
  await server.close();
}
