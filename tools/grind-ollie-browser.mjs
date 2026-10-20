// Real keyboard / production Input / fixed-step Player smoke test. Fixture
// setup places the rider above Jungle Cup's south bar; subsequent motion is
// native input. Two temporary parallel bars exercise transfers in both ways.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:5218').replace(/\/$/, '');
const output = process.env.GRIND_REVIEW_OUTPUT || '/private/tmp/grind-ollie-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// This is a keyboard fixture: a physical controller connected to the host
// must not merge a held Cross/stick into the scripted keyboard releases.
await page.addInitScript(() => { navigator.getGamepads = () => []; });
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const keys = ['KeyE', 'Space', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyT'];
const state = () => page.evaluate(() => {
  const p = window.__game.player;
  return { state: p.state, grounded: p.grounded, bail: p.isBailing, pos: p.pos.toArray(), spin: p.grabSpinAngle,
    rail: window.__railReview.rails.indexOf(p.grindRail), labels: [...p.comboLabels], speed: p.speed,
    lateralX: p.axisL.x * p.grindAirLat, camera: p.camDir.toArray(), verticalSpeed: p.vVel,
    catchGrace: p.grindOllieCatchGrace, combo: p.comboMult,
    charging: p.charging, charge: p.chargeTimer, releaseGuard: p.jumpReleaseRearmRequired };
});
async function advance(frames, stopOnContact = false) {
  await page.evaluate(({ frames, stopOnContact }) => { Object.assign(window.__railReview, { budget: frames, stopOnContact }); }, { frames, stopOnContact });
  await page.waitForFunction(() => window.__railReview.budget === 0, null, { timeout: 15000 });
  return state();
}
async function setup(park) {
  for (const key of keys) await page.keyboard.up(key);
  await page.evaluate(park => {
    const g = window.__game, p = g.player, l = g.getLevel(), q = window.__railReview, rail = q.rails[0];
    g.getCompetition().remaining = 600;
    for (const r of q.rails) { r.grindable = true; r.object.visible = true; }
    l.skatepark = park;
    const heading = rail.tangentAt(1.5), position = rail.pointAt(1.5); position.y += .25;
    p.respawn(l, true, true, { position, heading });
    p.pos.copy(position); p.prevPos.copy(position); p.axisF.copy(heading); p.axisL.set(heading.z, 0, -heading.x);
    p.state = 'air'; p.grounded = false; p.freeSkate = p.airFromSkate = true;
    p.speed = 8; p.vVel = 0; p.balanceBoostT = 10; q.samples = [];
    // Settle the fixture's released keys in the production poll before
    // clearing their edges; do not inherit the preceding case's held state.
    g.input.update();
    q.consume();
  }, park);
  await page.keyboard.down('KeyE');
  const caught = await advance(12);
  assert.equal(caught.state, 'grind'); assert.equal(caught.rail, 0);
}
async function pop(side = 0) {
  await page.keyboard.down('Space'); await advance(20);
  if (side) await page.keyboard.down(side < 0 ? 'ArrowLeft' : 'ArrowRight');
  await advance(4);
  await page.keyboard.up('Space');
  const launched = await advance(1); assert.equal(launched.state, 'air', JSON.stringify(launched)); return launched;
}
try {
  for (const lite of [true, false]) {
    await page.goto(`${base}/?playtest&level=jungle-cup${lite ? '&lite' : ''}`, { timeout: 120000 });
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
    await page.evaluate(() => window.__game.competitionAction('retry'));
    await page.waitForFunction(() => window.__game.getCompetition()?.phase === 'running', null, { timeout: 20000 });
    await page.evaluate(() => {
      const g = window.__game, p = g.player, l = g.getLevel();
      const rail = l.grindRails.find(r => Math.abs(r.pointAt(r.totalLength / 2).x + 22) < .1 && !r.coping);
      if (!rail) throw new Error('south bar missing');
      const q = window.__railReview = { budget: 0, stopOnContact: false, rails: [rail], samples: [] };
      for (const side of [-1, 1]) {
        const other = new rail.constructor(rail.points.map(point => { const v = point.clone(); v.x += side * 3.6; return v; }));
        l.rails.push(other); l.grindRails.push(other); l.root.add(other.object); q.rails.push(other);
      }
      g.scene.updateMatrixWorld(true);
      const step = p.step.bind(p); q.consume = g.input.consumeEdges.bind(g.input);
      // Keep event edges until the next requested simulation tick. Held
      // buttons and their mapping still come from the production Input.
      g.input.consumeEdges = () => {};
      p.step = (dt, input, level) => {
        if (q.budget <= 0) return;
        step(dt, input, level); q.consume(); q.budget--;
        q.samples.push({ state: p.state, x: p.pos.x, y: p.pos.y, z: p.pos.z, spin: p.grabSpinAngle, bail: p.isBailing });
        if (q.stopOnContact && (p.state === 'grind' || p.grounded || p.isBailing)) q.budget = 0;
      };
    });
    for (const park of [false, true]) {
      await setup(park); const launch = await pop();
      await page.keyboard.up('KeyE'); await advance(1);
      await page.keyboard.down('ArrowRight'); await page.keyboard.down('KeyE');
      const mid = await advance(22);
      assert.equal(mid.state, 'air'); assert.ok(Math.abs(mid.spin) > Math.PI / 2);
      assert.ok(Math.abs(mid.pos[0] - launch.pos[0]) < 1e-5);
      if (!lite && park) await page.screenshot({ path: `${output}/full-neutral-spin.png` });
      await page.keyboard.up('ArrowRight');
      const landed = await advance(80, true);
      assert.equal(landed.state, 'grind'); assert.equal(landed.rail, 0); assert.equal(landed.bail, false);
      assert.ok(landed.labels.some(label => label.includes('180')));
      results.push({ lite, park, case: 'neutral-spin-fresh-catch', launch, mid, landed });

      for (const held of [false, true]) {
        await setup(park); const launch = await pop();
        await page.keyboard.up('KeyE'); await advance(1);
        if (held) await page.keyboard.down('KeyE');
        let near = await state();
        for (let i = 0; i < 80 && !(near.verticalSpeed < 0 && near.pos[1] - launch.pos[1] < 1.1); i++)
          near = await advance(1);
        assert.equal(near.state, 'air');
        if (!held) { await page.keyboard.down('KeyE'); await advance(1); }
        await page.keyboard.up('KeyE');
        const released = await state();
        const landed = await advance(80, true);
        assert.equal(landed.state, 'grind'); assert.equal(landed.rail, 0); assert.equal(landed.bail, false);
        assert.ok(landed.combo >= 2); assert.equal(landed.catchGrace, 0);
        if (!lite && park && !held) await page.screenshot({ path: `${output}/full-buffered-catch.png` });
        results.push({ lite, park, case: held ? 'fresh-hold-release-buffer' : 'fresh-tap-buffer', released, landed });
      }

      await setup(park); await pop();
      await page.keyboard.up('KeyE'); await advance(1);
      await page.keyboard.down('KeyE'); await advance(1);
      await page.keyboard.up('KeyE');
      const expired = await advance(80, true);
      assert.equal(expired.bail, true);
      results.push({ lite, park, case: 'expired-tap-still-bails', expired });

      for (const held of [false, true]) {
        await setup(park); await pop();
        if (!held) await page.keyboard.up('KeyE');
        const missed = await advance(80, true); assert.equal(missed.bail, true);
        results.push({ lite, park, case: held ? 'stale-grind-hold-bails' : 'no-grind-bails', missed });
      }
      for (const side of [-1, 1]) {
        await setup(park); const launch = await pop(side);
        await page.keyboard.up('KeyE'); await advance(1); await page.keyboard.down('KeyE');
        const mid = await advance(18);
        assert.equal(mid.state, 'air'); assert.equal(mid.spin, 0);
        const worldSide = Math.sign(launch.lateralX);
        assert.ok((mid.pos[0] - launch.pos[0]) * worldSide > 1, JSON.stringify({ launch, mid, side }));
        if (!lite && park && side === 1) await page.screenshot({ path: `${output}/full-side-transfer.png` });
        const landed = await advance(80, true);
        assert.equal(landed.state, 'grind'); assert.equal(landed.rail, worldSide < 0 ? 1 : 2); assert.equal(landed.bail, false);
        results.push({ lite, park, case: 'side-transfer', side, launch, mid, landed });
      }
      await setup(park);
      await page.evaluate(() => { for (const rail of window.__railReview.rails.slice(1)) { rail.grindable = false; rail.object.visible = false; } });
      const exitLaunch = await pop(-1);
      await page.keyboard.up('KeyE');
      const exited = await advance(100, true);
      assert.equal(exited.grounded, true); assert.equal(exited.bail, false);
      assert.ok(Math.abs(exitLaunch.pos[0] - exited.pos[0]) > 2.5);
      results.push({ lite, park, case: 'side-exit-rollout', launch: exitLaunch, exited });
    }
  }
  const stamp = await page.locator('.hud-build').textContent();
  assert.match(stamp, /Codex\/sol fork/);
  assert.deepEqual(errors, []);
  console.log(`PASS ${results.length} native keyboard cases in lite/full Chrome, campaign/park; clean console and Codex/sol fork stamp.`);
} finally {
  await writeFile(`${output}/review.json`, JSON.stringify({ base, results, errors }, null, 2));
  await browser.close();
}
