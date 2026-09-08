import * as THREE from "three";
import { Editor } from "../src/editor.ts";
import {
  Level, findLevel, getUserLevels, setUserLevels, setEditorBuild,
  groupChainOf, normalizeCustomLevelData, borrowedValidatedLevelData,
  userLevelStorageHealthy,
} from "../src/level.ts";
import { requiresTerrainSupportBuildCheck } from "../src/terrainSupportBudget.ts";

// Dev-only instrumented integration, with the production Editor and Level.
// It intentionally does not claim to measure main.ts's player/postprocessing.
const run = document.querySelector("#run");
const status = document.querySelector("#status");
const report = document.querySelector("#report");
const canvas = document.querySelector("#canvas");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x718eac);
scene.add(new THREE.HemisphereLight(0xe0efff, 0x555158, 1.1));
const sun = new THREE.DirectionalLight(0xffefd7, 1.3);
sun.position.set(-20, 60, 30); scene.add(sun);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 3000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
let level = null, editor = null, phases = null;
const errors = [];
addEventListener("error", event => errors.push(event.message));
addEventListener("unhandledrejection", event => errors.push(String(event.reason)));
canvas.addEventListener("webglcontextlost", () => errors.push("WebGL context lost"));
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const measure = (name, action) => {
  const started = performance.now();
  try { return action(); }
  finally { if (phases) phases[name] = (phases[name] ?? 0) + performance.now() - started; }
};
const memory = () => ({ ...renderer.info.memory, programs: renderer.info.programs?.length ?? 0 });
const round = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, typeof value === "number" ? +value.toFixed(2) : value]));
const stored = () => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
  .sort().map(key => [key, localStorage.getItem(key)]);
