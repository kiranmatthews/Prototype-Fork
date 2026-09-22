import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const urls = process.argv.slice(2);
if (!urls.length) throw Error('Usage: node tools/test-collectible-lifetime-browser.mjs <changed-url> [baseline-url]');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const rows = [];
try {
  for (const [index, base] of urls.entries()) {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(new URL('?playtest&level=sky', base).href);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay &&
      window.__game.getLoadingDiagnostics().pending.length === 0, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const g = window.__game, level = g.getLevel(), Level = level.constructor;
      const renderer = g.renderer, gl = renderer.getContext(), previousTarget = renderer.getRenderTarget();
      const scene = new g.scene.constructor(), camera = g.camera.clone();
      camera.aspect = 960 / 540;camera.near = .1;camera.far = 50;
      camera.position.set(0, 0, 6);camera.lookAt(0, 0, 0);camera.updateProjectionMatrix();
      const survivor = Level.crystalMesh(.8);scene.add(survivor);
      const halo = survivor.children.find(object => object.isSprite), borrowed = new Set([halo.material.map, halo.geometry]);
      const sharedDisposals = { haloTexture: 0, spriteGeometry: 0 };
      halo.material.map.addEventListener('dispose', () => sharedDisposals.haloTexture++);
      halo.geometry.addEventListener('dispose', () => sharedDisposals.spriteGeometry++);
      const draw = group => {
        // Clone only the object hierarchy: actual Level-owned GPU resources are
        // uploaded, while the live prize retains its gameplay parent/position.
        const copy = group?.clone(true);
        if (copy) { copy.position.set(0, 0, 0);scene.add(copy); }
        renderer.setRenderTarget(null);renderer.render(scene, camera);
        if (copy) scene.remove(copy);
      };
      const memory = () => ({ ...renderer.info.memory, programs: renderer.info.programs.length });
      const samplePixels = () => {
        draw();const pixels = new Uint8Array(64 * 64 * 4);
        gl.readPixels(Math.floor(gl.drawingBufferWidth / 2) - 32, Math.floor(gl.drawingBufferHeight / 2) - 32,
          64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };
      try {
        // Warm all repeatable paths before measuring their slope.
        level.spawnComboGem();draw(level.comboGem.group);level.removeComboGem();
        level.awardGem(g.player.pos);draw(level.gemPickup.group);level.reset(true);draw();
        const start = memory(), samples = [];
        for (let cycle = 0; cycle < 20; cycle++) {
          level.spawnComboGem();draw(level.comboGem.group);level.removeComboGem();
          level.awardGem(g.player.pos);draw(level.gemPickup.group);level.collectGem();
          level.reset(false);level.reset(true);draw();
          if ((cycle + 1) % 5 === 0) samples.push({ cycle: cycle + 1, ...memory() });
        }
        const end = memory(), before = samplePixels();
        const retiredScene = new g.scene.constructor();
        const retiredLevel = new Level(retiredScene, { id: 'collectible-retirement', name: 'Collectible retirement', data: {
          v: 1, name: 'Collectible retirement', spawn: [0, .02, 0], killY: -20, groups: [], components: [
            { t: 'platform', p: [0, -.5, -15], s: [40, 1, 60] }, { t: 'gate', p: [0, 0, -24] },
          ],
        } });
        retiredLevel.root.add(Level.gemMesh());retiredLevel.dispose();
        const after = samplePixels();
        let differentChannels = 0;
        for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) differentChannels++;
        return { level: g.getCurrentLevel().id, start, samples, end,
          geometryGrowth: end.geometries - start.geometries, textureGrowth: end.textures - start.textures,
          sharedDisposals, survivorPixelDifferences: differentChannels, contextLost: gl.isContextLost(),
          glError: gl.getError(), failedAssets: g.getLoadingDiagnostics().failed };
      } finally {
        // Fixture geometry/materials are owned; process-shared halo resources survive.
        survivor.traverse(object => {
          if (object.isMesh && !borrowed.has(object.geometry)) object.geometry.dispose();
          for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) material.dispose();
        });
        renderer.setRenderTarget(previousTarget);
      }
    });
    rows.push({ base, ...result, errors });console.log(JSON.stringify(rows.at(-1)));
    assert.deepEqual(errors, []);assert.deepEqual(result.failedAssets, []);
    assert.equal(result.contextLost, false);assert.equal(result.glError, 0);
    assert.equal(result.survivorPixelDifferences, 0, 'retirement changed surviving halo pixels');
    if (index === 0) {
      assert.equal(result.geometryGrowth, 0, 'repeat rewards leaked uploaded geometry');
      assert.equal(result.textureGrowth, 0, 'repeat rewards leaked uploaded textures');
      assert.deepEqual(result.sharedDisposals, { haloTexture: 0, spriteGeometry: 0 });
    }
    await context.close();
  }
  if (rows.length > 1) assert.ok(rows[1].geometryGrowth > rows[0].geometryGrowth, 'baseline must reproduce the removed-prize leak');
} finally {
  await writeFile(process.env.COLLECTIBLE_LIFETIME_REPORT || '/private/tmp/collectible-lifetime-browser.json', JSON.stringify(rows, null, 2));
  await browser.close();
}
