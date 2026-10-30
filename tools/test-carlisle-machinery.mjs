import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
const bundle = await build({ stdin: { contents: `export {CarlisleDeckMachinery} from './src/carlisleDeckMachinery'; export {kineticPose} from './src/kineticPlatforms'; export {CARLISLE_TIDAL_RELAY_LEVEL, carlislePoint} from './src/levels/carlisle-tidal-relay'; export * as THREE from 'three';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const { CarlisleDeckMachinery, kineticPose, CARLISLE_TIDAL_RELAY_LEVEL: level, carlislePoint, THREE } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const materials = Array.from({ length: 4 }, () => new THREE.MeshStandardMaterial({ vertexColors: true }));
const machinery = new CarlisleDeckMachinery(Object.fromEntries(['navy', 'frame', 'orange', 'metal'].map((k, i) => [k, materials[i]])));
const root = new THREE.Group(), chunk = new THREE.Group(); root.add(chunk);
const source = JSON.stringify(level), rows = [];
function sea(z) { let a = -150, b = 4200; for (let i = 0; i < 15; i++) { const m = (a + b) / 2; if (carlislePoint(m, 0)[2] > z) a = m; else b = m; } return carlislePoint((a + b) / 2, -8)[1]; }
for (const c of level.components.filter(c => c.t === 'mover')) {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(...c.s), materials[0]); deck.name = c.nm;
  deck.position.set(c.p[0], c.p[1] - c.s[1] / 2, c.p[2]); deck.rotation.y = THREE.MathUtils.degToRad(c.yaw ?? 0); root.add(deck);
  const base = deck.position.clone();
  if (!machinery.add(c, deck, chunk, sea(c.p[2]))) { root.remove(deck); deck.geometry.dispose(); continue; }
  rows.push({ c, deck, base, fixed: chunk.children.at(-1), samples: 0, minContactClearance: Infinity, maxCableLengthError: 0 });
}
assert.equal(rows.length, 10);
const geometry = new Set(), callbacks = [];
root.traverse(n => { if (!n.isMesh) return; if (n.name !== n.parent?.name && n.userData.visualOnly) geometry.add(n.geometry); if (n.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender && n.userData.visualOnly) callbacks.push(n); });
for (const geo of geometry) for (const attribute of Object.values(geo.attributes)) for (const v of attribute.array) assert.ok(Number.isFinite(v), 'nonfinite geometry');
const point = new THREE.Vector3(), inverse = new THREE.Matrix4();
// Sub-frame samples exercise continuous native motion and render-driven fittings,
// including both reversals. Every vertex is checked against the deck footprint.
for (let time = 0; time <= 26; time += .125) {
  for (const row of rows) {
    const { c, deck, base } = row, axis = new THREE.Vector3(c.axis === 'x' ? 1 : 0, c.axis === 'y' ? 1 : 0, c.axis === 'z' ? 1 : 0);
    kineticPose(base, axis, c.amp, c.speed, c.phase ?? 0, time, undefined, deck.position);
  }
  root.updateMatrixWorld(true); callbacks.forEach(n => n.onBeforeRender()); root.updateMatrixWorld(true);
  for (const row of rows) {
    const { c, deck, fixed, base } = row; inverse.copy(deck.matrixWorld).invert();
    const own = [fixed, ...deck.children];
    for (const group of own) group.traverse(n => {
      if (!n.isMesh) return;
      const p = n.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld).applyMatrix4(inverse);
        assert.ok(point.toArray().every(Number.isFinite));
        // Full contact box plus a one-metre edge/grind clearance must remain open.
        if (Math.abs(point.x) < c.s[0] / 2 + 1 && Math.abs(point.z) < c.s[2] / 2 + 1) {
          const clearance = -c.s[1] / 2 - point.y;
          row.minContactClearance = Math.min(row.minContactClearance, clearance);
          assert.ok(clearance > -.001, `${c.nm}: machinery crosses the native underside (${clearance})`);
        }
      }
    });
    if (fixed.userData.deckMachinery.kind === 'counterweight') {
      const ropes = fixed.children.filter(n => /cable$/.test(n.name));
      assert.equal(ropes.length, 4);
      const lengths = ropes.map(n => n.scale.y);
      assert.ok(lengths.every(n => n > 0));
      row.cableSum ??= lengths[0] + lengths[1];
      row.maxCableLengthError = Math.max(row.maxCableLengthError, Math.abs(lengths[0] + lengths[1] - row.cableSum));
      assert.ok(row.maxCableLengthError < 1e-9, 'hoist cable changes total length');
      fixed.children.filter(n => n.name === 'Travelling counterweight').forEach(weight => assert.ok(Math.abs(weight.position.y + deck.position.y - base.y + 10) < 1e-8, 'ballast must counter-travel'));
    }
    row.samples++;
  }
}
assert.equal(JSON.stringify(level), source, 'presentation changed level data');
const report = { passed: true, diagnostics: { ...machinery.diagnostics }, rows: rows.map(({ c, deck, base, fixed, ...r }) => ({ name: c.nm, kind: fixed.userData.deckMachinery.kind, ...r })) };
let disposed = 0; geometry.forEach(g => g.addEventListener('dispose', () => disposed++));
machinery.dispose(); assert.equal(disposed, geometry.size); assert.equal(chunk.children.length, 0); assert.ok(rows.every(r => r.deck.children.length === 0));
report.disposal = { geometries: disposed, callbacks: callbacks.length, groupsDetached: true };
await mkdir('art/carlisle-shipyard/machinery', { recursive: true }); await writeFile('art/carlisle-shipyard/machinery/geometry.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
