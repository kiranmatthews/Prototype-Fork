import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import { createServer } from "vite";
import * as THREE from "three";

const harness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(harness.slice(harness.indexOf("function installHeadlessDom()"),
  harness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
const cacheDir = await mkdtemp(join(tmpdir(), "crown-quartz-"));
const server = await createServer({ configFile: false, cacheDir, appType: "custom", logLevel: "silent",
  optimizeDeps: {noDiscovery: true}, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
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
  const build = data => new api.Level(new THREE.Scene(), { id: "material-user-copy", name: data.name, data: clone(data) });
  // Authored mineral shading must survive rename, move, source capture and
  // legacy mesh harvesting; neither path may turn it into water or a texture.
  const { PIRATE_WRECK_LEVEL } = await server.ssrLoadModule("/src/levels/pirate-wreck.ts");
  const mineral = clone(PIRATE_WRECK_LEVEL.components.find(c => c.materialStyle === "crown-quartz"));
  assert.ok(mineral);
  for (const editing of [false, true]) {
    api.setEditorBuild(editing);
    const authored = { ...mineral, nm: "Renamed mineral", p: [7, 2, -12], fog: false, opacity: .65 };
    const data = api.normalizeCustomLevelData(dataFor([authored]));
    assert.ok(data);
    const level = build(data), mesh = allMeshes(level).find(m => m.name === authored.nm);
    assert.ok(mesh?.material.isMeshPhongMaterial);
    assert.equal(mesh.material.map, null);
    assert.deepEqual(level.captureData(), data);
    const harvested = level.captureSurfaceMesh(mesh, { solid: false, color: authored.color });
    assert.equal(harvested.length, 1);
    assert.equal(harvested[0].materialStyle, "crown-quartz");
    const restored = build(dataFor(harvested)), copy = allMeshes(restored).find(m => m.name === authored.nm);
    ordinaryMaterial(copy.material, mesh.material);
    assert.equal(copy.material.customProgramCacheKey(), mesh.material.customProgramCacheKey());
    const positions = corners([mesh]).map(({uv, ...corner}) => corner);
    compareCorners(corners([copy]), positions);
    restored.dispose(); level.dispose();
  }
  api.setEditorBuild(false);
  assert.equal(api.normalizeCustomLevelData(dataFor([{ ...mineral, tex: "stone" }])), null);

  console.log("Faceted quartz: play/editor source and harvested round trips preserve renamed, moved geometry, material and authoring choices.");
} finally {await server.close();await rm(cacheDir,{recursive:true,force:true});}
