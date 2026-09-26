import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2];
assert.ok(base, 'Supply a candidate Vite URL.');
const output = process.env.CHARACTER_BATCH_OUTPUT || '/private/tmp/character-rigid-batches-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/__character-batch-review', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Character batching regression</title>' }));
  await page.goto(new URL('__character-batch-review', base).href);
  const result = await page.evaluate(async () => {
    const moduleSource = await (await fetch('/src/player.ts')).text();
    const threeUrl = moduleSource.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)?.[1];
    const THREE = await import(threeUrl);
    const { Player } = await import('/src/player.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(640, 640);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    document.body.style.margin = '0'; document.body.append(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x697c8c);
    scene.add(new THREE.HemisphereLight(0xd5ecff, 0x443529, 1.8));
    const sun = new THREE.DirectionalLight(0xffe0bd, 3); sun.position.set(-4, 6, 3); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
    sun.shadow.camera.bottom = -4; sun.shadow.camera.top = 4; sun.shadow.camera.near = .1; sun.shadow.camera.far = 20;
    scene.add(sun, sun.target);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0xa4b3c2 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.1; floor.receiveShadow = true; scene.add(floor);
    const player = new Player(scene);
    const deadline = performance.now() + 30000;
    while (player.riggedCartoonHandState !== 'ready' || player.meshyBoolieRooHeadLoadState !== 'ready') {
      if (performance.now() > deadline) throw new Error(`Character assets not ready: ${player.riggedCartoonHandState}, ${player.meshyBoolieRooHeadLoadState}`);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    player.boardG.visible = false;
    const camera = new THREE.PerspectiveCamera(40, 1, .05, 40);
    const rt = new THREE.WebGLRenderTarget(640, 640);
    const draw = enabled => {
      player.setCharacterRenderBatching(enabled);
      renderer.info.reset(); renderer.setRenderTarget(rt); renderer.render(scene, camera);
      const rgba = new Uint8Array(640 * 640 * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, 640, 640, rgba);
      return { rgba, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    };
    const poses = [
      { name: 'rest', shape: {}, rotations: [] },
      { name: 'shear-stretch', shape: { height: 1.35, bodyWidth: 1.4, bodyDepth: .75, armThickness: 1.6, upperArmLength: 1.65, forearmLength: .6, thighLength: .8, shinLength: 1.45, footSize: 1.7 }, rotations: [['hip-left', .7, .4, .25], ['hip-right', -.55, -.2, -.3], ['knee-left', .9, 0, 0], ['knee-right', .45, 0, 0], ['shoulder-left', .9, .2, -.4], ['shoulder-right', -.5, -.3, .7], ['elbow-left', -.8, .3, .2], ['elbow-right', -.9, -.2, .1]] },
      { name: 'compressed', shape: { height: .8, bodyWidth: .8, bodyDepth: 1.35, upperArmLength: .65, forearmLength: 1.6, shinLength: .65, footSize: .8 }, rotations: [['knee-left', 1.7, 0, 0], ['knee-right', 1.5, 0, 0], ['hip-left', -1, 0, .4], ['hip-right', -.8, 0, -.4]] },
    ];
    const originalShape = { ...player.characterProportionDiagnostics.settings };
    const rows = [], images = [];
    for (const pose of poses) {
      player.setCharacterProportions({ ...originalShape, ...pose.shape });
      for (const [name, x, y, z] of pose.rotations) player.bodyGroup.getObjectByName(name)?.rotation.set(x, y, z);
      player.syncCharacterAppearance();
      for (const angle of [0, Math.PI * 2 / 9, Math.PI / 2, Math.PI]) {
        camera.position.set(Math.sin(angle) * 4.5, 1.8, Math.cos(angle) * 4.5); camera.lookAt(0, 1.2, 0);
        // Warm each program before comparisons; asset loading cannot change
        // transforms while these synchronous colour/shadow pairs render.
        draw(false); draw(true);
        const original = draw(false), batched = draw(true);
        if (pose.name === 'rest' && angle === 0) {
          for (const source of [original, batched]) {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 640;
            const context = canvas.getContext('2d'), image = context.createImageData(640, 640);
            for (let y = 0; y < 640; y++) image.data.set(source.rgba.subarray(y * 2560, (y + 1) * 2560), (639 - y) * 2560);
            context.putImageData(image, 0, 0); images.push(canvas.toDataURL().split(',')[1]);
          }
        }
        let changed = 0, severe = 0, maximum = 0, total = 0;
        for (let i = 0; i < original.rgba.length; i += 4) {
          let error = 0;
          for (let c = 0; c < 3; c++) { const delta = Math.abs(original.rgba[i + c] - batched.rgba[i + c]); maximum = Math.max(maximum, delta); total += delta; error = Math.max(error, delta); }
          if (error) changed++; if (error > 8) severe++;
        }
        rows.push({ pose: pose.name, angle, changed, severe, maximum, mean: total / (640 * 640 * 3), sourceCalls: original.calls, batchedCalls: batched.calls, sourceTriangles: original.triangles, batchedTriangles: batched.triangles });
      }
    }
    // Hide/show and exact material-visibility restoration exercise callbacks
    // after a fully hidden source batch, including an authoring pause.
    const clay = player.stretchableBones[2].shaft.material;
    clay.visible = false; draw(true); clay.visible = true;
    const restored = draw(true), restoredOriginal = draw(false);
    let restoredError = 0;
    for (let i = 0; i < restored.rgba.length; i++) restoredError += Math.abs(restored.rgba[i] - restoredOriginal.rgba[i]);
    const diagnostics = player.characterRenderBatchDiagnostics;
    const mutations = [];
    const changeNumber = (object, key, value) => {
      const previous = object[key]; object[key] = value;
      return () => { object[key] = previous; };
    };
    const changeAttribute = attribute => {
      const previous = attribute.getX(0); attribute.setX(0, previous + .04); attribute.needsUpdate = true;
      return () => { attribute.setX(0, previous); attribute.needsUpdate = true; };
    };
    const sourceBone = player.stretchableBones.find(bone => bone.root.visible && bone.shaft.geometry.morphAttributes.position?.length);
    for (const [name, mutate] of [
      ['roughness', () => changeNumber(sourceBone.shaft.material, 'roughness', .2)],
      ['emissive-intensity', () => changeNumber(sourceBone.shaft.material, 'emissiveIntensity', 2.5)],
      ['shoe-position-upload', () => changeAttribute(player.proceduralFootwear[0].shoe.geometry.attributes.position)],
      ['limb-morph-upload', () => changeAttribute(sourceBone.shaft.geometry.morphAttributes.position[0])],
    ]) {
      player.setCharacterRenderBatching(true); player.rebuildCharacterRenderBatches();
      const restore = mutate(), original = draw(false), candidate = draw(true);
      let total = 0, severe = 0;
      for (let i = 0; i < original.rgba.length; i += 4) {
        let maximum = 0;
        for (let c = 0; c < 3; c++) { const delta = Math.abs(original.rgba[i + c] - candidate.rgba[i + c]); total += delta; maximum = Math.max(maximum, delta); }
        if (maximum > 8) severe++;
      }
      mutations.push({ name, mean: total / (640 * 640 * 3), severe, remainingBatches: player.characterRenderBatchDiagnostics.batches });
      restore();
    }
    player.rebuildCharacterRenderBatches();
    player.setCharacterRenderBatching(true); renderer.setRenderTarget(null); renderer.render(scene, camera);
    return { rows, diagnostics, images, mutations, restoredMean: restoredError / restored.rgba.length, glError: renderer.getContext().getError() };
  });
  await page.screenshot({ path: `${output}/character-batches.png` });
  for (const [index, image] of result.images.entries()) await writeFile(`${output}/${index === 0 ? 'original' : 'batched'}.png`, Buffer.from(image, 'base64'));
  delete result.images;
  await writeFile(`${output}/results.json`, JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(result.glError, 0);
  assert.equal(result.diagnostics.sources, 42);
  assert.equal(result.diagnostics.batches, 8);
  for (const row of result.rows) {
    assert.ok(row.batchedCalls <= row.sourceCalls - 60, `Draw reduction missing in ${row.pose}`);
    assert.equal(row.sourceTriangles, row.batchedTriangles, `Geometry changed in ${row.pose}`);
    assert.ok(row.mean < .005 && row.severe < 10, `Pixel mismatch in ${row.pose} at ${row.angle}: ${row.mean}, ${row.severe}`);
  }
  assert.ok(result.restoredMean < .005, 'A hidden material failed to reappear');
  for (const mutation of result.mutations) {
    assert.ok(mutation.remainingBatches < 8, `${mutation.name} left the stale proxy active`);
    assert.ok(mutation.mean < .005 && mutation.severe < 10, `${mutation.name} changed fallback pixels`);
  }
} finally { await browser.close(); }
