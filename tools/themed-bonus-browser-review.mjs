import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Visual fixtures only: each course starts from its actual source entry, then
// one native respawn frames a representative room. This is not an all-box run.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:5173/';
const selected = process.argv.find(arg => arg.startsWith('--level='))?.slice(8);
const output = process.env.THEMED_BONUS_REVIEW_OUTPUT || `${tmpdir()}/themed-bonus-review`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const reports = [];
const failures = [];
try {
  const inventoryContext = await browser.newContext();
  const inventoryPage = await inventoryContext.newPage();
  await inventoryPage.goto(base);
  const courses = await inventoryPage.evaluate(async () => {
    const { THEMED_BONUS_COURSES } = await import('/src/levels/themed-bonuses.ts');
    return THEMED_BONUS_COURSES.map(({ id, parentId, theme, data, rooms }) => ({ id, parentId, theme, name: data.name, rooms }));
  });
  await inventoryContext.close();
  for (const course of courses.filter(course => !selected || selected === course.id)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(), errors = [], parallaxRequests = [];
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', message: message.text() }); });
    page.on('request', request => { if (request.url().includes('/bonus-parallax/')) parallaxRequests.push(request.url()); });
    const report = { id: course.id, parentId: course.parentId, name: course.name, theme: course.theme,
      mode: 'Chrome full render with fresh isolated browser storage; source spawn plus native-respawn visual fixture',
      errors, parallaxRequests, screenshots: [] };
    try {
      await page.goto(new URL(`?playtest&level=${course.id}&renderdiag`, base).href);
      await page.waitForFunction(id => window.__game?.getCurrentLevel().id === id &&
        !window.__game.gameFlow.blocksGameplay && document.querySelector('#render-diagnostics')?.textContent,
        course.id, { timeout: 120000 });
      await page.waitForTimeout(1500);
      const snapshot = () => page.evaluate(() => {
        const g = window.__game, p = g.player;
        const diagnostics = JSON.parse(document.querySelector('#render-diagnostics').textContent);
        const parallaxNodes = [];
        g.scene.traverse(node => { if (node.name.includes('BonusParallax')) parallaxNodes.push(node.name); });
        return { levelId: g.getCurrentLevel().id, loading: g.gameFlow.blocksGameplay,
          position: p.pos.toArray(), grounded: p.grounded, state: p.state,
          camera: g.camera.position.toArray(), parallaxNodes, bonusParallax: diagnostics.assets.bonusParallax,
          render: diagnostics.sceneDraw, sky: diagnostics.assets.activeSky,
          scenery: diagnostics.jungle, assets: g.getLoadingDiagnostics() };
      });
      report.spawn = await snapshot();
      assert.equal(report.spawn.levelId, course.id);
      assert.equal(report.spawn.loading, false);
      assert.equal(report.spawn.grounded, true, `${course.id}: source spawn unsupported`);
      assert.deepEqual(report.spawn.parallaxNodes, [], `${course.id}: old parallax quad remains`);
      assert.equal(report.spawn.bonusParallax, null, `${course.id}: parallax diagnostics remain`);
      assert.ok(report.spawn.render.triangles > 0, `${course.id}: no full-render world triangles`);
      const spawnPath = `${output}/${course.id}-spawn.png`;
      await page.screenshot({ path: spawnPath }); report.screenshots.push(spawnPath);
      const room = course.rooms[Math.floor(course.rooms.length / 2)];
      await page.evaluate(room => {
        const g = window.__game, p = g.player, l = g.getLevel();
        p.respawn(l, true, false, { position: p.pos.clone().set(room.a + 2, room.floorY + .12, 0),
          heading: p.pos.clone().set(1, 0, 0) });
      }, room);
      await page.waitForTimeout(1800);
      report.room = { index: room.index, pattern: room.pattern, fixture: 'native respawn at supported observation court', ...await snapshot() };
      const roomPath = `${output}/${course.id}-room.png`;
      await page.screenshot({ path: roomPath }); report.screenshots.push(roomPath);
      assert.equal(report.room.loading, false);
      assert.equal(report.room.grounded, true, `${course.id}: representative room observation unsupported`);
      assert.deepEqual(report.room.parallaxNodes, []);
      assert.equal(report.room.bonusParallax, null);
      assert.deepEqual(parallaxRequests, [], `${course.id}: old panorama assets requested`);
      assert.deepEqual(errors, [], `${course.id}: browser console/page errors`);
      report.passed = true;
    } catch (error) {
      report.passed = false; report.failure = String(error);
      report.blockedAt = await page.evaluate(() => ({ levelId: window.__game?.getCurrentLevel().id,
        loading: window.__game?.getLoadingDiagnostics(), body: document.body.innerText.slice(0, 600) })).catch(() => null);
      await page.screenshot({ path: `${output}/${course.id}-failure.png` }).catch(() => {});
      failures.push({ id: course.id, failure: report.failure, errors });
    }
    reports.push(report);
    await writeFile(`${output}/${course.id}.json`, JSON.stringify(report, null, 2));
    await writeFile(`${output}/report.json`, JSON.stringify({ mode: 'visual fixtures, not continuous completion', reports, failures }, null, 2));
    console.log(JSON.stringify({ id: course.id, passed: report.passed, screenshots: report.screenshots.length,
      triangles: report.spawn?.render?.triangles, errors: errors.length, failure: report.failure }));
    await context.close();
  }
} finally { await browser.close(); }
assert.deepEqual(failures, [], 'Some themed bonus full-render visual fixtures failed');
console.log(`PASS ${reports.length} themed bonus full-render source spawns and representative room fixtures; no panorama objects, assets or console errors. Output: ${output}`);
