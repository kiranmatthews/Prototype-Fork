import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../desktop/node_modules/playwright/index.mjs';
import { bundlePaths } from './bundle-paths.mjs';
const profile = await mkdtemp(path.join(tmpdir(), 'boneman-packaged-'));
const output = fileURLToPath(new URL('../../desktop/test-results/', import.meta.url));
await mkdir(output, { recursive:true });
const { binary } = bundlePaths();
const processHandle = spawn(binary, ['--remote-debugging-port=0'], { env:{...process.env, BONEMAN_USER_DATA:profile}, stdio:['ignore','pipe','pipe'] });
let browser, page;
const errors = [], failed = [], requests = [];
const emulatedFocus = process.argv.includes('--emulated-focus');
const report = { binary, platform:process.platform, arch:process.arch, emulatedFocus };
try {
  const endpoint = await new Promise((resolve,reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Packaged app did not expose its test debugging endpoint: ' + log.slice(-2000))), 45000);
    processHandle.once('error', reject);
    processHandle.once('exit', code => { clearTimeout(timer); reject(new Error('Packaged app exited early: ' + code + '\n' + log.slice(-2000))); });
    processHandle.stderr.on('data', bytes => {
      log = (log + bytes).slice(-16000);
      const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  browser = await chromium.connectOverCDP(endpoint, { noDefaults:!emulatedFocus });
  const context = browser.contexts()[0];
  page = context.pages()[0] ?? await context.waitForEvent('page');
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', request => requests.push(request.url()));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
  await page.waitForFunction(() => !!window.__game, null, {timeout:120000});
  await context.setOffline(true);
  await page.goto('boneman://game/?playtest&level=codex-lab', {timeout:120000});
  await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded, null, {timeout:120000});
  assert.match(await page.locator('.hud-build').textContent(), /Codex\/sol fork.*Offline desktop/);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const start = await page.evaluate(() => window.__game.player.pos.toArray());
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(700); await page.keyboard.up('ArrowUp');
  const finish = await page.evaluate(() => window.__game.player.pos.toArray());
  assert(Math.hypot(...finish.map((n,i) => n - start[i])) > .2);
  if (!emulatedFocus) {
  const client = await context.newCDPSession(page);
  const { windowId } = await client.send('Browser.getWindowForTarget');
  await client.send('Browser.setWindowBounds', {windowId, bounds:{windowState:'minimized'}});
  await page.waitForFunction(() => document.hidden, null, {polling:100});
  const beforeHidden = await page.evaluate(() => window.__game.player.pos.toArray());
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(() => window.__game.player.pos.toArray()), beforeHidden);
  await client.send('Browser.setWindowBounds', {windowId, bounds:{windowState:'normal'}});
  await page.bringToFront();
  await page.waitForFunction(() => !document.hidden, null, {polling:100});
  report.visibility = 'simulation frozen while minimized; resumed';
  } else report.visibility = 'not tested: focus emulation enabled';
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__game.gameFlow.blocksGameplay);
  await page.screenshot({path:path.join(output, 'packaged-full.png')});
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  assert(requests.every(url => /^(boneman:|blob:|data:)/.test(url)));
  Object.assign(report, { status:'passed', networkOffline:true, fullRender:true, errors, failed, requests:requests.length });
  console.log('PASS packaged, hardened app: disconnected full-render gameplay and pause, clean console.');
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  report.errors = errors;
  report.failedRequests = failed;
  report.requestCount = requests.length;
  if (page) report.page = await page.evaluate(() => ({
    url:location.href, hidden:document.hidden, ready:document.readyState,
    game:!!window.__game, loading:window.__game?.getLoadingDiagnostics(),
  })).catch(() => null);
  console.error(JSON.stringify(report));
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (processHandle.exitCode === null) {
    processHandle.kill();
    await new Promise(resolve => {
      const timer = setTimeout(() => { processHandle.kill('SIGKILL'); resolve(); }, 5000);
      processHandle.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
  await writeFile(path.join(output, 'packaged-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  await rm(profile, { recursive:true, force:true, maxRetries:5, retryDelay:200 });
}
