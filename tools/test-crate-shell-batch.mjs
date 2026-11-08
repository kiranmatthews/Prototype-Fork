// Crate shells are drawn through spatial instance cells while every native
// crate keeps its gameplay state. A shell leaves the batch (and draws exactly
// as before) when its crate breaks, is hidden, or changes geometry/material.
import assert from 'node:assert/strict';
import process from 'node:process';
import * as THREE from 'three';

let server = null, mod;
if (process.env.CRATE_BATCH_DIRECT) mod = await import('../src/crateShellBatch.ts');
else {
  const {createServer} = await import('vite');
  server = await createServer({appType: 'custom', logLevel: 'silent', server: {middlewareMode: true}});
  mod = await server.ssrLoadModule('/src/crateShellBatch.ts');
}
try {
  const {CrateShellBatch} = mod;
  const scene = new THREE.Scene(), level = new THREE.Group();
  level.position.set(3, -2, 7); scene.add(level);
  const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4), other = new THREE.BoxGeometry(1, 1, 1);
  const wood = new THREE.MeshStandardMaterial(), metal = new THREE.MeshStandardMaterial();
  const crate = (x, z, kind = 'wood', material = wood, shellGeometry = geometry) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({visible: false}));
    mesh.position.set(x, 0.5, z); level.add(mesh);
    const root = new THREE.Group(), shell = new THREE.Mesh(shellGeometry, material);
    shell.castShadow = shell.receiveShadow = true; root.add(shell); mesh.add(root);
    return {alive: true, mesh, art: {kind, shell, root}};
  };
  const crates = [crate(0, 0), crate(2, 0), crate(4, 1), crate(1, 3, 'wood', metal), crate(2, 3, 'wood', metal),
    crate(40, 40), crate(60, 0, 'tnt'), crate(61, 0, 'tnt'), crate(3, 5, 'wood', wood, other)];
  scene.updateMatrixWorld(true);
  const batch = new CrateShellBatch(level, crates);
  // Wood near the origin and the metal pair become two cells; the far wood,
  // explosive bundles and the odd geometry are singletons or excluded.
  assert.deepEqual(batch.diagnostics, {cells: 2, capacity: 5, visible: 5});
  for (const c of crates.slice(0, 5)) assert.equal(c.art.shell.visible, false, 'batched shells hide their native draw');
  for (const c of crates.slice(5)) assert.equal(c.art.shell.visible, true, 'unbatched shells keep drawing natively');
  const cells = batch.root.children;
  const worldOf = (cell, i) => {
    const m = new THREE.Matrix4(); cell.getMatrixAt(i, m); return m.premultiply(cell.matrixWorld);
  };
  const check = () => {
    scene.updateMatrixWorld(true); batch.sync();
    for (const cell of cells) for (let i = 0; i < cell.count; i++) {
      const world = worldOf(cell, i);
      const match = crates.some(c => !c.art.shell.visible && c.art.shell.matrixWorld.elements.every((v, k) => Math.abs(v - world.elements[k]) < 1e-6));
      assert.ok(match, 'every instance copies a hidden native shell pose');
    }
  };
  check();
  // Squash animation and settling move the native shell; instances follow.
  crates[0].art.root.scale.set(1.1, .8, 1.1); crates[1].mesh.position.y -= .3; check();
  // Breaking, hiding (outline/pending) and relabelling return crates to native draws.
  crates[0].alive = false; check();
  assert.equal(crates[0].art.shell.visible, true); assert.equal(batch.diagnostics.visible, 4);
  crates[1].art.root.visible = false; check();
  assert.equal(crates[1].art.shell.visible, true); assert.equal(batch.diagnostics.visible, 3);
  crates[2].art.shell.material = metal; check();
  assert.equal(crates[2].art.shell.visible, true); assert.equal(batch.diagnostics.visible, 2);
  level.remove(crates[3].mesh); check();
  assert.equal(crates[3].art.shell.visible, true); assert.equal(batch.diagnostics.visible, 1);
  // Restoration (respawn / checkpoint) rejoins the batch.
  crates[0].alive = true; crates[1].art.root.visible = true; crates[2].art.shell.material = wood; level.add(crates[3].mesh); check();
  assert.equal(batch.diagnostics.visible, 5);
  for (const cell of cells) assert.ok(cell.boundingSphere && cell.boundingSphere.radius > 0, 'cells keep frustum bounds');
  // A cell with no drawn instances is skipped entirely.
  crates[3].alive = crates[4].alive = false; check();
  assert.equal(cells.filter(cell => cell.visible).length, 1);
  batch.dispose();
  assert.equal(batch.root.parent, null);
  for (const c of crates) assert.equal(c.art.shell.visible, true, 'dispose restores every native shell');
  assert.equal(geometry.attributes.position.count > 0, true, 'shared crate geometry is untouched');
  console.log(JSON.stringify({pass: true, cells: 2}));
} finally {
  await server?.close();
}
