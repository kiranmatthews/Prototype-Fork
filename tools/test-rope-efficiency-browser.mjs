// Actual BraidedRope visual/geometry comparison. CPU timings are opt-in so this
// harness can capture screenshots while other work runs without mixing profiles.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [baseline, candidate] = process.argv.slice(2).filter(value => !value.startsWith('--'));
assert.ok(baseline && candidate, 'Usage: node tools/test-rope-efficiency-browser.mjs <baseline-url> <candidate-url> [--timing]');
const timing = process.argv.includes('--timing');
const output = process.env.ROPE_EFFICIENCY_OUTPUT || '/private/tmp/rope-efficiency-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), runs = [];
const views = ['vertical-close', 'vertical-gameplay', 'horizontal-close', 'horizontal-gameplay', 'knot-close', 'knot-gameplay'];
try {
  for (const [index, base] of [baseline, candidate].entries()) {
    const label = index ? 'candidate' : 'baseline', errors = [];
    const page = await browser.newPage({ viewport: { width: 1024, height: 832 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/__rope-efficiency-review', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <html><head><meta charset="utf-8"><title>Rope geometry comparison</title><style>
      *{box-sizing:border-box}body{margin:0;background:#172634;color:#e9e2d2;font:14px system-ui}
      header{height:64px;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
      h1{margin:0;font-size:18px;font-weight:600}p{margin:4px 0 0;color:#a5b5be}#detail{text-align:right;color:#d4c5a8}
      canvas{display:block;width:1024px;height:768px}</style></head><body><header><div><h1>Hemp rope · ${label}</h1>
      <p id="view"></p></div><div id="detail"></div></header></body></html>` }));
    await page.goto(new URL('__rope-efficiency-review', base).href);
    await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { BraidedRope } = await import('/src/ropeGeometry.ts');
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);renderer.setSize(1024, 768);renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1;
      renderer.shadowMap.enabled = true;renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      document.body.append(renderer.domElement);
      const scene = new THREE.Scene();scene.background = new THREE.Color('#243b49');
      scene.add(new THREE.HemisphereLight(0xe5f0ff, 0x77604a, 1.3));
      const sun = new THREE.DirectionalLight(0xffe4bd, 3);sun.position.set(-4, 8, 6);sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);sun.shadow.camera.left = -12;sun.shadow.camera.right = 12;
      sun.shadow.camera.top = 15;sun.shadow.camera.bottom = -8;sun.shadow.camera.near = .1;sun.shadow.camera.far = 40;
      sun.shadow.bias = -.0002;scene.add(sun);scene.add(sun.target);
      const camera = new THREE.PerspectiveCamera(40, 4 / 3, .02, 100);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshLambertMaterial({ color: 0x586970 }));
      floor.rotation.x = -Math.PI / 2;floor.receiveShadow = true;scene.add(floor);
      let rope = null, sample = null;
      const disposeRope = value => {
        if (!value) return;
        value.root.removeFromParent();const geometries = new Set(), materials = new Set();
        value.root.traverse(object => {
          if (object.geometry) geometries.add(object.geometry);
          for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) materials.add(material);
        });
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
      };
      const describe = value => {
        const geometry = value.mesh.geometry;
        const triangleCount = mesh => (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
        const bytes = mesh => Object.values(mesh.geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0) + (mesh.geometry.index?.array.byteLength ?? 0);
        return { length: value.len, radius: value.radius, segments: value.segments,
          tubeTriangles: triangleCount(value.mesh), knotTriangles: value.endKnot ? triangleCount(value.endKnot) : 0,
          vertices: geometry.attributes.position.count, bufferBytes: bytes(value.mesh) + (value.endKnot ? bytes(value.endKnot) : 0) };
      };
      const validate = (value, sampler) => {
        const positions = value.mesh.geometry.attributes.position, stride = positions.count / (value.segments + 1);
        const expected = new THREE.Vector3(), centre = new THREE.Vector3(), point = new THREE.Vector3();
        let maximumError = 0;
        for (let ring = 0; ring <= value.segments; ring++) {
          centre.set(0, 0, 0);
          for (let side = 0; side < stride - 1; side++) centre.add(point.fromBufferAttribute(positions, ring * stride + side));
          centre.multiplyScalar(1 / (stride - 1));sampler(ring / value.segments * value.len, expected);
          maximumError = Math.max(maximumError, centre.distanceTo(expected));
        }
        sampler(value.len, expected);
        return { maximumCentreError: maximumError, knotEndpointError: value.endKnot?.position.distanceTo(expected) ?? 0 };
      };
      const show = name => {
        disposeRope(rope);
        const close = name.endsWith('close'), horizontal = name.startsWith('horizontal'), knot = name.startsWith('knot');
        const length = horizontal ? 8 : knot ? 3 : close ? 3 : 10;
        rope = new BraidedRope(length, .10, true);
        if (horizontal) {
          sample = (d, out) => { const u = d / length;return out.set(d - 4, 1.4 - Math.sin(Math.PI * u) * 1.1, .4 * Math.sin(2 * Math.PI * u)); };
          if (close) { camera.position.set(.4, 1.1, 1.6);camera.lookAt(0, .3, 0); }
          else { camera.position.set(0, 3, 13);camera.lookAt(0, .6, 0); }
          floor.position.y = -.6;
        } else if (knot) {
          sample = (d, out) => out.set(0, length - d, 0);
          if (close) { camera.position.set(.38, .3, .7);camera.lookAt(0, 0, 0); }
          else { camera.position.set(2, 1, 7);camera.lookAt(0, 1, 0); }
          floor.position.y = -.35;
        } else {
          sample = (d, out) => out.set(0, length * .5 - d, 0);
          if (close) { camera.position.set(.18, .3, .95);camera.lookAt(0, .3, 0); }
          else { camera.position.set(4, .8, 17);camera.lookAt(0, 0, 0); }
          floor.position.y = -length * .5 - .35;
        }
        rope.update(sample);scene.add(rope.root);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        const geometry = describe(rope), shape = validate(rope, sample);
        for (let frame = 0; frame < 3; frame++) renderer.render(scene, camera);
        const render = { ...renderer.info.render }, memory = { ...renderer.info.memory }, gl = renderer.getContext();
        document.querySelector('#view').textContent = name.replaceAll('-', ' ') + ' · identical camera and lighting';
        document.querySelector('#detail').textContent = `${geometry.tubeTriangles.toLocaleString()} tube triangles · ${geometry.segments} axial segments`;
        return { name, geometry, shape, render, memory, cameraPosition: camera.position.toArray(),
          contextLost: gl.isContextLost(), glError: gl.getError() };
      };
      const benchmark = () => {
        const rows = [], lengths = [3, 8, 16, 24], iterations = 64, batches = 15;
        for (const length of lengths) {
          const value = new BraidedRope(length, .10, true);let phase = 0;
          const sampler = (d, out) => { const u = d / length;return out.set(d - length / 2, -Math.sin(Math.PI * u) * (1.2 + .12 * Math.sin(phase)), .2 * Math.sin(Math.PI * 2 * u + phase)); };
          for (let i = 0; i < 100; i++) { phase += .01;value.update(sampler); }
          const samples = [];
          for (let batch = 0; batch < batches; batch++) {
            const begin = performance.now();
            for (let i = 0; i < iterations; i++) { phase += .01;value.update(sampler); }
            samples.push((performance.now() - begin) / iterations);
          }
          samples.sort((a, b) => a - b);
          rows.push({ ...describe(value), updateMedianMs: samples[Math.floor(samples.length / 2)],
            updateP95Ms: samples[Math.floor(samples.length * .95)], iterations: batches * iterations });
          disposeRope(value);
        }
        return rows;
      };
      window.__ropeReview = { show, benchmark, dispose() {
        disposeRope(rope);floor.geometry.dispose();floor.material.dispose();sun.shadow.map?.dispose();renderer.dispose();
      } };
    });
    const rows = [];
    for (const name of views) {
      const row = await page.evaluate(name => window.__ropeReview.show(name), name);rows.push(row);
      assert.equal(row.contextLost, false);assert.equal(row.glError, 0);
      assert.ok(row.shape.maximumCentreError < .00002, `${name}: tube moved off the physical curve`);
      assert.ok(row.shape.knotEndpointError < .000001, `${name}: knot moved off the endpoint`);
      await page.screenshot({ path: `${output}/${label}-${name}.png` });
    }
    const updateCpu = timing ? await page.evaluate(() => window.__ropeReview.benchmark()) : null;
    await page.evaluate(() => window.__ropeReview.dispose());
    assert.deepEqual(errors, []);runs.push({ label, base, rows, updateCpu, errors });await page.close();
  }
  for (let i = 0; i < views.length; i++) {
    const before = runs[0].rows[i], after = runs[1].rows[i];
    assert.deepEqual(after.cameraPosition, before.cameraPosition);
    assert.equal(after.geometry.length, before.geometry.length);assert.equal(after.geometry.radius, before.geometry.radius);
    assert.ok(after.geometry.tubeTriangles < before.geometry.tubeTriangles, `${views[i]} did not reduce tube triangles`);
  }
  console.log(JSON.stringify({ output, timing, geometry: runs.map(run => ({ label: run.label,
    examples: run.rows.map(row => ({ name: row.name, ...row.geometry })), updateCpu: run.updateCpu })) }));
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(runs, null, 2));
  await writeFile(`${output}/index.html`, `<!doctype html><html><head><meta charset="utf-8"><title>Rope comparison</title>
    <style>body{margin:24px;background:#172634;color:#e9e2d2;font:16px system-ui}h1{font-size:24px}h2{font-size:18px;margin-top:32px}
    .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{display:block;width:100%}a{color:#d4c5a8}</style></head>
    <body><h1>Braided rope: baseline and candidate</h1><p>Same cameras and lighting. <a href="results.json">Geometry, errors and optional CPU measurements</a>.</p>
    ${views.map(name => `<h2>${name.replaceAll('-', ' ')}</h2><div class="pair"><img src="baseline-${name}.png" alt="Baseline ${name}"><img src="candidate-${name}.png" alt="Candidate ${name}"></div>`).join('')}
    </body></html>`);
  await browser.close();
}
