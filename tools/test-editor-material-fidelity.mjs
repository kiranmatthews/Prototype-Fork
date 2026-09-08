import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import * as THREE from "three";

const harness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(harness.slice(harness.indexOf("function installHeadlessDom()"),
  harness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true, hmr: false, ws: false } });
const clone = value => JSON.parse(JSON.stringify(value));
const dataFor = components => ({ v: 1, name: "Material fidelity", spawn: [0, 1, 0], killY: -30,
  components: [...components, { t: "gate", p: [0, 0, -10] }] });
const allMeshes = level => { const meshes = []; level.root.traverse(o => { if (o.isMesh) meshes.push(o); }); return meshes; };
const corners = meshes => meshes.flatMap(mesh => {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry, normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  return Array.from({ length: g.index?.count ?? g.attributes.position.count }, (_, i) => {
    const index = g.index?.getX(i) ?? i;
    return { p: new THREE.Vector3().fromBufferAttribute(g.attributes.position, index).applyMatrix4(mesh.matrixWorld),
      n: new THREE.Vector3().fromBufferAttribute(g.attributes.normal, index).applyNormalMatrix(normalMatrix),
      uv: g.attributes.uv ? [g.attributes.uv.getX(index), g.attributes.uv.getY(index)] : null };
  });
});
const colorEquals = (a, b, label) => assert.ok(Math.max(...["r", "g", "b"].map(k => Math.abs(a[k] - b[k]))) < 1e-6, label);
const ordinaryMaterial = (actual, expected) => {
  assert.equal(actual.type, expected.type);
  colorEquals(actual.color, expected.color, "surface tint changed");
  colorEquals(actual.emissive, expected.emissive, "surface emission changed");
  for (const field of ["fog", "opacity", "transparent", "side", "vertexColors"])
    assert.equal(actual[field], expected[field], `${field} changed`);
  if (!expected.map) assert.equal(actual.map, null, "untextured native surface acquired a texture");
  else assert.deepEqual(actual.map.repeat.toArray(), expected.map.repeat.toArray());
};
const compareCorners = (actual, expected, transform = new THREE.Matrix4()) => {
  assert.equal(actual.length, expected.length);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(transform);
  for (let i = 0; i < actual.length; i++) {
    assert.ok(actual[i].p.distanceTo(expected[i].p.clone().applyMatrix4(transform)) < .00035, `triangle ${i} changed`);
    assert.ok(actual[i].n.distanceTo(expected[i].n.clone().applyNormalMatrix(normalMatrix)) < .000005, `normal ${i} changed`);
    if (expected[i].uv) for (let k = 0; k < 2; k++)
      assert.ok(Math.abs(actual[i].uv[k] - expected[i].uv[k]) < .000016, `metric UV ${i}/${k} changed`);
  }
};
try {
  const api = await server.ssrLoadModule("/src/level.ts");
  const { setComponentPosition, Editor } = await server.ssrLoadModule("/src/editor.ts");
  const { UNITY_SAND_AO_PROGRAM_KEY } = await server.ssrLoadModule("/src/unitySandMaterial.ts");
  const build = data => new api.Level(new THREE.Scene(), { id: "material-user-copy", name: data.name, data: clone(data) });
  const sandSource = new api.Level(new THREE.Scene(), { id: "beachfront", name: "Beachside Run" });
  const sandCapture = sandSource.captureData();
  assert.ok(api.normalizeCustomLevelData(sandCapture), "native shoreline export exceeded interchange limits");
  assert.ok(api.parseCustomLevelJson(JSON.stringify(sandCapture)));
  const sandComponents = sandCapture.components.filter(c => c.materialStyle === "unity-sand");
  assert.equal(sandComponents.length, 12);
  const nativeSand = sandSource.groundMeshes.find(m => m.name === "Showcase1ContinuousSandSeabed");
  const sourceCorners = corners([nativeSand]);
  for (let cycle = 0; cycle < 3; cycle++) {
    const sandCopy = build(dataFor(sandComponents));
    const copies = sandCopy.groundMeshes.filter(m => m.name === nativeSand.name);
    assert.equal(copies.length, 12);
    compareCorners(corners(copies), sourceCorners);
    const expected = nativeSand.material, actual = copies[0].material;
    assert.ok(actual.isMeshStandardMaterial);
    assert.equal(new Set(copies.map(m => m.material)).size, 1, "same-style chunks should share their material");
    ordinaryMaterial(actual, expected);
    for (const field of ["roughness", "metalness", "emissiveIntensity", "aoMapIntensity"])
      assert.equal(actual[field], expected[field], `Unity sand ${field}`);
    assert.deepEqual(actual.normalScale.toArray(), expected.normalScale.toArray());
    for (const role of ["map", "normalMap", "aoMap"]) {
      assert.ok(actual[role]);
      for (const field of ["name", "colorSpace", "wrapS", "wrapT", "minFilter", "magFilter", "channel"])
        assert.equal(actual[role][field], expected[role][field], `${role}/${field}`);
      assert.deepEqual(actual[role].repeat.toArray(), [1, 1]);
    }
    assert.equal(actual.customProgramCacheKey(), UNITY_SAND_AO_PROGRAM_KEY);
    const shader = { fragmentShader: "texture2D( aoMap, vAoMapUv ).r" };
    actual.onBeforeCompile(shader); assert.match(shader.fragmentShader, /vAoMapUv \).g/);
    for (const m of copies) {
      for (const channel of ["uv1", "uv2"])
        assert.deepEqual(Array.from(m.geometry.attributes[channel].array), Array.from(m.geometry.attributes.uv.array));
      assert.ok(Array.from(m.geometry.attributes.tangent.array).every(Number.isFinite));
    }
    // Bounds-tree collision and height stay independent of the material style.
    for (const i of [100, 1200, 8000, 16000, 24000, 36000]) {
      const p = sourceCorners[i].p.clone(); p.y += 10;
      const ray = new THREE.Raycaster(p, new THREE.Vector3(0, -1, 0), 0, 30);
      const before = ray.intersectObject(nativeSand, false)[0];
      const after = ray.intersectObjects(copies, false)[0];
      assert.ok(before && after); assert.ok(Math.abs(before.point.y - after.point.y) < .0003);
    }
    const counts = new Map();
    for (const resource of [actual, actual.map, actual.normalMap, actual.aoMap])
      resource.addEventListener("dispose", () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
    sandCopy.dispose();
    assert.deepEqual([...counts.values()], [1, 1, 1, 1], "shared shoreline resources must be released exactly once");
  }
  const transformedComponent = clone(sandComponents[0]);
  const originalPosition = [...transformedComponent.p];
  setComponentPosition(transformedComponent, [originalPosition[0] + 11, originalPosition[1] + 3, originalPosition[2]]);
  transformedComponent.yaw = 31; transformedComponent.s = [1.2, .75, 1.4];
  const transform = new THREE.Matrix4().makeTranslation(...transformedComponent.p)
    .multiply(new THREE.Matrix4().makeRotationY(31 * Math.PI / 180))
    .multiply(new THREE.Matrix4().makeScale(1.2, .75, 1.4))
    .multiply(new THREE.Matrix4().makeTranslation(-originalPosition[0], -originalPosition[1], -originalPosition[2]));
  const unchanged = build(dataFor([sandComponents[0]]));
  const moved = build(dataFor([transformedComponent]));
  compareCorners(corners(moved.groundMeshes.filter(m => m.name === nativeSand.name)),
    corners(unchanged.groundMeshes.filter(m => m.name === nativeSand.name)), transform);
  assert.equal(moved.groundMeshes[0].material.type, "MeshStandardMaterial");
  unchanged.dispose(); moved.dispose(); sandSource.dispose();

  const descent = new api.Level(new THREE.Scene(), { id: "descent", name: "The Descent" });
  const oilComponents = descent.captureData().components.filter(c => c.nm === "oil slick");
  const oils = descent.groundMeshes.filter(m => m.name === "oil slick");
  assert.ok(oilComponents.length > 0);
  assert.ok(oilComponents.every(c => c.tex === "solid" && c.emissive === "#14202a" && c.slip === true && c.edgeGrinding === false));
  const oilCopy = build(dataFor(oilComponents));
  const rebuiltOils = oilCopy.groundMeshes.filter(m => m.name === "oil slick");
  oils.forEach((mesh, index) => ordinaryMaterial(rebuiltOils[index].material, mesh.material));
  compareCorners(corners(rebuiltOils), corners(oils));
  assert.ok(rebuiltOils.every(m => m.userData.slippy && m.userData.edgeGrinding === false));
  oilCopy.dispose(); descent.dispose();

  const night = new api.Level(new THREE.Scene(), { id: "dark", name: "Nightworks" });
  const nightCapture = api.normalizeCustomLevelData(night.captureData());
  assert.ok(nightCapture, "current floating-rock Nightworks capture must remain valid");
  const nightCopy = build(nightCapture);
  assert.ok(night.nightworksRocks && nightCopy.nightworksRocks, "current Nightworks lost its intended rock owner");
  assert.deepEqual(nightCopy.captureData().components, nightCapture.components);
  assert.equal(nightCopy.groundMeshes.filter(m => m.userData.nightworksRock).length,
    night.groundMeshes.filter(m => m.userData.nightworksRock).length);
  nightCopy.dispose(); night.dispose();

  // Real Level authoring passes its safe overrides through the asynchronous
  // rock owner. A controlled registered template makes completion/fog timing
  // deterministic while retaining genuine meshes, LODs and material objects.
  const { NightworksRocks } = await server.ssrLoadModule("/src/nightworksRocks.ts");
  const templateGeometry = new THREE.BoxGeometry(1, 1, 1), templateFar = new THREE.BoxGeometry(1, 1, 1);
  const templateMap = new THREE.Texture();
  for (const resource of [templateGeometry, templateFar, templateMap]) resource.userData.shared = true;
  const templateUvs = Array.from(templateGeometry.attributes.uv.array);
  let templateDisposals = 0;
  for (const resource of [templateGeometry, templateFar, templateMap]) resource.addEventListener("dispose", () => templateDisposals++);
  let releaseTemplate;
  const templateReady = new Promise(resolve => { releaseTemplate = resolve; });
  const originalEntryBuilder = api.Level.prototype.buildEntry;
  api.Level.prototype.buildEntry = function (entry) {
    this.nightworksRocks = new NightworksRocks(() => templateReady);
    return originalEntryBuilder.call(this, entry);
  };
  let authoredRocks;
  const appearances = [{}, {}, { color: "#ff6600", emissive: "#335577", tex: "checker" },
    { color: "#44bb66", emissive: "#112233", tex: "checker" }, { color: "#778899", tex: "solid" }];
  const rockData = { ...dataFor(appearances.map((appearance, index) => ({
    t: "platform", dkind: "nightplateau", p: [index * 12, 0, 0], s: [8, 4, 8], ...appearance,
  }))), keepPlayFog: false };
  assert.ok(api.normalizeCustomLevelData(rockData));
  try { authoredRocks = build(rockData); }
  finally { api.Level.prototype.buildEntry = originalEntryBuilder; }
  const proxies = authoredRocks.groundMeshes.filter(m => m.userData.nightworksRock);
  assert.equal(proxies.length, appearances.length);
  assert.equal(proxies[0].material.color.getHex(), 0xa98258, "omitted color changed the upstream fallback");
  assert.equal(proxies[0].material.emissive.getHex(), 0x1e2638, "omitted emission changed the upstream fallback");
  assert.ok(proxies.every(mesh => mesh.material.fog === false), "explicit course fog choice missed the synchronous rocks");
  proxies[0].material.fog = true; // model a view change while the shared asset is still loading
  for (const i of [2, 3]) {
    assert.equal(proxies[i].material.color.getHexString(), appearances[i].color.slice(1));
    assert.equal(proxies[i].material.emissive.getHexString(), appearances[i].emissive.slice(1));
    assert.ok(proxies[i].material.map);
    assert.equal(proxies[i].geometry.attributes.uv.count, proxies[i].geometry.attributes.position.count);
    assert.ok(Array.from(proxies[i].geometry.attributes.uv.array).every(Number.isFinite));
  }
  assert.equal(proxies[4].material.map, null);
  releaseTemplate({ geometry: templateGeometry, lodGeometry: templateFar, map: templateMap });
  await authoredRocks.nightworksRocks.ready();
  assert.deepEqual(authoredRocks.nightworksRocks.errors, []);
  const lods = proxies.map(proxy => {
    const meshes = []; proxy.traverse(object => { if (object.isMesh && object !== proxy) meshes.push(object); });
    assert.equal(meshes.length, 2); assert.equal(meshes[0].geometry, templateGeometry); assert.equal(meshes[1].geometry, templateFar);
    assert.equal(meshes[0].material, meshes[1].material, "near/far LOD appearance diverged");
    return meshes;
  });
  assert.equal(lods[0][0].material.fog, true); assert.equal(lods[1][0].material.fog, false);
  assert.notEqual(lods[0][0].material, lods[1][0].material, "opposite fog states shared a mutable material");
  assert.equal(lods[0][0].material.color.getHex(), 0xffffff);
  assert.equal(lods[0][0].material.emissive.getHex(), 0x293c60);
  assert.equal(lods[0][0].material.emissiveIntensity, .24);
  assert.equal(lods[0][0].material.map, templateMap, "absent texture replaced the registered asset map");
  for (const i of [2, 3]) {
    assert.equal(lods[i][0].material.color.getHexString(), appearances[i].color.slice(1));
    assert.equal(lods[i][0].material.emissive.getHexString(), appearances[i].emissive.slice(1));
    assert.equal(lods[i][0].material.emissiveIntensity, 1);
    assert.equal(lods[i][0].material.map, proxies[i].material.map);
    assert.equal(lods[i][0].material.fog, false);
  }
  assert.notEqual(lods[2][0].material, lods[3][0].material);
  assert.equal(lods[2][0].material.map, lods[3][0].material.map, "safe texture overrides duplicated maps");
  lods[2][0].material.color.setHex(0x112233);
  assert.equal(lods[3][0].material.color.getHex(), 0x44bb66, "one appearance variant recolored its sibling");
  assert.equal(lods[4][0].material.map, null);
  assert.deepEqual(Array.from(templateGeometry.attributes.uv.array), templateUvs, "override mutated shared asset UVs");
  authoredRocks.dispose(); assert.equal(templateDisposals, 0, "per-Level ownership freed registered asset resources");
  let releaseLate;
  const lateOwner = new NightworksRocks(() => new Promise(resolve => { releaseLate = resolve; }));
  const lateProxy = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial());
  const lateHolder = lateOwner.attach(lateProxy, "nightplateau", [8, 4, 8], new THREE.Vector3(), 0, lateProxy,
    { color: "#ff6600", emissive: "#335577", map: null });
  lateOwner.dispose(); releaseLate({ geometry: templateGeometry, map: templateMap }); await lateOwner.ready();
  assert.equal(lateHolder.children.length, 0); assert.equal(lateProxy.material.visible, true);
  assert.equal(templateDisposals, 0); lateProxy.geometry.dispose(); lateProxy.material.dispose();
  templateGeometry.dispose(); templateFar.dispose(); templateMap.dispose();

  // Nightworks now intentionally uses fitted floating rocks. Keep its former
  // glowing-slab capture regression as a small native-builder fixture, without
  // expecting the old aesthetic or its platform count in the new course.
  const originalJungleBuilder = api.Level.prototype.buildJungle;
  let legacyGlow;
  api.Level.prototype.buildJungle = function () {
    this.keepPlayFog = true; this.killY = -30;
    this.spawnPos.set(0, 3.1, 0); this.currentSpawn.copy(this.spawnPos);
    this.slab("platform", 10, -20, 3, 12,
      new THREE.MeshLambertMaterial({ color: 0x6d7484, emissive: 0x10131c }), false, 0, "stone");
    this.finishGate(3, -18);
  };
  try { legacyGlow = new api.Level(new THREE.Scene(), { id: "legacy-glow-fixture", name: "Legacy glowing stone" }); }
  finally { api.Level.prototype.buildJungle = originalJungleBuilder; }
  const legacyCapture = api.normalizeCustomLevelData(legacyGlow.captureData());
  assert.ok(legacyCapture);
  const platforms = legacyCapture.components.filter(c => c.t === "platform" && c.emissive === "#10131c");
  const nativePlatforms = legacyGlow.groundMeshes.filter(m => m.name === "platform" && m.material.emissive?.getHex() === 0x10131c);
  assert.equal(platforms.length, 1); assert.equal(nativePlatforms.length, 1);
  const legacyCopy = build({ ...dataFor(platforms), keepPlayFog: true });
  const copiedPlatforms = legacyCopy.groundMeshes.filter(m => m.name === "platform");
  copiedPlatforms.forEach((mesh, i) => ordinaryMaterial(mesh.material, nativePlatforms[i].material));
  const nightBaseline = build({ ...dataFor(platforms.map(({ emissive, ...c }) => c)), keepPlayFog: true });
  assert.deepEqual(legacyCopy.walls.map(box => [...box.min, ...box.max]), nightBaseline.walls.map(box => [...box.min, ...box.max]));
  assert.deepEqual(legacyCopy.rails.map(rail => rail.points.map(p => [...p])), nightBaseline.rails.map(rail => rail.points.map(p => [...p])));
  nightBaseline.dispose();
  legacyCopy.dispose(); legacyGlow.dispose();

  for (const t of api.EMISSIVE_COMPONENT_TYPES) {
    const component = { t, p: [0, 0, 0], tex: "solid", emissive: "#335577",
      ...(t === "mesh" ? { vertices: [-4, 0, 2, 4, 0, 2, 0, 0, -4] } : {}) };
    const data = api.normalizeCustomLevelData(dataFor([component])); assert.ok(data, `${t} emission rejected`);
    const level = build(data);
    const mesh = allMeshes(level).find(m => m.userData.editorIdx === 0 && m.material.emissive);
    assert.ok(mesh, `${t} has no editable surface`);
    assert.equal(mesh.material.emissive.getHex(), 0x335577, `${t} accepted but ignored emission`);
    assert.ok(api.normalizeCustomLevelData(level.captureData())); level.dispose();
  }
  const defaults = build(dataFor([{ t: "platform", p: [0, 0, 0] },
    { t: "mesh", p: [0, 2, 0], vertices: [-4, 0, 2, 4, 0, 2, 0, 0, -4] }]));
  assert.ok(defaults.groundMeshes.filter(m => m.userData.editorIdx < 2).every(m => m.material.map),
    "new omitted-texture geometry lost its intentional default"); defaults.dispose();
  const variants = build(dataFor([sandComponents[0], { ...clone(sandComponents[1]), emissive: "#334455", color: "#cccccc" }]));
  const variantMeshes = variants.groundMeshes.filter(m => m.name === nativeSand.name);
  assert.notEqual(variantMeshes[0].material, variantMeshes[1].material);
  assert.equal(variantMeshes[0].material.normalMap, variantMeshes[1].material.normalMap, "tint changes duplicated owned sand maps");
  assert.equal(variantMeshes[1].material.emissive.getHex(), 0x334455);
  assert.equal(variantMeshes[1].material.emissiveIntensity, 1);
  assert.equal(variantMeshes[1].material.customProgramCacheKey(), UNITY_SAND_AO_PROGRAM_KEY);
  // Vertex edits discard stale normals and regenerate a finite tangent frame.
  const edited = clone(sandComponents[0]);
  const editor = Object.create(Editor.prototype), vertex = editor.meshVertexWorldPosition(edited, 0);
  editor.setMeshVertexWorldPosition(edited, 0, vertex.add(new THREE.Vector3(0, .25, 0)));
  assert.equal(edited.normals, undefined);
  const editedLevel = build(dataFor([edited]));
  assert.ok(Array.from(editedLevel.groundMeshes[0].geometry.attributes.tangent.array).every(Number.isFinite));
  editedLevel.dispose(); variants.dispose();

  // A tiny accepted environment document must not allocate three 2K texture
  // wrappers per patch. Exercise the full 256-patch boundary with styled mesh
  // variants present too, using the genuine material factory/Level builder.
  const maxPatches = { ...dataFor([{ ...sandComponents[0] },
    { ...clone(sandComponents[1]), emissive: "#123456" }]),
    unitySand: Array.from({ length: 256 }, (_, i) => ({ p: [i % 16 * 3, -2, Math.floor(i / 16) * 3], s: [2, 1, 2], yaw: i % 4 * 90 })) };
  assert.ok(api.normalizeCustomLevelData(maxPatches), "the full useful patch limit was reduced");
  const nativeLoad = THREE.TextureLoader.prototype.load;
  const loadedMaps = [];
  THREE.TextureLoader.prototype.load = function (url, onLoad) {
    const texture = new THREE.Texture();
    loadedMaps.push({ url, texture, finish: () => { texture.image = { width: 2048, height: 2048 }; texture.needsUpdate = true; onLoad?.(texture); } });
    return texture;
  };
  let pooled;
  try { pooled = build(maxPatches); }
  finally { THREE.TextureLoader.prototype.load = nativeLoad; }
  const patches = [...pooled.customUnitySand];
  const styled = pooled.groundMeshes.filter(m => m.material.isMeshStandardMaterial);
  assert.equal(patches.length, 256);
  assert.equal(new Set(patches.map(p => p.owner.material)).size, 256, "patch material state must remain independent");
  const owners = [...patches.map(p => p.owner.material), ...styled.map(m => m.material)];
  const textures = new Set(owners.flatMap(m => [m.map, m.normalMap, m.aoMap]));
  assert.equal(textures.size, 3, "environment and mesh families allocated separate map pools");
  assert.equal(loadedMaps.filter(entry => entry.url.includes("/matrixrex/sand-")).length, 3);
  patches[0].owner.material.color.setHex(0x123456);
  assert.equal(patches[1].owner.material.color.getHex(), 0xffffff);
  assert.equal(styled[0].material.color.getHex(), 0xffffff);
  const disposalCounts = new Map();
  for (const resource of [...owners, ...textures]) resource.addEventListener("dispose", () =>
    disposalCounts.set(resource, (disposalCounts.get(resource) ?? 0) + 1));
  for (const pending of loadedMaps) pending.finish();
  assert.ok([...textures].every(t => t.image.width === 2048));
  pooled.dispose();
  assert.ok([...new Set(owners), ...textures].every(resource => disposalCounts.get(resource) === 1),
    "shared patch resources were leaked or disposed repeatedly");
  // A late image completion cannot allocate any new wrappers or double-free
  // the pool after the Level has been removed.
  for (const pending of loadedMaps) pending.finish();
  assert.equal(textures.size, 3);
  assert.ok([...textures].every(texture => texture.userData.disposed && disposalCounts.get(texture) === 1));

  const retained = build({ ...dataFor([]), unitySand: maxPatches.unitySand });
  const retainedPatch = retained.customUnitySand[0];
  const retainedMaps = [retainedPatch.mesh.material.map, retainedPatch.mesh.material.normalMap, retainedPatch.mesh.material.aoMap];
  let retainedDisposals = 0;
  for (const resource of [retainedPatch.mesh.geometry, retainedPatch.mesh.material, ...retainedMaps])
    resource.addEventListener("dispose", () => retainedDisposals++);
  const failedOwners = [];
  const createSand = api.Level.prototype.createLevelSandMaterial, buildMesh = api.Level.prototype.buildSurfaceMesh;
  api.Level.prototype.createLevelSandMaterial = function (...args) {
    const owner = createSand.apply(this, args); failedOwners.push(owner); return owner;
  };
  api.Level.prototype.buildSurfaceMesh = function () {
    this.root.add(new THREE.Mesh(retainedPatch.mesh.geometry, retainedPatch.mesh.material));
    throw new Error("shared sand constructor failure");
  };
  const failedScene = new THREE.Scene();
  try { assert.throws(() => new api.Level(failedScene, { id: "failed-sand", name: maxPatches.name, data: maxPatches }, retained),
    /shared sand constructor failure/); }
  finally { api.Level.prototype.createLevelSandMaterial = createSand; api.Level.prototype.buildSurfaceMesh = buildMesh; }
  assert.equal(failedOwners.length, 256);
  assert.ok(failedOwners.every(owner => owner.disposed));
  assert.equal(new Set(failedOwners.flatMap(owner => Object.values(owner.maps))).size, 3);
  assert.ok(failedOwners.every(owner => Object.values(owner.maps).every(t => t.userData.disposed)));
  assert.equal(failedScene.children.length, 0); assert.equal(retainedDisposals, 0);
  const successor = build(dataFor([]));
  successor.root.add(new THREE.Mesh(retainedPatch.mesh.geometry, retainedPatch.mesh.material));
  retained.dispose(successor);
  assert.equal(retainedDisposals, 0, "preservation freed a borrowed environment patch");
  successor.dispose(); assert.equal(retainedDisposals, 5, "successor did not release its preserved patch/maps");

  for (const failAt of [2, 3]) {
    const partialMaps = [], partialScene = new THREE.Scene(); let calls = 0;
    THREE.TextureLoader.prototype.load = function () {
      if (++calls === failAt) throw new Error("synchronous sand loader failure");
      const texture = new THREE.Texture(), item = { texture, disposals: 0 };
      texture.addEventListener("dispose", () => item.disposals++); partialMaps.push(item); return texture;
    };
    try { assert.throws(() => new api.Level(partialScene, { id: "partial-maps", name: "Partial maps", data: maxPatches }),
      /synchronous sand loader failure/); }
    finally { THREE.TextureLoader.prototype.load = nativeLoad; }
    assert.equal(partialMaps.length, failAt - 1);
    assert.ok(partialMaps.every(item => item.disposals === 1 && item.texture.userData.disposed), "partial pool leaked a returned texture");
    assert.equal(partialScene.children.length, 0);
  }

  const mesh = { t: "mesh", p: [0, 0, 0], vertices: [-1, 0, 1, 1, 0, 1, 0, 0, -1] };
  for (const materialStyle of [null, {}, [], "standard", "Unity-sand", "../sand", "https://bad.invalid/sand", "__proto__"])
    assert.equal(api.normalizeCustomLevelData(dataFor([{ ...mesh, materialStyle }])), null);
  assert.equal(api.normalizeCustomLevelData(dataFor([{ ...mesh, materialStyle: "unity-sand", tex: "checker" }])), null);
  for (const t of ["platform", "mover", "gate", "decor"])
    assert.equal(api.normalizeCustomLevelData(dataFor([{ t, p: [0, 0, 0], materialStyle: "unity-sand" }])), null);
  for (const t of ["woodpath", "crate", "mover", "phasepad", "gate"])
    assert.equal(api.normalizeCustomLevelData(dataFor([{ t, p: [0, 0, 0], emissive: "#123456" }])), null);
  console.log("PASS native shoreline PBR maps/AO/UVs, shared lifetime, transforms/ground rays, oil/no-texture, Nightworks glow, 9 implemented surfaces, vertex edits, style rejection and accepted256-patch shared-map/failure preservation");
} finally { await server.close(); }