function draw() {
  editor?.update();
  renderer.render(scene, camera);
}
function rebuild(committed = true) {
  const working = editor.workingEntry();
  const saved = committed ? findLevel(working.id) : null;
  const entry = saved?.data ? saved : working;
  const candidate = measure("construct", () => new Level(scene, entry, level));
  measure("dispose", () => level?.dispose(candidate));
  level = candidate;
  measure("rebuilt UI", () => editor.onLevelRebuilt());
}
editor = new Editor(scene, camera, canvas, () => level, {
  showMsg() {}, levelsChanged() {}, setView() {},
  exitToPlay() { editor.exit(); },
  resetPreview: () => rebuild(false),
  rebuild,
  preflight(prepared) {
    return measure("preflight", () => {
      const working = prepared ?? editor.workingEntry();
      if (!(borrowedValidatedLevelData(working.data) ?? normalizeCustomLevelData(working.data))) return false;
      if (requiresTerrainSupportBuildCheck(working.data)) {
        const probe = new Level(new THREE.Scene(), working, level); probe.dispose(level);
      }
      return true;
    });
  },
});
// Time real work without replacing it. Some UI timings are nested; report
// them as diagnostics rather than adding them to transaction totals.
for (const name of ["renderLayers", "renderProps", "syncProjectFields", "refreshSelectionBox"]) {
  const original = editor[name];
  editor[name] = function (...args) { return measure(name, () => original.apply(this, args)); };
}
let rendering = true;
function frame() { if (!rendering) return; draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
run.disabled = false;
status.textContent = `Ready · ${location.search.includes("lite") ? "lite" : "full"} geometry`;

run.addEventListener("click", async () => {
  run.disabled = true; errors.length = 0; report.textContent = "";
  const storageBefore = stored(), libraryBefore = getUserLevels();
  const rows = [], resources = [], cleanup = [];
  let source = null;
  const storageSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (...args) {
    return this === localStorage ? measure("storage", () => storageSet.apply(this, args)) : storageSet.apply(this, args);
  };
  const publish = () => { report.textContent = JSON.stringify({ rows, resources, cleanup, errors }, null, 2); };
  try {
    status.textContent = "Capturing native Descent…"; await nextFrame();
    setEditorBuild(false);
    source = new Level(new THREE.Scene(), { id: "descent", name: "The Descent" });
    const data = normalizeCustomLevelData(source.captureData());
    assert(data, "Native capture did not validate"); source.dispose(); source = null;
    const fixture = { id: "browser_performance_fixture", name: data.name, data };
    // The registry is restored below. Only this disposable origin-local copy
    // participates, allowing real storage writes without library size noise.
    assert(setUserLevels([fixture]), "Storage unavailable for browser measurement");
    setEditorBuild(true);
    level = new Level(scene, findLevel(fixture.id));
    editor.enter(findLevel(fixture.id));
    editor.setPop("layers", false);
    const group = data.groups.find(value => value.nm === "Mountain wall 1");
    assert(group, "Captured mountain group missing");
    const members = data.components.flatMap((component, index) => groupChainOf(component, data).includes(group.id) ? [index] : []);
    assert(members.length > 1, "No linked mountain owners");
    camera.position.set(data.spawn[0] + 40, data.spawn[1] + 50, data.spawn[2] + 55);
    editor.controls.target.set(...data.spawn); editor.controls.update();
    await nextFrame(); draw(); await nextFrame();
    rows.push({ setup: `${data.components.length} components / ${new TextEncoder().encode(JSON.stringify(data)).byteLength} bytes / ${members.length} moved group members`, viewport: `${innerWidth}×${innerHeight}`, resources: memory() });
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const action of ["edit", "undo", "redo"]) {
        status.textContent = `Measuring ${cycle + 1}/3 · ${action}…`; await nextFrame();
        phases = {}; const begin = performance.now();
        if (action === "edit") {
          editor.sel = [...members];
          for (const index of members) editor.data.components[index].p[0] += .25;
          assert(editor.commit(), "Edit rejected");
        } else editor[action]();
        const transactionMs = performance.now() - begin;
        measure("layout", () => { editor.panel.getBoundingClientRect(); editor.layersEl.getBoundingClientRect(); });
        measure("render submit", draw);
        const measured = round(phases); phases = null;
        const end = performance.now(); await nextFrame();
        assert(userLevelStorageHealthy(), "Fixture storage write failed");
        assert(errors.length === 0, errors.join("; "));
        rows.push({ cycle: cycle + 1, action, transactionMs: +transactionMs.toFixed(2), ...measured, nextFrameMs: +(performance.now() - end).toFixed(2) });
        resources.push(memory()); publish();
      }
    }
    // Equivalent later states must not accumulate GPU geometries/textures.
    // Compare undo to undo and redo to redo: the selection gizmo deliberately
    // changes the number of live helpers after edits.
    for (const index of [1, 2]) {
      const first = resources[index], last = resources[index + 6];
      assert(last.geometries <= first.geometries + 2, `Geometry count grew: ${first.geometries} → ${last.geometries}`);
      assert(last.textures <= first.textures + 2, `Texture count grew: ${first.textures} → ${last.textures}`);
      assert(last.programs <= first.programs + 2, `Shader program count grew: ${first.programs} → ${last.programs}`);
    }
    status.textContent = "PASS · nine measured operations · stable equivalent-state GPU resource counts";
    document.body.dataset.performanceReview = "passed";
  } catch (error) {
    status.textContent = `FAIL · ${error.message}`;
    errors.push(error.stack ?? String(error));
    document.body.dataset.performanceReview = "failed";
  } finally {
    phases = null;
    source?.dispose(); editor.exit(); level?.dispose(); level = null; setEditorBuild(false);
    draw(); await nextFrame(); cleanup.push(memory());
    setUserLevels(libraryBefore);
    for (const [key] of stored()) if (!storageBefore.some(([oldKey]) => key === oldKey)) localStorage.removeItem(key);
    for (const [key, value] of storageBefore) localStorage.setItem(key, value);
    Storage.prototype.setItem = storageSet;
    const unchanged = JSON.stringify(storageBefore) === JSON.stringify(stored());
    if (!unchanged) { errors.push("Saved storage changed"); document.body.dataset.performanceReview = "failed"; }
    status.textContent += ` · saved storage ${unchanged ? "restored" : "CHANGED"}`;
    publish(); run.disabled = false;
  }
});
addEventListener("pagehide", () => { rendering = false; });
