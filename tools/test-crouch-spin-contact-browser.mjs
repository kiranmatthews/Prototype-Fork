import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5310/';
const output = process.env.CROUCH_SPIN_OUTPUT || '/private/tmp/crouch-spin-20261012/browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], reports = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => { navigator.getGamepads = () => []; });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}?playtest&level=test${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game?.player.spinEffectDiagnostics.assetReady && !window.__game.gameFlow.blocksGameplay, null, { timeout: 90000 });
    assert.match(await page.locator('.hud-build').textContent(), /Codex\/sol fork/);
    // Start in the affected real course and exercise native held crouch/spin.
    await page.keyboard.down('KeyQ');
    await page.waitForFunction(() => window.__game.player.crawling);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const g = window.__game, p = g.player, native = p.step.bind(p);
      window.__crouchReview = { samples: [], freeze: false };
      p.step = (dt, input, level) => {
        const r = window.__crouchReview;
        if (r.freeze) return;
        native(dt, input, level);
        r.samples.push({ crouch: p.crawling, spin: p.spinning, held: input.grabHeld,
          clip: g.characterAnimationRuntime.activeClipId, visible: p.bodyGroup.visible,
          head: p.characterBounds.max.y - p.pos.y, attackHeight: p.crateAttackBox.max.y - p.pos.y,
          time: g.characterAnimationRuntime.diagnostics.timelineTime, pos: p.pos.toArray() });
      };
    });
    await page.keyboard.press('KeyF'); await page.waitForTimeout(650);
    let samples = await page.evaluate(() => window.__crouchReview.samples);
    assert.ok(samples.some(s => s.spin));
    assert.ok(samples.filter(s => s.held).every(s => ['player.crouch', 'player.crawl'].includes(s.clip)), 'standing pose leaked in Carlisle');
    assert.ok(samples.filter(s => s.spin).every(s => s.attackHeight < .96));
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-carlisle-crouch.png` });
    await page.keyboard.up('KeyQ');
    // A controlled stack uses the same production renderer, assets and controls.
    await page.evaluate(() => {
      const g = window.__game;
      const data = { v: 1, name: 'Crouched spin stack review', startWarpPad: false, spawn: [0, .02, 1.4], killY: -15,
        components: [{ t: 'platform', p: [0, -.5, 0], s: [40, 1, 40], tex: 'stone' },
          ...[0, .96, 1.92].map(y => ({ t: 'crate', p: [0, y, 0], kind: 'wood' })),
          { t: 'checkpoint', p: [8, 0, 0] }, { t: 'gate', p: [0, 0, -15] }] };
      const id = g.saveUserLevel({ id: '', name: data.name, data });
      if (!g.switchLevel(id)) throw Error('Cannot open stack review');
      g.gameFlow.hide(); window.__crouchReview.samples = [];
      const render = g.renderer.render.bind(g.renderer);
      g.renderer.render = (...args) => {
        if (args[1] === g.camera) {
          g.camera.position.copy(g.player.pos).add(g.player.pos.clone().set(5, 3.5, 5));
          g.camera.up.set(0, 1, 0); g.camera.lookAt(g.player.pos.clone().add(g.player.pos.clone().set(0, .7, -.5)));
        }
        return render(...args);
      };
    });
    await page.waitForFunction(() => window.__game.player.grounded && !window.__game.input.menuReleaseGuard);
    await page.keyboard.down('KeyQ'); await page.waitForTimeout(450);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-stack-before.png` });
    for (let layer = 1; layer <= 3; layer++) {
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(() => window.__game.getLevel().crates.filter(c => !c.alive).length), layer);
      if (layer === 1) await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-stack-after.png` });
    }
    samples = await page.evaluate(() => window.__crouchReview.samples);
    assert.ok(samples.filter(s => s.crouch).every(s => ['player.crouch', 'player.crawl', 'player.crouch-enter'].includes(s.clip)));
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(220);
    await page.evaluate(() => { window.__crouchReview.samples = []; });
    await page.waitForTimeout(850);
    const crawl = await page.evaluate(() => ({ samples: window.__crouchReview.samples,
      duration: window.__game.characterAnimationRuntime.document.clips.find(c => c.id === 'player.crawl').duration }));
    const moving = crawl.samples.filter(s => s.clip === 'player.crawl');
    assert.ok(moving.length > 20);
    let cycles = 0, distance = 0;
    for (let i = 1; i < moving.length; i++) {
      const a = moving[i - 1], b = moving[i];
      cycles += ((b.time - a.time + crawl.duration) % crawl.duration) / crawl.duration;
      distance += Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]);
    }
    assert.ok(Math.abs(cycles * 1.8 - distance) < .02, 'rendered crawl did not track travel');
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-crawl.png` });
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('KeyQ');
    // Preserve the existing spawn/checkpoint/death/finish smoke coverage.
    await page.evaluate(() => { const p = window.__game.player; p.pos.set(8, 2.2, 0); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false; });
    await page.waitForFunction(() => window.__game.getLevel().activeCheckpoint !== null && window.__game.player.grounded);
    const snap = await page.evaluate(() => { const p = window.__game.player; p.pos.set(30, 2, 0); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false; return p.renderSnapVersion; });
    await page.waitForFunction(() => window.__game.player.state === 'dead');
    await page.waitForFunction(s => { const p = window.__game.player; return p.grounded && p.state !== 'dead' && p.renderSnapVersion !== s; }, snap);
    await page.evaluate(() => { const p = window.__game.player; p.pos.set(0, 1.4, -15); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false; });
    await page.waitForFunction(() => window.__game.player.state === 'finished' || window.__game.gameFlow.blocksGameplay);
    reports.push({ lite, cycles, distance, samples: samples.length, movingFrames: moving.length });
    console.log(`PASS ${lite ? 'lite' : 'full'} Carlisle crouch, three separate stack attacks, crawl cadence, checkpoint, pit respawn and finish`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ base, reports, errors }, null, 2));
} finally { await browser.close(); }
