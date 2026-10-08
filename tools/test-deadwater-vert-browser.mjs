// Actual recorded inputs plus native keyboard launches on the authored pools.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:5273').replace(/\/$/, '');
const output = process.env.VERT_REVIEW_OUTPUT || '/private/tmp/deadwater-vert-review';
const recording = JSON.parse(await readFile(new URL('./fixtures/deadwater-vert-replay.json', import.meta.url), 'utf8'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { navigator.getGamepads = () => []; });
const errors = [], results = [], stamps = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
async function advance(frames, stop) {
  await page.evaluate(({ frames, stop }) => Object.assign(window.__vertReview, { frames, stop }), { frames, stop });
  await page.waitForFunction(() => window.__vertReview.frames === 0, null, { timeout: 15000 });
  return page.evaluate(() => {
    const g = window.__game, p = g.player, l = g.getLevel();
    return { pos: p.pos.toArray(), speed: p.speed, vy: p.vVel, vert: p.vertAir, grounded: p.grounded,
      tracked: p.vertTracked, normal: p.vertNormal.toArray(), pipe: l.halfpipes.indexOf(p.hangPipe),
      contact: l.halfpipes.indexOf(p.groundHit?.halfpipe), bail: p.isBailing };
  });
}
try {
  for (const lite of [true, false]) {
    await page.goto(`${base}/?playtest&level=waterpark-cup${lite ? '&lite' : ''}`, { timeout: 120000 });
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    await page.evaluate(recording => {
      const g = window.__game, p = g.player;
      const q = window.__vertReview = { step: p.step.bind(p), feed: g.replayer.feed.bind(g.replayer),
        consume: g.input.consumeEdges.bind(g.input), frames: 0, stop: '' };
      p.step = () => {}; g.replayer.feed = () => true;
      g.loadReplay(recording); g.competitionAction('retry');
    }, recording);
    await page.waitForFunction(() => window.__game.getCompetition()?.phase === 'running', null, { timeout: 20000 });
    const recorded = await page.evaluate(() => {
      const g = window.__game, p = g.player, l = g.getLevel(), q = window.__vertReview;
      let launch;
      while (g.replayer.frame < 550) {
        q.feed(g.input, p.camDir); q.step(1 / 60, g.input, l); l.update(1 / 60);
        p.flushLevelCrateRewards(l); p.commitRenderStep(l); q.consume();
        if (g.replayer.frame === 510) launch = { normal: p.vertNormal.toArray(), pipe: l.halfpipes.indexOf(p.hangPipe), vert: p.vertAir };
      }
      return launch;
    });
    assert.equal(recorded.vert, true); assert.equal(recorded.pipe, 2); assert.ok(recorded.normal[2] > .99);
    await page.screenshot({ path: `${output}/replay-${lite ? 'lite' : 'full'}.png` });
    results.push({ lite, recorded });
    await page.evaluate(() => {
      const g = window.__game, p = g.player, q = window.__vertReview;
      g.replayer.end(); g.replayer.feed = q.feed; g.input.consumeEdges = () => {};
      p.step = (dt, input, level) => {
        if (q.frames <= 0) return;
        q.step(dt, input, level); q.consume(); q.frames--;
        if (q.stop === 'steep' && p.grounded && p.rideNormal.y < .16 ||
            q.stop === 'launch' && p.vertAir || q.stop === 'landing' && p.grounded) q.frames = 0;
      };
      g.getCompetition().remaining = 600;
    });
    for (const index of [2, 5]) for (const side of [-1, 1]) for (const release of [false, true]) {
      await page.keyboard.up('Space');
      await page.evaluate(({ index, side }) => {
        const g = window.__game, p = g.player, l = g.getLevel(), hp = l.halfpipes[index];
        const position = hp.worldPos(side * (hp.flatHalf + hp.radius * Math.PI / 3), (hp.l0 + hp.l1) / 2, p.pos.clone());
        const heading = p.axisF.clone().set(hp.axis === 'z' ? side : 0, 0, hp.axis === 'x' ? side : 0);
        p.respawn(l, true, true, { position, heading }); p.pos.copy(position); p.prevPos.copy(position);
        p.axisF.copy(heading); p.axisL.set(heading.z, 0, -heading.x); p.speed = 23; p.freeSkate = true;
        p.groundHit = p.queryGround(l); p.rideNormal.copy(p.groundHit.normal); g.input.update(); window.__vertReview.consume();
      }, { index, side });
      await page.keyboard.down('Space');
      if (release) { await advance(90, 'steep'); await page.keyboard.up('Space'); }
      const launch = await advance(90, 'launch');
      assert.equal(launch.vert, true); assert.equal(launch.pipe, index);
      assert.ok((index === 2 ? launch.normal[2] : launch.normal[0]) * side < -.99);
      const landed = await advance(180, 'landing');
      assert.equal(landed.grounded, true); assert.equal(landed.contact, index); assert.equal(landed.bail, false);
      assert.ok(landed.speed > 8);
      results.push({ lite, index, side, release, launch, landed });
    }
    await page.keyboard.up('Space');
    const stamp = await page.locator('.hud-build').textContent(); assert.match(stamp, /Codex\/sol fork/); stamps.push(stamp);
  }
  assert.deepEqual(errors, []);
  console.log('PASS recorded coping launch plus 16 native keyboard airs and returns on authored Deadwater pools; lite/full rendering, clean consoles and build stamps.');
} finally {
  await writeFile(`${output}/review.json`, JSON.stringify({ base, stamps, results, errors }, null, 2));
  await browser.close();
}
