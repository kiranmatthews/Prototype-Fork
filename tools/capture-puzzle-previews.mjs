// Capture source-level geometry with the game's existing renderer. Run against
// the local Vite server after validating the authored trilogy.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5173/';
const output = new URL('../public/level-previews/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const [id, centre, height] of [
    ['crate-primer', 72, 4], ['switchyard', 141, 6], ['clockwork-gauntlet', 216, 8],
  ]) {
    const url = new URL(base); url.search = `?playtest&level=${id}`;
    await page.goto(url.href);
    await page.waitForFunction(id => window.__game?.getCurrentLevel().id === id && !window.__game.gameFlow.blocksGameplay,
      id, { timeout: 120000 });
    const data = await page.evaluate(async ({ centre, height }) => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const g = window.__game, level = g.getLevel();
      await level.prepareJungleAssets(); await g.player.preparePresentationAssets();
      await Promise.all(level.enemies.map(enemy => enemy.visual.ready));
      g.gameFlow.showPause({ levelName: level.name, inWarpRoom: false });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const renderer = g.renderer, previous = renderer.getRenderTarget();
      const target = new THREE.WebGLRenderTarget(640, 360); target.texture.colorSpace = THREE.SRGBColorSpace;
      const camera = new THREE.PerspectiveCamera(58, 16 / 9, .1, 900);
      camera.position.set(centre - 2, height + 9, 22); camera.lookAt(centre + 3, height, 0);
      camera.updateMatrixWorld(true);
      // The bonus artwork is a camera-sized scene quad. Fit it to this
      // capture-only composition, then restore the live game's original pose.
      const backdrop = g.scene.getObjectByName('BonusParallax_CameraQuad');
      const originalBackdrop = backdrop ? { position: backdrop.position.clone(),
        quaternion: backdrop.quaternion.clone(), scale: backdrop.scale.clone(),
        aspect: backdrop.material.uniforms.uViewportAspect.value } : null;
      if (backdrop) {
        const depth = camera.far * .98;
        const height = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        backdrop.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), depth);
        backdrop.quaternion.copy(camera.quaternion); backdrop.scale.set(height * camera.aspect, height, 1);
        backdrop.material.uniforms.uViewportAspect.value = camera.aspect;
      }
      const bytes = new Uint8Array(640 * 360 * 4), canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(640, 360);
      try {
        renderer.setRenderTarget(target); renderer.clear(); renderer.render(g.scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, 640, 360, bytes);
        for (let y = 0; y < 360; y++) pixels.data.set(bytes.subarray((359 - y) * 640 * 4, (360 - y) * 640 * 4), y * 640 * 4);
        ctx.putImageData(pixels, 0, 0); return canvas.toDataURL('image/jpeg', .92).split(',')[1];
      } finally {
        renderer.setRenderTarget(previous); target.dispose();
        if (backdrop && originalBackdrop) {
          backdrop.position.copy(originalBackdrop.position); backdrop.quaternion.copy(originalBackdrop.quaternion);
          backdrop.scale.copy(originalBackdrop.scale); backdrop.material.uniforms.uViewportAspect.value = originalBackdrop.aspect;
        }
      }
    }, { centre, height });
    await writeFile(new URL(`${id}.jpg`, output), Buffer.from(data, 'base64'));
    console.log(`Captured ${id}.jpg`);
  }
  assert.deepEqual(errors, [], 'preview capture reported browser errors');
} finally { await browser.close(); }
