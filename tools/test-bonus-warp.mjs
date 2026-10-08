import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {BonusWarpEffect}=await server.ssrLoadModule('/src/bonusWarp.ts');
 const scene=new THREE.Scene();
 for(let cycle=0;cycle<30;cycle++){
  const effect=new BonusWarpEffect(scene,new THREE.Vector3(4,2,-9),cycle%2===0,cycle%3===0);
  assert.ok(effect.group.renderOrder>6,'horizon mist would paint over the warp');
  effect.group.traverse(o=>{if(o.material)assert.equal(o.material.depthTest,true,'warp ignored solid-world occlusion');});
  const resources=new Set(),disposed=new Set();
  effect.group.traverse(o=>{for(const r of [o.geometry,o.material])if(r&&!resources.has(r)){resources.add(r);r.addEventListener('dispose',()=>disposed.add(r));}});
  for(let i=0;i<150;i++){
   effect.update(i/60,Math.min(1,i/60));
   effect.group.traverse(o=>{assert.ok([...o.position,...o.scale,...o.quaternion].every(Number.isFinite));});
  }
  effect.update(.3,.5,true);
  const staticRings=effect.group.children.filter(o=>o.name.startsWith('Bonus orbit ribbon')).map(o=>[...o.position,...o.quaternion,...o.scale,o.visible]);
  assert.equal(staticRings.length,5);
  effect.update(2,.5,true);
  assert.deepEqual(effect.group.children.filter(o=>o.name.startsWith('Bonus orbit ribbon')).map(o=>[...o.position,...o.quaternion,...o.scale,o.visible]),staticRings);
  effect.dispose();assert.equal(scene.children.length,0);assert.equal(disposed.size,resources.size,'travel left GPU geometry/materials behind');
 }
 console.log('PASS 30 warp/arrival lifetimes: finite transforms, static reduced motion, all unique GPU resources disposed');
}finally{await server.close();}
