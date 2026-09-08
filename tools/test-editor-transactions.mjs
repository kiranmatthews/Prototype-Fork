import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
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
let storageWrites = 0;
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem(key, value) {
    storageWrites++;
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
    migrateCustomLevel, normalizeCustomLevelData, borrowedValidatedLevelData, findLevel, saveUserLevel,
    setUserLevels, getUserLevels, getEditData, normalizeUserLevelEntries, renameUserLevel, deleteUserLevel,
    prepareUserLevelChange, commitPreparedUserLevelChange, persistEditData, MAX_USER_LEVELS, MAX_LEVEL_PACK_BYTES,
  } = await server.ssrLoadModule("/src/level.ts");
  const base = (components = [{ t: "platform", p: [0, 0, 0], s: [8, 1, 8] }], groups = []) =>
    migrateCustomLevel({ v: 1, name: "Transaction test", spawn: [0, 1, 0], killY: -30, components, groups });
  const editorFor = (data = base(), id = saveUserLevel({ id: "", name: data.name, data })) => {
    const editor = Object.create(Editor.prototype);
    Object.assign(editor, {
      active: true, data: clone(data), sel: [], selVtxs: new Set(), resizeIdx: -1,
      targetId: id, targetName: findLevel(id)?.name ?? data.name,
      initialTargetId: id, initialTargetName: findLevel(id)?.name ?? data.name,
      initialJson: JSON.stringify(data), lastCommitted: JSON.stringify(data),
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
      preflight: prepared => !!(borrowedValidatedLevelData(prepared?.data ?? editor.data) ?? normalizeCustomLevelData(editor.data)),
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
  const mainText = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
  const parsedMain = ts.createSourceFile("main.ts", mainText, ts.ScriptTarget.Latest, true);
  const preflightNode = parsedMain.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "preflightEditorWorking");
  assert.ok(preflightNode);
  const preflightCode = ts.transpileModule(preflightNode.getText(parsedMain), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const { requiresTerrainSupportBuildCheck } = await server.ssrLoadModule("/src/terrainSupportBudget.ts");
  check("exact support-build rejection happens before registry or history changes", () => {
    const editor = editorFor(base([
      {t:"platform", p:[0,0,0], s:[20,1,40]},
      {t:"woodpath", p:[0,4,0], pts:[[0,0],[0,-12]], terrainSupports:true, supports:true},
    ]));
    let allow = false, calls = 0, disposed = 0;
    const retained = {};
    const preflight = new Function("editor", "normalizeCustomLevelData", "borrowedValidatedLevelData", "requiresTerrainSupportBuildCheck",
      "tryBuildEditorLevel", "THREE", "editorPreviewLevel", "level", `${preflightCode}; return preflightEditorWorking;`)(
      editor, normalizeCustomLevelData, borrowedValidatedLevelData, requiresTerrainSupportBuildCheck,
      (_entry, context, scene) => { calls++; assert.match(context,/support/); assert.ok(scene instanceof THREE.Scene);
        return allow ? {dispose(keep){assert.equal(keep,retained);disposed++;}} : null; }, THREE, retained, {});
    editor.hooks.preflight = preflight;
    const before = JSON.stringify(editor.data), registry = JSON.stringify(getUserLevels());
    editor.data.components[1].w = 8;
    assert.equal(editor.commit(), false); assert.equal(calls,1);
    assert.equal(JSON.stringify(editor.data),before); assert.equal(JSON.stringify(getUserLevels()),registry);
    assert.equal(editor.undoStack.length,0); assert.equal(editor.redoStack.length,0);
    allow = true; editor.data.components[1].w = 8;
    assert.equal(editor.commit(),true); assert.equal(calls,2); assert.equal(disposed,1);
    assert.equal(findLevel(editor.targetId).data.components[1].w,8);
    assert.equal(editor.undoStack.length,1);
  });
  check("prepared transactions isolate a canonical snapshot and reject forged identities", () => {
    const draft = base(), prepared = prepareUserLevelChange({ id: "prepared", name: draft.name, data: draft });
    assert.ok(prepared && Object.isFrozen(prepared) && Object.isFrozen(prepared.entry.data));
    assert.equal(borrowedValidatedLevelData(prepared.entry.data), prepared.entry.data);
    assert.equal(borrowedValidatedLevelData(Object.freeze(clone(prepared.entry.data))), null);
    draft.components[0].p[0] = 17;
    assert.equal(prepared.entry.data.components[0].p[0], 0);
    assert.deepEqual(commitPreparedUserLevelChange(Object.freeze({ ...prepared })), { accepted: false, persisted: false });
    assert.deepEqual(commitPreparedUserLevelChange(prepared), { accepted: true, persisted: true });
    assert.equal(findLevel("prepared").data.components[0].p[0], 0);
    const editable = normalizeCustomLevelData(prepared.entry.data); editable.components[0].p[0] = 9;
    assert.equal(borrowedValidatedLevelData(editable), null);
    let invoked = false;
    const hostile = { id: "bad", name: "Bad", get data() { invoked = true; return draft; } };
    assert.equal(prepareUserLevelChange(hostile), null);
    assert.equal(invoked, false);
    for (const id of [null, undefined, false, 0, "__proto__"])
      assert.equal(prepareUserLevelChange({ id, name: "Bad", data: draft }), null);
  });
  check("prepared commits recheck target identity and live library capacity", () => {
    const editor = editorFor(), draft = clone(editor.data); draft.components[0].p[0] = 5;
    const prepared = prepareUserLevelChange({ id: editor.targetId, name: draft.name, data: draft });
    const newer = clone(editor.data); newer.components[0].p[0] = 9;
    saveUserLevel({ id: editor.targetId, name: newer.name, data: newer });
    assert.deepEqual(commitPreparedUserLevelChange(prepared), { accepted: false, persisted: false });
    assert.equal(findLevel(editor.targetId).data.components[0].p[0], 9);
    const addition = prepareUserLevelChange({ id: "new_after_prepare", name: "New", data: base() });
    fillLibrary();
    const snapshot = JSON.stringify(getUserLevels());
    assert.deepEqual(commitPreparedUserLevelChange(addition), { accepted: false, persisted: false });
    assert.equal(JSON.stringify(getUserLevels()), snapshot);
  });
  check("exact preflight sees owned canonical data before persistence and cannot reuse stale drafts", () => {
    const editor = editorFor(), seen = [];
    editor.hooks.preflight = prepared => {
      assert.ok(prepared && borrowedValidatedLevelData(prepared.data));
      assert.equal(findLevel(editor.targetId).data.components[0].p[0], 0, "preflight ran after persistence");
      seen.push(prepared.data.components[0].p[0]);
      if (seen.length === 1) editor.data.components[0].p[0] = 19;
      return true;
    };
    editor.data.components[0].p[0] = 7;
    assert.equal(editor.commit(false), true);
    assert.deepEqual(seen, [7, 19], "changed working data reused stale validation");
    assert.equal(findLevel(editor.targetId).data.components[0].p[0], 19);
    const before = JSON.stringify(getUserLevels()), history = clone(editor.undoStack);
    editor.hooks.preflight = () => false;
    editor.data.components[0].p[0] = 20;
    assert.equal(editor.commit(false), false);
    assert.equal(JSON.stringify(getUserLevels()), before);
    assert.deepEqual(editor.undoStack, history);
    assert.equal(editor.data.components[0].p[0], 19);
  });
  check("prepared quota failure accepts an exportable session snapshot", () => {
    const prepared = prepareUserLevelChange({ id: "session_prepared", name: "Session", data: base() });
    quota = true;
    assert.deepEqual(commitPreparedUserLevelChange(prepared), { accepted: true, persisted: false });
    assert.equal(findLevel("session_prepared").data, prepared.entry.data);
    assert.ok(JSON.stringify(findLevel("session_prepared").data));
  });
  check("save/copy names match exported names without changing legacy repair ordering", () => {
    const old = { ...base([{ t: "enemy", foe: "grunt", p: [0, -252, 4] }]), name: "Test Course" };
    const id = saveUserLevel({ id: "copy_name", name: "Test Course copy", data: old });
    const saved = findLevel(id);
    assert.equal(saved.name, "Test Course copy"); assert.equal(saved.data.name, saved.name);
    assert.deepEqual(saved.data.components.find(c=>c.t==='enemy').p, [0,-8.69,-252]);
    const renamed = prepareUserLevelChange({ id: "renamed_legacy", name: "Test Course", data: { ...old, name: "Other name" } });
    assert.deepEqual(renamed.entry.data.components.find(c=>c.t==='enemy').p, [0,-8.69,-252]);
    renameUserLevel(id, "  A   renamed   copy  ");
    assert.equal(findLevel(id).name, "A renamed copy"); assert.equal(findLevel(id).data.name, "A renamed copy");
    assert.equal(old.name, "Test Course", "copy mutated its source");
    assert.equal(setUserLevels([{ id: "legacy_title", name: "Menu title", data: { ...base(), name: "Export title" } }]), true);
    const prior = findLevel("legacy_title"), writes = storageWrites;
    assert.equal(persistEditData("legacy_title", JSON.stringify(prior.data)), true);
    assert.equal(findLevel("legacy_title"), prior, "no-op autosave rewrote old menu/data title semantics");
    assert.equal(storageWrites, writes);
  });
  check("geometry edits preserve legacy menu titles and align the real saved export", () => {
    const data = { ...base(), name: "Legacy export title" };
    assert.equal(setUserLevels([{ id: "legacy_geometry", name: "Menu course title", data }]), true);
    const editor = editorFor(data, "legacy_geometry");
    editor.data.components[0].p[0] = 7;
    assert.equal(editor.commit(false), true);
    assert.equal(findLevel(editor.targetId).name, "Menu course title");
    assert.equal(findLevel(editor.targetId).data.name, "Menu course title");
    assert.equal(editor.data.name, "Menu course title");
    editor.undo();
    assert.equal(findLevel(editor.targetId).name, "Menu course title", "undo renamed the legacy menu row");
    assert.equal(editor.data.components[0].p[0], 0);
    editor.redo();
    assert.equal(findLevel(editor.targetId).name, "Menu course title");
    editor.data.name = "Explicit new name";
    assert.equal(editor.commit(false), true);
    assert.equal(findLevel(editor.targetId).name, "Explicit new name");
    editor.data.components[0].s = [-1, 1, 1];
    assert.equal(editor.commit(false), false);
    assert.equal(editor.messages.at(-1).title, "CHANGE REJECTED", "invalid geometry was mislabeled as a library limit");
  });
  check("registry snapshots isolate caller lists and deeply freeze retained data", () => {
    const input = [{ id: "owned", name: "Owned course", data: base() }];
    assert.equal(setUserLevels(input), true);
    const first = getUserLevels(), second = getUserLevels();
    assert.notEqual(first, second, "caller can mutate the registry array");
    assert.equal(first[0], second[0], "retained entry identity is unstable");
    const frozen = value => {
      if (!value || typeof value !== "object") return;
      assert.ok(Object.isFrozen(value), "registry exposes a mutable nested object");
      Object.values(value).forEach(frozen);
    };
    frozen(first[0]);
    assert.throws(() => { first[0].data.components[0].p[0] = 99; }, TypeError);
    assert.throws(() => { first[0].data.components.push({ t: "crate", p: [0, 0, 0] }); }, TypeError);
    first.length = 0; second.push({ id: "unchecked", name: "Unchecked", data: base() });
    assert.equal(getUserLevels().length, 1);
    assert.equal(storage.get("solProtoUserLevels"), JSON.stringify(getUserLevels()),
      "cached serialization differs from canonical registry JSON");
    input[0].data.components[0].p[0] = 7;
    assert.equal(findLevel("owned").data.components[0].p[0], 0, "registry froze or retained caller-owned data");
    const editable = getEditData("owned");
    editable.components[0].p[0] = 17;
    const normalized = normalizeCustomLevelData(findLevel("owned").data);
    normalized.components[0].p[0] = 27;
    assert.equal(findLevel("owned").data.components[0].p[0], 0, "editable copy aliases the registry");
  });
  check("ordinary edits retain unrelated canonical identities without trusting unknown wrappers", () => {
    const editor = editorFor();
    saveUserLevel({ id: "other", name: "Other course", data: base() });
    const other = findLevel("other"), activeBefore = findLevel(editor.targetId);
    editor.data.components[0].p[0] = 7;
    assert.equal(editor.commit(false), true);
    assert.equal(findLevel("other"), other, "editing one level recopied unrelated entries");
    assert.equal(storage.get("solProtoUserLevels"), JSON.stringify(getUserLevels()),
      "mixed changed/cached entries did not serialize the complete current pack");
    assert.notEqual(findLevel(editor.targetId), activeBefore);
    assert.equal(activeBefore.data.components[0].p[0], 0, "old snapshot changed after replacement");
    assert.equal(normalizeUserLevelEntries([other])[0], other, "owned identity did not take the bounded reuse path");
    const wrapper = { ...other };
    assert.notEqual(normalizeUserLevelEntries([wrapper])[0], wrapper, "caller-owned wrapper skipped isolation");
    assert.equal(normalizeUserLevelEntries([Object.freeze({ ...other, unexpected: true })]), null,
      "arbitrary frozen identity bypassed the format contract");
    let read = false;
    const accessor = { id: "accessor", name: "Unchecked" };
    Object.defineProperty(accessor, "data", { enumerable: true, get() { read = true; return other.data; } });
    assert.equal(normalizeUserLevelEntries([Object.freeze(accessor)]), null);
    assert.equal(read, false, "unknown frozen wrapper executed an accessor");
  });
  check("retained snapshots still obey duplicate/count checks and rejected packs are atomic", () => {
    const editor = editorFor();
    const entry = findLevel(editor.targetId), before = JSON.stringify(getUserLevels());
    assert.equal(setUserLevels([entry, entry]), false);
    assert.equal(setUserLevels(Array.from({ length: MAX_USER_LEVELS + 1 }, () => entry)), false);
    assert.equal(setUserLevels([entry, { id: "bad", name: "Bad", data: { ...base(), killY: NaN } }]), false);
    assert.equal(JSON.stringify(getUserLevels()), before);
    assert.equal(findLevel(editor.targetId), entry);
    deleteUserLevel(editor.targetId);
    assert.equal(findLevel(editor.targetId), null);
    assert.equal(setUserLevels([entry]), true, "a valid retained archive cannot be explicitly restored");
    assert.equal(findLevel(editor.targetId), entry);
  });
  check("history with an unchanged title writes the registry only once", () => {
    const editor = editorFor();
    editor.data.components[0].p[0] = 7;
    assert.equal(editor.commit(false), true);
    let before = storageWrites;
    editor.undo();
    assert.equal(storageWrites - before, 1, "undo redundantly renamed an unchanged title");
    before = storageWrites;
    editor.redo();
    assert.equal(storageWrites - before, 1, "redo redundantly renamed an unchanged title");
    assert.equal(findLevel(editor.targetId).name, editor.targetName);
  });
  check("history still restores a title when the name really changes", () => {
    const editor = editorFor(), originalName = editor.targetName;
    editor.data.name = "Renamed course";
    assert.equal(editor.commit(false), true);
    renameUserLevel(editor.targetId, editor.data.name);
    editor.targetName = editor.data.name;
    editor.undo();
    assert.equal(findLevel(editor.targetId).name, originalName);
    editor.redo();
    assert.equal(findLevel(editor.targetId).name, "Renamed course");
  });
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
    const retainedBefore = getUserLevels();
    assert.ok(retainedBefore.every(Object.isFrozen), "pack-cap regression must cover cached entries");
    const registryBefore = JSON.stringify(retainedBefore);
    editor.data.components = base(Array.from({ length: 9500 }, () => ({ t: "platform", p: [0, 0, 0], nm: "x".repeat(120) }))).components;
    assert.ok(normalizeCustomLevelData(editor.data), "single level must fit safely");
    assert.equal(editor.commit(), false);
    assert.equal(JSON.stringify(editor.data), editor.initialJson);
    assert.equal(editor.undoStack.length, 0);
    assert.equal(JSON.stringify(getUserLevels()), registryBefore);
    assert.equal(editor.messages.at(-1).title, "LIBRARY LIMIT REACHED");
    // Trusted entries can outlive registry replacement. Combining two such
    // snapshots still needs the exact whole-pack byte cap, even with no new
    // entry that would invoke the expensive validation path.
    assert.equal(setUserLevels([{ id: "retained_extra", name: "Extra", data: filler }]), true);
    const replacement = getUserLevels();
    assert.equal(setUserLevels([...retainedBefore, ...replacement]), false,
      "cached archived identities bypassed total pack bytes");
    assert.deepEqual(getUserLevels(), replacement, "rejected cached-only pack replaced live work");
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
