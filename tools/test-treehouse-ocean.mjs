import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

await withBlockworksRuntime(async ({ l, source, THREE, server }) => {
  const { Level, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const nodes = source.components.filter(c => c.t === 'camnode' && !c.cameraView)
    .map(c => new THREE.Vector3(...c.p));
  const camera = new THREE.PerspectiveCamera(49, 16 / 9, .1, 1000);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);

  function checkCoverage(water) {
    const horizon = water.group.getObjectByName('Unity ocean horizon fill');
    let probes = 0;
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i];
      const steps = Math.max(1, Math.ceil(a.distanceTo(b) / 2));
      for (let j = 0; j <= steps; j++) for (const dx of [-2, 0, 2]) {
        const p = a.clone().lerp(b, j / steps);
        if (p.y >= water.seaLevel) continue;
        p.x += dx;
        camera.position.copy(p).add(new THREE.Vector3(0, 4.9, 10.2));
        camera.updateMatrixWorld(true);
        water.group.updateMatrixWorld(true);
        // Exercise the same per-camera placement as the actual draw, including
        // cameras below sea level farther into the route.
        horizon.onBeforeRender(null, null, camera);
        ray.set(new THREE.Vector3(p.x, water.seaLevel + 10, p.z), down);
        assert.equal(ray.intersectObject(horizon).length, 0,
          `opening sea must not cover inland trail at ${p.toArray()}`);
        probes++;
      }
    }
    assert.ok(probes > 900, 'cover descent, village, river, cavern, bridge and finish');
    for (const [x, z] of [[0, 60], [-100, -30], [0, 1500]]) {
      ray.set(new THREE.Vector3(x, water.seaLevel + 10, z), down);
      assert.ok(ray.intersectObject(horizon).length, `opening sea remains at ${x}/${z}`);
    }
    console.log(`PASS ${water.quality}: ${probes} Treehouse inland coverage probes and near/far coast visibility.`);
  }
  checkCoverage(l.water);
  const savedSearch = window.location.search;
  let fullLevel;
  try {
    window.location.search = '';
    fullLevel = new Level(new THREE.Scene(), { id: 'treehouse-trail', name: source.name, data: source });
    assert.equal(fullLevel.water.quality, 'full');
    checkCoverage(fullLevel.water);
  } finally {
    fullLevel?.dispose();
    window.location.search = savedSearch;
  }

  const capture = l.captureData();
  assert.equal(normalizeCustomLevelData(capture)?.ocean.horizonMode, 'shoreline',
    'editor capture/import preserves the bounded horizon');
  capture.ocean.horizonMode = 'invalid';
  assert.equal(normalizeCustomLevelData(capture), null, 'reject invalid horizon modes');
  delete capture.ocean.horizonMode;
  assert.ok(normalizeCustomLevelData(capture), 'legacy ocean data remains valid');
  console.log('PASS Treehouse ocean editor roundtrip and legacy data validation.');
}, {
  modulePath: '/src/levels/treehouse-trail.ts',
  levelId: 'treehouse-trail',
  source: m => m.TREEHOUSE_TRAIL_LEVEL,
});
