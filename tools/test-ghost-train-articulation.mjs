import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createServer} from 'vite';

/** Actual generated surfaces with image decoding omitted in Node. The browser
 * pass separately verifies textures and silhouettes throughout these poses. */
async function measuredAsset(url){
  const file=await readFile(new URL('../public/'+url.replace(/^.*?(ghost-train\/)/,'$1'),import.meta.url));
  const jsonLength=file.readUInt32LE(12),data=JSON.parse(file.subarray(20,20+jsonLength).toString());
  for(const m of data.materials??[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;
    if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
  data.images=[];data.textures=[];data.samplers=[];
  const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
  const tail=file.subarray(20+jsonLength),result=Buffer.alloc(20+padded.length+tail.length);
  result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);
  result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);tail.copy(result,20+padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength),'');
}
const original=GLTFLoader.prototype.load;
GLTFLoader.prototype.load=function(url,onLoad,_progress,onError){measuredAsset(url).then(onLoad,onError);};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}}),visuals=[];
const frame={state:'patrol',stateTime:0,time:0,speed:.95,verticalVelocity:0,grounded:true,alive:true,flung:false};
try{
  const {createGhostEnemyVisual,GhostTrainAssetKit}=await server.ssrLoadModule('/src/ghostTrain.ts');
  const gaze=new THREE.Vector3(3,1.4,6),a=createGhostEnemyVisual('grunt','ghostknight',{height:3.3,lookAt:()=>gaze}),b=createGhostEnemyVisual('grunt','ghostknight');visuals.push(a,b);
  await Promise.all([a.ready,b.ready]);assert.equal(a.diagnostics.status,'ready');assert.ok(a.group.userData.assetReady);
  assert.ok(a.group.userData.ghostTriangles>3000,'real Meshy armour triangles loaded');assert.ok(a.diagnostics.meshes>=10,'independent limb surfaces');
  const stationary=b.group.getObjectByName('ThighL').quaternion.clone(),positions=new Map();let plants=0,maximumError=0;
  for(let i=0;i<360;i++){
    a.group.position.z+=frame.speed/60;a.update(1/60,{...frame,time:i/60});a.group.updateMatrixWorld(true);
    assert.deepEqual(a.group.scale.toArray(),[1,1,1],'animation changed actor scale');
    for(const contact of a.group.userData.ghostFootContacts){
      const name=contact.side<0?'FootL':'FootR',p=a.group.getObjectByName(name).getWorldPosition(new THREE.Vector3());
      if(contact.planted){const expected=new THREE.Vector3(...contact.target);maximumError=Math.max(maximumError,p.distanceTo(expected));plants++;}
      assert.ok(p.y>=-.001,'foot penetrates ground');positions.set(name,p);
    }
  }
  assert.ok(plants>200);assert.ok(maximumError<1e-5,'planted armour feet slide during world motion');
  assert.ok(b.group.getObjectByName('ThighL').quaternion.equals(stationary),'animation changed another instance');
  assert.ok(Math.abs(a.group.getObjectByName('Head').rotation.y)>.1,'armour did not turn its visor toward the player');
  for(let i=0;i<100;i++)a.update(1/60,{...frame,time:10+i/60,alive:false,flung:true,speed:0});
  for(const name of ['Torso','ThighL','ShinL','ForearmL'])assert.deepEqual(a.group.getObjectByName(name).scale.toArray(),[1,1,1],`${name} defeat did not settle`);
  const settled=a.group.getObjectByName('Head').rotation.toArray();a.update(1,{...frame,time:20,alive:false,speed:0});
  assert.deepEqual(a.group.getObjectByName('Head').rotation.toArray(),settled,'defeated armour keeps oscillating');
  a.reset();assert.deepEqual(a.group.scale.toArray(),[1,1,1]);
  const turkey=createGhostEnemyVisual('hopper','ghostfood',{height:2.1,variant:1}),cake=createGhostEnemyVisual('grunt','ghostcake',{height:1.7,variant:0});visuals.push(turkey,cake);
  await Promise.all([turkey.ready,cake.ready]);for(const v of [turkey,cake]){
    assert.equal(v.diagnostics.status,'ready');v.update(.15,{...frame,state:'crouch',stateTime:.35,time:2,speed:0});
    assert.ok(v.group.getObjectByName('Jaw').rotation.x>0,'animatronic jaw is articulated');assert.deepEqual(v.group.scale.toArray(),[1,1,1]);
  }
  assert.ok(turkey.group.getObjectByName('Torso').scale.y<1,'shared jump anticipation compresses turkey body');
  const scene=new THREE.Group(),performer=new THREE.Group();performer.position.z=-7;performer.userData.ghostHeight=3;scene.add(performer);
  const kit=new GhostTrainAssetKit(scene,()=>[performer]),cart=new THREE.Mesh(new THREE.BoxGeometry(3.2,.35,6.2),new THREE.MeshStandardMaterial());cart.position.y=-.175;cart.userData.moverId=0;scene.add(cart);
  const cabin=kit.cart(cart,{t:'mover',dkind:'ghostcart',p:[0,0,0],s:[3.2,.35,6.2]},.35);
  const widths=cart.geometry.parameters;assert.ok(widths.width<2.6&&widths.depth<5.2,'compact interior remains a giant roof collider');
  for(const [i,x]of [-5,0,5].entries())kit.decorate({t:'decor',dkind:'ghostshowlight',p:[x,6,1],to:[0,0,0],color:i===0?'#ffca8b':i===1?'#87dabb':'#8674d6',amp:i===0?120:55,w:.6,rise:28,vr:i});
  kit.decorate({t:'decor',dkind:'ghostshowlight',p:[-2,6,1],to:[0,5,-6],color:'#ffe2ab',amp:130,w:.6,rise:28,vr:0,n:1});
  kit.decorate({t:'decor',dkind:'ghostfood',p:[-4,.1,0],s:[1,2,1],vr:1});
  for(const p of [[5,0,-5],[7,0,-7],[45,0,-5]])kit.decorate({t:'decor',dkind:'ghostwallbay',p,s:[5,5.4,.5]});
  kit.decorate({t:'decor',dkind:'ghostflagstone',p:[10,-.040052*2.4,-10],s:[2.4,.0961,2.15]});
  kit.decorate({t:'decor',dkind:'ghostchandelier',p:[0,8-.98655*3.24,-10],s:[3.24,3.2,3.24]});
  kit.decorate({t:'decor',dkind:'ghostbanquettable',p:[5,.2,-10],s:[2,1.3,4]});
  kit.decorate({t:'decor',dkind:'ghosttrestle',p:[20,-.248*6,-20],s:[2.15,4.5,6]});
  kit.decorate({t:'decor',dkind:'ghostmonsterportal',p:[0,0,-30],s:[8,10,2]});
  const axePivot=new THREE.Group();axePivot.position.set(0,6,0);scene.add(axePivot);kit.axe(axePivot,4.5);
  kit.decorate({t:'decor',dkind:'ghostclockwork',p:[-5,0,-20],w:5,yaw:0});
  kit.decorate({t:'decor',dkind:'ghostarch',p:[40,0,-20],s:[6.2,7.3,1.4]});
  for(const [kind,x]of [['ghostbathwall',-12],['ghostbatharch',12],['ghostjunk',-8],['ghostboiler',8]])kit.decorate({t:'decor',dkind:kind,p:[x,0,-12],yaw:0});
  await kit.ready();kit.update(1/60,new THREE.Vector3(0,0,0));
  assert.deepEqual(kit.diagnostics.showLights,{pool:3,shadowed:1,cues:4,active:3},'fixed indoor show lighting topology');
  assert.deepEqual(kit.diagnostics.lightTargets[0].target,[0,5,-6],'authored high sculpture light was retargeted at the player');
  assert.ok(Math.abs(kit.diagnostics.lightTargets[1].target[2]+7)<1e-6,'colored fill missed the nearest live performer');
  const batches=scene.children.filter(root=>root.userData.ghostStaticAsset);assert.equal(batches.filter(root=>root.userData.ghostStaticAsset.kind==='ghostwallbay').length,2,'nearby wall bays did not share cells');
  let instanceCount=0;for(const root of batches.filter(root=>root.userData.ghostStaticAsset.kind==='ghostwallbay'))root.traverse(mesh=>{if(!mesh.isInstancedMesh)return;instanceCount+=mesh.count;const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);const scale=new THREE.Vector3();matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);assert.ok(scale.distanceTo(new THREE.Vector3(5.4,5.4,5.4))<1e-5,'deep Meshy wall was shrunk to a tiny prop');});
  const wallSource=await measuredAsset('/ghost-train/castle-wall-window-v2.glb');let wallRegions=0;wallSource.scene.traverse(node=>{if(node.isMesh)wallRegions++;});
  assert.equal(instanceCount,3*wallRegions,'Meshy wall placements were duplicated');scene.updateMatrixWorld(true);
  const instanceMaterials=[...kit.instanceMeshes].flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]);
  const glass=instanceMaterials.find(mat=>mat.userData.ghostEmissionRegion==='WindowGlass'),eyes=instanceMaterials.find(mat=>mat.userData.ghostEmissionRegion==='PortalEyes');
  assert.ok(glass?.emissiveIntensity>.5&&eyes?.emissiveIntensity>.5,'source glass/iris regions are not selectively emissive');
  const structural=instanceMaterials.filter(mat=>!mat.userData.ghostEmissionRegion);assert.ok(structural.every(mat=>!mat.emissive||mat.emissive.getHex()===0),'surrounding masonry gained a whole-wall glow');
  assert.ok(kit.diagnostics.candleBounce.power>0,'actual chandelier has no pooled candle illumination');
  const geometryBounds=kind=>new THREE.Box3().setFromObject(batches.find(root=>root.userData.ghostStaticAsset.kind===kind));
  assert.ok(Math.abs(geometryBounds('ghostflagstone').max.y)<1e-5,'flagstone top does not match the native walk plane');
  assert.ok(Math.abs(geometryBounds('ghostchandelier').max.y-8)<1e-4,'chandelier hook does not match the authored ceiling');
  assert.ok(Math.abs(geometryBounds('ghostbanquettable').max.y-1.5)<.012,'table top does not match its supported platform');
  assert.ok(Math.abs(geometryBounds('ghosttrestle').max.y)<.003,'Meshy trestle rails do not match the native rail plane');
  assert.ok(Math.abs(geometryBounds('ghostmonsterportal').max.y-10)<1e-5,'deep monster portal was shrunk to a tiny face');
  const head=new THREE.Box3().setFromObject(axePivot.getObjectByName('Meshy skull axe head')),headCenter=head.getCenter(new THREE.Vector3());assert.ok(Math.abs(headCenter.y-1.5)<1e-5,'Meshy axe head is detached from its lethal bob centre');
  const clock=scene.getObjectByName('Meshy castle clockwork');assert.equal(clock.userData.ghostClockworkRig.sourceTriangles,4478);assert.equal(clock.userData.ghostClockworkRig.parts.length,4,'actual Meshy mechanical parts are not articulated');
  const clockMesh=clock.getObjectByName('ClockMainWheel'),clockSource=await measuredAsset('/ghost-train/castle-clockwork-v2.glb');
  assert.deepEqual(Array.from(clockMesh.geometry.getAttribute('uv').array),Array.from(clockSource.scene.getObjectByName('ClockMainWheel').geometry.getAttribute('uv').array),'clock gear UVs changed during articulation');
  const body=cart.getObjectByName('Ghost train cart');let measured;body.traverse(o=>{if(o.userData.meshyAsset)measured=o;});
  assert.ok(measured&&measured.scale.x===measured.scale.y&&measured.scale.y===measured.scale.z,'Meshy carriage was stretched');
  assert.equal(measured.userData.ghostCartTriangles,2982,'carriage source triangles were replaced or duplicated');
  const wheelRegions=[];measured.traverse(node=>{if(node.userData.ghostCartWheel)wheelRegions.push(node);});assert.equal(wheelRegions.length,4,'four original Meshy wheel regions');
  let renderedCartMeshes=0,cartHalos=0;cart.traverse(node=>{if(node.userData.ghostBillboard)cartHalos++;else if(node.isMesh&&node.visible&&node.material.visible)renderedCartMeshes++;});assert.equal(renderedCartMeshes,7,'carriage has unnecessary mini draws');assert.equal(cartHalos,4,'carriage corner lights need four local glow halos');
  const face=cart.getObjectByName('Actual Meshy demon carriage mask');assert.ok(face?.userData.meshyCartFace);assert.equal(face.userData.sourceTriangles,1396,'carriage lost its genuine Meshy face region');
  const bounds=new THREE.Box3().setFromObject(body),span=bounds.getSize(new THREE.Vector3());assert.ok(Math.abs(span.z-6.2)<.02&&span.y>3,'open cart has believable original proportions');
  const before=cabin.walls[0].clone(),wheelAngle=wheelRegions[0].rotation.x;cart.position.z=.5;kit.update(1/60,new THREE.Vector3());
  assert.ok(Math.abs(cabin.walls[0].min.z-before.min.z-.5)<1e-6,'cabin collision did not move with its car');
  assert.ok(Math.abs(wheelRegions[0].rotation.x-wheelAngle)>.8,'source wheel did not rotate with actual displacement');
  assert.ok(kit.diagnostics.carts[0].uniform,'uniform art transform diagnostic');
  const display=scene.children.find(o=>o.userData.ghostSkin==='ghostfood');const jaw=display.getObjectByName('Jaw');
  const angle=jaw.rotation.x,gearAngle=clock.getObjectByName('ClockMainWheel measured axle').quaternion.clone();kit.update(.4,new THREE.Vector3());assert.notEqual(jaw.rotation.x,angle,'banquet display food is frozen');
  assert.ok(clock.getObjectByName('ClockMainWheel measured axle').quaternion.angleTo(gearAngle)>.1,'actual Meshy gear did not advance its servo step');
  assert.ok(Object.values(kit.diagnostics.assets).every(a=>a.status==='ready'),'one of the fourteen actual Meshy assets failed to load');
  for(let i=0;i<40;i++)kit.decorate({t:'decor',dkind:'ghoststeam',p:[i%5,0,-5-i%3],w:4,rise:2.4,amp:.4,phase:i*.13});
  kit.update(.1,new THREE.Vector3());const steam=scene.getObjectByName('Bounded drifting green steam'),firstCloud=Array.from(steam.instanceMatrix.array);
  assert.equal(steam.count,128,'nearby steam sources must respect the fixed GPU particle budget');
  kit.update(.25,new THREE.Vector3());assert.notDeepEqual(Array.from(steam.instanceMatrix.array),firstCloud,'steam is a frozen billboard');
  kit.update(.1,new THREE.Vector3(1000,0,1000));assert.equal(steam.count,0,'distant steam sources still draw');
  let steamReleased=0;steam.addEventListener('dispose',()=>steamReleased++);
  let released=0;for(const entry of kit.lightPool){if(!entry.light.castShadow)continue;entry.light.shadow.map=new THREE.WebGLRenderTarget(4,4);entry.light.shadow.map.addEventListener('dispose',()=>released++);entry.light.shadow.mapPass=new THREE.WebGLRenderTarget(4,4);entry.light.shadow.mapPass.addEventListener('dispose',()=>released++);}
  let instanceReleased=0;for(const mesh of kit.instanceMeshes)mesh.addEventListener('dispose',()=>instanceReleased++);const instanceDraws=kit.diagnostics.instanceDraws;
  kit.dispose();assert.equal(steamReleased,1,'steam instance buffers leaked');assert.equal(released,2,'indoor shadow render targets leaked');assert.equal(instanceReleased,instanceDraws,'instanced model buffers leaked');assert.equal(scene.children.filter(o=>o.isLight).length,0,'show lights survived level disposal');
  console.log(JSON.stringify({test:'actual Meshy articulation, compact open carriage, moving cabin collisions, staged lights and lifetime',knightTriangles:a.group.userData.ghostTriangles,regionMeshes:a.diagnostics.meshes,plantedSamples:plants,maximumFootError:maximumError,cartBody:span.toArray(),cartInterior:[widths.width,widths.depth],shadowTargetsReleased:released,food:[turkey.group.userData.ghostTriangles,cake.group.userData.ghostTriangles]},null,2));
}finally{for(const v of visuals)v.dispose();GLTFLoader.prototype.load=original;await server.close();}
