import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {createServer} from 'vite';import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});let owner;
try{
 const {COCONUT_CART_RALLY_LEVEL:level}=await server.ssrLoadModule('/src/levels/coconut-cart-rally.ts'),{StadiumLighting}=await server.ssrLoadModule('/src/stadiumLighting.ts');
 owner=new StadiumLighting(level.components);const camera=new THREE.PerspectiveCamera(),lights=owner.root.children.filter(l=>l.isLight),ids=lights.map(l=>l.uuid),seen=new Set();
 assert.equal(lights.length,6);assert.ok(lights.every(l=>l.isSpotLight&&!l.castShadow&&l.decay===2),'Real spotlights illuminate surfaces without six new shadow passes');
 const fixtures=level.components.filter(c=>c.tex==='rally-lamp');assert.equal(fixtures.length,34);assert.equal(level.components.filter(c=>c.tex==='rally-lamp-glow').length,34);
 let previous=new Map(),samples=0,maxSwapIntensity=0;
 for(let s=-24;s<2400;s+=.5){
  camera.position.set(0,32,-s);owner.update(camera);const state=owner.diagnostics,current=new Map();
  assert.equal(state.fixtures,34);assert.equal(state.pool,6);assert.deepEqual(lights.map(l=>l.uuid),ids,'Travel reuses the same six light objects');
  for(const l of state.lights){const key=l.position.join(',');current.set(key,l.intensity);assert.ok([...l.position,...l.target,l.intensity].every(Number.isFinite));assert.ok(l.intensity>=0&&l.intensity<=7500);assert.ok(l.target[1]<l.position[1]-20);if(l.intensity>7000)seen.add(key);}
  for(const [key,power]of previous)if(!current.has(key))maxSwapIntensity=Math.max(maxSwapIntensity,power);
  previous=current;samples++;
 }
 assert.equal(seen.size,34,'Every authored floodlight casts actual light when traversed');assert.equal(maxSwapIntensity,0,'A pool slot changes fixture only after its previous light has faded out');
 let disposed=0;lights.forEach(l=>{const dispose=l.dispose.bind(l);l.dispose=()=>{disposed++;dispose();};});owner.dispose();assert.equal(disposed,6);assert.equal(owner.root.children.length,0);owner=null;
 const report={passed:true,fixtures:34,realSpotlights:6,allFixturesVisited:seen.size,samples,maxSwapIntensity,stableLightObjects:true,newShadowPasses:0,disposed};await writeFile(process.env.STADIUM_LIGHT_REPORT??'/private/tmp/stadium-lighting.json',JSON.stringify(report,null,2));console.log('PASS stadium lighting',JSON.stringify(report));
}finally{owner?.dispose();await server.close();}
