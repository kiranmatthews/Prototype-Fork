import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5173';
const output = '/private/tmp/bone-yard-review'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
const evidence = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  for (const lite of [true, false]) {
    await page.goto(`${base}/bone-yard-review.html?playtest&level=bone-yard${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__boneReview && window.__game?.player.riggedCartoonHandState === 'ready');
    for (const [name, style] of [['Head hit', 'head-pop'], ['Low trip', 'waist-split'], ['Side bail', 'loose-limbs'], ['Fatal scatter', 'yard-sale']]) {
      await page.evaluate(name => window.__boneReview.start(name), name);
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid=bone-yard-status]').textContent).frozen, null, { timeout: 15000 });
      const row = await page.evaluate(() => ({ ...JSON.parse(document.querySelector('[data-testid=bone-yard-status]').textContent), batching: window.__game.player.characterRenderBatchDiagnostics }));
      assert.equal(row.style, style); assert.ok(row.active);
      assert.ok(row.probesThisStep <= 2);
      await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-${style}.png` });
      if (name !== 'Fatal scatter') {
        await page.evaluate(() => window.__boneReview.resume(true));
        await page.waitForFunction(() => {
          const s = JSON.parse(document.querySelector('[data-testid=bone-yard-status]').textContent);
          return s.frozen && s.phase === 'reassembling' && s.returnProgress >= .45;
        }, null, { timeout: 15000 });
        await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-${style}-recall.png` });
        await page.evaluate(() => window.__boneReview.resume());
        await page.waitForFunction(() => !window.__game.player.breakApartDiagnostics.active, null, { timeout: 15000 });
        const whole = await page.evaluate(() => ({ state: window.__game.player.state, diagnostics: window.__game.player.breakApartDiagnostics }));
        assert.ok(whole.state !== 'dead');
      }
      evidence.push({ lite, ...row });
    }
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ evidence, errors }, null, 2));
  console.log(JSON.stringify({ evidence, errors }, null, 2)); assert.deepEqual(errors, []);
} finally { await browser.close(); }
