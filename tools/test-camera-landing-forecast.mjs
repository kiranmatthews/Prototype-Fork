import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
const deck = { t: 'platform', p: [0, 3.5, -6], s: [4, 1, 4], edgeGrinding: false };
const fixture = components => ({ v: 1, name: 'Landing forecast', spawn: [0, 10, 0], killY: -20,
  components: [...components, { t: 'gate', p: [50, 4, 50] }] });
await withBlockworksRuntime(async r => {
  const cases = [
    { name: 'lower deck ahead', components: [deck], expected: 4 },
    { name: 'thin deck swept between samples', components: [{ ...deck, p: [0, 3.5, -4.5], s: [4, 1, .18] }], gravity: 'foot', expected: 4 },
    { name: 'missed beside deck', components: [deck], x: 4, expected: null },
    { name: 'deck behind travel', components: [deck], vz: 20, expected: null },
    { name: 'nearby deck without speed', components: [deck], vz: 0, expected: null },
    { name: 'pit at catch', components: [deck, { t: 'pit', p: [0, 4.1, -6], s: [5, 1, 5], invisible: true }], expected: null },
    { name: 'pit crossed before catch', components: [deck, { t: 'pit', p: [0, 8, -2.5], s: [5, 4, 2], invisible: true }], expected: null },
    { name: 'blocking wall', components: [deck, { t: 'wall', p: [0, 0, -3], s: [5, 15, .2] }], expected: null },
    { name: 'crate above hazardous floor', components: [deck, { t: 'pit', p: [0, 4, -6], s: [5, 1, 5], invisible: true }, { t: 'crate', p: [0, 4, -4.9], kind: 'wood' }], crate: true },
    { name: 'true void', components: [], expected: null },
  ];
  const results = [];
  for (const c of cases) {
    const scene = new r.THREE.Scene(), l = new r.Level(scene, { id: 'camera-fixture', name: c.name, data: fixture(c.components) });
    try {
      l.update(0); scene.updateMatrixWorld(true);
      const p = r.p; p.respawn(l, true, false); p.pos.set(c.x ?? 0, 10, 0);
      p.grounded = false; p.state = 'air'; p.airGrav = c.gravity ?? 'board'; p.floatAir = false;
      p.vVel = -10; p.lastVelX = 0; p.lastVelZ = c.vz ?? -20; p.fallCameraProbeValid = false;
      const y = p.cameraLandingAhead(l);
      if (c.crate) assert.ok(y > 4, `${c.name}: ${y}`);
      else if (c.expected === null) assert.equal(y, null, c.name);
      else assert.ok(Math.abs(y - c.expected) < .02, `${c.name}: ${y}`);
      assert.equal(p.cameraLandingAhead(l), y, 'cached forecast changed');
      results.push({ name: c.name, y });
      // The very same surface flagged for reset/death cannot rescue the camera.
      if (c.name === 'lower deck ahead') for (const property of ['lethal', 'outOfBounds']) {
        l.groundMeshes[0].userData[property] = true; p.fallCameraProbeValid = false;
        assert.equal(p.cameraLandingAhead(l), null, property);
        delete l.groundMeshes[0].userData[property];
      }
    } finally { l.dispose(); }
  }
  console.log(JSON.stringify(results, null, 2));
}, { source: () => fixture([]), endlessDeaths: true });
