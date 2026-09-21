import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium, webkit, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.OFFLINE_BROWSER || 'chromium';
const output = process.env.OFFLINE_OUTPUT || '/private/tmp/prototype-offline-qa';
await mkdir(output, { recursive: true });
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary' };
let server;
let base = process.argv[2];
if (!base) {
  server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/Prototype-Fork/')) { response.writeHead(404).end(); return; }
    const relative = decodeURIComponent(url.pathname.slice('/Prototype-Fork/'.length)) || 'index.html';
    const file = path.resolve(dist, relative);
    if (!file.startsWith(dist)) { response.writeHead(403).end(); return; }
    try {
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
      response.end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/Prototype-Fork/`;
}
if (engine === 'webkit' && !server) throw new Error('WebKit QA must own its preview server; omit the URL argument.');
const browserType = engine === 'webkit' ? webkit : chromium;
const profile = await mkdtemp('/private/tmp/prototype-offline-profile-');
const browserOptions = { headless: true, ...(engine === 'webkit' ? devices['iPhone 13'] : { channel: 'chrome', viewport: { width: 1280, height: 720 } }) };
let context = await browserType.launchPersistentContext(profile, browserOptions);
const errors = [], failures = [], cancelledRequests = [], results = [];
const watchPage = page => {
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()+' '+msg.location().url+' ['+page.url()+']'); });
  page.on('requestfailed', request => {
    const failure = { url: request.url(), error: request.failure()?.errorText, page: page.url() };
    // Navigation/level replacement may cancel obsolete loaders. The awaited
    // per-level readiness and error checks below cover all required assets.
    if (/ERR_ABORTED|cancelled|canceled/i.test(failure.error || '')) cancelledRequests.push(failure);
    else failures.push(failure);
  });
};
context.on('page', watchPage);
try {
  let page = await context.newPage();
  await page.goto(base + '?lite', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__game?.player, null, { timeout: 120000 });
  await page.evaluate(() => window.__game.gameFlow.showLaunch());
  const stamp=await page.locator('.hud-build').textContent();
  assert.match(stamp,/Codex\/sol fork/);
  assert.equal(await page.evaluate(async()=>!!await navigator.serviceWorker.getRegistration()),false,'gameplay does not install a complete offline release');
  await page.getByRole('button',{name:'SAVE OFFLINE',exact:true}).click();
  await page.waitForURL('**/offline-save.html');
  assert.equal(await page.locator('canvas').count(),0,'offline saving has no game/rendering context');
  await page.getByRole('button',{name:'Save offline copy',exact:true}).click();
  console.log(engine + ': lightweight save screen; waiting for complete offline copy');
  await page.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('#status')?.textContent?.includes('Ready for offline play'), null, { timeout: 240000 });
  const ready = await page.locator('#status').innerText();
  const snapshot = await page.evaluate(async () => ({
    caches: await Promise.all((await caches.keys()).map(async name => ({ name, count: (await (await caches.open(name)).keys()).length }))),
    text: document.querySelector('#status')?.textContent,
  }));
  snapshot.stamp=stamp;
  assert.ok(snapshot.caches.some(cache => cache.count > 600));
  await page.screenshot({ path: `${output}/${engine}-offline-ready.png` });
  console.log(engine + ': ' + ready);
  await page.evaluate(() => localStorage.setItem('solProtoOfflineSmoke', 'persisted'));
  // Restart the browser itself so only durable local caches can satisfy loads.
  await context.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  // Playwright WebKit's offline emulation also blocks service-worker responses
  // (reproduced with a minimal cached HTML page). Stop the actual origin instead.
  context = await browserType.launchPersistentContext(profile, { ...browserOptions, offline: engine === 'chromium' });
  context.on('page', watchPage);
  page = await context.newPage();
  if (engine === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  }
  const response = await page.goto(base + '?lite&playtest&level=codex-lab&airplane=1', { waitUntil: 'load', timeout: 120000 });
  assert.ok(response.fromServiceWorker(), 'cold offline navigation comes from the game cache');
  await page.waitForFunction(() => window.__game?.getCurrentLevel().id === 'codex-lab', null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('solProtoOfflineSmoke')), 'persisted');
  await page.waitForFunction(() => !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
  const before = await page.evaluate(() => window.__game.player.pos.toArray());
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(900); await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(() => window.__game.player.pos.toArray());
  assert.ok(Math.hypot(...after.map((n, i) => n - before[i])) > .2, 'player can move offline');
  const checkpoint = await page.evaluate(() => {
    const game = window.__game, level = game.getLevel();
    return { count: level.checkpoints.length, warped: game.player.warpCheckpoint(level, 1), y: game.player.pos.y };
  });
  assert.ok(checkpoint.count && checkpoint.warped && Number.isFinite(checkpoint.y));
  const ranges = await page.evaluate(async () => {
    const response = await fetch('./sfx/ollie.wav', { headers: { Range: 'bytes=0-31' } });
    return { status: response.status, size: (await response.arrayBuffer()).byteLength };
  });
  assert.equal(ranges.status, 206); assert.equal(ranges.size, 32);
  results.push({ snapshot, checkpoint, movement: { before, after }, ranges });
  for (const id of ['treehouse-trail', 'jungle', 'test', 'dark', 'warproom']) {
    const result = await page.evaluate(async id => {
      const game = window.__game;
      if (!game.switchLevel(id)) throw new Error('Level switch failed: ' + id);
      const level = game.getLevel(); await level.prepareJungleAssets();
      let lods = 0, meshes = 0;
      level.root.traverse(object => { if (object.isLOD) lods++; if (object.isMesh) meshes++; });
      return { id: game.getCurrentLevel().id, lods, meshes,
        jungle: level.jungleAssets?.diagnostics, city: level.cityAssets?.diagnostics,
        rocks: level.nightworksRocks?.errors, spawn: level.spawnPos.toArray() };
    }, id);
    assert.equal(result.id, id); assert.equal(result.lods, 0); assert.ok(result.meshes > 0);
    assert.deepEqual(result.jungle?.errors || [], []); assert.deepEqual(result.city?.errors || [], []); assert.deepEqual(result.rocks || [], []);
    results.push(result); console.log(engine + ': offline level ' + id + ' ready, no distance mesh swaps');
  }
  // Finish on the complete rendering path, still without a connection.
  await page.goto(base + '?playtest&level=jungle&airplane=full', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__game?.getCurrentLevel().id === 'jungle' && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
  await page.evaluate(() => window.__game.getLevel().prepareJungleAssets());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${output}/${engine}-offline-full.png` });
  assert.deepEqual(errors, [], 'no game console or runtime errors');
  assert.deepEqual(failures, [], 'all requested game assets load offline');
  await writeFile(`${output}/${engine}.json`, JSON.stringify({ engine, base, originStopped: !!server, results, errors, failures, cancelledRequests }, null, 2));
  console.log(engine + ': PASS cold offline restart, movement, checkpoints, unvisited levels, saves, full renderer');
} catch (error) {
  await writeFile(`${output}/${engine}-failure.json`, JSON.stringify({ error: String(error), results, errors, failures }, null, 2));
  throw error;
} finally {
  await context.close();
  if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
}
