import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'returnFromBonus');
const code = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const noop = () => {};
await withSkateRuntime(async ({ THREE, Level, Player, scene, server }) => {
  const { BUILTIN_LEVELS, normalizeCustomLevelData, normalizeUserLevelEntries } = await server.ssrLoadModule('/src/level.ts');
  const { resolveBonusLevel, bonusCrateCount } = await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
  const published = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  const bonuses = [...BUILTIN_LEVELS, ...published.levels].filter(entry => entry.data?.hudMode === 'bonus');
  assert.ok(bonuses.length > 1, 'audit must cover the bonus library');
  for (const entry of bonuses)
    assert.equal(entry.data.components.some(component => component.t === 'checkpoint'), false, `${entry.id} still authors checkpoint crates`);

  // Old saved/imported rooms must not bring checkpoint geometry, collision,
  // respawn snapshots or an uncollectable box target back into bonus play.
  const legacyBonus = { v: 1, name: 'Legacy bonus checkpoints', hudMode: 'bonus', spawn: [0, .1, 0], killY: -10,
    components: [
      { t: 'platform', p: [0, -.5, -6], s: [16, 1, 24] },
      { t: 'checkpoint', p: [0, 0, -4] },
      { t: 'checkpoint', p: [0, 0, -8] },
      { t: 'crate', p: [3, 0, -4], kind: 'wood' },
      { t: 'gate', p: [0, 0, -14] },
    ],
  };
  const normalized = normalizeCustomLevelData(legacyBonus);
  assert.ok(normalized);
  assert.deepEqual(normalized.components, legacyBonus.components.filter(component => component.t !== 'checkpoint'));
  assert.deepEqual(normalizeCustomLevelData(normalized), normalized, 'reopening a bonus must be idempotent');
  const saved = normalizeUserLevelEntries([{ id: 'saved-bonus', name: legacyBonus.name, data: legacyBonus }]);
  assert.deepEqual(saved?.[0].data, normalized, 'saved/imported libraries bypassed bonus migration');
  const ordinary = normalizeCustomLevelData({ ...legacyBonus, hudMode: undefined });
  assert.equal(ordinary.components.filter(component => component.t === 'checkpoint').length, 2, 'ordinary checkpoints were removed');
  assert.equal(legacyBonus.components.filter(component => component.t === 'checkpoint').length, 2, 'loading mutated caller-owned source');

  const legacyLevel = new Level(scene, { id: 'saved-bonus', name: legacyBonus.name, data: legacyBonus });
  try {
    assert.equal(legacyLevel.checkpoints.length, 0, 'bonus still builds checkpoint meshes/colliders');
    assert.equal(legacyLevel.totalCrates, 1, 'removed checkpoints inflated the box target');
    assert.equal(legacyLevel.captureData().components.some(component => component.t === 'checkpoint'), false, 'editor capture resurrected a checkpoint');
    const retryPlayer = new Player(scene);
    retryPlayer.respawn(legacyLevel, true, true);
    retryPlayer.pos.set(0, 0, -8);
    legacyLevel.breakCrate(legacyLevel.crates[0]);
    retryPlayer.cratesBroken = 1;
    retryPlayer.respawn(legacyLevel, false, true);
    assert.deepEqual(retryPlayer.pos.toArray(), legacyLevel.spawnPos.toArray(), 'bonus retry resumed inside the room');
    assert.equal(legacyLevel.activeCheckpoint, null);
    assert.equal(retryPlayer.cratesBroken, 0);
    assert.equal(legacyLevel.crates[0].alive, true);
  } finally { legacyLevel.dispose(); }

  const authored = resolveBonusLevel('jungle'), targetBefore = bonusCrateCount('jungle');
  authored.components.push({ t: 'checkpoint', p: [0, 0, 0] });
  try { assert.equal(bonusCrateCount('jungle'), targetBefore, 'parent gem target counted a checkpoint that bonus loading removes'); }
  finally { authored.components.pop(); }
  console.log(`PASS ${bonuses.length} source/published bonus entries, legacy import/capture, checkpoint-free retry and box targets`);

  const { CampaignStore, mergeCompletedBonusInventory } = await server.ssrLoadModule('/src/campaign.ts');
  const campaign = new CampaignStore(); campaign.newGame(1);
  const entry = { id: 'jungle', name: 'Bonus checkpoint fixture', data: {
    v: 1, name: 'Bonus checkpoint fixture', spawn: [0, .1, 0], killY: -10,
    components: [
      { t: 'platform', p: [0, -.5, -20], s: [30, 1, 80] },
      { t: 'checkpoint', p: [0, 0, -4] },
      { t: 'crate', p: [-2, 0, -8], kind: 'wood' },
      { t: 'crate', p: [2, 0, -8], kind: 'multihit' },
      { t: 'crate', p: [-2, 0, -24], kind: 'wood', outline: true },
      { t: 'crate', p: [2, 0, -24], kind: 'bang' },
      { t: 'spinbridge', p: [0, 0, -28], s: [3, .36, 1.2] },
      { t: 'bonusplatform', p: [4, 0, -16], to: [0, .1, -20] },
      { t: 'gate', p: [0, 0, -44] },
    ],
  } };
  const parent = new Level(scene, entry), player = new Player(scene);
  try {
    player.respawn(parent, true, true);
    player.warpCheckpoint(parent, 1);
    const previous = parent.activeCheckpoint, previousSpawn = parent.currentSpawn.clone();
    const wood = parent.crates.find(crate => !crate.multiHit && !crate.bang && !crate.wasOutline);
    const milk = parent.crates.find(crate => crate.multiHit), outline = parent.crates.find(crate => crate.wasOutline);
    const bang = parent.crates.find(crate => crate.bang);
    assert.ok(wood && milk && outline && bang);
    parent.breakCrate(wood); player.cratesBroken = 2;
    milk.hitsRemaining = 3; parent.setCratePending(outline, false); bang.bangUsed = true;
    parent.spinBridges[0].restore(true);
    player.lives = 4; player.fruit = 90; player.masks = 2; player.points = 150;
    const parentState = player.captureRunState(), returnPoint = parent.bonusReturnPoint();
    const total = parent.totalCrates;
    const context = {
      player, level: parent, current: entry, campaign, mergeCompletedBonusInventory,
      endlessDeathsOn: false, currentRunBonusBoxes: 0, bonusSession: null,bonusDeparture:null,clearBonusDeparture:noop,clearBonusArrival:noop,beginBonusArrival:noop,startBonusDeparture:async()=>{},
      puffs: { clear: noop, attach: noop }, scene, input: { inventoryHeld: false },
      applyEndlessDeaths: noop, applyRunModes: noop, applyTheme: noop, applyShadowFlags: noop,
      currentHudState: () => ({}), prepareActivePresentationAssets: async () => {},
      competitionUI: { render: noop }, recorder: { start: noop },
      ui: { setLevel: noop, startBonusPayout: noop, setHUD: noop },
      gameFlow: { blocksGameplay: false, hide: noop,
        transition(action) { context.transition = Promise.resolve().then(action); return context.transition; } },
    };
    runInNewContext(code, context);
    for (const completed of [false, true]) {
      const bonus = new Level(scene, { id: 'bonus:jungle', name: 'Tiny bonus', data: {
        v: 1, name: 'Tiny bonus', spawn: [0, .1, 0], killY: -10, hudMode: 'bonus',
        components: [{ t: 'platform', p: [0, -.5, 0], s: [12, 1, 12] }, { t: 'crate', p: [2, 0, 0] }, { t: 'gate', p: [0, 0, -4] }],
      } });
      context.bonusSession = { parentLevel: parent, parentEntry: entry, parentState,
        returnPoint, parentFruit: [], parentCompetition: null, parentBonusMode: false, parentHubMode: false, parentCompetitionMode: false };
      context.level = bonus;
      player.bonusMode = true; player.lives = 1; player.fruit = 25; player.cratesBroken = 1; player.masks = 1;
      context.returnFromBonus(completed); await context.transition;
      assert.deepEqual(player.pos.toArray(), returnPoint.toArray(), 'ordinary bonus return keeps its authored point on success and failure');
      if (!completed) {
        assert.equal(parent.activeCheckpoint, previous, 'failure overwrites the earlier checkpoint');
        assert.deepEqual(parent.currentSpawn.toArray(), previousSpawn.toArray());
        assert.equal(parent.bonusRoundCompleted, false);
      }
    }
    const banked = parent.activeCheckpoint;
    assert.notEqual(banked, previous);
    assert.deepEqual(parent.currentSpawn.toArray(), returnPoint.toArray());
    assert.equal(parent.totalCrates, total, 'bonus banking invents an extra checkpoint crate');
    assert.equal(campaign.listSlots()[0].lives, 6); assert.equal(campaign.listSlots()[0].fruit, 15);
    assert.equal(campaign.listSlots()[0].levels.jungle.cleared, false, 'bonus clear finishes the parent level');
    for (let death = 0; death < 2; death++) {
      wood.alive = true; milk.hitsRemaining = 1; parent.setCratePending(outline, true); bang.bangUsed = false;
      parent.spinBridges[0].restore(false); player.cratesBroken = 99; player.masks = 0; player.points = 900;
      player.bonusCrates = 1; player.lives = 5 - death; player.fruit = 20 + death;
      player.respawn(parent, false, true);
      assert.equal(parent.activeCheckpoint, banked);
      assert.deepEqual(player.pos.toArray(), returnPoint.toArray());
      assert.equal(wood.alive, false); assert.equal(milk.hitsRemaining, 3);
      assert.equal(outline.pending, false); assert.equal(bang.bangUsed, true);
      assert.equal(parent.spinBridges[0].activated, true);
      assert.equal(player.cratesBroken, 2); assert.equal(player.bonusCrates, 1);
      assert.equal(player.masks, 1); assert.equal(player.points, 150);
      assert.equal(player.lives, 5 - death); assert.equal(player.fruit, 20 + death);
      assert.equal(parent.bonusRoundCompleted, true, 'death reopened an already paid bonus');
    }
    player.respawn(parent, true, true);
    assert.equal(parent.activeCheckpoint, null); assert.equal(parent.bonusRoundCompleted, false);
    assert.equal(player.bonusCrates, 0); assert.deepEqual(player.pos.toArray(), parent.spawnPos.toArray());
    assert.equal(wood.alive, true); assert.equal(parent.spinBridges[0].activated, false);
    console.log('PASS production bonus success/failure, durable inventory, repeated real-Player checkpoint restores, switch/partial-crate/bridge state, exact box tally and fresh-run reset');
  } finally { parent.dispose(); }
});
