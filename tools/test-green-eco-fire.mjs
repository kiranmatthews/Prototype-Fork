import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';

const server = await createServer({appType:'custom', logLevel:'silent', server:{middlewareMode:true, hmr:false}});
try {
  const {GreenEcoFire} = await server.ssrLoadModule('/src/greenEcoFire.ts');
  const reports = [];
  for (const fps of [30, 60, 120]) {
    const scene = new THREE.Scene(), unrelated = new THREE.Group(); scene.add(unrelated);
    const camera = new THREE.PerspectiveCamera(80, 2, .1, 150);
    camera.position.set(0, 9, 32); camera.lookAt(0, 3, 0); camera.updateMatrixWorld(true);
    const fire = new GreenEcoFire(scene, Array.from({length:7}, (_, i) => ({position:[(i-3)*3,0,0], seed:i+10})));
    let peak = 0, peakTriangles = 0;
    for (let frame = 0; frame < fps * 12; frame++) {
      fire.update(1/fps, camera);
      const d = fire.diagnostics;
      assert.equal(d.visibleVents, 7); assert.ok(d.particles < d.capacity, 'all seven vents fit without exhausting the pool');
      assert.ok(d.batches <= 1); assert.ok(d.drawCallsPerView <= 2);
      peak = Math.max(peak, d.particles); peakTriangles = Math.max(peakTriangles, d.trianglesPerView);
      for (const mesh of fire.root.children) {
        assert.equal(mesh.material.map, null); assert.equal(mesh.material.depthWrite, false);
        assert.equal(mesh.castShadow, false);
        const geometry = mesh.geometry, count = geometry.drawRange.count;
        const index = geometry.index.array, position = geometry.attributes.position.array, color = geometry.attributes.color.array;
        for (let k = 0; k < count; k++) {
          const vertex = index[k];
          assert.ok(Number.isFinite(position[vertex*3]) && Number.isFinite(position[vertex*3+1]) && Number.isFinite(position[vertex*3+2]));
          assert.ok(Number.isFinite(color[vertex*4]) && Number.isFinite(color[vertex*4+1]) && Number.isFinite(color[vertex*4+2]));
          assert.ok(color[vertex*4+3] >= 0 && color[vertex*4+3] <= 1);
        }
      }
    }
    assert.ok(peak > 250, 'the full layered field is actually being exercised');
    // Looking away must stop emission and fully retire existing particles.
    camera.lookAt(0, 9, 100); camera.updateMatrixWorld(true);
    for (let i=0;i<fps*2;i++) fire.update(1/fps,camera);
    assert.equal(fire.diagnostics.visibleVents,0); assert.equal(fire.diagnostics.particles,0);
    camera.lookAt(0,3,0); camera.updateMatrixWorld(true);
    fire.update(1/30,camera); fire.update(1/30,camera);
    assert.ok(fire.diagnostics.particles > 0);
    fire.enabled=false; fire.update(1/60,camera);
    assert.equal(fire.diagnostics.particles,0); assert.equal(fire.root.visible,false);
    fire.enabled=true; fire.update(1/30,camera);
    assert.equal(fire.root.visible,true);
    let geometries=0,materials=0;
    for(const mesh of fire.root.children) {
      mesh.geometry.addEventListener('dispose',()=>geometries++);
      mesh.material.addEventListener('dispose',()=>materials++);
    }
    fire.dispose(); fire.dispose();
    assert.equal(geometries,1); assert.equal(materials,1); assert.deepEqual(scene.children,[unrelated]);
    reports.push({fps,peakParticles:peak,peakTrianglesPerView:peakTriangles,drawCallsPerView:2});
  }
  console.log(JSON.stringify({pass:true,reports}));
} finally {await server.close();}
