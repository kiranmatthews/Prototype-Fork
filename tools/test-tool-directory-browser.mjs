import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5328/Prototype-Fork/';
const local = process.env.TOOLS_DEV_URL || 'http://127.0.0.1:5327/';
const scope = process.env.TOOLS_REVIEW_SCOPE || 'all';
const output = process.env.TOOLS_REVIEW_OUT || '/private/tmp/tools-directory-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block' });
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'getGamepads', { value: () => [] });
});
const report = { base, local, inventory: null, checks: [], errors: [] };
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(`${message.text()} ${message.location().url}`); });
try {
  await page.goto(new URL('labs/', base).href);
  await page.locator('.destination').first().waitFor();
  assert.match(await page.locator('.stamp').innerText(), /Codex\/sol fork/);
  const total = await page.locator('.destination').count();
  assert.ok(total >= 150);
  await page.screenshot({ path: `${output}/desktop.png` });
  await page.locator('#category').selectOption('Level authoring');
  assert.equal(await page.locator('.destination').count(), 5);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.locator('#search').fill('rail trick speed reward');
  assert.equal(await page.locator('.destination').innerText(), 'GRINDS');
  await page.locator('#search').fill('grindTrickBoost');
  assert.equal(await page.locator('.destination').count(), 1);
  assert.equal(await page.locator('.destination').innerText(), 'GRINDS');
  await page.reload();
  assert.equal(await page.locator('#search').inputValue(), 'grindTrickBoost');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.equal(await page.locator('.destination').count(), total);
  await page.locator('#availability').selectOption('local');
  const localCount = await page.locator('.destination').count();
  await page.locator('.local-settings summary').click();
  await page.locator('.local-settings input').fill(local);
  await page.locator('.local-settings input').press('Tab');
  assert.ok((await page.locator('.destination').first().getAttribute('href')).startsWith(local));
  await page.locator('.local-settings input').fill('javascript:alert(1)');
  await page.locator('.local-settings input').press('Tab');
  assert.equal(await page.locator('.local-settings input').getAttribute('aria-invalid'), 'true');
  assert.ok((await page.locator('.destination').first().getAttribute('href')).startsWith(local));
  await page.locator('.local-settings input').fill(local);
  await page.locator('.local-settings input').press('Tab');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  const links = await page.locator('.destination').evaluateAll(elements => elements.map(el => ({ name: el.textContent, href: el.href })));
  // Fetch all distinct HTML destinations; query variants share an HTML entry.
  const paths = [...new Set(links.map(link => { const url = new URL(link.href); url.search = ''; url.hash = ''; return url.href; }))];
  for (const path of paths) {
    const response = await context.request.get(path);
    assert.equal(response.status(), 200, `Unreachable directory link: ${path}`);
    assert.match(response.headers()['content-type'], /text\/html/, path);
  }
  report.inventory = { total, local: localCount, published: total - localCount, distinctHtmlLinks: paths.length };
  await page.locator('.local-settings summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  await page.screenshot({ path: `${output}/mobile.png` });
  report.checks.push('Desktop/mobile layout, search, bookmark reload, all filters, server URL validation and all HTML links');
  await page.setViewportSize({ width: 1280, height: 800 });
  const routes = [...new Set(links.map(link => new URL(link.href).searchParams.get('tool')).filter(Boolean))];
  const selectors = {
    characterlab: '.clab', animationstudio: '.ast-root', waterstudio: '.pst', puffstudio: '.pst', swirlstudio: '.pst', fieldstudio: '.pst',
    tuning: '.side-wrap.right:not(.collapsed)', menu: '.side-wrap.left:not(.collapsed)', editor: '.ed-panel',
    crt: '[data-crt-guest-panel-host][data-open]', render: '[data-render-quality-panel-host][data-open]',
    board: '[data-skateboard-panel-host][data-open]', spin: '[data-spin-panel-host][data-open]', look: 'visual-treatment-panel[data-open]',
    text: '.secondary-text-tuner[open]',
  };
  for (const route of scope === 'all' ? routes : []) {
    const url = new URL(links.find(link => new URL(link.href).searchParams.get('tool') === route).href);
    url.searchParams.set('lite', '');
    await page.goto(url.href);
    await page.waitForFunction(route => window.__game && (['options', 'save-load', 'level-select'].includes(route)
      ? window.__game.gameFlow.currentScreen === route
      : document.body.dataset.activeTool === route), route, { timeout: 90000 });
    if (selectors[route]) await page.locator(selectors[route]).waitFor({ state: 'visible' });
    await page.screenshot({ path: `${output}/${route}.png` });
    report.checks.push(`Lite direct route: ${route}`);
    console.log(`PASS ${route}`);
  }
  // A stale editor preference cannot mask a requested studio or tuner.
  await page.evaluate(() => {
    localStorage.setItem('solProtoEditorOpen', '1'); localStorage.setItem('solProtoEditorTarget', 'jungle');
    localStorage.setItem('solProtoDebugChrome', 'hidden');
  });
  for (const name of scope === 'all' ? ['GRINDS', 'Level editor · environment', 'Character Lab', 'CRT shader tuning'] : []) {
    const url = new URL(links.find(link => link.name === name).href);
    await page.goto(url.href);
    await page.waitForFunction(route => document.body.dataset.activeTool === route, url.searchParams.get('tool'), { timeout: 90000 });
    if (name === 'GRINDS') {
      assert.equal(await page.evaluate(() => window.__game.editor.active), false);
      const heading = page.locator('[data-tool-section="grinds"]');
      const box = await heading.boundingBox();
      assert.ok(box && box.y >= 0 && box.y < 800, `Grinds heading not scrolled into view: ${JSON.stringify(box)}`);
      assert.equal(await page.evaluate(() => localStorage.getItem('solProtoDebugChrome')), 'hidden');
    }
    if (name.includes('environment')) assert.equal(await page.locator('.ed-environment').getAttribute('open'), '');
    await page.screenshot({ path: `${output}/full-${url.searchParams.get('tool')}.png` });
    report.checks.push(`Full renderer: ${name}`);
    console.log(`PASS full ${name}`);
  }
  for (const file of scope !== 'directory' ? ['skateboard-lab.html?tab=map-ui', 'spin-lab.html', 'roo-type-lab.html?palette=bonus', 'crt-review.html', 'milk-review.html', 'skate-pose-review.html'] : []) {
    await page.goto(new URL(file, base).href);
    await page.locator('canvas').first().waitFor();
    await page.waitForTimeout(1300);
    report.checks.push(`Standalone: ${file}`);
    console.log(`PASS standalone ${file}`);
  }
  if (scope !== 'directory') {
    const tuningLinks = links.filter(link => {
      const url = new URL(link.href); return url.searchParams.get('tool') === 'tuning' && url.searchParams.has('section');
    });
    await page.goto(new URL('?playtest&level=codex-lab&tool=tuning&lite', base).href);
    await page.waitForFunction(() => document.body.dataset.activeTool === 'tuning', null, {timeout: 90000});
    for (const link of tuningLinks) {
      const section = new URL(link.href).searchParams.get('section');
      await page.evaluate(section => window.__game.ui.openToolPanel('right', section), section);
      const box = await page.locator(`[data-tool-section="${section}"]`).boundingBox();
      assert.ok(box && box.y >= 0 && box.y < 800, `Section not reachable: ${section}`);
    }
    report.checks.push(`All ${tuningLinks.length} tuning section targets exist and scroll into view`);
    for (const section of ['selection', 'project', 'environment', 'add', 'layers']) {
      await page.goto(new URL(`?playtest&level=codex-lab&tool=editor&section=${section}&lite`, base).href);
      await page.waitForFunction(() => document.body.dataset.activeTool === 'editor', null, {timeout: 90000});
      assert.equal(await page.evaluate(() => window.__game.editor.active), true);
      const expected = {selection: '.ed-ptab-on', project: '.ed-ptab-on', environment: '.ed-environment[open]', add: '.ed-tab-on', layers: '.ed-tab-on'}[section];
      const text = await page.locator(expected).first().innerText();
      if (section !== 'environment') assert.match(text, new RegExp({selection:'SELECTION',project:'PROJECT',add:'ADD',layers:'LAYERS'}[section]));
      console.log(`PASS editor ${section}`);
    }
    report.checks.push('All five editor workspace bookmarks');
    await page.goto(new URL('?playtest&level=warproom&tool=waterstudio&lite', base).href);
    await page.waitForFunction(() => document.body.dataset.activeTool === 'waterstudio', null, {timeout: 90000});
    await page.locator('[data-ocean-context="map"]').waitFor({state:'visible'});
    report.checks.push('Independent world-map Water Studio bookmark');
    await page.goto(new URL('#fieldstudio', base).href);
    await page.waitForFunction(() => document.body.dataset.activeTool === 'fieldstudio', null, {timeout: 90000});
    await page.locator('.pst').waitFor({state:'visible'});
    report.checks.push('Legacy studio hash bypass with full renderer');
  }
  assert.deepEqual(report.errors, [], 'Browser errors');
  console.log(JSON.stringify(report.inventory));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
