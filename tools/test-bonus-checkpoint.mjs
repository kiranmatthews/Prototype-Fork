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
      endlessDeathsOn: false, currentRunBonusBoxes: 0, bonusSession: null,
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
