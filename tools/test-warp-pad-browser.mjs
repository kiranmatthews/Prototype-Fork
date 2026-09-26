// Compare the actual standalone pad in two Vite checkouts with identical
// cameras, animation clocks, lighting and WebGL settings.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate) throw new Error('Usage: node tools/test-warp-pad-browser.mjs <baseline-url> <candidate-url>');
const output = process.env.WARP_PIXEL_OUTPUT || '/private/tmp/warp-pad-pixels';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const runs = [], errors = [];
try {
  for (const [label, base] of [['baseline', baseline], ['candidate', candidate]]) {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(new URL('src/warpPad.ts', base).href);
    await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { createWarpPad } = await import('/src/warpPad.ts');
      document.body.innerHTML = ''; document.body.style.margin = '0';
      const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
      renderer.setSize(640, 480); renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#233849');
      const sun = new THREE.DirectionalLight(0xffeed0, 1.5); sun.position.set(5, 8, 3);
      sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      scene.add(sun, new THREE.HemisphereLight(0xc2dfff, 0x4f4332, 1));
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: '#526863' }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; ground.receiveShadow = true; scene.add(ground);
      const pad = createWarpPad(); scene.add(pad.group);
      for (const solid of pad.solids) { solid.castShadow = true; solid.receiveShadow = true; }
      const camera = new THREE.PerspectiveCamera(42, 640 / 480, .1, 100);
      window.__warpPixel = { renderer, scene, pad, camera };
    });
    const frames = [];
    for (const [index, shot] of [
      { dt: 0, position: [6, 4, 7] },
      { dt: .371, position: [-5, 2, 5] },
      { dt: 1.137, position: [0, 7, 3] },
      { dt: 998.71, position: [3, 1.5, -5] },
    ].entries()) {
      const frame = await page.evaluate(({ dt, position }) => {
        const { renderer, scene, pad, camera } = window.__warpPixel;
        pad.update(dt); camera.position.fromArray(position); camera.lookAt(0, 1.25, 0);
        renderer.render(scene, camera);
        const gl = renderer.getContext(), pixels = new Uint8Array(640 * 480 * 4);
        gl.readPixels(0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return { pixels: Array.from(pixels), draws: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      }, shot);
      frames.push(frame);
      await page.screenshot({ path: `${output}/${label}-${index}.png` });
    }
    runs.push(frames); await page.close();
  }
  const comparisons = runs[0].map((before, index) => {
    const after = runs[1][index]; let changed = 0, maximum = 0, total = 0;
    for (let i = 0; i < before.pixels.length; i++) {
      const delta = Math.abs(before.pixels[i] - after.pixels[i]);
      if (delta) changed++; maximum = Math.max(maximum, delta); total += delta;
    }
    assert.equal(before.triangles, after.triangles, 'all triangles must survive batching');
    assert.equal(before.draws - after.draws, 34, '18 double-sided flame draws must become one double-sided instance draw');
    // Additive draw order may differ in framebuffer rounding. Require exact
    // visual agreement apart from at most one 8-bit intensity step.
    assert.ok(maximum <= 1, `shot ${index}: image changed by ${maximum}/255`);
    return { shot: index, beforeDraws: before.draws, afterDraws: after.draws,
      triangles: after.triangles, changedChannels: changed, maximumChannelDelta: maximum, meanAbsoluteDelta: total / before.pixels.length };
  });
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ comparisons, errors }, null, 2));
  console.log(JSON.stringify(comparisons));
} finally { await browser.close(); }
