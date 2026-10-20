// Scene smoke test using the real renderer, assets and native keyboard input.
// PLAYWRIGHT_MODULE can point at a locally bundled Playwright package.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5198/';
const out = process.env.ROOM_REVIEW_OUT || '/private/tmp/treehouse-room-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [], errors = [];
try {
  for (const lite of [true, false]) {
    const mode = lite ? 'lite' : 'full';
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // Test this source scene's roundtrip in a clean editor project. The live
    // shared pack already consumes almost all of its independent 16 MiB cap.
    await page.route('**/levels.json*', route => route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ v: 2, levels: [] }) }));
    await page.addInitScript(() => { Object.defineProperty(navigator, 'getGamepads', { value: () => [] }); });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const url = new URL(base); url.search = `?playtest&level=inside-your-room${lite ? '&lite' : ''}`;
    await page.goto(url.href);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    await page.evaluate(async () => { await window.__game.getLevel().prepareSurfaceImages(); window.__game.campaign.startEphemeral(); });
    await page.waitForTimeout(700);
    const sample = () => page.evaluate(() => {
      const g = window.__game, l = g.getLevel();
      return { name: l.name, position: g.player.pos.toArray(), grounded: g.player.grounded, state: g.player.state,
        deaths: g.player.totalDeaths, lives: g.player.lives, snap: g.player.renderSnapVersion,
        camera: g.camera.position.toArray(), frame: g.getRenderFrameStats(),
        checkpoint: l.checkpoints[0]?.active, currentSpawn: l.currentSpawn.toArray() };
    });
    const stage = position => page.evaluate(position => {
      const g = window.__game;
      g.player.respawn(g.getLevel(), true, false, { position: g.player.pos.clone().set(...position), heading: g.player.camDir.clone().set(0, 0, -1) });
    }, position);
    const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
    const report = { mode, spawn: await sample() };
    reports.push(report);
    assert.equal(report.spawn.name, 'Inside Your Room');
    assert.equal(report.spawn.grounded, true);
    assert.match(await page.locator('.hud-build').textContent(), /Codex\/sol fork/);
    report.art = await page.evaluate(() => {
      const g = window.__game, l = g.getLevel(), data = l.captureData(), maps = new Map();
      l.root.traverse(o => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!String(m.userData.texKind).startsWith('room-')) continue;
          maps.set(m.userData.texKind, { width: m.map?.image?.width, height: m.map?.image?.height, alphaTest: m.alphaTest, basic: !!m.isMeshBasicMaterial });
        }
      });
      const copy = g.saveUserLevel({ id: '', name: 'Room editor roundtrip smoke', data });
      return { maps: Object.fromEntries(maps), posterCount: data.components.filter(c => c.nm?.startsWith('Poster · ')).length,
        matteCount: data.components.filter(c => /· (28m|9m|1.8m)$/.test(c.nm || '')).length,
        copy, jsonBytes: JSON.stringify(data).length, components: data.components.length };
    });
    assert.ok(report.art.copy, 'source geometry passes the real editor import/save boundary');
    assert.equal(report.art.posterCount, 4);
    assert.equal(report.art.matteCount, 9);
    for (const name of ['room-timber', 'room-bark', 'room-rug', 'room-poster-coast', 'room-poster-canopy', 'room-poster-orbit', 'room-shore', 'room-jungle', 'room-balustrade'])
      assert.ok(report.art.maps[name]?.width >= 768, `${name}: decoded full image`);
    for (const name of ['room-jungle', 'room-balustrade']) {
      assert.equal(report.art.maps[name].basic, true);
      assert.ok(report.art.maps[name].alphaTest > 0, `${name}: actual alpha cutout`);
    }
    await page.screenshot({ path: `${out}/${mode}-room.png` });

    await hold('Space', 300);
    await page.waitForFunction(() => window.__game.player.pos.y > .3, null, { timeout: 5000 });
    await page.waitForFunction(() => window.__game.player.grounded, null, { timeout: 8000 });
    report.jump = await sample(); assert.equal(report.jump.deaths, 0);

    await stage([2.7, .05, -1.8]);
    await hold('ArrowUp', 1400); report.cabinet = await sample();
    assert.ok(report.cabinet.position[2] > -3.65, 'cabinet stops the player before its front');
    await stage([4.7, .05, -.1]);
    await hold('ArrowRight', 1200); report.wall = await sample();
    assert.ok(report.wall.position[0] < 6, 'window wall contains the player');

    for (const [name, pos] of [['window', [-2.65, .05, -1.9]], ['television', [2.2, .05, -.6]]]) {
      await stage(pos); await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/${mode}-${name}.png` });
    }
    // Walk from the room to the recessed exit using the actual keyboard.
    await stage([-.4, .05, -.35]);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__game.player.pos.x > 4.45, null, { timeout: 10000 });
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(() => window.__game.player.pos.z > 6.7, null, { timeout: 10000 });
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => window.__game.getLevel().checkpoints[0].active, null, { timeout: 8000 });
    await page.keyboard.up('ArrowDown');
    report.checkpoint = await sample(); assert.equal(report.checkpoint.checkpoint, true);
    await page.evaluate(() => { const p = window.__game.player; p.pos.set(12, 1, 0); p.vVel = -4; p.grounded = false; p.state = 'air'; });
    await page.waitForFunction(() => Math.abs(window.__game.player.pos.x - 4.6) < 1 && Math.abs(window.__game.player.pos.z - 8.2) < 1 && window.__game.player.grounded, null, { timeout: 15000 })
      .catch(async e => { report.fallFailure = await sample(); throw e; });
    report.respawn = await sample();
    assert.ok(report.respawn.snap > report.checkpoint.snap, 'actual respawn resets the render pose');
    assert.ok(Math.abs(report.respawn.position[2] - 8.2) < 1, 'kill plane returns to the earned checkpoint');
    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(() => window.__game.player.pos.z > 10, null, { timeout: 8000 });
    await hold('Space', 320);
    await page.waitForFunction(() => window.__game.player.state === 'finished' || window.__game.gameFlow.blocksGameplay, null, { timeout: 15000 });
    await page.keyboard.up('ArrowDown');
    report.finish = await sample();
    assert.equal(report.finish.state, 'finished');
    await page.close();
  }
  assert.deepEqual(errors, [], 'no browser console errors');
  console.log(JSON.stringify({ reports, errors, out }, null, 2));
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify({ reports, errors }, null, 2));
  await browser.close();
}
