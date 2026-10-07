import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import ts from 'typescript';
import * as THREE from 'three';

const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-9, `${why}: ${a} != ${b}`);
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { CameraPortraitFraming } = await server.ssrLoadModule('/src/cameraPortraitFraming.ts');
  const layer = new CameraPortraitFraming();
  const snapshot = camera => JSON.stringify(camera.toJSON());
  let samples = 0;
  // Pixel scale follows the live lens, distance, pitch, roll and level yaw,
  // including future lens/shot edits. Phone rotation preserves hero size.
  for (const [width, height] of [[320,568], [390,844], [430,932], [768,1024]]) {
    for (const fov of [27, 43, 49, 65]) for (const pitch of [0, .4, 1.1]) {
      const camera = new THREE.PerspectiveCamera(fov, width / height, .1, 400);
      camera.position.set(3, 8, 12);
      camera.rotation.set(-pitch, .7, .1);
      camera.updateMatrixWorld(true);
      const before = snapshot(camera), pose = camera.matrixWorld.clone();
      const landscape = camera.clone();
      landscape.aspect = height / width;
      landscape.updateProjectionMatrix();
      // A body and a patch of ground below/behind it in the authored shot.
      const feet = new THREE.Vector3(0, -1.6, -12).applyMatrix4(pose);
      const head = new THREE.Vector3(0, 1.6, -12).applyMatrix4(pose);
      const landscapePixels = Math.abs(head.clone().project(landscape).y - feet.clone().project(landscape).y) * width / 2;
      layer.apply(camera, true);
      const portraitPixels = Math.abs(head.clone().project(camera).y - feet.clone().project(camera).y) * height / 2;
      near(portraitPixels, landscapePixels, 'phone rotation changed character pixel size');
      assert.ok(camera.fov > fov, 'portrait did not zoom out');
      assert.ok(camera.matrixWorld.equals(pose), 'portrait changed the level shot angle or position');
      const centered = camera.clone(); centered.clearViewOffset();
      assert.ok(feet.clone().project(camera).y > feet.clone().project(centered).y, 'controls did not gain space below the skater');
      near(new THREE.Vector3(.2, -.3, .5).unproject(camera).project(camera).y, -.3, 'inverse projection is stale');
      const once = snapshot(camera);
      layer.apply(camera, true);
      assert.equal(snapshot(camera), once, 'repeated framing accumulated');
      layer.restore(camera);
      assert.equal(snapshot(camera), before, 'portrait lens leaked into the next camera update');
      samples++;
    }
  }
  for (const aspect of [1, 4/3, 16/9, 844/390]) {
    const camera = new THREE.PerspectiveCamera(49, aspect, .1, 400);
    const before = snapshot(camera);
    layer.apply(camera, true); layer.restore(camera);
    assert.equal(snapshot(camera), before, 'landscape changed');
  }
  // Existing off-axis shots (e.g. a future authored lens) survive intact.
  const camera = new THREE.PerspectiveCamera(43, 390/844, .1, 400);
  camera.setViewOffset(390, 844, 4, 12, 390, 844);
  const view = camera.view, before = snapshot(camera);
  layer.apply(camera, true); layer.restore(camera);
  assert.equal(camera.view, view, 'authored view object replaced');
  assert.equal(snapshot(camera), before, 'authored off-axis lens lost');
  layer.apply(camera, false);
  assert.equal(snapshot(camera), before, 'desktop portrait changed');
  // Portrait -> landscape on the same camera restores all lens state.
  layer.apply(camera, true); layer.restore(camera);
  camera.aspect = 844/390; camera.updateProjectionMatrix();
  const rotated = snapshot(camera);
  layer.apply(camera, true); layer.restore(camera);
  assert.equal(snapshot(camera), rotated, 'rotation retained portrait framing');

  // Execute the production render boundary: every authored camera is already
  // settled, render/scenery/reflection see the fit, tools/results do not, and
  // even a failed draw cannot strand the wider lens in simulation.
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const source = main.slice(main.indexOf('function renderPrimaryScene('), main.indexOf('function drawPrimaryScene('));
  assert.ok(source.length > 0, 'render boundary missing');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const makeRender = new Function('cameraPortraitFraming', 'camera', 'settings', 'drawPrimaryScene', `
    const {TOUCH_PRESENTATION, split2p, level, current, editorViewActive, characterLab, animationStudio, resultsPresentation, gameFlow} = settings;
    ${code}
    return renderPrimaryScene;
  `);
  camera.aspect = 390/844; camera.updateProjectionMatrix();
  const settings = { TOUCH_PRESENTATION: true, split2p: false, level: {}, current: {id:"codex-lab"}, editorViewActive: false, characterLab: null,
    animationStudio: null, resultsPresentation: null, gameFlow: { currentScreen: null } };
  const original = snapshot(camera);
  let draws = 0;
  const render = makeRender(layer, camera, settings, () => { draws++; assert.ok(camera.fov > 43); });
  for (let i=0; i<120; i++) { render(); assert.equal(snapshot(camera), original); }
  assert.equal(draws, 120);
  for (const patch of [{TOUCH_PRESENTATION:false}, {split2p:true}, {level:{isCampaignMap:true}}, {current:{id:"warproom"}}, {editorViewActive:true}, {characterLab:{}},
    {animationStudio:{}}, {resultsPresentation:{}, gameFlow:{currentScreen:'results'}}]) {
    makeRender(layer, camera, {...settings, ...patch}, () => assert.equal(snapshot(camera), original))();
  }
  assert.throws(() => makeRender(layer, camera, settings, () => { throw new Error('draw failed'); })(), /draw failed/);
  assert.equal(snapshot(camera), original, 'failed render leaked portrait projection');
  console.log(`PASS ${samples} portrait shots: landscape pixel scale, controls clearance, unchanged authored angles, exact landscape/rotation restore, and production render isolation`);
} finally { await server.close(); }
