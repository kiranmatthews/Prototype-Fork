import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5236/';
const out = process.env.ROLL_REVIEW_OUTPUT || '/private/tmp/board-roll-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { navigator.getGamepads = () => []; });
    const url = new URL(base); url.search = `?playtest&level=codex-lab${lite ? '&lite' : ''}`;
    await page.goto(url.href);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(async headStyle => {
      const g = window.__game, p = g.player, l = g.getLevel();
      if (headStyle === 'alternate') p.setCharacterHeadStyle('alternate');
      await p.preparePresentationAssets();
      const T = g.scene.position.constructor;
      // An isolated clear deck above the lab's obstacles. All motion after
      // the fixture placement comes from native keyboard/controller input.
      l.buildCustom({ v: 1, name: 'Roll review deck', spawn: [0, 30.02, 80], killY: -80,
        components: [{ t: 'platform', p: [0, 29.5, 0], s: [180, 1, 400], edgeGrinding: false }] });
      const position = new T(0, 30.02, 80), heading = new T(0, 0, -1);
      p.respawn(l, true, true, { position, heading });
      const q = window.__rollReview = { budget: 0, samples: [], angle: 1.05, stopOnContact: false };
      const step = p.step.bind(p), consume = g.input.consumeEdges.bind(g.input);
      g.input.consumeEdges = () => {};
      p.step = (dt, input, level) => {
        if (q.budget <= 0) return;
        step(dt, input, level); consume(); q.budget--;
        q.samples.push({ position: p.pos.toArray(), speed: p.speed, carry: p.walkVelocity.length(),
          grounded: p.grounded, bail: p.isBailing, state: p.state, roll: p.rollLandingT,
          phase: p.rollLandingT / p.rollLandingDuration, clip: p.animationClipHint, board: p.freeSkate,
          floorGap: p.interactionMeasure.sampledPlaneDistance(p.riderG, new T(0, 1, 0), new T(p.pos.x, 30, p.pos.z)),
          supportCorrection: p.bailSupportOffset, head: p.headM.getWorldPosition(new T()).toArray() });
        if (q.stopOnContact && p.grounded) q.budget = 0;
      };
      const render = g.renderer.render.bind(g.renderer);
      g.renderer.render = (...args) => {
        if (args[1] === g.camera) {
          g.camera.position.copy(p.pos).add(new T(Math.sin(q.angle) * 6.3, 2.4, Math.cos(q.angle) * 6.3));
          g.camera.fov = 40; g.camera.lookAt(p.pos.clone().add(new T(0, 1.0, -.1))); g.camera.updateProjectionMatrix();
        }
        return render(...args);
      };
    }, process.env.ROLL_REVIEW_HEAD || 'skull');
    const advance = async (frames, stopOnContact = false) => {
      await page.evaluate(({frames, stopOnContact}) => Object.assign(window.__rollReview, { budget: frames, stopOnContact }), {frames, stopOnContact});
      await page.waitForFunction(() => window.__rollReview.budget === 0);
      return page.evaluate(() => window.__rollReview.samples.at(-1));
    };
    await advance(4);
    await page.keyboard.down('ArrowUp'); await page.keyboard.down('Space'); await advance(65);
    await page.keyboard.up('Space'); const launch = await advance(4);
    await page.keyboard.down('Space'); await advance(3); await page.keyboard.up('Space');
    const eject = await advance(1); assert.equal(eject.board, false); assert.equal(eject.state, 'air');
    const contact = await advance(200, true);
    assert.equal(contact.clip, 'player.roll-land'); assert.equal(contact.bail, false);
    const frames = [];
    for (let i = 0; i < 13; i++) {
      const row = i === 0 ? contact : await advance(4);
      assert.ok(row.floorGap >= -.015, `visible roll penetrated support: ${row.floorGap}`);
      const prefix = `${lite ? 'lite' : 'full'}-${String(i).padStart(2, '0')}`;
      if (!lite) for (const [angle, name] of [[Math.PI / 2, 'side'], [2.5, 'front'], [.7, 'rear']]) {
        await page.evaluate(angle => { window.__rollReview.angle = angle; }, angle);
        await page.waitForTimeout(75);
        await page.screenshot({ path: `${out}/${prefix}-${name}.png` });
      }
      frames.push(row);
    }
    const run = await advance(30);
    assert.equal(run.board, false); assert.equal(run.bail, false); assert.equal(run.clip, 'player.run');
    assert.ok(Math.abs(run.carry - contact.carry) < 1e-5, 'running lost dismount momentum');
    await page.keyboard.up('ArrowUp'); await advance(160);
    results.push({ lite, stamp, launch, eject, contact, frames, run });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await writeFile(`${out}/results.json`, JSON.stringify({base,results,errors}, null, 2)); await browser.close(); }
console.log(`PASS native keyboard dismount / roll / run, lite + full, clean consoles. ${out}`);
