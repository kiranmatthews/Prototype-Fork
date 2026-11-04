import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

const noop = () => {};
const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop: noop }), measureText: text => ({ width: text.length * 8 }) }, { get: (target, key) => target[key] ?? noop });
globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) };
const server = await createServer({ appType: 'custom', logLevel: 'silent', cacheDir: '.release-queue/crate-test-vite-cache', server: { middlewareMode: true } });
try {
  const art = await server.ssrLoadModule('/src/crateArt.ts');
  const { CrateEffects, createCheckpointMarker, updateCheckpointMarker } = await server.ssrLoadModule('/src/crateEffects.ts');
  const { WorldSolids } = await server.ssrLoadModule('/src/worldSolids.ts');
  const report = [];
  for (const kind of art.CRATE_ART_KINDS) {
    const a = art.createCrateArt(kind, 2), b = art.createCrateArt(kind, 2);
    assert.equal(a.shell.geometry, b.shell.geometry, `${kind} does not share geometry`);
    assert.equal(a.shell.material, b.shell.material, `${kind} does not share materials`);
    a.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(a.root);
    assert.ok(bounds.min.x >= -1.06 && bounds.max.x <= 1.06 && bounds.min.z >= -1.06 && bounds.max.z <= 1.06, `${kind} exceeds its footprint`);
    for (const mesh of [a.shell, a.marks]) for (const attr of Object.values(mesh.geometry.attributes))
      assert.ok(Array.from(attr.array).every(Number.isFinite), `${kind} contains non-finite geometry`);
    // Rays from the six cardinal directions must see outward-facing wood.
    for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
      const ray = new THREE.Raycaster(axis.clone().multiplyScalar(3), axis.clone().negate());
      assert.ok(ray.intersectObject(a.shell).length > 0, `${kind} has a missing/reversed face at ${axis.toArray()}`);
    }
    const stats = art.crateArtStats(kind);
    assert.ok(stats.triangles < 6000, `${kind} exceeds the authored budget`);
    let totalTriangles = 0;
    a.root.traverse(node => { if (node.isMesh) totalTriangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; });
    assert.ok(totalTriangles < 6000, `${kind} accessories exceed the complete model budget`);
    const owner = new THREE.Group(); owner.position.set(2, 5, -7); owner.add(a.root);
    const pose = owner.matrix.clone(), geometry = a.shell.geometry;
    art.pulseCrateArt(a); for (let i = 0; i < 60; i++) art.updateCrateArt(a, 1 / 60, 1);
    assert.equal(a.shell.geometry, geometry, 'animation replaced geometry');
    assert.ok(owner.matrix.equals(pose), 'art pulse moved the collision owner');
    assert.ok(Math.abs(a.root.scale.y - 2) < 1e-9 || kind === 'nitro', 'pulse did not finitely settle');
    art.setCrateArtState(a, { pending: true }); assert.equal(a.root.visible, false);
    art.setCrateArtState(a, { timeSecs: 4 }); assert.equal(a.root.visible, true); assert.equal(a.labelKey, '4s'); assert.equal(a.marks.visible, true);
    report.push({ kind, ...stats, totalTriangles });
  }
  const effects = new CrateEffects(), solids = new WorldSolids();
  const ground = new THREE.Mesh(new THREE.BoxGeometry(30, .3, 30)); ground.position.y = -.15; ground.updateMatrixWorld(true); solids.add(ground);
  const world = { worldSolids: solids, groundMeshes: [ground], killY: -20 };
  effects.emit('wood', new THREE.Vector3(0, .8, 0), 1.6, 0);
  let settled = 0;
  const shardMatrix = new THREE.Matrix4(), shardScale = new THREE.Vector3(), shardBounds = new THREE.Box3();
  for (let i = 0; i < 110; i++) {
    effects.update(1 / 60, world); settled = Math.max(settled, effects.shards.filter(s => s.settled).length);
    assert.ok(effects.shards.every(s => s.position.y >= -.05), 'debris tunneled through support');
    for (const shard of effects.shards.filter(s => s.settled)) {
      shardMatrix.compose(shard.position, shard.rotation, shardScale.setScalar(shard.size));
      shardBounds.copy(shard.batch.mesh.geometry.boundingBox).applyMatrix4(shardMatrix);
      assert.ok(shardBounds.min.y >= -.01, 'settled shard geometry penetrates the floor');
    }
  }
  assert.ok(settled > 0, 'debris never settled');
  for (let i = 0; i < 30; i++) effects.emit(i % 2 ? 'nitro' : 'tnt', new THREE.Vector3(0, 1, 0), 1.6, 0, true);
  assert.ok(effects.diagnostics.shards <= 192 && effects.diagnostics.bursts <= 12, 'chain blast exceeded the bounded pool');
  for (let i = 0; i < 200; i++) effects.update(1 / 60, world);
  assert.equal(effects.diagnostics.shards, 0); assert.equal(effects.diagnostics.bursts, 0); assert.equal(effects.diagnostics.drawCalls, 0);
  effects.emit('checkpoint', new THREE.Vector3(0, 1, 0), 1.6, 0); effects.clear(); assert.equal(effects.diagnostics.shards, 0);
  const marker = createCheckpointMarker(1.6); marker.active = true; updateCheckpointMarker(marker, .3); assert.ok(marker.root.visible);
  marker.active = false; updateCheckpointMarker(marker, 0); assert.equal(marker.root.visible, false); assert.equal(marker.age, 0);
  effects.dispose(); solids.dispose();
  console.log(JSON.stringify({ pass: true, allSixFaces: true, settled, lifetimeAndPool: true, variants: report }, null, 2));
} finally { await server.close(); }
