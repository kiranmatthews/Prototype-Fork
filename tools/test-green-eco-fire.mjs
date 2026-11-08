import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createServer} from 'vite';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false}});
const near=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
try {
  const {GreenEcoMotion}=await server.ssrLoadModule('/src/greenEcoMotion.ts');
  const {GreenEcoFire}=await server.ssrLoadModule('/src/greenEcoFire.ts');
  // Source-equation checks, independent of the drawing implementation.
  const motion=new GreenEcoMotion(19);
  motion.step();
  const root=motion.orbiters.find(o=>o.timer>0);
  assert.ok(root);assert.equal(root.born,false);assert.equal(root.age,5);
  assert.ok(root.vy*300>=2 && root.vy*300<=3.000001);
  motion.step();
  assert.equal(root.born,true);
  assert.ok(root.radius>=.2 && root.radius<=.8);
  assert.ok(root.omegaVelocity*300>=Math.PI*2 && root.omegaVelocity*300<=Math.PI*4+.000001);
  assert.ok(root.particle.size>=.3 && root.particle.size<=.6);
  near(Math.hypot(root.particle.x-root.x,root.particle.y-root.y,root.particle.z-root.z),root.radius);
  const head={x:root.particle.x,y:root.particle.y,z:root.particle.z};
  motion.step();
  const trail=motion.particles.find(p=>p.alive && p.kind==='hotdot');
  assert.ok(trail);near(trail.x,head.x);near(trail.z,head.z);
  near(trail.y,head.y-.00100000005);
  near(trail.size,.2-.003030303);near(trail.r,255-2.8333333*5);
  assert.equal(trail.a,96);
  // Keep this particle alive long enough to exercise launcher 208's red stop.
  trail.timer=600;
  for(let i=0;i<17;i++)motion.step(false);
  const stoppedRed=trail.r;assert.equal(trail.fadeR,0);
  for(let i=0;i<5;i++)motion.step(false);
  near(trail.r,stoppedRed);assert.equal(trail.a,96);
  near(trail.vy,-.00020000001*23);
  near(trail.y,head.y-.00020000001*5*23*24/2);
  let sawRelaunch=false;
  for(let i=0;i<150;i++) {
    motion.step(false);
    if(root.particle.fadeA!==0) {sawRelaunch=true;near(root.particle.fadeA,-.8466667);assert.equal(root.particle.fadeR,0);}
  }
  assert.ok(sawRelaunch);assert.equal(root.particle.alive,false);
  const reports=[], fingerprints=[];
  // The stub supplies only browser image loading; it does not change simulation.
  const nativeLoad=THREE.TextureLoader.prototype.loadAsync;
  let disposedTextures=0;
  THREE.TextureLoader.prototype.loadAsync=async function(){
    const texture=new THREE.Texture();texture.addEventListener('dispose',()=>disposedTextures++);return texture;
  };
  const packed=fire=>fire.root.children.map(mesh=>{
    const geometry=mesh.geometry,count=geometry.instanceCount;
    return ['instancePositionSize','instanceRGBA','instanceRoll'].map(name=>{
      const attribute=geometry.getAttribute(name);
      return Array.from(attribute.array.slice(0,count*attribute.itemSize));
    });
  });
  try {
    for(const fps of [30,60,120]) {
      const scene=new THREE.Scene(),unrelated=new THREE.Group();scene.add(unrelated);
      const camera=new THREE.PerspectiveCamera(80,2,.1,150);
      camera.position.set(0,9,32);camera.lookAt(0,3,0);camera.updateMatrixWorld(true);
      const fire=new GreenEcoFire(scene,Array.from({length:7},(_,i)=>({position:[(i-3)*3,0,0],seed:i+10})));
      assert.throws(()=>fire.rendering='original',/Load local/);
      let peak=0,peakTriangles=0;
      for(let frame=0;frame<fps*12;frame++) {
        fire.update(1/fps,camera);
        const d=fire.diagnostics;
        assert.equal(d.visibleVents,7);assert.ok(d.particles<d.capacity);assert.equal(d.dropped,0);
        assert.ok(d.batches<=3);assert.ok(d.drawCallsPerView<=3);
        peak=Math.max(peak,d.particles);peakTriangles=Math.max(peakTriangles,d.trianglesPerView);
        if(frame%fps===0)for(const mesh of fire.root.children) {
          assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.forceSinglePass,true);
          assert.equal(mesh.castShadow,false);assert.equal(mesh.material.blending,THREE.AdditiveBlending);
          const geometry=mesh.geometry,count=geometry.instanceCount;
          for(const name of ['instancePositionSize','instanceRGBA','instanceRoll']) {
            const attr=geometry.getAttribute(name);
            for(let k=0;k<count*attr.itemSize;k++)assert.ok(Number.isFinite(attr.array[k]));
          }
        }
      }
      assert.ok(peak>3000,'full seven-vent graph must include its hundreds of tiny trails per vent');
      assert.equal(fire.diagnostics.clock300Hz,3600);
      fingerprints.push(createHash('sha256').update(JSON.stringify(packed(fire))).digest('hex'));
      fire.paused=true;const before=packed(fire),clock=fire.diagnostics.clock300Hz;
      await fire.loadSourceTextures('/test-textures');fire.rendering='original';fire.update(1/30,camera);
      assert.deepEqual(packed(fire),before,'renderer switch must preserve every particle field');
      assert.equal(fire.diagnostics.clock300Hz,clock);
      assert.equal(fire.diagnostics.trianglesPerView,fire.diagnostics.particles*2);
      assert.equal(fire.diagnostics.textures,3);
      fire.rendering='gouraud';fire.update(1/30,camera);
      assert.deepEqual(packed(fire),before);assert.equal(fire.diagnostics.textures,0);
      fire.paused=false;
      camera.lookAt(0,9,100);camera.updateMatrixWorld(true);
      for(let i=0;i<fps*3;i++)fire.update(1/fps,camera);
      assert.equal(fire.diagnostics.visibleVents,0);assert.equal(fire.diagnostics.particles,0);
      camera.lookAt(0,3,0);camera.updateMatrixWorld(true);fire.update(1/30,camera);
      assert.ok(fire.diagnostics.particles>0);
      fire.enabled=false;fire.update(1/60,camera);
      assert.equal(fire.diagnostics.particles,0);assert.equal(fire.root.visible,false);
      fire.enabled=true;fire.update(1/30,camera);assert.equal(fire.root.visible,true);
      let geometries=0,materials=0;
      for(const mode of ['original','gouraud']) {
        fire.rendering=mode;
        for(const mesh of fire.root.children) {
          mesh.geometry.addEventListener('dispose',()=>geometries++);
          mesh.material.addEventListener('dispose',()=>materials++);
        }
      }
      fire.dispose();fire.dispose();
      assert.equal(geometries,6);assert.equal(materials,6);assert.deepEqual(scene.children,[unrelated]);
      reports.push({fps,peakParticles:peak,peakTrianglesPerView:peakTriangles,drawCallsPerView:3});
    }
  } finally {THREE.TextureLoader.prototype.loadAsync=nativeLoad;}
  assert.equal(disposedTextures,9);
  assert.equal(new Set(fingerprints).size,1,'30/60/120 Hz produce identical source-clock particle state');
  console.log(JSON.stringify({pass:true,sourceEquations:true,rendererSwitchPreservesState:true,fingerprints,reports}));
} finally {await server.close();}
