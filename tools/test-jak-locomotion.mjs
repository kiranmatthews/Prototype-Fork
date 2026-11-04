import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(await readFile(process.argv[2],'utf8'));
await withSkateRuntime(async({server,player:p,level,THREE})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const base=a.createPlayerStarterAnimationSuite(binding.definition);
  const direct=createJakDirectSuite(base,binding.definition,bank);
  const runtime=createCharacterAnimationRuntime(p,base);
  // The hybrid must retain a real stride from both sources, with matching
  // feet, rather than averaging opposite phases into a nearly static pose.
  runtime.setDocument(direct);
  const run=direct.clips.find(c=>c.id==='player.run'),nativeRun=base.clips.find(c=>c.id==='player.run');
  const motion=a.createProceduralMotionContext({normalizedSpeed:1,inputs:{[a.LOCOMOTION_WALK_BLEND_INPUT]:0}});
  let fromNative=0,fromJak=0,alignedError=0,oppositeError=0,maxMidpointError=0;
  for(let f=0;f<64;f++) {
    const phase=f/64,time=phase*run.duration,nativePhase=(phase+run.metadata.jakNativeRunPhase)%1;
    const hybrid=runtime.samplePoseAt(run,time,motion,true),jak=a.sampleComposedClip(run,time,motion);
    const native=a.sampleComposedClip(nativeRun,nativePhase*nativeRun.duration,motion);
    const opposite=a.sampleComposedClip(nativeRun,((nativePhase+.5)%1)*nativeRun.duration,motion);
    for(const id of ['hipLeft','hipRight','kneeLeft','kneeRight','shoulderLeft','shoulderRight']) {
      const qa=new THREE.Quaternion().fromArray(native.joints[id].quaternion);
      const qd=new THREE.Quaternion().fromArray(jak.joints[id].quaternion);
      const qh=new THREE.Quaternion().fromArray(hybrid.joints[id].quaternion);
      fromNative+=qa.angleTo(qh);fromJak+=qd.angleTo(qh);
      maxMidpointError=Math.max(maxMidpointError,Math.abs(qa.angleTo(qh)-qd.angleTo(qh)));
      if(!id.startsWith('shoulder')) {
        alignedError+=qa.angleTo(qd);
        oppositeError+=new THREE.Quaternion().fromArray(opposite.joints[id].quaternion).angleTo(qd);
      }
    }
    assert.ok(Object.values(hybrid.scalars).every(Number.isFinite),'hybrid lost segment elasticity');
  }
  assert.ok(fromNative/384>.1&&fromJak/384>.1,'hybrid lost one of its source cycles');
  assert.ok(maxMidpointError<1e-5,'run is not the requested even blend');
  assert.ok(alignedError<oppositeError*.8,'run phases oppose each other');
  const hybrid={nativePhase:run.metadata.jakNativeRunPhase,fromNative:fromNative/384,fromJak:fromJak/384,
    alignedError,oppositeError,maxMidpointError};
  const traces=[];
  for(const variant of ['A','D']) {
    p.enterLevel('jak-locomotion');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy=variant==='D'?{...JAK_DIRECT_PHYSICS,flip:true}:null;
    runtime.setDocument(variant==='D'?direct:base);runtime.restart();
    const rows=[];
    for(let f=0;f<680;f++) {
      const input=f<30?{}:f<150?{moveY:1}:f<250?{moveY:-1}:f<350?{moveX:1}
        :f<370?{}:f<450?{moveX:-1}:f<550?{}:f<610?{moveY:.3}:{};
      p.camDir.set(0,0,-1);p.step(1/60,makeInput(input),level);level.update(1/60);p.commitRenderStep(level);
      const d=runtime.diagnostics,clip=runtime.document.clips.find(c=>c.id===d.activeClipId);
      rows.push({f,clip:d.activeClipId,phase:(d.timelineTime-clip.range.start)/(clip.range.end-clip.range.start),
        speed:p.walkVelocity.length(),turn:p.walkTurnaround,normalized:d.motionContext.normalizedSpeed,
        walk:d.motionContext.inputs[a.LOCOMOTION_WALK_BLEND_INPUT],pos:p.pos.toArray(),yaw:p.visualYaw,
        head:binding.joints.get('head').getWorldPosition(new THREE.Vector3()).toArray(),
        recovery:d.idleRecoveryWeight});
      assert.equal(p.freeSkate,false,'locomotion mounted the board');
    }
    traces.push(rows);
  }
  const [native,adapted]=traces;
  assert.deepEqual(adapted.map(r=>[r.pos,r.yaw,r.speed,r.turn]),native.map(r=>[r.pos,r.yaw,r.speed,r.turn]),
    'D changed native movement or facing');
  let runFrames=0,turnFrames=0,maxCadenceError=0,maxHandoffHeadStep=0;
  for(let f=1;f<adapted.length;f++) {
    const d=adapted[f],n=native[f],prev=adapted[f-1],prevN=native[f-1];
    assert.equal(d.clip,n.clip,`D delayed a native animation transition at ${f}`);
    if(d.clip==='player.run'&&prev.clip===d.clip&&prevN.clip===n.clip) {
      const advance=(d.phase-prev.phase+1)%1,nativeAdvance=(n.phase-prevN.phase+1)%1;
      maxCadenceError=Math.max(maxCadenceError,Math.abs(advance-nativeAdvance));runFrames++;
      assert.ok(Math.abs(advance-nativeAdvance)<1e-7,`D slowed/reset gait at frame ${f}`);
      if(d.turn&&d.speed<3) {
        turnFrames++;assert.ok(advance>.01,'gait froze as reversal momentum crossed zero');
        assert.ok(d.normalized>.95&&d.walk<.05,'full-input reversal collapsed into walking');
      }
    }
    if(d.clip!==prev.clip)maxHandoffHeadStep=Math.max(maxHandoffHeadStep,Math.abs(d.head[1]-prev.head[1]));
  }
  assert.ok(turnFrames>=3,'fixture missed the slowest part of a committed reversal');
  assert.ok(runFrames>350,'fixture did not exercise walking and running');
  assert.ok(maxHandoffHeadStep<.065,`start/stop handoff snapped ${maxHandoffHeadStep}m`);
  assert.equal(adapted[350].clip,'player.run-stop','release failed to brake');
  assert.equal(adapted[370].clip,'player.run','renewed intent failed to interrupt braking');
  assert.equal(adapted[500].clip,'player.idle','D kept pacing after the native settle');
  assert.ok(adapted[600].walk>.99,'analog walking still blends in a full run');
  assert.ok(adapted.some(r=>r.recovery>0&&r.recovery<1),'stop never recovered into the idle pose');
  runtime.dispose();
  console.log('PASS D inherits native reversal gait, analog cadence, brake, quick restart and idle settle',
    JSON.stringify({hybrid,frames:adapted.length*2,runFrames,turnFrames,maxCadenceError,maxHandoffHeadStep,
      reversal:adapted.filter(r=>r.turn&&r.speed<3).map(({f,speed,normalized,walk,phase})=>({f,speed,normalized,walk,phase}))}));
},{levelEntry:{id:'jak-locomotion',name:'Locomotion continuity',data:{v:1,name:'Locomotion continuity',
  spawn:[0,.02,0],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},{t:'gate',p:[0,0,-200]}]}}});
