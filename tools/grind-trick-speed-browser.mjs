// Actual keyboard/Input/Player checks on authored competition and campaign rails.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:5241').replace(/\/$/, '');
const output = process.env.GRIND_REVIEW_OUTPUT || '/private/tmp/grind-trick-speed-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { navigator.getGamepads = () => []; });
const errors = [], results = [], stamps = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const keys = ['KeyE', 'Space', 'KeyF', 'KeyQ', 'ArrowLeft', 'ArrowRight'];
const state = () => page.evaluate(() => {
  const p = window.__game.player, q = window.__speedReview;
  return { state: p.state, bail: p.isBailing, speed: p.speed, pos: p.pos.toArray(), flip: p.flipT,
    spin: p.grabSpinAngle, labels: [...p.comboLabels], rail: p.grindRail === q.rail,
    competition: p.competitionMode, boost: window.__game.TUNING.grindTrickBoost };
});
async function advance(frames, stop = false) {
  await page.evaluate(({ frames, stop }) => { Object.assign(window.__speedReview, { frames, stop }); }, { frames, stop });
  await page.waitForFunction(() => window.__speedReview.frames === 0, null, { timeout: 15000 });
  return state();
}
async function setup(boost) {
  for (const key of keys) await page.keyboard.up(key);
  await page.evaluate(boost => {
    const g = window.__game, p = g.player, l = g.getLevel(), q = window.__speedReview;
    g.TUNING.grindTrickBoost = boost;
    if (g.getCompetition()) g.getCompetition().remaining = 600;
    const heading = q.rail.tangentAt(q.t), position = q.rail.pointAt(q.t); position.y += .25;
    p.respawn(l, true, true, { position, heading });
    p.pos.copy(position); p.prevPos.copy(position); p.axisF.copy(heading); p.axisF.y = 0; p.axisF.normalize(); p.axisL.set(p.axisF.z, 0, -p.axisF.x);
    p.state = 'air'; p.grounded = false; p.freeSkate = p.airFromSkate = true;
    p.speed = 8; p.vVel = 0; p.balanceBoostT = 100;
    g.input.update(); q.consume();
  }, boost);
  await page.keyboard.down('KeyE');
  const caught = await advance(12); assert.equal(caught.state, 'grind'); assert.equal(caught.rail, true);
}
async function run(kind, boost) {
  await setup(boost);
  await page.keyboard.down('Space'); await advance(24);
  await page.keyboard.up('Space'); const launch = await advance(1); assert.equal(launch.state, 'air');
  await page.keyboard.up('KeyE'); await advance(1);
  if (kind === 'flip') await page.keyboard.down('KeyF');
  if (kind === 'grab') await page.keyboard.down('KeyQ');
  if (kind === 'spin') await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyE');
  const mid = await advance(kind === 'spin' ? 22 : 6);
  if (kind === 'flip') assert.ok(mid.flip > 0);
  await page.keyboard.up('KeyF'); await page.keyboard.up('KeyQ'); await page.keyboard.up('ArrowRight');
  const landed = await advance(150, true);
  assert.equal(landed.state, 'grind', JSON.stringify({ kind, boost, launch, landed }));
  assert.equal(landed.rail, true); assert.equal(landed.bail, false);
  return { launch, landed };
}
try {
  for (const lite of [true, false]) for (const level of ['jungle-cup', 'slip']) {
    await page.goto(`${base}/?playtest&level=${level}${lite ? '&lite' : ''}`, { timeout: 120000 });
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
    if (level === 'jungle-cup') {
      await page.evaluate(() => window.__game.competitionAction('retry'));
      await page.waitForFunction(() => window.__game.getCompetition()?.phase === 'running', null, { timeout: 20000 });
    }
    const railInfo = await page.evaluate(level => {
      const g = window.__game, p = g.player, l = g.getLevel();
      let rail, t = 1.5;
      if (level === 'jungle-cup') rail = l.grindRails.find(r => Math.abs(r.pointAt(r.totalLength / 2).x + 22) < .1 && !r.coping);
      else {
        // Choose an authored straight stretch with room for the launch and
        // return; do not edit the course to make a curved-rail hop catch.
        let best = Infinity;
        for (const r of l.grindRails) for (let at = 2; at < r.totalLength - 22; at += 2) {
          const a = r.pointAt(at), tangent = r.tangentAt(at); let cost = Math.abs(tangent.y) * 3;
          for (let d = 2; d <= 20; d += 2) {
            const delta = r.pointAt(at + d).sub(a);
            cost += delta.clone().cross(tangent).length();
          }
          if (cost < best) { best = cost; rail = r; t = at; }
        }
      }
      if (!rail) throw new Error('authored test rail missing');
      const q = window.__speedReview = { rail, t, frames: 0, stop: false, consume: g.input.consumeEdges.bind(g.input) };
      const step = p.step.bind(p); g.input.consumeEdges = () => {};
      p.step = (dt, input, level) => {
        if (q.frames <= 0) return;
        step(dt, input, level); q.consume(); q.frames--;
        if (q.stop && (p.state === 'grind' || p.grounded || p.isBailing)) q.frames = 0;
      };
      return { index: l.grindRails.indexOf(rail), length: rail.totalLength, t, competition: p.competitionMode };
    }, level);
    for (const kind of ['plain', 'flip', 'grab', 'spin']) {
      const control = await run(kind, 0), reward = await run(kind, 3);
      assert.equal(reward.landed.competition, level === 'jungle-cup');
      assert.ok(Math.abs(reward.landed.speed - control.landed.speed - (kind === 'plain' ? 0 : 3)) < 1e-6,
        JSON.stringify({ level, kind, control, reward }));
      assert.deepEqual(reward.landed.labels, control.landed.labels);
      if (!lite && kind === 'flip') await page.screenshot({ path: `${output}/${level}-full-trick-catch.png` });
      results.push({ lite, level, kind, railInfo, control, reward });
    }
    const stamp = await page.locator('.hud-build').textContent(); assert.match(stamp, /Codex\/sol fork/); stamps.push(stamp);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${results.length} native keyboard reward comparisons (${results.length * 2} flights), authored Jungle Cup and The Slipstream rails, lite/full Chrome; clean consoles and build stamps.`);
} finally {
  await writeFile(`${output}/review.json`, JSON.stringify({ base, stamps, results, errors }, null, 2));
  await browser.close();
}
