import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5355/';
const output = process.env.TRIAL_UNLOCK_OUTPUT || '/private/tmp/time-trial-unlock-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], reports = [];
try {
  for (const lite of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?playtest&level=flats${lite ? '&lite' : ''}`);
    const ready = () => page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    await ready();
    assert.match(await page.locator('.hud-build').textContent(), /Codex\/sol fork/);
    await page.evaluate(() => {
      const g = window.__game;
      g.campaign.newGame(1);
      const data = { v: 1, name: 'Crystal unlock review', spawn: [0, .1, 5], killY: -12, startWarpPad: false,
        components: [
          { t: 'platform', p: [0, -.5, 0], s: [20, 1, 30] },
          { t: 'clock', p: [5, 0, 5] }, { t: 'crystal', p: [-5, 1.4, 0] },
          { t: 'checkpoint', p: [0, 0, 0] }, { t: 'gate', p: [0, 0, -9] },
        ] };
      g.saveUserLevel({ id: 'jungle', name: data.name, data });
      if (!g.switchLevel('jungle')) throw Error('Fixture failed to load');
      g.gameFlow.hide();
      const show = g.gameFlow.showResults.bind(g.gameFlow);
      g.gameFlow.showResults = result => { window.unlockResult = result; show(result); };
    });
    await ready();
    const state = () => page.evaluate(() => {
      const g = window.__game, l = g.getLevel(), p = g.campaign.levelProgress('jungle');
      return { visible: l.clockPickup.group.visible, trial: g.player.ttActive,
        collected: g.player.hasCrystal, cleared: p.cleared, secured: p.crystal };
    });
    const move = async target => {
      await page.evaluate(target => {
        const g = window.__game, p = g.player, l = g.getLevel();
        if (target === 'finish') l.finishGlow.getCenter(p.pos);
        else (target === 'crystal' ? l.crystalPickup : l.clockPickup).box.getCenter(p.pos);
        p.prevPos.copy(p.pos); p.speed = p.vVel = 0; p.walkVelocity.set(0, 0, 0); p.grounded = false;
      }, target);
    };
    const restart = async () => {
      await page.evaluate(() => { const g = window.__game; g.switchLevel('jungle'); g.gameFlow.hide(); });
      await ready();
    };
    assert.equal((await state()).visible, false);
    await move('clock');
    await page.waitForTimeout(200);
    assert.equal((await state()).trial, false, 'touching a locked clock cannot start a trial');
    await move('crystal');
    await page.waitForFunction(() => window.__game.player.hasCrystal);
    assert.deepEqual(await state(), { visible: false, trial: false, collected: true, cleared: false, secured: false });
    await restart();
    assert.deepEqual(await state(), { visible: false, trial: false, collected: false, cleared: false, secured: false });
    await move('finish');
    await page.waitForFunction(() => window.__game.gameFlow.screen === 'results');
    assert.equal((await state()).cleared, true);
    assert.equal((await state()).secured, false);
    assert.equal(await page.evaluate(() => window.unlockResult.timeTrialUnlocked), false);
    await restart();
    assert.equal((await state()).visible, false, 'crystal-free clear stays locked on replay');
    await move('crystal');
    await page.waitForFunction(() => window.__game.player.hasCrystal);
    assert.equal((await state()).visible, false, 'pickup alone remains unbanked on a repeat clear');
    await move('finish');
    await page.waitForFunction(() => window.__game.gameFlow.screen === 'results');
    assert.equal((await state()).secured, true);
    assert.equal(await page.evaluate(() => window.unlockResult.timeTrialUnlocked), true);
    await page.waitForFunction(() => !window.__game.gameFlow.loadingPhase);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-secured.png` });
    await page.evaluate(() => window.__game.campaign.saveActive());
    await page.reload();
    await ready();
    await page.evaluate(() => { const g = window.__game; g.campaign.load(1); g.switchLevel('jungle'); g.gameFlow.hide(); });
    await ready();
    assert.equal((await state()).visible, true, 'secured unlock survives a real browser reload');
    await move('clock');
    await page.waitForFunction(() => window.__game.player.ttActive);

    // Exercise the shared race menus and the production finish callback.
    await page.evaluate(() => {
      const g = window.__game;
      const data = { v: 1, name: 'Race unlock review', spawn: [0, .1, 15], killY: -12, startWarpPad: false,
        components: [{ t: 'platform', p: [0, -.5, -45], s: [30, 1, 150] }, { t: 'gate', p: [0, 0, -100] }],
        skateRace: { v: 1, racers: 8, seed: 19, line: [[0, 0, 15, 30], [0, 0, -100, 30]], jumps: [], finishWidth: 28, originalLength: 86.4661654135 } };
      g.saveUserLevel({ id: 'slipstream-race', name: data.name, data });
      if (!g.switchLevel('slipstream-race')) throw Error('Race fixture failed to load');
      g.gameFlow.hide();
    });
    await ready();
    await page.waitForFunction(() => window.__game.ui.raceHud.state?.phase === 'grid');
    assert.equal(await page.locator('[data-race-action="trial"]').count(), 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-race-locked.png` });
    await page.evaluate(() => window.__game.getSkateRace().start('time-trial'));
    assert.equal(await page.evaluate(() => window.__game.getSkateRace().phase), 'grid');
    const finishRace = async won => {
      await page.evaluate(won => {
        const g = window.__game, r = g.getSkateRace(), p = g.player;
        r.reset('race'); r.phase = 'running';
        if (!won) r.riders[1].finish = .01;
        p.resetRacePosition(r.level, p.pos.clone().set(0, 0, -100.1), p.pos.clone().set(0, 0, -1));
        r.riders[0].progress = 114;
      }, won);
      await page.waitForFunction(() => window.__game.ui.raceHud.state?.phase === 'finished');
    };
    await finishRace(false);
    assert.equal(await page.locator('[data-race-action="trial"]').count(), 0, 'losing finish cannot offer time trial');
    await finishRace(true);
    await page.locator('[data-race-action="trial"]').waitFor();
    assert.equal(await page.evaluate(() => window.__game.campaign.levelProgress('slipstream-race').crystal), true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-race-unlocked.png` });
    await page.evaluate(() => { const g = window.__game; g.campaign.saveActive(); g.campaign.newGame(2); });
    await page.locator('[data-race-action="trial"]').waitFor({ state: 'detached' });
    await page.evaluate(() => window.__game.getSkateRace().start('time-trial'));
    assert.equal(await page.evaluate(() => window.__game.getSkateRace().mode), 'race', 'fresh save cannot inherit another slot’s trial');
    await page.evaluate(() => window.__game.campaign.load(1));
    await page.locator('[data-race-action="trial"]').waitFor();
    await page.locator('[data-race-action="trial"]').click();
    await page.waitForFunction(() => window.__game.getSkateRace().mode === 'time-trial');
    reports.push({ lite, ordinary: 'pickup/restart/crystal-free finish/secured finish/reload/activation pass', race: 'fresh/losing/winning/activation pass' });
    console.log(`PASS ${lite ? 'lite' : 'full'} ordinary and race unlock flows`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ reports, errors }, null, 2));
} finally { await browser.close(); }
