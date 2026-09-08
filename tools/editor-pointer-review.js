import * as THREE from "three";
import { Editor } from "../src/editor.ts";
import { migrateCustomLevel } from "../src/level.ts";

// Dev-only browser review page. Do not import this from the production app.
// enter()/exit()/registry APIs are deliberately unused. The fixture replaces
// drawing/picking and commit persistence, while browser event listeners,
// editing transactions, numeric rows, and OrbitControls remain real.
const run = document.querySelector("#run");
const summary = document.querySelector("#summary");
const results = document.querySelector("#results");
const canvas = document.querySelector("#canvas");
const fields = document.querySelector("#fields");
const detail = document.querySelector("#detail");
const context = canvas.getContext("2d");
const failures = [];
window.addEventListener("error", event => failures.push(event.message));
window.addEventListener("unhandledrejection", event => failures.push(String(event.reason)));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const json = value => JSON.stringify(value);
const near = (a, b) => Math.abs(a - b) < 1e-8;
const settle = () => new Promise(resolve => setTimeout(resolve, 80));
const syntheticIds = new Set([1001, 1002, 1003, 1021, 1022]);

function modelSyntheticCapture(element) {
  const captures = new Set();
  const nativeSet = element.setPointerCapture.bind(element);
  const nativeHas = element.hasPointerCapture.bind(element);
  const nativeRelease = element.releasePointerCapture.bind(element);
  element.setPointerCapture = id => syntheticIds.has(id) ? captures.add(id) : nativeSet(id);
  element.hasPointerCapture = id => syntheticIds.has(id) ? captures.has(id) : nativeHas(id);
  element.releasePointerCapture = id => {
    if (!syntheticIds.has(id)) return nativeRelease(id);
    if (!captures.delete(id)) return;
    // A queued loss also catches cancellation code that accidentally relies
    // on a synchronous release guard lasting until the next browser event.
    queueMicrotask(() => element.dispatchEvent(new PointerEvent("lostpointercapture", {
      bubbles: true, pointerId: id, pointerType: id < 1020 ? "touch" : "pen",
    })));
  };
}
modelSyntheticCapture(canvas);
function emit(target, type, pointerId = 1001, x = 100, y = 100, extra = {}) {
  const rect = canvas.getBoundingClientRect();
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId,
    pointerType: pointerId < 1020 ? "touch" : "pen", isPrimary: pointerId === 1001 || pointerId === 1021,
    button: 0, buttons: /up|cancel/.test(type) ? 0 : 1,
    clientX: rect.left + x, clientY: rect.top + y, ...extra,
  }));
  if (/^pointer(up|cancel)$/.test(type) && target.hasPointerCapture(pointerId))
    target.releasePointerCapture(pointerId);
}
const camera = new THREE.PerspectiveCamera(60, 900 / 210, 0.1, 10000);
camera.position.set(10, 12, 16);
const originalPanel = Editor.prototype.buildPanel;
Editor.prototype.buildPanel = function () {
  this.panel = document.createElement("div");
  this.propsEl = document.createElement("div");
  this.panel.append(this.propsEl);
};
let editor;
try {
  editor = new Editor(new THREE.Scene(), camera, canvas, () => null, {
    showMsg() {}, rebuild: () => draw(), resetPreview: () => draw(),
    levelsChanged() {}, setView() {}, preflight: () => true,
  });
} finally { Editor.prototype.buildPanel = originalPanel; }
Object.assign(editor, {
  renderLayers() {}, renderProps: () => draw(), refreshSelectionBox() {}, refreshHandles() {},
  syncDockLayout() {}, syncProjectFields() {}, showMarquee() {}, hideMarquee() {},
  markViewButtons() {}, saveCam() {}, updateDrawVis() {},
  pick() { return 0; }, objectsFor() { return []; },
  boxFor() { return new THREE.Box3(new THREE.Vector3(-4, -.5, -4), new THREE.Vector3(4, .5, 4)); },
  selectionBounds() { return this.boxFor(0); },
  groundPoint(event, _plane, out) {
    const rect = canvas.getBoundingClientRect();
    out.set((event.clientX - rect.left) / 10, 0, (event.clientY - rect.top) / 10);
    return true;
  },
  commit() {
    const next = json(this.data);
    if (next !== this.lastCommitted) { this.commits++; this.lastCommitted = next; }
    draw(); return true;
  },
});
function draw() {
  if (!editor?.data) return;
  const p = editor.data.components[0].p;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#2b3c50";
  for (let x = 0; x < 900; x += 30) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 210); context.stroke(); }
  for (let y = 0; y < 210; y += 30) { context.beginPath(); context.moveTo(0, y); context.lineTo(900, y); context.stroke(); }
  context.fillStyle = "#4db790"; context.fillRect(400 + p[0] * 10, 62 + p[2] * 5, 95, 85);
  context.fillStyle = "#dceefa"; context.font = "15px system-ui";
  context.fillText("Disposable platform fixture", 20, 30);
  detail.textContent = `Position ${p.map(v => v.toFixed(2)).join(", ")} · in-memory commits ${editor.commits ?? 0}\nCamera ${camera.position.toArray().map(v => v.toFixed(2)).join(", ")} · view ${editor.viewMode}`;
}
function resetFixture() {
  if (editor.active) editor.onPointerCancel();
  editor.controls?.dispose(); editor.controls = null;
  camera.position.set(10, 12, 16); camera.fov = 60; camera.updateProjectionMatrix();
  Object.assign(editor, {
    active: true, viewMode: "3d", saved3D: null, focusAnim: null, sel: [0],
    snap: false, surfaceSnap: false, commits: 0, cameraDirty: false,
    data: migrateCustomLevel({ v: 1, name: "Disposable browser pointer fixture", spawn: [0, 2, 0], killY: -30,
      components: [{ t: "platform", p: [0, 0, 0], s: [8, 1, 8] }, { t: "gate", p: [0, 0, -8] }] }),
  });
  editor.lastCommitted = json(editor.data);
  editor.resetCameraControls(); editor.controls.enableDamping = false;
  fields.replaceChildren(); draw();
}
function numericField() {
  const row = editor.numRow("Fixture x", () => editor.data.components[0].p[0], value => {
    editor.data.components[0].p[0] = value;
  });
  const input = row.querySelector("input");
  modelSyntheticCapture(input); fields.append(row); return input;
}
function startMove(id = 1001) {
  emit(canvas, "pointerdown", id, 100, 100);
  emit(canvas, "pointermove", id, 160, 100);
  assert(near(editor.data.components[0].p[0], 6), "Owner pointer did not move geometry by six units");
}
function storedValues() {
  return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    .sort().map(key => [key, localStorage.getItem(key)]);
}
const cases = [
  ["Single-finger editing hands off to two-finger pan/zoom without committing geometry", async () => {
    const before = json(editor.data), initialCamera = camera.position.clone();
    startMove();
    assert(camera.position.distanceTo(initialCamera) < 1e-8, "Single-finger editing moved the camera");
    emit(canvas, "pointerdown", 1002, 240, 100);
    await settle();
    assert(json(editor.data) === before && editor.commits === 0, "Pinch handoff retained/committed its preview");
    emit(canvas, "pointermove", 1002, 300, 140);
    assert(camera.position.distanceTo(initialCamera) > .1, "Real OrbitControls did not pan/zoom");
    emit(canvas, "pointerup", 1002, 300, 140);
    emit(canvas, "pointermove", 1001, 400, 150);
    assert(json(editor.data) === before, "The remaining finger resumed editing");
    emit(canvas, "pointerup", 1001, 400, 150); await settle();
  }],
  ["Foreign pen down/move/up/cancel cannot replace the owning drag", async () => {
    startMove(1021); const preview = json(editor.data);
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"])
      emit(canvas, type, 1022, 550, 130);
    assert(json(editor.data) === preview && editor.commits === 0 && editor.editPointerId === 1021,
      "A foreign pen changed or ended the active drag");
    emit(canvas, "pointerup", 1021, 160, 100); await settle();
    assert(editor.commits === 1 && editor.editPointerId === null, "Owner release did not commit exactly once");
  }],
  ["Window blur and pointer cancellation restore geometry and reset camera interaction", async () => {
    const before = json(editor.data); startMove();
    window.dispatchEvent(new Event("blur")); await settle();
    assert(json(editor.data) === before && editor.commits === 0, "Window blur retained its preview");
    startMove(); emit(canvas, "pointercancel", 1001, 160, 100); await settle();
    assert(json(editor.data) === before && editor.commits === 0, "Pointer cancellation retained its preview");
    emit(canvas, "pointerdown", 1021, 100, 100, { button: 2, buttons: 2, pointerType: "mouse" });
    emit(canvas, "pointermove", 1021, 160, 100, { buttons: 2, pointerType: "mouse" });
    window.dispatchEvent(new Event("blur")); await settle();
    const afterBlur = camera.position.clone();
    emit(canvas, "pointermove", 1021, 550, 100, { buttons: 0, pointerType: "mouse" });
    editor.controls.update();
    assert(camera.position.distanceTo(afterBlur) < 1e-8, "Hover resumed an abandoned camera orbit");
  }],
  ["Numeric scrub ignores foreign contacts and commits once on its owner's release", async () => {
    const input = numericField(); input.focus();
    emit(input, "pointerdown", 1001, 100, 100); await settle();
    emit(input, "pointermove", 1001, 100, 80);
    assert(near(editor.data.components[0].p[0], 5), "Real input scrub did not preview five units");
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"])
      emit(input, type, 1002, 100, 150);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    assert(near(editor.data.components[0].p[0], 5) && editor.commits === 0, "Foreign contact/change committed the preview");
    emit(input, "pointerup", 1001, 100, 80); await settle();
    assert(editor.commits === 1 && editor.cancelScrub === null && !input.hasPointerCapture(1001),
      "Numeric owner release did not end one transaction");
  }],
  ["Blurred numeric scrub cancels on Escape; a plain click leaves no armed scrub", async () => {
    const before = json(editor.data), input = numericField(); input.focus();
    emit(input, "pointerdown", 1001, 100, 100); await settle();
    emit(input, "pointermove", 1001, 100, 80);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code: "Escape", key: "Escape" }));
    await settle();
    assert(json(editor.data) === before && editor.commits === 0 && editor.cancelScrub === null, "Escape retained the blurred scrub");
    emit(input, "pointerdown", 1001, 100, 100);
    emit(input, "pointerup", 1001, 100, 101); await settle();
    emit(input, "pointermove", 1001, 100, 50);
    assert(json(editor.data) === before && editor.cancelScrub === null, "A released click left a scrub armed");
  }],
  ["2D/3D switching cancels pending geometry before changing the view plane", async () => {
    const before = json(editor.data); startMove();
    editor.snapView("x"); await settle();
    assert(json(editor.data) === before && !editor.dragging && editor.viewMode === "x" && !editor.controls.enableRotate,
      "X view did not cancel the previous drag");
    emit(canvas, "pointerup", 1001, 160, 100); await settle();
    emit(canvas, "pointerdown", 1001, 100, 100);
    emit(canvas, "pointermove", 1001, 100, 160);
    assert(near(editor.data.components[0].p[2], 6), "X view did not move geometry in the visible Z plane");
    editor.to3D(); await settle();
    assert(json(editor.data) === before && editor.commits === 0 && editor.viewMode === "3d" && editor.controls.enableRotate,
      "3D view retained pending geometry or disabled orbit");
  }],
];

