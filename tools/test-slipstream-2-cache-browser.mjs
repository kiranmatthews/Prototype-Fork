import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:5199').replace(/\/$/, '');
const source = await readFile(new URL('./fixtures/slipstream-camera/original-course.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { SLIPSTREAM_2_LEVEL: old } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const reports = [], errors = [];
try {
  for (const edited of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
    const data = structuredClone(old); if (edited) data.components[0].color = '#123456';
    await page.addInitScript(data => { localStorage.setItem('solProtoUserLevels', JSON.stringify([{ id: 'slipstream-2', name: data.name, data }])); localStorage.setItem('solProtoCloudPulled', '1'); }, data);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/?playtest&level=slipstream-2${edited ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded, null, { timeout: 120000 });
    const result = await page.evaluate(() => ({ components: window.__game.getCurrentLevel().data.components.length,
      position: window.__game.player.pos.toArray(), stamp: document.querySelector('.hud-build').textContent,
      saved: JSON.parse(localStorage.getItem('solProtoUserLevels'))[0].data.components.length }));
    assert.equal(result.components, edited ? 1111 : 401); assert.equal(result.saved, 1111);
    assert.match(result.stamp, /Codex\/sol fork/); reports.push({ edited, ...result });
    if (!edited) await page.screenshot({ path: '/private/tmp/slipstream-returning-player.png' });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await writeFile('/private/tmp/slipstream-cache-browser.json', JSON.stringify({ base, reports, errors }, null, 2)); await browser.close(); }
console.log(JSON.stringify(reports, null, 2));
