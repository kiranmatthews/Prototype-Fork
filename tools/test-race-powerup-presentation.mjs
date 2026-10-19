import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
 const {createRaceItemModel,disposeRaceItemModel}=await server.ssrLoadModule('/src/race/items.ts');
 const {RaceItemEffects,raceTargetRing}=await server.ssrLoadModule('/src/race/effects.ts');
 const {RACE_ITEMS}=await server.ssrLoadModule('/src/race/types.ts');
 const models=[];
 for(const kind of Object.keys(RACE_ITEMS)){
  const a=createRaceItemModel(kind),b=createRaceItemModel(kind);assert.equal(a.children[0].geometry,b.children[0].geometry);
  let disposed=0,triangles=0;a.children[0].geometry.addEventListener('dispose',()=>disposed++);
  a.traverse(o=>{if(!o.isMesh)return;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.ok(o.material.isMeshBasicMaterial&&o.material.userData.gouraud);assert.equal(o.material.map,null);assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});
  assert.ok(triangles<=2400,`${kind} geometry budget`);assert.equal(a.children.length,kind==='shield'?2:1);
  disposeRaceItemModel(a);assert.equal(disposed,0,'Removing one instance preserves shared geometry');
  const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};b.children[0].material.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('normalMatrix'));assert.ok(!shader.fragmentShader.includes('pow('),'Lighting belongs in vertices');
  if(kind==='shield'){assert.notEqual(a.children[1].material,b.children[1].material);a.children[1].material.opacity=.1;assert.notEqual(a.children[1].material.opacity,b.children[1].material.opacity);}
  models.push({kind,triangles,draws:b.children.length});disposeRaceItemModel(b);
 }
 const root=new THREE.Group(),fx=new RaceItemEffects(root),camera=new THREE.PerspectiveCamera();camera.position.set(3,4,8);camera.lookAt(0,0,0);camera.updateMatrixWorld();fx.updateView(camera);
 const mesh=root.children[0],geometry=mesh.geometry,material=mesh.material,position=geometry.attributes.position.array,color=geometry.attributes.color.array,at=new THREE.Vector3(),forward=new THREE.Vector3(0,0,-1);
 const profiles=[];
 for(const kind of Object.keys(RACE_ITEMS)){fx.clear();kind==='shock-shell'?fx.lightning(at):fx.burst(kind,at);fx.wake(kind,at,forward,1);fx.update(1/60);assert.ok(fx.stats.active>0);profiles.push({kind,...fx.stats});}
 for(let i=0;i<500;i++){fx.burst(i%2?'star':'water-bomb',at);fx.wake('mushroom',at,forward,i/24);fx.update(1/120);assert.ok(fx.stats.active<=192);assert.ok(fx.stats.triangles<=4096);assert.equal(fx.stats.draws,1);}
 assert.equal(root.children.filter(o=>o.isMesh).length,1);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(geometry.attributes.position.array,position);assert.equal(geometry.attributes.color.array,color);assert.ok([...position].every(Number.isFinite));
 fx.update(2);assert.equal(fx.stats.active,0);assert.equal(fx.stats.draws,0);assert.equal(root.getObjectByName('lightning strike'),undefined);
 fx.lightning(at);assert.ok(root.getObjectByName('lightning strike'));fx.clear();assert.equal(fx.stats.triangles,0);assert.equal(root.getObjectByName('lightning strike'),undefined);
 const ring=raceTargetRing(0xff0000);assert.equal(ring.geometry.attributes.color.itemSize,4);const alpha=Array.from(ring.geometry.attributes.color.array).filter((_,i)=>i%4===3);assert.ok(Math.min(...alpha)<.001&&Math.max(...alpha)>.99);
 console.log(JSON.stringify({models,profiles,poolStress:500,geometryStable:true,finite:true,expires:true,reset:true,oneEffectDraw:true}));
}finally{await server.close();}
