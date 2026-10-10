import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:5354').replace(/\/$/, '');
const output = process.env.EDGE_REVIEW_OUTPUT || '/private/tmp/platform-edge-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { navigator.getGamepads = () => []; });
const errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const state = () => page.evaluate(() => {
  const p = window.__game.player;
  return { state: p.state, grounded: p.grounded, bail: p.isBailing, deaths: p.totalDeaths,
    position: p.pos.toArray(), t: p.grindT, balance: p.balance, balanceVel: p.balanceVel,
    sameRail: p.grindRail === window.__edgeReview.rail };
});
async function advance(frames) {
  await page.evaluate(frames => { window.__edgeReview.budget = frames; }, frames);
  await page.waitForFunction(() => window.__edgeReview.budget === 0, null, { timeout: 20000 });
  return state();
}
try {
  for (const lite of [true, false]) {
    await page.goto(`${base}/?playtest&level=codex-lab${lite ? '&lite' : ''}`, { timeout: 120000 });
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay,
      null, { timeout: 120000 });
    await page.evaluate(() => {
      const g = window.__game, p = g.player;
      const q = window.__edgeReview = { budget: 0, rail: null, sawDeath: false };
      const step = p.step.bind(p), consume = g.input.consumeEdges.bind(g.input);
      g.input.consumeEdges = () => {};
      p.step = (dt, input, level) => {
        if (q.budget <= 0) return;
        step(dt, input, level); consume(); q.budget--;
        if (p.state === 'dead') q.sawDeath = true;
        if (p.state === 'finished') q.budget = 0;
      };
    });
    const spawn = await advance(20);
    assert.equal(spawn.grounded, true, 'spawn must remain supported');
    for (const kind of ['box', 'curve', 'ice']) {
      for (const key of ['KeyE', 'ArrowLeft', 'ArrowRight']) await page.keyboard.up(key);
      const fixture = await page.evaluate(kind => {
        const g = window.__game, p = g.player, l = g.getLevel(), q = window.__edgeReview;
        let rail, component;
        if (kind === 'curve') rail = l.surfaceEdgeRails.find(r => r.points.length > 8 && r.totalLength > 30 &&
          r.points.every(v => v.y > -5) && Math.abs(r.tangentAt(0).dot(r.tangentAt(r.totalLength))) < .999);
        else for (const mesh of l.groundMeshes) {
          const c = l.builtFromData?.components[mesh.userData.editorIdx];
          if (!c || c.invisible || c.edgeGrinding === false || (kind === 'ice' ? !c.slip : c.t !== 'platform')) continue;
          mesh.geometry.computeBoundingBox();
          const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).expandByScalar(.08);
          rail = l.surfaceEdgeRails.find(r => r.totalLength > (kind === 'ice' ? 20 : 7) && r.points.every(v => box.containsPoint(v)) &&
            r.pointAt(r.totalLength / 2).y > box.max.y - .2);
          if (rail) { component = c.nm; break; }
        }
        if (!rail) throw Error(`No restored ${kind} rail`);
        q.rail = rail;
        const t = rail.totalLength * .3, position = rail.pointAt(t); position.y += .15;
        const heading = rail.tangentAt(t);
        p.respawn(l, true, true, { position, heading });
        p.state = 'air'; p.grounded = false; p.freeSkate = p.airFromSkate = true;
        p.speed = 8; p.vVel = 0;
        g.input.update();
        return { component, length: rail.totalLength, vertices: rail.points.length, t };
      }, kind);
      await page.keyboard.down('KeyE');
      let current = await advance(1);
      assert.equal(current.state, 'grind', JSON.stringify({ kind, fixture, current }));
      assert.equal(current.sameRail, true);
      const frames = kind === 'box' ? 20 : 60;
      for (let i = 0; i < frames; i += 4) {
        const correction = current.balance * 5 + current.balanceVel * .7;
        for (const key of ['ArrowLeft', 'ArrowRight']) await page.keyboard.up(key);
        if (Math.abs(correction) > .15) await page.keyboard.down(correction > 0 ? 'ArrowLeft' : 'ArrowRight');
        current = await advance(4);
        assert.equal(current.state, 'grind', JSON.stringify({ kind, fixture, current, frame: i }));
        assert.equal(current.sameRail, true);
        assert.equal(current.bail, false);
      }
      results.push({ lite, kind, fixture, current });
      if (!lite) await page.screenshot({ path: `${output}/full-${kind}.png` });
    }
    for (const key of ['KeyE', 'ArrowLeft', 'ArrowRight']) await page.keyboard.up(key);
    // Supported checkpoint warp and a real kill-plane fall/respawn use the
    // same unmodified level; only the initial fall fixture is placed here.
    if (!await page.evaluate(() => window.__game.gameFlow.developerChromeVisible))
      await page.keyboard.press('KeyM');
    await page.keyboard.press('KeyL');
    const checkpoint = await advance(30);
    assert.equal(checkpoint.grounded, true, JSON.stringify(checkpoint));
    await page.evaluate(() => {
      const g = window.__game, p = g.player, l = g.getLevel();
      p.pos.y = l.killY - 2; p.prevPos.copy(p.pos); p.grounded = false; p.state = 'air'; p.vVel = -5;
    });
    const recovered = await advance(240);
    assert.ok(await page.evaluate(() => window.__edgeReview.sawDeath), 'fall must trigger death');
    assert.equal(recovered.grounded, true, 'fall must respawn on supported ground');
    results.push({ lite, kind: 'checkpoint-and-fall', checkpoint, recovered });
    await page.evaluate(() => {
      const g = window.__game, l = g.getLevel(), p = g.player;
      const position = l.finishGlow.getCenter(p.pos.clone()); position.y += .3;
      p.respawn(l, true, false, { position });
    });
    const finish = await advance(120);
    assert.equal(finish.state, 'finished', 'supported finish pad must still clear the course');
    results.push({ lite, kind: 'finish', finish });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS native keyboard platform/curve/ice grinds, spawn, checkpoint, fall recovery and finish in lite/full Chrome; clean console.`);
} finally {
  await writeFile(`${output}/review.json`, JSON.stringify({ base, results, errors }, null, 2));
  await browser.close();
}
