import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base = process.env.CARLISLE_BASE ?? 'http://127.0.0.1:5483';
const out = process.env.SKATE_ENTRY_REVIEW_OUT ?? '/private/tmp/carlisle-skate-entry-browser';
const lite = process.argv.includes('--lite');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base, lite, errors: [] };
let page;
try {
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.addInitScript(() => Object.defineProperty(navigator, 'getGamepads', { value: () => [] }));
  await page.goto(`${base}/?playtest&level=carlisle-coast&art=harbour${lite ? '&lite' : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const g = window.__game;
    g.campaign.startEphemeral();
    await g.getLevel().prepareJungleAssets();
    g.renderQualitySettings.setRegularResolution(null);
    g.crtGuestSettings.setEnabled(false);
    const p = g.player, original = p.step;
    window.__skateEntry = { mounts: [], landings: [], afterLanding: 0, startedAir: false };
    p.step = function(dt, input, level) {
      const board = this.freeSkate, wasAir = this.state === 'air';
      original.call(this, dt, input, level);
      const trace = window.__skateEntry;
      if (!board && this.freeSkate) trace.mounts.push({ jumpHeld: input.jumpHeld, moveX: input.moveX, moveY: input.moveY, charge: this.skateCharge });
      if (trace.watchJump && this.state === 'air') trace.startedAir = true;
      if (trace.watchJump && trace.startedAir && wasAir && this.grounded) trace.landings.push({ speed: this.speed, board: this.freeSkate, surface: this.groundHit?.name });
      if (trace.landings.length && this.grounded) trace.afterLanding++;
    };
  });
  const reset = () => page.evaluate(() => {
    const g = window.__game, p = g.player;
    const position = p.pos.clone().set(6.71, 221.34, -10.18);
    const heading = p.axisF.clone().set(.49, 0, -.87).normalize();
    p.respawn(g.getLevel(), true, false, { position, heading });
    window.__skateEntry = { mounts: [], landings: [], afterLanding: 0, startedAir: false };
  });
  await reset();
  await page.waitForFunction(() => { const p = window.__game.player; return p.grounded && p.speed > 14 && !p.freeSkate; }, null, { timeout: 15000 });
  await page.evaluate(() => { window.__skateEntry.watchJump = true; });
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__game.player.charging && window.__game.player.chargeTimer >= .05);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.__skateEntry.afterLanding >= 12, null, { timeout: 20000 });
  report.footJump = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    return { ...window.__skateEntry, board: p.freeSkate, speed: p.speed, bailing: p.isBailing, clip: p.animationClipHint,
      position: p.pos.toArray(), canvas: [g.renderer.domElement.width, g.renderer.domElement.height] };
  });
  assert.deepEqual(report.footJump.mounts, []);
  assert.equal(report.footJump.board, false);
  assert.equal(report.footJump.bailing, false);
  assert.ok(report.footJump.speed > 14);
  assert.deepEqual(report.footJump.canvas, lite ? [960, 540] : [1920, 1080]);
  await page.screenshot({ path: `${out}/foot-landing.png` });
  await reset();
  await page.waitForFunction(() => window.__game.player.grounded);
  await page.keyboard.down('Space');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.__game.player.freeSkate, null, { timeout: 10000 });
  report.deliberateMount = await page.evaluate(() => ({ mounts: window.__skateEntry.mounts, requiredHold: window.__game.TUNING.skateHoldTime }));
  assert.equal(report.deliberateMount.mounts.length, 1);
  const mount = report.deliberateMount.mounts[0];
  assert.ok(mount.jumpHeld && mount.moveY !== 0 && mount.charge >= report.deliberateMount.requiredHold);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: `${out}/deliberate-mount.png` });
  assert.deepEqual(report.errors, []);
  report.passed = true;
} finally {
  if (page) report.last = await page.evaluate(() => { const p = window.__game?.player; return p ? { state: p.state, grounded: p.grounded, board: p.freeSkate, speed: p.speed, position: p.pos.toArray() } : null; }).catch(() => null);
  await writeFile(`${out}/browser.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(report));
