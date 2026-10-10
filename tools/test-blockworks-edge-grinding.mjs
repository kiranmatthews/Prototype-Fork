import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, THREE, Level, player, CONST }) => {
  const { CODEX_LAB_LEVEL: data } = await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const { surfaceBoundaryEdges, joinSurfaceBoundaryEdges } = await server.ssrLoadModule('/src/surfaceEdges.ts');
  const scene = new THREE.Scene(), level = new Level(scene, { id: 'codex-lab', name: data.name, data });
  try {
    const candidates = level.groundMeshes.filter(mesh => {
      const c = data.components[mesh.userData.editorIdx];
      return c && !c.invisible && !c.outline && c.edgeGrinding !== false && (c.t === 'platform' || c.t === 'mesh');
    });
    assert.ok(candidates.length > 70, 'Blockworks builders still blanket-disable ordinary platforms');
    let boundaries = 0;
    for (const mesh of candidates) for (const [a, b] of surfaceBoundaryEdges(mesh)) {
      const midpoint = a.clone().lerp(b, .5); midpoint.y += .05;
      assert.ok(level.grindRails.some(r => r.closest(midpoint).distance < .21),
        `${data.components[mesh.userData.editorIdx].nm}: missing boundary at ${midpoint.toArray()}`);
      boundaries++;
    }
    assert.equal(data.components.find(c => c.nm === 'Continuous ground stratum').edgeGrinding, false);
    assert.equal(data.components.find(c => c.t === 'vertramp').rails, false);
    assert.ok(data.components.filter(c => c.invisible && c.t === 'wallpath').every(c => c.edgeGrinding === false));

    const curved = level.surfaceEdgeRails.filter(r => r.points.length > 8 && r.totalLength > 30 &&
      r.points.every(p => p.y > -5) && Math.abs(r.tangentAt(0).dot(r.tangentAt(r.totalLength))) < .999);
    assert.ok(curved.length >= 3, 'curved deck edges must form continuous rails');
    for (const rail of curved.slice(0, 3)) {
      const t = rail.totalLength * .35, heading = rail.tangentAt(t);
      const position = rail.pointAt(t).add(new THREE.Vector3(0, .15, 0));
      player.respawn(level, true, true, { position, heading });
      player.state = 'air'; player.grounded = false;
      player.freeSkate = player.airFromSkate = true; player.speed = 8; player.vVel = 0;
      for (let frame = 0; frame < 60; frame++) {
        const input = makeInput({ grindHeld: true, grindPressed: frame === 0,
          moveX: player.state === 'grind' ? THREE.MathUtils.clamp(-player.balance * 5 - player.balanceVel * .7, -1, 1) : 0 });
        player.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep);
        assert.equal(player.state, 'grind', `curved boundary ended at a triangle seam on frame ${frame}`);
        assert.equal(player.grindRail, rail);
        assert.equal(player.isBailing, false);
      }
      assert.ok(player.grindT > t + 4, 'must travel through several mesh segments');
    }
    // Joining must preserve the measured curve, split sharp corners, and
    // leave non-manifold junctions unambiguous. Input ordering is irrelevant.
    const v = (x, z) => new THREE.Vector3(x, 0, z);
    const edges = [[v(1, 0), v(2, .1)], [v(2, .1), v(2, 2)], [v(0, 0), v(1, 0)]];
    assert.deepEqual(joinSurfaceBoundaryEdges(edges).map(p => p.length).sort(), [2, 3]);
    assert.equal(joinSurfaceBoundaryEdges([...edges, [v(1, 0), v(1, -1)]]).length, 4);
    assert.equal(level.captureData().components.filter(c => c.t === 'rail').length,
      data.components.filter(c => c.t === 'rail').length, 'derived edges leaked into editor data');
    console.log(`PASS ${candidates.length} Blockworks surfaces / ${boundaries} boundaries; three sustained curved grinds; authored exceptions and capture preserved.`);
  } finally { level.dispose(); }
});
