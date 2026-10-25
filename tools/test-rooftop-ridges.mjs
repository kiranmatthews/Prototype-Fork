import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({server,THREE,Level,player,CONST})=>{
 const {surfaceRidgeEdges,joinSurfaceBoundaryEdges}=await server.ssrLoadModule('/src/surfaceEdges.ts');
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const {ROOFTOP_RELAY_LEVEL:data,ROOFTOP_CHECKPOINTS,ROOFTOP_ROOFS,rooftopSurfaceY,rooftopWidthAt}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 // Both roof flanks retain their pitch at the entry, middle and departure;
 // the actual mesh rows must agree, including the diamond footprint's edges.
 for(const r of ROOFTOP_ROOFS.filter(r=>['gable','hip'].includes(r.shape))){
  const mesh=data.components.find(c=>c.nm===`RR:${r.index} ${r.shape} roof`);
  const strips=mesh.grindTopTriangles/8;
  for(let row=0;row<strips;row++){
   // Roof UV islands duplicate vertices: each strip has eight triangles.
   const y=vertex=>mesh.vertices[(row*24+vertex)*3+1];
   for(const [ridge,edges]of [[7,[0,19]],[8,[5,20]]])for(const edge of edges)
    assert.ok(Math.abs(y(ridge)-y(edge)-r.pitch)<1e-6,r.name+' flattened mesh flank');
  }
  for(const t of [0,.05,.25,.5,.75,.95,1]){
   const s=r.a+r.depth*t,half=rooftopWidthAt(r,s)/2;
   for(const side of [-1,1])assert.ok(Math.abs(rooftopSurfaceY(r,s)-rooftopSurfaceY(r,s,side*half)-r.pitch)<1e-6,r.name+' flattened flank');
  }
 }
 // Shared, split-UV, flat and concave roofs distinguish true spines from seams.
 for(const split of [false,true])for(const peak of [2,0,-2]){
  let geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-4,0,4,0,peak,4,4,0,4,-4,0,-4,0,peak,-4,4,0,-4],3));
  geometry.setIndex([0,1,4,0,4,3,1,2,5,1,5,4]);
  if(split)geometry=geometry.toNonIndexed();
  geometry.userData.grindIndices=Array.from({length:12},(_,i)=>geometry.index?geometry.index.getX(i):i);
  const mesh=new THREE.Mesh(geometry);
  assert.equal(surfaceRidgeEdges(mesh).length,peak>0?1:0,`peak ${peak}, split ${split}`);
  mesh.rotation.y=.63;mesh.scale.x=-1;
  assert.equal(surfaceRidgeEdges(mesh).length,peak>0?1:0);
  geometry.dispose();mesh.material.dispose();
 }
 assert.ok(normalizeCustomLevelData({...data,components:data.components.filter(c=>c.ridgeGrinding||c.t==='gate')}));
 const level=new Level(new THREE.Scene(),{id:'rooftop-relay',name:data.name,data});
 const report={checkpoints:level.checkpoints.length,physicalRails:level.rails.length,roofs:[]};
 try{
  assert.equal(level.checkpoints.length,6);assert.equal(ROOFTOP_CHECKPOINTS.length,6);
  assert.equal(level.rails.length,data.components.filter(c=>c.t==='rail').length,'ridge must not become a collision bar');
  for(const mesh of level.groundMeshes){
   const component=data.components[mesh.userData.editorIdx];if(!component?.ridgeGrinding)continue;
   const paths=joinSurfaceBoundaryEdges(surfaceRidgeEdges(mesh)).sort((a,b)=>pathLength(b)-pathLength(a));
   if(!paths.length){assert.match(component.nm,/shed/);continue;}
   const points=paths[0],middle=points[Math.floor(points.length/2)].clone();middle.y+=.05;
   const rail=level.surfaceEdgeRails.find(r=>r.closestDistance(middle)<.001);
   assert.ok(rail,component.nm+' missing grind path');assert.ok(level.isSurfaceEdgeRail(rail));
   const heading=rail.tangentAt(rail.closest(middle).s??rail.totalLength/2);
   for(const grind of [false,true]){
    player.respawn(level,true,true,{position:middle.clone().add(new THREE.Vector3(0,grind?.18:1.5,0)),heading});
    player.freeSkate=player.airFromSkate=true;player.state='air';player.grounded=false;player.speed=grind?8:0;player.vVel=-1;
    let caught=false,landed=false;
    for(let i=0;i<90;i++){
     player.step(CONST.fixedStep,makeInput({grindHeld:grind,grindPressed:grind&&i===0}),level);level.update(CONST.fixedStep);
     assert.equal(player.isBailing,false,component.nm+' landing bailed');
     if(player.state==='grind'){caught=true;break;}
     if(player.grounded){landed=true;break;}
    }
    if(grind){assert.equal(caught,true,component.nm+' grind failed');assert.ok(level.isSurfaceEdgeRail(player.grindRail));}
    else {assert.equal(landed,true,component.nm+' landing failed');assert.equal(caught,false);}
   }
   report.roofs.push({name:component.nm,creases:paths.length,safeLanding:true,grindCatch:true});
  }
  assert.ok(report.roofs.length>=10);
  console.log('PASS',JSON.stringify(report));
  await writeFile('docs/rooftop-kook/validation/ridges.json',JSON.stringify(report,null,2)+'\n');
 }finally{level.dispose();}
});
function pathLength(points){return points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0);}
