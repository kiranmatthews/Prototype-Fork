import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root = resolve('art/mayfield-mall/polish-v1');
const baseUrl = process.env.MAYFIELD_GALLERY_URL ?? 'http://127.0.0.1:5279/';
const playwright = process.env.PLAYWRIGHT_MODULE ?? resolve(homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium} = await import(pathToFileURL(playwright).href);
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json')));
const prompts = JSON.parse(await readFile(resolve(root, 'prompts.json')));
assert.equal(manifest.views.length, 40);
assert.equal(prompts.records.length, 40);
assert.equal(new Set(manifest.views.map(v => v.id)).size, 40);
assert.equal(new Set(prompts.records.map(v => v.id)).size, 40);
assert.equal(manifest.sourceMatches, true);
assert.deepEqual(manifest.errors, []);

const files = [];
for (const view of manifest.views) {
  const record = prompts.records.find(r => r.id === view.id);
  assert.equal(record.status, 'complete');
  assert.equal(record.input, view.screenshot);
  assert.equal(record.output, view.concept);
  assert.ok(record.prompt.length > 500);
  for (const path of [view.screenshot, view.concept]) {
    const bytes = await readFile(resolve(root, path));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (path.startsWith('screenshots/')) assert.deepEqual([width, height], [1920, 1080]);
    else assert.ok(width >= 1500 && height >= 800);
    files.push({path, bytes: bytes.length, width, height,
      sha256: createHash('sha256').update(bytes).digest('hex')});
  }
}
assert.equal(new Set(files.map(f => f.sha256)).size, 80, 'Each capture and concept must be distinct');

const errors = [], checks = [];
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1080}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('response', r => {if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(baseUrl);
  assert.match(await page.locator('#count').textContent(), /^40 \/ 40 concepts complete/);
  assert.equal(await page.locator('article').count(), 40);
  checks.push('40 complete cards and all eight area filters');
  assert.equal(await page.locator('nav button').count(), 9);

  const decoded = await page.evaluate(async paths => {
    const output = [];
    for (const path of paths) {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      const bitmap = await createImageBitmap(await response.blob());
      output.push({path, width: bitmap.width, height: bitmap.height});
      bitmap.close();
    }
    return output;
  }, files.map(f => f.path));
  decoded.forEach((v, i) => assert.deepEqual(v,
    {path: files[i].path, width: files[i].width, height: files[i].height}));
  checks.push('All 80 PNGs fully decoded in Chrome');

  await page.getByRole('button', {name: 'After Hours bonus', exact: true}).click();
  assert.equal(await page.locator('article').count(), 1);
  await page.locator('.frame').click();
  assert.equal(await page.locator('dialog').evaluate(d => d.open), true);
  assert.match(await page.locator('#modal-image').getAttribute('src'), /concepts\/18-/);
  await page.locator('#compare').click();
  assert.match(await page.locator('#modal-image').getAttribute('src'), /screenshots\/18-/);
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('#modal-title').textContent(), /^19/);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  assert.match(await page.locator('#modal-image').getAttribute('src'), /concepts\/18-/);
  await page.locator('#close').click();
  checks.push('Area filter, full-size viewer, source toggle and keyboard navigation');

  await page.getByRole('button', {name: 'All areas', exact: true}).click();
  await page.locator('[data-toggle="1"]').click();
  assert.equal(await page.locator('article').first().locator('img').getAttribute('src'), manifest.views[0].screenshot);
  await page.locator('[data-toggle="1"]').click();
  await page.locator('article').first().locator('img').evaluate(img => img.decode());
  await mkdir(resolve(root, 'evidence'), {recursive: true});
  await page.screenshot({path: resolve(root, 'evidence/gallery-desktop.png')});
  await page.setViewportSize({width: 390, height: 844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path: resolve(root, 'evidence/gallery-mobile.png')});
  checks.push('Card comparison and desktop/mobile layouts without horizontal overflow');

  await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
  assert.equal(await page.locator('article').count(), 40);
  await page.locator('article').first().locator('img').evaluate(img => img.decode());
  checks.push('Standalone file opens offline with local images');
  assert.deepEqual(errors, []);
  await writeFile(resolve(root, 'validation.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), sourceCommit: manifest.sourceCommit,
    concepts: 40, screenshots: 40, checks, browserErrors: errors, files,
  }, null, 2) + '\n');
  console.log(`Mayfield polish: ${files.length} images, ${checks.length} checks, no browser errors`);
} finally {
  await browser.close();
}
