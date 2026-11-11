import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const file=process.argv[2];
if(!file)throw new Error('Pass the external motion.json');
const bank=JSON.parse(await readFile(file,'utf8'));
await withSkateRuntime(async({server,player:p,level,THREE,CONST})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=createJakDirectSuite(a.createPlayerStarterAnimationSuite(binding.definition),binding.definition,bank);
  const runtime=createCharacterAnimationRuntime(p,suite);
  const tick=(input={})=>{p.step(CONST.fixedStep,makeInput(input),level);level.update(CONST.fixedStep);p.commitRenderStep(level);};
  const reset=(flip=false)=>{p.enterLevel('jak-ledge-flip');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip};runtime.restart();};
  let frames=0;
  const flight=(flip,hold,move,double=false)=>{
    reset(flip);const trace=[],clips=new Set();let second=-1,air=false;
    for(let f=0;f<200;f++){
      const input={moveY:move,jumpPressed:f===60,jumpHeld:f>=60&&f<60+hold,jumpReleased:f===60+hold};
      if(double&&air&&second<0&&p.vVel<2){second=f;input.jumpPressed=input.jumpHeld=true;}
      if(second>=0&&f===second+1)input.jumpReleased=true;
      tick(input);air||=!p.grounded;clips.add(runtime.activeClipId);
      trace.push([p.state,p.grounded,p.freeSkate,p.airFromSkate,...p.pos.toArray(),p.vVel,...p.walkVelocity.toArray()]);frames++;
      for(const joint of binding.joints.values())assert.ok([...joint.position.toArray(),...joint.quaternion.toArray(),...joint.scale.toArray()].every(Number.isFinite));
    }
    return {trace,clips};
  };
  const flights=[];
  for(const [hold,move,double] of [[1,0,false],[35,0,false],[18,1,false],[35,0,true],[90,1,false]]){
    const before=flight(false,hold,move,double),after=flight(true,hold,move,double);
    assert.deepEqual(after.trace,before.trace,'flip presentation changed the physics or skate gesture');
    // Only a running launch at the live 8.85 m/s cutoff should roll. Vertical
    // and tiny travel jumps deliberately retain the upright jump family.
    if(hold<90)assert.equal(after.clips.has('player.jak-flip'),move===1,'takeoff-speed flip selection');
    if(double)assert.ok(after.clips.has('player.double-jump'),'flip swallowed double jump');
    if(hold===90)assert.ok(after.trace.some(t=>t[2]),'hold-to-skate failed');
    flights.push({hold,move,double,clips:[...after.clips]});
  }
  const wall=level.walls.find(w=>Math.abs(w.max.y-3.35)<.01);
  assert.ok(wall,'fixture wall');
  let maxGrip=0;const ledges=[];
  for(const side of [-1,0,1]){
    reset(true);p.pos.set(20,2.35,-1.1);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-1;
    p.footJumpStudyLaunch={...JAK_DIRECT_PHYSICS,flip:true};
    p.lastVelX=side*4;p.lastVelZ=-4;p.walkVelocity.set(side*4,0,-4);p.rawInput=makeInput({moveY:1});
    assert.ok(p.tryLedgeGrab(wall,level),'real ledge detector rejected the approach');
    assert.deepEqual(p.footJumpStudyLaunch,{...JAK_DIRECT_PHYSICS,flip:false},'catch must cancel only the visual flip');
    const clips=new Set();
    for(let f=0;f<280;f++){
      tick();clips.add(runtime.activeClipId);frames++;
      if(f>12&&p.state==='hang'&&p.ledgePhase==='grip')maxGrip=Math.max(maxGrip,p.ledgeGripError);
      assert.equal(p.state,'hang');
    }
    assert.ok(clips.has(side>0?'player.jak-ledge-left':side<0?'player.jak-ledge-right':'player.jak-ledge-catch'));
    assert.ok(clips.has('player.hang')&&clips.has('player.jak-hang-shift'),'both source hold poses must play');
    if(side===0){
      const start=p.pos.x;p.camDir.set(0,0,-1);let planted=0;
      let previous=p.gloveLeft.gripSocket.getWorldPosition(new THREE.Vector3());
      for(let f=0;f<35;f++){
        tick({moveX:f<25?.6:0});frames++;
        const now=p.gloveLeft.gripSocket.getWorldPosition(new THREE.Vector3());
        if(now.distanceTo(previous)<.002)planted++;
        previous=now;assert.ok(p.ledgeGripError<.025,'shimmy glove contact');
      }
      // (Three fifths of what that push covers in the time, at whatever pace the hands set.)
      assert.ok(p.pos.x>start+.15*p.ledgeHands.traverseSpeed,'shimmy movement was lost');
      assert.ok(planted>5,'shimmy slid both hands continuously');
      tick({jumpPressed:true,jumpHeld:true});
      for(let f=0;f<90;f++){tick();clips.add(runtime.activeClipId);frames++;}
      assert.ok(clips.has('player.climb'));assert.ok(p.grounded&&p.pos.y>3.59,'pull-up did not finish supported');
    }else{
      p.camDir.set(0,0,-1);for(let f=0;f<30;f++){tick({moveY:-1});clips.add(runtime.activeClipId);frames++;}
      assert.ok(clips.has('player.jak-ledge-off'),'drop missed source release');assert.notEqual(p.state,'hang');
    }
    ledges.push({side,clips:[...clips]});
  }
  assert.ok(maxGrip<.025,`gloves missed ledge: ${maxGrip}`);
  runtime.dispose();console.log('PASS Jak ledge family, glove contacts, flip/physics parity and skate controls',JSON.stringify({frames,maxGrip,flights,ledges},null,2));
},{levelEntry:{id:'jak-ledge-flip',name:'Ledge/flip test',data:{v:1,name:'Ledge/flip test',spawn:[0,.02,5],killY:-30,
components:[{t:'platform',p:[0,-.5,0],s:[200,1,200]},{t:'platform',p:[20,1.8,-4],s:[8,3.6,5]},{t:'gate',p:[0,0,-90]}]}}});
