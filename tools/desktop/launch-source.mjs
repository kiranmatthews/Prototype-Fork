import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../desktop/node_modules/playwright/index.mjs';
import { testGpuArgs } from './test-gpu.mjs';

const require = createRequire(new URL('../../desktop/package.json', import.meta.url));

// Use the same Chromium debugging transport as the packaged-app test. This
// avoids Electron's experimental Node-inspector test bootstrap on Windows.
export async function launchSource(profile) {
  const child = spawn(require('electron'), [...testGpuArgs, '--remote-debugging-port=0', fileURLToPath(new URL('./source-entry.cjs', import.meta.url))], {
    env:{...process.env, BONEMAN_USER_DATA:profile}, stdio:['ignore','pipe','pipe','ipc'],
  });
  let stderr = '', browser;
  child.stdout.resume();
  child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-16000); });
  async function close() {
    if (child.connected) {
      // The test entry calls app.quit(); no simulated key event or OS kill
      // stands in for the production before-quit storage flush.
      await new Promise(resolve => child.send('boneman-test-quit', () => resolve()));
    }
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 10000);
        child.once('exit', () => {clearTimeout(timer);resolve();});
      });
    }
    const graceful = child.exitCode === 0;
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    if (browser) await Promise.race([browser.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))]);
    return graceful;
  }
  try {
    const endpoint = await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('Desktop startup timeout: ' + stderr)), 120000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error('Desktop exited: ' + code + '\n' + stderr)); });
      child.stderr.on('data', () => {
        const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {clearTimeout(timer);resolve(match[1]);}
      });
    });
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page');
    return {page, context, close, diagnostics:() => stderr};
  } catch (error) { await close(); throw error; }
}
