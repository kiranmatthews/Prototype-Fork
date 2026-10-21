import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const base=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(new URL('public/enemies/crab-stomped.glb',base));
const provenance=JSON.parse(await readFile(new URL('public/enemies/crab-stomped.provenance.json',base)));
assert.equal(hash(bytes),provenance.sha256);
assert.equal(provenance.triangles,15628);assert.equal(provenance.binaryPreserved,true);
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.equal(provenance.sourceTriangles,15620);assert.equal(provenance.pinholeCaps.length,3);
assert.equal(doc.skins,undefined,'carcass uses a static delivered pose');
assert.equal(doc.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),0),15628);
assert.equal(doc.extensionsUsed?.includes('MSFT_lod')??false,false);
assert.equal(doc.images.length,3);
assert.deepEqual(provenance.textureResolution,[2048,2048]);
const reference=await readFile(new URL(provenance.reference,base));assert.equal(hash(reference),provenance.referenceSha256);
const ledger=JSON.parse(await readFile(new URL('tools/crab-carcass/tasks.json',base)));
assert.equal(ledger.tasks['crab-stomped'].id,provenance.generationTaskId);
assert.equal(ledger.tasks['crab-stomped'].state,'SUCCEEDED');assert.equal(provenance.consumedCredits,15);

// Real meshes and gameplay; headless parsing omits texture upload. Native
// browser review checks the actual three 2K maps and X-eye appearance.
const original=GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync=async function(url,...args){
 const name=String(url).match(/\/enemies\/(grunt|crab-stomped)\.glb$/)?.[1];
 if(!name)return original.call(this,url,...args);
 globalThis.navigator.userAgent ??= 'Node';
 const b=await readFile(new URL(`public/enemies/${name}.glb`,base));
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  .register(()=>({name:'CarcassPhysicsWithoutPixels',loadTexture:()=>Promise.resolve(null)}))
  .parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
};
try{
 await withSkateRuntime(async({THREE,level,player:p,step,TUNING,CONST})=>{
  const e=level.enemies[0],reports=[];await e.visual.ready;
  assert.equal(e.visual.diagnostics.status,'ready',JSON.stringify(e.visual.diagnostics));assert.equal(e.visual.diagnostics.carcass.status,'ready');
  const reset=()=>{
   level.reset(true);level.update(0);p.respawn(level,true,true,{position:new THREE.Vector3(-1.2,0,0),heading:new THREE.Vector3(1,0,0)});
   p.freeSkate=p.airFromSkate=p.competitionMode=false;p.invulnTimer=0;p.speed=0;p.walkVelocity.set(0,0,0);
   p.camDir.set(0,0,-1);p.state='ride';p.grounded=true;p.rawInput=makeInput();level.update(0);
  };
  const wait=n=>{const input=makeInput();for(let i=0;i<n;i++)step(input);};
  const stomp=()=>{
   p.pos.set(0,2,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-5;p.airJumpUsed=true;
   for(let i=0;i<40&&e.alive;i++)step(makeInput());
   assert.equal(e.alive,false);assert.ok(e.crabCarcass);assert.equal(e.flungT,undefined);
   assert.equal(p.vVel,TUNING.crateBounce);assert.equal(p.airJumpUsed,false);
   assert.equal(e.touchHurt,false);assert.equal(e.box.isEmpty(),true);
  };
  reset();stomp();const killPoints=p.points+p.comboPoints*Math.max(1,p.comboMult),lives=p.lives;wait(180);
  assert.ok(e.crabCarcass&&e.group.visible);assert.equal(p.points,killPoints);assert.equal(p.lives,lives);
  assert.equal(p.isBailing,false);assert.equal(p.grounded,true,'carcass cannot become a second bounce box');
  const body=e.group.getObjectByName('Enemy_grunt_Aim'),carcass=e.group.getObjectByName('CoralCrab_Stomped');
  assert.ok(carcass);assert.equal(body.visible,false);assert.deepEqual(e.group.scale.toArray(),[1,1,1]);
  const bounds=new THREE.Box3().setFromObject(carcass,true);
  assert.ok(Math.abs(bounds.min.y-e.group.position.y)<1e-5);assert.ok(Math.abs(bounds.max.y-e.group.position.y-.8707804)<1e-5);
  assert.equal(carcass.position.y,0,'finite settle must end');
  const stable=carcass.matrix.clone();wait(60);assert.ok(carcass.matrix.equals(stable));
  reports.push('real falling stomp, bounce, persistent harmless X-eye model, finite settle');

  p.pos.set(-1.2,0,0);p.prevPos.copy(p.pos);p.speed=0;p.walkVelocity.set(0,0,0);
  const points=p.points;step(makeInput({spinPressed:true,spinHeld:true}));
  assert.equal(e.crabCarcass,undefined);assert.equal(e.state,'crab-carcass-flung');assert.ok(e.flungVel?.y>0);
  assert.equal(p.points,points,'carcass spin cannot award another kill');
  assert.equal(body.visible,false);assert.ok(e.group.getObjectByName('CoralCrab_Stomped'));
  wait(12);assert.equal(level.crates[0].alive,false,'flung carcass uses ordinary crate-smashing debris');
  wait(100);assert.equal(e.group.visible,false);
  reports.push('fresh F spin, no duplicate kill, X-eye body in flight, crate hit, finite removal');

  reset();step(makeInput({spinPressed:true,spinHeld:true}));
  assert.equal(e.alive,false);assert.equal(e.crabCarcass,undefined);assert.ok(e.flungVel);
  assert.equal(e.body.visible,true);assert.equal(e.group.getObjectByName('CoralCrab_Stomped'),undefined);
  reset();level.killEnemy(e);assert.equal(e.crabCarcass,undefined);wait(10);assert.equal(e.group.visible,false);
  reports.push('spin/direct non-stomp deaths keep their original artwork and lifetime');

  reset();stomp();wait(40);p.pos.set(-.7,0,0);p.prevPos.copy(p.pos);p.speed=0;p.vVel=0;
  p.state='ride';p.grounded=true; // native attack identity guards even overlapping frames
  e.crabCarcass.lastSpin=p.debrisSpinToken;p.spinTimer=.3;p.spinBox.copy(e.crabCarcass.box);p.collide(level);
  assert.ok(e.crabCarcass,'same attack cannot erase the new body');
  p.debrisSpinToken={};p.ropeSpinSmash(level);assert.equal(e.crabCarcass,undefined);assert.ok(e.flungVel);
  reports.push('same-attack guard and a fresh rope-spin fling');

  for(const hard of [false,true]){
   level.reset(hard);level.update(0);assert.equal(e.alive,true);assert.equal(e.crabCarcass,undefined);assert.equal(e.flungVel,undefined);
   assert.equal(e.body.visible,true);assert.equal(e.group.getObjectByName('CoralCrab_Stomped'),undefined);
   level.killEnemy(e,undefined,undefined,undefined,'stomp');assert.ok(e.crabCarcass);assert.equal(level.killEnemy(e),false);
  }
  for(const skin of ['ghostknight','ghostfood','ghostcake']){
   level.reset(true);e.group.userData.ghostSkin=skin;level.update(0);level.killEnemy(e,undefined,undefined,undefined,'stomp');
   assert.equal(e.crabCarcass,undefined);delete e.group.userData.ghostSkin;
  }
  reports.push('soft/hard resets, once-only kill and ghost-skin isolation');
  console.log('Crab carcass: '+reports.join('; ')+'. Full Meshy geometry/provenance verified.');
 },{levelEntry:{id:'crab-carcass-test',name:'Crab carcass test',data:{v:1,name:'Crab carcass test',spawn:[-1.2,0,0],killY:-20,components:[
  {t:'platform',p:[0,-.5,0],s:[40,1,40]},
  {t:'enemy',foe:'grunt',p:[0,0,0],range:0,speed:0},
  {t:'crate',p:[4.2,1.3,0]},
  {t:'gate',p:[0,0,-18]},
 ]}}});
}finally{GLTFLoader.prototype.loadAsync=original;}
