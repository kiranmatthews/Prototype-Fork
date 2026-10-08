import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '../../desktop/node_modules/playwright/index.mjs';
import { testGpuArgs } from './test-gpu.mjs';

const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const desktop = path.resolve(fileURLToPath(new URL('../../desktop/', import.meta.url)));

// Use the same Chromium debugging transport as the packaged-app test. This
// avoids Electron's experimental Node-inspector test bootstrap on Windows.
export async function launchSource(profile) {
  const child = spawn(require('electron'), [...testGpuArgs, '--remote-debugging-port=0', path.join(desktop, 'main.cjs')], {
    env:{...process.env, BONEMAN_USER_DATA:profile}, stdio:['ignore','pipe','pipe'],
  });
  let stderr = '', browser;
  child.stdout.resume();
  child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-16000); });
  async function close() {
    if (browser) await Promise.race([browser.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
        child.once('exit', () => {clearTimeout(timer);resolve();});
      });
    }
  }
  try {
    const endpoint = await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('Desktop startup timeout: ' + stderr)), 60000);
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
