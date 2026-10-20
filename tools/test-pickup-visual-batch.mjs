import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import * as THREE from 'three';
const cacheDir=await mkdtemp(join(tmpdir(),'pickup-batch-'));
const server=await createServer({configFile:false,cacheDir,appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {milkBlob,updateMilkMotion,kickMilkMotion,MILK_SIZE}=await server.ssrLoadModule('/src/milk.ts');
 const {PickupVisualBatch}=await server.ssrLoadModule('/src/pickupVisualBatch.ts');
 const root=new THREE.Group();root.position.set(7,-3,11);root.rotation.y=.22;root.scale.set(1.1,.9,1.3);
 const positions=[[-72,-5,203],[-70,-5,202],[-69,-5,201],[-68,-5,200],[1002,2,-180],[1004,2,-179],[1006,2,-178],[40,4,200]];
 const pickups=positions.map((p,i)=>{const mesh=milkBlob(MILK_SIZE,i);mesh.position.set(...p);root.add(mesh);return{mesh,alive:true,box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...p),new THREE.Vector3(1.2,1.5,1.2))};});
 const originalBoxes=pickups.map(p=>p.box.clone()),native=pickups.map(p=>p.mesh.children[0]);
 const originalMotion=()=>native.map(mesh=>[mesh.quaternion.toArray(),mesh.morphTargetInfluences.slice()]);
 const resources=new Map();for(const resource of [native[0].geometry,native[0].material,native[0].customDepthMaterial]){resources.set(resource,0);resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));}
 const batch=new PickupVisualBatch(root,pickups);assert.deepEqual({...batch.diagnostics},{cells:2,capacity:7,visible:7,morphBytes:196});
 assert.equal(native[7].visible,true,'singleton should keep its ordinary draw');
 const tableOwners=batch.cells.map(c=>c.mesh.morphTexture),capacities=tableOwners.map(t=>t.image.data.length),disposals=new Map();
 for(const cell of batch.cells)for(const resource of [cell.mesh,cell.mesh.morphTexture]){disposals.set(resource,0);resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)+1));}
 const validate=()=>{
  const before=originalMotion();batch.sync();assert.deepEqual(originalMotion(),before,'presentation changed motion state');
  assert.deepEqual(pickups.map(p=>p.box),originalBoxes,'pickup contact bounds changed');
  for(const [ci,cell]of batch.cells.entries()){
   assert.equal(cell.mesh.geometry,native[0].geometry);assert.equal(cell.mesh.material,native[0].material);
   assert.equal(cell.mesh.morphTexture,tableOwners[ci]);assert.equal(tableOwners[ci].image.data.length,capacities[ci]);
   const active=cell.rows.filter(r=>r.pickup.alive&&r.pickup.mesh.visible);assert.equal(cell.mesh.count,active.length);
   assert.equal(cell.mesh.visible,active.length>0);
   const reconstructed=new THREE.Mesh(cell.mesh.geometry,cell.mesh.material),matrix=new THREE.Matrix4(),a=new THREE.Vector3(),b=new THREE.Vector3();
   for(const [i,row]of active.entries()){
    assert.equal(row.body.visible,false,'native body would draw twice');
    cell.mesh.getMatrixAt(i,matrix);matrix.premultiply(cell.mesh.matrixWorld);cell.mesh.getMorphAt(i,reconstructed);
    for(let weight=0;weight<6;weight++)assert.ok(Math.abs(reconstructed.morphTargetInfluences[weight]-row.body.morphTargetInfluences[weight])<1e-7,'morph weight changed');
    for(const vertex of [0,57,151,389,600]){
     row.body.getVertexPosition(vertex,a).applyMatrix4(row.body.matrixWorld);
     reconstructed.getVertexPosition(vertex,b).applyMatrix4(matrix);
     assert.ok(a.distanceTo(b)<.00001,'deformed world-space vertex changed');
     const local=b.clone().applyMatrix4(cell.mesh.matrixWorld.clone().invert());
     assert.ok(local.distanceTo(cell.mesh.boundingSphere.center)<=cell.mesh.boundingSphere.radius+.00001,'deformation escaped culling bounds');
    }
   }
  }
 };
 for(let frame=0;frame<25;frame++){
  for(const [i,p]of pickups.entries()){if(frame===0)kickMilkMotion(p.mesh,.2+i*.1);updateMilkMotion(p.mesh,new THREE.Vector3(i*2,3,-i),1/60);p.mesh.position.y+=Math.sin(frame+i)*.01;}
  validate();
 }
 pickups[1].alive=false;pickups[1].mesh.visible=false;pickups[2].mesh.visible=false;validate();assert.equal(batch.diagnostics.visible,5);
 for(const p of pickups){p.alive=false;p.mesh.visible=false;}validate();assert.equal(batch.diagnostics.visible,0);
 for(const p of pickups){p.alive=true;p.mesh.visible=true;}validate();assert.equal(batch.diagnostics.visible,7);
 pickups[0].mesh.position.x+=35;validate(); // moved authoring/runtime source remains covered
 batch.dispose();batch.dispose();batch.sync();
 assert.equal(batch.root.parent,null);assert.equal(batch.diagnostics.cells,0);
 assert.ok(native.every(mesh=>mesh.visible),'native visibility was not restored');
 assert.ok([...resources.values()].every(n=>n===0),'batch disposed shared fruit art');
 assert.ok([...disposals.values()].every(n=>n===1),'owned instance/morph resources were not disposed once');
 // Verify the Level integration stays opt-in and leaves native editor data
 // and picking meshes available in every editor build.
 const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
 new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
 const api=await server.ssrLoadModule('/src/level.ts');
 for(const editing of [false,true])for(const crown of [false,true]){
  api.setEditorBuild(editing);
  const fruit=[{t:'wumpa',p:[-1,1,2]},{t:'wumpa',p:[-2,1,3]}];
  const data={v:1,name:'Pickup presentation ownership',spawn:[0,1,0],killY:-20,
   ...(crown?{atmosphere:{profile:'drowned-crown'}}:{}),components:[{t:'platform',p:[0,-.5,0],s:[10,1,10]},...fruit,{t:'gate',p:[0,0,-3]}]};
  const level=new api.Level(new THREE.Scene(),{id:'pickup-batch-fixture',name:data.name,data});
  assert.equal(!!level.pickupVisualBatch,crown&&!editing);
  assert.deepEqual(level.captureData().components.filter(c=>c.t==='wumpa'),fruit);
  assert.ok(level.pickups.every(p=>p.mesh.children[0].visible===!(crown&&!editing)));
  if(level.pickupVisualBatch){
   level.pickups[0].alive=false;level.pickups[0].mesh.visible=false;
   level.updateSceneryView(new THREE.PerspectiveCamera());
   assert.equal(level.pickupVisualBatch.diagnostics.visible,1,'current-view preparation missed collection');
  }
  level.dispose();assert.equal(level.pickupVisualBatch,null);
 }
 api.setEditorBuild(false);
 assert.ok([...resources.values()].every(n=>n===0),'Level teardown disposed shared fruit art');
 console.log('PASS pickup batches: animated world vertices/normals inputs, individual morph weights, culling, collection/hiding, full depletion, respawn, moved sources, singleton fallback and exact owned-resource disposal.');
}finally{await server.close();await rm(cacheDir,{recursive:true,force:true});}
