import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const source={v:1,name:'Trampoline hard landing',spawn:[0,.15,0],killY:-80,components:[
  {t:'platform',p:[0,-.5,0],s:[240,1,400],nm:'Hard floor',surface:'concrete',edgeGrinding:false},
  {t:'trampoline',p:[0,0,0],s:[6,.2,6],speed:32,cycle:1,nm:'Test spring'},
  {t:'gate',p:[100,0,-180]},
]};
await withBlockworksRuntime(async({p,l,server,THREE,TUNING})=>{
  const {createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding}=await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const {sampleLaunchLanding,tuneLaunchBackLean,LAUNCH_CLIPS}=await server.ssrLoadModule('/src/animation/launchJump.ts');
  const {sampleComposedClip,createProceduralMotionContext}=await server.ssrLoadModule('/src/animation/index.ts');
  const rig=RigBinding.fromSculptRuntime(p.animationRig.root).definition;
  const suite=createPlayerStarterAnimationSuite(rig),runtime=createCharacterAnimationRuntime(p,suite);
  let previous={};
  const tick=(sample={})=>{
    const input=normalizeGameInput(sample,previous);previous={...input};p.rawInput=input;
    p.step(1/60,input,l);l.update(1/60);const pos=p.pos.clone(),vel=p.vVel;p.commitRenderStep(l);
    assert.ok(p.pos.distanceTo(pos)<1e-10&&p.vVel===vel,'presentation changed movement');
    assert.deepEqual(p.riderG.scale.toArray(),[1,1,1]);
  };
  const setup=(board)=>{
    p.respawn(l,true,true);previous={};p.freeSkate=board;p.airFromSkate=board;p.speed=board?8:0;
    for(let i=0;i<20&&!p.trampolineAir;i++)tick({jumpHeld:true});
    assert.ok(p.trampolineAir,'did not contact native trampoline');
  };
  try{
    const raw=sampleComposedClip(suite.clips.find(c=>c.id===LAUNCH_CLIPS.rise),.46,createProceduralMotionContext());
    const pitched=pose=>new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...pose.joints.root.quaternion),'XYZ').x;
    assert.ok(pitched(raw)<-.6);
    assert.ok(Math.abs(pitched(tuneLaunchBackLean(raw,TUNING.launchBackLean,rig)))<.11,'default still has a big backward arch');
    assert.ok(Math.abs(pitched(tuneLaunchBackLean(raw,0,rig)))<1e-8);
    assert.deepEqual(tuneLaunchBackLean(raw,1,rig).joints.root,raw.joints.root);
    for(const age of [-1,0,.5,1])assert.deepEqual(sampleLaunchLanding(age,.5),{compression:0,lift:0,rebound:0});
    for(const board of [false,true]){
      setup(board);
      for(let i=0;i<240&&!p.grounded;i++)tick({moveY:1});
      assert.ok(p.grounded&&!p.isBailing,'missed supported landing');
      assert.ok(p.launchLandingPresentation,`missing hard impact, board=${board}`);
      let maxLift=0;
      for(let i=0;i<42;i++){
        tick();const impact=p.launchLandingPresentation;
        if(impact)maxLift=Math.max(maxLift,impact.lift*TUNING.launchLandHeight*impact.strength);
        assert.ok(p.grounded,'visual rebound changed support');
      }
      assert.ok(maxLift>.1&&maxLift<=TUNING.launchLandHeight,'rebound height outside tuning');
      assert.equal(p.launchLandingPresentation,null,'landing did not settle');
      // Same native spring -> fresh second jump, before leaving the pad's air.
      setup(board);for(let i=0;i<20;i++)tick({moveY:1});
      const carry=Math.hypot(p.lastVelX,p.lastVelZ),loose=p.looseBoard;
      tick({moveY:1,jumpHeld:true});tick({moveY:1});
      assert.ok(p.emergencyEjectLandingPending,'spring second jump did not use shared move');
      assert.equal(p.doubleJumpAir,false,'standard double-jump pose still owns spring air');
      assert.equal(p.launchPresentation,null);
      if(!board)assert.equal(p.looseBoard,loose,'on-foot air jump spawned a board');
      assert.ok(Math.abs(p.speed-carry)<.5,'second jump lost directional momentum');
      for(let i=0;i<12;i++)tick();
      assert.ok(p.animationIntent.motion.inputs.forwardRollTuck>.4,'missing Abandon Ship-style flip');
      const pop=p.launchVy;tick({jumpHeld:true});tick();assert.equal(p.launchVy,pop,'third jump rearmed in air');
      for(let i=0;i<240&&!p.grounded;i++)tick();
      assert.equal(p.animationClipHint,'player.roll-land','missing shared landing roll');
      assert.equal(p.launchLandingPresentation,null,'rebound replaced the landing roll');
      for(let i=0;i<80;i++)tick();
      assert.equal(p.animationClipHint,'player.idle');
    }
    // Ordinary foot jumping remains the ordinary double jump.
    p.respawn(l,true,true,{position:new THREE.Vector3(30,.05,0),heading:new THREE.Vector3(0,0,-1)});previous={};
    tick({jumpHeld:true});tick();for(let i=0;i<4;i++)tick();tick({jumpHeld:true});tick();
    assert.equal(p.doubleJumpAir,true,'ordinary double jump changed');
    for(let i=0;i<180&&!p.grounded;i++)tick();
    assert.equal(p.launchLandingPresentation,null,'ordinary landing acquired spring rebound');
    console.log('PASS trampoline hard rebound and finite settle on foot/board; live lean; shared second jump, momentum, flip, roll, no third jump; ordinary jump unchanged');
  }finally{runtime.dispose();}
},{source:()=>source,levelId:'trampoline-impact'});
