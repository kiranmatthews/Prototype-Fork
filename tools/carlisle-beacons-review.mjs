import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const baseline = process.argv.includes('--baseline');
const lite = process.argv.includes('--lite');
const base = process.env.CARLISLE_BASE ?? 'http://127.0.0.1:5483';
const out = process.env.BEACONS_OUT ?? `art/carlisle-shipyard/beacons/${baseline ? 'before' : lite ? 'lite' : 'review'}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base, baseline, lite, errors: [], views: [] };
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
    const l = g.getLevel(), yard = l.carlisleShipyard;
    return { art: l.carlisleShipyardDiagnostics, grounds: l.groundMeshes.length, crates: l.crates.length,
      movers: l.movers.length, wet: l.groundMeshes.filter(m => m.userData.slippy && m.visible && m.material.name === 'Harbour wet').length,
      towers: yard.placements.filter(p => p.kind === 'harbour-beacon'), build: document.querySelector('.hud-build')?.textContent };
  });
  assert.equal(report.main.art.status, 'ready'); assert.equal(report.main.grounds, 334);
  assert.equal(report.main.crates, 270); assert.equal(report.main.movers, 28); assert.equal(report.main.wet, 18);
  assert.equal(report.main.towers.length, 4);
  if (!baseline) assert.deepEqual(report.main.art.beacons, { beacons: 4, shafts: 4, decorativeColliders: 0 });
  console.log('Loaded four harbour beacons', report.main.build);

  const capture = async (id, tower, offset, targetOffset, phase = 0) => {
    const p = report.main.towers[tower].p;
    // Native respawn selects the nearby authored checkpoint and activates its scenery.
    await page.evaluate(p => {
      const g = window.__game, l = g.getLevel();
      const cps = l.checkpoints.slice().sort((a, b) => Math.abs(a.spawnPos.z - p[2]) - Math.abs(b.spawnPos.z - p[2]));
      g.player.respawn(l, true, false, { position: cps[0].spawnPos.clone() });
    }, p);
    await page.waitForTimeout(200);
    const image = await page.evaluate(({ tower, offset, targetOffset, phase, baseline }) => {
      const g = window.__game, yard = g.getLevel().carlisleShipyard, place = yard.placements.filter(p => p.kind === 'harbour-beacon')[tower];
      let beacon;
      if (!baseline) {
        const e = yard.beacons.entries[tower];
        const at = (Math.atan2(e.outward.z, e.outward.x) - e.phase + Math.PI * 4) % (Math.PI * 2) * e.period / (Math.PI * 2);
        yard.beacons.update(at + phase);
        beacon = { origin: e.mesh.position.toArray(), direction: e.direction.toArray(), outward: e.outward.toArray(), power: e.mesh.material.uniforms.power.value, visible: e.mesh.visible };
      }
      const c = g.camera.clone(), visible = g.player.group.visible;
      g.player.group.visible = false;
      c.position.set(...place.p.map((v, i) => v + offset[i]));
      c.lookAt(...place.p.map((v, i) => v + targetOffset[i])); c.fov = 52; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
      g.renderer.render(g.scene, c);
      const result = { url: g.renderer.domElement.toDataURL('image/png'), canvas: [g.renderer.domElement.width, g.renderer.domElement.height], beacon, render: { ...g.renderer.info.render } };
      g.player.group.visible = visible;
      return result;
    }, { tower, offset, targetOffset, phase, baseline });
    await writeFile(out + '/' + id + '.png', Buffer.from(image.url.split(',')[1], 'base64'));
    delete image.url; report.views.push({ id, tower, phase, offset, targetOffset, ...image });
    assert.deepEqual(image.canvas, [1920, 1080]);
  };
  for (const row of (lite ? [
    ['lens', 3, [31, 72, 36], [0, 66, 0], 0],
  ] : [
    ['lens', 3, [31, 72, 36], [0, 66, 0], 0],
    ['lens-turn', 3, [31, 72, 36], [0, 66, 0], 7],
    ['beacon-apex', 3, [75, 175, 150], [-45, 26, -60], 0],
    ['beacon-sweep', 3, [75, 175, 150], [-45, 26, -60], 4],
    ['beacon-landward', 3, [75, 175, 150], [-45, 26, -60], 16],
    ['harbour-beacon', 0, [80, 85, 140], [-35, 25, -45], 0],
    ['crown-beacon', 1, [100, 90, 145], [0, 30, -45], 0],
    ['homecoming-beacon', 2, [-95, 90, 145], [0, 30, -45], 0],
  ])) await capture(...row);
  if (!baseline) {
    report.cycle = await page.evaluate(() => {
      const b = window.__game.getLevel().carlisleShipyard.beacons;
      const results = b.entries.map(e => ({ active: 0, inward: 0, minPower: Infinity, maxPower: 0, maxLengthError: 0 }));
      for (let t = 0; t < 132; t += .125) {
        b.update(t);
        b.entries.forEach((e, i) => {
          const r = results[i], power = e.mesh.material.uniforms.power.value;
          r.minPower = Math.min(r.minPower, power); r.maxPower = Math.max(r.maxPower, power);
          r.maxLengthError = Math.max(r.maxLengthError, Math.abs(e.direction.length() - 1));
          if (e.mesh.visible) { r.active++; if (e.direction.dot(e.outward) < .5) r.inward++; }
        });
      }
      return results;
    });
    for (const row of report.cycle) { assert.ok(row.active > 0); assert.equal(row.inward, 0); assert.equal(row.minPower, 0); assert.ok(row.maxLengthError < 1e-10); }
    // Native camera: let the clock and player update normally after staged views.
    await page.waitForTimeout(350);
    await page.screenshot({ path: out + '/native-camera.png' });
    await page.evaluate(() => { const g = window.__game; g.renderQualitySettings.setRegularResolution(480); g.crtGuestSettings.setEnabled(true); });
    await page.waitForTimeout(200); await page.screenshot({ path: out + '/normal-camera.png' });
    await page.evaluate(async () => { const g = window.__game; g.switchLevel('bonus-carlisle-coast'); await g.getLevel().prepareJungleAssets(); });
    report.bonus = await page.evaluate(() => { const l = window.__game.getLevel(); return { art: l.carlisleShipyardDiagnostics, movers: l.movers.length }; });
    assert.equal(report.bonus.art.status, 'ready'); assert.equal(report.bonus.movers, 4); assert.equal(report.bonus.art.beacons.beacons, 0);
    await page.evaluate(async () => { const g = window.__game; g.switchLevel('carlisle-coast'); await g.getLevel().prepareJungleAssets(); });
    report.returned = await page.evaluate(() => window.__game.getLevel().carlisleShipyardDiagnostics);
    assert.equal(report.returned.status, 'ready'); assert.equal(report.returned.beacons.beacons, 4);
  }
  assert.deepEqual(report.errors, []); report.passed = true;
} finally {
  await writeFile(out + '/browser.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify({ passed: report.passed, views: report.views.length, cycle: report.cycle, errors: report.errors }));
