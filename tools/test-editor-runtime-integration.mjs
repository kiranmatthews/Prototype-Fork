import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import * as THREE from "three";

// Exercise the real editor host transitions with constructed Levels. Renderer,
// player and UI endpoints only record effects; the transition policy is source.
const harness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(harness.slice(harness.indexOf("function installHeadlessDom()"),
  harness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
const source = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("main.ts", source, ts.ScriptTarget.Latest, true);
const fn = name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(node, `missing production ${name}`);
  return node.getText(ast);
};
const editorDeclaration = ast.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => node.name.getText(ast) === "editor");
assert.ok(editorDeclaration && ts.isNewExpression(editorDeclaration.initializer));
const editorHooks = editorDeclaration.initializer.arguments[4];
const code = ts.transpileModule([...["rebuildLevel", "closeEditorToPlay", "syncCompetitionLevel", "setEditorView", "updateSceneryForCurrentView"].map(fn),
  `globalThis.editorHooks = ${editorHooks.getText(ast)};`].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true, hmr: false, ws: false } });
let checks = 0;
try {
  const api = await server.ssrLoadModule("/src/level.ts");
  const { isCompetitionLevel, competitionCourse } = await server.ssrLoadModule("/src/competition/courses.ts");
  const { JungleCupEvent } = await server.ssrLoadModule("/src/competition/event.ts");
  const contexts = [];
  const entry = id => ({ id, name: `Editor ${id}`, data: {
    v: 1, name: `Editor ${id}`, spawn: [0, 1.1, 0], killY: -30,
    components: [{ t: "platform", p: [0, 0, -6], s: [20, 2, 40] }, { t: "gate", p: [0, 1, -20] }],
  } });
  const environment = (from, to = from) => {
    const original = entry(from), target = entry(to), scene = new THREE.Scene();
    api.setEditorBuild(false);
    const level = new api.Level(scene, original), events = [];
    const mark = name => (...args) => events.push([name, ...args]);
    const context = {
      THREE, scene, level, current: target, loadedLevelId: from,
      camera: new THREE.PerspectiveCamera(60, 1, 0.1, 12000), camera2: new THREE.PerspectiveCamera(),
      editorViewActive: true, editorPlayFog: new THREE.Fog(0x777777, 50, 180), syncSkyBackdropVisibility() {},
      localStorage, findLevel: id => id === target.id ? target : original,
      editorPreviewLevel: null, editorSavedAcc: 9, editorSavedMessage: { title: "Retained message" }, acc: 0,
      replayer: { active: false }, restoreReplayRunRule() {},
      worldMapController: { deactivate: mark("map.deactivate") }, worldMapUI: { hide: mark("map.hide") },
      player: { pos: new THREE.Vector3(), hubMode: false, competitionMode: isCompetitionLevel(from),
        fruitCollectionRevision: 0, enterLevel: mark("player.enter"),
        respawn(candidate) { this.pos.copy(candidate.spawnPos); mark("player.respawn")(this.competitionMode); } },
      p2: null, split2p: false, input: { inventoryHeld: false },
      ui: { setLevel: mark("ui.level"), setHUD: mark("ui.hud"), restoreMessage: mark("message.restore"),
        refreshLevels: mark("ui.refresh") },
      competitionUI: { render: mark("competition.render") }, isCompetitionLevel, competitionCourse, JungleCupEvent,
      competition: isCompetitionLevel(from) ? new JungleCupEvent(() => 0.5, () => {}, competitionCourse(from)) : null,
      set2P(value) { context.split2p = value; }, sfx: { countdownBeep() {} },
      puffs: { clear() {}, attach() {} }, swirls: { clear() {} }, fieldSwirls: { clear() {} },
      gameFlow: { blocksGameplay: false, setWarpRoom: mark("flow.warp") },
      campaign: { recommendedMapLevelKey: () => "flats" },
      adoptCommittedCampaignProgress: mark("campaign.adopt"), applyRunModes: mark("modes"),
      applyTheme: mark("theme"), applyShadowFlags: mark("shadows"), currentHudState: () => ({}),
      recorder: { start: mark("record.start") }, endlessDeathsOn: false, window: { __game: { level } }, events,
    };
    context.editor = { active: true, changedThisSession: true, targetId: to,
      workingEntry: () => context.editor.active ? target : null, onLevelRebuilt: mark("editor.rebuilt"),
      exit() { this.active = false; api.setEditorBuild(false); } };
    context.tryBuildEditorLevel = candidate => new api.Level(scene, candidate, context.level);
    context.rebuildEditorPreview = mark("editor.preview");
    runInNewContext(code, context); contexts.push(context);
    return context;
  };

  const copiedCup = environment("jungle-cup", "editor-cup-copy");
  assert.equal(copiedCup.closeEditorToPlay(), false);
  assert.equal(copiedCup.current.id, "editor-cup-copy");
  assert.equal(copiedCup.competition, null, "a copied course retained the old Cup event and blocked ordinary play");
  assert.equal(copiedCup.player.competitionMode, false, "the copied course retained competition movement rules");
  assert.equal(copiedCup.events.find(event => event[0] === "player.respawn")[1], false);
  assert.equal(copiedCup.events.at(-1)[0], "competition.render"); checks++;

  const editedCup = environment("jungle-cup"), previousEvent = editedCup.competition;
  editedCup.rebuildLevel();
  assert.equal(editedCup.competition, null, "a committed editor preview retained the live competition event");
  assert.equal(editedCup.player.competitionMode, false);
  editedCup.closeEditorToPlay();
  assert.ok(editedCup.competition instanceof JungleCupEvent);
  assert.notEqual(editedCup.competition, previousEvent, "TEST reused an event whose rider/course had been reset");
  assert.equal(editedCup.player.competitionMode, true);
  assert.ok(editedCup.events.some(event => event[0] === "ui.level" && event[2] === "competition")); checks++;

  const noOpCup = environment("jungle-cup"), retainedLevel = noOpCup.level, retainedEvent = noOpCup.competition;
  noOpCup.editor.changedThisSession = false;
  noOpCup.editorPreviewLevel = new api.Level(noOpCup.scene, noOpCup.current, noOpCup.level);
  assert.equal(noOpCup.closeEditorToPlay(), true);
  assert.equal(noOpCup.level, retainedLevel); assert.equal(noOpCup.competition, retainedEvent);
  assert.equal(noOpCup.acc, 9);
  assert.equal(noOpCup.events.some(event => event[0] === "player.respawn"), false); checks++;

  const quota = environment("editor-quota");
  quota.localStorage = { setItem() { throw new Error("QuotaExceededError"); } };
  assert.doesNotThrow(() => quota.closeEditorToPlay(), "session-only geometry could not finish rebuilding after storage refusal");
  assert.equal(quota.window.__game.level, quota.level);
  assert.ok(quota.events.some(event => event[0] === "player.respawn"));
  assert.ok(quota.events.some(event => event[0] === "record.start"));
  assert.ok(quota.events.some(event => event[0] === "editor.rebuilt")); checks++;

  const retargetQuota = environment("jungle-cup", "editor-session-copy");
  retargetQuota.current = entry("jungle-cup");
  retargetQuota.localStorage = { setItem() { throw new Error("QuotaExceededError"); } };
  assert.doesNotThrow(() => retargetQuota.editorHooks.levelsChanged("editor-session-copy"),
    "a session-only duplicate/import could not finish retargeting after storage refusal");
  assert.equal(retargetQuota.current.id, "editor-session-copy");
  assert.ok(retargetQuota.events.some(event => event[0] === "editor.preview"));
  assert.ok(retargetQuota.events.some(event => event[0] === "ui.refresh")); checks++;

  const scenery = environment("editor-scenery"), streamedViews = [], proxyViews = [];
  scenery.split2p = true;
  scenery.level.updateSceneryView = (...args) => streamedViews.push(args);
  scenery.editorPreviewLevel = { updateSceneryView: (...args) => proxyViews.push(args) };
  scenery.camera.position.set(300, 40, -650);
  scenery.updateSceneryForCurrentView();
  assert.deepEqual(streamedViews.at(-1), [scenery.camera, undefined, true],
    "the retained world did not follow the clear full-canvas editor lens");
  assert.deepEqual(proxyViews.at(-1), [scenery.camera, undefined, true],
    "the working preview did not receive the editor view");
  scenery.editor.active = false;
  scenery.camera.far = 300;
  scenery.setEditorView(false, false);
  assert.deepEqual(streamedViews.at(-1), [scenery.camera, scenery.camera2],
    "leaving the editor did not restore the retained split-screen streaming view");
  scenery.updateSceneryForCurrentView();
  assert.deepEqual(streamedViews.at(-1), [scenery.camera, scenery.camera2, false]);
  assert.equal(proxyViews.length, 1, "gameplay updated an inactive editor proxy"); checks++;

  const assetViews = [], streamed = { keepPlayFog: true, theme: { fogFar: 180 },
    jungleAssets: { setView: (...args) => assetViews.push(args) } };
  scenery.camera.far = 12000;
  api.Level.prototype.updateSceneryView.call(streamed, scenery.camera, scenery.camera2);
  assert.equal(assetViews.at(-1)[1], 180, "play no longer used its authored scenery distance");
  api.Level.prototype.updateSceneryView.call(streamed, scenery.camera, undefined, true);
  assert.equal(assetViews.at(-1)[1], 12000, "the clear editor lens still culled scenery at play fog distance"); checks++;

  for (const context of contexts) context.level.dispose();
  api.setEditorBuild(false);
  console.log(`Editor runtime integration: ${checks} competition, no-op, storage-refusal and scenery-view transitions passed.`);
} finally { await server.close(); }
