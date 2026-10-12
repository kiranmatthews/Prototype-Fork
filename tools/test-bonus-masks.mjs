import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(['enterBonusRound', 'returnFromBonus'].map(name =>
  ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast),
).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const noop = () => {};
const entry = { id: 'bonus-mask-parent', name: 'Mask continuity', data: {
  v: 1, name: 'Mask continuity', spawn: [0, .1, 4], killY: -12,
  components: [
    { t: 'platform', p: [0, -.5, -8], s: [20, 1, 40] },
    { t: 'checkpoint', p: [-4, 0, 4] },
    { t: 'bonusplatform', p: [4, 0, -4], to: [0, .1, -4] },
    { t: 'gate', p: [0, 0, -20] },
  ],
} };
const bonusData = { v: 1, name: 'Mask bonus', spawn: [0, .1, 4], killY: -12, hudMode: 'bonus',
  components: [
    { t: 'platform', p: [0, -.5, 0], s: [20, 1, 20] },
    { t: 'crate', p: [4, 0, 4], kind: 'mask' },
    { t: 'gate', p: [0, 0, -6] },
  ],
};

await withSkateRuntime(async ({ THREE, Level, scene, player, level: parent, server, CONST }) => {
  const { mergeCompletedBonusInventory } = await server.ssrLoadModule('/src/campaign.ts');
  const context = {
    THREE, Level, scene, player, level: parent, current: entry, loadedLevelId: entry.id,
    bonusSession: null, bonusDeparture: null, competition: null, currentRunBonusBoxes: 0,
    endlessDeathsOn: false, mergeCompletedBonusInventory,
    campaignLevelById: () => null, isCampaignLevel: () => false, resolveBonusLevel: () => bonusData,
    puffs: { clear: noop, attach: noop }, swirls: { clear: noop }, fieldSwirls: { clear: noop },
    competitionUI: { render: noop }, input: { inventoryHeld: false }, recorder: { start: noop },
    ui: { hideMessage: noop, setEndlessDeaths: noop, setLevel: noop, setHUD: noop },
    campaign: { updateInventory: noop },
    gameFlow: { setWarpRoom: noop, hide: noop,
      transition(action, options) {
        context.transition = Promise.resolve().then(() => options?.beforeCover?.()).then(action);
        return context.transition;
      },
    },
    clearBonusDeparture: noop, clearBonusArrival: noop, beginBonusArrival: noop, startBonusDeparture: async () => {},
    applyRunModes: noop, applyTheme: noop, applyShadowFlags: noop,
    applyEndlessDeaths: () => { player.endlessDeaths = context.endlessDeathsOn; },
    currentHudState: () => ({}), prepareActivePresentationAssets: async () => {},
  };
  runInNewContext(code, context);
  player.onBonusDeath = () => context.returnFromBonus(false);
  let cases = 0;
  try {
    for (const endless of [false, true]) for (const [masks, uber] of [[0, 0], [1, 0], [2, 0], [2, 7]]) {
      for (const action of ['unchanged', 'spend-all', 'pickup', 'expire', 'death']) {
        player.respawn(parent, true, true);
        player.competitionMode = false; player.bonusMode = false;
        context.endlessDeathsOn = player.endlessDeaths = endless;
        player.lives = 4; player.fruit = 90; player.masks = masks; player.uberTimer = uber;
        // A different checkpoint count must never leak into a bonus handoff.
        parent.activateCheckpoint(parent.checkpoints[0], 0, 90, 2, 0);
        const checkpoint = parent.activeCheckpoint;
        context.enterBonusRound(); await context.transition;
        assert.equal(player.masks, masks, `${action}: entry changed carried masks`);
        assert.equal(player.uberTimer, uber, `${action}: entry changed carried timer`);
        const bonus = context.level;
        if (action === 'spend-all') {
          player.uberTimer = 0;
          while (player.spendMask()) { /* actual damage consumes each mask */ }
        } else if (action === 'pickup') {
          player.smashCrate(bonus, bonus.crates.find(crate => crate.mask));
        } else if (action === 'expire' && uber > 0) {
          player.uberTimer = CONST.fixedStep / 2;
          player.step(CONST.fixedStep, makeInput(), bonus);
          assert.equal(player.uberTimer, 0);
        }
        const expectedMasks = action === 'spend-all' ? 0 : action === 'pickup' ? Math.min(2, masks + 1) : masks;
        if (action === 'death') {
          player.die('pit');
          assert.equal(player.uberTimer, 0, 'bonus death retained third-mask invincibility');
          player.advanceDeath(player.respawnTimer + .1, bonus);
        } else context.returnFromBonus(true);
        const expectedUber = player.uberTimer;
        await context.transition;
        assert.equal(context.level, parent); assert.equal(context.bonusSession, null);
        assert.equal(player.masks, expectedMasks, `${action}: return changed live masks`);
        assert.equal(player.uberTimer, expectedUber, `${action}: return changed live timer`);
        assert.equal(player.bonusMode, false); assert.equal(player.endlessDeaths, endless);
        assert.equal(player.lives, 4); assert.equal(player.fruit, 90);
        if (action === 'death') {
          assert.equal(parent.activeCheckpoint, checkpoint, 'failed bonus replaced the checkpoint');
          assert.equal(parent.bonusRoundCompleted, false);
        } else {
          assert.equal(parent.activeCheckpoint.savedMasks, expectedMasks, 'bonus checkpoint saved stale parent masks');
          player.respawn(parent, false, true);
          assert.equal(player.masks, expectedMasks, 'checkpoint respawn refilled masks from before the bonus');
        }
        cases++;
      }
    }
  } finally { if (context.level !== parent) context.level.dispose(parent); }
  console.log(`PASS ${cases} real-Player bonus mask cases: every starting tier, spent masks, actual mask crate, expired invincibility, death return, both life modes and returned checkpoints`);
}, { levelEntry: entry });
