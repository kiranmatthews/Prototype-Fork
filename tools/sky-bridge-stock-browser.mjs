import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {homedir} from 'node:os';
import {join} from 'node:path';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base = process.argv[2] || 'http://127.0.0.1:5377/';
const full = process.argv.includes('--full'), expectOld = process.argv.includes('--expect-old');
const out = process.env.SKY_STOCK_OUTPUT || '/private/tmp/sky-bridge-stock-browser';
await mkdir(out, {recursive: true});
const legacy = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/sky-bridge-before-cloud-extension.json.gz', import.meta.url))));
const migrated = structuredClone(legacy); migrated.data.crateLayoutRevision = 1;
const edited = structuredClone(legacy); edited.data.components[0].p[0] += .01;
const cases = full || expectOld ? [['cached-stock', legacy]] :
  [['fresh', null], ['cached-stock', legacy], ['already-migrated-stock', migrated], ['authored-copy', edited]];
const browser = await chromium.launch({channel: 'chrome', headless: true});
const report = {base, full, expectOld, cases: [], errors: []};
try {
  for (const [name, entry] of cases) {
    const context = await browser.newContext({viewport: {width: 1600, height: 1000}, deviceScaleFactor: 1});
    try {
      await context.addInitScript(({entry, full}) => {
        if (entry && !localStorage.getItem('solProtoUserLevels')) {
          localStorage.setItem('solProtoUserLevels', JSON.stringify([entry]));
          localStorage.setItem('solProtoCloudPulled', '1');
        }
        if (full) localStorage.setItem('solProtoRenderQuality.v1', JSON.stringify({version: 1, enabled: false, baseHeight: 720, outputMultiplier: 1, fixed60: true}));
      }, {entry, full});
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push(e.message));
      page.on('console', m => {if (m.type() === 'error') report.errors.push(m.text());});
      await page.goto(new URL('?playtest&level=sky' + (full ? '' : '&lite'), base).href, {waitUntil: 'domcontentloaded', timeout: 180000});
      const ready = () => page.waitForFunction(() => window.__game?.getCurrentLevel().id === 'sky' &&
        !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded, null, {timeout: 180000});
      const snapshot = () => page.evaluate(() => {
        const g = window.__game, l = g.getLevel();
        return {stamp: document.querySelector('.hud-build')?.textContent,
          components: g.getCurrentLevel().data.components.length,
          gate: l.builtFromData.components.find(c => c.t === 'gate').p,
          checkpoints: l.checkpoints.length, clouds: g.cloudPathPass.diagnostics.clouds,
          cloudContacts: l.groundMeshes.filter(m => m.userData.cloudRoad).length,
          grounded: g.player.grounded, crateSize: l.crates[0].box.max.y - l.crates[0].box.min.y,
          archive: localStorage.getItem('solProtoUserLevels'),
          canvas: [g.renderer.domElement.width, g.renderer.domElement.height]};
      });
      await ready();
      let state = await snapshot();
      const old = expectOld || name === 'authored-copy';
      assert.equal(state.gate[2], old ? -239 : -483);
      assert.equal(state.checkpoints, old ? 3 : 7);
      assert.equal(state.components, old ? 304 : 423);
      assert.ok(Math.abs(state.crateSize - 1.152) < 1e-6);
      if (entry) assert.equal(state.archive, JSON.stringify([entry]), 'lookup rewrote the saved archive');
      assert.match(state.stamp, /Codex\/sol fork/);
      if (!old) {assert.equal(state.clouds, 12); assert.equal(state.cloudContacts, 2);}
      if (full) {
        await page.evaluate(() => {const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
        state = await snapshot(); assert.deepEqual(state.canvas, [1600, 1000]);
        await page.screenshot({path: join(out, name + '-native.png')});
      }
      if (name === 'cached-stock' && !expectOld) {
        await page.reload({waitUntil: 'domcontentloaded'}); await ready();
        const reloaded = await snapshot();
        assert.equal(reloaded.gate[2], -483); assert.equal(reloaded.archive, state.archive);
      }
      const {archive, ...evidence} = state;
      report.cases.push({name, ...evidence, archiveUnchanged: entry ? archive === JSON.stringify([entry]) : null});
      console.log('PASS ' + name + ': gate ' + state.gate[2]);
    } finally {await context.close();}
  }
  assert.deepEqual(report.errors, []);
  report.pass = true;
} finally {
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
