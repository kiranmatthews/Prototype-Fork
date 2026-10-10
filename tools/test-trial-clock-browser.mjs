// Exercise the production game and its pause Restart button in a fresh browser save.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5337/';
const output = process.env.TRIAL_CLOCK_OUTPUT || '/private/tmp/trial-clock-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [], errors = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}?playtest&level=codex-lab${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded, null, { timeout: 120000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(() => {
      const g = window.__game;
      const data = { v: 1, name: 'Trial clock review', spawn: [0, .05, 5], killY: -12,
        startWarpPad: false, components: [
          { t: 'platform', p: [0, -.5, 0], s: [20, 1, 24] },
          { t: 'clock', p: [5, 0, 5] },
          { t: 'wumpa', p: [0, 1, 1] },
          { t: 'checkpoint', p: [-5, 0, 5] },
          { t: 'gate', p: [0, 0, -9] },
        ] };
      const id = g.saveUserLevel({ id: '', name: data.name, data });
      if (!id || !g.switchLevel(id)) throw Error('Could not load clock review fixture');
      g.gameFlow.hide();
    });
    const ready = () => page.waitForFunction(() => !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded);
    const state = () => page.evaluate(() => {
      const g = window.__game, l = g.getLevel();
      return { visible: l.clockPickup.group.visible, locked: l.clockLocked, trial: g.player.ttActive };
    });
    const move = (x, y, z) => page.evaluate(([x, y, z]) => {
      const p = window.__game.player;
      p.pos.set(x, y, z); p.prevPos.copy(p.pos); p.speed = p.vVel = 0;
      p.walkVelocity.set(0, 0, 0); p.grounded = false;
    }, [x, y, z]);
    const pauseAction = async (name) => {
      await page.waitForFunction(() => !window.__game.input.menuReleaseGuard);
      await page.keyboard.press('KeyP');
      await page.waitForFunction(() => window.__game.gameFlow.screen === 'pause' && window.__game.gameFlow.blocksGameplay);
      const steps = await page.evaluate(name => {
        const f = window.__game.gameFlow;
        const index = f.navButtons.findIndex(b => b.textContent.trim() === name);
        if (index < 0) throw Error(`Pause action missing: ${name}`);
        return (index - f.selected + f.navButtons.length) % f.navButtons.length;
      }, name);
      for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !window.__game.gameFlow.blocksGameplay && !window.__game.input.menuReleaseGuard);
    };
    const restart = async () => {
      await pauseAction('RESTART');
      await ready();
      assert.deepEqual(await state(), { visible: true, locked: false, trial: false });
    };
    await ready();
    assert.deepEqual(await state(), { visible: true, locked: false, trial: false });
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-fresh.png` });
    // Native walking collects the first milk. The lock must beat its HUD flight.
    await page.evaluate(() => {
      const p = window.__game.player, native = p.beginFruitFlight.bind(p);
      p.beginFruitFlight = (...args) => {
        const fruitBefore = p.fruit; native(...args);
        window.__clockContact = { locked: window.__game.getLevel().clockLocked,
          visible: window.__game.getLevel().clockPickup.group.visible, credited: p.fruit !== fruitBefore };
      };
    });
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.__clockContact, null, { timeout: 15000 });
    await page.keyboard.up('ArrowUp');
    assert.deepEqual(await page.evaluate(() => window.__clockContact), { locked: true, visible: false, credited: false });
    await move(5, .1, 5);
    await ready();
    assert.deepEqual(await state(), { visible: false, locked: true, trial: false });
    // Resume does not reset eligibility.
    await pauseAction('RESUME');
    assert.equal((await state()).visible, false);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-collected.png` });
    await restart();
    // Die without collecting anything, then return to the invisible clock.
    await move(30, -14, 5);
    await page.waitForFunction(() => window.__game.player.state === 'dead');
    assert.deepEqual(await state(), { visible: false, locked: true, trial: false });
    await ready();
    await move(5, .1, 5);
    await ready();
    assert.deepEqual(await state(), { visible: false, locked: true, trial: false });
    await restart();
    // Every failed trial restores a usable clock without opening the pause menu.
    for (let attempt = 0; attempt < 2; attempt++) {
      await move(5, .1, 5);
      await page.waitForFunction(() => window.__game.player.ttActive);
      await move(30, -14, 5);
      await page.waitForFunction(() => window.__game.player.state === 'dead');
      await ready();
      assert.deepEqual(await state(), { visible: true, locked: false, trial: false });
    }
    await restart();
    // Keep checkpoint, supported respawn and finish-gate coverage on the same fixture.
    await move(-5, 2.2, 5);
    await page.waitForFunction(() => window.__game.getLevel().activeCheckpoint !== null);
    await move(30, -14, 5);
    await page.waitForFunction(() => window.__game.player.state === 'dead');
    await ready();
    assert.equal((await state()).visible, false);
    await move(0, 1.4, -9);
    await page.waitForFunction(() => window.__game.player.state === 'finished' || window.__game.gameFlow.blocksGameplay);
    reports.push({ lite, stamp, firstPickup: true, resumeKeepsLock: true, firstDeath: true,
      trialDeathRestoresClock: true, consecutiveTrialRetries: 2, pauseRestart: true, checkpoint: true, finish: true });
    console.log(`${lite ? 'lite' : 'full'}: ordinary lockout, hidden collision, repeatable trial retries, pause Restart, checkpoint and finish passed`);
    await page.close();
  }
  // A bonus visit remains part of the parent playthrough, even if it pays out nothing.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?playtest&level=jungle&lite`);
  await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded, null, { timeout: 120000 });
  await page.evaluate(() => { window.__parentClockLevel = window.__game.getLevel(); window.__game.enterBonusRound(); });
  await page.waitForFunction(() => window.__game.player.bonusMode && !window.__game.gameFlow.blocksGameplay, null, { timeout: 60000 });
  await page.evaluate(() => { const g = window.__game; g.player.pos.y = g.getLevel().killY - 2; });
  await page.waitForFunction(() => !window.__game.player.bonusMode && !window.__game.gameFlow.blocksGameplay, null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.__game.getLevel() === window.__parentClockLevel &&
    window.__game.getLevel().clockLocked && !window.__game.getLevel().clockPickup.group.visible), true);
  reports.push({ bonusDeathKeepsParentLock: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ reports, errors }, null, 2));
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, reports, errors }, null, 2));
  await browser.close();
}
