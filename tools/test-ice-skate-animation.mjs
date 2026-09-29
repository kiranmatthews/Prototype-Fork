import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
import {makeInput} from './jungle-cup-harness.mjs';
import {normalizeGameInput} from './blockworks-runner.mjs';

const harness=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
new Function('noop',harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const fixtures=[],warn=console.warn,error=console.error;
console.warn=(...a)=>{if(!/failed|GLB|procedural skateboard/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
try {
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {Level}=await server.ssrLoadModule('/src/level.ts');
  const {TUNING,CONST}=await server.ssrLoadModule('/src/tuning.ts');
  const {IceSkateMotion,sampleIceSkateMotion,ICE_SKATE_CYCLE_SECONDS}=await server.ssrLoadModule('/src/iceSkateMotion.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const originalTuning=JSON.stringify(TUNING),dt=CONST.fixedStep;
  const motion=new IceSkateMotion(),input={eligible:true,onIce:true,speed:18,grip:.08,steering:1,braking:false};
  const seam0=sampleIceSkateMotion(0,1,.7,.3),seam1=sampleIceSkateMotion(ICE_SKATE_CYCLE_SECONDS,1,.7,.3);
  for(const k of ['knee','chestPitch','chestRoll','headRoll'])assert.ok(Math.abs(seam0[k]-seam1[k])<1e-9);
  assert.ok(!Object.keys(seam0.deformations).some(k=>k.includes('leg.')),'ice must preserve planted leg lengths');
  for(let i=0;i<60;i++)motion.step(dt,input);
  assert.ok(motion.step(dt,input).weight>.9);
  for(let i=0;i<16;i++)motion.step(dt,{...input,onIce:false});
  assert.equal(motion.step(dt,{...input,onIce:false}),null,'dry exit must settle finitely');
  motion.step(dt,input);assert.equal(motion.step(dt,{...input,eligible:false}),null,'actions must own their pose');

  const create=(name,disabled=false,legacy=false)=>{
    const scene=new THREE.Scene(),level=new Level(scene,{id:name,name,data:{v:1,name,spawn:[0,.02,10],killY:-30,components:[
      {t:'platform',p:[0,-.5,0],s:[200,1,200],slip:true,...(legacy?{}:{iceGrip:.08}),edgeGrinding:false},
      {t:'platform',p:[0,-.5,-200],s:[400,1,200],edgeGrinding:false},{t:'gate',p:[150,0,-280]},
    ]}});
    scene.updateMatrixWorld(true);const p=new Player(scene);p.enterLevel(name);p.rawInput=makeInput();
    if(disabled)p.iceSkateMotion.step=()=>null;
    const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
    p.respawn(level,true);const f={p,level,runtime};fixtures.push(f);return f;
  };
  const physics=p=>({pos:p.pos.toArray(),speed:p.speed,heading:p.axisF.toArray(),vertical:p.vVel,walk:p.walkVelocity.toArray(),
    state:p.state,grounded:p.grounded,board:p.freeSkate,charge:p.chargeTimer,brake:p.brakeT,bail:p.isBailing,deaths:p.totalDeaths});
  let frames=0,activeFrames=0,maxFoot=0,maxBoardDifference=0,maxSteer=0,maxBrace=0,maxArmDifference=0;
  for(const legacy of [false,true]) {
    const on=create('ice-skate-on-'+legacy,false,legacy),off=create('ice-skate-off-'+legacy,true,legacy);
    for(const f of [on,off])f.p.stance=legacy?-1:1;
    let previous=makeInput();
    const tick=(sample={})=>{
      const input=normalizeGameInput(sample,previous);previous={...input};
      for(const f of [on,off]){f.p.step(dt,makeInput(input),f.level);f.level.update(dt);f.p.commitRenderStep(f.level);}
      frames++;assert.deepEqual(physics(on.p),physics(off.p),'ice presentation changed skating physics');
      const pose=on.p.boardG.userData.iceSkateMotion;
      if(pose){
        activeFrames++;maxSteer=Math.max(maxSteer,Math.abs(pose.steering));maxBrace=Math.max(maxBrace,pose.brace);
        maxFoot=Math.max(maxFoot,on.p.boardG.userData.skateContact.footError);
        maxBoardDifference=Math.max(maxBoardDifference,on.p.boardG.getWorldPosition(new THREE.Vector3()).distanceTo(off.p.boardG.getWorldPosition(new THREE.Vector3())));
        maxArmDifference=Math.max(maxArmDifference,on.p.armR.quaternion.angleTo(off.p.armR.quaternion));
      }
      for(const joint of on.p.animationRig.joints)assert.ok([...joint.node.position.toArray(),...joint.node.quaternion.toArray(),...joint.node.scale.toArray()].every(Number.isFinite));
      if(on.p.state==='air'||!on.p.freeSkate)assert.equal(pose,null,'ice cycle leaked into foot or air animation');
      return pose;
    };
    const hold=(n,input)=>{for(let i=0;i<n;i++)tick(input);};
    hold(30,{});assert.equal(on.p.boardG.userData.iceSkateMotion,null);
    hold(150,{moveY:1,jumpHeld:true});assert.ok(on.p.boardG.userData.iceSkateMotion,'ice skate cycle never entered');
    tick({});assert.equal(on.p.state,'air');
    hold(110,{moveY:1});hold(45,{});
    assert.ok(on.p.boardG.userData.iceSkateMotion,'ice coasting lost its cycle');
    hold(75,{moveX:.8,moveY:.3});hold(80,{grabHeld:true});
    // A fresh approach crosses the actual ice/dry boundary under normal input.
    for(const f of [on,off]){f.p.respawn(f.level,true);f.runtime.restart();}
    previous=makeInput();let dry=0;
    for(let i=0;i<1600&&dry<20;i++) {tick({moveY:1,jumpHeld:true});if(!on.p.groundHit?.slippy)dry++;}
    assert.equal(dry,20,'route never reached dry ground');
    assert.equal(on.p.boardG.userData.iceSkateMotion,null,'ice cycle persisted beyond dry settle');
    // Higher-priority presentation owners cancel the ice cycle immediately.
    const exclusions=[['manual',p=>p.manualing=1],['vert',p=>p.groundHit.normal.y=.3],
      ['grind',p=>p.state='grind'],['bail',p=>p.bailDownT=.3],['map',p=>p.worldMapBaseScale=1],
      ['revert',p=>p.revertPoseT=.2],['results',p=>p.competitionFinishT=.2]];
    for(const [name,setup] of exclusions){on.p.respawn(on.level,true);on.p.freeSkate=true;on.p.speed=12;on.p.skateMountT=-1;on.p.groundHit=on.p.queryGround(on.level);setup(on.p);on.p.syncVisual(makeInput(),dt);assert.equal(on.p.boardG.userData.iceSkateMotion,null,name+' ownership');}
  }
  assert.ok(activeFrames>400&&maxArmDifference>.15,'ice needs a visible dedicated correction cycle');
  assert.ok(maxSteer>.25&&maxBrace>.5,'steering and braking must alter the performance');
  assert.ok(maxFoot<.035,'ice animation pulled a foot off the deck');
  assert.ok(maxBoardDifference<1e-5,'ice animation moved the board off its normal path');
  assert.equal(JSON.stringify(TUNING),originalTuning);
  console.log(JSON.stringify({frames,activeFrames,maxFoot,maxBoardDifference,maxArmDifference,maxSteer,maxBrace}));
  console.log('PASS ice skating cycle, steering/brake response, planted feet, action priority, finite dry settle and exact physics parity');
} finally {for(const f of fixtures){f.runtime.dispose();f.level.dispose();}await server.close();console.warn=warn;console.error=error;}
