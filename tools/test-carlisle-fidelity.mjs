// Gameplay and native geometry proof for the fidelity rebuild. The immutable
// original supplies encounter positions and heights, not a rectangular shape
// requirement. Real gameplay-camera review against Tiki Pits remains mandatory.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';

const original=JSON.parse(await readFile(new URL('carlisle-coast/original-course.json',import.meta.url),'utf8'));
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const removed=new Set([1,...range(20,30),...range(71,86),...range(121,123),175,176,...range(242,253),276,490,493,499,502]);
const expectedIndices=original.data.components.map((_,i)=>i).filter(i=>!removed.has(i)&&!['crate','comboorb'].includes(original.data.components[i].t));
const expected=expectedIndices.map(i=>original.data.components[i]);
const json=v=>JSON.parse(JSON.stringify(v));
const presentation=new Set(['nm','tex','color','invisible','cameraCutaway','dkind','depthBias']);
const gameplay=c=>Object.fromEntries(Object.entries(c).filter(([key])=>!presentation.has(key)));
assert.equal(expected.length,287,'independent original retained encounter inventory');

const harness=await readFile(new URL('validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
window.location.search='';
const nativeFetch=globalThis.fetch;globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.fetch=async input=>{
 const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);
 try{return new Response(await readFile(new URL('../public'+new URL(url,'http://headless.invalid').pathname,import.meta.url)));}
 catch{return new Response('',{status:404});}
};
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false}});
let oracle,coast;
try{
 const {Level,normalizeCustomLevelData,normalizeUserLevelEntries}=await server.ssrLoadModule('/src/level.ts');
 const {CARLISLE_COAST_LEVEL:data,CARLISLE_ORIGINAL_INDICES:indices,CARLISLE_CRATES:boxes}=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 const {CONST}=await server.ssrLoadModule('/src/tuning.ts');
 assert.deepEqual(indices,expectedIndices,'all original encounters remain in original order');
 assert.deepEqual(data.spawn,original.data.spawn,'original spawn');
 assert.equal(data.killY,original.data.killY,'original death height');
 const normalizedData=normalizeCustomLevelData(json(data));
 assert.ok(normalizedData,'native terrain obeys editor/runtime geometry contract');
 const {isOriginalTestCourse}=await server.ssrLoadModule('/src/levels/carlisleLegacy.ts');
 const pristine={id:'test',name:data.name,data:normalizedData};
 assert.ok(isOriginalTestCourse(pristine),'normalized current published source follows builtin');
 const edited=structuredClone(pristine);edited.data.components[0].p[0]+=.01;
 assert.equal(isOriginalTestCourse(edited),false,'tiny authored edit remains local');
 const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
 assert.ok(normalizeUserLevelEntries(pack.levels),'published pack is importable');
 assert.deepEqual(pack.levels.find(e=>e.id==='test')?.data,json(data),'published Carlisle matches the source');
 const sculpted=[];
 for(let j=0;j<expected.length;j++){
  const old=expected[j],now=data.components[j],index=indices[j];
  if(['platform','ramp'].includes(old.t)&&old.tex!=='wood'){
   // Static native surfaces can retain a deliberate technical deck such as
   // the halfpipe floor. The majority must be genuinely sculpted solids.
   if(now.t==='mesh'){
    assert.notEqual(now.solid,false,`#${index}: sculpted terrain is the collision authority`);
    assert.notEqual(now.invisible,true,`#${index}: sculpted solid is visible`);
    assert.deepEqual(now.p,old.p,`#${index}: retained authoring centre`);
    assert.ok(now.vertices?.length>60&&now.indices?.length>60,`#${index}: actual authored topology`);
    assert.notEqual(now.edgeGrinding,false,`#${index}: sculpted platforms retain default grinding`);
    assert.ok(now.grindTopTriangles>0&&now.grindTopTriangles<=now.indices.length/3,`#${index}: only the measured cap defines the rim`);
    sculpted.push({j,index,old,now});continue;
   }
  }
  if(old.t==='wall'){
   // Original boundary proxies may be hidden inside the new rock mass.
   const a=gameplay(json(old)),b=gameplay(json(now));
   if(index===69){a.p[0]=b.p[0];a.s[0]=b.s[0];assert.ok(b.p[0]-b.s[0]/2<=-7&&b.p[0]+b.s[0]/2>=7,'rear boundary spans the original route');}
   assert.deepEqual(b,a,`#${index}: retained boundary proxy`);continue;
  }
  const a=gameplay(json(old)),b=gameplay(json(now));
  if(index===95){a.rise=4.5;assert.equal(now.arc??90,90,'redesigned channel keeps the analytic ninety-degree transition');assert.equal(now.w,3,'flat channel remains six metres wide');}
  if(index===132){assert.deepEqual(b.pts.filter((_,i)=>[0,2,4,5].includes(i)),a.pts,'hill rail keeps original anchors');a.pts=b.pts;}
  assert.deepEqual(b,a,`#${index} ${old.t}: immutable encounter dimensions, position and timing`);
 }
 assert.ok(sculpted.length>=40,'a complete native terrain rebuild replaces the dominant rectangle supports');
 assert.equal(sculpted.filter(s=>s.old.t==='ramp').length,9,'all nine slopes have genuine native terrain');
 assert.equal(data.components.filter(c=>c.t==='crate').length,boxes.length,'one retained authored crate pass');
 assert.equal(data.components.filter(c=>c.t==='checkpoint').length,14,'all checkpoints');
 assert.equal(data.components.filter(c=>c.t==='enemy').length,28,'all original enemies');
 assert.equal(data.components.filter(c=>c.t==='gate').length,1,'one original finish gate');
 assert.equal(data.components.filter(c=>c.t==='zone').length,1,'one original side-scroll travel frame');

 oracle=new Level(new THREE.Scene(),{id:'carlisle-original-support-oracle',name:'Original support oracle',data:{...json(original.data),components:json(expected)}});
 coast=new Level(new THREE.Scene(),{id:'carlisle-fidelity-proof',name:data.name,data});
 await coast.prepareJungleAssets();oracle.root.updateMatrixWorld(true);coast.root.updateMatrixWorld(true);
 assert.deepEqual(coast.captureData(),json(data),'editor capture preserves the authored sculpted geometry');
 assert.ok(coast.jungleAssetDiagnostics,'streamed scenery diagnostics');
 assert.deepEqual(coast.jungleAssetDiagnostics.errors,[],'all authored scenery loads');
 assert.equal(coast.jungleAssetDiagnostics.ready,coast.jungleAssetDiagnostics.placements,'camera-free proof loads every authored placement');

 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floor=(level,x,y,z,meshes=level.groundMeshes,far=5)=>{
  ray.set(new THREE.Vector3(x,y,z),down);ray.near=0;ray.far=far;
  return ray.intersectObjects(meshes,false)[0];
 };
 const physicalFailures=[],blocked=[],footFailures=[];
 let supportProbes=0,actorProbes=0,rampProbes=0,contractionProbes=0,contracted=0;
 const verifySupport=(x,y,z,label,tolerance=.04)=>{
  const wanted=floor(oracle,x,y,z),actual=floor(coast,x,y,z);supportProbes++;
  if(!wanted||!actual||Math.abs(wanted.point.y-actual.point.y)>tolerance)
   physicalFailures.push({label,x,z,expectedY:wanted?.point.y,actualY:actual?.point.y});
  if(wanted){
   const half=CONST.playerHalf,body=new THREE.Box3(new THREE.Vector3(x-half.x,wanted.point.y+.12,z-half.z),new THREE.Vector3(x+half.x,wanted.point.y+2*half.y,z+half.z));
   if(!oracle.walls.some(w=>w.intersectsBox(body))&&coast.walls.some(w=>w.intersectsBox(body)))blocked.push({label,x,z,y:wanted.point.y});
  }
  return actual;
 };
 for(const {j,index,old} of sculpted){
  const own=coast.groundMeshes.filter(m=>m.userData.editorIdx===j);
  assert.ok(own.length>0,`#${index}: native terrain enters real support queries`);
  assert.ok(own.every(m=>m.visible&&!m.userData.editorGhost),`#${index}: no invisible original box under the new solid`);
  const east=index>=49&&index<=56,w=old.t==='ramp'?old.w:east?old.s[2]:old.s[0],length=old.t==='ramp'?old.len:east?old.s[0]:old.s[2],angle=(old.yaw??0)*Math.PI/180;
  const world=(localX,localZ)=>[old.p[0]+localX*Math.cos(angle)+localZ*Math.sin(angle),old.p[2]-localX*Math.sin(angle)+localZ*Math.cos(angle)];
  const top=z=>old.p[1]+(old.t==='ramp'?old.rise*(.5-z/old.len):old.s[1]/2);
  // Centreline endpoints retain gap distances; a practical central lane is
  // sampled without requiring the retired full rectangular border.
  const steps=Math.max(8,Math.ceil(length/2)),lane=Math.min(1.5,w*.16);
  for(let step=0;step<=steps;step++){
   const along=length*(.5-(.002+.996*step/steps));
   // Only the central takeoff/landing extent is immutable at a rounded cap;
   // lateral lane probes begin after a practical body-length cap transition.
   for(const lateral of step===0||step===steps?[0]:[-lane,0,lane]){
    const localX=east?along:lateral,localZ=east?lateral:along,y=top(localZ);
    const [x,z]=world(localX,localZ);verifySupport(x,y+.25,z,`#${index} ${old.t} central lane`,lateral===0?.04:.28);if(old.t==='ramp')rampProbes++;
   }
  }
  // These measure erosion of actual supported upper outlines. They do not
  // infer fidelity from declared metadata or a thumbnail.
  if(w>=8&&length>=12)for(const t of [.12,.28,.43,.61,.78,.9])for(const side of [-.44,.44]){
   const along=length*(.5-t),localX=east?along:w*side,localZ=east?w*side:along,[x,z]=world(localX,localZ),y=top(localZ);
   const wanted=floor(oracle,x,y+.2,z),actual=floor(coast,x,y+.2,z,own,1);contractionProbes++;
   if(wanted&&(!actual||actual.point.y<y-.1))contracted++;
  }
 }
 assert.ok(rampProbes>250,'central-lane slope coverage cannot silently skip the ramps');
 assert.ok(contractionProbes>100&&contracted>50,'measured upper outlines have real eroded sides instead of the retired rectangles');

 // Every actual actor foothold is independently queried. Crates need a
 // supported footprint, while authored stacks use the lower real crate.
 for(const [i,crate] of coast.crates.entries()){
  const {box}=crate,x=(box.min.x+box.max.x)/2,z=(box.min.z+box.max.z)/2,y=box.min.y;
  const below=coast.crates.find(other=>other!==crate&&Math.abs(other.box.max.y-y)<.025&&other.box.min.x<=box.min.x+.025&&other.box.max.x>=box.max.x-.025&&other.box.min.z<=box.min.z+.025&&other.box.max.z>=box.max.z-.025);
  for(const dx of [-.4,0,.4])for(const dz of [-.4,0,.4]){
   actorProbes++;if(below)continue;const actual=floor(coast,x+dx,y+.08,z+dz);
   if(!actual||Math.abs(actual.point.y-y)>.04)footFailures.push({label:`crate ${i}`,x:x+dx,z:z+dz,y,actualY:actual?.point.y});
  }
  assert.ok(!coast.walls.some(b=>b.containsPoint(new THREE.Vector3(x,y+.45,z))),`crate ${i}: no boundary inside box`);
 }
 for(const [i,cp] of coast.checkpoints.entries())for(const dx of [-.45,0,.45])for(const dz of [-.45,0,.45]){
  const [x,y,z]=cp.spawnPos.toArray();verifySupport(x+dx,y+.3,z+dz,`checkpoint ${i} spawn`);actorProbes++;
  // Actual browser respawn starts at the checkpoint crate centre and body
  // collision settles approximately one metre left. Include that measured
  // landing footprint; the all-checkpoint browser pass checks the solver.
  verifySupport(x-1.05+dx,y+.3,z+dz,`checkpoint ${i} measured respawn clearance`);actorProbes++;
 }
 verifySupport(...[data.spawn[0],data.spawn[1]+.3,data.spawn[2]],'supported original spawn');
 let patrolProbes=0;
 for(let j=0;j<expected.length;j++)if(expected[j].t==='enemy'){
  const e=expected[j];if(['floater'].includes(e.foe))continue;
  const axis=e.axis??'x';
  for(let i=0;i<=8;i++){
   const offset=(e.range??5)*(-1+2*i/8),x=e.p[0]+(axis==='x'?offset:0),z=e.p[2]+(axis==='z'?offset:0);
   const wanted=floor(oracle,x,e.p[1]+.8,z,oracle.groundMeshes,4);
   // Intentionally airborne patrols and unsupported patrol extremities are
   // not converted into new floors by this validation.
   if(!wanted)continue;
   verifySupport(x,wanted.point.y+.25,z,`enemy #${indices[j]} patrol ${i}`);patrolProbes++;actorProbes++;
  }
 }
 assert.ok(patrolProbes>100,'grounded patrol ranges actually sampled');
 let joinProbes=0;
 for(const {name,a,b} of [
  {name:'E exit',a:[9,-1720],b:[36,-1720]},
  {name:'E reentry',a:[136,-1720],b:[152,-1720]},
  {name:'N approach',a:[0,-1698],b:[0,-1720]},
  {name:'N-to-E turn',a:[0,-1720],b:[14,-1720]},
 ]){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),steps=Math.ceil(length/.2);
  for(let i=0;i<=steps;i++)for(const side of [-.7,0,.7]){
   const x=a[0]+dx*i/steps-dz/length*side,z=a[1]+dz*i/steps+dx/length*side;
   const wanted=floor(oracle,x,100,z,oracle.groundMeshes,100-oracle.killY);if(!wanted)continue;
   verifySupport(x,wanted.point.y+.25,z,`${name} actual player lane`);joinProbes++;
  }
 }
 assert.ok(joinProbes>900,'dense practical lane samples cover both E joins and the camera turn');
 if(physicalFailures.length||blocked.length||footFailures.length)
  await writeFile(process.env.CARLISLE_FIDELITY_FAILURES||'/private/tmp/carlisle-fidelity-support-failures.json',JSON.stringify({physicalFailures,blocked,footFailures},null,2));
 assert.equal(physicalFailures.length,0,`${physicalFailures.length} native support failures: ${JSON.stringify(physicalFailures.slice(0,12))}; full evidence /private/tmp/carlisle-fidelity-support-failures.json`);
 assert.equal(blocked.length,0,`${blocked.length} blocked player lanes: ${JSON.stringify(blocked.slice(0,12))}`);
 assert.equal(footFailures.length,0,`${footFailures.length} crate footprint failures: ${JSON.stringify(footFailures.slice(0,12))}`);

 // Inspect actual visible triangles, including non-colliding skirts. A
 // physics-only proof cannot detect scenery that visually erases a pit.
 const rendered=[];
 coast.root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(let parent=mesh;parent;parent=parent.parent){
   if(!parent.visible||parent.userData.editorGhost)return;
   if(parent.parent?.isLOD&&parent.parent.levels[0].object!==parent)return;
  }
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!materials.some(m=>m.visible&&!m.isShadowMaterial&&(!m.transparent||m.opacity>.05)))return;
  const idx=mesh.userData.editorIdx,c=data.components[idx];
  if(!mesh.userData.jungleAsset&&(!c||!['mesh','decor'].includes(c.t)))return;
  rendered.push({mesh,bounds:new THREE.Box3().setFromObject(mesh)});
 });
 assert.ok(rendered.length>100,'visible gap proof loads native terrain and actual GLB scenery');
 const gaps=[
  ['z',0,-153,-162,-4.5],['z',0,-275,-288,-10],['z',0,-350,-410,-12],['z',0,-475,-488,-9],
  ['z',0,-575,-655,-12],['z',0,-838,-910,-13],['z',0,-1000,-1013,-21],['z',0,-1442,-1450,-12],
  ['z',0,-1495,-1511,-12],['z',0,-1555,-1565,-10],['x',-1720,36,44,-16],['x',-1720,56,62,-15],
  ['x',-1720,74,100,-15],['x',-1720,118,120,-11],['x',-1720,134,136,-11],['x',-1720,141.5,142,-15],
  ['z',152,-1870,-1955,-25],['z',152,-2055,-2145,-25],['z',152,-2228,-2234,-25],
 ];
 let gapProbes=0;const visualFills=[];
 for(const [axis,fixed,start,end,height] of gaps){
  const steps=Math.max(3,Math.ceil(Math.abs(end-start)));
  for(let i=0;i<=steps;i++)for(const side of [-2,0,2]){
   const along=THREE.MathUtils.lerp(start,end,.025+.95*i/steps),x=axis==='x'?along:fixed+side,z=axis==='x'?fixed+side:along;
   if(floor(oracle,x,100,z,oracle.groundMeshes,100-oracle.killY))continue;
   const solid=floor(coast,x,100,z,coast.groundMeshes,100-coast.killY);
   assert.ok(!solid,`original gap remains physically open at ${x},${z}; new floor ${solid?.point.y}`);
   const candidates=rendered.filter(v=>x>=v.bounds.min.x&&x<=v.bounds.max.x&&z>=v.bounds.min.z&&z<=v.bounds.max.z);
   ray.set(new THREE.Vector3(x,100,z),down);ray.near=0;ray.far=100-coast.killY;
   for(const hit of ray.intersectObjects(candidates.map(v=>v.mesh),false)){
    if(hit.point.y<=coast.killY+3||hit.point.y<height-3||hit.point.y>height+2)continue;
    const matrix=hit.object.matrixWorld.clone();
    if(hit.object.isInstancedMesh&&hit.instanceId!==undefined){const instance=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,instance);matrix.multiply(instance);}
    const normal=hit.face?.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix));
    if(!normal||normal.y<.55)continue;
    visualFills.push({x,z,y:hit.point.y,kind:hit.object.userData.jungleAsset??hit.object.name});break;
   }
   gapProbes++;
  }
 }
 assert.ok(gapProbes>800,'physical/visible gap evidence covers all nineteen original intervals');
 assert.deepEqual(visualFills,[],'actual upward-facing scenery triangles do not visually fill the original pits');
 assert.deepEqual(coast.zones,oracle.zones,'original camera/input side-scroll extent');
 assert.equal(coast.rails.filter(r=>data.components[r.object.userData.editorIdx]?.t==='rail'&&r.object.userData.editorIdx<indices.length).length,73,'all authored rail encounters build');
 assert.equal(coast.movers.length,2);assert.equal(coast.crumbles.length,14);
 assert.equal(coast.halfpipes.length,1,'one mature analytic channel');
 const hp=coast.halfpipes[0];
 assert.equal(hp.radius,4.5,'explicitly redesigned bank radius');assert.equal(hp.flatHalf,3,'unchanged flat channel');
 assert.equal(hp.l0,-710);assert.equal(hp.l1,-830);assert.equal(hp.yBottom,-13.5);assert.equal(hp.lipX,7.5);assert.equal(hp.lipY,-9);
 assert.ok(hp.walls.every(m=>m.userData.halfpipe===hp),'collision queries retain mature analytic normals and pipe contact rules');
 const foundationData=data.components.find(c=>c.nm==='Carlisle halfpipe carved stone foundation');
 assert.ok(foundationData&&foundationData.solid===false&&foundationData.castShadow===false,'closed channel foundation is visual and skips shadow work');
 const foundation=coast.root.getObjectByName(foundationData.nm);
 assert.ok(foundation?.isMesh&&!coast.groundMeshes.includes(foundation),'foundation never enters contact geometry');
 const positions=foundation.geometry.attributes.position,ids=foundation.geometry.index.array;
 let foundationInteriorProbes=0,foundationRayProbes=0,minFoundationClearance=Infinity;
 const verifyBelowCurve=p=>{
  if(Math.abs(p.x-hp.cross)>hp.lipX+.00001||p.z<hp.l1-.00001||p.z>hp.l0+.00001)return;
  const analytic=hp.surfaceY(hp.crossToU(p.x)),clearance=analytic-p.y;
  minFoundationClearance=Math.min(minFoundationClearance,clearance);
  assert.ok(clearance>.02,`actual foundation triangle crosses analytic ride at ${p.toArray()}: ${clearance}`);
 };
 const vector=id=>new THREE.Vector3().fromBufferAttribute(positions,id).applyMatrix4(foundation.matrixWorld);
 const barycentrics=[[1/3,1/3,1/3],[.7,.15,.15],[.15,.7,.15],[.15,.15,.7],[.49,.49,.02],[.02,.49,.49]];
 for(let i=0;i<ids.length;i+=3){const a=vector(ids[i]),b=vector(ids[i+1]),c=vector(ids[i+2]);
  for(const [u,v,w]of barycentrics){verifyBelowCurve(a.clone().multiplyScalar(u).addScaledVector(b,v).addScaledVector(c,w));foundationInteriorProbes++;}
 }
 for(let i=0;i<=1000;i++)for(const z of [-711,-725,-740,-755,-770,-785,-800,-815,-829]){
  const x=THREE.MathUtils.lerp(-hp.lipX+.001,hp.lipX-.001,i/1000),hit=floor(coast,x,100,z,[foundation],150);
  assert.ok(hit,'closed foundation has real loaded render triangles');verifyBelowCurve(hit.point);foundationRayProbes++;
 }
 assert.ok(foundationInteriorProbes>8000&&foundationRayProbes>9000,'bank clearance covers triangle interiors and dense actual intersections');
 const coping=coast.rails.filter(r=>data.components[r.object.userData.editorIdx]?.t==='vertramp');
 assert.equal(coping.length,2,'two actual redesigned coping paths');
 for(const rail of coping)for(const p of rail.points){assert.ok(Math.abs(Math.abs(p.x)-7.5)<.00001,'coping follows actual redesigned rim');assert.ok(Math.abs(p.y-(-8.95))<.00001,'coping follows actual lip height');}
 let copingMaterials=0;
 for(const rail of coping){assert.equal(rail.object.userData.carlisleRockCoping,true,'only authored coast bank coping is tagged for the matte stone skin');
  rail.object.traverse(m=>{if(!m.isMesh)return;for(const material of Array.isArray(m.material)?m.material:[m.material]){
   assert.equal(material.color.getHex(),0x968c72,'actual rendered coping has the authored quiet stone colour');
   assert.equal(material.roughness,.94);assert.equal(material.metalness,0);copingMaterials++;
  }});
 }
 assert.ok(copingMaterials>=2,'matte coping proof checks real rendered materials');
 assert.ok(coast.rails.filter(r=>r.object.userData.carlisleRockCoping).every(r=>coping.includes(r)),'other authored grind paths keep their original material family');
 // Metric UVs follow the actual signed bank arc and length, compensating the
 // shared sampler repeat. The 120 m trough must not become one stretched tile.
 let bankUVProbes=0;
 for(const mesh of hp.walls){
  assert.equal(mesh.userData.carlisleMetricUV,3.1);
  const channelMaterial=mesh.material;
  if(mesh.name==='halfpipe floor'){
   assert.equal(channelMaterial.polygonOffset,true,'only the coincident flat channel floor has a rendered depth offset');
   assert.equal(channelMaterial.polygonOffsetFactor,1);assert.equal(channelMaterial.polygonOffsetUnits,1);
  }else{
   assert.equal(channelMaterial.polygonOffset,false,'steep native banks remain in front of their supporting rock');
  }
  const position=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv'),map=mesh.material.map;
  mesh.updateMatrix();
  for(let i=0;i<position.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrix);
   assert.ok(Math.abs(uv.getY(i)*(map?.repeat.y||1)*3.1-(hp.pointToU(p.x,p.z)+hp.uLip))<.00001,'bank arc metres per stone tile');
   assert.ok(Math.abs(uv.getX(i)*(map?.repeat.x||1)*3.1-(hp.alongCoord(p.x,p.z)-Math.min(hp.l0,hp.l1)))<.00002,'bank length metres per stone tile');
   bankUVProbes++;
  }
 }
 assert.ok(bankUVProbes>90,'actual transition and floor UVs measured');
 assert.deepEqual(coast.checkpoints.map(c=>c.spawnPos.toArray()),oracle.checkpoints.map(c=>c.spawnPos.toArray()),'actual checkpoint spawn positions');
 assert.deepEqual(coast.finishBox,oracle.finishBox,'actual gate trigger');
 const {dressCarlisleTimberDeck,dressCarlisleTimberBeam,disposeCarlisleTimberDeck}=await server.ssrLoadModule('/src/carlisleTimber.ts');
 const timberParents=[];coast.root.traverse(m=>{if(m.isMesh&&m.userData.carlisleTimberDressed)timberParents.push(m);});
 const decks=timberParents.filter(m=>m.userData.carlisleTimberDeck),beams=timberParents.filter(m=>m.userData.carlisleTimberBeam);
 assert.equal(decks.length,19,'three static decks, fourteen crumble pads and two movers have modeled timber');
 assert.equal(beams.length,6,'both gallows retain three modeled support members');
 const movingParents=new Set([...coast.movers,...coast.crumbles].map(m=>m.mesh));
 assert.equal(decks.filter(m=>movingParents.has(m)).length,16,'all moving and breakaway proxies own their timber');
 const effectiveVisible=m=>{for(let p=m;p;p=p.parent)if(!p.visible)return false;return true;};
 let timberVertexProbes=0,timberInstances=0,timberFollowerChecks=0;
 const timberState=timberParents.map(parent=>{
  parent.geometry.computeBoundingBox();const bounds=parent.geometry.boundingBox.clone();
  const roots=parent.children.filter(o=>o.userData.carlisleTimberDressing);
  assert.equal(roots.length,1,'one owned timber skin per native proxy');
  assert.ok(parent.visible,'native proxy visibility remains the motion/collapse authority');
  assert.ok((Array.isArray(parent.material)?parent.material:[parent.material]).every(m=>!m.visible&&!m.userData.shared),'only owned collider material clones are hidden');
  const parts=[];roots[0].traverse(m=>{if(m.isMesh)parts.push(m);});
  assert.ok(parts.length>0&&parts.every(m=>m.isInstancedMesh),'modeled kit members use bounded instance batches');
  const inverse=parent.matrixWorld.clone().invert(),locals=[];
  for(const part of parts){
   assert.ok(!coast.groundMeshes.includes(part),'visual members never enter nonrecursive contact queries');
   assert.equal(part.userData.visualOnly,true);assert.equal(part.userData.edgeGrinding,false);
   assert.equal(part.castShadow,false);assert.equal(part.userData.castShadow,false);
   assert.ok(part.geometry.userData.shared&&part.material.userData.shared,'kit geometry and atlas material are borrowed process assets');
   assert.ok(part.geometry.type!=='BoxGeometry'&&(part.geometry.index?.count??0)>36,'real chipped/hewn topology replaces box skins');
   const local=inverse.clone().multiply(part.matrixWorld);locals.push(local.toArray());
   const positions=part.geometry.attributes.position,instance=new THREE.Matrix4();
   let minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(let i=0;i<part.count;i++){
    part.getMatrixAt(i,instance);const transform=local.clone().multiply(instance);timberInstances++;
    for(let j=0;j<positions.count;j++){
     const p=new THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(transform);
     assert.ok(p.toArray().every(Number.isFinite),'actual transformed timber vertices are finite');
     minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);timberVertexProbes++;
    }
   }
   if(part.userData.woodPathMeshFamily==='plank'){
    assert.ok(Math.abs(maxY-bounds.max.y)<.002,'actual board crest matches the native contact top');
    assert.ok(minZ>=bounds.min.z-.16&&maxZ<=bounds.max.z+.16,'board chips leave no excessive forward lip beyond the native envelope');
   }
   if(movingParents.has(parent))assert.ok(minY>=bounds.max.y-1.31,'moving skirt stays shallow instead of dragging static pier legs');
  }
  if(parent.userData.carlisleTimberDeck){
   assert.ok(coast.groundMeshes.includes(parent),'native timber deck remains the sole contact proxy');
   const index=parent.userData.editorIdx,old=oracle.groundMeshes.find(m=>m.userData.editorIdx===index);
   assert.ok(old,'independent original timber contact proxy');old.geometry.computeBoundingBox();
   assert.ok(bounds.min.distanceTo(old.geometry.boundingBox.min)<.00001&&bounds.max.distanceTo(old.geometry.boundingBox.max)<.00001,'proxy local contact envelope is unchanged');
  }
  return{parent,parts,locals};
 });
 const verifyTimberFollowers=()=>{
  coast.root.updateMatrixWorld(true);
  for(const {parent,parts,locals}of timberState){const inverse=parent.matrixWorld.clone().invert();
   for(let i=0;i<parts.length;i++){
    const actual=inverse.clone().multiply(parts[i].matrixWorld).toArray();
    assert.ok(actual.every((v,k)=>Math.abs(v-locals[i][k])<.000001),'every real timber batch follows its native moving parent');
    assert.equal(effectiveVisible(parts[i]),effectiveVisible(parent),'breakaway disappearance hides every attached timber member');timberFollowerChecks++;
   }
  }
 };
 verifyTimberFollowers();
 // Touch the actual crumble API so the follower proof covers shake, tumble
 // and disappearance, rather than only comparing untouched idle pads.
 for(let i=0;i<coast.crumbles.length;i++){oracle.touchCrumble(i);coast.touchCrumble(i);}
 let disappearedTimber=0;
 for(const delta of [.01,.1,.45,.8,1.1,1.4]){
  oracle.update(delta);coast.update(delta);oracle.root.updateMatrixWorld(true);coast.root.updateMatrixWorld(true);
  for(const key of ['movers','crumbles'])for(let i=0;i<coast[key].length;i++){
   const a=oracle[key][i].mesh,b=coast[key][i].mesh;
   assert.ok(a.position.distanceTo(b.position)<.00001,`${key} ${i}: original motion timing`);
   assert.ok(a.quaternion.angleTo(b.quaternion)<.000001,`${key} ${i}: original tumble rotation`);
   assert.equal(a.visible,b.visible,`${key} ${i}: original disappearance timing`);
  }
  verifyTimberFollowers();
  disappearedTimber=Math.max(disappearedTimber,coast.crumbles.filter(c=>!c.mesh.visible).length);
 }
 assert.ok(disappearedTimber>0,'real breakaway timber disappears with its contact parent');
 // Independently exercise leased instance ownership with two peers, rather
 // than relying on a destructor comment or disposing the live course early.
 const fixtureGeometry=new THREE.BoxGeometry(3,1,6),fixtureMaterial=new THREE.MeshLambertMaterial(),fixture=new THREE.Mesh(fixtureGeometry,fixtureMaterial),peer=new THREE.Mesh(fixtureGeometry.clone(),fixtureMaterial);
 const fixtureComponent={t:'platform',p:[0,0,0],s:[3,1,6],nm:'Timber ownership fixture 901'};
 const owner=dressCarlisleTimberDeck(fixture,fixtureComponent,false),other=dressCarlisleTimberDeck(peer,{...fixtureComponent,nm:'Timber ownership fixture 902'},false);
 assert.ok(owner&&other);assert.equal(dressCarlisleTimberDeck(fixture,fixtureComponent,false),owner,'repeat dressing reuses the same owner');
 const ownInstances=[],sharedGeometries=new Set(),sharedMaterials=new Set();
 owner.root.traverse(m=>{if(m.isInstancedMesh){ownInstances.push(m);sharedGeometries.add(m.geometry);sharedMaterials.add(m.material);}});
 let instanceDisposals=0,sharedDisposals=0,hiddenDisposals=0;
 for(const m of ownInstances)m.addEventListener('dispose',()=>instanceDisposals++);
 for(const g of sharedGeometries)g.addEventListener('dispose',()=>sharedDisposals++);
 for(const m of sharedMaterials)m.addEventListener('dispose',()=>sharedDisposals++);
 fixture.material.addEventListener('dispose',()=>hiddenDisposals++);
 owner.dispose();owner.dispose();disposeCarlisleTimberDeck(fixture);
 assert.equal(instanceDisposals,ownInstances.length,'owned instance buffers release exactly once');assert.equal(hiddenDisposals,1,'owned hidden material releases once');
 assert.equal(sharedDisposals,0,'departing deck never disposes shared geometry or atlas material');assert.equal(fixture.material,fixtureMaterial,'original collider material restored before ordinary Level disposal');
 assert.ok(other.root.parent===peer&&other.root.children.length>0,'peer timber remains alive');other.dispose();
 const beamFixture=new THREE.Mesh(new THREE.BoxGeometry(.3,5,.3),fixtureMaterial),beamOwner=dressCarlisleTimberBeam(beamFixture,903);
 assert.ok(beamOwner&&beamFixture.userData.carlisleTimberBeam);beamOwner.dispose();assert.equal(beamFixture.material,fixtureMaterial);
 fixtureGeometry.dispose();peer.geometry.dispose();beamFixture.geometry.dispose();fixtureMaterial.dispose();
 // Scenery streaming owns resources; stable residency is a release gate,
 // while real rendered frame budgets are measured by the browser harness.
 const camera=new THREE.PerspectiveCamera(55,16/9,.1,205),placements=[coast.spawnPos,...coast.checkpoints.map(c=>c.spawnPos)],samples=[];
 for(const p of placements){camera.position.copy(p).add(new THREE.Vector3(0,6,12));coast.updateSceneryView(camera);await coast.prepareJungleAssets();const d=coast.jungleAssetDiagnostics;assert.deepEqual(d.errors,[]);assert.equal(d.pendingCells,0);samples.push({...d});}
 camera.position.copy(placements[0]).add(new THREE.Vector3(0,6,12));coast.updateSceneryView(camera);await coast.prepareJungleAssets();
 const before={...coast.jungleAssetDiagnostics},children=coast.root.children.length;
 for(let i=0;i<120;i++){coast.updateSceneryPresentation(1/60);coast.updateSceneryView(camera);}
 await coast.prepareJungleAssets();assert.equal(coast.root.children.length,children,'idle scenery geometry ownership is stable');
 assert.equal(coast.jungleAssetDiagnostics.residentCells,before.residentCells,'idle cell ownership is stable');
 assert.equal(coast.jungleAssetDiagnostics.textureMiB,before.textureMiB,'idle texture ownership is stable');
 // Deep foundation art uses the same aliases as foreground cliffs. Its
 // explicit shadow opt-out must not switch off a caster in the same cell,
 // create material copies, or be lost when the world applies shadow quality.
 const {JungleAssetKit}=await server.ssrLoadModule('/src/jungleAssets.ts');
 const shadowKit=new JungleAssetKit(true,false,false,true,'painterly');
 try{
  shadowKit.add({dkind:'coastv2buttress',p:[0,0,0],castShadow:false});
  shadowKit.add({dkind:'coastv2buttress',p:[3,0,1]});
  shadowKit.flush();shadowKit.setView(new THREE.Vector3(0,5,10),100);await shadowKit.ready();
  const meshes=shadowKit.root.children.filter(m=>m.isInstancedMesh),tris=m=>(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
  assert.equal(meshes.length,4,'same-cell caster and foundation have separate near/far buckets');
  const high=meshes.filter(m=>tris(m)>3000);
  assert.equal(high.length,2,'two actual high-detail cliff batches');
  assert.equal(high.filter(m=>m.castShadow).length,1,'foundation opt-out preserves the neighboring real caster');
  assert.equal(high.filter(m=>m.userData.castShadow===false).length,1,'world shadow policy sees the explicit foundation opt-out');
  assert.equal(high[0].material,high[1].material,'shadow buckets share one material and texture owner');
  assert.deepEqual(shadowKit.diagnostics.errors,[],'shadow bucket model loads');
 }finally{shadowKit.dispose();assert.equal(shadowKit.root.children.length,0,'shadow fixture releases every resident mesh');}
 console.log(`PASS Carlisle fidelity safety: ${sculpted.length} visible native solids, ${supportProbes} centre/actor support probes (${rampProbes} slope), ${actorProbes} footholds, ${joinProbes} practical join/turn probes, ${contracted}/${contractionProbes} measured eroded border probes, ${gapProbes} actual physical/visible gap probes, retained actors/hazards/rails/checkpoints/gate timing, analytic 4.5 m bank with ${foundationInteriorProbes} triangle-interior/${foundationRayProbes} rendered-foundation probes (${minFoundationClearance.toFixed(5)} m clearance), ${decks.length} modeled timber decks/${beams.length} beams (${timberVertexProbes} transformed vertices, ${timberInstances} instances, ${timberFollowerChecks} motion checks), editor portability and stable streaming. Peak ${Math.max(...samples.map(s=>s.residentCells))}/${samples[0].cells} cells; headless texture estimate ${Math.max(...samples.map(s=>s.textureMiB)).toFixed(2)} MiB. Visual matching and actual GPU texture/frame measurements require browser review.`);
}finally{coast?.dispose();oracle?.dispose();await server.close();}
