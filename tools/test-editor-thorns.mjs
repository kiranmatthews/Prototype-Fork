import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import * as THREE from "three";

// Use actual Editor transforms and actual generated visual/pit geometry.
// Rendering and persistence are covered separately by the browser/UX gates.
const harness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(harness.slice(harness.indexOf("function installHeadlessDom()"),
  harness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true, hmr: false, ws: false } });
const clone = value => JSON.parse(JSON.stringify(value));
const fixture = components => ({ v: 1, name: "Thorn rotation regression", spawn: [0, 2, 16], killY: -40,
  components: [...components, { t: "platform", p: [0, 0, 16], s: [8, 1, 8] }, { t: "gate", p: [0, 1, 14] }] });
const visualPoints = level => {
  const group = level.thornClusters[0].group, points = [];
  group.updateWorldMatrix(true, true);
  group.traverse(object => {
    const position = object.geometry?.attributes.position;
    if (position) for (let i = 0; i < position.count; i++)
      points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld));
  });
  return points;
};
const lethal = (level, point) => level.pitBoxes.some(box => box.containsPoint(point) && !level.pitMissesPoly(box, point.x, point.z));
try {
  const { Editor, setComponentPosition } = await server.ssrLoadModule("/src/editor.ts");
  const { Level, normalizeCustomLevelData, setEditorBuild } = await server.ssrLoadModule("/src/level.ts");
  const build = data => new Level(new THREE.Scene(), { id: "thorn-fixture", name: data.name, data: clone(data) });
  const editorFor = data => {
    const editor = Object.create(Editor.prototype);
    Object.assign(editor, { data: clone(data), sel: [0, 1], commit() { return true; }, renderProps() {} });
    return editor;
  };
  let checked = 0;
  for (const quality of ["?lite", ""]) for (const editing of [false, true]) {
    window.location.search = quality; setEditorBuild(editing);
    for (const initialYaw of [0, 31, 90]) for (const turn of [90, -90]) {
      const p = [3, 4, -6];
      const data = fixture([{ t: "thorn", p, s: [12, 2, 2], seed: 17, color: "#bb3366", yaw: initialYaw },
        { t: "pit", p: [...p], s: [11, 1, 1], invisible: true, yaw: initialYaw }]);
      const editor = editorFor(data); editor.rotateSelection(turn);
      assert.ok(normalizeCustomLevelData(editor.data));
      const source = build(data), moved = build(editor.data);
      const transform = new THREE.Matrix4().makeTranslation(...p)
        .multiply(new THREE.Matrix4().makeRotationY(turn * Math.PI / 180))
        .multiply(new THREE.Matrix4().makeTranslation(...p.map(value => -value)));
      try {
        const a = visualPoints(source), b = visualPoints(moved); assert.equal(a.length, b.length);
        for (let i = 0; i < a.length; i++) assert.ok(b[i].distanceTo(a[i].clone().applyMatrix4(transform)) < 1e-6, "thorn geometry did not rotate with its core");
        for (const time of [0, .7, 1.8, 4.2]) {
          source.update(time); moved.update(time);
          assert.deepEqual(moved.thornClusters[0].pulseMaterials.map(m => m.emissiveIntensity), source.thornClusters[0].pulseMaterials.map(m => m.emissiveIntensity), "rotation reshuffled the glow phase");
        }
        for (let x = -8; x <= 8; x += .5) for (let z = -8; z <= 8; z += .5) {
          const sample = new THREE.Vector3(p[0] + x + .013, p[1], p[2] + z + .017);
          assert.equal(lethal(moved, sample.clone().applyMatrix4(transform)), lethal(source, sample), "pit membership did not follow the same turn");
        }
        const corePoint = new THREE.Vector3(4, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), initialYaw * Math.PI / 180).add(new THREE.Vector3(...p)).applyMatrix4(transform);
        assert.ok(lethal(moved, corePoint));
        assert.ok(new THREE.Box3().setFromObject(moved.thornClusters[0].group).containsPoint(corePoint), "lethal core extends beyond the visible warning after rotation");
        assert.ok(!moved.groundMeshes.some(mesh => mesh.parent === moved.thornClusters[0].group), "visual-only thorn gained ground collision");
      } finally { source.dispose(); moved.dispose(); }
      checked++;
    }
    const sparse = fixture([{ t: "thorn", p: [2, 3, -4] }, { t: "pit", p: [2, 3, -4], s: [1.6, 1, 1.6], invisible: true }]);
    const editor = editorFor(sparse);
    for (let i = 0; i < 4; i++) editor.rotateSelection(90);
    assert.equal(editor.data.components[0].seed, undefined);
    assert.equal(editor.data.components[0].s, undefined, "rotating sparse thorns materialized a wrong default size");
    const source = build(sparse), restored = build(editor.data);
    try { assert.deepEqual(visualPoints(restored), visualPoints(source)); }
    finally { source.dispose(); restored.dispose(); }
    editor.rotateSelection(90);
    const before = build(editor.data), anchor = new THREE.Vector3(1, 0, 2), scale = new THREE.Vector3(2, 1.5, 3);
    const points = visualPoints(before); before.dispose();
    editor.applyScaleNoCommit(...scale.toArray(), anchor);
    for (const c of editor.data.components.slice(0, 2)) setComponentPosition(c, [c.p[0] + 5, c.p[1] + 2, c.p[2] - 3]);
    const scaled = build(editor.data);
    try { visualPoints(scaled).forEach((point, i) => assert.ok(point.distanceTo(points[i].clone().sub(anchor).multiply(scale).add(anchor).add(new THREE.Vector3(5, 2, -3))) < 1e-6)); }
    finally { scaled.dispose(); }
    const c = { t: "thorn", p: [3, 4, -2], yaw: 90 }, saved = clone(c);
    const handles = editor.handleDefsFor(c); assert.equal(handles.length, 6); assert.deepEqual(c, saved);
    const orig = clone(c); editor.materializeDims(orig);
    const top = handles.find(h => h.dir.y === 1), bottom = handles.find(h => h.dir.y === -1);
    const stretched = clone(orig); top.apply(orig, stretched, 2);
    assert.equal(stretched.p[1], orig.p[1], "top handle moved the thorn base");
    assert.equal(stretched.s[1], orig.s[1] + 2);
    bottom.apply(orig, stretched, 2);
    assert.equal(stretched.p[1] + stretched.s[1], orig.p[1] + orig.s[1], "bottom handle moved the opposite face");
  }
  console.log(`PASS ${checked} thorn turns with actual visual/pit/phase parity, repeated turns, sparse defaults, group scale/move and anchored handles`);
} finally { await server.close(); }
