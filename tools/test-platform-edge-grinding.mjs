import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, THREE, Level, player, CONST }) => {
  const { icePlatform } = await server.ssrLoadModule('/src/surfaceBehavior.ts');
  const { surfaceBoundaryEdges } = await server.ssrLoadModule('/src/surfaceEdges.ts');
  const cases = [
    ['plain', {}], ['rotated', { yaw: 37 }], ['ice', { slip: true }],
    ['ice opt-in', { slip: true, edgeGrinding: true }],
    ['ice helper', icePlatform([0, 0, 0], [8, 1, 12])],
  ];
  let catches = 0;
  for (const [name, fields] of cases) for (const disabled of [false, true]) {
    const platform = { t: 'platform', p: [0, -.5, 0], s: [8, 1, 12], ...fields,
      ...(disabled ? { edgeGrinding: false } : {}) };
    const data = { v: 1, name, spawn: [0, .1, 0], killY: -20, components: [platform,
      { t: 'gate', p: [0, 0, -5] }] };
    const scene = new THREE.Scene();
    const level = new Level(scene, { id: '__edge_grinding', name, data });
    try {
      scene.updateMatrixWorld(true);
      const mesh = level.groundMeshes.find(m => m.userData.editorIdx === 0);
      assert.ok(mesh, name);
      const edges = surfaceBoundaryEdges(mesh);
      assert.ok(edges.length >= 4, `${name}: missing surface boundary`);
      if (disabled) assert.equal(level.surfaceEdgeRails.length, 0, `${name}: explicit opt-out ignored`);
      else for (const [a, b] of edges) {
        const midpoint = a.clone().lerp(b, .5); midpoint.y += .05;
        assert.ok(level.surfaceEdgeRails.some(r => r.closest(midpoint).distance < 1e-4),
          `${name}: only edgeGrinding:false may disable platform edges`);
      }
      assert.equal(level.rails.length, 0, `${name}: edges must not become physical bars`);
      const captured = level.captureData();
      assert.equal(captured.components[0].edgeGrinding, platform.edgeGrinding);
      assert.equal(captured.components.filter(c => c.t === 'rail').length, 0);
      if (disabled) continue;
      // Every long top edge must accept the production player's grind input.
      for (const rail of level.surfaceEdgeRails.filter(r => r.totalLength > 3 && r.points.every(p => p.y > -.1))) {
        const heading = rail.tangentAt(rail.totalLength / 2);
        const position = rail.pointAt(rail.totalLength / 2).add(new THREE.Vector3(0, .15, 0));
        player.respawn(level, true, true, { position, heading });
        player.freeSkate = player.airFromSkate = true;
        player.state = 'air'; player.grounded = false; player.speed = 8; player.vVel = 0;
        const input = makeInput({ grindHeld: true, grindPressed: true });
        player.step(CONST.fixedStep, input, level);
        assert.equal(player.state, 'grind', `${name}: failed real grind catch`);
        assert.equal(player.grindRail, rail, `${name}: caught a different edge`);
        assert.equal(player.isBailing, false);
        catches++;
      }
    } finally { level.dispose(); }
  }
  assert.equal(icePlatform([0, 0, 0], [4, 1, 8], { edgeGrinding: true }).edgeGrinding, true);
  assert.equal(icePlatform([0, 0, 0], [4, 1, 8], { edgeGrinding: false }).edgeGrinding, false);
  console.log(`PASS default/opt-out platform edges, ice authoring, capture, and ${catches} production Player catches.`);
});
