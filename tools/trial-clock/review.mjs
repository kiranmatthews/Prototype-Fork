import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5337/';
const output = process.env.TRIAL_CLOCK_MODEL_OUTPUT || '/private/tmp/trial-clock-model/review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], reports = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}?playtest&level=codex-lab${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game?.getLevel().clockPickup?.group.userData.trialClockAsset === 'ready' &&
      !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    const model = await page.evaluate(() => {
      const g = window.__game, l = g.getLevel(), root = l.clockPickup.group;
      const meshes = [];
      root.traverse(o => { if (o.isMesh) meshes.push(o); });
      const mesh = meshes[0], bounds = g.player.playerBox.clone().setFromObject(root);
      window.__clockArt = { geometry: mesh.geometry, material: mesh.material };
      return { meshes: meshes.length, triangles: mesh.geometry.index.count / 3,
        texture: [mesh.material.map.image.width, mesh.material.map.image.height],
        anisotropy: mesh.material.map.anisotropy, minFilter: mesh.material.map.minFilter,
        editorTags: meshes.every(m => m.userData.editorIdx === root.userData.editorIdx),
        fitsPickup: l.clockPickup.box.containsBox(bounds), shared: mesh.geometry.userData.shared && mesh.material.userData.shared };
    });
    assert.equal(model.meshes, 1); assert.equal(model.triangles, 4032);
    assert.deepEqual(model.texture, [1024, 1024]); assert.equal(model.anisotropy, 8);
    assert.equal(model.minFilter, 1008); // Three.LinearMipmapLinearFilter
    assert.equal(model.editorTags, true); assert.equal(model.fitsPickup, true); assert.equal(model.shared, true);
    for (const [angle, size] of [[0, 512], [45, 512], [180, 512], [0, 128], [65, 128]]) {
      const data = await page.evaluate(({ angle, size }) => {
        const g = window.__game;
        const renderer = new g.renderer.constructor({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(1); renderer.setSize(size, size);
        renderer.outputColorSpace = g.renderer.outputColorSpace;
        renderer.toneMapping = g.renderer.toneMapping;
        renderer.toneMappingExposure = g.renderer.toneMappingExposure;
        const scene = new g.scene.constructor(); scene.background = g.scene.fog.color.clone();
        for (const light of g.scene.children) if (light.isLight) scene.add(light.clone());
        const model = g.getLevel().clockPickup.group.clone(true);
        model.visible = true; model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); scene.add(model);
        const camera = g.camera.clone(); camera.aspect = 1; camera.fov = 38; camera.near = .01; camera.far = 100;
        const a = angle * Math.PI / 180;
        camera.position.set(Math.sin(a) * 3.1, .55, Math.cos(a) * 3.1); camera.lookAt(0, .2, 0); camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const data = renderer.domElement.toDataURL('image/png'); renderer.dispose(); renderer.forceContextLoss();
        return data;
      }, { angle, size });
      await writeFile(`${output}/${lite ? 'lite' : 'full'}-${angle}-${size}.png`, Buffer.from(data.split(',')[1], 'base64'));
    }
    // A supported review platform puts the moving clock clearly in the game view.
    await page.evaluate(() => {
      const g = window.__game;
      const data = { v: 1, name: 'Neon trial timer review', spawn: [0, .05, 5], killY: -15, startWarpPad: false,
        components: [{ t: 'platform', p: [0, -.5, 0], s: [16, 1, 24] },
          { t: 'clock', p: [0, 0, 0] }, { t: 'gate', p: [0, 0, -9] }] };
      const id = g.saveUserLevel({ id: '', name: data.name, data });
      if (!id || !g.switchLevel(id)) throw Error('Clock review platform failed to load');
      g.gameFlow.hide();
      // The model may attach asynchronously, but must never relight a locked clock.
      g.getLevel().lockTrialClock();
    });
    await page.waitForFunction(() => window.__game.player.grounded && window.__game.getLevel().clockPickup.group.userData.trialClockAsset === 'ready');
    assert.equal(await page.evaluate(() => window.__game.getLevel().clockPickup.group.visible), false);
    await page.evaluate(() => {
      const g = window.__game; g.player.respawn(g.getLevel(), true, true);
      let mesh; g.getLevel().clockPickup.group.traverse(o => { if (o.isMesh) mesh = o; });
      window.__clockArt = { geometry: mesh.geometry, material: mesh.material };
    });
    await page.waitForFunction(() => window.__game.player.grounded && window.__game.getLevel().clockPickup.group.visible);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-gameplay.png` });
    const reused = await page.evaluate(() => {
      const g = window.__game, l = g.getLevel();
      l.lockTrialClock(); g.player.respawn(l, true, true);
      let mesh; l.clockPickup.group.traverse(o => { if (o.isMesh) mesh = o; });
      return l.clockPickup.group.visible && !l.clockLocked && mesh.geometry === window.__clockArt.geometry && mesh.material === window.__clockArt.material;
    });
    assert.equal(reused, true, 'restart should restore the same loaded clock artwork');
    reports.push({ lite, stamp, ...model, restartReusesModel: reused });
    console.log(`${lite ? 'lite' : 'full'} clock model: ready, 4,032 triangles, 1024px filtered atlas, bounds/editor/restart passed`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, reports, errors }, null, 2));
  await browser.close();
}