run.disabled = false; summary.textContent = "Ready · no saved levels opened"; draw();
run.addEventListener("click", async () => {
  run.disabled = true; results.replaceChildren(); failures.length = 0;
  summary.textContent = "Running six synthetic browser checks…";
  const storageBefore = json(storedValues()); let passed = 0;
  try {
    for (const [name, check] of cases) {
      const item = document.createElement("li"); item.textContent = `RUNNING · ${name}`; results.append(item);
      resetFixture(); await settle(); const errorCount = failures.length;
      try {
        await check();
        assert(failures.length === errorCount, `Browser error: ${failures.slice(errorCount).join("; ")}`);
        item.dataset.result = "pass"; item.textContent = `PASS · ${name}`; passed++;
      } catch (error) {
        item.dataset.result = "fail"; item.textContent = `FAIL · ${name}: ${error.message}`;
      }
      editor.onPointerCancel(); editor.active = false; editor.controls?.dispose(); editor.controls = null;
      await settle(); draw();
    }
    const storageUnchanged = json(storedValues()) === storageBefore;
    const allPassed = passed === cases.length && failures.length === 0 && storageUnchanged;
    summary.dataset.result = allPassed ? "pass" : "fail";
    summary.textContent = `${passed}/${cases.length} passed · ${failures.length} browser errors · saved storage ${storageUnchanged ? "unchanged" : "CHANGED"}`;
    document.body.dataset.pointerReview = allPassed ? "passed" : "failed";
  } catch (error) {
    summary.dataset.result = "fail"; summary.textContent = `Harness failed: ${error.message}`;
    document.body.dataset.pointerReview = "failed";
  } finally { editor.active = false; run.disabled = false; }
});
