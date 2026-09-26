// Real-browser pixel comparison against a served, unmodified checkout. Keep the
// same authored atlas resolution, Canvas backend, phase and transforms on both.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate) throw Error('Usage: node tools/test-roo-atlas-cache-browser.mjs <baseline-url> <candidate-url>');
const output = process.env.ROO_CACHE_OUTPUT || '/private/tmp/roo-atlas-cache-parity';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const rows = [], errors = [];
try {
  for (const [dpr, expectedCap] of [[1, 128], [3, 256], [4, 512]]) {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.route('**/__atlas_cache_test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>Atlas cache parity</title>' }));
    // Vite only serves module CORS to permitted origins. Proxy the old module
    // through a test-only same-origin URL; its unchanged shared dependencies
    // and atlas assets intentionally resolve from the candidate fixture.
    await page.route('**/src/roo-type/atlas.ts?parity-baseline', async route => {
      const response = await route.fetch({ url: new URL('/src/roo-type/atlas.ts', baseline).href });
      await route.fulfill({ response });
    });
    await page.goto(new URL('/__atlas_cache_test', candidate).href);
    const result = await page.evaluate(async ({ candidate, expectedCap }) => {
      const old = await import(new URL('/src/roo-type/atlas.ts?parity-baseline', candidate).href);
      const next = await import(new URL('/src/roo-type/atlas.ts', candidate).href);
      await Promise.all([old.loadRooAtlases(), next.loadRooAtlases()]);
      if (!old.rooAtlasDiagnostics().decodedBytes || !next.rooAtlasDiagnostics().decodedBytes) throw Error('Atlases did not decode');
      const oldPainter = new old.RooAtlasPainter(), nextPainter = new next.RooAtlasPainter();
      const phases = [-1, -.75, -.03125, 0, .03125, .75, 1, -.5, .5];
      const cases = [
        { name: 'map', text: 'BEACHSIDE', size: 156 * .882, ratio: 1, width: 1536, height: 512, maxWidth: 1430, palette: 'counter' },
        { name: 'map-fit', text: 'WATERWORKS WAREHOUSE', size: 156 * .882, ratio: 1, width: 1536, height: 512, maxWidth: 1100, palette: 'counter' },
        { name: 'counter', text: '36/112', size: 72, ratio: 1.75, width: 960, height: 400, maxWidth: 700, palette: 'counter' },
        { name: 'bonus', text: 'BONUS', size: 85, ratio: 3, width: 1500, height: 600, maxWidth: 700, palette: 'bonus' },
        { name: 'oversized-fallback', text: 'A LONG TEXT RASTER', size: 300, ratio: 3, width: 1400, height: 800, maxWidth: 1800, palette: 'counter' },
      ];
      const failures = [], checks = [];
      const compare = (a, b) => {
        let changed = 0, maximum = 0;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { changed++; maximum = Math.max(maximum, Math.abs(a[i] - b[i])); }
        return { changed, maximum };
      };
      for (const readFrequently of [false, true]) for (const spec of cases) {
        const canvases = [document.createElement('canvas'), document.createElement('canvas')];
        for (const canvas of canvases) { canvas.width = spec.width; canvas.height = spec.height; }
        for (const phase of phases) {
          const pixels = [oldPainter, nextPainter].map((painter, index) => {
            const ctx = canvases[index].getContext('2d', { willReadFrequently: readFrequently });
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, spec.width, spec.height); ctx.scale(spec.ratio, spec.ratio);
            painter.draw(ctx, spec.text, spec.width / spec.ratio / 2 + .125, spec.height / spec.ratio / 2 + .25,
              { size: spec.size, maxWidth: spec.maxWidth, palette: spec.palette, align: 'center', lightPosition: phase, tracking: .1 });
            return ctx.getImageData(0, 0, spec.width, spec.height).data;
          });
          const diff = compare(...pixels);
          checks.push({ name: spec.name, readFrequently, phase, ...diff });
          if (diff.changed) failures.push(checks.at(-1));
        }
      }
      // A phase sweep after warmup must only mix cached static text surfaces.
      nextPainter.dispose();
      const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 512;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      for (const phase of [-1, 0, 1]) nextPainter.draw(ctx, 'BEACHSIDE', 768, 256, { size: 156 * .882, lightPosition: phase, align: 'center' });
      let atlasDraws = 0;
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
        if (image instanceof HTMLImageElement && image.src.includes('/fonts/roo-')) atlasDraws++;
        return drawImage.call(this, image, ...args);
      };
      try { for (const phase of phases) nextPainter.draw(ctx, 'BEACHSIDE', 768, 256, { size: 156 * .882, lightPosition: phase, align: 'center' }); }
      finally { CanvasRenderingContext2D.prototype.drawImage = drawImage; }
      let maxBytes = 0;
      for (let i = 0; i < 80; i++) {
        for (const phase of [-1, 0, 1]) nextPainter.draw(ctx, `COUNT ${i}`, 768, 256, { size: 80 + i, lightPosition: phase, align: 'center' });
        maxBytes = Math.max(maxBytes, nextPainter.cacheBytes);
      }
      const residents = [...nextPainter.cache.values()].flatMap(item => [item.canvas, ...item.lights.filter(Boolean)]);
      const actualResidentBytes = residents.reduce((sum, item) => sum + item.width * item.height * 4, 0);
      const accountedBytes = nextPainter.cacheBytes, entries = nextPainter.cache.size;
      nextPainter.dispose();
      const disposed = nextPainter.cacheBytes === 0 && nextPainter.cache.size === 0 && residents.every(canvas => canvas.width === 1 && canvas.height === 1);
      return { cap: next.rooAtlasDiagnostics().cap, expectedCap, checkedPixels: checks.length, failures, atlasDraws, maxBytes, actualResidentBytes, accountedBytes, entries, disposed };
    }, { baseline, candidate, expectedCap });
    rows.push(result);
    assert.equal(result.cap, expectedCap);
    assert.deepEqual(result.failures, [], 'cached lighting must preserve exact premultiplied pixels');
    assert.equal(result.atlasDraws, 0, 'warm light animation must not resample any atlas glyphs');
    assert.ok(result.maxBytes <= (expectedCap === 512 ? 16 : 4) * 1048576);
    assert.equal(result.actualResidentBytes, result.accountedBytes);
    assert.ok(result.entries <= 32 && result.disposed);
    console.log(JSON.stringify(result));
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ rows, errors }, null, 2));
  await browser.close();
}
