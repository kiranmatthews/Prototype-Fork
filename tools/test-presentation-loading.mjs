import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { runLoadingTransition, PresentationAssetReadiness, MINIMUM_VORTEX_MS } = await server.ssrLoadModule('/src/presentationLoading.ts');
  assert.equal(MINIMUM_VORTEX_MS, 2000);
  for (const reduced of [false, true]) for (const loadMs of [0, 800, 6200]) {
    let clock = 0, loadAt = 0, assetsReadyAt = 0;
    const phases = [];
    await runLoadingTransition({
      now: () => clock,
      wait: async ms => { assert.ok(ms >= 0); clock += ms; },
      paint: async () => { clock += 32; },
      phase: phase => phases.push({ phase, time: clock }),
      prepareVortex: async () => { clock += 700; },
      load: async () => { loadAt = clock; clock += loadMs; },
      waitForAssets: async () => { clock += 100; assetsReadyAt = clock; },
      prepareDestination: async () => { clock += 450; },
    }, reduced);
    assert.deepEqual(phases.map(p => p.phase), ['cover', 'prepare-vortex', 'vortex', 'cover-destination', 'prepare-destination', 'reveal']);
    const at = name => phases.find(p => p.phase === name).time;
    const fade = reduced ? 20 : 360;
    assert.ok(at('vortex') >= at('prepare-vortex') + 700 + 32, 'vortex revealed before preparation painted');
    assert.ok(loadAt >= at('vortex') + fade + 32, 'level build interrupted the vortex reveal');
    assert.ok(at('cover-destination') - loadAt >= 2000, 'fast load shortened the visible vortex');
    assert.ok(at('cover-destination') >= assetsReadyAt, 'vortex left before assets settled');
    assert.ok(at('prepare-destination') >= at('cover-destination') + fade + 32, 'destination rendered before opaque black');
    assert.ok(at('reveal') >= at('prepare-destination') + 450 + 32, 'destination revealed before warm-up painted');
    assert.ok(clock >= at('reveal') + (reduced ? 20 : 520) + 32, 'input unlocked before reveal finished');
  }

  const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
  const vortex = deferred(), load = deferred(), assets = deferred(), warm = deferred();
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const phases = [];
  const pending = runLoadingTransition({
    phase: phase => phases.push(phase), now: () => 0, wait: async () => {}, paint: async () => {},
    prepareVortex: () => vortex.promise, load: () => load.promise,
    waitForAssets: () => assets.promise, prepareDestination: () => warm.promise,
  }, false);
  await flush(); assert.equal(phases.at(-1), 'prepare-vortex');
  vortex.resolve(); await flush(); assert.equal(phases.at(-1), 'vortex');
  load.resolve(); await flush(); assert.equal(phases.at(-1), 'vortex');
  assets.resolve(); await flush(); assert.equal(phases.at(-1), 'prepare-destination');
  warm.resolve(); await pending; assert.equal(phases.at(-1), 'reveal');

  const manager = new THREE.LoadingManager();
  let starts = 0, ends = 0, errors = 0;
  manager.onStart = () => { starts++; };
  manager.onLoad = () => { ends++; };
  manager.onError = () => { errors++; };
  const tracker = new PresentationAssetReadiness(manager);
  manager.itemStart('character.glb'); manager.itemStart('character.glb');
  manager.itemEnd('character.glb');
  assert.deepEqual(tracker.diagnostics.pending, ['character.glb'], 'same-URL loads need independent counts');
  let frames = 0;
  await tracker.waitUntilSettled(async () => {
    frames++;
    if (frames === 1) { manager.itemStart('skin.png'); manager.itemEnd('character.glb'); }
    if (frames === 3) manager.itemEnd('skin.png');
  });
  assert.equal(frames, 4, 'nested texture completion needs a quiet painted interval');
  assert.equal(starts, 1); assert.equal(ends, 1);
  manager.itemStart('missing-optional.png'); manager.itemError('missing-optional.png'); manager.itemEnd('missing-optional.png');
  await tracker.waitUntilSettled(async () => {});
  assert.equal(errors, 1); assert.deepEqual(tracker.diagnostics.failed, ['missing-optional.png']);

  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /prepareLoadingVortex: prepareLoadingVortexPresentation/);
  assert.match(main, /waitForDestinationAssets: prepareActivePresentationAssets/);
  assert.match(main, /prepareDestinationFrame: prepareDestinationPresentation/);
  assert.match(main, /onTransitionComplete: guardGameplayFromMenu/);
  assert.match(main, /await renderer\.compileAsync\(scene, camera\)/);
  assert.match(main, /player\.preparePresentationAssets\(\)/);
  assert.match(main, /sfx\.prepare\(\)/);
  assert.match(main, /waitForLevelData: \(\) => firstRunLevelSync/);
  const flow = await readFile(new URL('../src/gameFlowUI.ts', import.meta.url), 'utf8');
  assert.match(flow, /this\.transitionActive = true;\s*this\.cursor\.classList\.remove\("visible"\)/, 'loading must retire the menu cursor');
  console.log('PASS loading sequence: readiness gates, fully painted 2-second minimum, fast/slow/reduced-motion paths, black-guard warm-up, nested asset tracking and failed-request settlement');
} finally { await server.close(); }
