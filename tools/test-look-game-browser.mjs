import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:5291/').replace(/\/?$/, '/');
const output = process.env.LOOK_GAME_OUTPUT || '/private/tmp/look-panel-performance/game';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?playtest&level=codex-lab&tool=look${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && document.body.dataset.activeTool === 'look', null, { timeout: 120000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    const host = page.locator('visual-treatment-panel');
    await host.getByRole('button', { name: 'Bonus Unity', exact: true }).click();
    if (!lite) await page.waitForFunction(() => window.__game.getLookDiagnostics()?.bloom.active && window.__game.getLookDiagnostics()?.lut.rebuildCount > 0);
    const exposure = host.getByRole('slider', { name: 'Exposure EV', exact: true });
    const bounds = await exposure.boundingBox(); assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width * .45, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height / 2, { steps: 30 });
    await page.mouse.up();
    const numeric = host.getByRole('spinbutton', { name: 'Exposure EV numeric value', exact: true });
    await numeric.fill('-0.65'); await numeric.press('Tab');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('solProtoVisualTreatment.v2')).settings);
    assert.equal(stored.grading.exposureEV, -0.65);
    const diagnostics = await page.evaluate(() => window.__game.getLookDiagnostics());
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-look.png` });
    await host.getByRole('button', { name: 'Close visual treatment panel', exact: true }).click();
    await page.keyboard.press('KeyM');
    await page.locator('#app canvas').first().click({ position: { x: 300, y: 300 } });
    // The game deliberately requires one neutral poll after modal/tool input.
    await page.waitForFunction(() => !window.__game.input.menuReleaseGuard);
    await page.waitForFunction(() => window.__game.player.grounded, null, { timeout: 30000 });
    const initial = await page.evaluate(() => window.__game.player.pos.toArray());
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1500);
    const held = await page.evaluate(() => ({ moveY: window.__game.input.moveY, keys: [...window.__game.input.keys], speed: window.__game.player.speed, entry: window.__game.getLevel().entry?.id, renderer: window.__game.getRenderFrameLimiterStats() }));
    await page.keyboard.up('ArrowUp');
    const moved = await page.evaluate(() => window.__game.player.pos.toArray());
    const state = await page.evaluate(() => ({ state: window.__game.player.state, blocks: window.__game.gameFlow.blocksGameplay, debug: window.__game.gameFlow.developerChromeVisible, input: window.__game.input.frame, paused: window.__game.ui?.paused, focus: document.activeElement?.tagName }));
    assert.ok(Math.hypot(...moved.map((value, index) => value - initial[index])) > .2, `Native movement traverses supported ground: ${JSON.stringify({ initial, moved, state, held })}`);
    const checkpoint = await page.evaluate(() => {
      const g = window.__game; const warped = g.player.warpCheckpoint(g.getLevel(), 1);
      return { warped, spawn: g.getLevel().currentSpawn.toArray() };
    });
    assert.equal(checkpoint.warped, true);
    await page.evaluate(() => { const g = window.__game; g.player.pos.y = g.getLevel().killY - 10; });
    await page.waitForFunction(() => window.__game.player.state === 'dead', null, { timeout: 15000 });
    await page.waitForFunction(() => window.__game.player.state !== 'dead' && window.__game.player.grounded, null, { timeout: 30000 });
    const respawn = await page.evaluate(() => window.__game.player.pos.toArray());
    assert.ok(Math.hypot(...respawn.map((value, index) => value - checkpoint.spawn[index])) < 8, 'Pit returns to checkpoint');
    await page.evaluate(() => { const g = window.__game; g.getLevel().finishGlow.getCenter(g.player.pos); g.player.speed = 0; });
    await page.waitForFunction(() => window.__game.player.state === 'finished' || window.__game.gameFlow.blocksGameplay, null, { timeout: 15000 });
    assert.deepEqual(errors, []);
    rows.push({ lite, stamp, stored, diagnostics, initial, moved, checkpoint, respawn, errors });
    await page.close();
  }
  console.log('PASS production LOOK presets, real pointer drag, keyboard numeric edit and persistence; lite/full spawn, movement, checkpoint/pit respawn and finish; clean consoles.');
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(rows, null, 2));
  await browser.close();
}
