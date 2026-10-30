import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5483/';
const out = process.env.ROLL_REVIEW_OUTPUT || '/private/tmp/trampoline-roll-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
  for (const lite of [true, false]) for (const slope of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { navigator.getGamepads = () => []; });
    const url = new URL(base); url.search = `?playtest&level=carlisle-coast&art=harbour${lite ? '&lite' : ''}`;
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(async slope => {
      const g = window.__game, p = g.player, l = g.getLevel(), V = p.pos.constructor, y = slope ? 40 : 0;
      await p.preparePresentationAssets();
      g.campaign.startEphemeral(); g.renderQualitySettings.setRegularResolution(null); g.crtGuestSettings.setEnabled(false);
      // Isolated clear supports: only the spawn is positioned by the fixture.
      // Native trampoline contact and keyboard air steering perform the jump.
      l.cameraViews.length = 0;
      l.buildCustom({ v: 1, name: 'Trampoline roll review', spawn: [0, y + .15, 0], killY: -80, components: [
        slope ? { t: 'ramp', p: [0, -20, -100], len: 400, rise: 80, w: 200, yaw: 180, slip: true, iceGrip: .035, slipGravity: 1.9 } :
          { t: 'platform', p: [0, -.5, -100], s: [200, 1, 400] },
        { t: 'trampoline', p: [0, y, 0], s: [6, .2, 6], speed: 28, amp: 1 }, { t: 'gate', p: [80, 0, -250] },
      ] });
      p.respawn(l, true, true, { position: new V(0, y + .15, 0), heading: new V(0, 0, -1) });
      p.camDir.set(0, 0, -1);
      const q = window.__springRollReview = { budget: 0, stop: '', samples: [], angle: Math.PI / 2 };
      const step = p.step.bind(p), consume = g.input.consumeEdges.bind(g.input);
      g.input.consumeEdges = () => {};
      p.step = (dt, input, level) => {
        if (q.budget <= 0) return;
        step(dt, input, level); consume(); q.budget--;
        q.samples.push({ position: p.pos.toArray(), speed: p.speed, state: p.state, grounded: p.grounded,
          board: p.freeSkate, bail: p.isBailing, abandoned: p.emergencyEjectLandingPending,
          clip: p.animationClipHint, phase: p.rollLandingT / p.rollLandingDuration, trampoline: p.trampolineAir });
        if (q.stop === 'launch' && p.trampolineAir || q.stop === 'contact' && p.grounded) q.budget = 0;
      };
      const render = g.renderer.render.bind(g.renderer);
      g.renderer.render = (...args) => {
        if (args[1] === g.camera) {
          g.camera.position.copy(p.pos).add(new V(Math.sin(q.angle) * 6.3, 2.4, Math.cos(q.angle) * 6.3));
          g.camera.fov = 40; g.camera.lookAt(p.pos.clone().add(new V(0, 1, 0))); g.camera.updateProjectionMatrix();
        }
        return render(...args);
      };
    }, slope);
    const advance = async (frames, stop = '') => {
      await page.evaluate(({ frames, stop }) => Object.assign(window.__springRollReview, { budget: frames, stop }), { frames, stop });
      await page.waitForFunction(() => window.__springRollReview.budget === 0);
      return page.evaluate(() => window.__springRollReview.samples.at(-1));
    };
    const launch = await advance(40, 'launch'); assert.ok(launch.trampoline);
    await page.keyboard.down('ArrowUp');
    const contact = await advance(240, 'contact');
    assert.ok(contact.grounded); assert.equal(contact.clip, 'player.roll-land');
    assert.equal(contact.abandoned, false); assert.equal(contact.board, false); assert.equal(contact.bail, false);
    await page.keyboard.up('ArrowUp');
    const poses = [contact];
    for (const [frames, label] of [[8, 'plant'], [12, 'tuck'], [14, 'recover']]) {
      poses.push(await advance(frames));
      if (!lite) for (const [angle, view] of [[Math.PI / 2, 'side'], [2.5, 'front']]) {
        await page.evaluate(angle => { window.__springRollReview.angle = angle; }, angle);
        await page.waitForTimeout(75);
        await page.screenshot({ path: `${out}/${slope ? 'slope' : 'deck'}-${label}-${view}-native.png` });
      }
    }
    const settled = await advance(60);
    assert.equal(settled.clip, slope ? 'player.slope-slide' : 'player.idle');
    assert.equal(settled.board, false); assert.equal(settled.bail, false);
    const canvas = await page.evaluate(() => { const c = window.__game.renderer.domElement; return [c.width, c.height]; });
    // Lite deliberately caps render scale at one half; the full pass must
    // retain native resolution for the contact/pose review.
    assert.deepEqual(canvas, lite ? [960, 540] : [1920, 1080]);
    if (!lite) {
      await page.evaluate(() => { const g = window.__game; g.renderQualitySettings.setRegularResolution(480); g.crtGuestSettings.setEnabled(true); });
      await page.waitForTimeout(100);
      await page.screenshot({ path: `${out}/${slope ? 'slope' : 'deck'}-settled-normal.png` });
    }
    results.push({ lite, slope, stamp, canvas, launch, contact, poses, settled });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await writeFile(`${out}/results.json`, JSON.stringify({ base, results, errors }, null, 2)); await browser.close(); }
console.log(`PASS native trampoline/keyboard landing rolls on deck and downhill, lite + full/native, finite idle/slide recovery, clean consoles. ${out}`);
