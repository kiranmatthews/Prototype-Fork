import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createServer } from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),
  harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();')();
const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
const fn = name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(node, `missing production ${name}`);
  return node.getText(ast);
};
const code = ts.transpileModule(['enterBonusRound', 'returnFromBonus', 'syncSkyBackdropVisibility', 'handleCompetitionAction', 'adoptCommittedCampaignProgress', 'restartCurrentRun'].map(fn).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const noop = () => {};
const server = await createServer({ appType: 'custom', logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
  const { CAMPAIGN_LEVELS, campaignLevelById, levelAllowsBonus, isCampaignLevel, mergeCompletedBonusInventory } =
    await server.ssrLoadModule('/src/campaign.ts');
  const { BONUS_LEVEL_ENTRIES, resolveBonusLevel, bonusCrateCount } =
    await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
  const { JungleCupEvent } = await server.ssrLoadModule('/src/competition/event.ts');
  const { isCompetitionLevel, competitionCourse } = await server.ssrLoadModule('/src/competition/courses.ts');
  const { EASY_BONUS_LEVEL } = await server.ssrLoadModule('/src/levels/bonus-easy.ts');
  assert.equal(resolveBonusLevel('unknown-editor-parent'), EASY_BONUS_LEVEL);
  for (const entry of BONUS_LEVEL_ENTRIES)
    assert.equal(findLevel(entry.id)?.data, entry.data, `room ${entry.id} has no direct editor entry`);
  for (const parent of CAMPAIGN_LEVELS.filter(entry => levelAllowsBonus(entry.levelId))) {
    // These three courses were published after the themed pack and retain Easy Street.
    if (['ghost-train','custard-creek','slipstream-2'].includes(parent.levelId)) {
      assert.equal(resolveBonusLevel(parent.levelId), EASY_BONUS_LEVEL);
      continue;
    }
    assert.notEqual(resolveBonusLevel(parent.levelId), EASY_BONUS_LEVEL, `${parent.name} still uses the shared fallback`);
    if (parent.fallbackLevelId) assert.equal(resolveBonusLevel(parent.fallbackLevelId), resolveBonusLevel(parent.levelId));
  }

  let rooms = 0, blocked = 0;
  for (const parentId of [...CAMPAIGN_LEVELS.map(entry => entry.levelId), 'unknown-editor-parent']) {
    // A tiny parent isolates session restoration and the authored bonus tally
    // from the unrelated geometry of the campaign course itself.
    const isCup = isCompetitionLevel(parentId);
    const parentCompetition = isCup ? new JungleCupEvent(() => .5, noop, competitionCourse(parentId)) : null;
    const parentData = findLevel(parentId)?.data;
    const parentHud = parentData?.hudMode;
    const parentEntry = { id: parentId, name: 'Suspended parent', data: {
      v: 1, name: 'Suspended parent', spawn: [0, .1, 8], killY: -20, hudMode: parentHud, encounter: parentData?.encounter,
      components: [
        { t: 'platform', p: [0, -1, -40], s: [30, 2, 120] },
        { t: 'crate', p: [-3, 0, 4], kind: 'wood' },
        ...(!isCup ? [{ t: 'bonusplatform', p: [3, 0, -20], to: [0, .1, -24] }] : []),
        { t: 'gate', p: [0, 0, -80] },
      ],
    } };
    const scene = new THREE.Scene(), parentLevel = new Level(scene, parentEntry);
    const parentBoss = parentLevel.boss;
    // A partially completed encounter fixture proves that bonus travel neither
    // reconstructs the chief nor resets its phase, health or attack timeline.
    if (parentBoss) Object.assign(parentBoss, { state: 'volley-tell', stateTime: .4,
      phase: 2, health: 5, charge: .6, playerHealth: 2, hits: 4 });
    const bossBefore = parentBoss ? JSON.stringify(parentBoss.diagnostics) : null;
    const parentCrate = parentLevel.crates.find(crate => !crate.bang && !crate.nitroBang);
    const count = bonusCrateCount(parentId);
    assert.equal(parentLevel.bonusCrateTotal, isCup ? 0 : count, `${parentId} parent has the wrong bonus denominator`);
    assert.equal(parentLevel.totalCrates, (isCup ? 0 : count) + 1);
    const parentFruit = [{ preserved: true }], events = [];
    const player = {
      lives: 4, fruit: 90, masks: 2, uberTimer: 4, totalDeaths: 3, cratesBroken: 1,
      bonusCrates: 0, bonusMode: false, hubMode: false, competitionMode: isCup, ttActive: false, fruitCollectionRevision: 0,
      pos: parentLevel.spawnPos.clone(),
      bankFlyingFruit: noop, setCampaignRelics: noop, commitRenderStep: noop,
      captureRunState() { return { lives: this.lives, fruit: this.fruit, masks: this.masks,
        uberTimer: this.uberTimer, totalDeaths: this.totalDeaths, cratesBroken: this.cratesBroken, bonusCrates: this.bonusCrates }; },
      captureIdleFruit: () => parentFruit,
      respawn(candidate) { this.pos.copy(candidate.spawnPos); this.cratesBroken = 0; },
      resumeSuspendedLevel(_level, point, state) { Object.assign(this, state); this.pos.copy(point); this.bonusMode = false; },
      restoreIdleFruit(value) { assert.equal(value, parentFruit); },
    };
    const context = {
      THREE, Level, scene, player, level: parentLevel, current: parentEntry, loadedLevelId: parentId,
      bonusSession: null, bonusDeparture: null, clearBonusDeparture:noop, clearBonusArrival:noop, beginBonusArrival:noop,
      startBonusDeparture(kind,receipt){events.push(['transfer',kind,receipt]);return Promise.resolve();}, competition: parentCompetition, competitionUI: { render: noop }, currentRunBonusBoxes: 0, endlessDeathsOn: false,
      campaignLevelById, isCampaignLevel, isCompetitionLevel, recordPresentationStage: noop,
      JungleCupEvent, competitionCourse, sfx: { countdownBeep: noop },
      guardGameplayFromMenu: noop, restoreCommittedRunRewards: noop, runStartRewards: {},
      split2p: false, p2: null, paused: false, acc: 0, mergeCompletedBonusInventory, resolveBonusLevel,
      puffs: { clear: noop, attach: noop }, swirls: { clear: noop }, fieldSwirls: { clear: noop },
      input: { inventoryHeld: false, consumeEdges: noop }, recorder: { start: noop },
      ui: { hideMessage: noop, setEndlessDeaths: noop, setLevel: noop, setHUD: noop, deathFade: noop, resetHudTransients: noop,
        startBonusPayout(...args) { events.push(['payout', ...args]); } },
      campaign: { levelProgress: () => null, updateInventory(...args) { events.push(['inventory', ...args]); } },
      gameFlow: { setWarpRoom: noop, hide: noop,
        transition(action, options) { if (options) assert.equal(options.vortex, false); context.transition = Promise.resolve().then(()=>options?.beforeCover?.()).then(action); return context.transition; } },
      applyRunModes: noop, applyTheme: noop, applyShadowFlags: noop, applyEndlessDeaths: noop,
      currentHudState: () => ({}), prepareActivePresentationAssets: async () => {},
      LITE: false, editorViewActive: false, activeSky: 'night', DEFAULT_SKY: 'night',
      SKY_PRESETS: { night: {} }, skyCache: new Map([['night', true]]), sky: {}, skyMist: {},
      resolveLevelAtmosphere: candidate => ({ backdrop: candidate.atmosphere?.backdrop ?? 'sky' }),
    };
    runInNewContext(code, context);
    try {
      if (!parentLevel.allowsBonus) {
        assert.equal(parentLevel.bonusPlatformDiagnostics, null, `${parentId} retained an authored bonus pad`);
        assert.equal(parentLevel.bonusCrateTotal, 0);
        assert.equal(bonusCrateCount(parentId), 0);
        assert.ok(!BONUS_LEVEL_ENTRIES.some(entry => entry.id === `bonus-${campaignLevelById(parentId)?.progressKey}`));
        for (const phase of ['intro', 'running', 'countdown', 'standings', 'final']) {
          if (parentCompetition) parentCompetition.phase = phase;
          context.enterBonusRound();
          if (parentCompetition) context.handleCompetitionAction('bonus');
          assert.equal(context.transition, undefined, `boss ${parentId} accepted a bonus detour`);
        }
        assert.equal(context.level, parentLevel);
        assert.equal(context.competition, parentCompetition);
        if (parentBoss) assert.equal(JSON.stringify(parentBoss.diagnostics), bossBefore);
        blocked++; continue;
      }
      if (isCup) {
        for (const phase of ['running', 'finishing', 'countdown']) {
          parentCompetition.phase = phase;
          context.handleCompetitionAction('bonus');
          assert.equal(context.transition, undefined, `cup bonus interrupted ${phase}`);
          context.enterBonusRound();
          assert.equal(context.transition, undefined, `direct bonus entry interrupted ${phase}`);
        }
        parentCompetition.phase = 'intro';
      }
      for (const completed of [false, true]) {
        if (isCup) context.handleCompetitionAction('bonus'); else context.enterBonusRound();
        await context.transition;
        const bonusLevel = context.level;
        assert.notEqual(bonusLevel, parentLevel);
        assert.equal(context.current.data, resolveBonusLevel(parentId));
        assert.equal(context.current.id, `bonus:${parentId}`);
        assert.equal(bonusLevel.hudMode, 'bonus');
        assert.equal(bonusLevel.boss, null, 'the parent chief followed the player into the bonus');
        assert.equal(parentLevel.boss, parentBoss);
        if (parentBoss) assert.equal(JSON.stringify(parentBoss.diagnostics), bossBefore, 'bonus entry advanced or reset the suspended encounter');
        assert.equal(bonusLevel.totalCrates, count, `${parentId} selected room disagrees with the parent gem tally`);
        assert.equal(bonusLevel.bonusCrateTotal, 0, 'a bonus must not add a nested room to its tally');
        assert.equal(bonusLevel.bonusPlatformDiagnostics, null);
        assert.equal(bonusLevel.crystalPickup, null);
        assert.equal(parentLevel.root.parent, null, 'suspended parent still participates in scene traversal');
        assert.equal(context.competition, null, 'cup judging continues inside bonus');
        assert.equal(player.competitionMode, false);
        assert.equal(player.lives, 0); assert.equal(player.fruit, 0);
        context.syncSkyBackdropVisibility();
        assert.equal(context.sky.visible, bonusLevel.atmosphere?.backdrop !== 'fog', 'bonus ignores its authored backdrop');
        player.lives = 1; player.fruit = 25; player.cratesBroken = count; player.masks = 1; player.uberTimer = 2;
        context.returnFromBonus(completed); await context.transition;
        assert.equal(context.level, parentLevel); assert.equal(context.current, parentEntry);
        assert.equal(context.bonusSession, null); assert.equal(bonusLevel.root.parent, null);
        assert.equal(parentLevel.root.parent, scene);
        assert.equal(parentLevel.boss, parentBoss, 'bonus return reconstructed the chief');
        if (parentBoss) assert.equal(JSON.stringify(parentBoss.diagnostics), bossBefore, 'bonus return changed chief health, phase or attacks');
        assert.equal(parentLevel.crates.includes(parentCrate), true, 'bonus return rebuilt parent crate state');
        assert.deepEqual(player.pos.toArray(), isCup ? [0, .1, 8] : [0, .1, -24]);
        assert.equal(context.competition, parentCompetition, 'return discarded the exact cup event');
        assert.equal(player.competitionMode, isCup);
        assert.equal(player.bonusMode, false, 'collection HUD changed the parent gameplay rules');
        assert.equal(parentLevel.hudMode, parentHud ?? 'standard');
        assert.equal(player.masks, 1); assert.equal(player.uberTimer, 2);
        assert.equal(player.lives, completed ? 6 : 4); assert.equal(player.fruit, completed ? 15 : 90);
        assert.equal(player.bonusCrates, completed ? count : 0);
        assert.equal(context.currentRunBonusBoxes, completed ? count : 0);
        assert.equal(parentLevel.bonusRoundCompleted, completed, 'failed bonus cannot be retried or completed bonus can pay twice');
        if (completed) {
          assert.deepEqual(parentLevel.currentSpawn.toArray(), player.pos.toArray(), 'bonus clear did not bank its return point');
          assert.equal(parentLevel.activeCheckpoint.savedCratesBroken, 1);
          assert.equal(parentLevel.activeCheckpoint.savedMasks, 1);
        } else assert.equal(parentLevel.activeCheckpoint, null, 'failed bonus created a checkpoint');
        assert.equal(events.filter(event => event[0] === 'transfer').length, completed ? 1 : 0);
      }
      const paidEvents = events.length;
      context.enterBonusRound(); await context.transition;
      assert.equal(context.level, parentLevel, 'completed menu bonus reopened');
      assert.equal(events.length, paidEvents, 'completed bonus paid twice');
      if (isCup) {
        context.handleCompetitionAction('start');
        assert.equal(parentLevel.bonusRoundCompleted, true, 'a new heat reopened the same event bonus');
        context.handleCompetitionAction('retry');
        assert.notEqual(context.competition, parentCompetition, 'cup retry retained the previous event');
        assert.equal(parentLevel.bonusRoundCompleted, false, 'a fresh cup event retained its completed bonus lock');
        assert.equal(context.currentRunBonusBoxes, 0); assert.equal(player.bonusCrates, 0);
      } else if (parentId === 'unknown-editor-parent') {
        context.restartCurrentRun(); await context.transition;
        assert.equal(parentLevel.bonusRoundCompleted, false, 'direct-playtest Restart retained the bonus lock');
        assert.equal(context.currentRunBonusBoxes, 0); assert.equal(player.bonusCrates, 0);
        context.enterBonusRound(); await context.transition;
        assert.notEqual(context.level, parentLevel, 'fresh direct-playtest run cannot enter its bonus');
        context.returnFromBonus(false); await context.transition;
      }
      rooms++;
    } finally {
      if (context.level !== parentLevel) context.level.dispose(parentLevel);
      parentLevel.dispose();
    }
  }
  console.log(`PASS themed bonus flow: ${rooms} selected rooms, exact parent tallies, ${blocked} blocked boss/competition detours, direct editor entries, failed retry, successful payout, parent restoration and authored skies`);
} finally { await server.close(); }
