// Independent presentation/runtime checks supplement the immutable-course
// oracle in test-carlisle-layout.mjs. No screenshot or renderer mocks count
// as performance evidence; the browser tool records real rendered frames.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';

const fixture=await readFile(new URL('validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
window.location.search=''; // presentation budgets include the full foliage kit
const nativeFetch=globalThis.fetch;globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.fetch=async input=>{
  const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);
  try{return new Response(await readFile(new URL('../public'+new URL(url,'http://headless.invalid').pathname,import.meta.url)));}
  catch{return new Response('',{status:404});}
};
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false}});
let coast,plain;
try{
  const {Level,normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
  const {CARLISLE_COAST_LEVEL:data,CARLISLE_ORIGINAL_INDICES:originals,CARLISLE_CRATES:boxes}=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
  const {resolveLevelAtmosphere}=await server.ssrLoadModule('/src/levelAtmosphere.ts');
  const {JungleAssetKit}=await server.ssrLoadModule('/src/jungleAssets.ts');
  assert.ok(normalizeCustomLevelData(structuredClone(data)),'production coast is editor portable');
  const art=data.components.slice(originals.length+boxes.length);
  assert.ok(art.length>100,'scenery composes the full course');
  assert.ok(art.every(c=>['mesh','decor'].includes(c.t)&&c.solid===false),'all new presentation is explicitly non-colliding');
  assert.ok(art.some(c=>c.cameraCutaway),'foreground cutaways are authored');
  assert.ok(art.some(c=>c.p[2]<-2200)&&art.some(c=>c.p[2]>-100),'presentation reaches spawn and finish');
  assert.equal(data.jungleStyle,'painterly');assert.equal(data.jungleDepthFade,false,'the descending coast remains sunlit below Y=-10');
  assert.equal(data.keepPlayFog,true,'authored depth and residency share the gameplay fog budget');
  const baseline={...structuredClone(data),components:structuredClone(data.components.slice(0,originals.length+boxes.length))};
  plain=new Level(new THREE.Scene(),{id:'coast-collision-baseline',name:baseline.name,data:baseline});
  coast=new Level(new THREE.Scene(),{id:'coast-presentation-proof',name:data.name,data});
  const vec=v=>v.toArray(),bounds=b=>[vec(b.min),vec(b.max)];
  assert.deepEqual(coast.walls.map(bounds),plain.walls.map(bounds),'dressing never adds a wall collider');
  assert.deepEqual(coast.pitBoxes.map(bounds),plain.pitBoxes.map(bounds),'dressing never adds a death volume');
  assert.equal(coast.groundMeshes.length,plain.groundMeshes.length,'presentation never joins support or ledge queries');
  assert.equal(coast.rails.length,plain.rails.length,'presentation never adds grind paths');
  assert.equal(coast.checkpoints.length,14);assert.deepEqual(coast.finishBox,plain.finishBox);
  assert.deepEqual(coast.captureData(),JSON.parse(JSON.stringify(data)),'editor capture keeps every authored component and presentation setting');
  const look=resolveLevelAtmosphere(coast),camera=new THREE.PerspectiveCamera(55,16/9,.1,look.drawDistance);
  const placements=[coast.spawnPos,...coast.checkpoints.map(c=>c.spawnPos)];
  const samples=[];
  for(const feet of placements){
    camera.position.copy(feet).add(new THREE.Vector3(0,6,12));
    coast.updateSceneryView(camera);await coast.prepareJungleAssets();
    const d=coast.jungleAssetDiagnostics;assert.ok(d);
    assert.deepEqual(d.errors,[],'every checkpoint acquires valid scenery');
    assert.equal(d.pendingCells,0,'checkpoint preparation settles all residency jobs');
    assert.ok(d.residentCells>0,'the active shot owns scenery');
    samples.push({...d,position:feet.toArray()});
  }
  assert.ok(samples.every(d=>d.residentCells<d.cells*.65),'the long coast does not retain the whole high-detail course at any checkpoint');
  const first=placements[0];camera.position.copy(first).add(new THREE.Vector3(0,6,12));
  coast.updateSceneryView(camera);await coast.prepareJungleAssets();const returned={...coast.jungleAssetDiagnostics};
  const children=coast.root.children.length;
  for(let frame=0;frame<240;frame++){coast.updateSceneryPresentation(1/60);coast.updateSceneryView(camera);}
  await coast.prepareJungleAssets();
  assert.equal(coast.root.children.length,children,'idle scenery never grows geometry ownership');
  assert.equal(coast.jungleAssetDiagnostics.residentCells,returned.residentCells,'idle residency remains stable');
  assert.equal(coast.jungleAssetDiagnostics.textureMiB,returned.textureMiB,'idle texture allocation remains stable');
  assert.ok(coast.jungleAssetDiagnostics.windTime>returned.windTime,'shared scenery clock advances');
  // Measure rendered arch columns against the actual support underneath.
  // This does not trust the authoring width formula or declared asset size:
  // ray probes use the packed high-detail GLB and the real original floor.
  const archRay=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let archBodyProbes=0;
  for(const arch of art.filter(c=>c.dkind==='coastarch')){
    camera.position.set(arch.p[0],arch.p[1]+5,arch.p[2]+12);
    coast.updateSceneryView(camera);await coast.prepareJungleAssets();coast.root.updateMatrixWorld(true);
    archRay.set(new THREE.Vector3(arch.p[0],100,arch.p[2]),down);archRay.far=100-coast.killY;
    const support=archRay.intersectObjects(coast.groundMeshes,false)[0];assert.ok(support,`${arch.nm}: real original support`);
    const footprint=new THREE.Box3().setFromObject(support.object),half=Math.max(support.point.x-footprint.min.x,footprint.max.x-support.point.x);
    const meshes=[];coast.root.traverse(o=>{if(o.isMesh&&o.visible&&o.userData.jungleAsset==='coastarch')meshes.push(o);});
    assert.ok(meshes.length>0,`${arch.nm}: actual arch geometry is ready`);
    for(const height of [.3,1.3,2.6])for(const dz of [-.15,0,.15])for(const side of [-1,1]){
      archRay.set(new THREE.Vector3(support.point.x,support.point.y+height,arch.p[2]+dz),new THREE.Vector3(side,0,0));
      archRay.far=half+.4;
      assert.equal(archRay.intersectObjects(meshes,false).length,0,`${arch.nm}: rendered column remains beyond the complete playable pad and body clearance`);
      archBodyProbes++;
    }
  }
  assert.equal(archBodyProbes,216,'all twelve actual GLB thresholds have independently measured body clearance');
  // A small same-kind fixture independently exercises the actual near/far
  // render meshes. Cutaway and permanent instances share a cell position:
  // they must still have separate visibility and identical resource leases.
  const kit=new JungleAssetKit(true,false,false,true,'painterly');
  try{
    kit.add({dkind:'coastcliff',p:[0,0,0],s:[16,12,7]});
    kit.add({dkind:'coastcliff',p:[3,0,1],s:[16,12,7],cameraCutaway:true});
    kit.add({dkind:'coastcliff',p:[0,0,110],s:[16,12,7]});
    kit.flush();kit.setView(new THREE.Vector3(0,5,0),100);await kit.ready();
    const meshes=kit.root.children.filter(o=>o.isInstancedMesh);
    assert.equal(meshes.length,6,'three source cells have one actual near and one actual far mesh each');
    const tris=m=>(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
    const pair=z=>meshes.filter(m=>Math.abs(m.position.z-z)<.01).sort((a,b)=>tris(b)-tris(a));
    for(const [high,low] of [pair(0),pair(1),pair(110)]){
      assert.ok(high&&low&&tris(low)<tris(high),'far meshes actually reduce geometry');
      assert.ok(high.material.normalScale.x>0&&high.material.normalScale.y<0,'coast materials retain the GLTF derivative-tangent normal-map Y convention');
      assert.equal(low.castShadow,false,'far scenery cannot multiply the high-detail shadow workload');
      const a=new THREE.Matrix4(),b=new THREE.Matrix4();high.getMatrixAt(0,a);low.getMatrixAt(0,b);
      assert.deepEqual(a.toArray(),b.toArray(),'near/far meshes retain the exact instance transform');
      assert.equal(high.visible!==low.visible,true,'one LOD is visible per cell');
    }
    assert.equal(pair(0)[0].visible,true,'near shot uses authored high geometry');
    assert.equal(pair(110)[1].visible,true,'far shot uses measured reduced geometry');
    const saved=meshes.map(m=>m.visible),resident=kit.diagnostics.residentCells;
    kit.setCutaway(true);
    assert.ok(meshes.filter(m=>m.userData.cameraCutaway).every(m=>!m.visible),'side-scroll hides both LODs of foreground cells');
    assert.ok(pair(0)[0].visible&&pair(110)[1].visible,'permanent same-kind cliffs keep their original LOD visibility');
    assert.equal(kit.diagnostics.residentCells,resident,'cutaway does not mutate scenery ownership');
    kit.setCutaway(false);assert.deepEqual(meshes.map(m=>m.visible),saved,'leaving side-scroll restores exactly the prior LOD state');
    kit.setView(new THREE.Vector3(0,5,110),100);await kit.ready();
    assert.equal(pair(0)[1].visible,true,'camera travel switches the old near cell to far');
    assert.equal(pair(110)[0].visible,true,'camera travel switches the destination to high geometry');
  }finally{kit.dispose();}
  const sceneryRoot=coast.root.getObjectByName('Jungle Ruins modular kit');assert.ok(sceneryRoot);
  coast.dispose();assert.equal(coast.jungleAssetDiagnostics,null,'disposed level releases its scenery owner');
  assert.equal(sceneryRoot.children.length,0,'disposal removes every resident scenery mesh');
  console.log(`PASS Carlisle presentation: ${art.length} non-colliding scenery components, original support/walls/rails/gate, editor capture, 15 source camera locations, ${archBodyProbes} actual GLB arch body-clearance probes, bounded residency, idle ownership and disposal; peak ${Math.max(...samples.map(d=>d.residentCells))}/${samples[0].cells} cells, ${Math.max(...samples.map(d=>d.textureMiB)).toFixed(2)} MiB scenery textures.`);
}finally{coast?.dispose();plain?.dispose();await server.close();}
