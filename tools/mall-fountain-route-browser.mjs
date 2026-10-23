import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv.find(s => s.startsWith('http')) || 'http://127.0.0.1:5294';
const bundle = await build({stdin: {contents: "export * as source from './src/levels/mall-measured';export * from './tools/mall-fountain-route-pilot.mjs';export {Vector3} from 'three';", resolveDir: process.cwd()}, bundle: true, format: 'esm', write: false});
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, serviceWorkers: 'block'}), errors = [], fixtures = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
await page.route('**/mall-fountain-fixture.js', r => r.fulfill({contentType: 'application/javascript', body: bundle.outputFiles[0].text}));
try {
  await page.goto(`${base}/?playtest&level=mall`, {timeout: 120000});
  await page.waitForFunction(() => window.__game?.getCurrentLevel().id === 'mall' && !window.__game.gameFlow.blocksGameplay, null, {timeout: 120000});
  await page.evaluate(async () => {
    const {source: m, Vector3, mallFountainRoutes, createMallFountainPilot} = await import('/mall-fountain-fixture.js');
    const g = window.__game, p = g.player, l = g.getLevel();
    const canonical = o => JSON.stringify(o, (_k, v) => typeof v === 'number' ? Math.round(v * 1e7) / 1e7 : v);
    if (canonical(m.MALL_LEVEL) !== canonical(g.getCurrentLevel().data)) throw Error('Stale Mall source');
    const step = p.step.bind(p), update = g.input.update.bind(g.input); let pilot, sample = {}, tuning;
    window.startMallFountain = index => {
      const f = mallFountainRoutes[index], q = m.mallPoint(...f.start);
      q[1] = m.mallSupport(q[0], q[2], q[1] + 1) + .1;
      const heading = new Vector3(0, 0, -1);
      p.respawn(l, true, false, {position: new Vector3(...q), heading});
      p.axisF.copy(heading); p.axisL.set(1, 0, 0);
      pilot = createMallFountainPilot(f); window.mallFountain = pilot.e; tuning = JSON.stringify(g.TUNING);
    };
    g.input.pollGamepad = () => ({id: 'Mall fountain controller', index: 0, connected: true, mapping: 'standard',
      axes: [0, -1, 0, 0], buttons: Array.from({length: 18}, (_, i) => ({pressed: i === 0 && !!sample.jumpHeld, touched: i === 0 && !!sample.jumpHeld, value: i === 0 && sample.jumpHeld ? 1 : 0}))});
    p.step = (dt, input, level) => {
      if (!pilot || pilot.e.done) return;
      sample = pilot.sample(p, m.mallSourcePoint(...p.pos.toArray())); update(); step(dt, input, level);
      pilot.observe(p, m.mallSourcePoint(...p.pos.toArray()));
      if (pilot.e.done) pilot.e.tuningUnchanged = tuning === JSON.stringify(g.TUNING);
    };
  });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(i => window.startMallFountain(i), i);
    if (i === 1) {
      await page.waitForFunction(() => window.mallFountain.frames >= 345 || window.mallFountain.done, null, {timeout: 30000});
      await page.screenshot({path: '/private/tmp/mall-recreation/measured/fountain-route-full.png'});
    }
    await page.waitForFunction(() => window.mallFountain.done, null, {timeout: 30000});
    const f = await page.evaluate(() => window.mallFountain); fixtures.push(f); console.log(JSON.stringify({...f, trace: undefined}));
  }
  const native = JSON.parse(await readFile('/private/tmp/mall-recreation/measured/fountain-route.json', 'utf8'));
  let maxPositionError = 0;
  fixtures.forEach((f, i) => {
    assert.equal(f.frames, native.fixtures[i].frames);
    f.end.forEach((n, axis) => {maxPositionError = Math.max(maxPositionError, Math.abs(n - native.fixtures[i].end[axis]));});
  });
  await writeFile('/private/tmp/mall-recreation/measured/fountain-route-browser.json', JSON.stringify({fixtures, errors, maxPositionError}, null, 2));
  assert.equal(errors.length, 0); assert.ok(maxPositionError < .001);
  assert.ok(fixtures.every(f => f.reached && !f.bail && f.tuningUnchanged && f.jumps.length === 4));
} finally {await browser.close();}
