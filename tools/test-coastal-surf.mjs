import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
globalThis.window={location:{search:'?lite'},addEventListener(){}};
globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const load=THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load=function(_url,ready){const t=new THREE.Texture();queueMicrotask(()=>ready?.(t));return t;};
try{
 const {createShoreField,sampleSurf,sampleRunup,SURF_DEFAULTS}=await server.ssrLoadModule('/src/coastalSurf.ts');
 const {UnityOcean}=await server.ssrLoadModule('/src/unityOcean.ts');
 const {refineStandingWater,isStandingWater}=await server.ssrLoadModule('/src/standingWater.ts');
 const {migrateCustomLevel,parseCustomLevelJson:parseCustomLevel,BUILTIN_LEVELS}=await server.ssrLoadModule('/src/level.ts');
 const geometry=new THREE.PlaneGeometry(40,50,20,25);geometry.rotateX(-Math.PI/2);
 const pos=geometry.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,-pos.getX(i)*.14);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.updateMatrixWorld(true);
 const bounds=new THREE.Box3(new THREE.Vector3(-20,-5,-25),new THREE.Vector3(20,5,25));
 const field=createShoreField([mesh],0,bounds);
 assert.ok(field.segments>20);assert.ok(field.texture.image.width<=1024&&field.texture.image.height<=1024);
 for(const z of [-20,-5,0,17]){
  assert.ok(field.sample(4,z).distance>3,'sea must have positive distance');
  assert.ok(field.sample(-4,z).distance<-3,'land must have negative distance');
  assert.ok(field.sample(4,z).nx>.99,'shore directions must point offshore');
  assert.ok(Math.abs(field.sample(4,z).slope-.14)<.01);
  assert.ok(Math.abs(field.sample(4,z).depth-.56)<.002,'field must retain real seabed depth');
 }
 const near=Array.from({length:72},(_,i)=>sampleSurf(3,3,0,i/10,SURF_DEFAULTS).height);
 assert.ok(Math.max(...near)-Math.min(...near)>.15,'surf must move rather than tint a fixed strip');
 assert.equal(sampleSurf(32,32,0,1,SURF_DEFAULTS).influence,0,'breakers must fade offshore');
 for(let t=0;t<8;t+=.1){assert.ok(sampleSurf(.1,.1,0,t,SURF_DEFAULTS).height<.07,'breaker height must be depth limited');}
 const runup=Array.from({length:72},(_,i)=>sampleRunup(0,0,i/10,SURF_DEFAULTS));
 assert.ok(Math.max(...runup)>1.5&&Math.min(...runup)<.002,'runup must advance and drain');
 const ocean=new UnityOcean({seaLevel:0,shore:[{x:0,z:25,sx:1,sz:0},{x:0,z:-25,sx:1,sz:0}],shoreDirX:1,shoreDirZ:0,terrainHeight:()=>-4,course:[],quality:'lite'});
 ocean.setShoreGeometry([mesh]);assert.ok(ocean.stats.shoreContourSegments>20);
 const first=ocean.surfUniforms;assert.equal(first.time,ocean.surfUniforms.time);
 const samples=Array.from({length:100},(_,i)=>ocean.sampleWaterSurface(26,-3,i/7));
 assert.ok(Math.max(...samples.map(s=>s.height))-Math.min(...samples.map(s=>s.height))>.5,'open sea must have broad rolling swells');
 for(const s of samples){assert.ok(Object.values(s).every(Number.isFinite));assert.ok(Math.abs(Math.hypot(s.nx,s.ny,s.nz)-1)<1e-9);assert.ok(s.ny>.7);assert.ok(Math.hypot(s.displacementX,s.displacementZ)<.5,'horizontal motion must stay bounded');}
 const before=ocean.sampleWaterSurface(4,0,2);ocean.setQuality('full');assert.deepEqual(ocean.sampleWaterSurface(4,0,2),before,'full/lite must share gameplay heights');
 let disposed=0;const texture=ocean.oceanMaterial.uniforms.uCoastMap.value;texture.addEventListener('dispose',()=>disposed++);
 ocean.setShoreGeometry([mesh]);assert.equal(disposed,1,'rebuild must free old field');const replacement=ocean.oceanMaterial.uniforms.uCoastMap.value;replacement.addEventListener('dispose',()=>disposed++);
 ocean.dispose();ocean.dispose();assert.equal(disposed,2,'each field must dispose exactly once');
 const rectangle=new THREE.PlaneGeometry(30,24).rotateX(-Math.PI/2),refined=refineStandingWater(rectangle);
 assert.ok(refined.getAttribute('position').count>100);refined.computeBoundingBox();assert.equal(refined.boundingBox.min.x,-15);refined.dispose();
 const triangle=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,9,0,0,0,0,9],3));triangle.computeVertexNormals();const shaped=refineStandingWater(triangle);
 const shapedPos=shaped.getAttribute('position');for(let i=0;i<shapedPos.count;i++)assert.ok(shapedPos.getX(i)+shapedPos.getZ(i)<=9.00001,'refinement must preserve custom outline');shaped.dispose();
 const component={t:'mesh',p:[0,0,0],vertices:[0,0,0,4,0,0,0,0,-4],indices:[0,2,1],solid:false,tex:'solid',nm:'Standing service-well water'};
 const data=migrateCustomLevel({v:1,name:'Water roundtrip',spawn:[0,1,0],killY:-10,components:[component,{t:'gate',p:[0,1,-8]}]});
 assert.equal(data.components[0].materialStyle,'water');assert.ok(parseCustomLevel(JSON.stringify(data)));assert.deepEqual(migrateCustomLevel(structuredClone(data)),data);
 const invalid=structuredClone(data);invalid.components[0].solid=true;assert.equal(parseCustomLevel(JSON.stringify(invalid)),null,'water tags must not change solid physics');
 for(const id of ['drowned-crown','waterpark']){
  const entry=BUILTIN_LEVELS.find(e=>e.id===id);const pieces=entry.data.components.filter(isStandingWater);assert.ok(pieces.length>0,id+' must include tagged water');
  assert.ok(pieces.every(c=>c.materialStyle==='water'),'new source water should carry the persistent material tag');
 }
 const {RECOVERED_WATERPARK_LEVEL}=await server.ssrLoadModule('/src/levels/waterpark-cup-base.ts');
 assert.equal(RECOVERED_WATERPARK_LEVEL.components.filter(isStandingWater).length,3,'recovered editor wells must retain their new material');
 assert.equal(BUILTIN_LEVELS.find(e=>e.id==='waterpark-cup').data.components.filter(isStandingWater).length,0,'drained competition must remain drained');
 const creek=BUILTIN_LEVELS.find(e=>e.id==='custard-creek');
 assert.ok(creek.data.components.filter(isStandingWater).length>=8,'every creek reach must use the shared water material');
 const {GhostAtmosphere}=await server.ssrLoadModule('/src/ghostAtmosphere.ts');
 const ghostRoot=new THREE.Group(),atmosphere=new GhostAtmosphere(ghostRoot);
 atmosphere.add({t:'decor',dkind:'ghostslime',p:[0,0,0],s:[4,.01,8]});
 const bath=ghostRoot.getObjectByName('Glowing stagnant bath water');
 assert.ok(bath.geometry.attributes.position.count>4&&bath.geometry.attributes.position.count<=4225);
 const green=bath.material.uniforms.tint.value.clone();atmosphere.update(.25,new THREE.Vector3());
 assert.equal(bath.material.uniforms.time.value,.25);assert.ok(bath.material.uniforms.tint.value.equals(green));
 atmosphere.dispose();assert.equal(ghostRoot.children.length,0);
 field.texture.dispose();geometry.dispose();mesh.material.dispose();
 console.log('PASS coastline signs/directions/slope, depth-limited moving surf/runup, bounded rolling waves, full/lite CPU invariance, field lifetime, exact water outlines and source/editor migration');
}finally{THREE.TextureLoader.prototype.load=load;await server.close();}
