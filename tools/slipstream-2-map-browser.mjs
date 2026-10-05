// Scoped real-browser map, preview and touch-menu validation for Slipstream 2.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv.find(value => /^https?:/.test(value)) || 'http://127.0.0.1:5193').replace(/\/$/, '');
const output = '/private/tmp/slipstream-2-map-browser';
const captureOnly = process.argv.includes('--capture-only');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], report = { base, checks: [], errors };
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120000);
const watch = target => {
  target.on('pageerror', error => errors.push(error.message));
  target.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
};
watch(page);
const ready = target => target.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
const selected = key => page.waitForFunction(key => document.querySelector('.world-map-ui')?.dataset.selectedKey === key && !document.querySelector('.world-map-ui')?.classList.contains('is-moving'), key, { timeout: 60000 });
try {
  await page.goto(`${base}/?playtest&level=slipstream-2`);
  await ready(page);
  await page.waitForTimeout(600);
  const entry = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    return { level: g.getCurrentLevel().id, grounded: p.grounded, position: p.pos.toArray(), deaths: p.totalDeaths, stamp: document.querySelector('.hud-build')?.textContent, render: g.getRenderFrameStats() };
  });
  assert.equal(entry.level, 'slipstream-2');
  assert.equal(entry.grounded, true);
  assert.equal(entry.deaths, 0);
  assert.match(entry.stamp, /Codex\/sol fork/);
  assert.ok(entry.render.triangles > 1000);
  await page.screenshot({ path: `${output}/temple-entry-full.png` });
  report.entry = entry;
  report.checks.push('Full-render direct playtest enters supported temple spawn');

  if (process.argv.includes('--capture-preview')) {
    const image = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js'), g = window.__game;
      await g.getLevel().prepareJungleAssets();
      g.gameFlow.showPause({ levelName: 'Slipstream 2', inWarpRoom: false });
      const camera = new THREE.PerspectiveCamera(58, 16 / 9, .1, 1600);
      camera.position.set(70, 233, 72); camera.lookAt(0, 170, -85);
      camera.updateMatrixWorld(true); g.scene.updateMatrixWorld(true);
      const render = g.renderer, old = render.getRenderTarget(), face = render.getActiveCubeFace(), mip = render.getActiveMipmapLevel();
      const view = render.getViewport(new THREE.Vector4()), scissor = render.getScissor(new THREE.Vector4()), test = render.getScissorTest();
      const rt = new THREE.WebGLRenderTarget(640, 360); rt.texture.colorSpace = THREE.SRGBColorSpace;
      const bytes = new Uint8Array(640 * 360 * 4), canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(640, 360), visible = g.player.group.visible;
      try {
        g.player.group.visible = false; render.setRenderTarget(rt); render.setScissorTest(false); render.clear(); render.render(g.scene, camera); render.readRenderTargetPixels(rt, 0, 0, 640, 360, bytes);
        for (let y = 0; y < 360; y++) pixels.data.set(bytes.subarray((359 - y) * 640 * 4, (360 - y) * 640 * 4), y * 640 * 4);
        ctx.putImageData(pixels, 0, 0);
        return { jpeg: canvas.toDataURL('image/jpeg', .92).split(',')[1], evidence: { size: [640, 360], camera: camera.position.toArray(), capture: 'Real authored temple and skate geometry, existing scene renderer' } };
      } finally {
        g.player.group.visible = visible; render.setRenderTarget(old, face, mip); render.setViewport(view); render.setScissor(scissor); render.setScissorTest(test); rt.dispose();
      }
    });
    await writeFile(new URL('../public/level-previews/slipstream-2.jpg', import.meta.url), Buffer.from(image.jpeg, 'base64'));
    report.preview = image.evidence;
    report.checks.push('Actual level geometry preview captured');
  }

  if (!captureOnly) {
  await page.goto(`${base}/?playtest&level=slipstream-2`); await ready(page);
  // A save fixture isolates the new branch. Subsequent travel and entry use
  // the ordinary keyboard handlers and real campaign unlock state.
  await page.evaluate(() => { const g = window.__game; g.campaign.startEphemeral(); g.campaign.commitClear('sky', {}); g.campaign.setMapFocus('slipstream'); g.switchLevel('warproom'); });
  await selected('slipstream');
  assert.equal(await page.evaluate(() => window.__game.campaign.levelUnlocked('slipstream-2')), false);
  await page.keyboard.press('ArrowUp', { delay: 80 });
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => document.querySelector('.world-map-ui').dataset.selectedKey), 'slipstream');
  report.checks.push('Fresh locked sequel branch cannot be entered');
  await page.evaluate(() => { const g = window.__game; g.campaign.commitClear('slip', {}); g.campaign.setMapFocus('slipstream'); g.switchLevel('warproom'); });
  await selected('slipstream');
  await page.keyboard.press('ArrowUp', { delay: 80 }); await selected('slipstream-2');
  await page.waitForFunction(() => window.__game.getMapPresentationDiagnostics()?.shownKey === 'slipstream-2' && !window.__game.getMapPresentationDiagnostics().flipping);
  const card = await page.evaluate(() => ({ name: document.querySelector('.world-map-level-name')?.textContent, key: document.querySelector('.world-map-ui').dataset.selectedKey, position: window.__game.player.pos.toArray(), unlocked: window.__game.campaign.levelUnlocked('slipstream-2'), presentation: window.__game.getMapPresentationDiagnostics() }));
  assert.equal(card.name, 'SLIPSTREAM 2'); assert.equal(card.unlocked, true); assert.ok(card.presentation.draws > 0);
  assert.ok(Math.hypot(card.position[0] + 47, card.position[1] - 11, card.position[2] + 1) < .05);
  await page.screenshot({ path: `${output}/map-full.png` }); report.map = card;
  await page.keyboard.press('ArrowDown', { delay: 80 }); await selected('slipstream');
  await page.keyboard.press('ArrowUp', { delay: 80 }); await selected('slipstream-2');
  await page.keyboard.press('Enter', { delay: 80 });
  await page.waitForFunction(() => window.__game.getCurrentLevel().id === 'slipstream-2' && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__game.player.grounded), true);
  report.checks.push('Unlocked map Up/Down branch travel and Enter launch work in full rendering');

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const touch = await context.newPage(); watch(touch); touch.setDefaultNavigationTimeout(120000);
  await touch.goto(`${base}/?playtest&level=slipstream-2&lite`); await ready(touch);
  await touch.evaluate(() => { const g = window.__game; g.campaign.startEphemeral(); g.campaign.commitClear('slip', {}); g.campaign.setMapFocus('slipstream-2'); g.switchLevel('warproom'); });
  await touch.waitForFunction(() => document.querySelector('.world-map-ui')?.dataset.selectedKey === 'slipstream-2' && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
  await touch.locator('.world-map-action').filter({ hasText: 'LEVEL STATS' }).tap();
  await touch.waitForFunction(() => window.__game.gameFlow.currentScreen === 'level-select');
  await touch.waitForFunction(() => { const image = document.querySelector('img.game-level-preview'); return image?.complete && image.naturalWidth === 640 && image.naturalHeight === 360 && image.src.endsWith('/slipstream-2.jpg'); });
  const row = touch.locator('[data-level-key="slipstream-2"]'); await row.scrollIntoViewIfNeeded();
  const mobile = await touch.evaluate(() => {
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const row = document.querySelector('[data-level-key="slipstream-2"]'), list = document.querySelector('.game-level-list'), panel = document.querySelector('.game-shell-panel');
    return { viewport: [innerWidth, innerHeight], island: document.querySelector('.game-level-select-layout').dataset.island, row: { disabled: row.disabled, rect: rect(row) }, list: { rect: rect(list), scroll: [list.scrollTop, list.scrollHeight, list.clientHeight] }, panelScroll: [panel.scrollTop, panel.scrollLeft], pageWidth: document.documentElement.scrollWidth, preview: { alt: document.querySelector('img.game-level-preview').alt, src: document.querySelector('img.game-level-preview').src } };
  });
  assert.equal(mobile.island, 'island-1'); assert.equal(mobile.row.disabled, false); assert.ok(mobile.row.rect.height >= 47.99); assert.deepEqual(mobile.panelScroll, [0, 0]); assert.ok(mobile.pageWidth <= 390);
  assert.ok(mobile.row.rect.y >= mobile.list.rect.y - 1 && mobile.row.rect.bottom <= mobile.list.rect.bottom + 1); assert.equal(mobile.preview.alt, 'Slipstream 2');
  await touch.screenshot({ path: `${output}/level-select-touch.png` }); await row.tap();
  await touch.waitForFunction(() => window.__game.getCurrentLevel().id === 'slipstream-2' && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
  report.mobile = mobile; report.checks.push('390×844 touch Level Stats shows actual preview and bounded 48 px sequel row; tap launches');
  await context.close();
  }
  assert.deepEqual(errors, []); console.log(JSON.stringify(report, null, 2));
} finally { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
