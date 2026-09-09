import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { milkBlob, buildMilkGeometry, MILK_VARIANTS, MILK_SIZE, MilkMaterial, setMilkVariant } = await server.ssrLoadModule('/src/milk.ts');
  const shapes = new Set();
  for (let i = 0; i < MILK_VARIANTS.length; i++) {
    const g = buildMilkGeometry(i), p = g.getAttribute('position'), n = g.getAttribute('normal');
    assert.ok(g.index && g.index.count / 3 < 1600, 'pickup triangle budget');
    shapes.add(Array.from(p.array).map(x => x.toFixed(4)).join(','));
    const edges = new Map();
    for (let j = 0; j < g.index.count; j += 3) {
      const ids = [0, 1, 2].map(k => g.index.getX(j + k));
      for (let k = 0; k < 3; k++) {
        const a = ids[k], b = ids[(k + 1) % 3], key = [Math.min(a, b), Math.max(a, b)].join(':');
        const old = edges.get(key) ?? { count: 0, winding: 0 };
        old.count++; old.winding += a < b ? 1 : -1; edges.set(key, old);
      }
    }
    assert.ok([...edges.values()].every(e => e.count === 2 && e.winding === 0), 'milk shell must be closed');
    for (let j = 0; j < p.count; j++) {
      assert.ok(Number.isFinite(p.getX(j) + p.getY(j) + p.getZ(j)));
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n, j).length() - 1) < 1e-5);
      for (const value of [p.getX(j), p.getY(j), p.getZ(j)]) assert.ok(Math.abs(value) * 1.025 < .5, 'wobble exceeds pickup envelope');
    }
    g.dispose();
  }
  assert.equal(shapes.size, 6, 'variants must have distinct surfaces');
  const a = milkBlob(MILK_SIZE, 2), b = milkBlob(MILK_SIZE, 2);
  assert.equal(a.children[0].geometry, b.children[0].geometry, 'instances duplicate geometry');
  assert.equal(a.children[0].material, b.children[0].material, 'instances duplicate material');
  assert.equal(a.children[0].geometry.userData.shared, true);
  assert.equal(a.children[0].customDepthMaterial.userData.shared, true);
  setMilkVariant(a, 4); assert.equal(a.userData.milkVariant, 4);
  assert.notEqual(a.children[0].geometry, b.children[0].geometry);
  const material = new MilkMaterial(), copy = material.clone();
  assert.ok(copy instanceof MilkMaterial); assert.equal(copy.transparent, false); assert.equal(copy.depthWrite, true);
  copy.opacity = .3; assert.equal(material.opacity, 1);
  for (const m of [material, copy]) {
    const shader = { vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader, uniforms: {} };
    m.onBeforeCompile(shader, null);
    assert.ok(shader.uniforms.milkTime);
    assert.match(shader.vertexShader, /normal \/ milkStretch/);
    assert.match(shader.fragmentShader, /vec3 outgoingLight = body/);
    assert.doesNotMatch(shader.fragmentShader, /vec3 outgoingLight = reflectedLight.indirectDiffuse/);
  }
  console.log('PASS six distinct watertight milk surfaces, smooth normals, animated pickup envelope, shared GPU resources, variant handoff and clone-safe opaque shader.');
} finally { await server.close(); }
