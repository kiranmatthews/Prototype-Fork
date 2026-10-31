import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5483/';
const out = process.env.TRAMPOLINE_REVIEW_OUTPUT || '/private/tmp/trampoline-contact-browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
  for (const lite of process.argv.includes('--full') ? [false] : [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { navigator.getGamepads = () => []; });
    const url = new URL(base); url.search = `?playtest&level=carlisle-coast&art=harbour${lite ? '&lite' : ''}`;
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
    const stamp = await page.locator('.hud-build').textContent(); assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(async () => {
      const g = window.__game, p = g.player, l = g.getLevel(), V = p.pos.constructor;
      g.campaign.startEphemeral(); g.renderQualitySettings.setRegularResolution(null); g.crtGuestSettings.setEnabled(false);
      l.buildCustom({ v: 1, name: 'Bonus: Springtide Skippers', spawn: [0, .1, 0], killY: -50, hugeDropBail: false, components: [
        { t: 'platform', p: [0, -.5, 0], s: [80, 1, 100] },
        { t: 'trampoline', nm: 'Review net', p: [0, 3.02, 0], s: [24, .6, 24], speed: 48, amp: 1.25 },
        { t: 'gate', p: [30, 0, -45] },
      ] });
      await Promise.all([l.prepareJungleAssets(), p.preparePresentationAssets()]);
      const net = l.groundMeshes.find(m => m.name === 'Review net');
      const q = window.__netReview = { budget: 0, stop: '', samples: [], bails: [], cameraDistance: 12 };
      q.reset = (x = 0, z = 0, board = false) => {
        p.respawn(l, true, true, { position: new V(x, 3.1, z), heading: new V(0, 0, -1) });
        p.freeSkate = board; p.speed = board ? 12 : 0; p.camDir.set(0, 0, -1);
        q.bails = []; q.samples = [];
      };
      const bail = p.bail.bind(p); p.bail = (...args) => { q.bails.push(args); return bail(...args); };
      const step = p.step.bind(p), consume = g.input.consumeEdges.bind(g.input); g.input.consumeEdges = () => {};
      p.step = (dt, input, level) => {
        if (q.budget <= 0) return;
        step(dt, input, level); consume(); q.budget--;
        q.samples.push({ position: p.pos.toArray(), speed: p.speed, state: p.state, grounded: p.grounded,
          board: p.freeSkate, bail: p.isBailing, rim: p.groundHit?.trampolineRim, net: p.groundHit?.trampolineBounce !== undefined,
          launchId: p.trampolineLaunchId, vy: p.vVel, clip: p.animationClipHint,
          impacts: net.userData.trampolineVisualImpact?.id ?? 0,
          weight: structuredClone(net.userData.marineNet), renderOffset:p.netRenderOffset.toArray() });
        if (q.stop === 'launch' && p.trampolineAir || q.stop === 'side' && p.pos.x >= 10 || q.stop === 'bail' && p.isBailing) q.budget = 0;
      };
      const render = g.renderer.render.bind(g.renderer);
      g.renderer.render = (...args) => {
        if (args[1] === g.camera) {
          g.camera.position.copy(p.pos).add(new V(q.cameraDistance, q.cameraDistance * .65, q.cameraDistance * .8));
          g.camera.fov = 49; g.camera.lookAt(p.pos.clone().add(new V(0, .8, 0))); g.camera.updateProjectionMatrix();
        }
        return render(...args);
      };
      q.reset();
    });
    const advance = async (frames, stop = '') => {
      await page.evaluate(({ frames, stop }) => Object.assign(window.__netReview, { budget: frames, stop }), { frames, stop });
      await page.waitForFunction(() => window.__netReview.budget === 0);
      return page.evaluate(() => window.__netReview.samples.at(-1));
    };
    const capture = async name => { if (!lite) await page.screenshot({ path: `${out}/${name}-native.png` }); };
    await page.evaluate(() => window.__netReview.reset(10,0));
    await advance(75);await capture('unloaded-net');
    await page.evaluate(() => window.__netReview.reset());
    const initial = await advance(60);
    assert.ok(initial.weight.weightDepth>.6&&initial.renderOffset[1]<-.6,'standing weight did not seat the rider in the net');
    await capture('standing-net');
    await page.keyboard.down('ArrowUp'); const walk = await advance(24); await page.keyboard.up('ArrowUp');
    const standing = await advance(24);
    for (const row of [walk, standing]) { assert.ok(row.grounded && row.net && !row.bail && !row.board); assert.equal(row.launchId, initial.launchId); assert.equal(row.impacts, 0); }
    assert.ok(standing.weight.weightDepth>.6&&standing.renderOffset[1]<-.6,'walking dent disappeared');
    assert.ok(Math.abs(standing.weight.weightAt[0]-standing.position[0])<.15&&Math.abs(standing.weight.weightAt[1]-standing.position[2])<.15,'dent did not follow the walker');
    await capture('walk-net');
    if(!lite){
      await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
      await page.waitForTimeout(100);await page.screenshot({path:`${out}/walk-net-normal.png`});
      await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
    }
    await page.keyboard.down('Space'); await advance(6); await page.keyboard.up('Space');
    const hop = await advance(1); assert.equal(hop.state, 'air'); assert.equal(hop.launchId, initial.launchId);
    const bounce = await advance(180, 'launch'); assert.equal(bounce.launchId, initial.launchId + 1); assert.ok(bounce.vy > 40);
    await page.keyboard.down('ArrowRight'); await advance(120, 'side'); await page.keyboard.up('ArrowRight');
    const impact = await advance(300, 'bail'); assert.ok(impact.bail && impact.rim); assert.equal(impact.launchId, bounce.launchId);
    assert.equal(impact.impacts, bounce.impacts);
    const rimCause = await page.evaluate(() => window.__netReview.bails.at(-1)); assert.equal(rimCause[2], 'landing');
    await advance(8); await capture('metal-impact');
    await page.evaluate(() => window.__netReview.reset(10, 0, true));
    const rimRide = await advance(20); assert.ok(rimRide.rim && rimRide.board && !rimRide.bail && rimRide.grounded);
    await capture('skate-metal');
    await page.evaluate(() => window.__netReview.reset(0, 0, true));
    const netTrip = await advance(1); assert.ok(netTrip.bail && !netTrip.board);
    const netCause = await page.evaluate(() => window.__netReview.bails.at(-1)); assert.equal(netCause[2], 'trip');
    await advance(8); await capture('net-trip');
    const canvas = await page.evaluate(() => { const c = window.__game.renderer.domElement; return [c.width, c.height]; });
    assert.deepEqual(canvas, lite ? [960, 540] : [1920, 1080]);
    if (!lite) {
      await page.evaluate(() => { const g = window.__game; g.renderQualitySettings.setRegularResolution(480); g.crtGuestSettings.setEnabled(true); });
      await page.waitForTimeout(100); await page.screenshot({ path: `${out}/net-trip-normal.png` });
    }
    results.push({ lite, stamp, canvas, walk, standing, hop, bounce, impact, rimCause, rimRide, netTrip, netCause });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await writeFile(`${out}/results.json`, JSON.stringify({ base, results, errors }, null, 2)); await browser.close(); }
console.log(`PASS native keyboard walk/jump, net board trip, safe metal skate, big-bounce metal ragdoll; clean consoles. ${out}`);
