import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as THREE from "three";

// Real Editor transactions and real registry validation, with only rendering
// replaced. Exercise storage refusal separately from browser quota failure.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clone = value => JSON.parse(JSON.stringify(value));
const storage = new Map();
let quota = false;
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem(key, value) {
    if (quota) throw new Error("QuotaExceededError");
    storage.set(key, String(value));
  },
  removeItem: key => storage.delete(key),
};
const context = new Proxy({
  measureText: text => ({ width: String(text).length * 8 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
  getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
}, { get: (target, key) => target[key] ?? (() => {}) });
globalThis.document = {
  createElement: () => ({ getContext: () => context, style: {}, addEventListener() {} }),
  createElementNS() { return this.createElement(); },
  fonts: null,
};
globalThis.window = { location: { search: "?lite" }, addEventListener() {}, removeEventListener() {} };
globalThis.Image = class { addEventListener() {} removeEventListener() {} set src(_value) {} };

const server = await createServer({ root, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let failures = 0;
let checks = 0;
try {
  const { Editor } = await server.ssrLoadModule("/src/editor.ts");
  const {
    migrateCustomLevel, normalizeCustomLevelData, findLevel, saveUserLevel,
    setUserLevels, getUserLevels, deleteUserLevel, MAX_USER_LEVELS, MAX_LEVEL_PACK_BYTES,
  } = await server.ssrLoadModule("/src/level.ts");
  const base = (components = [{ t: "platform", p: [0, 0, 0], s: [8, 1, 8] }], groups = []) =>
    migrateCustomLevel({ v: 1, name: "Transaction test", spawn: [0, 1, 0], killY: -30, components, groups });
  const editorFor = (data = base(), id = saveUserLevel({ id: "", name: data.name, data })) => {
    const editor = Object.create(Editor.prototype);
    Object.assign(editor, {
      active: true, data: clone(data), sel: [], selVtxs: new Set(), resizeIdx: -1,
      targetId: id, targetName: findLevel(id)?.name ?? data.name,
      initialTargetId: id, initialJson: JSON.stringify(data), lastCommitted: JSON.stringify(data),
      forkOnFirstCommit: false, forkedLevelId: null, pristineBuiltin: false,
      registryChanged: false, importSerial: 0, closedGroups: new Set(),
      undoStack: [], redoStack: [], lastCoalesce: "", lastCommitT: 0,
      clipboard: [], clipboardGroups: [], lastPasteKey: "", pasteBump: 0,
      moveDrag: null, gizmoDrag: null, hdlDrag: null, dragging: false,
      dragSel: [], dragAddedFrom: null, dragGroupsBefore: null,
      dragSourceJson: null, dragSelectionBefore: null, downAt: null, marquee: null,
      controls: { target: new THREE.Vector3(), enabled: true, mouseButtons: {} },
      snap: false, cancelScrub: null, panelTab: "sel", messages: [],
      statusEl: { textContent: "", dataset: {} },
      builds: 0, resets: 0, handleRefreshes: 0,
      renderLayers() {}, renderProps() {}, syncSkySelect() {}, syncProjectFields() {},
      refreshSelectionBox() {}, refreshSpawnMarker() {}, hideMarquee() {}, cancelDraw() {},
      setPanelTab(tab) { this.panelTab = tab; },
      setResize(index) { this.resizeIdx = index; },
      refreshHandles() { this.handleRefreshes++; },
    });
    editor.hooks = {
      showMsg: (title, detail) => editor.messages.push({ title, detail }),
      preflight: () => !!normalizeCustomLevelData(editor.data),
      resetPreview: () => editor.resets++, rebuild: () => editor.builds++, levelsChanged() {},
    };
    return editor;
  };
  const builtinEditor = () => {
    const editor = editorFor(base(), "jungle");
    editor.forkOnFirstCommit = true;
    editor.pristineBuiltin = true;
    return editor;
  };
  const fillLibrary = () => {
    const entries = [...getUserLevels()];
    for (let i = 0; entries.length < MAX_USER_LEVELS; i++)
      entries.push({ id: `filler_${i}`, name: "Filler", data: base() });
    assert.equal(setUserLevels(entries), true);
  };
  const check = (name, fn) => {
    quota = false;
    assert.equal(setUserLevels([]), true);
    checks++;
    try { fn(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
    finally { quota = false; }
  };
  check("accepted edit, undo and redo all match the registry used by play", () => {
    const editor = editorFor();
    editor.data.components[0].p[0] = 7;
    assert.equal(editor.commit(), true);
    assert.deepEqual(findLevel(editor.targetId).data, editor.data);
    editor.undo();
    assert.equal(editor.data.components[0].p[0], 0);
    assert.deepEqual(findLevel(editor.targetId).data, editor.data);
    editor.redo();
    assert.equal(editor.data.components[0].p[0], 7);
    assert.deepEqual(findLevel(editor.targetId).data, editor.data);
  });
  check("quota failure preserves the accepted draft, selected paste and history", () => {
    const editor = editorFor();
    quota = true;
    assert.equal(editor.addBatch([{ t: "crate", p: [4, 1, 0] }]), true);
    assert.equal(editor.data.components[editor.selectedIndex].t, "crate");
    assert.equal(editor.undoStack.length, 1);
    assert.deepEqual(findLevel(editor.targetId).data, editor.data);
    assert.equal(editor.messages.at(-1).title, "SAVE FAILED");
    editor.undo();
    assert.equal(editor.data.components.some(c => c.t === "crate"), false);
    editor.redo();
    assert.equal(editor.data.components.some(c => c.t === "crate"), true);
    assert.deepEqual(findLevel(editor.targetId).data, editor.data);
  });
  check("first built-in fork is rejected atomically at the library count limit", () => {
    const editor = builtinEditor();
    fillLibrary();
    editor.data.components[0].p[0] = 9;
    assert.equal(editor.commit(), false);
    assert.equal(JSON.stringify(editor.data), editor.initialJson);
    assert.equal(editor.targetId, "jungle");
    assert.equal(editor.forkedLevelId, null);
    assert.equal(editor.undoStack.length, 0);
    assert.equal(editor.forkOnFirstCommit, true);
  });
  check("redo at a newly full library preserves its state and can retry after freeing a slot", () => {
    const editor = builtinEditor();
    editor.data.components[0].p[0] = 9;
    assert.equal(editor.commit(), true);
    const fork = editor.targetId;
    editor.undo();
    assert.equal(findLevel(fork), null);
    assert.equal(editor.targetId, "jungle");
    fillLibrary();
    const before = JSON.stringify(editor.data);
    const history = clone([editor.undoStack, editor.redoStack]);
    editor.redo();
    assert.equal(JSON.stringify(editor.data), before);
    assert.deepEqual([editor.undoStack, editor.redoStack], history);
    assert.equal(editor.targetId, "jungle");
    assert.equal(editor.forkedLevelId, null);
    deleteUserLevel("filler_0");
    editor.redo();
    assert.equal(editor.data.components[0].p[0], 9);
    assert.ok(findLevel(editor.targetId)?.data);
    assert.equal(editor.redoStack.length, 0);
    assert.equal(editor.undoStack.length, 1);
  });
  check("data-owned builtin override is also rejected at the library count limit", () => {
    const editor = editorFor(base(), "codex-lab");
    fillLibrary();
    editor.data.components[0].p[0] = 9;
    assert.equal(editor.commit(), false);
    assert.equal(editor.lastCommitted, editor.initialJson);
    assert.equal(JSON.stringify(editor.data), editor.initialJson);
    assert.equal(editor.undoStack.length, 0);
  });
  check("rejected HUD migration restores the selected source component and its handles", () => {
    const editor = editorFor(base([
      { t: "clock", p: [0, 1, 0] },
      { t: "crate", p: [2, 1, 0] },
    ]), "jungle");
    editor.forkOnFirstCommit = true;
    editor.sel = [1]; editor.resizeIdx = 1;
    fillLibrary();
    editor.data.hudMode = "bonus";
    assert.equal(editor.commit(), false);
    assert.deepEqual(editor.sel, [1]);
    assert.equal(editor.data.components[editor.selectedIndex].t, "crate");
    assert.equal(editor.resizeIdx, 1);
  });
  check("total pack capacity refuses edits before history or live data diverge from play", () => {
    const filler = base(Array.from({ length: 5000 }, () => ({ t: "platform", p: [0, 0, 0], nm: "x".repeat(120) })));
    const bytes = new TextEncoder().encode(JSON.stringify({ id: "large_99", name: "Filler", data: filler })).length;
    const entries = Array.from({ length: Math.floor((MAX_LEVEL_PACK_BYTES - 4096) / bytes) }, (_, i) =>
      ({ id: `large_${i}`, name: "Filler", data: filler }));
    assert.equal(setUserLevels(entries), true);
    const editor = editorFor();
    const registryBefore = JSON.stringify(getUserLevels());
    editor.data.components = base(Array.from({ length: 9500 }, () => ({ t: "platform", p: [0, 0, 0], nm: "x".repeat(120) }))).components;
    assert.ok(normalizeCustomLevelData(editor.data), "single level must fit safely");
    assert.equal(editor.commit(), false);
    assert.equal(JSON.stringify(editor.data), editor.initialJson);
    assert.equal(editor.undoStack.length, 0);
    assert.equal(JSON.stringify(getUserLevels()), registryBefore);
    assert.equal(editor.messages.at(-1).title, "LIBRARY LIMIT REACHED");
  });
  check("rejected grouped paste restores selection, node mode, wiring and history", () => {
    const editor = editorFor(base([{ t: "woodpath", p: [0, 0, 0], pts: [[0, 0], [0, -5]], grp: 0 }], [{ id: 0, nm: "Original" }]));
    editor.sel = [0]; editor.resizeIdx = 0; editor.selVtxs = new Set([1]);
    const before = JSON.stringify(editor.data);
    const history = clone([editor.undoStack, editor.redoStack]);
    editor.hooks.preflight = () => false;
    assert.equal(editor.addBatch([{ t: "crate", p: [0, 0, 0], grp: 9 }], true, [{ id: 9, nm: "Pasted" }]), false);
    assert.equal(JSON.stringify(editor.data), before);
    assert.deepEqual(editor.sel, [0]);
    assert.equal(editor.resizeIdx, 0);
    assert.deepEqual([...editor.selVtxs], [1]);
    assert.deepEqual([editor.undoStack, editor.redoStack], history);
  });
  check("a rejected paste does not consume its next successful offset", () => {
    const editor = editorFor();
    editor.sel = [0]; editor.copySelected(); editor.paste();
    const first = clone(editor.data.components[editor.selectedIndex].p);
    editor.hooks.preflight = () => false;
    editor.paste();
    assert.equal(editor.pasteBump, 0);
    editor.hooks.preflight = () => true;
    editor.paste();
    assert.deepEqual(editor.data.components[editor.selectedIndex].p, [first[0] + 2, first[1], first[2] + 2]);
  });
  check("selection admits only existing unlocked integer component indices", () => {
    const editor = editorFor(base([{ t: "crate", p: [0, 0, 0], lk: true }, { t: "crate", p: [2, 0, 0] }]));
    editor.setSelection([-1, NaN, 0, 1, 1, 1.5, 999]);
    assert.deepEqual(editor.sel, [1]);
    editor.sel = [0, 1]; editor.deleteSelected();
    assert.equal(editor.data.components[0].lk, true);
    assert.equal(editor.data.components.filter(c => c.t === "crate").length, 1);
  });
  check("pasting a singleton cannot replace its locked original", () => {
    const editor = editorFor();
    const gate = editor.data.components.find(c => c.t === "gate");
    gate.lk = true; editor.commit();
    const before = JSON.stringify(editor.data);
    assert.equal(editor.addBatch([{ t: "gate", p: [20, 1, 0] }]), false);
    assert.equal(JSON.stringify(editor.data), before);
    assert.equal(editor.messages.at(-1).title, "COMPONENT LOCKED");
  });
  check("grouping unlocked selections does not reparent a locked sibling", () => {
    const editor = editorFor(base([
      { t: "crate", p: [0, 0, 0], grp: 0 },
      { t: "crate", p: [2, 0, 0], grp: 0, lk: true },
      { t: "crate", p: [4, 0, 0] },
    ], [{ id: 0, nm: "Locked assembly" }]));
    editor.sel = [0, 2]; editor.groupSelection();
    assert.equal(editor.data.components[1].grp, 0);
    assert.equal(editor.data.groups.find(g => g.id === 0).parent, undefined);
    assert.notEqual(editor.data.components[0].grp, 0);
    assert.equal(editor.data.components[0].grp, editor.data.components[2].grp);
  });
  check("ungroup refuses to dissolve wiring belonging to a locked member", () => {
    const editor = editorFor(base([{ t: "crate", p: [0, 0, 0], grp: 0 }, { t: "crate", p: [2, 0, 0], grp: 0, lk: true }], [{ id: 0 }]));
    const before = JSON.stringify(editor.data);
    editor.sel = [0]; editor.ungroupSelection();
    assert.equal(JSON.stringify(editor.data), before);
    assert.equal(editor.messages.at(-1).title, "GROUP LOCKED");
  });
  check("retarget cancels old gestures while their original identity is still active", () => {
    const editor = editorFor();
    const oldId = editor.targetId;
    const next = saveUserLevel({ id: "", name: "Incoming", data: base() });
    editor.cancelScrub = () => {
      assert.equal(editor.targetId, oldId);
      assert.equal(editor.targetName, "Transaction test");
      editor.data.components[0].p[0] = 0;
      editor.cancelScrub = null;
    };
    editor.moveDrag = { orig: [{ idx: 0, p: [0, 0, 0] }] };
    editor.data.components[0].p[0] = 50;
    editor.retarget(next);
    assert.equal(editor.targetId, next);
    assert.deepEqual(editor.data, findLevel(next).data);
    assert.equal(editor.moveDrag, null);
    assert.equal(editor.undoStack.length, 0);
    assert.equal(editor.redoStack.length, 0);
  });
  check("undo cancels a pending move before traversing committed history", () => {
    const editor = editorFor();
    editor.data.components[0].p[0] = 7; editor.commit();
    editor.moveDrag = { orig: [{ idx: 0, p: [7, 0, 0] }] };
    editor.data.components[0].p[0] = 50;
    editor.undo();
    assert.equal(editor.data.components[0].p[0], 0);
    editor.redo();
    assert.equal(editor.data.components[0].p[0], 7);
  });
} finally {
  await server.close();
}
console.log(`${checks - failures}/${checks} editor transaction regressions passed`);
if (failures) process.exitCode = 1;
