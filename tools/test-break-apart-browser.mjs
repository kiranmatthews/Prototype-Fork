import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5173';
const output = process.env.WIPEOUT_REVIEW_OUTPUT || '/private/tmp/wipeout-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
const evidence = [], errors = [];
const cases = [
  ['Head hit', 'head-pop', 1], ['Low trip', 'waist-split', 2],
  ['Side bail', null, 0], ['Balance bail', null, 0], ['Slow bump', null, 0],
  ['Held-mask wall', 'head-pop', 1], ['Masked bail', null, 0], ['Masked blast', null, 0], ['Contact death', null, 0],
  ['Blast', 'blast', 9], ['Crusher', 'crush', 9], ['Pit fall', null, 0],
];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  for (const lite of [true, false]) {
    await page.goto(`${base}/bone-yard-review.html?playtest&level=bone-yard${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__boneReview && window.__game?.player.riggedCartoonHandState === 'ready');
    await page.addStyleTag({ content: '[data-testid="bone-review-controls"] { display: none !important; }' });
    for (const [name, style, parts] of cases) {
      await page.evaluate(name => window.__boneReview.start(name), name);
      await page.waitForFunction(() => window.__boneReview.snapshot().frozen, null, { timeout: 15000 });
      const row = await page.evaluate(() => ({ ...window.__boneReview.snapshot(),
        batching: window.__game.player.characterRenderBatchDiagnostics,
        finite: window.__game.player.animationRig.joints.every(j =>
          [...j.node.position.toArray(), ...j.node.quaternion.toArray(), ...j.node.scale.toArray()].every(Number.isFinite)),
      }));
      assert.equal(row.active, Boolean(style), `${name} active`);
      if (style) assert.equal(row.style, style, name);
      assert.equal(row.peakParts, parts, name); assert.ok(row.maxProbes <= 2, name);
      assert.equal(row.finite, true, `${name} finite rig`);
      if (['Blast', 'Crusher', 'Contact death', 'Pit fall'].includes(name)) {
        assert.equal(row.state, 'dead', `${name} actual fatal path`);
        assert.equal(row.lives, 3, `${name} charges exactly one life`);
      }
      if (name.startsWith('Masked')) { assert.notEqual(row.state, 'dead', name); assert.equal(row.masks, 0, name); }
      const filename = `${lite ? 'lite' : 'full'}-${name.toLowerCase().replaceAll(' ', '-')}`;
      await page.screenshot({ path: `${output}/${filename}.png` });
      if (name === 'Head hit' || name === 'Low trip' || name === 'Held-mask wall') {
        await page.evaluate(() => window.__boneReview.resume(true));
        await page.waitForFunction(() => {
          const s = window.__boneReview.snapshot(); return s.frozen && s.phase === 'reassembling' && s.returnProgress >= .45;
        }, null, { timeout: 15000 });
        await page.screenshot({ path: `${output}/${filename}-recall.png` });
        await page.evaluate(() => window.__boneReview.resume());
        await page.waitForFunction(() => !window.__game.player.isBailing && !window.__game.player.breakApartDiagnostics?.active,
          null, { timeout: 15000 });
      } else if (name === 'Side bail' || name === 'Balance bail' || name === 'Masked bail') {
        await page.evaluate(() => window.__boneReview.resume());
        await page.waitForFunction(() => !window.__game.player.isBailing, null, { timeout: 15000 });
        assert.equal(await page.evaluate(() => Boolean(window.__game.player.breakApartDiagnostics?.active)), false);
      }
      evidence.push({ lite, ...row });
      console.log(`${lite ? 'lite' : 'full'} ${name}: ${style ?? 'intact'}, ${row.averageStepMs} ms/step`);
    }
    // Follow the SAME incident through compression, separation, contact and
    // settle. Separate view angles hold its clock fixed; no posed substitutes.
    for (const name of ['Head hit', 'Low trip', 'Balance bail', 'Blast', 'Crusher']) {
      const filename = `${lite ? 'lite' : 'full'}-${name.toLowerCase().replaceAll(' ', '-')}`;
      await page.evaluate(name => { window.__boneReview.angle(1.12); window.__boneReview.start(name, .05); }, name);
      for (const age of [.05, .15, .35, .7, 1.5, 2.8]) {
        if (age > .05) await page.evaluate(age => window.__boneReview.until(age), age);
        await page.waitForFunction(() => window.__boneReview?.snapshot().frozen, null, { timeout: 15000 });
        const frame = await page.evaluate(() => window.__boneReview.snapshot());
        assert.ok(frame.maxProbes <= 2, `${name} motion probe budget`);
        await page.screenshot({ path: `${output}/${filename}-t${Math.round(age * 1000)}.png` });
        if (name === 'Crusher') {
          // Explicit cutaway, in addition to the normal press-visible frame:
          // the collider and incident remain untouched underneath the mesh.
          await page.evaluate(() => { window.__game.getLevel().crushers.at(-1).mesh.visible = false; });
          await page.screenshot({ path: `${output}/${filename}-cutaway-t${Math.round(age * 1000)}.png` });
          await page.evaluate(() => { window.__game.getLevel().crushers.at(-1).mesh.visible = true; });
        }
        if (age === .35) for (const [view, angle] of [['side', Math.PI / 2], ['front', Math.PI]]) {
          await page.evaluate(async angle => {
            window.__boneReview.angle(angle); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
          }, angle);
          await page.screenshot({ path: `${output}/${filename}-${view}.png` });
        }
        await page.evaluate(() => window.__boneReview.angle(1.12));
      }
      console.log(`${lite ? 'lite' : 'full'} ${name}: six motion frames, quarter/side/front`);
    }
    if (!lite) for (const name of ['Balance bail', 'Blast', 'Crusher']) {
      await page.evaluate(async name => {
        window.__boneReview.start(name, .35, 'alternate'); await window.__game.player.preparePresentationAssets();
      }, name);
      for (const age of [.35, 2.8]) {
        if (age > .35) await page.evaluate(age => window.__boneReview.until(age), age);
        await page.waitForFunction(() => window.__boneReview?.snapshot().frozen);
        await page.screenshot({ path: `${output}/full-roo-${name.toLowerCase().replaceAll(' ', '-')}-t${Math.round(age * 1000)}.png` });
      }
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ evidence, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${evidence.length} browser cases: real wall/trip, TNT blast, crusher and pit contact; intact knockdowns, shields, recall, lite/full render, finite rig, console. ${output}`);
