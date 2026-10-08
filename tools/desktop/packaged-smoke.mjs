import { moveOnSupportedGround } from './input-smoke.mjs';
import { testGpuArgs, softwareGpuTest } from './test-gpu.mjs';
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
const processHandle = spawn(binary, [...testGpuArgs, '--remote-debugging-port=0'], { env:{...process.env, BONEMAN_USER_DATA:profile}, stdio:['ignore','pipe','pipe'] });
const watchdog = setTimeout(() => processHandle.kill('SIGKILL'), 180000);
let browser, page;
const errors = [], failed = [], requests = [];
const emulatedFocus = process.argv.includes('--emulated-focus');
const report = { binary, platform:process.platform, arch:process.arch, softwareGpuTest, emulatedFocus, stderr:'' };
processHandle.stderr.on('data', bytes => { report.stderr = (report.stderr + bytes).slice(-12000); });
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
  await page.waitForFunction(() => !!window.__game && document.readyState === 'complete', null, {timeout:60000});
  await context.setOffline(true);
  await page.goto('boneman://game/?playtest&level=codex-lab', {timeout:120000});
  await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded, null, {timeout:120000});
  await page.evaluate(() => { const s = window.__game.crtGuestSettings; s.applyStartupPreset(); s.setEnabled(true); });
  await page.waitForFunction(() => window.__game.getCrtDiagnostics()?.active, null, {timeout:30000});
  assert.match(await page.locator('.hud-build').textContent(), /Codex\/sol fork.*Offline desktop/);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const { start, moved:finish } = await moveOnSupportedGround(page);
  assert(Math.hypot(...finish.map((n,i) => n - start[i])) > .2);
  report.visibility = 'covered by native-lifecycle.mjs without CDP emulation';
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
  if (page) report.page = await Promise.race([page.evaluate(() => ({
    url:location.href, hidden:document.hidden, ready:document.readyState,
    game:!!window.__game, loading:window.__game?.getLoadingDiagnostics(),
  })).catch(() => null), new Promise(resolve => setTimeout(() => resolve('unresponsive'), 2000))]);
  console.error(JSON.stringify(report));
  throw error;
} finally {
  if (browser) await Promise.race([browser.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (processHandle.exitCode === null) {
    processHandle.kill();
    await new Promise(resolve => {
      const timer = setTimeout(() => { processHandle.kill('SIGKILL'); resolve(); }, 5000);
      processHandle.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
  clearTimeout(watchdog);
  await writeFile(path.join(output, 'packaged-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  await rm(profile, { recursive:true, force:true, maxRetries:5, retryDelay:200 });
}
