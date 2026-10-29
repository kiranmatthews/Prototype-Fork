import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const out='docs/carlisle-relay/pose-facing',rows=[];
await withSkateRuntime(async({THREE,Level,Player,CONST,server})=>{
 const a=await server.ssrLoadModule('/src/animation/index.ts');
 const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
 for(const axis of ['x','z'])for(const sign of [-1,1])for(const mounted of [false,true]){
  const point=(inside,y,across=0)=>axis==='x'?[inside*sign,y,across]:[across,y,inside*sign];
  const data={v:1,name:'Facing grip',spawn:point(-.7,.8),killY:-12,components:[
   {t:'platform',p:point(3,-.5),s:axis==='x'?[6,5,30]:[30,5,6],edgeGrinding:false},
   {t:'gate',p:point(5,2)},
  ]};
  const l=new Level(new THREE.Scene(),{id:'facing-grip',name:data.name,data});l.update(0);l.scene.updateMatrixWorld(true);
  const p=new Player(l.scene);p.enterLevel('facing-grip');p.respawn(l,true);
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=a.createPlayerStarterAnimationSuite(binding.definition),runtime=createCharacterAnimationRuntime(p,suite);
  const clip=suite.clips.find(c=>c.id==='player.slope-slide');assert.ok(clip);
  assert.equal(clip.metadata.elasticityProfile,'slope-slide');
  assert.equal(clip.contacts.length,2);
  const saved=structuredClone(suite);
  // The serialized metadata key is exported so a previous saved suite gains
  // the new route without replacing any locally edited existing clip.
  saved.metadata[a.PLAYER_STARTER_CATALOG_METADATA_KEY]=33;saved.clips=saved.clips.filter(c=>c.id!==clip.id);
  const reconciled=a.reconcilePlayerStarterAnimationSuite(saved,binding.definition);
  assert.ok(reconciled.clips.some(c=>c.id===clip.id));
  assert.deepEqual(reconciled.clips.filter(c=>c.id!==clip.id),saved.clips);
  p.state='air';p.grounded=false;p.pos.fromArray(point(-.52,.8));p.prevPos.copy(p.pos);p.vVel=-1;
  p.lastVelX=axis==='x'?sign*5:0;p.lastVelZ=axis==='z'?sign*5:0;
  p.freeSkate=mounted;p.sidePose=mounted?1:0;p.skatePose=mounted?1:0;
  p.visualYaw=axis==='x'?.25:1.8;
  p.rawInput=makeInput(axis==='x'?{moveX:sign}:{moveY:-sign});
  const wall=l.walls.find(w=>Math.abs(w.max.y-1.75)<.01);assert.ok(wall);
  assert.ok(p.tryLedgeGrab(wall,l),`catch ${axis}/${sign}/${mounted}`);
  const axes=[p.axisF.toArray(),p.axisL.toArray()];
  const check=label=>{
   p.group.updateWorldMatrix(true,true);
   const face=new THREE.Vector3(0,0,1).transformDirection(p.bodyGroup.matrixWorld);face.y=0;face.normalize();
   const desired=p.ledgeNormal.clone().negate();desired.y=0;desired.normalize();
   const dot=face.dot(desired);assert.ok(dot>.999,`${axis}/${sign}/${mounted}/${label}: ${dot}`);
   assert.deepEqual([p.axisF.toArray(),p.axisL.toArray()],axes,'presentation changed control frame');
   return dot;
  };
  const tick=input=>{const i=makeInput(input);p.rawInput=i;p.step(CONST.fixedStep,i,l);l.update(CONST.fixedStep);p.commitRenderStep(l);};
  tick({});const first=check('first catch');
  for(let i=0;i<15;i++)tick({});
  // Camera faces -Z. Tangent input changes world displacement but must not
  // turn the character to face along the edge.
  const shim=axis==='x'?{moveY:1}:{moveX:1},before=p.pos.clone();
  for(let i=0;i<24;i++){tick(shim);assert.equal(p.state,'hang');check('shimmy');}
  const distance=p.pos.distanceTo(before);assert.ok(distance>.5,'shimmy did not progress');
  // A moving support's carry changes world velocity. Use the same native
  // delta channel as a mover while leaving the collision lip fixed in place.
  p.ledgeMoverId=0;l.moverDelta=()=>new THREE.Vector3(axis==='x'?0:.025,0,axis==='x'?.025:0);
  for(let i=0;i<10;i++){tick({});assert.equal(p.state,'hang');check('carry');}
  p.ledgeMoverId=undefined;
  tick({spinHeld:true,spinPressed:true});assert.ok(p.spinning,'spin input swallowed');
  let climbFrames=0;
  for(let i=0;i<45;i++){if(p.state==='hang'){check('spin/mantle');climbFrames++;}tick({});}
  assert.ok(climbFrames>0&&p.grounded,'mantle did not finish');
  rows.push({axis,sign,mounted,firstFaceDot:first,shimmyDistance:distance,climbFrames,landed:p.pos.toArray()});
  runtime.dispose();l.dispose();
 }
});
await mkdir(out,{recursive:true});await writeFile(`${out}/ledge-native.json`,JSON.stringify({rows},null,2)+'\n');
console.log('PASS',JSON.stringify(rows));
