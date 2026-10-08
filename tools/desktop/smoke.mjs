import { testTimeout, slowTest, translatedTest, slowGpuTest } from './test-timing.mjs';
import { moveOnSupportedGround } from './input-smoke.mjs';
import { softwareGpuTest } from './test-gpu.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir, platform, arch } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { launchSource } from './launch-source.mjs';

const desktop = path.resolve(fileURLToPath(new URL('../../desktop/', import.meta.url)));
const output = path.join(desktop, 'test-results');
await mkdir(output, { recursive:true });
const profile = await mkdtemp(path.join(tmpdir(), 'boneman-smoke-'));
const report = { timestamp:new Date().toISOString(), platform:platform(), arch:arch(), softwareGpuTest, translatedTest, slowGpuTest, modes:[] };
const errors = [], requests = [], failed = [];
let app;
try {
  app = await launchSource(profile);
  const page = app.page;
  page.setDefaultTimeout(testTimeout); page.setDefaultNavigationTimeout(testTimeout);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => requests.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failed.push({ url:r.url(), status:r.status() }); });
  await page.waitForFunction(() => document.readyState === 'complete' && window.__game && (!window.__game.gameFlow.blocksGameplay || window.__game.gameFlow.currentScreen === 'launch'), null, { timeout:testTimeout });
  // The first run above has a fresh profile: no PWA/HTTP cache can make this pass.
  const startup = await page.evaluate(async () => ({
    node:typeof window.require, process:typeof window.process,
    secure:window.isSecureContext, origin:location.origin,
    serviceWorkers: 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations().then(r => r.length, e => e.name) : 'disabled',
    caches:await caches.keys(),
    startupErrors:(JSON.parse(localStorage.getItem('solProtoStabilityV1') || '{}').sessions || [])
      .flatMap(session => session.events || []).filter(event => ['javascript-error','promise-error'].includes(event.stage)),
  }));
  assert.equal(startup.node, 'undefined'); assert.equal(startup.process, 'undefined');
  assert.equal(startup.secure, true); assert.equal(startup.origin, 'boneman://game');
  assert([0, 'disabled', 'InvalidStateError'].includes(startup.serviceWorkers)); assert.deepEqual(startup.caches, []);
  assert.deepEqual(startup.startupErrors, [], 'Native startup must not hide an early JavaScript error');
  report.startup = startup;
  report.runtime = await page.evaluate(() => {
    const gl = window.__game.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
    return {userAgent:navigator.userAgent, gpu:extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null};
  });
  // A disconnected browser must still load every byte from the app protocol.
  await page.context().setOffline(true);
  for (const lite of [true, false]) {
    console.log('Checking', lite ? 'lite' : 'full', 'offline gameplay');
    await page.goto('boneman://game/?playtest&level=codex-lab' + (lite ? '&lite' : ''));
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded, null, { timeout:testTimeout });
    if (!lite) {
      await page.evaluate(() => { const s = window.__game.crtGuestSettings; s.applyStartupPreset(); s.setEnabled(true); });
      await page.waitForFunction(() => window.__game.getCrtDiagnostics()?.active, null, {timeout:30000});
    }
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork.*Offline desktop/);
    const { start, moved } = await moveOnSupportedGround(page);
    assert(Math.hypot(...moved.map((n,i) => n - start[i])) > .2);
    const checkpoint = await page.evaluate(() => {
      const g = window.__game;
      const warped = g.player.warpCheckpoint(g.getLevel(), 1);
      return { warped, spawn:g.getLevel().currentSpawn.toArray() };
    });
    assert.equal(checkpoint.warped, true);
    await page.evaluate(() => { const g = window.__game; g.player.pos.y = g.getLevel().killY - 10; });
    await page.waitForFunction(() => window.__game.player.state === 'dead', null, { timeout:15000 });
    await page.waitForFunction(() => window.__game.player.state !== 'dead' && window.__game.player.grounded, null, { timeout:30000 });
    const pos = await page.evaluate(() => window.__game.player.pos.toArray());
    assert(Math.hypot(...pos.map((n,i) => n - checkpoint.spawn[i])) < 8);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__game.gameFlow.blocksGameplay);
    await page.screenshot({ path:path.join(output, lite ? 'lite-pause.png' : 'full-pause.png') });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__game.gameFlow.blocksGameplay);
    await page.screenshot({ path:path.join(output, lite ? 'lite-game.png' : 'full-game.png') });
    const frames = await page.evaluate(async sampleCount => {
      const intervals = []; let previous;
      await new Promise(resolve => {
        function frame(now) {
          if (previous !== undefined) intervals.push(now - previous);
          previous = now;
          if (intervals.length < sampleCount) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
      intervals.sort((a,b) => a - b);
      return { samples:intervals.length, p50:intervals[Math.floor(intervals.length*.5)], p95:intervals[Math.floor(intervals.length*.95)],
        p99:intervals[Math.floor(intervals.length*.99)], crt:window.__game.getCrtDiagnostics(), quality:window.__game.renderQualitySettings.snapshot() };
    }, slowTest ? 30 : 240);
    await page.evaluate(() => { const g = window.__game; g.getLevel().finishGlow.getCenter(g.player.pos); g.player.speed = 0; });
    await page.waitForFunction(() => window.__game.player.state === 'finished' || window.__game.gameFlow.blocksGameplay, null, { timeout:15000 });
    if (!lite) {
      await page.evaluate(() => window.__game.renderer.forceContextLoss());
      await page.waitForFunction(() => window.__game.getGraphicsRecoveryDiagnostics().lost);
      await page.evaluate(() => window.__game.renderer.forceContextRestore());
      await page.waitForFunction(() => !window.__game.getGraphicsRecoveryDiagnostics().lost && window.__game.getGraphicsRecoveryDiagnostics().restores > 0, null, {timeout:30000});
      report.graphicsRecovery = await page.evaluate(() => window.__game.getGraphicsRecoveryDiagnostics());
    }
    report.modes.push({ lite, stamp, frames, checkpoint, respawn:pos });
    console.log('PASS', lite ? 'lite' : 'full', 'gameplay and rendering');
  }
  report.assetFamilies = [];
  for (const level of ['treehouse-trail', 'jungle', 'dark', 'crab-chief']) {
    console.log('Loading bundled asset family:', level);
    await page.goto('boneman://game/?playtest&level=' + level);
    await page.waitForFunction(id => {
      const g = window.__game;
      return g?.getCurrentLevel().id === id && !g.gameFlow.blocksGameplay && g.getLoadingDiagnostics().pending.length === 0;
    }, level, {timeout:testTimeout});
    const loaded = await page.evaluate(() => ({
      level:window.__game.getCurrentLevel().id, assets:window.__game.getLoadingDiagnostics(),
      decoder:window.__game.getSceneryDecoderDiagnostics(), memory:{...window.__game.renderer.info.memory},
    }));
    assert.equal(loaded.level, level);
    assert.deepEqual(loaded.assets.failed, []);
    report.assetFamilies.push(loaded);
    console.log('PASS bundled asset family:', level);
  }
  assert.deepEqual(errors, [], 'Unexpected renderer errors');
  assert.deepEqual(failed, [], 'Missing bundled resources');
  assert(requests.every(url => /^(boneman:|data:|blob:)/.test(url)), 'Game attempted a network request');
  assert(!requests.some(url => /release\.json|sw\.js|offline-save\.html|api\.github/.test(url)));
  // Test deliberate hostile requests separately from normal game traffic.
  let networkHits = 0;
  const server = createServer((_req,res) => { networkHits++; res.end('must never be read'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await page.context().setOffline(false);
    const probe = 'http://127.0.0.1:' + server.address().port + '/';
    const denied = await page.evaluate(async url => {
      const results = {};
      results.fetch = await fetch(url).then(() => false, () => true);
      results.image = await new Promise(resolve => { const i = new Image(); i.onload = () => resolve(false); i.onerror = () => resolve(true); i.src = url + 'image'; });
      results.socket = await new Promise(resolve => { try { const s = new WebSocket(url.replace('http:', 'ws:')); s.onopen = () => { s.close(); resolve(false); }; s.onerror = () => resolve(true); } catch { resolve(true); } });
      results.worker = await new Promise(resolve => {
        const worker = new Worker(URL.createObjectURL(new Blob(['fetch(' + JSON.stringify(url) + ').then(()=>postMessage(false),()=>postMessage(true))'], {type:'text/javascript'})));
        worker.onmessage = event => { resolve(event.data); worker.terminate(); };
        worker.onerror = () => { resolve(false); worker.terminate(); };
      });
      return results;
    }, probe);
    assert.deepEqual(denied, { fetch:true, image:true, socket:true, worker:true });
    const beforeNavigation = page.url();
    await page.evaluate(url => { window.open(url); location.assign(url); }, probe);
    await page.waitForTimeout(200);
    assert.equal(page.url(), beforeNavigation, 'External navigation is blocked');
    assert.equal(app.context.pages().length, 1, 'External popups are blocked');
    assert.equal(networkHits, 0);
    report.network = { denied, networkHits, gameRequests:requests.length, nativePolicy:'verified separately by native-lifecycle.mjs' };
  } finally { await new Promise(resolve => server.close(resolve)); }

  await page.evaluate(() => location.assign('boneman://game/reset-local-data.html'));
  await page.waitForURL('boneman://game/reset-local-data.html');
  assert.equal(await page.locator('#status').textContent(), 'Nothing has been reset.');
  await page.locator('#back').click();
  await page.waitForFunction(() => !!window.__game, null, {timeout:testTimeout});
  await page.evaluate(() => localStorage.setItem('solProtoDesktopPersistenceTest', 'kept'));
  assert.equal(await app.close(), true, 'The native Quit action must finish cleanly before checking saved data'); app = null;
  app = await launchSource(profile);
  const reopened = app.page;
  await reopened.waitForFunction(() => location.protocol === 'boneman:' && document.readyState === 'complete');
  assert.equal(await reopened.evaluate(() => localStorage.getItem('solProtoDesktopPersistenceTest')), 'kept');
  report.persistence = true;
  report.contentId = JSON.parse(await readFile(path.join(desktop, 'web/asset-manifest.json'), 'utf8')).contentId;
  report.normalErrors = [];
  report.status = 'passed';
  console.log('PASS fresh-profile offline startup; lite/full play, checkpoint, pit, finish, pause, network denial and persistent saves.');
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  report.errors = errors;
  report.failedRequests = failed;
  report.nativeLog = app?.diagnostics();
  if (app) report.page = await Promise.race([app.page.evaluate(() => ({
    url:location.href, hidden:document.hidden, ready:document.readyState,
    screen:window.__game?.gameFlow.currentScreen, loadingPhase:window.__game?.gameFlow.loadingPhase,
    blocked:window.__game?.gameFlow.blocksGameplay, playerState:window.__game?.player.state,
    frame:window.__game?.frameStats.frame,
    loading:window.__game?.getLoadingDiagnostics(), level:window.__game?.getCurrentLevel().id,
  })).catch(() => null), new Promise(resolve => setTimeout(() => resolve('unresponsive'), 2000))]);
  console.error(JSON.stringify(report));
  throw error;
} finally {
  if (app) await app.close();
  await writeFile(path.join(output, 'smoke.json'), JSON.stringify(report, null, 2) + '\n');
  await rm(profile, { recursive:true, force:true });
}
