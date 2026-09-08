import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import * as THREE from "three";

const harness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(harness.slice(harness.indexOf("function installHeadlessDom()"),
  harness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
const source = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("main.ts", source, ts.ScriptTarget.Latest, true);
const fn = name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(node, `missing production ${name}`); return node.getText(ast);
};
const selection = ast.statements.find(node => ts.isExpressionStatement(node) &&
  ts.isBinaryExpression(node.expression) && node.expression.left.getText(ast) === "ui.onLevelSelect");
assert.ok(selection);
const restore = ast.statements.find(node => ts.isExpressionStatement(node) &&
  ts.isBinaryExpression(node.expression) && node.expression.left.getText(ast) === "ui.onForceResync");
assert.ok(restore);
const code = ts.transpileModule([fn("switchLevel"), fn("discardSuspendedBonus"),
  selection.getText(ast), restore.getText(ast)].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true, hmr: false, ws: false } });
let checks = 0;
try {
  const api = await server.ssrLoadModule("/src/level.ts");
  const { puffs } = await server.ssrLoadModule("/src/puffs.ts");
  const { swirls } = await server.ssrLoadModule("/src/swirls.ts");
  const { fieldSwirls } = await server.ssrLoadModule("/src/swirlfield.ts");
  const { Level } = api;
  const data = components => ({ v: 1, name: "Switch regression", spawn: [0, 8.1, 0], killY: -30,
    components: [...components, { t: "gate", p: [0, 8, -15] }] });
  const regular = { id: "switch-old", name: "Old level", data: data([
    { t: "terrain", p: [0, 0, 0], pts: [[0, 0], [0, -120]], berms: false },
  ]) };
  const next = { id: "switch-next", name: "Next level", data: data([
    { t: "platform", p: [0, 1, 0], s: [20, 1, 20] },
  ]) };
  // 1,999,680 static triangle candidates fit the import contract. Actual
  // object dispatch work pushes the 480th ray past the exact 2m build guard.
  const refused = { id: "switch-refused", name: "Accepted but too costly", data: data([
    { t: "mesh", p: [0, 0, 0], edgeGrinding: false,
      vertices: [-100, 0, 50, 100, 0, 50, 0, 0, -1200],
      indices: Array.from({ length: 3998 * 3 }, (_, i) => i % 3) },
    { t: "woodpath", p: [0, 8, 0], pts: [[0, 0], [0, -1075.5]],
      supports: true, terrainSupports: true, rails: false },
  ]) };
  assert.ok(api.normalizeCustomLevelData(refused.data), "fixture must pass the actual public schema");
  const library = new Map([regular, next, refused, ...api.BUILTIN_LEVELS].map(entry => [entry.id, entry]));
  const environments = [];
  const environment = (entry = regular) => {
    puffs.clear(); swirls.clear(); fieldSwirls.clear(); api.setEditorBuild(false);
    const scene = new THREE.Scene(), level = new Level(scene, entry);
    const events = [], messages = [];
    const mark = name => (...args) => { events.push([name, ...args]); };
    const context = {
      THREE, Error, Level, scene, level, current: entry, loadedLevelId: entry.id,
      DEFAULT_LEVEL_ID: regular.id, currentRunBonusBoxes: 7,
      localStorage, findLevel: id => library.get(id),
      campaignLevelById: id => id === "missing-alias" ? { fallbackLevelId: next.id } : undefined,
      setEditorBuild: api.setEditorBuild, bonusSession: null,
      resultsPresentation: { retained: true },
      clearResultsPresentation() { context.resultsPresentation = null; mark("results.clear")(); },
      replayer: { active: true, end() { this.active = false; mark("replay.end")(); } },
      restoreReplayRunRule: mark("replay.restore"),
      editor: { active: true, exit() { this.active = false; api.setEditorBuild(false); mark("editor.exit")(); },
        onLevelRebuilt: mark("editor.rebuilt") },
      editorPreviewLevel: null, editorSavedAcc: 9, editorSavedMessage: { title: "Saved" },
      worldMapController: { active: true, deactivate() { this.active = false; mark("map.deactivate")(); },
        activate: mark("map.activate"), selectedKey: "flats" },
      worldMapUI: { visible: true, hide() { this.visible = false; mark("map.hide")(); }, show: mark("map.show") },
      puffs, swirls, fieldSwirls,
      player: { lives: 5, fruit: 12, bonusMode: true, hubMode: false, bonusCrates: 3,
        pos: new THREE.Vector3(1, 2, 3), fruitCollectionRevision: 6,
        enterLevel: mark("player.enter"),
        respawn(candidate, hard, inventory) { this.pos.copy(candidate.spawnPos); mark("player.respawn")(candidate, hard, inventory); },
        bankFlyingFruit() { this.fruit += 3; mark("fruit.bank")(); } },
      p2: null, split2p: false, input: { inventoryHeld: false },
      ui: { showMessage: (...args) => messages.push(args), hideMessage: mark("message.hide"),
        setReplayBadge: mark("replay.badge"), setLevel: mark("ui.level"), setHUD: mark("ui.hud"),
        setSyncStatus: mark("sync.status"), refreshLevels: mark("ui.refresh"), refreshEditControls() {} },
      campaign: { active: false, startEphemeral() { this.active = true; mark("campaign.ephemeral")(); },
        recommendedMapLevelKey: () => "flats" },
      gameFlow: { hidden: false, setWarpRoom: mark("flow.warp"),
        transition(action) { context.transition = Promise.resolve().then(action); return context.transition; },
        hide() { this.hidden = true; mark("flow.hide")(); } },
      recorder: { start: mark("record.start") }, window: { __game: { level } },
      endlessDeathsOn: false, syncCampaignPortalProgress: mark("campaign.portals"),
      adoptCommittedCampaignProgress: mark("campaign.adopt"), applyRunModes: mark("modes"),
      applyTheme: mark("theme"), applyShadowFlags: mark("shadows"), currentHudState: () => ({}),
      applyEndlessDeaths: mark("endless"),
      guardGameplayFromMenu: mark("menu.guard"), paused: true, pendingCompletion: { kind: "normal" },
      restoreCommittedRunRewards: mark("rewards.restore"), shellBypass: false,
      prepareActivePresentationAssets: async () => mark("assets.prepare")(),
      events, messages,
    };
    puffs.attach(scene); swirls.attach(scene); fieldSwirls.attach(scene);
    api.setEditorBuild(true);
    localStorage.setItem("solProtoLevelId", entry.id);
    runInNewContext(code, context);
    environments.push(context);
    return context;
  };
  const markEffects = context => {
    puffs.spawn("dustLand", 0, 1, 0);
    const swirl = swirls.spawn("warpPortal", 0, 2, 0);
    const field = fieldSwirls.spawn("vortex", 0, 3, 0);
    return { puffCount: puffs.liveCount, swirl, field };
  };
  const assertRetained = (context, old, roots, effects) => {
    assert.equal(context.level, old); assert.equal(context.current, regular);
    assert.equal(context.loadedLevelId, regular.id);
    assert.equal(localStorage.getItem("solProtoLevelId"), regular.id);
    assert.deepEqual(context.scene.children, roots, "failed construction changed the retained scene");
    assert.equal(context.window.__game.level, old);
    assert.equal(context.editor.active, true); assert.equal(context.editorSavedAcc, 9);
    assert.equal(context.replayer.active, true); assert.equal(context.worldMapController.active, true);
    assert.equal(context.worldMapUI.visible, true); assert.ok(context.resultsPresentation);
    assert.deepEqual(context.player.pos.toArray(), [1, 2, 3]);
    assert.equal(context.player.fruit, 12); assert.equal(context.player.lives, 5);
    assert.equal(context.paused, true); assert.ok(context.pendingCompletion);
    assert.equal(context.campaign.active, false); assert.equal(context.gameFlow.hidden, false);
    assert.equal(puffs.liveCount, effects.puffCount);
    assert.equal(swirls.count, 1); assert.equal(fieldSwirls.count, 1);
    assert.equal(effects.swirl.group.parent, context.scene); assert.equal(effects.field.group.parent, context.scene);
    assert.match(context.messages.at(-1)[0], /LEVEL LOAD FAILED/);
    assert.match(context.messages.at(-1)[1], /triangle-work limit/);
    assert.equal(api.setEditorBuild(true), false, "failed switch changed the editor build mode");
  };

  const direct = environment(), old = direct.level, effects = markEffects(direct);
  const roots = [...direct.scene.children];
  assert.equal(direct.switchLevel(refused.id), false);
  assertRetained(direct, old, roots, effects); assert.equal(direct.events.length, 0); checks++;

  // Exercise the complete production menu callback, not a copy of its logic.
  direct.ui.onLevelSelect(refused.id); await direct.transition;
  assertRetained(direct, old, roots, effects);
  assert.deepEqual(direct.events.map(event => event[0]), ["menu.guard"]); checks++;

  // A failed candidate may borrow a non-global resource owned by the live
  // world. Constructor cleanup must preserve its buffers, tree and material.
  const shared = old.groundMeshes.find(mesh => mesh.geometry.boundsTree);
  const tree = shared.geometry.boundsTree;
  let sharedDisposals = 0;
  shared.geometry.addEventListener("dispose", () => sharedDisposals++);
  shared.material.addEventListener("dispose", () => sharedDisposals++);
  const buildEntry = Level.prototype.buildEntry;
  Level.prototype.buildEntry = function (entry) {
    if (entry.id === "borrowed-failure") {
      this.root.add(new THREE.Mesh(shared.geometry, shared.material));
      throw new RangeError("injected borrowed construction failure");
    }
    return buildEntry.call(this, entry);
  };
  library.set("borrowed-failure", { ...next, id: "borrowed-failure" });
  try { assert.equal(direct.switchLevel("borrowed-failure"), false); }
  finally { Level.prototype.buildEntry = buildEntry; }
  assert.equal(shared.geometry.boundsTree, tree); assert.equal(sharedDisposals, 0);
  assert.deepEqual(direct.scene.children, roots); checks++;

  direct.events.length = 0;
  direct.ui.onLevelSelect(next.id); await direct.transition;
  assert.notEqual(direct.level, old); assert.equal(old.root.parent, null);
  assert.equal(direct.current, next); assert.equal(direct.loadedLevelId, next.id);
  assert.equal(direct.window.__game.level, direct.level);
  assert.equal(localStorage.getItem("solProtoLevelId"), next.id);
  assert.equal(direct.editor.active, false); assert.equal(direct.replayer.active, false);
  assert.equal(direct.paused, false); assert.equal(direct.pendingCompletion, null);
  assert.equal(direct.player.fruit, 15); assert.equal(direct.campaign.active, true);
  assert.equal(direct.gameFlow.hidden, true); assert.equal(direct.resultsPresentation, null);
  assert.equal(api.setEditorBuild(false), false, "gameplay switch left authoring build mode active");
  assert.ok(direct.events.findIndex(event => event[0] === "fruit.bank") <
    direct.events.findIndex(event => event[0] === "player.enter"));
  assert.equal(direct.events.filter(event => event[0] === "player.respawn").length, 1);
  assert.equal(puffs.liveCount, 0); assert.equal(swirls.count, 0); assert.equal(fieldSwirls.count, 0); checks++;

  // Existing preserve-editor, fallback and second-rider transitions retain
  // their successful behavior with exactly one constructed destination.
  direct.editor.active = true; api.setEditorBuild(true);
  assert.equal(direct.switchLevel("missing-alias", true, true), true);
  assert.equal(direct.editor.active, true);
  assert.ok(direct.events.some(event => event[0] === "editor.rebuilt"));
  assert.equal(api.setEditorBuild(true), false); checks++;
  direct.split2p = true;
  direct.p2 = { pos: new THREE.Vector3(), enterLevel() {},
    respawn(level) { this.pos.copy(level.spawnPos); }, snapRenderInterpolation() {} };
  assert.equal(direct.switchLevel("missing-level"), true);
  assert.equal(direct.current, regular); assert.equal(direct.p2.pos.x, direct.level.spawnPos.x + 1.6); checks++;

  // Storage refusal affects persistence only; the accepted switch must finish.
  const storage = direct.localStorage;
  direct.localStorage = { setItem() { throw new Error("quota"); } };
  assert.equal(direct.switchLevel(next.id), true);
  assert.equal(direct.level.root.parent, direct.scene); assert.equal(direct.current, next);
  direct.localStorage = storage; checks++;

  // Genuine native VFX: warp-pad rings/plume are Level-owned, and torches
  // emit global smoke on update, not during construction. Clearing old global
  // transients after candidate construction must leave both working.
  direct.split2p = false;
  assert.equal(direct.switchLevel("dark"), true);
  const night = direct.level;
  assert.ok(night.warpPads.length > 0 && night.torches.length > 0);
  const pad = night.warpPads[0], meshes = [];
  pad.group.traverse(object => { if (object.isMesh) meshes.push(object); });
  const transforms = meshes.map(mesh => [...mesh.position, ...mesh.scale]);
  pad.update(0.37);
  assert.ok(meshes.some((mesh, index) => JSON.stringify([...mesh.position, ...mesh.scale]) !== JSON.stringify(transforms[index])));
  assert.ok(meshes.every(mesh => mesh.parent && mesh.geometry.attributes.position.count > 0));
  const torch = night.torches[0]; torch.burn = 1; torch.smokeT = 0;
  night.playerPos.copy(torch.lightAt); night.smokeTorches(0.2);
  assert.ok(puffs.liveCount > 0, "new native torch stopped producing smoke after the switch"); checks++;

  const bonusEntry = { ...next, id: "bonus:switch-old", name: "Suspended bonus" };
  const bonus = environment(bonusEntry);
  const parent = new Level(bonus.scene, regular);
  parent.setActive(false);
  const bonusSession = { parentLevel: parent, parentEntry: regular,
    parentState: { lives: 8, fruit: 37 }, returnPoint: new THREE.Vector3(), parentFruit: [] };
  bonus.bonusSession = bonusSession;
  const activeBonus = bonus.level, bonusRoots = [...bonus.scene.children];
  bonus.ui.onLevelSelect(refused.id); await bonus.transition;
  assert.equal(bonus.bonusSession, bonusSession); assert.equal(bonus.level, activeBonus);
  assert.equal(bonus.current, bonusEntry); assert.equal(bonus.loadedLevelId, bonusEntry.id);
  assert.equal(parent.root.visible, false); assert.equal(bonus.player.bonusMode, true);
  assert.equal(bonus.player.lives, 5); assert.equal(bonus.player.fruit, 12);
  assert.deepEqual(bonus.scene.children, bonusRoots);
  bonus.ui.onLevelSelect(next.id); await bonus.transition;
  assert.equal(bonus.bonusSession, null); assert.equal(bonus.current, next);
  assert.equal(bonus.player.lives, 8); assert.equal(bonus.player.fruit, 37);
  assert.equal(parent.root.parent, null); assert.equal(activeBonus.root.parent, null);
  assert.equal(bonus.level.root.parent, bonus.scene); checks++;

  // The real remote-library restore handler must not close an editor or
  // respawn its old world after the accepted replacement fails to construct.
  const remote = environment(), remoteOld = remote.level;
  const remoteEntry = { ...refused, id: regular.id };
  remote.fetchRemoteLevels = async () => ({ v: 2, levels: [remoteEntry] });
  remote.getUserLevels = api.getUserLevels;
  remote.setUserLevels = entries => {
    if (!api.setUserLevels(entries)) return false;
    for (const entry of api.getUserLevels()) library.set(entry.id, entry);
    return true;
  };
  const remoteRoots = [...remote.scene.children];
  await remote.ui.onForceResync();
  assert.equal(remote.level, remoteOld); assert.equal(remote.current, regular);
  assert.equal(remote.editor.active, true); assert.equal(remote.paused, true);
  assert.deepEqual(remote.scene.children, remoteRoots);
  assert.equal(remote.events.some(event => event[0] === "player.respawn"), false);
  assert.ok(remote.events.some(event => event[0] === "sync.status" && /previous run retained/.test(event[1])));
  assert.equal(api.getUserLevels()[0].name, remoteEntry.name, "requested library restoration was lost");
  library.set(regular.id, regular); checks++;

  for (const context of environments) context.level.dispose();
  puffs.clear(); swirls.clear(); fieldSwirls.clear(); api.setEditorBuild(false);
  console.log(`Level switching: ${checks} actual handler, rejected-build, resource, menu, success and native VFX checks passed.`);
} finally { await server.close(); }
