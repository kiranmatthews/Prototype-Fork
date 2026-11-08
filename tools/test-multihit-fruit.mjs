import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';

// Decode the actual cage without requiring a browser texture decoder. Only
// texture references are stripped from this in-memory copy of the GLB.
const bytes = await readFile(new URL('../public/props/crate-family/multihit-cage.glb', import.meta.url));
const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length));
for (const material of json.materials ?? []) {
  delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
  if (material.pbrMetallicRoughness) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
}
json.images = []; json.textures = []; json.samplers = [];
const raw = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
raw.copy(padded);
const binary = bytes.subarray(20 + length), header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length + binary.length, 8);
header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const glb = Buffer.concat([header, padded, binary]);
const cage = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.length), '');
cage.scene.updateMatrixWorld(true);
const timber = [];
cage.scene.traverse(node => {
  if (!node.isMesh) return;
  const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  timber.push(g);
});
const cageGeometry = mergeGeometries(timber), cageBvh = new MeshBVH(cageGeometry);
const server = await createServer({ appType: 'custom', logLevel: 'silent', cacheDir: '.motion-playtest-cache/multihit-fruit-test-cache', server: { middlewareMode: true } });
try {
  const { createMultihitContents, updateMultihitContents } = await server.ssrLoadModule('/src/crateMultihit.ts');
  const { buildFruitGeometry } = await server.ssrLoadModule('/src/fruitAssets.ts');
  const fruit = createMultihitContents(), original = buildFruitGeometry(3), geometry = fruit.geometry;
  assert.deepEqual(geometry.index.array, original.index.array, 'retain complete source topology');
  for (const name of ['uv', 'fruitPart', 'fruitFlex'])
    assert.deepEqual(geometry.getAttribute(name).array, original.getAttribute(name).array, `retain ${name}`);
  for (const attribute of Object.values(geometry.attributes))
    assert.ok(Array.from(attribute.array).every(Number.isFinite), 'non-finite fruit geometry');
  assert.equal(fruit.geometry, createMultihitContents().geometry, 'geometry stays shared');

  // Broad convex cheeks must have continuous highlights around every latitude.
  // This catches the rejected pinched/corrugated slat-projection treatment.
  const part = geometry.getAttribute('fruitPart'), uv = geometry.getAttribute('uv'), normals = geometry.getAttribute('normal');
  const rings = new Map(), n = new THREE.Vector3(), next = new THREE.Vector3();
  for (let i = 0; i < part.count; i++) {
    if (part.getX(i) !== 0 || uv.getY(i) < .08 || uv.getY(i) > .90) continue;
    const key = uv.getY(i).toFixed(6), ring = rings.get(key) ?? [];
    ring.push(i); rings.set(key, ring);
  }
  let minimumNormalDot = 1;
  for (const ring of rings.values()) {
    ring.sort((a, b) => uv.getX(a) - uv.getX(b));
    for (let i = 0; i < ring.length; i++) {
      n.fromBufferAttribute(normals, ring[i]); next.fromBufferAttribute(normals, ring[(i + 1) % ring.length]);
      minimumNormalDot = Math.min(minimumNormalDot, n.dot(next));
    }
  }
  assert.ok(minimumNormalDot > .98, `fruit has lateral wrinkles (${minimumNormalDot})`);

  const matrix = new THREE.Matrix4(), pieces = [];
  for (let i = 0; i < 5; i++) {
    fruit.getMatrixAt(i, matrix);
    const g = geometry.clone().applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    pieces.push(g);
  }
  const packed = mergeGeometries(pieces), fruitBvh = new MeshBVH(packed);
  packed.computeBoundingBox();
  const bounds = packed.boundingBox;
  assert.ok(bounds.min.toArray().every(n => n > -.5) && bounds.max.toArray().every(n => n < .5), 'fruit escapes the crate envelope');
  for (const n of [-bounds.min.x, bounds.max.x, -bounds.min.z, bounds.max.z])
    assert.ok(n > .40, 'fruit must fill the cage close to every side');

  // Inspect the actual cage from eight surrounding views. Rays that strike
  // a timber face must not have fruit poking through that exterior surface.
  let checkedWoodRays = 0, exposedIntersections = 0;
  for (let view = 0; view < 8; view++) {
    const outward = new THREE.Vector3(Math.sin(view * Math.PI / 4), 0, Math.cos(view * Math.PI / 4));
    const across = new THREE.Vector3(outward.z, 0, -outward.x);
    for (let u = -25; u <= 25; u++) for (let v = -23; v <= 23; v++) {
      const origin = outward.clone().multiplyScalar(2).addScaledVector(across, u * .02); origin.y = v * .02;
      const ray = new THREE.Ray(origin, outward.clone().negate());
      const wood = cageBvh.raycastFirst(ray, THREE.DoubleSide);
      if (!wood) continue;
      const skin = fruitBvh.raycastFirst(ray, THREE.DoubleSide);
      if (!skin) continue;
      // Only the near face matters; fruit naturally occludes the rear cage.
      if (wood.distance < 2) {
        checkedWoodRays++;
        if (skin.distance < wood.distance - .002) exposedIntersections++;
      }
    }
  }
  assert.equal(exposedIntersections, 0, 'fruit cuts through a visible timber face');
  for (const hits of [5,4,3,2,1,0,5]) {
    updateMultihitContents(fruit, hits, .38, 0);
    assert.equal(fruit.count, hits);
    for (let frame = 0; frame < 24; frame++) {
      updateMultihitContents(fruit, hits, Math.max(0, .38 - frame / 60), frame / 60);
      assert.ok(Array.from(fruit.instanceMatrix.array).every(Number.isFinite));
    }
  }
  const triangles = cageGeometry.index.count / 3 + geometry.index.count / 3 * 5;
  assert.ok(triangles <= 30000);
  console.log(JSON.stringify({ pass: true, completeTopology: true, smoothCheeks: true, minimumNormalDot,
    checkedWoodRays, exposedIntersections, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, triangles,
    countsAndRebound: true }, null, 2));
} finally { await server.close(); }
