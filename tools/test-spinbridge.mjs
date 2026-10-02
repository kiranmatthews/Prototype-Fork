// One focused real-Player smoke: spin, settle, walk, bank, die and hard reset.
import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

const fixture = { v: 1, name: 'Spin bridge smoke', spawn: [-4, .12, 0], killY: -5,
  components: [
    { t: 'platform', p: [-3, -.5, 0], s: [6, 1, 2], edgeGrinding: false },
    { t: 'spinbridge', p: [0, 0, 0], s: [6, .36, 1.2], cycle: .4 },
    { t: 'platform', p: [11, -.5, 0], s: [10, 1, 2], edgeGrinding: false },
    { t: 'checkpoint', p: [9, 0, 0] }, { t: 'gate', p: [13, 0, 0], yaw: 90 },
    { t: 'zone', p: [4, 0, 0], s: [30, 1, 8], dir: 'E' },
  ] };

await withBlockworksRuntime(r => {
  const bridge = r.l.spinBridges[0], checkpoint = r.l.checkpoints[0];
  const probe = new r.THREE.Raycaster(), down = new r.THREE.Vector3(0, -1, 0);
  const floor = () => {
    probe.set(new r.THREE.Vector3(3, 2, 0), down); probe.far = 4;
    return probe.intersectObjects(r.l.groundMeshes, false)[0];
  };
  r.stepFor(12);
  assert.equal(bridge.activated, false); assert.ok(!floor(), 'closed upright bridge created an invisible floor');
  r.walkTo([-.8, 0, 0], { label: 'approach actual upright contact', pace: .18 });
  r.tick({ spinHeld: true });
  assert.equal(bridge.activated, true, 'production Player spin did not activate the plank');
  assert.equal(bridge.deployed, false); assert.ok(!floor(), 'moving leaf became a premature floor');
  r.stepFor(40);
  assert.equal(bridge.deployed, true); assert.ok(Math.abs(floor().point.y) < .001);
  assert.ok(bridge.wallBox.isEmpty(), 'deployed bridge retained its upright blocker');
  r.walkTo([7.8, 0, 0], { label: 'walk the physically settled bridge', pace: .18 });
  r.tick({ spinHeld: true }); r.stepFor(25);
  assert.equal(checkpoint.active, true); assert.deepEqual(checkpoint.savedSpinBridges, [true]);
  r.walkTo([-5.3, 0, 0], { label: 'return across the latched bridge', pace: .2 });
  r.charge(); r.releaseJump({ moveX: -1 });
  r.until(() => r.p.state === 'dead', { moveX: -1 },
    { label: 'walk off ordinary ground for checkpoint restore', allowDeath: true, maxFrames: 400 });
  r.until(() => r.p.state === 'ride' && r.p.grounded, {},
    { label: 'actual checkpoint respawn', allowDeath: true, maxFrames: 400 });
  assert.equal(bridge.deployed, true); assert.ok(Math.abs(floor().point.y) < .001);
  r.tick({ restartPressed: true }); r.stepFor(2);
  assert.equal(bridge.activated, false); assert.equal(bridge.deployed, false);
  assert.ok(!floor()); assert.ok(!bridge.wallBox.isEmpty());
  console.log(`PASS real spin contact, visible deployment, physical crossing, banked soft restore and closed hard reset (${r.frame} fixed frames).`);
}, { modulePath: '/src/levels/puzzle-trilogy.ts', levelId: 'spinbridge-smoke', source: () => fixture,
  maxFrames: 4000, controlFrame: () => ({ x: 0, z: -1 }) });
