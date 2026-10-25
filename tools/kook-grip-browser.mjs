import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/grip-check',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
try{
 await page.goto('http://127.0.0.1:5267/grip-check');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {MeshoptDecoder}=await import('/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
  const {rigKookGrip,poseKookGrip}=await import('/src/enemies/kookGrip.ts');
  const asset=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/rooftop-kook/kook-rain.glb');
  const root=asset.scene;root.updateMatrixWorld(true);let mesh;root.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});mesh.skeleton.update();
  const beforeGeometry=mesh.geometry,originalIndices=beforeGeometry.getAttribute('skinIndex'),originalWeights=beforeGeometry.getAttribute('skinWeight'),count=beforeGeometry.getAttribute('position').count;
  const before=Array.from({length:count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()));
  rigKookGrip(root);root.updateMatrixWorld(true);mesh.skeleton.update();
  let maxRestError=0,changedWeights=0,untouchedVertices=0,weightError=0;const afterIndices=mesh.geometry.getAttribute('skinIndex'),afterWeights=mesh.geometry.getAttribute('skinWeight');
  for(let i=0;i<count;i++){
   maxRestError=Math.max(maxRestError,before[i].distanceTo(mesh.getVertexPosition(i,new THREE.Vector3())));
   const same=[0,1,2,3].every(k=>originalIndices.getComponent(i,k)===afterIndices.getComponent(i,k)&&originalWeights.getComponent(i,k)===afterWeights.getComponent(i,k));if(same)untouchedVertices++;else changedWeights++;
   weightError=Math.max(weightError,Math.abs([0,1,2,3].reduce((v,k)=>v+afterWeights.getComponent(i,k),0)-1));
  }
  const unchanged=Object.fromEntries(['position','normal','uv'].map(name=>[name,beforeGeometry.getAttribute(name).array.every((v,i)=>v===mesh.geometry.getAttribute(name).array[i])]));unchanged.triangles=beforeGeometry.index.array.every((v,i)=>v===mesh.geometry.index.array[i]);
  const bones=new Map(mesh.skeleton.bones.map(b=>[b.name,b]));poseKookGrip(bones,1);root.updateMatrixWorld(true);mesh.skeleton.update();
  let deformedVertices=0,maxCurlDisplacement=0,nonFinite=0;
  for(let i=0;i<count;i++){const p=mesh.getVertexPosition(i,new THREE.Vector3()),distance=p.distanceTo(before[i]);if(!p.toArray().every(Number.isFinite))nonFinite++;if(distance>.0001)deformedVertices++;maxCurlDisplacement=Math.max(maxCurlDisplacement,distance);}
  poseKookGrip(bones,0);root.updateMatrixWorld(true);mesh.skeleton.update();let restoredError=0;
  for(let i=0;i<count;i++)restoredError=Math.max(restoredError,before[i].distanceTo(mesh.getVertexPosition(i,new THREE.Vector3())));
  return {count,unchanged,maxRestError,restoredError,changedWeights,untouchedVertices,weightError,deformedVertices,maxCurlDisplacement,nonFinite,rig:mesh.userData.gripRig};
 });
 assert.deepEqual(errors,[]);assert.ok(Object.values(result.unchanged).every(Boolean));assert.ok(result.maxRestError<1e-4&&result.restoredError<1e-4);assert.ok(result.weightError<1e-5);assert.equal(result.nonFinite,0);assert.ok(result.changedWeights>500&&result.changedWeights<5000);assert.ok(result.deformedVertices>500&&result.deformedVertices<=result.changedWeights);assert.equal(result.rig.supplementalJoints,4);
 const out=process.env.KOOK_OUTPUT||'docs/rooftop-kook/rain-enemies';await mkdir(out,{recursive:true});await writeFile(out+'/grip.json',JSON.stringify({result,errors},null,2)+'\n');console.log('PASS native Meshy surface and rest pose preserved, finite reversible grip deformation',JSON.stringify(result));
}finally{await browser.close();}
