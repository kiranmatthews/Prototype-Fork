import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const fixture={v:1,name:'Rival model parity',spawn:[0,.1,10],killY:-20,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-250],s:[100,1,600]}, {t:'gate',p:[0,0,-500]},
 {t:'camnode',p:[0,0,15]},{t:'camnode',p:[0,0,-520]}],
 skateRace:{v:1,racers:8,seed:1,line:[[0,0,15,100],[0,0,-500,100]],jumps:[],finishWidth:50,originalLength:400}};
await withBlockworksRuntime(async r=>{
 const hero=r.p,rival=new r.Player(r.scene,'#70d9f4');rival.enterLevel('rival-model-parity');rival.respawn(r.l,true);
 const hm=hero.bodyGroup.userData.sculptRuntime,rm=rival.bodyGroup.userData.sculptRuntime;
 assert.deepEqual(rm.joints,hm.joints);assert.deepEqual(rm.sockets,hm.sockets);assert.deepEqual(rm.deformations,hm.deformations);
 assert.equal(hero.meshyHead?.mesh.name,'meshy-head-surface');assert.equal(rival.meshyHead,null);assert.equal(rival.riggedCartoonHandState,'idle');
 const counts=p=>{let triangles=0,skin=0;p.group.traverseVisible(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.isSkinnedMesh)skin++;}});return {triangles,skin,batches:p.characterRenderBatchDiagnostics};};
 const full=counts(hero),light=counts(rival);assert.ok(light.triangles<full.triangles*.7,'Rivals must be materially cheaper');
 assert.equal(light.skin,1);
 let previous={},maxError=0;
 for(let frame=0;frame<480;frame++){
  const input=normalizeGameInput({moveY:1,moveX:frame>=160&&frame<220?.2:0,jumpHeld:frame<80,spinPressed:frame===95,grabPressed:frame===110},previous);previous=input;
  hero.step(r.dt,{...input},r.l);rival.step(r.dt,{...input},r.l);r.l.update(r.dt);
  hero.commitRenderStep(r.l);rival.commitRenderStep(r.l);
  maxError=Math.max(maxError,hero.pos.distanceTo(rival.pos));
  assert.ok(hero.pos.distanceTo(rival.pos)<1e-8,'Visual detail cannot change movement');assert.equal(hero.state,rival.state);assert.equal(hero.grounded,rival.grounded);
 }
 const groupScale=rival.group.scale.clone(),bodyScale=rival.bodyGroup.scale.clone();
 rival.enterAnimationPreview();
 for(const amount of [.65,1.4,1]){
  rival.applyAnimationDeformations({'deform.torso.length':amount,'deform.arm.upper.left.length':amount,'deform.leg.lower.left.length':amount});rival.syncCharacterAppearance();
  assert.deepEqual(rival.group.scale.toArray(),groupScale.toArray());assert.deepEqual(rival.bodyGroup.scale.toArray(),bodyScale.toArray());
  const shirt=rival.rivalShirt.mesh;shirt.skeleton.update();
  const weights=shirt.geometry.getAttribute('skinWeight'),indices=shirt.geometry.getAttribute('skinIndex');
  for(let i=0;i<weights.count;i++){
   assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);
   assert.ok(indices.getX(i)<shirt.skeleton.bones.length&&indices.getY(i)<shirt.skeleton.bones.length);
   assert.ok(shirt.getVertexPosition(i,new r.THREE.Vector3()).toArray().every(Number.isFinite));
  }
  if(amount<1)assert.ok(shirt.morphTargetInfluences[0]>0);else if(amount>1)assert.ok(shirt.morphTargetInfluences[1]>0);else assert.deepEqual(shirt.morphTargetInfluences,[0,0]);
 }
 rival.exitAnimationPreview();console.log(JSON.stringify({full,light,maxMovementError:maxError,rigAndSocketsPreserved:true,independentElasticity:true,normalizedWeights:true}));
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'rival-model-parity'});
