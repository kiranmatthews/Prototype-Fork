import assert from 'node:assert/strict';
import { setImmediate as settleLoads } from 'node:timers/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createServer } from 'vite';

const previousLoad = GLTFLoader.prototype.loadAsync;
const requests = new Map(), visuals = [];
let active = 0, peak = 0;
const held = () => {
  active++;peak = Math.max(peak, active);
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes;reject = no; });
  return { promise, resolve(value) { active--;resolve(value); }, reject(error) { active--;reject(error); } };
};
GLTFLoader.prototype.loadAsync = function (url) {
  const job = held(), entries = requests.get(url) ?? [];
  entries.push(job);requests.set(url, entries);return job.promise;
};
function fixture() {
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry(.5, .5, .5);
  const disposed = { geometry: 0, material: 0, texture: 0, bitmap: 0 };
  const texture = new THREE.Texture({ width: 2, height: 2, close: () => disposed.bitmap++ });
  const material = new THREE.MeshStandardMaterial({ map: texture });
  geometry.addEventListener('dispose', () => disposed.geometry++);
  material.addEventListener('dispose', () => disposed.material++);
  texture.addEventListener('dispose', () => disposed.texture++);
  scene.add(new THREE.Mesh(geometry, material));
  return { gltf: { scene, animations: [] }, geometry, texture, disposed };
}
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { sceneryLoads } = await server.ssrLoadModule('/src/assetLoadQueue.ts');
  const { createEnemyVisual } = await server.ssrLoadModule('/src/enemies/runtime.ts');
  const create = url => { const visual = createEnemyVisual('grunt', { url });visuals.push(visual);return visual; };
  // Fill the existing scenery queue first: an independent enemy-only cap would
  // still permit overlapping scenery and enemy decode peaks and fails here.
  const scenery = [];
  const sceneryReady = [0, 1].map(() => sceneryLoads.run(() => {
    const job = held();scenery.push(job);return job.promise;
  }));
  await settleLoads();assert.equal(active, 2);
  const retiredPeer = create('fixture://shared'), a = create('fixture://shared'), b = create('fixture://shared');
  const cancelled = create('fixture://cancelled'), retired = create('fixture://reacquired');
  await settleLoads();
  assert.equal(requests.size, 0, 'enemy decode bypassed the occupied scenery queue');
  retiredPeer.dispose();cancelled.dispose();retired.dispose();
  const replacement = create('fixture://reacquired');
  await settleLoads();assert.equal(requests.size, 0);

  scenery[0].resolve();await sceneryReady[0];await settleLoads();
  assert.equal(requests.get('fixture://shared').length, 1, 'queued peers must share one decode');
  assert.equal(requests.has('fixture://cancelled'), false);
  assert.equal(requests.has('fixture://reacquired'), false, 'second scenery job must retain its queue slot');
  const shared = fixture();requests.get('fixture://shared')[0].resolve(shared.gltf);
  await Promise.all([a.ready, b.ready, retiredPeer.ready]);await settleLoads();
  assert.equal(a.diagnostics.status, 'ready');assert.equal(b.diagnostics.status, 'ready');
  assert.equal(retiredPeer.diagnostics.status, 'disposed');
  const meshes = [a, b].map(visual => {
    let result;visual.group.traverse(object => { if (object.isMesh) result = object; });return result;
  });
  assert.equal(meshes[0].geometry, shared.geometry);assert.equal(meshes[1].geometry, shared.geometry);
  assert.equal(meshes[0].material.map, shared.texture);assert.equal(meshes[1].material.map, shared.texture);
  assert.notEqual(meshes[0].material, meshes[1].material, 'queue changed per-instance appearance ownership');
  await Promise.all([cancelled.ready, retired.ready]);
  assert.equal(cancelled.diagnostics.status, 'disposed');assert.equal(retired.diagnostics.status, 'disposed');
  assert.equal(cancelled.group.children.length, 0);assert.equal(retired.group.children.length, 0);
  assert.equal(requests.has('fixture://cancelled'), false, 'retired queued job was fetched/decoded');
  assert.equal(requests.get('fixture://reacquired').length, 1, 'retired generation loaded ahead of its live replacement');
  const replacementSource = fixture();requests.get('fixture://reacquired')[0].resolve(replacementSource.gltf);
  await replacement.ready;assert.equal(replacement.diagnostics.status, 'ready');
  const replacementPeer = create('fixture://reacquired');await replacementPeer.ready;
  assert.equal(requests.get('fixture://reacquired').length, 1, 'cancelled generation evicted the replacement cache entry');
  scenery[1].resolve();await sceneryReady[1];await settleLoads();
  assert.equal(peak, 2, 'combined scenery and enemy concurrency exceeded the shared limit');
  assert.equal(active, 0);

  a.dispose();assert.deepEqual(shared.disposed, { geometry: 0, material: 0, texture: 0, bitmap: 0 });
  b.dispose();assert.deepEqual(shared.disposed, { geometry: 1, material: 1, texture: 1, bitmap: 1 });
  replacement.dispose();assert.equal(replacementSource.disposed.geometry, 0);
  replacementPeer.dispose();assert.deepEqual(replacementSource.disposed, { geometry: 1, material: 1, texture: 1, bitmap: 1 });

  // A failed active decode resolves the existing visual ready/error contract
  // and frees the shared slot/cache entry for an ordinary subsequent attempt.
  const failure = create('fixture://retry');await settleLoads();
  requests.get('fixture://retry')[0].reject(new Error('decode fixture failure'));
  await failure.ready;
  assert.equal(failure.diagnostics.status, 'error');assert.match(failure.diagnostics.error, /decode fixture failure/);
  const retry = create('fixture://retry');await settleLoads();
  assert.equal(requests.get('fixture://retry').length, 2);
  requests.get('fixture://retry')[1].resolve(fixture().gltf);await retry.ready;
  assert.equal(retry.diagnostics.status, 'ready');assert.equal(active, 0);
  console.log('PASS enemy loading: shared scenery concurrency cap, cache peers, queued retirement/reacquisition, unchanged resource ownership, handled readiness errors and retry.');
} finally {
  for (const visual of visuals) visual.dispose();
  GLTFLoader.prototype.loadAsync = previousLoad;
  await server.close();
}
