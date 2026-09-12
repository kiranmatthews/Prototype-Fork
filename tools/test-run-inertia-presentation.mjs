import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
runInThisContext('const noop=()=>{};'+harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nconst held'))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn,error=console.error;
const assetLog=v=>/GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(v??''));
console.warn=(...a)=>{if(!assetLog(a[0]))warn(...a);};console.error=(...a)=>{if(!assetLog(a[0]))error(...a);};
try{
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {Level}=await server.ssrLoadModule('/src/level.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {wrapFacingAngle}=await server.ssrLoadModule('/src/runFacing.ts');
  const level=new Level(new THREE.Scene(),{id:'run-inertia',name:'Run inertia',data:{v:1,name:'Run inertia',spawn:[0,.02,0],killY:-20,
    components:[{t:'platform',p:[0,-.5,0],s:[100,1,160]},{t:'gate',p:[0,0,-75]}]}});
  const p=new Player(level.scene),control=new Player(level.scene);
  for(const player of [p,control]){player.enterLevel('run-inertia');player.respawn(level,true);}
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=a.createPlayerStarterAnimationSuite(binding.definition);
  const runtime=createCharacterAnimationRuntime(p,suite);
  const step=(moveY=0,extra={})=>{
    const input={moveX:0,moveY,...extra};p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);
    assert.ok(p.pos.distanceTo(control.pos)<1e-9,'presentation changed physical slide distance');
    assert.ok(p.walkVelocity.distanceTo(control.walkVelocity)<1e-9,'presentation changed momentum');
  };
  const hold=(direction,frames)=>{for(let f=0;f<frames;f++)step(direction);};
  hold(1,150);
  hold(-1,4);
  assert.ok(Math.abs(wrapFacingAngle(p.visualYaw-Math.PI))<1e-6,'body did not finish reversal in four frames');
  assert.ok(p.walkVelocity.z < -5,'old-direction slide inertia was removed');
  for(let f=0;f<55;f++){
    step(-1);assert.equal(runtime.activeClipId,'player.run','reversal crossed through idle');
    assert.ok(p.animationIntent.motion.normalizedSpeed>.95,'gait slowed with opposing physical momentum');
  }
  step(0);assert.equal(runtime.activeClipId,'player.run-stop');assert.ok(p.walkVelocity.length()>8,'skid arrested physics');
  let coastFrames=1,settleFrames=0;
  while(p.walkVelocity.length()>.001&&coastFrames<60){step(0);coastFrames++;assert.equal(runtime.activeClipId,'player.run-stop');}
  assert.ok(coastFrames>=25&&coastFrames<=28,'release coast duration changed');
  while(runtime.activeClipId==='player.run-stop'&&settleFrames<40){step(0);settleFrames++;}
  assert.ok(settleFrames>=12&&settleFrames<=18,'soft settle outlasted its short recovery');
  assert.equal(runtime.activeClipId,'player.idle');
  hold(.18,100);step(0);assert.notEqual(runtime.activeClipId,'player.run-stop','gentle analogue walk triggered a run skid');hold(0,60);
  hold(1,140);step(0);hold(0,5);assert.equal(runtime.activeClipId,'player.run-stop');
  step(-1);assert.equal(runtime.activeClipId,'player.run','renewed input is held behind stop animation');
  hold(-1,65);step(0);hold(0,5);
  p.chargedJump(1/60);control.chargedJump(1/60);step(0);
  assert.equal(p.state,'air');assert.notEqual(runtime.activeClipId,'player.run-stop','jump trapped in skid');
  const old={...structuredClone(suite),clips:suite.clips.filter(c=>c.id!=='player.run-stop'),
    metadata:{...suite.metadata,playerStarterCatalogVersion:28}};
  const migrated=a.reconcilePlayerStarterAnimationSuite(old,binding.definition);
  assert.equal(migrated.clips.length,old.clips.length+1);
  for(const clip of old.clips)assert.deepEqual(migrated.clips.find(c=>c.id===clip.id),clip,'existing authored clip overwritten');
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(migrated,binding.definition),migrated);
  runtime.dispose();level.dispose();
  console.log(`PASS fast facing leads untouched inertia; ${coastFrames}-frame skid, ${settleFrames}-frame settle, analogue/restart/jump guards, movement parity and saved clip addition`);
}finally{await server.close();console.warn=warn;console.error=error;}
