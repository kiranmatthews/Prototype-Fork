import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5310/';
const output = process.env.LOW_SPIN_OUTPUT || '/private/tmp/low-spin-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], reports = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => { navigator.getGamepads = () => []; });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}?playtest&level=codex-lab${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game?.player.spinEffectDiagnostics?.assetReady && !window.__game.gameFlow.blocksGameplay, null, { timeout: 90000 });
    assert.match(await page.locator('.hud-build').textContent(), /Codex\/sol fork/);
    await page.evaluate(() => {
      const g = window.__game;
      const data = { v: 1, name: 'Low spin review', startWarpPad: false, spawn: [0, .02, 0], killY: -15, components: [
        { t: 'platform', p: [0, -.5, 0], s: [100, 1, 100], tex: 'stone' },
        { t: 'checkpoint', p: [8, 0, 0] }, { t: 'gate', p: [0, 0, -45] },
      ] };
      const id = g.saveUserLevel({ id: '', name: data.name, data });
      if (!g.switchLevel(id)) throw Error('Could not load low spin review');
      g.gameFlow.hide();
      const p = g.player, native = p.step.bind(p);
      window.__lowSpin = { freeze: false, freezeOnSpin: false, samples: [], angle: 0 };
      p.step = (dt, input, level) => {
        const r = window.__lowSpin; if (r.freeze) return;
        const before = p.characterBounds.clone();
        p.interactionMeasure.measureRelative(p.riderG, p.group, before);
        if (p.grounded) before.min.y = Math.max(0, before.min.y);
        const was = p.spinning;
        native(dt, input, level);
        if (p.spinning || p.spinEffects.characterRings.visible) {
          const f = p.spinEffects.characterFrame;
          r.samples.push({ start: !was && p.spinning, active: p.spinning, before: { min: before.min.toArray(), max: before.max.toArray() },
            scale: f.scale.toArray(), position: f.position.toArray(), player: p.pos.toArray(),
            sculpture: p.spinEffects.sculptureVisible, nativeBody: p.bodyGroup.visible });
        }
        if (!was && p.spinning && r.freezeOnSpin) { r.freeze = true; p.collapseRenderInterpolation(); }
      };
      const render = g.renderer.render.bind(g.renderer);
      g.renderer.render = (...args) => {
        if (args[1] === g.camera) {
          const angle = window.__lowSpin.angle;
          g.camera.position.copy(p.group.position).add(p.pos.clone().set(Math.sin(angle) * 4, 1.3, Math.cos(angle) * 4));
          g.camera.up.set(0, 1, 0); g.camera.lookAt(p.group.position.clone().add(p.pos.clone().set(0, .8, 0)));
        }
        return render(...args);
      };
    });
    for (const kind of ['crouch', 'crawl', 'slide', 'stand']) {
      for (const key of ['KeyQ', 'ArrowUp', 'KeyF']) await page.keyboard.up(key);
      await page.evaluate(() => {
        const g = window.__game, r = window.__lowSpin;
        r.freeze = false; r.freezeOnSpin = false; r.samples = [];
        g.player.respawn(g.getLevel(), true); g.characterAnimationRuntime.restart();
      });
      await page.waitForFunction(() => {
        const g = window.__game;
        return g.player.grounded && !g.gameFlow.blocksGameplay && !g.input.menuReleaseGuard && g.player.invulnTimer <= 0;
      });
      if (kind === 'slide') {
        await page.keyboard.down('ArrowUp'); await page.waitForTimeout(350);
        await page.keyboard.down('KeyQ');
        await page.waitForFunction(() => window.__game.player.sliding);
        await page.waitForTimeout(100);
      } else if (kind !== 'stand') {
        await page.keyboard.down('KeyQ');
        await page.waitForFunction(() => window.__game.player.crawling);
        await page.waitForTimeout(500);
        if (kind === 'crawl') { await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); }
      }
      await page.evaluate(() => { window.__lowSpin.freeze = true; window.__game.player.collapseRenderInterpolation(); });
      await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-${kind}-before.png` });
      await page.evaluate(() => { window.__lowSpin.freeze = false; window.__lowSpin.freezeOnSpin = true; });
      await page.keyboard.down('KeyF');
      await page.waitForFunction(() => window.__lowSpin.freeze);
      const sample = await page.evaluate(() => window.__lowSpin.samples.find(s => s.start));
      assert.equal(sample.sculpture, true); assert.equal(sample.nativeBody, false);
      const size = await page.evaluate(() => window.__game.player.spinEffects.modelHeight);
      if (kind === 'stand') {
        assert.deepEqual(sample.scale, [1, 1, 1]); assert.deepEqual(sample.position, [0, 0, 0]);
      } else {
        assert.ok(Math.abs(sample.scale[1] * size - (sample.before.max[1] - sample.before.min[1])) < 1e-5);
        assert.ok(Math.abs(sample.position[1] - sample.before.min[1]) < 1e-5);
      }
      for (const angle of [0, 40, 90]) {
        await page.evaluate(a => { window.__lowSpin.angle = a * Math.PI / 180; }, angle);
        await page.waitForTimeout(60);
        await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-${kind}-spin-${angle}.png` });
      }
      // Inspect the actual frozen character as well as the complete bright VFX.
      await page.evaluate(() => { window.__game.player.spinEffects.characterRings.visible = false; });
      await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-${kind}-surface.png` });
      for (const key of ['KeyQ', 'ArrowUp', 'KeyF']) await page.keyboard.up(key);
      await page.evaluate(() => { window.__lowSpin.freeze = false; window.__lowSpin.freezeOnSpin = false; });
      await page.waitForTimeout(850);
      const samples = await page.evaluate(() => window.__lowSpin.samples);
      assert.ok(samples.some(s => !s.active), 'ring handoff missing');
      for (const s of samples) { assert.deepEqual(s.scale, sample.scale); assert.deepEqual(s.position, sample.position); }
      reports.push({ lite, kind, sample, samples: samples.length });
      console.log(`PASS ${lite ? 'lite' : 'full'} ${kind}: scale ${sample.scale[1].toFixed(3)}, bottom ${sample.position[1].toFixed(3)}`);
    }
    await page.evaluate(() => {
      const p = window.__game.player; p.pos.set(8, 2.2, 0); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false;
    });
    await page.waitForFunction(() => window.__game.getLevel().activeCheckpoint !== null && window.__game.player.grounded);
    const snap = await page.evaluate(() => {
      const p = window.__game.player; p.pos.set(60, 2, 0); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false;
      return p.renderSnapVersion;
    });
    await page.waitForFunction(() => window.__game.player.state === 'dead');
    await page.waitForFunction(s => { const p = window.__game.player; return p.grounded && p.state !== 'dead' && p.renderSnapVersion !== s; }, snap);
    await page.evaluate(() => {
      const p = window.__game.player; p.pos.set(0, 1.4, -45); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false;
    });
    await page.waitForFunction(() => window.__game.player.state === 'finished' || window.__game.gameFlow.blocksGameplay);
    console.log(`PASS ${lite ? 'lite' : 'full'} supported landings, checkpoint, pit respawn and finish`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ reports, errors }, null, 2));
} finally { await browser.close(); }
