import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const source={v:1,name:'Trampoline air jump',spawn:[0,.15,0],killY:-80,components:[
  {t:'platform',p:[0,-.5,0],s:[240,1,400],nm:'Hard floor',edgeGrinding:false},
  {t:'trampoline',p:[0,0,0],s:[6,.2,6],speed:56,amp:1,cycle:1,nm:'Test spring'},
  {t:'gate',p:[100,0,-180]},
]};
await withBlockworksRuntime(async({p,l,server,THREE,TUNING})=>{
  const {createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding}=await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const {tuneLaunchBackLean,LAUNCH_CLIPS}=await server.ssrLoadModule('/src/animation/launchJump.ts');
  const {sampleComposedClip,createProceduralMotionContext}=await server.ssrLoadModule('/src/animation/index.ts');
  const {LaunchCamera}=await server.ssrLoadModule('/src/launchCamera.ts');
  const rig=RigBinding.fromSculptRuntime(p.animationRig.root).definition;
  const suite=createPlayerStarterAnimationSuite(rig),runtime=createCharacterAnimationRuntime(p,suite);
  const savedTuning={...TUNING},shot=new LaunchCamera(),camera=new THREE.PerspectiveCamera(49,16/9,.1,1000);
  let previous={},cameraDelta=0;
  const tick=(sample={})=>{
    const input=normalizeGameInput(sample,previous);previous={...input};p.rawInput=input;
    p.step(1/60,input,l);l.update(1/60);const pos=p.pos.clone(),vel=p.vVel;p.commitRenderStep(l);
    assert.ok(p.pos.distanceTo(pos)<1e-10&&p.vVel===vel,'presentation changed movement');
    assert.deepEqual(p.riderG.scale.toArray(),[1,1,1]);
    const old=camera.position.clone();shot.restore(camera);
    camera.position.copy(p.pos).add(new THREE.Vector3(0,8,12));camera.lookAt(p.pos);
    shot.apply(camera,p.pos,p.launchCameraPresentation,1/60,false);
    cameraDelta=camera.position.distanceTo(old);
    assert.equal(camera.fov,49,'spring camera changed the lens');
  };
  const setup=(board)=>{
    const lastLaunch=p.trampolineLaunchId;
    p.respawn(l,true,true);previous={};p.freeSkate=board;p.airFromSkate=board;p.speed=board?8:0;
    shot.restore(camera);shot.apply(camera,p.pos,null,1/60,true);
    for(let i=0;i<20&&p.trampolineLaunchId===lastLaunch;i++)tick({jumpHeld:true});
    assert.ok(p.trampolineAir&&!p.grounded&&p.trampolineLaunchId>lastLaunch,'did not contact a fresh native trampoline');
  };
  try{
    const raw=sampleComposedClip(suite.clips.find(c=>c.id===LAUNCH_CLIPS.rise),.46,createProceduralMotionContext());
    const pitched=pose=>new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...pose.joints.root.quaternion),'XYZ').x;
    assert.ok(pitched(raw)<-.6);
    assert.ok(Math.abs(pitched(tuneLaunchBackLean(raw,TUNING.launchBackLean,rig)))<.11,'default still has a big backward arch');
    assert.ok(Math.abs(pitched(tuneLaunchBackLean(raw,0,rig)))<1e-8);
    assert.deepEqual(tuneLaunchBackLean(raw,1,rig).joints.root,raw.joints.root);

    for(const board of [false,true])for(const descending of [false,true]){
      setup(board);
      for(let i=0;i<20;i++)tick({moveY:1});
      if(descending)for(let i=0;i<180&&p.vVel>=0;i++)tick({moveY:1});
      const carry=Math.hypot(p.lastVelX,p.lastVelZ),loose=p.looseBoard;
      const original=p.launchCameraPresentation,weight=shot.diagnostics.weight;
      assert.ok(original,'missing spring camera before second jump');
      tick({moveY:1,jumpHeld:true});tick({moveY:1});
      assert.ok(p.emergencyEjectLandingPending,'spring second jump did not use shared move');
      assert.equal(p.doubleJumpAir,false,'standard double-jump pose still owns spring air');
      assert.equal(p.launchPresentation,null,'spring pose masked the second-jump flip');
      assert.equal(p.launchCameraPresentation.id,original.id,'second jump restarted the camera');
      assert.equal(p.launchCameraPresentation.strength,original.strength,'second pop weakened the camera');
      assert.ok(shot.diagnostics.weight>=weight-1e-6,'second jump released the launch camera');
      assert.ok(cameraDelta<2,'second jump snapped the camera');
      if(!board)assert.equal(p.looseBoard,loose,'on-foot air jump spawned a board');
      assert.ok(Math.abs(p.speed-carry)<.5,'second jump lost directional momentum');
      for(let i=0;i<12;i++)tick();
      assert.ok(p.animationIntent.motion.inputs.forwardRollTuck>.4,'missing Abandon Ship-style flip');
      const pop=p.launchVy;tick({jumpHeld:true});tick();assert.equal(p.launchVy,pop,'third jump rearmed in air');
      const clips=new Set();let resumedFloat=false;
      for(let i=0;i<240&&!p.grounded&&!p.isBailing;i++){
        tick();clips.add(p.animationClipHint);
        if(p.grounded||p.isBailing)break;
        assert.equal(p.launchCameraPresentation?.id,original.id,'camera stopped tracking during the second jump');
        assert.ok(shot.diagnostics.weight>=weight-1e-6,'camera faded during flight');
        assert.ok(camera.position.distanceTo(p.pos)<30,'camera lost the rider');
        if(p.flipTimer<=0){
          assert.ok([LAUNCH_CLIPS.float,LAUNCH_CLIPS.gather].includes(p.animationClipHint),
            `post-flip fell back to ${p.animationClipHint}`);
          assert.equal(p.launchSomersaultProgress,null,'post-flip restarted the automatic turn');
          resumedFloat ||= p.animationClipHint===LAUNCH_CLIPS.float;
        }
      }
      // The high/apex case has time for a sustained float; the low/early pop
      // reaches the gather window as its flip finishes. Real huge drops bail.
      if(descending)assert.ok(resumedFloat,`missing trampoline fall after second jump, board=${board}`);
      assert.ok(clips.has(LAUNCH_CLIPS.gather),'missing spring landing gather');
      if(descending)assert.ok(p.isBailing,'genuine excessive drop lost its native bail');
      else assert.equal(p.animationClipHint,'player.roll-land','missing shared landing roll');
      assert.equal(p.launchCameraPresentation,null,'landing kept the spring camera active');
      for(let i=0;i<80;i++)tick();
      if(!descending)assert.equal(p.animationClipHint,'player.idle');
      assert.equal(shot.diagnostics.weight,0);
      console.log(JSON.stringify({board,descending,clips:[...clips]}));
    }

    const turnCase=(overrides={},late=false)=>{
      Object.assign(TUNING,savedTuning,overrides);setup(false);
      let first=null,finish=null,frames=0,last=0;
      for(let i=0;i<240&&!p.grounded;i++){
        const rise=p.launchCameraPresentation?.rise??0;
        tick({moveY:!late||rise>.7?1:0});
        const turn=p.launchSomersaultProgress;
        if(turn!==null){
          assert.ok(turn>=last&&Number.isFinite(turn),'turn reversed or became invalid');last=turn;
          if(turn>0&&turn<1){first??=p.launchPresentation.rise;frames++;}
          if(turn===1)finish??=p.launchPresentation.rise;
        }
      }
      return {first,finish,frames};
    };
    assert.ok(turnCase().frames>0,'default speed did not trigger the turn');
    assert.equal(turnCase({launchSomersault:0}).frames,0,'disabled turn still triggered');
    assert.equal(turnCase({launchSomersaultMinSpeed:30}).frames,0,'speed threshold ignored');
    assert.equal(turnCase({launchSomersaultDeadline:0}).frames,0,'closed trigger window ignored');
    assert.equal(turnCase({},true).frames,0,'late steering triggered a turn');
    const timed=turnCase({launchSomersaultMinSpeed:1,launchSomersaultStart:40,launchSomersaultEnd:80});
    assert.ok(timed.first>=.4&&timed.first<.45&&timed.finish>=.8&&timed.finish<.85,`turn timing sliders ignored: ${JSON.stringify(timed)}`);
    const slow=turnCase({launchSomersaultMinSpeed:1,launchSomersaultStart:10,launchSomersaultEnd:100});
    assert.ok(slow.frames>timed.frames,'wider turn window did not slow the turn');
    const crossed=turnCase({launchSomersaultMinSpeed:1,launchSomersaultStart:90,launchSomersaultDeadline:95,launchSomersaultEnd:50});
    assert.ok(crossed.frames>0&&crossed.finish>=.5&&crossed.finish<.55,'crossed slider bounds broke the turn');
    Object.assign(TUNING,savedTuning);

    // Ordinary foot jumping remains the ordinary double jump.
    p.respawn(l,true,true,{position:new THREE.Vector3(30,.05,0),heading:new THREE.Vector3(0,0,-1)});previous={};
    tick({jumpHeld:true});tick();for(let i=0;i<4;i++)tick();tick({jumpHeld:true});tick();
    assert.equal(p.doubleJumpAir,true,'ordinary double jump changed');
    assert.equal(p.launchCameraPresentation,null,'ordinary double jump acquired spring camera');
    console.log('PASS continuous spring camera; Abandon Ship flip -> trampoline float/gather -> roll on foot/board; trigger speed/window/timing controls; ordinary jump unchanged');
  }finally{Object.assign(TUNING,savedTuning);runtime.dispose();}
},{source:()=>source,levelId:'trampoline-air-jump'});
