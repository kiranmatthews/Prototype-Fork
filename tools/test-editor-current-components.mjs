import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import * as THREE from "three";

// Exercise actual inspector callbacks and transforms against the current
// interchange validator and runtime shapes, without browser rendering.
const domHarness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(domHarness.slice(domHarness.indexOf("function installHeadlessDom()"),
  domHarness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
    this.listeners = new Map(); this.textContent = ""; this.value = "";
    this.classList = { toggle() {}, add() {}, remove() {} };
  }
  set innerHTML(_value) { this.children = []; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]); }
  dispatch(type) { for (const callback of this.listeners.get(type) ?? []) callback({ target: this, preventDefault() {}, stopPropagation() {} }); }
  blur() { this.dispatch("blur"); }
  querySelector(tag) { return this.children.find(c => c.tagName === tag.toUpperCase()) ?? this.children.map(c => c.querySelector?.(tag)).find(Boolean); }
}
const makeElement = document.createElement.bind(document);
document.createElement = tag => tag === "canvas" ? makeElement(tag) : new Element(tag);
const clone = value => JSON.parse(JSON.stringify(value));
const elements = root => [root, ...root.children.flatMap(elements)];
const fixture = components => ({ v: 1, name: "Current editor components", spawn: [0, 2, 0], killY: -40,
  components: [...components, { t: "platform", p: [0, -1, 0], s: [4, 1, 4] }, { t: "gate", p: [0, 0, -2] }] });
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true, hmr: false, ws: false } });
let failures = 0;
try {
  const { Editor, setComponentPosition } = await server.ssrLoadModule("/src/editor.ts");
  const { normalizeCustomLevelData } = await server.ssrLoadModule("/src/level.ts");
  const { SpinBridge } = await server.ssrLoadModule("/src/spinBridge.ts");
  const { createLoopMeshData, sampleLoop } = await server.ssrLoadModule("/src/loopRide.ts");
  const { jungleAssetMatrix } = await server.ssrLoadModule("/src/jungleAssets.ts");
  const { cityMatrix } = await server.ssrLoadModule("/src/cityAssets.ts");
  const editorFor = component => {
    const editor = Object.create(Editor.prototype), data = fixture([component]);
    Object.assign(editor, { data: clone(data), sel: [0], selVtxs: new Set(), resizeIdx: -1,
      panel: new Element(), propsEl: new Element(), numberGetters: new WeakMap(), commits: 0,
      targetId: "__current_editor", targetName: data.name, initialJson: JSON.stringify(data),
      hooks: { rebuild() {}, resetPreview() {} }, showMessage(title) { this.message = title; },
      commit() { assert.ok(normalizeCustomLevelData(this.data), "inspector produced invalid level data"); this.commits++; return true; },
    });
    return editor;
  };
  const inputFor = (editor, label) => {
    const row = elements(editor.propsEl).find(e => e.children[0]?.textContent === label);
    assert.ok(row, `missing ${label}`); return row.querySelector("input");
  };
  const changeNumber = (editor, label, value) => { const input = inputFor(editor, label); input.value = String(value); input.dispatch("change"); };
  const changeBoolean = (editor, label, value) => { const input = inputFor(editor, label); input.checked = value; input.dispatch("change"); };
  const check = (name, callback) => {
    try { callback(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
  };
  check("spin bridge inspection, rotation and sparse group scaling match its runtime hinge", () => {
    const original = { t: "spinbridge", p: [2, 3, -4] }, editor = editorFor(original);
    const before = JSON.stringify(editor.data); editor.renderProps();
    assert.equal(JSON.stringify(editor.data), before);
    assert.equal(inputFor(editor, "deck thickness").value, "0.36");
    assert.ok(elements(editor.propsEl).some(e => e.textContent === "rotate 90°"));
    editor.rotateSelection(90); assert.equal(editor.data.components[0].yaw, 90);
    editor.rotateSelection(-90); assert.equal(editor.data.components[0].yaw, 0);
    const source = new SpinBridge(new THREE.Group(), original, new THREE.MeshBasicMaterial()); source.restore(true);
    editor.applyScaleNoCommit(2, 3, 4, new THREE.Vector3());
    const c = editor.data.components[0]; assert.deepEqual(c.s, [10, 1.08, 4.8]);
    const edited = new SpinBridge(new THREE.Group(), c, new THREE.MeshBasicMaterial()); edited.restore(true);
    const a = source.mesh.geometry.attributes.position, b = edited.mesh.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const expected = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(source.mesh.matrixWorld).multiply(new THREE.Vector3(2, 3, 4));
      const actual = new THREE.Vector3().fromBufferAttribute(b, i).applyMatrix4(edited.mesh.matrixWorld);
      assert.ok(actual.distanceTo(expected) < 1e-6, "bridge mesh and hinge diverged during resize");
    }
    editor.renderProps(); changeNumber(editor, "opening time (s)", 99); assert.equal(c.cycle, 2);
    changeNumber(editor, "span", 7); assert.equal(c.s[0], 7);
  });
  check("closed wallpath end removal preserves three playable knots", () => {
    const editor = editorFor({ t: "wallpath", p: [0, 0, 0], closed: true, pts: [[0, 0], [8, 0], [4, -8]] });
    const remove = () => { editor.renderProps(); elements(editor.propsEl).find(e => e.textContent === "− remove end knot").dispatch("click"); };
    remove(); assert.equal(editor.data.components[0].pts.length, 3);
    editor.data.components[0].pts.push([-4, -4]); remove(); assert.equal(editor.data.components[0].pts.length, 3);
  });
  check("turning off authored ice clears dependent grip and remains exportable", () => {
    for (const c of [{ t: "platform", p: [0, 0, 0] }, { t: "mesh", p: [0, 0, 0], vertices: [0, 0, 0, 3, 0, 0, 0, 0, -3] }]) {
      const editor = editorFor({ ...c, slip: true, iceGrip: 0.12 }); editor.renderProps();
      assert.equal(inputFor(editor, "ice grip").value, "0.12");
      changeBoolean(editor, "slippery surface", false);
      assert.equal(editor.data.components[0].iceGrip, undefined); assert.equal(editor.data.components[0].slip, undefined);
      assert.ok(normalizeCustomLevelData(editor.data));
    }
  });
  check("mesh ride flags can be edited and converted to scenery without rejected transactions", () => {
    const mesh = { t: "mesh", p: [0, 0, 0], vertices: [0, 0, 0, 3, 0, 0, 0, 0, -3], gravityTrack: true, skateCamera: true, lethal: true };
    const editor = editorFor(mesh); editor.renderProps();
    changeBoolean(editor, "return to safe ground", true);
    assert.equal(editor.data.components[0].lethal, undefined);
    changeBoolean(editor, "walkable collision", false);
    for (const key of ["gravityTrack", "skateCamera", "lethal", "outOfBounds"]) assert.equal(editor.data.components[0][key], undefined);
    const styled = editorFor(mesh); styled.renderProps();
    const row = elements(styled.propsEl).find(e => e.children[0]?.textContent === "material style");
    const select = row.querySelector("select"); select.value = "water"; select.dispatch("change");
    assert.equal(styled.data.components[0].solid, false); assert.ok(normalizeCustomLevelData(styled.data));
  });
  check("analytic loops resize mesh and ride profile together and reject circular-profile distortion", () => {
    const loop = { t: "mesh", p: [2, 1, -3], loopRadius: 10, loopOffset: 4, w: 8, loopRequired: true, ...createLoopMeshData(10, 8, 4) };
    const editor = editorFor(loop); editor.renderProps();
    assert.ok(!elements(editor.propsEl).some(e => e.children[0]?.textContent === "scale y"));
    const before = JSON.stringify(editor.data); editor.applyScaleNoCommit(1, 2, 1, new THREE.Vector3());
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.message, "KEEP THE LOOP CIRCULAR");
    editor.applyScaleNoCommit(2, 2, 2, new THREE.Vector3());
    const c = editor.data.components[0]; assert.equal(c.loopRadius, 20); assert.equal(c.w, 16); assert.equal(c.loopOffset, 8);
    assert.deepEqual(c.s, [1, 1, 1]); assert.ok(normalizeCustomLevelData(editor.data));
    const expected = sampleLoop({ radius: 20, width: 16, offset: 8 }, Math.PI, -8).point;
    assert.deepEqual(c.vertices.slice(160 * 3, 160 * 3 + 3), expected);
    editor.renderProps(); changeNumber(editor, "loop radius", 24); assert.equal(c.loopRadius, 24);
    assert.deepEqual(c.vertices, createLoopMeshData(24, 16, 8).vertices);
    changeBoolean(editor, "starts as !-switch outline", true);
    assert.equal(c.loopRadius, undefined); assert.equal(c.loopOffset, undefined); assert.equal(c.loopRequired, undefined);
  });
  check("imported city and jungle fitted assets scale once rather than squaring their scale", () => {
    for (const [dkind, matrix] of [["templeplatform", jungleAssetMatrix], ["citydeck", cityMatrix]]) {
      const original = { t: "decor", p: [0, 0, 0], dkind, s: [4, 2, 6], w: 2 }, editor = editorFor(original);
      const before = new THREE.Vector3(0.5, 1, 0.5).applyMatrix4(matrix(original));
      editor.applyScaleNoCommit(2, 2, 2, new THREE.Vector3());
      const c = editor.data.components[0]; assert.equal(c.w, 2);
      const after = new THREE.Vector3(0.5, 1, 0.5).applyMatrix4(matrix(c));
      assert.ok(after.distanceTo(before.multiplyScalar(2)) < 1e-6);
    }
  });
  check("footprint resizing preserves thin authored scenery and inspector accepts its thickness", () => {
    const editor = editorFor({ t: "decor", dkind: "templeplatform", p: [0, 0, 0], s: [2.4, 0.0961, 2.15] });
    editor.applyScaleNoCommit(2, 1, 2, new THREE.Vector3());
    assert.equal(editor.data.components[0].s[1], 0.0961);
    editor.renderProps(); changeNumber(editor, "height", 0.05);
    assert.equal(editor.data.components[0].s[1], 0.05);
  });
  check("castle light aim travels with movement, implicit rotation and group scaling", () => {
    const original = { t: "decor", dkind: "ghostshowlight", p: [4, 6, 8], to: [1, 2, 3], w: 0.6 };
    const moved = clone(original); setComponentPosition(moved, [7, 8, 4]); assert.deepEqual(moved.to, [4, 4, -1]);
    const editor = editorFor(original); editor.applyScaleNoCommit(2, 3, 4, new THREE.Vector3());
    assert.deepEqual(editor.data.components[0].to, [2, 6, 12]); assert.equal(editor.data.components[0].w, 0.6);
    const implicit = editorFor({ t: "decor", dkind: "ghostshowlight", p: [4, 6, 8] });
    implicit.rotateSelection(90); assert.deepEqual(implicit.data.components[0].to, [0, 1, 8]);
    implicit.renderProps(); changeNumber(implicit, "light target y", 2); assert.equal(implicit.data.components[0].to[1], 2);
  });
  if (normalizeCustomLevelData(fixture([{ t: "mesh", p: [0, 0, 0], vertices: [0, 0, 0, 3, 0, 0, 0, 0, -3], solid: false, materialStyle: "jungle-stream" }])))
  check("jungle stream inspector shows its actual omitted material defaults without mutating data", () => {
    const editor = editorFor({ t: "mesh", p: [0, 0, 0], vertices: [0, 0, 0, 3, 0, 0, 0, 0, -3], solid: false, materialStyle: "jungle-stream" });
    const before = JSON.stringify(editor.data); editor.renderProps();
    assert.equal(inputFor(editor, "opacity").value, "0.48");
    assert.equal(inputFor(editor, "double-sided surface").checked, true); assert.equal(inputFor(editor, "material fog").checked, true);
    assert.equal(JSON.stringify(editor.data), before);
  });
} finally { await server.close(); }
if (failures) process.exitCode = 1;
