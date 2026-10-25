import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:5417/';
const full = process.argv.includes('--full'), mode = full ? 'full' : 'lite';
const lifecycleOnly = process.argv.includes('--lifecycle-only');
const out = process.env.TREEHOUSE_STAIR_BROWSER_OUT || join(tmpdir(), 'treehouse-stair-browser');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [], rows = [];
let lifecycle;
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
  await page.goto(new URL(`?playtest&level=treehouse-trail${full ? '' : '&lite'}`, base).href);
  await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__game, p = g.player, l = g.getLevel();
    g.campaign.startEphemeral();
    window.stairWatch = { mounted: false, bailed: false, maxOffset: 0, frames: 0 };
    const native = p.commitRenderStep.bind(p);
    p.commitRenderStep = (...args) => {
      native(...args); const w = window.stairWatch, path = l.treehouseStairPath, at = path.locate(p.pos);
      w.frames++; w.mounted ||= path.blocksBoard(p.pos) && p.freeSkate; w.bailed ||= p.isBailing;
      if (at) w.maxOffset = Math.max(w.maxOffset, at.distance);
    };
  });
  const sample = label => page.evaluate(label => {
    const g = window.__game, p = g.player, l = g.getLevel();
    return { label, position: p.pos.toArray(), grounded: p.grounded, state: p.state, board: p.freeSkate,
      deaths: p.totalDeaths, lives: p.lives, snap: p.renderSnapVersion, currentSpawn: l.currentSpawn.toArray(),
      at: l.treehouseStairPath.locate(p.pos), watch: { ...window.stairWatch }, stamp: document.querySelector('.hud-build')?.textContent };
  }, label);
  const place = s => page.evaluate(s => {
    const g = window.__game, path = g.getLevel().treehouseStairPath, q = path.at(s);
    g.player.respawn(g.getLevel(), true, false, { position: g.player.pos.clone().set(q.x, q.y + .03, q.z) });
    window.stairWatch = { mounted: false, bailed: false, maxOffset: 0, frames: 0 };
  }, s);
  if (!lifecycleOnly) {
    const length = await page.evaluate(() => window.__game.getLevel().treehouseStairPath.length);
    await page.waitForFunction(() => window.__game.player.grounded);
    rows.push(await sample('supported balcony spawn'));
    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(() => {
      const g = window.__game, q = g.getLevel().treehouseStairPath.locate(g.player.pos);
      return g.player.pos.y < .3 && (!q || q.s > g.getLevel().treehouseStairPath.length - .3);
    }, null, { timeout: 15000 });
    await page.keyboard.up('ArrowDown'); rows.push(await sample('continuous keyboard descent'));
    await place(length - .5);
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => {
      const g = window.__game, q = g.getLevel().treehouseStairPath.locate(g.player.pos);
      return g.player.pos.y > 8.3 && (!q || q.s < .3);
    }, null, { timeout: 15000 });
    await page.keyboard.up('ArrowUp'); rows.push(await sample('continuous keyboard ascent'));
    await place(8);
    await page.keyboard.down('ArrowDown'); await page.waitForTimeout(650); await page.keyboard.up('ArrowDown');
    const turn = await sample('turn');
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(650); await page.keyboard.up('ArrowUp');
    const reversed = await sample('keyboard reversal'); rows.push(reversed);
    assert.ok(reversed.at.s < turn.at.s, 'real keyboard reversal travels uphill');
    await page.waitForTimeout(800); const stopped = await sample('stopped');
    await page.waitForTimeout(500); const still = await sample('still'); rows.push(still);
    assert.ok(Math.hypot(...still.position.map((v, i) => v - stopped.position[i])) < .001, 'release comes to rest');
    for (const s of [0, 4.4, 11.5, 17.5]) {
      await place(s); await page.waitForTimeout(150);
      await page.keyboard.down('Space'); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(850);
      const charge = await sample(`charge ${s}`); rows.push(charge); assert.equal(charge.board, false);
      await page.keyboard.up('Space');
      await page.waitForFunction(() => !window.__game.player.grounded, null, { timeout: 5000 });
      await page.keyboard.up('ArrowDown');
      await page.waitForFunction(() => window.__game.player.grounded, null, { timeout: 5000 });
      rows.push(await sample(`landed jump ${s}`));
    }
    await place(7.8); await page.waitForTimeout(300);
    if (full) await page.screenshot({ path: `${out}/full-stairs.png` });
    for (const row of rows) {
      assert.equal(row.watch.mounted, false, `${row.label}: mounted inside restricted area`);
      assert.equal(row.watch.bailed, false, `${row.label}: bailed`);
      assert.equal(row.deaths, 0, `${row.label}: died`);
      assert.ok(row.watch.maxOffset < .8, `${row.label}: strayed toward a stair edge`);
      assert.match(row.stamp, /Codex\/sol fork/);
    }
  }
  if (process.argv.includes('--lifecycle') || lifecycleOnly) {
    await page.evaluate(() => {
      const g = window.__game, l = g.getLevel(), cp = l.checkpoints[0];
      const position = cp.box.getCenter(g.player.pos.clone()).setY(cp.spawnPos.y + .03);
      g.player.respawn(l, true, false, { position });
    });
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => window.__game.getLevel().checkpoints[0].active, null, { timeout: 8000 });
    lifecycle = { checkpoint: await sample('checkpoint') };
    await page.evaluate(() => {
      const g = window.__game, p = g.player;
      window.stairFallSnap = p.renderSnapVersion;
      p.pos.y = g.getLevel().killY - 2; p.grounded = false; p.state = 'air'; p.vVel = -4;
    });
    await page.waitForFunction(() => {
      const g = window.__game, p = g.player;
      const spawn = g.getLevel().currentSpawn;
      return p.renderSnapVersion > window.stairFallSnap && p.grounded && Math.hypot(p.pos.x - spawn.x, p.pos.z - spawn.z) < 2;
    }, null, { timeout: 20000 });
    lifecycle.respawn = await sample('checkpoint respawn');
    await page.evaluate(() => {
      const g = window.__game, l = g.getLevel();
      const position = l.finishGlow.getCenter(g.player.pos.clone()).setY(l.gateSpec.y + .03);
      g.player.respawn(l, true, false, { position });
    });
    await page.waitForFunction(() => window.__game.player.state === 'finished', null, { timeout: 10000 });
    lifecycle.finish = await sample('finish gate');
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${mode} ${lifecycleOnly ? 'checkpoint, fall respawn and finish gate' : 'real keyboard descent/ascent, reversal, stop and charged jumps'} with clean console.`);
} finally {
  await writeFile(`${out}/${mode}.json`, JSON.stringify({ base, rows, lifecycle, errors, finalState: await page.evaluate(() => ({ position: window.__game?.player.pos.toArray(), watch: window.stairWatch })).catch(() => null) }, null, 2));
  await browser.close();
}
