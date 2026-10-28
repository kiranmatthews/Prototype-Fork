import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5428/';
const output = process.env.VERTEX_LIGHTING_OUTPUT || '/private/tmp/vertex-lighting-browser';
await mkdir(output, { recursive: true });
const report = { runs: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const lite of [true, false]) {
    if (process.env.VERTEX_LIGHTING_LITE_ONLY && !lite) continue;
    if (process.env.VERTEX_LIGHTING_FULL_ONLY && lite) continue;
    const context = await browser.newContext({ viewport: lite ? { width: 1280, height: 720 } : { width: 1600, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    await context.addInitScript(() => localStorage.setItem('solProtoDebugChrome', 'visible'));
    const url = `${base}?playtest&level=codex-lab${lite ? '&lite' : ''}`;
    const ready = () => page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await ready();
    console.log(`${lite ? 'lite' : 'full'} ready`);
    if (lite && process.env.VERTEX_LIGHTING_FIXTURE) {
      report.fixture = await page.evaluate(async () => {
        const source = await (await fetch('/src/vertexLighting.ts')).text();
        const threeUrl = source.match(/from "([^"]*three[^"]*)"/)[1];
        const T = await import(threeUrl);
        const g = window.__game, r = g.renderer;
        const scene = new T.Scene();
        scene.background = new T.Color('black');
        const camera = new T.PerspectiveCamera(50, 1, .1, 100);
        camera.position.z = 6;
        const geometry = new T.PlaneGeometry(4, 4);
        const mesh = new T.Mesh(geometry, new T.MeshLambertMaterial({ color: 0xffffff }));
        scene.add(mesh);
        const lamp = new T.PointLight(0xffffff, 8, 10, 2);
        lamp.position.set(0, 0, 1);
        scene.add(lamp);
        const target = new T.WebGLRenderTarget(128, 128);
        const previous = r.getRenderTarget();
        const render = enabled => {
          g.vertexLightingSettings.setEnabled(enabled);
          r.setRenderTarget(target);
          r.render(scene, camera);
          const pixels = new Uint8Array(128 * 128 * 4);
          r.readRenderTargetPixels(target, 0, 0, 128, 128, pixels);
          return Array.from(pixels.slice((64 * 128 + 64) * 4, (64 * 128 + 64) * 4 + 4));
        };
        const pixel = render(false), vertex = render(true), restored = render(false);
        const materials = [];
        for (const kind of ['MeshLambertMaterial', 'MeshPhongMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial']) {
          mesh.material.dispose();
          mesh.material = new T[kind]({ color: 0xaa7766, side: T.DoubleSide });
          materials.push({ kind, pixel: render(false), vertex: render(true), restored: render(false) });
        }
        geometry.deleteAttribute('normal');
        mesh.material.flatShading = true;
        mesh.material.needsUpdate = true;
        const missingNormals = { pixel: render(false), vertex: render(true), restored: render(false), authoredNormals: !!geometry.getAttribute('normal') };
        const front = render(true);
        mesh.rotation.y = Math.PI;
        const back = render(true);
        mesh.rotation.y = 0;
        lamp.color.set(0xff0000);
        const red = render(true);
        lamp.color.set(0x00ff00);
        const green = render(true);
        scene.remove(lamp);
        const spots = [];
        for (let i = 0; i < 6; i++) {
          const spot = new T.SpotLight(0xffffff, 8, 10, 1.2, .3, 2);
          spot.position.set((i - 2.5) * .2, 0, 2);
          scene.add(spot, spot.target); spots.push(spot);
        }
        const sixSpots = render(true);
        const instance = new T.InstancedMesh(geometry, mesh.material, 1);
        instance.setMatrixAt(0, new T.Matrix4());
        scene.remove(mesh); scene.add(instance);
        const instanced = render(true);
        scene.remove(instance);
        const count = geometry.attributes.position.count;
        geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
        const weights = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) weights[i * 4] = 1;
        geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
        const skinned = new T.SkinnedMesh(geometry, mesh.material), bone = new T.Bone();
        skinned.add(bone); skinned.bind(new T.Skeleton([bone])); scene.add(skinned);
        const skin = render(true);
        r.setRenderTarget(previous);
        target.dispose(); geometry.dispose(); mesh.material.dispose(); skinned.skeleton.dispose(); instance.dispose();
        for (const spot of spots) spot.dispose();
        g.vertexLightingSettings.setEnabled(false);
        return { pixel, vertex, restored, materials, missingNormals, front, back, red, green, sixSpots, instanced, skin };
      });
      console.log(JSON.stringify(report.fixture));
      assert.ok(report.fixture.pixel[0] > report.fixture.vertex[0] + 40, 'light falloff must move from pixels to vertices');
      assert.deepEqual(report.fixture.restored, report.fixture.pixel, 'off restores the same pixels');
      for (const row of [...report.fixture.materials, report.fixture.missingNormals]) assert.deepEqual(row.restored, row.pixel);
      assert.equal(report.fixture.missingNormals.authoredNormals, false, 'missing authored normals remain absent');
      assert.deepEqual(report.fixture.missingNormals.vertex, report.fixture.materials[3].vertex);
      assert.deepEqual(report.fixture.front, report.fixture.back, 'two-sided normals remain correctly lit');
      assert.ok(report.fixture.red[0] > 0 && report.fixture.red[1] === 0 && report.fixture.green[0] === 0 && report.fixture.green[1] > 0);
      assert.ok(report.fixture.sixSpots[0] > 0);
      assert.deepEqual(report.fixture.instanced, report.fixture.sixSpots);
      assert.deepEqual(report.fixture.skin, report.fixture.sixSpots);
    }
    const tab = page.locator('[data-debug-tab="render"]');
    const toggle = page.getByRole('checkbox', { name: 'Global vertex lighting', exact: true });
    if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
    assert.equal(await toggle.isChecked(), false, 'existing appearance is the default');
    await toggle.check();
    await page.waitForFunction(() => window.__game.getVertexLightingDiagnostics().materials > 0);
    const enabled = await page.evaluate(() => window.__game.getVertexLightingDiagnostics());
    assert.equal(enabled.enabled, true);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-toggle.png` });
    await toggle.uncheck();
    assert.deepEqual(await page.evaluate(() => window.__game.getVertexLightingDiagnostics()), { enabled: false, materials: 0 });
    await toggle.check();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
    assert.equal(await toggle.isChecked(), true, 'saved preference reloads');
    await page.waitForFunction(() => window.__game.getVertexLightingDiagnostics().materials > 0);
    await tab.click();
    if (!lite) await page.evaluate(() => window.__game.renderQualitySettings.setRegularResolution(null));
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'native'}-vertex.png` });
    const run = { lite, enabled, reload: await page.evaluate(() => window.__game.getVertexLightingDiagnostics()) };
    await page.evaluate(() => window.__game.vertexLightingSettings.setEnabled(false));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'native'}-authored.png` });
    run.restored = await page.evaluate(() => window.__game.getVertexLightingDiagnostics());
    if (!lite) {
      await page.evaluate(() => { const g = window.__game; g.vertexLightingSettings.setEnabled(true); g.switchLevel('coconut-cart-rally'); });
      await page.waitForFunction(() => {
        const g = window.__game;
        return g.getCurrentLevel().id === 'coconut-cart-rally' && !g.gameFlow.blocksGameplay && g.getLoadingDiagnostics().pending.length === 0;
      }, null, { timeout: 180000 });
      await page.getByRole('button', { name: 'RACE', exact: true }).click();
      await page.waitForFunction(() => window.__game.getSkateRace().phase === 'running', null, { timeout: 30000 });
      await page.waitForTimeout(500);
      run.stadium = await page.evaluate(() => ({
        lighting: window.__game.getVertexLightingDiagnostics(),
        lamps: window.__game.getLevel().stadiumLightingDiagnostics,
        glError: window.__game.renderer.getContext().getError(),
      }));
      assert.equal(run.stadium.lamps.pool, 6);
      assert.equal(run.stadium.lighting.enabled, true);
      assert.equal(run.stadium.glError, 0);
      await page.screenshot({ path: `${output}/stadium-native-vertex.png` });
      await page.evaluate(() => window.__game.renderQualitySettings.setRegularResolution(720));
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${output}/stadium-normal-vertex.png` });
      await page.evaluate(() => { const g = window.__game; g.vertexLightingSettings.setEnabled(false); g.switchLevel('codex-lab'); });
      await page.waitForFunction(() => window.__game.getCurrentLevel().id === 'codex-lab' && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
      assert.deepEqual(await page.evaluate(() => window.__game.getVertexLightingDiagnostics()), { enabled: false, materials: 0 });
      await page.setViewportSize({ width: 390, height: 844 });
      if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
      await toggle.check();
      const bounds = await toggle.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.y + bounds.height <= 844);
      await page.screenshot({ path: `${output}/compact-toggle.png` });
      await toggle.uncheck();
    }
    run.stamp = await page.locator('.hud-build').textContent();
    assert.match(run.stamp, /Codex\/sol fork/);
    report.runs.push(run);
    assert.deepEqual(report.errors, [], 'browser/shader console');
    await context.close();
  }
} finally {
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
