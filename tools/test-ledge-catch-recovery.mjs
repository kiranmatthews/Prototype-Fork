import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(gunzipSync(await readFile(new URL('../public/motion-study/jak/motion.json.gz',import.meta.url))));
await withSkateRuntime(async({server,player:p,level,THREE,CONST})=>{
  const {LedgeClimbInput}=await server.ssrLoadModule('/src/ledgeTraversal.ts');
  // Hold age starts at the catch, not at the approach. Strength jitter and
  // changed camera projection must not count as new directional input.
  for(const fps of [30,60,120])for(const held of [{moveX:0,moveY:1},{moveX:0,moveY:0,jumpHeld:true}]){
    const gate=new LedgeClimbInput();gate.reset(held);
    for(let f=1;f<=Math.floor(.75*fps);f++)assert.equal(gate.update(1/fps,held,held.moveY>0),false,`early hold at ${fps} Hz, frame ${f}`);
    assert.equal(gate.update(1/fps,held,held.moveY>0),true);
  }
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const rig=RigBinding.fromSculptRuntime(p.animationRig.root),base=createPlayerStarterAnimationSuite(rig.definition);
  const suite=createJakDirectSuite(base,rig.definition,bank),runtime=createCharacterAnimationRuntime(p,suite);
  const wall=level.walls.find(w=>Math.abs(w.max.y-3.35)<.01);
  const point=id=>rig.joints.get(id).getWorldPosition(new THREE.Vector3());
  let frames=0,cases=0;
  const tick=(input={})=>{p.step(CONST.fixedStep,makeInput(input),level);level.update(CONST.fixedStep);p.commitRenderStep(level);frames++;};
  const catchLedge=(input={},direct=true,side=0)=>{
    p.enterLevel('ledge-recovery');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy=direct?{...JAK_DIRECT_PHYSICS,flip:true}:null;
    runtime.setDocument(direct?suite:base);runtime.restart();p.camDir.set(0,0,-1);
    p.pos.set(0,2.35,-1.1);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-1;
    p.lastVelX=side*4;p.lastVelZ=-4;p.walkVelocity.set(side*4,0,-4);p.rawInput=makeInput(input);
    assert.ok(p.tryLedgeGrab(wall,level),'fixture failed to catch');
  };
  for(const direct of [false,true]){
    for(const held of [{moveY:1},{jumpHeld:true,jumpPressed:true},{moveY:1,jumpHeld:true}]){
      catchLedge(held,direct);
      for(let f=1;f<=45;f++){
        tick({...held,jumpPressed:false,moveX:held.moveY?Math.sin(f)*.035:0});
        assert.equal(p.ledgePhase,'grip',`inherited input climbed before 0.75s: ${direct}, ${f}`);
      }
      tick({...held,jumpPressed:false});assert.equal(p.ledgePhase,'climb');cases++;
    }
    for(const fresh of [{moveY:1},{jumpHeld:true,jumpPressed:true},{spinHeld:true,spinPressed:true}]){
      catchLedge({moveY:1,jumpHeld:true},direct);
      for(let f=0;f<10;f++)tick();
      tick(fresh);assert.equal(p.ledgePhase,'climb','fresh input did not climb promptly');cases++;
    }
    catchLedge({moveX:1},direct);
    for(let f=0;f<10;f++)tick({moveX:1});
    tick({moveY:1});assert.equal(p.ledgePhase,'climb','new inward direction required an unnecessary neutral frame');cases++;
    catchLedge({moveX:1},direct);
    for(let f=0;f<12;f++)tick({moveX:1});
    p.camDir.set(-1,0,0);
    for(let f=0;f<45;f++){tick({moveX:1});assert.equal(p.ledgePhase,'grip','camera manufactured a fresh input');}
    tick({moveX:1});assert.equal(p.ledgePhase,'climb');cases++;
    catchLedge({moveY:1},direct);
    for(let f=0;f<8;f++)tick({moveY:-1});
    assert.equal(p.state,'air','away input lost drop control');cases++;
  }
  const catches=[];
  for(const side of [-1,0,1]){
    catchLedge({moveY:1},true,side);
    let last=point('hips'),maxEndStep=0,maxGrip=0,compressed=false,rebounded=false;
    const clips=new Set();
    for(let f=0;f<160;f++){
      tick();clips.add(runtime.activeClipId);
      assert.equal(p.ledgePhase,'grip');assert.equal(p.state,'hang');
      const next=point('hips');if(f>55)maxEndStep=Math.max(maxEndStep,next.distanceTo(last));last=next;
      if(f>12)maxGrip=Math.max(maxGrip,p.ledgeGripError);
      if(runtime.activeClipId?.startsWith('player.jak-ledge-')){
        const torso=runtime.lastSampledPose.scalars['deform.torso.length'];
        compressed||=torso<.98;rebounded||=torso>1.005;
      }
    }
    assert.ok(compressed&&rebounded,'catch lost its finite compression/rebound');
    assert.ok(clips.has('player.hang'),'catch never settled into hang');
    assert.ok(maxEndStep<.08,`catch ending snapped ${maxEndStep}`);
    assert.ok(maxGrip<.025,`catch hands slipped ${maxGrip}`);
    catches.push({side,maxEndStep,maxGrip});cases++;
  }
  const climbs=[];
  for(const moving of [false,true]){
    catchLedge();for(let f=0;f<110;f++)tick();tick({jumpPressed:true,jumpHeld:true});
    let climbFrames=0,recoveryFrames=0,maxEndStep=0,last=point('chest'),minTorso=1,maxTorso=1;
    for(let f=0;f<125;f++){
      tick(moving?{moveY:1}:{});
      if(p.state==='hang'&&p.ledgePhase==='climb')climbFrames++;
      if(p.ledgeClimbRecovery>=0){
        recoveryFrames++;
        const torso=runtime.lastSampledPose.scalars['deform.torso.length'];
        minTorso=Math.min(minTorso,torso);maxTorso=Math.max(maxTorso,torso);
      }
      const next=point('chest');if(f>35)maxEndStep=Math.max(maxEndStep,next.distanceTo(last));last=next;
    }
    assert.ok(climbFrames>=34,'D pull-up was not slowed');
    assert.ok(recoveryFrames>=20,'pull-up settle ended too early');
    assert.equal(p.ledgeClimbRecovery,-1,'rebound did not finish');
    assert.ok(minTorso<.97&&maxTorso>1.005,'pull-up lost its compression/rebound');
    assert.ok(maxEndStep<(moving?.22:.10),`pull-up ending snapped ${maxEndStep}`);
    assert.ok(p.grounded&&p.pos.y>=3.59,'pull-up did not finish supported');
    assert.equal(runtime.activeClipId,moving?'player.run':'player.idle');
    if(moving)assert.ok(p.walkVelocity.length()>5,'rebound blocked running');
    climbs.push({moving,climbFrames,recoveryFrames,maxEndStep,minTorso,maxTorso});cases++;
  }
  runtime.dispose();console.log(JSON.stringify({status:'pass',frames,cases,catches,climbs},null,2));
},{levelEntry:{id:'ledge-recovery',name:'Ledge recovery',data:{v:1,name:'Ledge recovery',spawn:[0,.02,5],killY:-30,components:[
  {t:'platform',p:[0,-.5,0],s:[80,1,80]},{t:'platform',p:[0,1.8,-14],s:[20,3.6,25]},{t:'gate',p:[0,0,-35]}]}}});
