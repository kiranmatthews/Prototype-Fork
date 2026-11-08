// Ground BVH meshes reject rays that cannot reach their bounding sphere before
// entering three-mesh-bvh. This must never change a result: compare the bounded
// raycast with the library's own acceleratedRaycast over random meshes, poses,
// rays and near/far ranges, including intersectObjects ordering.
import assert from 'node:assert/strict';
import process from 'node:process';
import * as THREE from 'three';
import {acceleratedRaycast} from 'three-mesh-bvh';

let server = null, mod;
if (process.env.GROUND_BOUNDS_DIRECT) mod = await import('../src/groundAcceleration.ts');
else {
  const {createServer} = await import('vite');
  server = await createServer({appType: 'custom', logLevel: 'silent', server: {middlewareMode: true}});
  mod = await server.ssrLoadModule('/src/groundAcceleration.ts');
}
try {
  const {accelerateGroundMeshes, boundedAcceleratedRaycast} = mod;
  let seed = 1234567;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const range = (a, b) => a + (b - a) * rand();

  const terrain = new THREE.PlaneGeometry(40, 30, 48, 36);
  const p = terrain.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * .3) * 2 + Math.cos(p.getY(i) * .5));
  terrain.computeVertexNormals();
  const geometries = [
    terrain,
    new THREE.BoxGeometry(6, 2, 9, 8, 4, 8),
    new THREE.SphereGeometry(3, 24, 16),
    new THREE.TorusKnotGeometry(4, 1, 64, 12),
    new THREE.CylinderGeometry(2, 5, 7, 24, 6),
  ];
  const meshes = [];
  for (let i = 0; i < 60; i++) {
    const material = new THREE.MeshBasicMaterial({side: [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide][i % 3]});
    const mesh = new THREE.Mesh(geometries[i % geometries.length], material);
    mesh.position.set(range(-120, 120), range(-20, 30), range(-120, 120));
    mesh.rotation.set(range(-3, 3), range(-3, 3), range(-3, 3));
    mesh.scale.set(range(.3, 3), range(.3, 3), range(.3, 3));
    if (i % 7 === 0) mesh.scale.x *= -1; // mirrored placements exist in authored levels
    mesh.updateMatrixWorld(true);
    meshes.push(mesh);
  }
  const {stats} = accelerateGroundMeshes(meshes, 0);
  assert.equal(stats.acceleratedMeshes, meshes.length, 'every test mesh gets a ground BVH');
  for (const mesh of meshes) assert.equal(mesh.raycast, boundedAcceleratedRaycast, 'ground meshes use the bounded raycast');

  const same = (a, b, label) => {
    assert.equal(a.length, b.length, `${label}: hit count`);
    for (let i = 0; i < a.length; i++) {
      assert.equal(a[i].object, b[i].object, `${label}: object ${i}`);
      assert.equal(a[i].distance, b[i].distance, `${label}: distance ${i}`);
      assert.equal(a[i].faceIndex, b[i].faceIndex, `${label}: face ${i}`);
      assert.ok(a[i].point.equals(b[i].point), `${label}: point ${i}`);
    }
  };
  const raycaster = new THREE.Raycaster();
  let tests = 0, hits = 0, rejected = 0;
  const direction = new THREE.Vector3();
  for (let r = 0; r < 4000; r++) {
    const origin = new THREE.Vector3(range(-140, 140), range(-30, 60), range(-140, 140));
    if (r % 3 === 0) {
      direction.set(0, -1, 0); // the common ground probe, often from above a mesh
      if (r % 2) { const target = meshes[r % meshes.length].position; origin.set(target.x + range(-4, 4), target.y + range(5, 40), target.z + range(-4, 4)); }
    } else if (r % 3 === 1) direction.copy(meshes[(r * 7) % meshes.length].position).sub(origin).normalize(); // aimed: many hits
    else direction.set(range(-1, 1), range(-1, 1), range(-1, 1)).normalize();
    if (direction.lengthSq() === 0) direction.set(0, -1, 0);
    raycaster.set(origin, direction);
    raycaster.near = r % 5 === 0 ? range(0, 20) : 0;
    raycaster.far = r % 4 === 0 ? Infinity : raycaster.near + range(.5, 120);
    raycaster.firstHitOnly = r % 6 === 0;
    for (const mesh of meshes) {
      const expected = [], actual = [];
      acceleratedRaycast.call(mesh, raycaster, expected);
      mesh.raycast(raycaster, actual);
      same(actual, expected, `ray ${r} mesh ${mesh.id}`);
      tests++; hits += expected.length;
    }
    // The real call site: one ordered list across many meshes.
    const bounded = raycaster.intersectObjects(meshes, false);
    for (const mesh of meshes) mesh.raycast = acceleratedRaycast;
    const reference = raycaster.intersectObjects(meshes, false);
    for (const mesh of meshes) mesh.raycast = boundedAcceleratedRaycast;
    same(bounded, reference, `intersectObjects ray ${r}`);
  }
  // Count how often the library is skipped entirely.
  const library = meshes[0].geometry.boundsTree.constructor.prototype;
  const original = library.raycastObject3D;
  let entered = 0;
  library.raycastObject3D = function (...args) { entered++; return original.apply(this, args); };
  raycaster.set(new THREE.Vector3(0, 80, 0), new THREE.Vector3(0, -1, 0));
  raycaster.near = 0; raycaster.far = Infinity; raycaster.firstHitOnly = false;
  for (let i = 0; i < 200; i++) {
    raycaster.ray.origin.set(range(-140, 140), 80, range(-140, 140));
    raycaster.intersectObjects(meshes, false);
  }
  library.raycastObject3D = original;
  rejected = 200 * meshes.length - entered;
  assert.ok(rejected > 0, 'vertical probes skip meshes they cannot reach');
  console.log(JSON.stringify({pass: true, meshRayComparisons: tests, hits,
    verticalProbe: {meshTests: 200 * meshes.length, enteredBvh: entered, skipped: rejected}}));
} finally {
  await server?.close();
}
