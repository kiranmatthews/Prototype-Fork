import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base = process.env.CARLISLE_BASE ?? 'http://127.0.0.1:5483';
const out = process.env.MACHINERY_OUT ?? 'art/carlisle-shipyard/machinery/review';
const lite = process.argv.includes('--lite');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base, lite, errors: [], views: [], carry: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.addInitScript(() => Object.defineProperty(navigator, 'getGamepads', { value: () => [] }));
  await page.goto(base + '/?playtest&level=carlisle-coast&art=harbour' + (lite ? '&lite' : ''), { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
  report.main = await page.evaluate(async () => {
    const g = window.__game; g.campaign.startEphemeral(); await g.getLevel().prepareJungleAssets();
    g.renderQualitySettings.setRegularResolution(null); g.crtGuestSettings.setEnabled(false);
    const l = g.getLevel(); return { art: l.carlisleShipyardDiagnostics, grounds: l.groundMeshes.length,
      crates: l.crates.length, movers: l.movers.length, wet: l.groundMeshes.filter(m => m.userData.slippy && m.visible && m.material.name === 'Harbour wet').length,
      build: document.querySelector('.hud-build')?.textContent };
  });
  assert.equal(report.main.art.status, 'ready'); assert.equal(report.main.grounds, 334); assert.equal(report.main.crates, 270);
  assert.equal(report.main.movers, 28); assert.equal(report.main.wet, 18);
  assert.equal(report.main.art.deckMachinery.hydraulicLifts, 4); assert.equal(report.main.art.deckMachinery.counterweightLifts, 4); assert.equal(report.main.art.deckMachinery.winches, 2);
  console.log('Loaded machinery', report.main.art.deckMachinery);
  for (const [id, name, offset, target, time] of (lite ? [
    ['tide-side', 'Tide steps · 2', [24, 1, 28], [0, -4, 0], 0],
    ['ballast-side', 'Counterweight 3', [32, 5, 34], [0, -8, 0], 0],
    ['winch-side', 'Port winch', [30, 3, 38], [0, -3, 0], 0],
  ] : [
    ['tide-side', 'Tide steps · 2', [24, 1, 28], [0, -4, 0], 0],
    ['tide-raised', 'Tide steps · 2', [24, 1, 28], [0, -4, 0], 2],
    ['tide-rider-view', 'Tide steps · 2', [12, 12, 27], [0, -1, -7], 2],
    ['ballast-side', 'Counterweight 3', [32, 5, 34], [0, -8, 0], 0],
    ['ballast-lowered', 'Counterweight 3', [32, 5, 34], [0, -8, 0], 9.4],
    ['ballast-overview', 'Counterweight 2', [30, 30, 52], [0, 0, -10], 3.14],
    ['winch-side', 'Port winch', [30, 3, 38], [0, -3, 0], 0],
    ['winch-out', 'Port winch', [30, 3, 38], [0, -3, 0], 3.49],
    ['winch-wheels', 'Port winch', [19, -1, 16], [7.4, -2, 11.1], 0],
  ])) {
    await page.evaluate(name => {
      const g = window.__game, l = g.getLevel(), m = l.movers.find(m => m.mesh.name === name);
      g.player.respawn(l, true, false, { position: m.mesh.localToWorld(m.mesh.position.clone().set(0, .85, 0)) });
    }, name);
    await page.waitForTimeout(200);
    const view = await page.evaluate(({ name, offset, target, time }) => {
      const g = window.__game, l = g.getLevel(), m = l.movers.find(m => m.mesh.name === name), c = g.camera.clone(), was = g.player.group.visible;
      // Staged review poses use the native updater; callbacks read that same pose.
      const savedTime = l.time; l.time = time; l.update(0); g.scene.updateMatrixWorld(true);
      g.player.group.visible = false;
      c.position.copy(m.mesh.localToWorld(m.mesh.position.clone().set(...offset)));
      c.lookAt(m.mesh.localToWorld(m.mesh.position.clone().set(...target))); c.fov = 52; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
      g.renderer.render(g.scene, c);
      const result = { url: g.renderer.domElement.toDataURL('image/png'), canvas: [g.renderer.domElement.width, g.renderer.domElement.height], deck: m.mesh.position.toArray(), render: { ...g.renderer.info.render } };
      g.player.group.visible = was; l.time = savedTime; l.update(0); return result;
    }, { name, offset, target, time });
    await writeFile(out + '/' + id + '.png', Buffer.from(view.url.split(',')[1], 'base64')); delete view.url; report.views.push({ id, name, time, ...view });
    assert.deepEqual(view.canvas, lite ? [960, 540] : [1920, 1080]);
  }
  if (!lite) {
    for (const name of ['Tide steps · 2', 'Counterweight 3', 'Port winch']) {
      await page.evaluate(name => {
        const g = window.__game, l = g.getLevel(), m = l.movers.find(m => m.mesh.name === name).mesh;
        g.player.respawn(l, true, false, { position: m.localToWorld(m.position.clone().set(0, .85, 1)) });
      }, name);
      await page.waitForFunction(() => window.__game.player.grounded);
      const carry = await page.evaluate(async name => {
        const g = window.__game, l = g.getLevel(), m = l.movers.find(m => m.mesh.name === name).mesh, p = g.player;
        const start = m.worldToLocal(p.pos.clone()).toArray(), from = m.position.toArray();
        for (let i = 0; i < 65; i++) await new Promise(requestAnimationFrame);
        return { name, start, end: m.worldToLocal(p.pos.clone()).toArray(), translation: m.position.toArray().map((v, i) => v - from[i]), surface: p.surfaceName, grounded: p.grounded, deaths: p.totalDeaths };
      }, name);
      assert.ok(carry.grounded); assert.equal(carry.deaths, 0);
      assert.ok(Math.hypot(carry.end[0] - carry.start[0], carry.end[2] - carry.start[2]) < .15);
      assert.ok(Math.hypot(...carry.translation) > .02); report.carry.push(carry);
      await page.screenshot({ path: out + '/' + name.split(' ')[0].toLowerCase() + '-native.png' });
    }
    await page.evaluate(() => { const g = window.__game; g.renderQualitySettings.setRegularResolution(480); g.crtGuestSettings.setEnabled(true); });
    await page.waitForTimeout(200); await page.screenshot({ path: out + '/winch-normal.png' });
    await page.evaluate(async () => { const g = window.__game; g.switchLevel('bonus-carlisle-coast'); await g.getLevel().prepareJungleAssets(); });
    report.bonus = await page.evaluate(() => { const l = window.__game.getLevel(); return { art: l.carlisleShipyardDiagnostics, movers: l.movers.length }; });
    assert.equal(report.bonus.art.status, 'ready'); assert.equal(report.bonus.movers, 4); assert.equal(report.bonus.art.deckMachinery.triangles, 0);
    await page.evaluate(async () => { const g = window.__game; g.switchLevel('carlisle-coast'); await g.getLevel().prepareJungleAssets(); });
    report.returned = await page.evaluate(() => window.__game.getLevel().carlisleShipyardDiagnostics);
    assert.equal(report.returned.status, 'ready'); assert.deepEqual(report.returned.deckMachinery, report.main.art.deckMachinery);
  }
  assert.deepEqual(report.errors, []); report.passed = true;
} finally { await writeFile(out + '/browser.json', JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, views: report.views.length, carry: report.carry, errors: report.errors }));
