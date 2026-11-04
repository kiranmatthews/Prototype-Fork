import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createServer } from 'vite';
const fixture=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const oldLoad=GLTFLoader.prototype.loadAsync,oldWarn=console.warn;
console.warn=(...args)=>{if(!args.some(v=>v?.response?.status===404&&v.response.url===''))oldWarn(...args);};
const requested=[];
GLTFLoader.prototype.loadAsync=async function(url,...args){
  requested.push(String(url));
  if(!/\/(tribal-guardian|grunt|crab-stomped)\.glb$/.test(String(url)))return oldLoad.call(this,url,...args);
  const file=String(url).split('/').at(-1),bytes=await readFile(new URL('../public/enemies/'+file,import.meta.url));
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(()=>({name:'NoPixelsInPhysics',loadTexture:()=>Promise.resolve(null)})).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}}),visuals=[],levels=[];
let profile,saved;
try{
  const {createEnemyVisual}=await server.ssrLoadModule('/src/enemies/runtime.ts');
  const {TRIBAL_GUARDIAN_ELASTICITY_PROFILE}=await server.ssrLoadModule('/src/enemies/elasticity.ts');
  profile=TRIBAL_GUARDIAN_ELASTICITY_PROFILE;saved={...profile};
  const a=createEnemyVisual('grunt',{appearance:'tribal'}),b=createEnemyVisual('grunt',{appearance:'tribal'});visuals.push(a,b);
  await Promise.all(visuals.map(v=>v.ready));assert.equal(a.diagnostics.status,'ready');assert.equal(a.diagnostics.skinnedMeshes,1);
  assert.deepEqual(a.diagnostics.clips,['walk','idle','fall']);assert.equal(a.diagnostics.carcass,undefined);assert.equal(a.diagnostics.mappedNodes.hindFootLeft,'mixamorigLeftFoot');
  assert.notEqual(a.group.getObjectByName('mixamorigHead'),b.group.getObjectByName('mixamorigHead'));
  let mesh;a.group.traverse(node=>{if(node.isSkinnedMesh)mesh=node;});
  assert.equal(mesh.geometry.index.count/3,16132);assert.ok(mesh.skeleton.bones.length>=65);
  const joints=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<weights.count;i++){let sum=0;for(let j=0;j<4;j++){sum+=weights.getComponent(i,j);assert.ok(joints.getComponent(i,j)<mesh.skeleton.bones.length);}assert.ok(Math.abs(sum-1)<1e-4);}
  let lowest=Infinity,contactError=0,stretchMin=Infinity,stretchMax=-Infinity,maxRootOffset=0;
  const p=new T.Vector3(),q=new T.Vector3();
  for(let i=0;i<300;i++){
    const frame={state:'patrol',stateTime:i/60,time:i/60,speed:2.8,verticalVelocity:0,grounded:true,alive:true,flung:false};
    Object.assign(profile,{idle:0,walk:0,defeat:0});b.update(1/60,frame);Object.assign(profile,saved);a.update(1/60,frame);
    a.group.updateMatrixWorld(true);b.group.updateMatrixWorld(true);
    assert.deepEqual(a.group.scale.toArray(),[1,1,1]);assert.equal(a.diagnostics.plantedFeet.frontLeft,false);assert.equal(a.diagnostics.plantedFeet.frontRight,false);
    for(const side of ['Left','Right'])if(a.diagnostics.plantedFeet['hind'+side]){
      a.group.getObjectByName('mixamorig'+side+'Foot').getWorldPosition(p);b.group.getObjectByName('mixamorig'+side+'Foot').getWorldPosition(q);contactError=Math.max(contactError,p.distanceTo(q));
    }
    const m=a.group.getObjectByName('mixamorigSpine2').matrix.elements,s=Math.hypot(m[4],m[5],m[6]);stretchMin=Math.min(stretchMin,s);stretchMax=Math.max(stretchMax,s);
    const h=a.group.getObjectByName('mixamorigHips');maxRootOffset=Math.max(maxRootOffset,Math.hypot(h.position.x,h.position.z));
    if(i%5===0)lowest=Math.min(lowest,new T.Box3().setFromObject(a.group,true).min.y);
  }
  assert.ok(contactError<1e-5,`segment elasticity moved a planted ankle: ${contactError}`);
  assert.ok(stretchMax-stretchMin>.008,'torso must visibly compress and stretch');
  assert.ok(lowest>-.025,`walk intersects ground: ${lowest}`);assert.ok(maxRootOffset<.13,'authored travel must not leave gameplay root');
  let fallLowest=Infinity;
  for(let i=0;i<180;i++){
    a.update(1/60,{state:'defeated',stateTime:i/60,time:i/60,speed:0,verticalVelocity:0,grounded:true,alive:false,flung:false});
    if(i%3===0)fallLowest=Math.min(fallLowest,new T.Box3().setFromObject(a.group,true).min.y);
  }
  assert.ok(fallLowest>0,`fall intersects ground: ${fallLowest}`);
  assert.equal(a.diagnostics.activeClip,'fall');
  const before=[];a.group.traverse(node=>before.push(...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()));
  a.update(1,{state:'defeated',stateTime:4,time:4,speed:0,verticalVelocity:0,grounded:true,alive:false,flung:false});
  const after=[];a.group.traverse(node=>after.push(...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()));
  assert.deepEqual(after,before,'defeat settles finitely');a.reset();a.update(0,{state:'patrol',stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false});assert.equal(a.diagnostics.activeClip,'idle');
  const {Level}=await server.ssrLoadModule('/src/level.ts'),{Player}=await server.ssrLoadModule('/src/player.ts');
  const scene=new T.Scene(),level=new Level(scene,{id:'guardian-test',name:'Guardian test',data:{v:1,name:'Guardian test',spawn:[0,1,6],killY:-20,components:[
    {t:'platform',p:[0,-.5,0],s:[80,1,80]},
    {t:'enemy',foe:'grunt',tex:'tribal-weave',p:[0,0,0],range:8,speed:2.8},
    {t:'enemy',foe:'grunt',p:[18,0,0],range:8,speed:2.8},
    {t:'gate',p:[0,0,-20]},
  ]}});levels.push(level);await Promise.all(level.enemies.map(e=>e.visual.ready));
  const [guardian,crab]=level.enemies;const tick=dt=>{level.time+=dt;level.updateEnemies(dt);};tick(0);
  assert.equal(guardian.visual.diagnostics.appearance,'tribal');assert.equal(guardian.box.max.y,2.43);assert.equal(crab.box.max.y,1.1);
  let turned=0,maxYaw=0,previous=guardian.group.rotation.y;
  for(let i=0;i<1000;i++){tick(1/60);if(guardian.state==='turn')turned++;maxYaw=Math.max(maxYaw,Math.abs(guardian.group.rotation.y-previous));previous=guardian.group.rotation.y;assert.ok(guardian.group.position.x>=guardian.x0&&guardian.group.position.x<=guardian.x1);}
  assert.ok(turned>30);assert.ok(maxYaw<.14,`turn snaps: ${maxYaw}`);
  const player=new Player(scene);player.rawInput={moveX:0,moveY:0,consumeEdges(){}};
  for(const kind of ['spin','stomp']){
    level.reset(true);tick(0);player.pos.copy(guardian.group.position);player.prevPos.copy(player.pos);player.invulnTimer=10;player.debrisSpinToken={};
    if(kind==='spin'){player.state='ride';player.spinTimer=.3;player.spinBox.copy(guardian.box);}
    else{player.state='air';player.spinTimer=0;player.vVel=-5;player.pos.y=guardian.box.max.y-.08;player.prevPos.y=guardian.box.max.y+.2;player.spinBox.makeEmpty();}
    player.playerBox.setFromCenterAndSize(player.pos.clone().add(new T.Vector3(0,.9,0)),new T.Vector3(.6,1.8,.6));level.playerPos.copy(player.pos);player.collide(level);
    assert.equal(guardian.alive,false,kind+' must defeat guardian');assert.equal(guardian.crabCarcass,undefined,kind+' must not create a crab');assert.equal(guardian.state,'defeated');
    if(kind==='stomp'){assert.ok(player.vVel>0,'stomp bounces player');tick(.2);assert.equal(guardian.group.visible,true,'fall remains readable');tick(1);assert.equal(guardian.group.visible,false);}
  }
  level.reset(true);tick(0);assert.ok(guardian.alive&&guardian.group.visible);level.killEnemy(crab,undefined,{},undefined,'stomp');assert.ok(crab.crabCarcass,'ordinary crab retains stomped model');
  const {TRIBAL_RUN_LEVEL}=await server.ssrLoadModule('/src/levels/tribal-run.ts');const enemies=TRIBAL_RUN_LEVEL.components.filter(c=>c.t==='enemy');assert.equal(enemies.length,35);assert.ok(enemies.every(c=>c.tex==='tribal-weave'));
  console.log(JSON.stringify({pass:true,triangles:16132,joints:65,lowestWalkPoint:lowest,lowestFallPoint:fallLowest,plantedAnkleError:contactError,torsoScaleRange:[stretchMin,stretchMax],maximumTurnRadiansPerFrame:maxYaw,tribalEnemies:enemies.length,spinAndStomp:true,ordinaryCrabPreserved:true}));
}finally{
  if(profile&&saved)Object.assign(profile,saved);for(const level of levels)level.dispose();for(const visual of visuals)visual.dispose();await server.close();GLTFLoader.prototype.loadAsync=oldLoad;console.warn=oldWarn;
}
