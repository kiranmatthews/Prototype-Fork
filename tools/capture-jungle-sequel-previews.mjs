import { tmpdir } from 'node:os';
// Capture the source-owned sequel temples with the game's renderer. The public
// thumbnails use a wide architectural camera; review shots retain gameplay's
// authored side-view camera and complete post-processing pipeline.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5173/';
const output = new URL('../public/level-previews/', import.meta.url);
const review = process.env.JUNGLE_SEQUEL_REVIEW_OUTPUT || `${tmpdir()}/jungle-sequel-review`;
await mkdir(output, { recursive: true });
await mkdir(review, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const scene of [
    { id: 'jungle-terraces', summit: [362, 34.62, 1.25], eye: [324, 31, 62], target: [354, 20, -16] },
    { id: 'jungle-skyline', summit: [348, 69.12, 1.25], eye: [295, 56, 87], target: [340, 39, -20] },
  ]) {
    const url = new URL(base); url.search = `?playtest&level=${scene.id}`;
    await page.goto(url.href);
    await page.waitForFunction(id => window.__game?.getCurrentLevel().id === id && !window.__game.gameFlow.blocksGameplay,
      scene.id, { timeout: 120000 });
    await page.evaluate(async summit => {
      const g = window.__game, level = g.getLevel();
      await level.prepareJungleAssets(); await g.player.preparePresentationAssets();
      await Promise.all(level.enemies.map(enemy => enemy.visual.ready));
      g.player.respawn(level, true, false, { position: g.player.pos.clone().set(...summit) });
    }, scene.summit);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${review}/${scene.id}-summit-full.png` });
    const data = await page.evaluate(async ({ eye, target }) => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const g = window.__game, level = g.getLevel();
      g.gameFlow.showPause({ levelName: level.name, inWarpRoom: false });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const renderer = g.renderer, previous = renderer.getRenderTarget();
      const renderTarget = new THREE.WebGLRenderTarget(960, 540);
      renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
      const camera = new THREE.PerspectiveCamera(48, 16 / 9, .1, 900);
      camera.position.set(...eye); camera.lookAt(...target); camera.updateMatrixWorld(true);
      const bytes = new Uint8Array(960 * 540 * 4), canvas = document.createElement('canvas');
      canvas.width = 960; canvas.height = 540;
      const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(960, 540);
      try {
        renderer.setRenderTarget(renderTarget); renderer.clear(); renderer.render(g.scene, camera);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, 960, 540, bytes);
        for (let y = 0; y < 540; y++) pixels.data.set(bytes.subarray((539 - y) * 960 * 4, (540 - y) * 960 * 4), y * 960 * 4);
        ctx.putImageData(pixels, 0, 0);
        return canvas.toDataURL('image/jpeg', .92).split(',')[1];
      } finally { renderer.setRenderTarget(previous); renderTarget.dispose(); }
    }, scene);
    await writeFile(new URL(`${scene.id}.jpg`, output), Buffer.from(data, 'base64'));
    console.log(`Captured ${scene.id}.jpg and ${review}/${scene.id}-summit-full.png`);
  }
  await writeFile(`${review}/console-errors.json`, JSON.stringify(errors, null, 2));
  assert.deepEqual(errors, [], 'jungle sequel preview capture reported browser errors');
} finally { await browser.close(); }
