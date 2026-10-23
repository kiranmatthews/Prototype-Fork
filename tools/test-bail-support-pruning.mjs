import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';

const server = await createServer({ appType:'custom', logLevel:'silent', server:{middlewareMode:true} });
try {
  const { CharacterInteractionBounds } = await server.ssrLoadModule('/src/character/interactionBounds.ts');
  const measure = new CharacterInteractionBounds(null), root = new THREE.Group(), hidden = new THREE.Group();
  const geometry = new THREE.SphereGeometry(.3, 16, 12), material = new THREE.MeshBasicMaterial();
  geometry.morphAttributes.position = [geometry.attributes.position.clone()]; geometry.morphTargetsRelative = true;
  const near = new THREE.Mesh(geometry, material), far = new THREE.Mesh(geometry.clone(), material.clone());
  const instances = new THREE.InstancedMesh(geometry, material, 3), matrix = new THREE.Matrix4(), world = new THREE.Matrix4();
  near.position.y = -2; far.position.y = 3; root.add(near, far, hidden, instances);
  const normal = new THREE.Vector3(), origin = new THREE.Vector3(.1, -.2, .3), point = new THREE.Vector3();
  const box = new THREE.Box3(), local = new THREE.Box3(), transformed = new THREE.Box3(), expected = new THREE.Box3(), vertex = new THREE.Vector3();
  let cases = 0, savedSamples = 0;
  const initialRecords = new Map();
  function compare() {
    root.updateMatrixWorld(true);
    // Alternate exact live bounds with bail envelopes. Both may share the
    // next support query's visible meshes; neither may retain stale hierarchy.
    measure.measure(root, box, true, cases % 2 === 0, true); expected.makeEmpty();
    // Independently measure current rendered local vertices. A stale cached
    // box might incorrectly exclude the very surface that should land first.
    root.traverseVisible(node => {
      if (!node.isMesh || !node.material.visible) return;
      local.makeEmpty();
      for (let i = 0; i < node.geometry.attributes.position.count; i++) local.expandByPoint(node.getVertexPosition(i, vertex));
      for (let i = 0; i < (node.isInstancedMesh ? node.count : 1); i++) {
        world.copy(node.matrixWorld);
        if (node.isInstancedMesh) { node.getMatrixAt(i, matrix); world.multiply(matrix); }
        expected.union(transformed.copy(local).applyMatrix4(world));
      }
      const cached = measure.cache.get(node);
      if (!initialRecords.has(node)) initialRecords.set(node, {cached, box:cached.box, attributes:cached.attributes, versions:cached.versions, morphs:cached.morphs});
      const first = initialRecords.get(node);
      assert.equal(cached, first.cached); assert.equal(cached.box, first.box);
      assert.equal(cached.attributes, first.attributes); assert.equal(cached.versions, first.versions); assert.equal(cached.morphs, first.morphs);
    });
    assert.ok(box.isEmpty() && expected.isEmpty() || box.min.distanceTo(expected.min) < 1e-10 && box.max.distanceTo(expected.max) < 1e-10,
      `case ${cases}: cached morph bounds did not follow the edited surface`);
    const fast = measure.sampledPlaneDistance(root, normal, origin, point, undefined, true);
    const fastPoint = point.clone(), fastSamples = measure.supportSamples;
    const slow = measure.sampledPlaneDistance(root, normal, origin, point);
    assert.equal(fast, slow, `case ${cases}: measured bounds culled the supporting surface`);
    assert.deepEqual(point, fastPoint, 'pruning changed contact ownership or traversal tie order');
    savedSamples += measure.supportSamples - fastSamples; cases++;
  }
  for (let frame = 0; frame < 180; frame++) {
    near.morphTargetInfluences[0] = (frame % 7) / 7;
    far.morphTargetInfluences[0] = (frame % 11) / 5;
    near.rotation.set(frame * .1, frame * .3, frame * .2);
    far.scale.set(.5 + (frame % 4) * .4, .6 + (frame % 6) * .2, .8);
    far.material.visible = frame % 5 !== 0;
    instances.count = frame % 13 === 0 ? 0 : 3;
    for (let i = 0; i < 3; i++) {
      matrix.makeRotationZ(frame * .07 + i).scale(new THREE.Vector3(.7, 1.3, .8));
      matrix.setPosition(i * .6, i === 0 && frame > 120 ? -3 : 6 + i, .5); instances.setMatrixAt(i, matrix);
    }
    if (frame === 40) { hidden.add(far); hidden.visible = false; }
    if (frame === 60) hidden.visible = true;
    if (frame === 90) { root.remove(near); root.add(far); }
    if (frame === 100) root.add(near);
    normal.set(Math.sin(frame) * .1, 1, Math.cos(frame) * .1).normalize(); compare();
  }
  far.material.visible = true; far.rotation.set(0, 0, 0); far.scale.set(1, 1, 1);
  far.morphTargetInfluences[0] = .5; normal.set(0, 1, 0);
  // Each edit can expose a new lowest point without changing the influence.
  far.geometry.attributes.position = far.geometry.attributes.position.clone();
  far.geometry.attributes.position.setY(0, -40); compare();
  far.geometry.attributes.position.setY(0, -45); far.geometry.attributes.position.needsUpdate = true; compare();
  far.geometry.morphAttributes.position[0] = far.geometry.morphAttributes.position[0].clone();
  far.geometry.morphAttributes.position[0].setY(0, -30); compare();
  far.geometry.morphAttributes.position[0].setY(0, -35); far.geometry.morphAttributes.position[0].needsUpdate = true; compare();
  far.geometry.morphTargetsRelative = false; compare();
  far.geometry.morphAttributes.position.push(far.geometry.attributes.position.clone());
  far.morphTargetInfluences.push(.3); compare();
  far.geometry.morphAttributes.position.pop(); far.morphTargetInfluences.pop(); compare();
  far.geometry = far.geometry.clone(); compare();
  const positions = far.geometry.attributes.position;
  const interleaved = new THREE.InterleavedBuffer(new Float32Array(positions.count * 4), 4);
  for (let i = 0; i < positions.count; i++) for (let c = 0; c < 3; c++) interleaved.array[i * 4 + c + 1] = positions.getComponent(i, c);
  far.geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 1)); compare();
  far.geometry.attributes.position.setY(0, -50); interleaved.needsUpdate = true; compare();
  // Custom vertex deformation cannot use the ordinary cached box to prune.
  const native = far.getVertexPosition;
  far.getVertexPosition = function (i, v) { native.call(this, i, v); v.y -= 100; return v; };
  const fast = measure.sampledPlaneDistance(root, normal, origin, point, undefined, true), fastPoint = point.clone();
  const slow = measure.sampledPlaneDistance(root, normal, origin, point);
  assert.equal(fast, slow); assert.deepEqual(point, fastPoint); cases++;
  measure.measure(root, box, true, false);
  assert.equal(measure.measuredSupportRoot, null, 'ordinary bounds retained a support hierarchy');
  assert.equal(measure.measuredSupportMeshes.length, 0, 'ordinary bounds retained removed support meshes');
  assert.ok(savedSamples > 5000, 'fixture did not exercise skipped morph probes');
  const result = { passed:true, cases, animatedPoses:180, instancedPoses:180, exactDistanceAndContact:true,
    liveAttributeAndMorphEdits:true, warmBoundsRecordsReused:true, savedMorphSamples:savedSamples };
  const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
  if (report) await writeFile(report, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  geometry.dispose(); far.geometry.dispose(); material.dispose(); far.material.dispose();
} finally { await server.close(); }
