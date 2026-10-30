import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base = process.env.CARLISLE_BASE ?? 'http://127.0.0.1:5483';
const out = process.env.LAUNCH_REVIEW_OUT ?? 'docs/carlisle-relay/launch-integration';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base, errors: [], flights: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.addInitScript(() => Object.defineProperty(navigator, 'getGamepads', { value: () => [] }));
  await page.goto(base + '/launch-review.html?playtest&level=carlisle-coast&art=harbour&launchReview', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && document.querySelector('#launch-review'), null, { timeout: 180000 });
  report.main = await page.evaluate(async () => {
    const g = window.__game; g.campaign.startEphemeral(); await g.getLevel().prepareJungleAssets();
    g.renderQualitySettings.setRegularResolution(null); g.crtGuestSettings.setEnabled(false);
    const l = g.getLevel();
    return { art: l.carlisleShipyardDiagnostics, crates: l.crates.length, nitro: l.crates.filter(c => c.nitro).length,
      grounds: l.groundMeshes.length, movers: l.movers.length, camera: g.getLaunchCameraDiagnostics(),
      tuning: Object.fromEntries(Object.entries(g.TUNING).filter(([key]) => /launch|trampolineAirJump/i.test(key))) };
  });
  assert.equal(report.main.art.status, 'ready'); assert.equal(report.main.crates, 270); assert.equal(report.main.nitro, 22);
  assert.equal(report.main.grounds, 334); assert.equal(report.main.movers, 28);
  assert.ok(!Object.keys(report.main.tuning).some(key => /landing/i.test(key)));
  const snapshot = () => page.evaluate(() => {
    const g = window.__game, p = g.player;
    return { position: p.pos.toArray(), state: p.state, grounded: p.grounded, deaths: p.totalDeaths,
      camera: g.getLaunchCameraDiagnostics(), clip: p.animationClipHint, launch: p.launchPresentation,
      cameraLaunch: p.launchCameraPresentation, flip: p.flipTimer, secondJump: p.emergencyEjectLandingPending,
      canvas: [g.renderer.domElement.width, g.renderer.domElement.height], fov: g.camera.fov };
  });
  await page.getByRole('combobox', { name: 'Launch pad', exact: true }).selectOption({ label: 'Scissor approach springs · 3' });
  await page.getByRole('combobox', { name: 'Render resolution', exact: true }).selectOption('max');
  for (const mode of ['foot', 'board']) {
    await page.getByRole('combobox', { name: 'Rider mode', exact: true }).selectOption(mode);
    await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('1');
    await page.getByRole('checkbox', { name: 'Pause at apex', exact: true }).check();
    await page.getByRole('button', { name: 'Replay launch', exact: true }).click();
    await page.waitForFunction(() => { const g = window.__game; return g.launchReview.rate === 0 && g.player.launchPresentation?.rise === 1; }, null, { timeout: 30000 });
    const before = await snapshot(); assert.ok(before.camera.weight > .9); assert.ok(before.clip.includes('float'));
    await page.screenshot({ path: `${out}/${mode}-apex-native.png` });
    await page.getByRole('checkbox', { name: 'Pause at apex', exact: true }).uncheck();
    await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('.25');
    await page.getByRole('button', { name: 'Air jump / Abandon Ship', exact: true }).click();
    await page.waitForFunction(() => { const p = window.__game.player; return p.emergencyEjectLandingPending && p.flipTimer > .25; });
    const flip = await snapshot();
    assert.equal(flip.camera.launchId, before.camera.launchId); assert.ok(flip.camera.weight > .9);
    assert.equal(flip.launch, null); assert.ok(flip.secondJump);
    await page.screenshot({ path: `${out}/${mode}-second-jump-native.png` });
    await page.waitForFunction(() => { const p = window.__game.player; return p.emergencyEjectLandingPending && p.flipTimer <= 0 && p.animationClipHint === 'player.launch-float'; }, null, { timeout: 15000 });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const falling = await snapshot(); assert.equal(falling.camera.launchId, before.camera.launchId); assert.ok(falling.camera.weight > .9);
    assert.equal(falling.clip, 'player.launch-float'); assert.equal(falling.deaths, 0);
    assert.deepEqual(falling.canvas, [1920, 1080]);
    await page.screenshot({ path: `${out}/${mode}-post-jump-native.png` });
    report.flights.push({ mode, before, flip, falling });
  }
  await page.getByRole('combobox', { name: 'Rider mode', exact: true }).selectOption('foot');
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('1');
  await page.getByRole('checkbox', { name: 'Pause on landing', exact: true }).check();
  await page.getByRole('button', { name: 'Replay launch', exact: true }).click();
  await page.waitForFunction(() => { const g = window.__game; return g.player.grounded && g.launchReview.rate === 0; }, null, { timeout: 30000 });
  report.landing = await snapshot(); assert.equal(report.landing.deaths, 0); assert.equal(report.landing.cameraLaunch, null);
  await page.screenshot({ path: `${out}/landing-native.png` });
  await page.evaluate(() => { const g = window.__game; g.renderQualitySettings.setRegularResolution(480); g.crtGuestSettings.setEnabled(true); });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForTimeout(1000);
  report.settled = await snapshot(); assert.ok(report.settled.grounded); assert.equal(report.settled.deaths, 0);
  assert.ok(Math.abs(report.settled.position[1] - report.landing.position[1]) < .01);
  await page.screenshot({ path: `${out}/landing-normal.png` });
  assert.deepEqual(report.errors, []); report.passed = true;
} finally {
  await writeFile(`${out}/browser.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify({ passed: report.passed, flights: report.flights.map(f => ({ mode: f.mode, cameraWeights: [f.before.camera.weight, f.flip.camera.weight, f.falling.camera.weight], fallClip: f.falling.clip })), errors: report.errors }));
