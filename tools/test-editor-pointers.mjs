import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as THREE from "three";

// Dispatch pointer lifecycles through a constructed Editor and the installed
// OrbitControls, including realistic separate touch/pen IDs. Rendering and
// canvas hit coordinates are deterministic fixtures; these are synthetic
// event regressions, not claims of physical touch-device/browser coverage.
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
    this.tagName = tag.toUpperCase(); this.children = []; this.style = {};
    this.dataset = {}; this.listeners = new Map(); this.captures = new Set();
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.clientWidth = 800; this.clientHeight = 600; this.value = "";
  }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatch(type, values = {}) {
    let stopped = false;
    const event = {
      type, target: this, button: 0, buttons: /up|cancel/.test(type) ? 0 : 1,
      ...(/pointer/i.test(type) ? { pointerId: 1, pointerType: "mouse", isPrimary: true } : {}),
      clientX: 100, clientY: 100, ...values,
      preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() { stopped = true; },
    };
    event.pageX ??= event.clientX; event.pageY ??= event.clientY;
    for (const callback of [...(this.listeners.get(type) ?? [])]) {
      if (this.listeners.get(type)?.has(callback)) callback(event);
      if (stopped) break;
    }
  }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) {
    if (!this.captures.delete(id)) return;
    this.dispatch("lostpointercapture", { pointerId: id });
  }
  blur() { this.dispatch("blur"); }
  getRootNode() { return globalThis.document; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}
