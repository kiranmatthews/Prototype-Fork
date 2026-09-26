import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { CharacterRigidMeshBatches } = await server.ssrLoadModule('/src/character/rigidMeshBatch.ts');
  const scene = new THREE.Scene(), host = new THREE.Group(), rig = new THREE.Group();
  scene.add(host); host.add(rig);
  host.scale.set(1.18, 1.36, 1.18); host.rotation.set(.3, -.7, .12);
  rig.scale.set(1.4, .7, 1.1); rig.rotation.set(.2, .8, -.3);
  const geometry = new THREE.BoxGeometry(.3, .8, .2);
  const morph = geometry.attributes.position.clone();
  for (let i = 0; i < morph.count; i++) morph.setXYZ(i, morph.getX(i) * .7, 0, morph.getZ(i) * .3);
  geometry.morphAttributes.position = [morph]; geometry.morphTargetsRelative = true;
  const material = new THREE.MeshPhysicalMaterial({ color: 0xc9b59c, roughness: .7 });
  const sources = Array.from({ length: 3 }, (_, i) => {
    const parent = new THREE.Group(); parent.rotation.set(i * .7, i * -.3, i * .25); rig.add(parent);
    parent.scale.set(i === 1 ? -1.2 : 1, .5 + i * .4, 1.3);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(i * .4, .2, 0);
    mesh.castShadow = mesh.receiveShadow = true; mesh.morphTargetInfluences[0] = i * .6;
    mesh.layers.set(2); parent.add(mesh); return mesh;
  });
  const layers = sources.map(mesh => mesh.layers.mask);
  const originalBounds = new THREE.Box3().setFromObject(host);
  const batches = new CharacterRigidMeshBatches(host, sources);
  assert.deepEqual(new THREE.Box3().setFromObject(host), originalBounds, 'palette-space vertices changed authoring camera bounds');
  assert.deepEqual(batches.diagnostics, { enabled: true, sources: 3, batches: 1, savedDrawsPerPass: 2 });
  const proxy = batches.root.children[0];
  assert.equal(proxy.geometry.index.count, geometry.index.count * 3);
  assert.equal(proxy.geometry.morphAttributes.position, undefined);
  assert.equal(proxy.frustumCulled, false);
  assert.equal(proxy.layers.mask, 4);
  const shader = { uniforms: {}, vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>' };
  proxy.material.onBeforeCompile(shader, {});
  const uniforms = shader.uniforms;
  for (let frame = 0; frame < 20; frame++) {
    rig.rotation.z += .05;
    sources[0].parent.scale.y = .4 + frame * .1;
    sources[1].morphTargetInfluences[0] = frame / 8;
    sources[2].parent.visible = frame % 2 === 0;
    scene.updateMatrixWorld(true); proxy.onBeforeRender();
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      assert.equal(uniforms.rigidState.value[i].y, source.parent.visible ? 1 : 0);
      assert.equal(uniforms.rigidState.value[i].x, source.morphTargetInfluences[0]);
      const actual = new THREE.Matrix4().multiplyMatrices(proxy.matrixWorld, uniforms.rigidMatrices.value[i]);
      actual.elements.forEach((value, j) => assert.ok(Math.abs(value - source.matrixWorld.elements[j]) < 1e-12));
      const normal = new THREE.Vector3(.4, .5, .7).normalize();
      const reference = normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(source.matrixWorld));
      const batched = normal.clone().applyMatrix3(uniforms.rigidNormals.value[i])
        .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(proxy.matrixWorld));
      assert.ok(reference.distanceTo(batched) < 1e-12, 'sheared/mirrored normal differs');
      for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
        const point = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, vertex);
        const delta = new THREE.Vector3().fromBufferAttribute(morph, vertex).multiplyScalar(source.morphTargetInfluences[0]);
        const expected = point.clone().add(delta).applyMatrix4(source.matrixWorld);
        const posed = point.clone().add(delta).applyMatrix4(uniforms.rigidMatrices.value[i]).applyMatrix4(proxy.matrixWorld);
        assert.ok(expected.distanceTo(posed) < 1e-12, 'pose/morph geometry differs');
      }
    }
  }
  for (const shadowMaterial of [proxy.customDepthMaterial, proxy.customDistanceMaterial]) {
    const shadowShader = { uniforms: {}, vertexShader: '#include <begin_vertex>' };
    shadowMaterial.onBeforeCompile(shadowShader, {});
    assert.equal(shadowShader.uniforms.rigidMatrices.value, uniforms.rigidMatrices.value);
    assert.match(shadowShader.vertexShader, /rigidMorphDelta \* rigidState/);
  }
  batches.setEnabled(false); assert.deepEqual(sources.map(mesh => mesh.layers.mask), layers);
  batches.setEnabled(true); assert.ok(sources.every(mesh => mesh.layers.mask === 0));
  let geometryDisposed = 0, sourceDisposed = 0, materialDisposed = 0;
  proxy.geometry.addEventListener('dispose', () => geometryDisposed++);
  geometry.addEventListener('dispose', () => sourceDisposed++);
  for (const owned of [proxy.material, proxy.customDepthMaterial, proxy.customDistanceMaterial]) owned.addEventListener('dispose', () => materialDisposed++);
  // Any authoring replacement fails open to the original render hierarchy.
  sources[0].geometry = new THREE.SphereGeometry(.2, 8, 8);
  scene.updateMatrixWorld(true);
  assert.equal(proxy.visible, false);
  assert.deepEqual(sources.map(mesh => mesh.layers.mask), layers);
  batches.dispose(); batches.dispose();
  assert.equal(geometryDisposed, 1); assert.equal(materialDisposed, 3); assert.equal(sourceDisposed, 0);
  assert.equal(batches.root.parent, null);

  const projective = (object, element, value) => {
    object.updateMatrix(); object.matrixAutoUpdate = false; object.matrix.elements[element] = value;
  };
  const unsupportedConstructions = [
    ['ShaderMaterial', () => new THREE.ShaderMaterial(), () => {}],
    ['RawShaderMaterial', () => new THREE.RawShaderMaterial(), () => {}],
    ['projective source', () => new THREE.MeshPhysicalMaterial(), (_host, sources) => projective(sources[0], 3, .125)],
    ['projective host', () => new THREE.MeshPhysicalMaterial(), host => projective(host, 7, -.15)],
    ['nonunit homogeneous source', () => new THREE.MeshPhysicalMaterial(), (_host, sources) => projective(sources[0], 15, 2)],
    ['nonunit homogeneous host', () => new THREE.MeshPhysicalMaterial(), host => projective(host, 15, 2)],
  ];
  for (const [label, makeMaterial, setup] of unsupportedConstructions) {
    const host = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = makeMaterial();
    const sources = [new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material)];
    for (const source of sources) { source.layers.set(2); host.add(source); }
    setup(host, sources);
    const batches = new CharacterRigidMeshBatches(host, sources);
    assert.equal(batches.diagnostics.batches, 0, `${label} incorrectly entered a palette batch`);
    assert.equal(batches.root.children.length, 0, `${label} allocated an unusable render proxy`);
    assert.deepEqual(sources.map(source => source.layers.mask), [4, 4], `${label} suppressed original submission`);
    batches.setEnabled(false); batches.setEnabled(true); batches.dispose();
    assert.deepEqual(sources.map(source => source.layers.mask), [4, 4], `${label} changed original layers on disposal`);
    geometry.dispose(); material.dispose();
  }

  const mutableFixture = () => {
    const scene = new THREE.Scene(), host = new THREE.Group(); scene.add(host);
    const geometry = new THREE.BoxGeometry(.3, .8, .2);
    geometry.morphAttributes.position = [geometry.attributes.position.clone()];
    geometry.morphTargetsRelative = true;
    const material = new THREE.MeshPhysicalMaterial({ color: 0xcab89f, roughness: .7 });
    const sources = [new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material)];
    sources[1].position.x = 1;
    for (const mesh of sources) { mesh.layers.set(2); host.add(mesh); }
    const batches = new CharacterRigidMeshBatches(host, sources), proxy = batches.root.children[0];
    scene.updateMatrixWorld(true);
    assert.equal(batches.diagnostics.batches, 1, 'unchanged fixture invalidated its proxy');
    return { scene, host, geometry, material, sources, batches, proxy };
  };
  const mutations = [
    ['position upload', f => { f.geometry.attributes.position.setX(0, 2); f.geometry.attributes.position.needsUpdate = true; }],
    ['position replacement', f => f.geometry.setAttribute('position', f.geometry.attributes.position.clone())],
    ['position backing array replacement', f => { f.geometry.attributes.position.array = f.geometry.attributes.position.array.slice(); }],
    ['position layout change', f => { f.geometry.attributes.position.itemSize = 2; }],
    ['normal upload', f => { f.geometry.attributes.normal.needsUpdate = true; }],
    ['uv upload', f => { f.geometry.attributes.uv.needsUpdate = true; }],
    ['attribute addition', f => f.geometry.setAttribute('color', f.geometry.attributes.position.clone())],
    ['attribute deletion', f => f.geometry.deleteAttribute('uv')],
    ['index upload', f => { f.geometry.index.setX(0, 1); f.geometry.index.needsUpdate = true; }],
    ['index replacement', f => f.geometry.setIndex(f.geometry.index.clone())],
    ['index removal', f => f.geometry.setIndex(null)],
    ['morph upload', f => { f.geometry.morphAttributes.position[0].setX(0, 3); f.geometry.morphAttributes.position[0].needsUpdate = true; }],
    ['morph attribute replacement', f => { f.geometry.morphAttributes.position[0] = f.geometry.morphAttributes.position[0].clone(); }],
    ['morph array replacement', f => { f.geometry.morphAttributes.position = [...f.geometry.morphAttributes.position]; }],
    ['morph array growth', f => f.geometry.morphAttributes.position.push(f.geometry.morphAttributes.position[0].clone())],
    ['morph mode', f => { f.geometry.morphTargetsRelative = false; }],
    ['draw range count', f => f.geometry.setDrawRange(0, 12)],
    ['draw range start', f => f.geometry.setDrawRange(3, Infinity)],
    ['roughness uniform', f => { f.material.roughness = .25; }],
    ['metalness uniform', f => { f.material.metalness = .6; }],
    ['emissive intensity uniform', f => { f.material.emissiveIntensity = 2; }],
    ['environment intensity uniform', f => { f.material.envMapIntensity = 3; }],
    ['normal scale vector', f => f.material.normalScale.set(2, .5)],
    ['bump scale uniform', f => { f.material.bumpScale = .3; }],
    ['displacement scale uniform', f => { f.material.displacementScale = 2; }],
    ['displacement bias uniform', f => { f.material.displacementBias = .3; }],
    ['environment rotation', f => { f.material.envMapRotation.x = .4; }],
    ['iridescence range array', f => { f.material.iridescenceThicknessRange[1] = 600; }],
    ['shader define addition', f => { f.material.defines.AUTHORED_TEST = 1; }],
    ['depth test flag', f => { f.material.depthTest = false; }],
    ['depth write flag', f => { f.material.depthWrite = false; }],
    ['depth function', f => { f.material.depthFunc = THREE.GreaterDepth; }],
    ['fog flag', f => { f.material.fog = false; }],
    ['color write flag', f => { f.material.colorWrite = false; }],
    ['wireframe flag', f => { f.material.wireframe = true; }],
    ['tone mapping flag', f => { f.material.toneMapped = false; }],
    ['mirror parity change', f => { f.sources[0].scale.x = -1; }],
    ['custom source draw callback', f => { f.sources[0].onBeforeRender = () => {}; }],
    ['custom shader material replacement', f => { f.sources[0].material = new THREE.ShaderMaterial(); }],
    ['raw shader material replacement', f => { f.sources[0].material = new THREE.RawShaderMaterial(); }],
    ['projective source mutation', f => projective(f.sources[0], 11, .2)],
    ['projective host mutation', f => projective(f.host, 3, .2)],
    ['nonunit homogeneous source mutation', f => projective(f.sources[0], 15, 2)],
    ['nonunit homogeneous host mutation', f => projective(f.host, 15, 2)],
  ];
  for (const [label, mutate] of mutations) {
    const fixture = mutableFixture(); mutate(fixture);
    // Preserve the actual authored objects/values; fallback restores submission
    // only and never rolls back an editor's geometry/material changes.
    const geometry = fixture.sources[0].geometry, material = fixture.sources[0].material;
    fixture.scene.updateMatrixWorld(true);
    assert.equal(fixture.batches.diagnostics.batches, 0, `${label} left a stale proxy active`);
    assert.equal(fixture.proxy.visible, false, `${label} did not remove proxy submission`);
    assert.deepEqual(fixture.sources.map(source => source.layers.mask), [4, 4], `${label} failed to restore source layers`);
    assert.equal(fixture.sources[0].geometry, geometry); assert.equal(fixture.sources[0].material, material);
    fixture.batches.setEnabled(false); fixture.batches.setEnabled(true);
    assert.equal(fixture.proxy.visible, false, `${label} reactivated an invalid proxy`);
    fixture.batches.dispose();
    assert.deepEqual(fixture.sources.map(source => source.layers.mask), [4, 4], `${label} changed restored layers on disposal`);
    for (const source of fixture.sources) if (source.material !== fixture.material) source.material.dispose();
    fixture.geometry.dispose(); fixture.material.dispose();
  }
  const live = mutableFixture();
  live.material.color.set(0x98e572); live.material.emissive.set(0x403012); live.material.opacity = .6;
  live.material.visible = false; live.scene.updateMatrixWorld(true);
  assert.equal(live.proxy.material.visible, false);
  live.material.visible = true; live.scene.updateMatrixWorld(true); live.proxy.onBeforeRender();
  assert.equal(live.batches.diagnostics.batches, 1, 'supported live uniforms disabled batching');
  assert.equal(live.proxy.material.visible, true); assert.equal(live.proxy.material.opacity, .6);
  assert.deepEqual(live.proxy.material.color, live.material.color);
  assert.deepEqual(live.proxy.material.emissive, live.material.emissive);
  live.batches.dispose(); live.geometry.dispose(); live.material.dispose();
  console.log(`Character batch mutation audit: ${unsupportedConstructions.length} unsupported constructors bypassed; ${mutations.length} unsupported edits fell back; supported live uniforms retained parity.`);
} finally { await server.close(); }

await withSkateRuntime(async ({ scene, player }) => {
  scene.updateMatrixWorld(true);
  assert.deepEqual(player.characterRenderBatchDiagnostics, { enabled: true, sources: 38, batches: 7, savedDrawsPerPass: 31 });
  player.refreshCharacterBounds();
  const before = player.characterBounds.clone();
  player.setCharacterRenderBatching(false); player.refreshCharacterBounds();
  assert.deepEqual(player.characterBounds, before, 'render proxies changed authored interaction bounds');
  player.setCharacterRenderBatching(true); player.refreshCharacterBounds();
  assert.deepEqual(player.characterBounds, before);
});
console.log('Character rigid batches: affine/mirrored normals, morph poses, shadows, visibility, fallback, bounds and disposal passed.');
