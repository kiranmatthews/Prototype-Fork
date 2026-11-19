import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [origin, directory] = process.argv.slice(2);
if (!origin || !directory) throw new Error('Usage: node tools/cargo-rider/audit.mjs <Vite origin> <output directory>');

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(directory);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const actions = ['player.idle', 'player.run', 'player.jump', 'player.crawl', 'studio/player.skate-study.basic-ollie'];

try {
  const page = await browser.newPage({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  await page.goto(new URL('tools/cargo-rider/review.html', origin.endsWith('/') ? origin : origin + '/').href);
  await page.waitForFunction(() => window.ready !== undefined, null, { timeout: 90_000 });
  await page.evaluate(() => window.ready);
  const report = await page.evaluate(() => ({
    suites: review.suites, catalog: review.catalog, geometry: review.dimensions, channels: review.controls(),
  }));
  assert.ok(report.geometry.triangles > 0 && report.geometry.triangles <= 150_000, 'Character triangle budget');
  assert.equal(report.geometry.nativeNodes, 72);
  assert.equal(report.channels.length, 21);
  assert.equal(report.catalog.length, report.suites.gameplay + report.suites.starter + report.suites.studio + 2 * report.suites.liveSkate);
  assert.equal(new Set(report.catalog.map(clip => clip.id)).size, report.catalog.length);

  report.motion = [];
  for (let start = 0; start < report.catalog.length; start += 5) {
    report.motion.push(...await page.evaluate(i => review.audit(i, 5), start));
  }
  const samples = [];
  for (const id of actions) samples.push(await page.evaluate(id => review.action(id), id));
  await writeFile(join(output, 'player-actions.json'), JSON.stringify(samples));
  for (const id of [...actions, 'player.grind', 'player.slam', 'player.swim', 'player.rope']) {
    const clip = report.catalog.find(clip => clip.id === id);
    for (const angle of [0, 40, 90]) {
      const { gl } = await page.evaluate(args => review.sample(...args), [id, clip.duration * .38, angle]);
      assert.equal(gl, 0);
      await page.screenshot({ path: join(output, id.replaceAll('/', '-') + '-' + angle + '.png') });
    }
  }
  report.wipeout = await page.evaluate(() => review.wipeoutCheck());
  report.spinTriangles = await page.evaluate(() => review.spinCheck());
  assert.equal(report.spinTriangles, report.geometry.triangles, 'Spin Lab bakes the selected character');
  assert.equal(report.wipeout.tris, report.geometry.triangles);
  assert.ok(report.wipeout.maxEdge < .25, 'A wrist ejected two metres must separate without stretching the skin');
  assert.deepEqual(errors, []);
  const poses = report.motion.reduce((sum, clip) => sum + clip.poses, 0);
  await writeFile(join(output, 'animation-audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ poses, clips: report.catalog.length, ...report.geometry, wipeout: report.wipeout, errors }));
} finally {
  await browser.close();
}