const context = new Proxy({
  measureText: text => ({ width: String(text).length * 8 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
  getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
}, { get: (target, key) => target[key] ?? (() => {}) });
globalThis.document = Object.assign(new Element(), {
  body: new Element("body"), fonts: null,
  createElement(tag) {
    const element = new Element(tag);
    if (tag === "canvas") element.getContext = () => context;
    return element;
  },
  createElementNS(_ns, tag) { return this.createElement(tag); },
});
globalThis.window = Object.assign(new Element(), { location: { search: "?lite" }, innerWidth: 1024 });
globalThis.Image = class { addEventListener() {} removeEventListener() {} set src(_value) {} };
const server = await createServer({ root, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let checks = 0, failures = 0;
const editors = [];
try {
  const { Editor } = await server.ssrLoadModule("/src/editor.ts");
  const { migrateCustomLevel } = await server.ssrLoadModule("/src/level.ts");
  const realBuildPanel = Editor.prototype.buildPanel;
  Editor.prototype.buildPanel = function () { this.panel = new Element(); this.propsEl = new Element(); };
  const createEditor = () => {
    const canvas = new Element("canvas");
    const camera = new THREE.PerspectiveCamera(60, 4 / 3, 0.1, 10000);
    camera.position.set(10, 12, 16);
    const hooks = { showMsg() {}, rebuild() {}, resetPreview() {}, levelsChanged() {}, setView() {}, preflight: () => true };
    const editor = new Editor(new THREE.Scene(), camera, canvas, () => null, hooks);
    editors.push(editor);
    Object.assign(editor, {
      active: true,
      data: migrateCustomLevel({ v: 1, name: "Pointer regression", spawn: [0, 2, 0], killY: -30,
        components: [{ t: "platform", p: [0, 0, 0], s: [8, 1, 8] }, { t: "gate", p: [0, 0, -8] }] }),
      sel: [0], snap: false, surfaceSnap: false, pickIndex: 0, commits: 0, resets: 0,
      renderLayers() {}, renderProps() {}, refreshSelectionBox() {}, refreshHandles() {},
      syncDockLayout() {}, syncProjectFields() {}, showMarquee() {}, hideMarquee() {},
      markViewButtons() {}, saveCam() {}, updateDrawVis() {},
      pick() { return this.pickIndex; }, objectsFor() { return []; },
      boxFor() { return new THREE.Box3(new THREE.Vector3(-4, -0.5, -4), new THREE.Vector3(4, 0.5, 4)); },
      selectionBounds() { return this.boxFor(0); },
      groundPoint(event, _plane, output) { output.set(event.clientX / 10, 0, event.clientY / 10); return true; },
      drawPlanePoint(event) { return new THREE.Vector3(event.clientX / 10, 0, event.clientY / 10); },
      commit() {
        const json = JSON.stringify(this.data);
        if (json !== this.lastCommitted) { this.commits++; this.lastCommitted = json; }
        return true;
      },
    });
    hooks.resetPreview = () => { editor.resets++; };
    editor.lastCommitted = JSON.stringify(editor.data);
    editor.resetCameraControls();
    editor.controls.enableDamping = false;
    return editor;
  };
  const check = (name, callback) => {
    checks++;
    try { callback(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
    finally {
      for (const editor of editors.splice(0)) { editor.active = false; editor.controls?.dispose(); }
    }
  };
  const touch = (id, x, y, extra = {}) => ({ pointerId: id, pointerType: "touch", isPrimary: id === 11, clientX: x, clientY: y, ...extra });
  const move = (editor, id = 11) => {
    editor.dom.dispatch("pointerdown", touch(id, 100, 100));
    editor.dom.dispatch("pointermove", touch(id, 160, 100));
    assert.equal(editor.data.components[0].p[0], 6);
  };
  check("single touch moves geometry while the camera remains stationary", () => {
    const editor = createEditor(); const camera = editor.camera.position.clone();
    move(editor);
    assert.ok(editor.camera.position.distanceTo(camera) < 1e-9);
    editor.dom.dispatch("pointerup", touch(11, 160, 100));
    assert.equal(editor.commits, 1); assert.equal(editor.editPointerId, null);
    assert.equal(editor.dragging, false);
  });
  check("a second pen's down/move/up/cancel cannot replace or end a first pen's drag", () => {
    const editor = createEditor();
    const pen = (id, x) => ({ pointerId: id, pointerType: "pen", clientX: x, clientY: 100 });
    editor.dom.dispatch("pointerdown", pen(21, 100));
    editor.dom.dispatch("pointermove", pen(21, 160));
    const before = JSON.stringify(editor.data);
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"])
      editor.dom.dispatch(type, pen(22, 500));
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.commits, 0);
    assert.equal(editor.editPointerId, 21);
    editor.dom.dispatch("pointerup", pen(21, 160));
    assert.equal(editor.commits, 1);
  });
  check("adding a second touch rolls back the preview and hands pan/pinch to OrbitControls", () => {
    const editor = createEditor(); const before = JSON.stringify(editor.data);
    const camera = editor.camera.position.clone();
    move(editor);
    editor.dom.dispatch("pointerdown", touch(12, 240, 100));
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.commits, 0);
    assert.equal(editor.touchNavigating, true);
    assert.equal(editor.dom.hasPointerCapture(11), true, "handoff lost the first finger's capture");
    editor.dom.dispatch("pointermove", touch(12, 300, 140));
    assert.ok(editor.camera.position.distanceTo(camera) > 0.1, "pinch did not reach real OrbitControls");
    editor.dom.dispatch("pointerup", touch(12, 300, 140));
    editor.dom.dispatch("pointermove", touch(11, 400, 200));
    assert.equal(JSON.stringify(editor.data), before, "remaining pinch finger resumed editing");
    editor.dom.dispatch("pointerup", touch(11, 400, 200));
    assert.equal(editor.touchNavigating, false);
    move(editor); editor.dom.dispatch("pointerup", touch(11, 160, 100));
    assert.equal(editor.commits, 1, "fresh touch edit did not recover after pinch");
  });
  check("pen drawing drops a touch vertex only on a completed single-finger tap", () => {
    const editor = createEditor(); editor.drawing = { t: "rail", y: 0, pts: [] };
    editor.dom.dispatch("pointerdown", touch(11, 100, 100));
    assert.equal(editor.drawing.pts.length, 0);
    editor.dom.dispatch("pointerdown", touch(12, 200, 100));
    editor.dom.dispatch("pointerup", touch(12, 200, 100));
    editor.dom.dispatch("pointerup", touch(11, 100, 100));
    assert.equal(editor.drawing.pts.length, 0, "camera gesture left a pen vertex");
    editor.dom.dispatch("pointerdown", touch(11, 150, 100));
    editor.dom.dispatch("pointerup", touch(11, 150, 100));
    assert.deepEqual(editor.drawing.pts.map(p => p.toArray()), [[15, 0, 10]]);
  });
  check("a third touch and a foreign pen cannot interrupt the active pinch", () => {
    const editor = createEditor();
    editor.dom.dispatch("pointerdown", touch(11, 100, 100));
    editor.dom.dispatch("pointerdown", touch(12, 200, 100));
    const camera = editor.camera.position.clone();
    editor.dom.dispatch("pointerdown", touch(13, 300, 200));
    editor.dom.dispatch("pointermove", touch(13, 700, 400));
    editor.dom.dispatch("pointerup", touch(13, 700, 400));
    editor.dom.dispatch("pointerdown", { pointerId: 21, pointerType: "pen", button: 2, buttons: 2 });
    editor.dom.dispatch("pointermove", { pointerId: 21, pointerType: "pen", clientX: 600 });
    assert.ok(editor.camera.position.distanceTo(camera) < 1e-9);
    editor.dom.dispatch("pointermove", touch(12, 300, 100));
    assert.ok(editor.camera.position.distanceTo(camera) > 0.1);
    assert.equal(editor.commits, 0);
  });
  check("canceling one pinch finger waits for the other to lift, then permits a clean pinch", () => {
    const editor = createEditor(); const before = JSON.stringify(editor.data);
    editor.dom.dispatch("pointerdown", touch(11, 100, 100));
    editor.dom.dispatch("pointerdown", touch(12, 200, 100));
    editor.dom.dispatch("pointercancel", touch(12, 200, 100));
    editor.dom.dispatch("pointermove", touch(11, 300, 300));
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.touchNavigating, true);
    editor.dom.dispatch("pointerup", touch(11, 300, 300));
    const camera = editor.camera.position.clone();
    editor.dom.dispatch("pointerdown", touch(11, 100, 100));
    editor.dom.dispatch("pointerdown", touch(12, 200, 100));
    editor.dom.dispatch("pointermove", touch(12, 300, 100));
    assert.ok(editor.camera.position.distanceTo(camera) > 0.1);
    assert.equal(editor.commits, 0);
  });
  const hitFixture = editor => {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    editor.setRay = () => {};
    editor.raycaster.intersectObjects = () => [{ object: handle }];
    return handle;
  };
  check("axis gizmo movement belongs to its touch and rolls back on pinch handoff", () => {
    const editor = createEditor(); const handle = hitFixture(editor); const before = JSON.stringify(editor.data);
    editor.moveGroup = new THREE.Group(); editor.moveParts = [{ hit: handle, ax: "x" }];
    move(editor);
    assert.ok(editor.moveDrag); assert.equal(editor.dragging, false);
    editor.dom.dispatch("pointerup", { pointerId: 22, pointerType: "pen", clientX: 500 });
    assert.equal(editor.commits, 0); assert.ok(editor.moveDrag);
    editor.dom.dispatch("pointerdown", touch(12, 240, 100));
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.moveDrag, null);
  });
  check("node-handle movement ignores foreign contacts and restores its sparse source on cancel", () => {
    const editor = createEditor(); const handle = hitFixture(editor);
    editor.data.components[0] = { t: "rail", p: [0, 0, 0], pts: [[0, 0], [0, -10]] };
    const before = JSON.stringify(editor.data);
    editor.resizeIdx = 0; editor.handleMeshes = [handle]; handle.userData.hdl = 0;
    editor.hdlDefs = [{ pos: new THREE.Vector3(10, 0, 10), dir: new THREE.Vector3(1, 0, 0), vtx: 0 }];
    editor.tintHandles = () => {};
    editor.dom.dispatch("pointerdown", touch(11, 100, 100));
    editor.dom.dispatch("pointermove", touch(11, 160, 100));
    assert.notEqual(JSON.stringify(editor.data), before); assert.ok(editor.hdlDrag);
    const preview = JSON.stringify(editor.data);
    editor.dom.dispatch("pointermove", { pointerId: 22, pointerType: "pen", clientX: 500 });
    editor.dom.dispatch("pointerup", { pointerId: 22, pointerType: "pen", clientX: 500 });
    assert.equal(JSON.stringify(editor.data), preview); assert.equal(editor.commits, 0);
    editor.dom.dispatch("pointercancel", touch(11, 160, 100));
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.hdlDrag, null);
  });
  check("group-scale handle movement cancels atomically when a second touch starts navigation", () => {
    const editor = createEditor(); const handle = hitFixture(editor); const before = JSON.stringify(editor.data);
    editor.gizmoHandles = [{ mesh: handle, hit: handle,
      def: { nx: 1, ny: 0, nz: 0.5, ax: ["x"], corner: false } }];
    editor.dom.dispatch("pointerdown", touch(11, 100, 100));
    editor.dom.dispatch("pointermove", touch(11, 160, 100));
    assert.notEqual(JSON.stringify(editor.data), before); assert.ok(editor.gizmoDrag);
    editor.dom.dispatch("pointerdown", touch(12, 240, 100));
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.gizmoDrag, null);
    assert.equal(editor.commits, 0);
  });
  check("marquee owns pointer capture and ignores another contact's move/up", () => {
    const editor = createEditor(); editor.pickIndex = -1;
    editor.dom.dispatch("pointerdown", { pointerId: 41, clientX: 10, clientY: 20 });
    assert.equal(editor.dom.hasPointerCapture(41), true);
    editor.dom.dispatch("pointermove", { pointerId: 42, clientX: 500, clientY: 500 });
    editor.dom.dispatch("pointerup", { pointerId: 42, clientX: 500, clientY: 500 });
    assert.deepEqual(editor.marquee, { x0: 10, y0: 20, x1: 10, y1: 20 });
    window.dispatch("keydown", { code: "Space", target: document.body });
    assert.equal(editor.spaceHeld, false, "Space stranded a captured marquee as a pan gesture");
    window.dispatch("keydown", { code: "Escape", target: document.body });
    assert.equal(editor.marquee, null); assert.equal(editor.editPointerId, null);
    assert.deepEqual(editor.sel, [0], "canceling the sweep cleared the previous selection");
  });
  for (const ending of ["pointercancel", "lostpointercapture", "blur", "resize"]) {
    check(`${ending} rolls back touch geometry and the next gesture starts cleanly`, () => {
      const editor = createEditor(); const before = JSON.stringify(editor.data); move(editor);
      if (ending === "blur" || ending === "resize") window.dispatch(ending, {});
      else editor.dom.dispatch(ending, touch(11, 160, 100));
      assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.commits, 0);
      assert.equal(editor.editPointerId, null);
      editor.dom.dispatch("pointerup", touch(11, 160, 100));
      move(editor, 13); editor.dom.dispatch("pointerup", touch(13, 160, 100));
      assert.equal(editor.commits, 1);
    });
  }
  check("window blur resets an in-flight OrbitControls mouse orbit", () => {
    const editor = createEditor();
    editor.dom.dispatch("pointerdown", { pointerId: 1, button: 2, buttons: 2 });
    editor.dom.dispatch("pointermove", { pointerId: 1, buttons: 2, clientX: 150 });
    window.dispatch("blur");
    const camera = editor.camera.position.clone();
    editor.dom.dispatch("pointermove", { pointerId: 1, buttons: 0, clientX: 600 });
    editor.controls.update();
    assert.ok(editor.camera.position.distanceTo(camera) < 1e-9, "hover resumed the abandoned camera orbit");
    editor.dom.dispatch("pointerdown", { pointerId: 1, button: 2, buttons: 2 });
    editor.dom.dispatch("pointermove", { pointerId: 1, buttons: 2, clientX: 200 });
    assert.ok(editor.camera.position.distanceTo(camera) > 0.1, "new orbit did not recover");
  });
  check("axis/3D view changes roll back geometry before changing the drag plane", () => {
    const editor = createEditor(); const before = JSON.stringify(editor.data); move(editor);
    editor.focusAnim = { fromP: editor.camera.position.clone(), toP: new THREE.Vector3(),
      fromT: editor.controls.target.clone(), toT: new THREE.Vector3(), start: performance.now() };
    editor.snapView("x");
    assert.equal(editor.focusAnim, null, "old camera glide could overwrite the snapped view");
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.dragging, false);
    assert.equal(editor.viewMode, "x"); assert.equal(editor.controls.enableRotate, false);
    editor.dom.dispatch("pointerup", touch(11, 160, 100));
    editor.dom.dispatch("pointerdown", touch(11, 100, 100));
    editor.dom.dispatch("pointermove", touch(11, 100, 160));
    assert.equal(editor.data.components[0].p[2], 6);
    editor.to3D();
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.commits, 0);
    assert.equal(editor.viewMode, "3d"); assert.equal(editor.controls.enableRotate, true);
    editor.dom.dispatch("pointerup", touch(11, 100, 160));
    move(editor);
    window.dispatch("keydown", { code: "ArrowRight", target: document.body });
    assert.equal(Math.hypot(...editor.data.components[0].p), 0.25,
      "keyboard nudge committed the pointer preview instead of starting from its source");
    const nudged = JSON.stringify(editor.data);
    editor.dom.dispatch("pointermove", touch(11, 500, 100));
    editor.dom.dispatch("pointerup", touch(11, 500, 100));
    assert.equal(JSON.stringify(editor.data), nudged); assert.equal(editor.commits, 1);
    editor.cameraDirty = false;
    editor.dom.dispatch("pointerdown", touch(11, 100, 100));
    editor.dom.dispatch("pointermove", touch(11, 160, 100));
    window.dispatch("keydown", { code: "KeyF", target: document.body });
    assert.equal(JSON.stringify(editor.data), nudged); assert.equal(editor.dragging, false);
    assert.equal(editor.cameraDirty, true, "framing was not marked for camera persistence");
  });
  const field = editor => editor.numRow("x", () => editor.data.components[0].p[0], value => {
    editor.data.components[0].p[0] = value;
  }).children[1];
  check("numeric scrub owns its pointer and commits once after unrelated pointer endings", () => {
    const editor = createEditor(); const input = field(editor);
    input.dispatch("pointerdown", touch(11, 100, 100));
    assert.equal(input.hasPointerCapture(11), true);
    input.dispatch("pointermove", touch(11, 100, 80));
    assert.equal(editor.data.components[0].p[0], 5);
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"])
      input.dispatch(type, touch(12, 100, 300));
    assert.equal(editor.data.components[0].p[0], 5); assert.equal(editor.commits, 0);
    input.dispatch("change"); assert.equal(editor.commits, 0, "blur/change committed a scrub preview");
    input.dispatch("pointerup", touch(11, 100, 80));
    assert.equal(editor.commits, 1); assert.equal(editor.cancelScrub, null);
    assert.equal(input.hasPointerCapture(11), false);
  });
  check("a numeric click released before threshold leaves no scrub armed", () => {
    const editor = createEditor(); const input = field(editor);
    input.dispatch("pointerdown", touch(11, 100, 100));
    input.dispatch("pointerup", touch(11, 100, 101));
    assert.equal(input.hasPointerCapture(11), false); assert.equal(editor.cancelScrub, null);
    input.dispatch("pointermove", touch(11, 100, 50));
    assert.equal(editor.data.components[0].p[0], 0); assert.equal(editor.commits, 0);
  });
  check("global Escape cancels a blurred numeric scrub without a transaction", () => {
    const editor = createEditor(); const input = field(editor); const before = JSON.stringify(editor.data);
    input.dispatch("pointerdown", touch(11, 100, 100));
    input.dispatch("pointermove", touch(11, 100, 80));
    window.dispatch("keydown", { code: "Escape", key: "Escape", target: document.body });
    assert.equal(JSON.stringify(editor.data), before); assert.equal(editor.commits, 0);
    assert.equal(editor.cancelScrub, null); assert.equal(input.hasPointerCapture(11), false);
  });
  check("a second numeric field cannot replace another field's active scrub owner", () => {
    const editor = createEditor(); const first = field(editor), second = field(editor);
    first.dispatch("pointerdown", touch(11, 100, 100));
    first.dispatch("pointermove", touch(11, 100, 80));
    second.dispatch("pointerdown", touch(12, 100, 100));
    second.dispatch("pointermove", touch(12, 100, 40));
    second.dispatch("pointerup", touch(12, 100, 40));
    editor.dom.dispatch("pointerdown", touch(12, 100, 100));
    editor.dom.dispatch("pointermove", touch(12, 500, 100));
    editor.dom.dispatch("pointerup", touch(12, 500, 100));
    assert.equal(editor.data.components[0].p[0], 5); assert.equal(editor.commits, 0);
    assert.ok(editor.cancelScrub);
    first.dispatch("pointercancel", touch(11, 100, 80));
    assert.equal(editor.data.components[0].p[0], 0); assert.equal(editor.cancelScrub, null);
  });
  Editor.prototype.buildPanel = realBuildPanel;
} finally { await server.close(); }
if (failures) { console.error(`${failures}/${checks} pointer regressions failed`); process.exitCode = 1; }
else console.log(`All ${checks} editor pointer regressions passed`);
