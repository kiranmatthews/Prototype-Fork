import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as THREE from "three";

// Exercise the actual Editor methods and field events. Rendering/registry
// persistence are stubbed so gesture transactions can be checked deterministically.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clone = value => JSON.parse(JSON.stringify(value));
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.listeners = new Map();
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.textContent = "";
    this.value = "";
  }
  set innerHTML(value) { this.children = []; this.html = value; }
  get innerHTML() { return this.html ?? ""; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) ?? [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  removeEventListener() {}
  setAttribute(name, value) { this[name] = value; }
  setPointerCapture() {}
  releasePointerCapture() {}
  blur() { this.dispatch("blur"); }
  dispatch(type, values = {}) {
    for (const callback of this.listeners.get(type) ?? [])
      callback({ target: this, button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {}, ...values });
  }
  querySelector(tag) {
    return this.children.find(child => child.tagName === tag.toUpperCase()) ??
      this.children.map(child => child.querySelector?.(tag)).find(Boolean) ?? null;
  }
}
const context = new Proxy({
  measureText: text => ({ width: String(text).length * 8 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
  getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
}, { get: (target, key) => target[key] ?? (() => {}) });
globalThis.document = {
  createElement(tag) {
    const element = new Element(tag);
    if (tag === "canvas") element.getContext = () => context;
    return element;
  },
  createElementNS(_ns, tag) { return this.createElement(tag); },
  fonts: null,
};
globalThis.window = { location: { search: "?lite" }, addEventListener() {}, removeEventListener() {} };
globalThis.Image = class {
  addEventListener() {}
  removeEventListener() {}
  set src(_value) {}
};

const server = await createServer({ root, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let failures = 0;
try {
  const { Editor, setComponentPosition } = await server.ssrLoadModule("/src/editor.ts");
  const { Level, migrateCustomLevel, normalizeCustomLevelData, DECOR_KINDS, saveUserLevel, findLevel, worldMapComponentPoints } = await server.ssrLoadModule("/src/level.ts");
  const base = components => ({ v: 1, name: "Editor regression", spawn: [0, 1, 0], killY: -30, components, groups: [] });
  const editorFor = data => {
    const editor = Object.create(Editor.prototype);
    Object.assign(editor, {
      data: clone(data), sel: [], selVtxs: new Set(), resizeIdx: -1,
      clipboard: [], clipboardGroups: [], pasteBump: 0, lastPasteKey: "",
      targetId: "__editor_ux", targetName: data.name, initialTargetId: "__editor_ux", initialJson: JSON.stringify(data),
      lastCommitted: JSON.stringify(data), undoStack: [], redoStack: [], commits: 0,
      panel: new Element(), propsEl: new Element(), scaleProp: false, snap: false,
      closedGroups: new Set(), medalTimeInputs: {}, importSerial: 0,
      numberGetters: new WeakMap(), environment: null, projPane: null,
      controls: { target: new THREE.Vector3() }, hooks: {
        showMsg() {}, rebuild() {}, resetPreview() {}, levelsChanged() {}, preflight: () => true,
      },
      renderLayers() {}, refreshSelectionBox() {}, refreshHandles() {},
      syncProjectFields() {}, refreshSpawnMarker() {},
      rollbackActiveGesture() {}, cancelDraw() {},
      setSelection(indices) { this.sel = indices; },
      commit() {
        const now = JSON.stringify(this.data);
        if (now !== this.lastCommitted) {
          this.undoStack.push(this.lastCommitted);
          this.lastCommitted = now;
          this.commits++;
        }
        return true;
      },
      selectionBounds() {
        const bounds = new THREE.Box3();
        for (const index of this.sel) {
          const component = this.data.components[index];
          const position = new THREE.Vector3(...component.p);
          const half = new THREE.Vector3(...(component.s ?? [1, 1, 1])).multiplyScalar(0.5);
          bounds.expandByPoint(position.clone().sub(half));
          bounds.expandByPoint(position.clone().add(half));
        }
        return bounds;
      },
    });
    return editor;
  };
  const check = (name, callback) => {
    try { callback(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
  };
  const inputFor = (editor, label) => {
    const row = editor.propsEl.children.find(child => child.children?.[0]?.textContent === label);
    assert.ok(row, `missing field: ${label}`);
    return row.querySelector("input");
  };
  check("a rejected batch preserves existing singleton furniture and groups", () => {
    const editor = editorFor(base([
      { t: "gate", p: [1, 0, 0] },
      ...Array.from({ length: 9999 }, () => ({ t: "crate", p: [0, 0, 0] })),
    ]));
    const before = JSON.stringify(editor.data);
    editor.addBatch([{ t: "gate", p: [5, 0, 0] }, { t: "crate", p: [0, 0, 0] }]);
    assert.equal(JSON.stringify(editor.data), before);
    assert.equal(editor.commits, 0);
  });
  check("cross-level clipboard preserves nested switch groups without reusing destination groups", () => {
    const data = base([{ t: "crate", kind: "bang", p: [0, 0, 0], grp: 1 }, { t: "crate", outline: true, p: [2, 0, 0], grp: 1 }]);
    data.groups = [{ id: 1, parent: 2, nm: "Switch pair" }, { id: 2, nm: "Original assembly" }];
    const editor = editorFor(data);
    editor.sel = [0, 1];
    editor.copySelected();
    editor.data = base([{ t: "crate", p: [10, 0, 0], grp: 1 }]);
    editor.data.groups = [{ id: 1, nm: "Unrelated destination group" }];
    editor.paste();
    const pasted = editor.sel.map(index => editor.data.components[index]);
    assert.equal(pasted[0].grp, pasted[1].grp);
    assert.notEqual(pasted[0].grp, 1);
    const child = editor.data.groups.find(group => group.id === pasted[0].grp);
    assert.equal(child.nm, "Switch pair");
    assert.equal(editor.data.groups.find(group => group.id === child.parent).nm, "Original assembly");
  });
  check("group-size scrubbing has one final transaction and cancellation restores source", () => {
    const data = base([{ t: "platform", p: [0, 0, 0], s: [4, 1, 4] }, { t: "platform", p: [8, 0, 0], s: [4, 1, 4] }]);
    const editor = editorFor(migrateCustomLevel(data));
    editor.sel = [0, 1];
    editor.renderProps();
    let input = inputFor(editor, "group width");
    const before = JSON.stringify(editor.data);
    input.dispatch("pointerdown", { clientY: 100 });
    input.dispatch("pointermove", { clientY: 68 });
    assert.notEqual(JSON.stringify(editor.data), before, "scrub did not preview scale");
    assert.equal(editor.commits, 0, "live scrub must not commit");
    input.dispatch("pointercancel");
    assert.equal(JSON.stringify(editor.data), before, "cancel must restore exact sparse data");
    assert.equal(editor.commits, 0);
    input = inputFor(editor, "group width");
    input.dispatch("pointerdown", { clientY: 100 });
    input.dispatch("pointermove", { clientY: 68 });
    input.dispatch("pointerup");
    assert.equal(editor.commits, 1, "landed scrub must commit once");
    assert.equal(editor.undoStack.length, 1);
  });
  check("a yawed vert spine exposes every knot in world coordinates plus its radius handle", () => {
    const component = { t: "vertramp", p: [10, 3, 20], yaw: 90, pts: [[0, 0, 0, 0, 0], [2, -4, 1, 3, 15]], rise: 6 };
    const editor = editorFor(base([component]));
    const handles = editor.handleDefsFor(editor.data.components[0]);
    const nodes = handles.filter(handle => handle.vtx !== undefined);
    assert.equal(nodes.length, 2);
    assert.ok(handles.some(handle => handle.apply), "vert radius handle was lost");
    assert.ok(nodes[1].pos.distanceTo(new THREE.Vector3(6, 6.1, 18)) < 1e-8);
    editor.sel = [0]; editor.resizeIdx = 0; editor.selVtxs = new Set([1]);
    editor.renderProps();
    assert.ok(Math.abs(Number(inputFor(editor, "node 2 · x").value) - 6) < 1e-8);
    assert.equal(Number(inputFor(editor, "node 2 · y").value), 6);
    const x = inputFor(editor, "node 2 · x");
    x.value = "9"; x.dispatch("change");
    const world = editor.nodeWorldPosition(editor.data.components[0], editor.data.components[0].pts[1]);
    assert.ok(world.distanceTo(new THREE.Vector3(9, 6, 18)) < 1e-8, "editing world X changed another world axis");
  });
  check("translation keeps return points, support feet and shore waterlines attached", () => {
    for (const t of ["returnportal", "bonusplatform"]) {
      const c = { t, p: [1, 2, 3], to: [9, 8, 7] };
      setComponentPosition(c, [11, 22, 33]);
      assert.deepEqual(c.to, [19, 28, 37]);
      setComponentPosition(c, [1, 2, 3]);
      assert.deepEqual(c.to, [9, 8, 7]);
    }
    for (const [t, field] of [["woodpath", "supportBaseY"], ["platform", "shoreSeaLevel"]]) {
      const c = { t, p: [1, 2, 3], [field]: -4 };
      setComponentPosition(c, [11, 22, 33]);
      assert.equal(c[field], 16);
      setComponentPosition(c, [1, 2, 3]);
      assert.equal(c[field], -4);
    }
    const editor = editorFor(base([{ t: "returnportal", p: [1, 2, 3], to: [9, 8, 7] }]));
    editor.sel = [0]; editor.duplicateSelected();
    assert.deepEqual(editor.data.components[editor.sel[0]].to, [12, 8, 10]);
  });
  check("retarget abandons a previous built-in fork lineage before undo", () => {
    const original = migrateCustomLevel(base([{ t: "platform", p: [0, 0, 0], s: [4, 1, 4] }]));
    const oldFork = saveUserLevel({ id: "", name: "Previous fork", data: original });
    const imported = saveUserLevel({ id: "", name: "Imported draft", data: clone(original) });
    const editor = editorFor(original);
    editor.initialTargetId = "jungle";
    editor.forkedLevelId = oldFork;
    editor.pristineBuiltin = true;
    editor.retarget(imported);
    assert.equal(editor.initialTargetId, imported);
    assert.equal(editor.forkedLevelId, null);
    assert.equal(editor.forkOnFirstCommit, false);
    editor.data.components[0].p[0] = 7;
    Editor.prototype.commit.call(editor);
    editor.undo();
    assert.equal(editor.targetId, imported);
    assert.equal(editor.data.components[0].p[0], 0);
    assert.ok(findLevel(oldFork), "undo on the imported level deleted an unrelated prior fork");
  });
  check("HUD migration keeps working indices, preview geometry and persisted data aligned", () => {
    const data = migrateCustomLevel(base([
      { t: "platform", p: [0, 0, 0], s: [12, 1, 12] },
      { t: "clock", p: [2, 1, -3] },
      { t: "crate", p: [0, 1, -2] },
      { t: "comboorb", p: [-2, 1, -3] },
      { t: "gate", p: [0, 1, -8] },
    ]));
    const id = saveUserLevel({ id: "", name: data.name, data });
    const editor = editorFor(data); editor.targetId = id; editor.initialTargetId = id;
    editor.commit = Editor.prototype.commit.bind(editor);
    editor.hooks.preflight = () => !!normalizeCustomLevelData(editor.data);
    editor.sel = [2]; editor.resizeIdx = 2;
    const crate = editor.data.components[2];
    editor.data.hudMode = "bonus"; editor.commit();
    assert.deepEqual(editor.data.components.map(c => c.t), ["platform", "crate", "gate"]);
    assert.equal(editor.data.components[editor.selectedIndex], crate);
    assert.equal(editor.selectedIndex, 1); assert.equal(editor.resizeIdx, 1);
    assert.deepEqual(findLevel(id).data, editor.data);
    const level = new Level(new THREE.Scene(), { id, name: data.name, data: editor.data });
    try { assert.deepEqual(level.captureData().components, editor.data.components); }
    finally { level.dispose(); }
    editor.addBatch([{ t: "worldmap", p: [20, 0, 0] }]);
    assert.equal(editor.data.hudMode, "hub");
    assert.equal(editor.data.components[editor.selectedIndex].t, "worldmap", "new map lost selection when migration removed activators");
  });
  check("removing a captured campaign map restores normal gate and run activators", () => {
    const data = migrateCustomLevel({ ...base([{ t: "worldmap", p: [0, 0, 0] }]), hudMode: "hub" });
    const id = saveUserLevel({ id: "", name: data.name, data });
    const editor = editorFor(data); editor.targetId = id; editor.initialTargetId = id;
    editor.commit = Editor.prototype.commit.bind(editor);
    editor.hooks.preflight = () => !!normalizeCustomLevelData(editor.data);
    editor.sel = [0]; editor.deleteSelected();
    assert.equal(editor.data.hudMode, undefined);
    assert.deepEqual(editor.data.components.map(c => c.t), ["gate", "clock", "comboorb"]);
    assert.deepEqual(findLevel(id).data, editor.data);
  });
  check("node deletion retains shape minimums and aligned wood-path widths", () => {
    const editor = editorFor(base([{ t: "woodpath", p: [0, 0, 0], pts: [[0, 0], [0, -4], [0, -8]], widths: [4, 6, 8] }]));
    editor.sel = [0]; editor.resizeIdx = 0; editor.selVtxs = new Set([1]);
    assert.equal(editor.deleteSelectedNodes(), true);
    assert.deepEqual(editor.data.components[0].widths, [4, 8]);
    editor.selVtxs = new Set([0]);
    assert.equal(editor.deleteSelectedNodes(), true);
    assert.equal(editor.data.components[0].pts.length, 2);
    assert.equal(editor.data.components.length, 1);
  });
  check("sparse campaign maps expose fixed named hubs without mutating on inspection", () => {
    const editor = editorFor(base([{ t: "worldmap", p: [4, 2, 6], yaw: 90 }]));
    editor.sel = [0]; editor.resizeIdx = 0; editor.selVtxs = new Set([0]);
    const before = JSON.stringify(editor.data);
    const handles = editor.handleDefsFor(editor.data.components[0]);
    assert.equal(handles.length, worldMapComponentPoints().length);
    editor.renderProps();
    assert.equal(JSON.stringify(editor.data), before);
    assert.equal(editor.propsEl.children.some(child => child.textContent === "+ insert node"), false);
    assert.equal(editor.deleteSelectedNodes(), true);
    assert.equal(JSON.stringify(editor.data), before);
  });
  check("default terrain and wood routes offer editable knots without changing sparse source", () => {
    for (const [t, endZ] of [["terrain", -40], ["woodpath", -24]]) {
      const editor = editorFor(base([{ t, p: [0, 1, 0] }]));
      editor.sel = [0]; editor.resizeIdx = 0; editor.selVtxs = new Set([1]);
      const before = JSON.stringify(editor.data);
      assert.equal(editor.handleDefsFor(editor.data.components[0]).filter(handle => handle.vtx !== undefined).length, 2);
      editor.renderProps();
      assert.equal(Number(inputFor(editor, "node 2 · z").value), endZ);
      assert.equal(JSON.stringify(editor.data), before);
      const input = inputFor(editor, "node 2 · y");
      input.value = "5"; input.dispatch("change");
      assert.equal(editor.data.components[0].pts[1][3], 4);
      assert.equal(editor.data.components[0].pts[1][1], endZ);
    }
  });
  check("numeric fields ignore non-finite input and restore fresh controls after a rejected edit", () => {
    const editor = editorFor(migrateCustomLevel(base([{ t: "platform", p: [0, 0, 0], s: [4, 1, 4] }])));
    editor.sel = [0]; editor.renderProps();
    const before = JSON.stringify(editor.data);
    for (const value of ["NaN", "Infinity", "-Infinity", ""]) {
      const input = inputFor(editor, "width");
      input.value = value; input.dispatch("change");
      assert.equal(JSON.stringify(editor.data), before);
      assert.equal(input.value, "4");
    }
    editor.commit = Editor.prototype.commit.bind(editor);
    editor.hooks.preflight = () => false;
    const input = inputFor(editor, "width");
    input.value = "1000000000"; input.dispatch("change");
    assert.equal(JSON.stringify(editor.data), before);
    assert.equal(inputFor(editor, "width").value, "4");
    assert.equal(editor.undoStack.length, 0);
  });
  check("numeric blur and Enter commit edits while Escape and scrub blur preserve transactions", () => {
    const editor = editorFor(migrateCustomLevel(base([{ t: "platform", p: [0, 0, 0] }])));
    editor.sel = [0]; editor.renderProps();
    const before = JSON.stringify(editor.data);
    let input = inputFor(editor, "width");
    input.blur();
    assert.equal(JSON.stringify(editor.data), before, "focus/blur materialized a sparse default");
    input.value = "10"; input.blur();
    assert.equal(editor.data.components[0].s[0], 10);
    assert.equal(editor.commits, 1);
    input.value = "12"; input.dispatch("keydown", { key: "Enter" });
    assert.equal(editor.data.components[0].s[0], 12);
    assert.equal(editor.commits, 2);
    input.value = "99"; input.dispatch("keydown", { key: "Escape" });
    assert.equal(editor.data.components[0].s[0], 12);
    assert.equal(input.value, "12");
    assert.equal(editor.commits, 2);
    input.dispatch("pointerdown", { clientY: 100 });
    input.dispatch("pointermove", { clientY: 68 });
    input.blur();
    assert.equal(editor.commits, 2, "scrub blur committed its preview");
    input.dispatch("pointerup");
    assert.equal(editor.commits, 3);
  });
  check("quarter-turn terrain edits preserve ground support and berm grind/collision paths", () => {
    const component = { t: "terrain", nm: "rotating terrain", p: [5, 2, 10], pts: [[0, 0, 0, 0], [2, -10, 0, 1], [0, -24, 0, 2]], w: 8, amp: 0, berms: true };
    const editor = editorFor(base([component]));
    editor.sel = [0];
    const originalPoints = clone(component.pts);
    let initialHeight;
    let initialRail;
    let initialPath;
    for (let turn = 0; turn <= 4; turn++) {
      if (turn > 0) editor.rotateSelection(90);
      assert.deepEqual(editor.data.components[0].pts, originalPoints, "rotation corrupted the local station order");
      const data = migrateCustomLevel(clone(editor.data));
      const level = new Level(new THREE.Scene(), { id: `__terrain_turn_${turn}`, name: data.name, data });
      try {
        level.root.updateMatrixWorld(true);
        const yaw = turn * Math.PI / 2;
        const rotate = point => point.clone().sub(new THREE.Vector3(...component.p))
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(...component.p));
        const sample = rotate(new THREE.Vector3(6, 100, 5));
        const ray = new THREE.Raycaster(sample, new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObjects(level.groundMeshes.filter(mesh => mesh.userData.terrainComp), false);
        assert.ok(hits.length, `terrain lost ground support after ${turn} quarter turns`);
        initialHeight ??= hits[0].point.y;
        assert.ok(Math.abs(hits[0].point.y - initialHeight) < 1e-6);
        const rail = level.rails[0];
        assert.ok(rail, "terrain berm rail missing");
        initialRail ??= rail.pointAt(rail.totalLength * 0.4).clone();
        assert.ok(rail.pointAt(rail.totalLength * 0.4).distanceTo(rotate(initialRail)) < 1e-6);
        const wall = level.walls.find(box => level.wallPathForBox(box));
        assert.ok(wall, "precise berm collision missing");
        const point = level.wallPathForBox(wall).spine[0];
        initialPath ??= new THREE.Vector3(point.x, point.y, point.z);
        assert.ok(new THREE.Vector3(point.x, point.y, point.z).distanceTo(rotate(initialPath)) < 1e-6);
      } finally { level.dispose(); }
    }
    assert.equal(editor.data.components[0].yaw, 0);
  });
  check("mesh inspection, world-axis scaling and vertex edits retain the authored surface", () => {
    const c = { t: "mesh", p: [5, 2, 7], yaw: 37, s: [2, 1, 3],
      vertices: [-2, 0, 2, 2, 0, 2, -2, 1, -2, 2, 2, -2],
      indices: [0, 1, 2, 2, 1, 3], normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      uvs: [0, 0, 1, 0, 0, 1, 1, 1], colors: [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1],
      slip: true, beachSand: true, doubleSided: true };
    const editor = editorFor(base([c])); editor.sel = [0];
    const before = JSON.stringify(editor.data); editor.renderProps();
    assert.equal(JSON.stringify(editor.data), before);
    assert.equal(inputFor(editor, "scale x").value, "2");
    const points = Array.from({ length: 4 }, (_, index) => editor.meshVertexWorldPosition(editor.data.components[0], index));
    const anchor = new THREE.Vector3(1, -2, 4);
    const factors = new THREE.Vector3(2, 0.5, 3);
    editor.applyScaleNoCommit(factors.x, factors.y, factors.z, anchor);
    const scaled = editor.data.components[0];
    for (let index = 0; index < points.length; index++) {
      const expected = points[index].clone().sub(anchor).multiply(factors).add(anchor);
      assert.ok(editor.meshVertexWorldPosition(scaled, index).distanceTo(expected) < 1e-8,
        "freely rotated nonuniform scaling approximated/sheared away the original mesh");
    }
    assert.deepEqual(scaled.indices, c.indices); assert.deepEqual(scaled.uvs, c.uvs);
    assert.deepEqual(scaled.colors, c.colors); assert.equal(scaled.slip, true);
    editor.rotateSelection(90); editor.renderProps();
    const selected = editor.meshVertexWorldPosition(scaled, 0);
    const input = inputFor(editor, "vertex world x");
    input.value = String(selected.x + 4); input.blur();
    const edited = editor.meshVertexWorldPosition(scaled, 0);
    assert.ok(edited.distanceTo(selected.clone().add(new THREE.Vector3(4, 0, 0))) < 1e-8);
    assert.equal(scaled.normals, undefined, "edited triangles retained stale supplied normals");
  });
  check("narrow editor docks are exclusive, reversible and do not edit the level", () => {
    const editor = editorFor(base([{ t: "platform", p: [0, 0, 0] }]));
    editor.active = true; editor.inspectorVisible = true; editor.activePop = "";
    editor.popAdd = new Element(); editor.popLayers = new Element();
    editor.selPane = new Element(); editor.projPane = new Element();
    editor.tabAdd = new Element(); editor.tabLayers = new Element(); editor.tabInspector = new Element();
    const before = JSON.stringify(editor.data);
    window.innerWidth = 390;
    editor.setPop("add");
    assert.equal(editor.panel.style.display, "none");
    assert.equal(editor.popAdd.style.display, "block");
    editor.setPanelTab("sel");
    assert.equal(editor.panel.style.display, "flex");
    assert.equal(editor.popAdd.style.display, "none");
    editor.toggleInspector(); assert.equal(editor.panel.style.display, "none");
    editor.toggleInspector(); assert.equal(editor.panel.style.display, "flex");
    editor.setPop("layers"); assert.equal(editor.panel.style.display, "none");
    window.innerWidth = 1280; editor.syncDockLayout();
    assert.equal(editor.panel.style.display, "flex"); assert.equal(editor.popLayers.style.display, "block");
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.commits, 0);
    delete window.innerWidth;
  });
  check("reentrant pointer capture loss cannot cancel a completed numeric scrub", () => {
    const editor = editorFor(base([{ t: "platform", p: [0, 0, 0] }]));
    editor.sel = [0]; editor.renderProps();
    const input = inputFor(editor, "x");
    let releases = 0;
    input.releasePointerCapture = () => { releases++; input.dispatch("lostpointercapture"); };
    input.dispatch("pointerdown", { clientY: 100 });
    input.dispatch("pointermove", { clientY: 80 });
    input.dispatch("pointerup");
    assert.equal(releases, 1); assert.equal(editor.data.components[0].p[0], 5);
    assert.equal(editor.commits, 1); assert.equal(editor.undoStack.length, 1);
  });
  check("every scenery inspector and sparse wood-path inspector renders without modifying data", () => {
    for (const c of [...DECOR_KINDS.map(dkind => ({ t: "decor", dkind, p: [0, 0, 0] })), { t: "woodpath", p: [0, 0, 0] }]) {
      const editor = editorFor(base([c]));
      editor.sel = [0];
      const before = JSON.stringify(editor.data);
      editor.renderProps();
      assert.equal(JSON.stringify(editor.data), before, `${c.dkind ?? c.t} inspector materialized data`);
    }
  });
  check("surface glow and shoreline style edits persist, undo and rebuild the chosen material", () => {
    for (const component of [
      { t: "platform", p: [0, 0, 0], tex: "stone", emissive: "#10131c" },
      { t: "mesh", p: [0, 0, 0], vertices: [-4, 0, 2, 4, 0, 2, 0, 0, -4] },
    ]) {
      const data = migrateCustomLevel(base([component]));
      const id = saveUserLevel({ id: "", name: data.name, data });
      const editor = editorFor(data); editor.targetId = id; editor.initialTargetId = id;
      editor.commit = Editor.prototype.commit.bind(editor);
      editor.hooks.preflight = () => !!normalizeCustomLevelData(editor.data);
      editor.sel = [0]; editor.renderProps();
      const before = JSON.stringify(editor.data);
      const glow = inputFor(editor, "surface glow"); glow.value = "#223344"; glow.dispatch("change");
      assert.equal(findLevel(id).data.components[0].emissive, "#223344");
      editor.undo(); assert.equal(JSON.stringify(editor.data), before);
      editor.redo(); assert.equal(editor.data.components[0].emissive, "#223344");
      if (component.t === "mesh") {
        editor.sel = [0]; editor.renderProps();
        const style = () => editor.propsEl.children.find(row => row.children?.[0]?.textContent === "material style").querySelector("select");
        style().value = "unity-sand"; style().dispatch("change");
        assert.equal(editor.data.components[0].materialStyle, "unity-sand", "style selection did not commit");
        assert.equal(editor.data.components[0].tex, "sand");
        assert.equal(findLevel(id).data.components[0].materialStyle, "unity-sand", "style selection was not saved");
        const level = new Level(new THREE.Scene(), { id, name: data.name, data: editor.data });
        assert.equal(level.groundMeshes[0].material.type, "MeshStandardMaterial");
        assert.equal(level.groundMeshes[0].material.emissive.getHex(), 0x223344); level.dispose();
        editor.undo(); assert.equal(editor.data.components[0].materialStyle, undefined);
        editor.redo(); assert.equal(editor.data.components[0].materialStyle, "unity-sand", "redo lost material style");
        editor.sel = [0]; editor.renderProps();
        style().value = ""; style().dispatch("change");
        assert.equal(editor.data.components[0].materialStyle, undefined);
        assert.ok(normalizeCustomLevelData(editor.data));
      }
    }
    const unsupported = editorFor(base([{ t: "crate", p: [0, 0, 0] }]));
    unsupported.sel = [0]; unsupported.renderProps();
    assert.ok(!unsupported.propsEl.children.some(row => row.children?.[0]?.textContent === "surface glow"));
  });
  check("rock texture selector preserves the asset default and commits explicit checker with undo", () => {
    const data = migrateCustomLevel(base([{ t: "platform", dkind: "nightplateau", p: [0, 0, 0], s: [8, 4, 8] }]));
    const id = saveUserLevel({ id: "", name: data.name, data });
    const editor = editorFor(data); editor.targetId = id; editor.initialTargetId = id;
    editor.commit = Editor.prototype.commit.bind(editor);
    editor.hooks.preflight = () => !!normalizeCustomLevelData(editor.data);
    const select = () => editor.propsEl.children.find(row => row.children?.[0]?.textContent === "texture").querySelector("select");
    editor.sel = [0]; editor.renderProps();
    assert.equal(select().value, "");
    assert.ok(select().children.some(option => option.value === "" && option.textContent === "asset material"));
    assert.equal(editor.data.components[0].tex, undefined);
    select().value = "checker"; select().dispatch("change");
    assert.equal(editor.data.components[0].tex, "checker");
    assert.equal(findLevel(id).data.components[0].tex, "checker");
    const level = new Level(new THREE.Scene(), { id, name: data.name, data: editor.data });
    const rock = level.groundMeshes.find(mesh => mesh.userData.nightworksRock);
    assert.ok(rock.material.map && rock.geometry.attributes.uv); level.dispose();
    editor.undo(); assert.equal(editor.data.components[0].tex, undefined);
    editor.redo(); assert.equal(editor.data.components[0].tex, "checker");
    editor.sel = [0]; editor.renderProps(); select().value = ""; select().dispatch("change");
    assert.equal(editor.data.components[0].tex, undefined); assert.equal(findLevel(id).data.components[0].tex, undefined);
    const ordinary = editorFor(base([{ t: "platform", p: [0, 0, 0] }]));
    ordinary.sel = [0]; ordinary.renderProps();
    const regular = ordinary.propsEl.children.find(row => row.children?.[0]?.textContent === "texture").querySelector("select");
    assert.equal(regular.value, "checker"); assert.ok(!regular.children.some(option => option.value === ""));
  });
} finally {
  await server.close();
}
if (failures) process.exitCode = 1;
