import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { milkBlob, buildMilkGeometry, MILK_VARIANTS, MILK_SIZE, MilkMaterial, setMilkVariant, updateMilkMotion, resetMilkMotion, kickMilkMotion, copyMilkMotion } = await server.ssrLoadModule('/src/milk.ts');
  const shapes = new Set();
  for (let i = 0; i < 1; i++) {
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
    const size = g.boundingBox.getSize(new THREE.Vector3());
    const tipX = [], bulbX = [];
    for (let j = 0; j < p.count; j++) {
      const height = (p.getY(j) - g.boundingBox.min.y) / size.y;
      if (height > .85) tipX.push(p.getX(j));
      if (height > .2 && height < .6) bulbX.push(p.getX(j));
    }
    assert.ok(Math.max(...tipX) - Math.min(...tipX) <
      .65 * (Math.max(...bulbX) - Math.min(...bulbX)), 'milk lost its narrow pulled droplet tip');
    g.dispose();
  }
  assert.equal(shapes.size, 1, 'milk uses one upright resting surface');
  assert.equal(MILK_VARIANTS.length,6);
  const a = milkBlob(MILK_SIZE, 2), b = milkBlob(MILK_SIZE, 2);
  assert.equal(a.children[0].geometry, b.children[0].geometry, 'instances duplicate geometry');
  assert.equal(a.children[0].material, b.children[0].material, 'instances duplicate material');
  assert.equal(a.children[0].geometry.userData.shared, true);
  assert.equal(a.children[0].customDepthMaterial.userData.shared, true);
  setMilkVariant(a, 4); assert.equal(a.userData.milkVariant, 4);
  assert.equal(a.children[0].geometry, b.children[0].geometry,'timing variety duplicated the base geometry');
  const material = new MilkMaterial(), copy = material.clone();
  assert.ok(copy instanceof MilkMaterial); assert.equal(copy.transparent, false); assert.equal(copy.depthWrite, true);
  copy.opacity = .3; assert.equal(material.opacity, 1);
  for (const m of [material, copy]) {
    const shader = { vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader, uniforms: {} };
    m.onBeforeCompile(shader, null);
    assert.match(shader.vertexShader, /normalMatrix \* objectNormal/);
    assert.match(shader.fragmentShader, /vec3 outgoingLight = body/);
    assert.doesNotMatch(shader.fragmentShader, /vec3 outgoingLight = reflectedLight.indirectDiffuse/);
  }
  // Independent timing, no idle slant, elastic release and direction response.
  const zero=new THREE.Vector3(),fast=new THREE.Vector3(25,0,0);
  resetMilkMotion(a);resetMilkMotion(b);
  for(let i=0;i<60;i++){updateMilkMotion(a,zero,1/60);updateMilkMotion(b,zero,1/60);}
  assert.notDeepEqual(a.children[0].morphTargetInfluences,b.children[0].morphTargetInfluences,'idle pulses synchronize');
  assert.ok(a.children[0].quaternion.angleTo(new THREE.Quaternion())<1e-6,'idle drop slants');
  kickMilkMotion(a);assert.ok(a.children[0].morphTargetInfluences[1]>.3,'release lacks initial squash');
  for(let i=0;i<30;i++)updateMilkMotion(a,fast,1/60);
  assert.ok(a.children[0].morphTargetInfluences[0]>.6,'flight lacks extension');
  const tip=new THREE.Vector3(0,1,0).applyQuaternion(a.children[0].quaternion);
  assert.ok(tip.x<-.95,'liquid tip does not trail the flight direction');
  assert.notDeepEqual(a.children[0].morphTargetInfluences,b.children[0].morphTargetInfluences,'one pickup animated its peer');
  copyMilkMotion(a,b);assert.deepEqual(a.children[0].morphTargetInfluences,b.children[0].morphTargetInfluences,'handoff popped the shape');
  for(let i=0;i<300;i++)updateMilkMotion(a,zero,1/60);
  assert.ok(a.children[0].quaternion.angleTo(new THREE.Quaternion())<.001,'drop failed to return upright');
  assert.ok(a.children[0].morphTargetInfluences[0]<.1,'liquid never settled');
  resetMilkMotion(a);assert.ok(a.children[0].morphTargetInfluences.every(x=>x===0),'pool reset retained deformation');
  const released=milkBlob(1,2);resetMilkMotion(released);kickMilkMotion(released);
  for(let frame=0;frame<60;frame++){
    updateMilkMotion(released,new THREE.Vector3(0,frame<30?8:-8,0),1/60,true);
    assert.ok(released.children[0].quaternion.angleTo(new THREE.Quaternion())<1e-8,'crate release rotated the drop');
  }
  assert.ok(released.children[0].morphTargetInfluences[0]>.2,'upright release lost its vertical deformation');
  const samples=[30,60,120].map(hz=>{
    const orb=milkBlob(1,3);resetMilkMotion(orb);kickMilkMotion(orb);
    for(let frame=0;frame<hz*2;frame++)updateMilkMotion(orb,frame<hz?fast:zero,1/hz);
    return orb.children[0].morphTargetInfluences;
  });
  for(const sample of samples)sample.forEach((value,i)=>assert.ok(Math.abs(value-samples[0][i])<1e-6,'liquid timing depends on frame rate'));
  console.log('PASS one shared upright milk drop, closed topology, independent idle pulses, morph normals, release squash, flight stretch/trailing, handoff and settling.');
} finally { await server.close(); }
