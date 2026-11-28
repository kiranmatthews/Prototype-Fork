import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';
import { normalizeGameInput } from './blockworks-runner.mjs';

const harness=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
new Function('noop',harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn,error=console.error,fixtures=[],evidence=[],interactionWarnings=[];
console.warn=(...a)=>{if(!/failed|GLB|procedural skateboard/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
try {
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {Level}=await server.ssrLoadModule('/src/level.ts');
  const {TUNING,CONST}=await server.ssrLoadModule('/src/tuning.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {ICE_WALK_CLIP_ID:ICE,ICE_GLIDE_CLIP_ID:GLIDE,ICE_WALK_DURATION,ICE_GLIDE_DURATION,ICE_EFFORT_INPUT,ICE_SIDE_SLIP_INPUT,buildLegacyIceWalkClip}=await server.ssrLoadModule('/src/animation/iceWalk.ts');
  const {withCharacterElasticity}=await server.ssrLoadModule('/src/animation/elasticity.ts');
  const originalTuning=JSON.stringify(TUNING),dt=CONST.fixedStep;
  const hintGetter=Object.getOwnPropertyDescriptor(Player.prototype,'animationClipHint').get;
  const create=(name,{enabled=true,oldIceHint=false,legacyIce=false,components=[]}={})=>{
    const scene=new THREE.Scene(),level=new Level(scene,{id:name,name,data:{v:1,name,spawn:[0,.02,-5],killY:-30,
      components:[{t:'platform',p:[0,-.5,0],s:[200,1,120],slip:true,...(legacyIce?{}:{iceGrip:.08}),edgeGrinding:false},
        {t:'platform',p:[0,-.5,-120],s:[200,1,120],edgeGrinding:false},{t:'gate',p:[80,0,-170]},...components]}});
    scene.updateMatrixWorld(true);
    const p=new Player(scene);p.enterLevel(name);p.rawInput=makeInput();p.respawn(level,true);
    if(oldIceHint)Object.defineProperty(p,'animationClipHint',{get(){const hint=hintGetter.call(this);return hint===ICE||hint==='player.ice-glide'?'player.run':hint;}});
    const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root),suite=a.createPlayerStarterAnimationSuite(binding.definition);
    const runtime=createCharacterAnimationRuntime(p,suite,{enabled});
    const f={p,level,binding,suite,runtime};fixtures.push(f);return f;
  };
  const physics=p=>({position:p.pos.toArray(),velocity:p.walkVelocity.toArray(),speed:p.speed,vertical:p.vVel,
    state:p.state,grounded:p.grounded,board:p.freeSkate,crawl:p.crawling,slide:p.slideTimer,slideDistance:p.slideDistanceLeft,
    charging:p.charging,charge:p.chargeTimer,walkRamp:p.walkRamp,turnaround:p.walkTurnaround,heading:p.axisF.toArray(),
    bail:p.isBailing,deaths:p.totalDeaths});
  const pair=(name,opts={})=>({on:create(name+'-on',opts),off:create(name+'-off',{...opts,enabled:false}),previous:makeInput(),frames:0});
  const step=(f,input)=>{f.p.step(dt,makeInput(input),f.level);f.level.update(dt);f.p.flushLevelCrateRewards(f.level);f.p.commitRenderStep(f.level);};
  const tick=(b,sample={})=>{
    const input=normalizeGameInput(sample,b.previous);b.previous={...input};
    step(b.on,input);step(b.off,input);b.frames++;
    assert.deepEqual(physics(b.on.p),physics(b.off.p),`authored runtime changed movement at frame${b.frames}`);
    const motion=b.on.p.animationIntent.motion;
    assert.ok(Number.isFinite(motion.inputs[ICE_EFFORT_INPUT])&&motion.inputs[ICE_EFFORT_INPUT]>=0&&motion.inputs[ICE_EFFORT_INPUT]<=1);
    assert.ok(Number.isFinite(motion.inputs[ICE_SIDE_SLIP_INPUT])&&Math.abs(motion.inputs[ICE_SIDE_SLIP_INPUT])<=1);
    for(const joint of b.on.p.animationRig.joints)assert.ok([...joint.node.position.toArray(),...joint.node.quaternion.toArray(),...joint.node.scale.toArray()].every(Number.isFinite));
    return {hint:b.on.p.animationClipHint,active:b.on.runtime.activeClipId,motion};
  };
  const hold=(b,count,sample={})=>{let result;for(let i=0;i<count;i++)result=tick(b,sample);return result;};

  const base=create('ice-catalog'),rig=base.binding.definition;
  const clip=base.suite.clips.find(c=>c.id===ICE);
  assert.ok(clip);assert.equal(clip.duration,ICE_WALK_DURATION);assert.equal(clip.loop.mode,'loop');
  assert.equal(clip.rootMotion.mode,'in-place');assert.ok(!clip.tracks.some(t=>t.kind==='scale'));
  assert.ok(clip.contacts.length>=2 && clip.contacts.every(c=>c.mode==='custom'),'ice contacts must glide rather than pin world XY');
  assert.equal(clip.metadata.elasticityProfile,'ice-walk');
  // The stride keeps BOTH shoes on the ice for the whole of its cycle, and so does the glide it settles into.
  for(const side of ['Left','Right'])assert.ok(clip.contacts.some(c=>c.effector===`foot${side}`&&c.start===0&&c.end===clip.duration),`the ${side} shoe is on the ice throughout the stride`);
  const glide=base.suite.clips.find(c=>c.id===GLIDE);
  assert.ok(glide);assert.equal(glide.duration,ICE_GLIDE_DURATION);assert.equal(glide.loop.mode,'loop');assert.equal(glide.rootMotion.mode,'in-place');
  assert.ok(!glide.tracks.some(t=>t.kind==='scale'));assert.equal(glide.metadata.elasticityProfile,'ice-glide');
  for(const side of ['Left','Right'])assert.ok(glide.contacts.some(c=>c.effector===`foot${side}`&&c.start===0&&c.end===glide.duration&&c.mode==='custom'));
  for(const joint of ['hips','shoulderLeft','shoulderRight','kneeLeft','kneeRight','ankleLeft','ankleRight']){
    const start=a.sampleComposedClip(glide,0,a.createProceduralMotionContext({normalizedSpeed:.4,grounded:true,inputs:{iceSideSlip:0}})).joints[joint];
    const end=a.sampleComposedClip(glide,glide.duration,a.createProceduralMotionContext({normalizedSpeed:.4,grounded:true,inputs:{iceSideSlip:0}})).joints[joint];
    for(const key of ['position','quaternion'])if(start[key])assert.ok(start[key].every((v,i)=>Math.abs(v-end[key][i])<1e-6),`glide ${joint} loop seam`);
  }
  // Its legs keep their lengths (two planted shoes): only the chest and the arms give.
  assert.ok(!glide.proceduralDrivers.some(d=>d.target.kind==='scalar'&&/deform\.leg\./.test(d.target.target)),'the glide stretches a planted leg');
  assert.ok(glide.proceduralDrivers.some(d=>d.target.kind==='scalar'&&d.target.target==='deform.torso.length'));
  const context=a.createProceduralMotionContext({normalizedSpeed:.6,grounded:true,inputs:{iceEffort:.8,iceSideSlip:.5}});
  const elasticRanges=new Map();
  const finite=value=>typeof value==='number'?Number.isFinite(value):Array.isArray(value)?value.every(finite):value&&typeof value==='object'?Object.values(value).every(finite):true;
  for(let i=0;i<=48;i++){
    const pose=a.sampleComposedClip(clip,clip.duration*i/48,context);assert.ok(finite(pose));
    assert.ok(pose.joints.root.position.every(v=>Math.abs(v)<1e-10),'ice clip authored a root trajectory');
    for(const [key,value]of Object.entries(pose.scalars).filter(([key])=>key.startsWith('deform.'))){const range=elasticRanges.get(key)??[Infinity,-Infinity];range[0]=Math.min(range[0],value);range[1]=Math.max(range[1],value);elasticRanges.set(key,range);}
  }
  assert.ok([...elasticRanges.values()].some(([min,max])=>max-min>.001),'ice cycle has no independent segment elasticity');
  const sidePose=side=>a.sampleComposedClip(clip,.35,a.createProceduralMotionContext({normalizedSpeed:.6,grounded:true,
    inputs:{iceEffort:.8,iceSideSlip:side}}));
  assert.ok(Math.abs(sidePose(1).joints.chest.quaternion[2]-sidePose(-1).joints.chest.quaternion[2])>.03,
    'signed slip input did not change the authored counterbalance pose');
  for(const joint of ['hips','shoulderLeft','shoulderRight','kneeLeft','kneeRight']){
    const start=a.sampleComposedClip(clip,0,context).joints[joint],end=a.sampleComposedClip(clip,clip.duration,context).joints[joint];
    for(const key of ['position','quaternion'])if(start[key])assert.ok(start[key].every((v,i)=>Math.abs(v-end[key][i])<1e-6),`${joint} loop seam`);
  }
  const old=structuredClone(base.suite);old.clips=old.clips.filter(c=>c.id!==ICE);old.metadata.playerStarterCatalogVersion=31;
  old.clips.find(c=>c.id==='player.run').playbackSpeed=1.37;
  const migrated=a.reconcilePlayerStarterAnimationSuite(old,rig);
  assert.equal(migrated.clips.filter(c=>c.id===ICE).length,1);assert.equal(migrated.clips.length,old.clips.length+1);
  for(const previous of old.clips)assert.deepEqual(migrated.clips.find(c=>c.id===previous.id),previous,'ice migration overwrote an authored clip');
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(migrated,rig),migrated);
  // A suite saved at catalog 39 holds the old scuff walk. Untouched, it becomes the stride and gains the glide;
  // touched (here: a different playback speed), it is left exactly as its author had it, and the glide is still added.
  const legacy=withCharacterElasticity(buildLegacyIceWalkClip(rig.id,rig.joints.some(j=>j.id==='torsoRoot')),rig);
  const saved=(edit=c=>c)=>{const d=structuredClone(base.suite);d.clips=d.clips.filter(c=>c.id!==GLIDE).map(c=>c.id===ICE?edit(structuredClone(legacy)):c);d.metadata.playerStarterCatalogVersion=39;return d;};
  const upgraded=a.reconcilePlayerStarterAnimationSuite(saved(),rig);
  assert.deepEqual(upgraded.clips.find(c=>c.id===ICE),clip,'an untouched saved ice walk was not replaced by the stride');
  assert.ok(upgraded.clips.some(c=>c.id===GLIDE),'the glide was not added to a saved suite');
  const edited=saved(c=>({...c,playbackSpeed:1.21})),kept=a.reconcilePlayerStarterAnimationSuite(edited,rig);
  assert.deepEqual(kept.clips.find(c=>c.id===ICE),edited.clips.find(c=>c.id===ICE),'an edited saved ice walk was overwritten');
  assert.ok(kept.clips.some(c=>c.id===GLIDE));
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(upgraded,rig),upgraded);
  evidence.push({test:'editable in-place seamless cycles, independent elasticity, glide contacts, lossless 31→32 migration and the 39→40 stride upgrade',tracks:clip.tracks.length,glideTracks:glide.tracks.length});

  const eligible=base.p;
  const resetHint=()=>{eligible.respawn(base.level,true);eligible.groundHit=eligible.queryGround(base.level);eligible.walkVelocity.set(0,0,0);eligible.rawInput=makeInput({moveY:1});};
  resetHint();assert.equal(eligible.animationClipHint,ICE,'traction startup must scrabble before reaching run speed');
  eligible.rawInput=makeInput();eligible.lastPlanar=12;assert.notEqual(eligible.animationClipHint,ICE,'moving support/world carry woke the ice cycle');
  eligible.walkVelocity.set(0,0,-3);assert.equal(eligible.animationClipHint,GLIDE,'a neutral-input ice coast is the braced glide');
  eligible.rawInput=makeInput({moveX:.5});assert.equal(eligible.animationClipHint,ICE,'pushing out of a coast is the stride again');
  const isIce=hint=>hint===ICE||hint===GLIDE;
  const exclusions=[
    ['dry',p=>{p.groundHit.slippy=false;}],['board',p=>{p.freeSkate=true;}],['skate transition',p=>{p.skatePose=.4;}],
    ['deck transition',p=>{p.deckPose=.4;}],['crouch',p=>{p.crawling=true;}],['slide',p=>{p.slideTimer=.2;}],
    ['planted charge',p=>{p.charging=true;p.chargePlanted=true;}],['air',p=>{p.state='air';p.grounded=false;p.vVel=10;}],
    ['grind',p=>{p.state='grind';}],['spin',p=>{p.spinTimer=.2;}],['slam',p=>{p.slamActive=true;}],
    ['grab',p=>{p.grabPose=.4;}],['ledge',p=>{p.state='hang';}],['rope',p=>{p.state='rope';}],
    ['swim',p=>{p.state='swim';}],['bail',p=>{p.bailDownT=.3;}],['death',p=>{p.state='dead';}],
    ['finished',p=>{p.state='finished';}],['steep slither',p=>{p.slipping=true;}],['teeter',p=>{p.teetering=true;}],
    ['world map',p=>{p.worldMapBaseScale=1;}],
  ];
  for(const [name,setup]of exclusions){
    resetHint();setup(eligible);assert.ok(!isIce(eligible.animationClipHint),`${name} was masked by the ice stride`);
    // ...and the same with the stick let go and speed in hand: the glide masks none of them either
    resetHint();eligible.rawInput=makeInput();eligible.walkVelocity.set(0,0,-3);setup(eligible);assert.ok(!isIce(eligible.animationClipHint),`${name} was masked by the ice glide`);
  }
  evidence.push({test:'ice eligibility and higher-priority ownership',excludedStates:exclusions.length});

  const facingError=(p,target)=>{
    const yaw=Math.atan2(target.x,target.z)-Math.PI;
    return Math.abs(Math.atan2(Math.sin(yaw-p.visualYaw),Math.cos(yaw-p.visualYaw)));
  };
  for(const {name,initial,reverse,components=[]} of [
    {name:'reverse',initial:{moveY:1},reverse:{moveY:-1}},
    {name:'diagonal',initial:{moveY:1},reverse:{moveX:.71,moveY:-.71}},
    {name:'turned-course',initial:{moveX:1},reverse:{moveX:-1},
      components:[{t:'zone',p:[0,0,0],s:[200,10,120],dir:'E'}]},
  ]){
    const b=pair('ice-facing-'+name,{components});hold(b,25);hold(b,100,initial);
    const p=b.on.p,runtime=b.on.runtime;
    for(let frame=0;frame<4;frame++){
      const result=tick(b,reverse);assert.equal(result.hint,ICE);assert.equal(result.active,ICE);
    }
    assert.ok(facingError(p,p.walkTarget)<1e-6,`${name}: body still faces drift after four frames`);
    assert.ok(p.walkVelocity.dot(p.walkTarget)<0,`${name}: physics reversed as quickly as the body`);
    const facing=p.visualYaw,coast=hold(b,10);
    assert.equal(coast.hint,GLIDE,`${name}: the stick let go, he coasts braced`);
    assert.ok(Math.abs(p.visualYaw-facing)<1e-6,`${name}: releasing input turned the body back toward drift`);
    let crossed=false,advancing=0,previousTime=runtime.diagnostics.timelineTime;
    for(let frame=0;frame<180;frame++){
      const result=tick(b,reverse);
      // (the stride is asked for from the first frame; its hand-over from the glide takes a few)
      assert.equal(result.hint,ICE);if(frame>20)assert.equal(result.active,ICE,'zero-speed crossover interrupted the ice cycle');
      const time=runtime.diagnostics.timelineTime;
      if(Math.abs(time-previousTime)>1e-6)advancing++;previousTime=time;
      if(p.walkVelocity.dot(p.walkTarget)>0)crossed=true;
    }
    assert.ok(crossed,`${name}: traction never caught up to intent`);assert.equal(advancing,180);
    evidence.push({test:'input-facing ice pivot, coast-facing retention and continuous zero-speed cycle',name,frames:b.frames});
  }

  const motion=pair('ice-motion');hold(motion,30);
  assert.notEqual(motion.on.runtime.activeClipId,ICE,'stationary ice idling slipped endlessly');
  const firstPush=tick(motion,{moveY:1});assert.equal(firstPush.hint,ICE);assert.equal(firstPush.active,ICE,'ice push waited for another animation');
  hold(motion,269,{moveY:1});assert.equal(motion.on.runtime.activeClipId,ICE);
  const physicalBeforeRelease=motion.on.p.walkVelocity.length();
  for(let i=0;i<120;i++){const result=tick(motion);assert.equal(result.hint,GLIDE);if(i>20)assert.equal(result.active,GLIDE,'the coast did not settle into the glide');assert.notEqual(motion.on.runtime.diagnostics.transientClipId,'player.run-stop');}
  assert.ok(motion.on.p.walkVelocity.length()>physicalBeforeRelease*.5,'ice coast was physically shortened');
  hold(motion,140,{moveY:-1});let lateralResponse=0;
  for(let i=0;i<150;i++){const result=tick(motion,{moveX:1});lateralResponse=Math.max(lateralResponse,Math.abs(result.motion.inputs.iceSideSlip));}
  assert.ok(lateralResponse>1e-4,`side-slip response did not read transient facing lag: ${lateralResponse}`);
  let dryFrames=0;
  for(let i=0;i<1800&&dryFrames<45;i++){
    const result=tick(motion,{moveY:1});
    if(!motion.on.p.groundHit?.slippy){dryFrames++;assert.ok(!isIce(result.hint));}
  }
  assert.equal(dryFrames,45,'physical route did not leave ice for dry ground');
  assert.ok(!isIce(motion.on.runtime.activeClipId),'ice pose persisted on dry ground');
  evidence.push({test:'enabled/disabled traction, coast, reversal, side slip and dry exit parity',frames:motion.frames,lateralResponse});

  for(const legacyIce of [false,true]){
    const b=pair('ice-actions-'+legacyIce,{legacyIce});hold(b,25);hold(b,180,{moveY:1});
    assert.equal(b.on.p.animationClipHint,ICE);
    hold(b,26,{jumpHeld:true});tick(b,{jumpReleased:true});assert.equal(b.on.p.state,'air');assert.notEqual(b.on.p.animationClipHint,ICE);
    let peak=b.on.p.pos.y;for(let i=0;i<120&&!b.on.p.grounded;i++){
      tick(b);peak=Math.max(peak,b.on.p.pos.y);
      if(b.on.p.grounded&&isIce(b.on.p.animationClipHint)){
        assert.ok(isIce(b.on.runtime.activeClipId),'first ice contact was hidden by landing recovery');
        assert.notEqual(b.on.runtime.diagnostics.transientClipId,'player.land');
      }
    }
    hold(b,45);assert.ok(b.on.p.grounded && peak>2.7&&peak<3.05);
    hold(b,160,{moveY:1});tick(b,{moveY:1,spinHeld:true});assert.equal(b.on.p.animationClipHint,'player.spin');
    hold(b,35,{moveY:1});tick(b,{moveY:1,grabHeld:true});assert.ok(!isIce(b.on.p.animationClipHint),'slide lost its pose');
    hold(b,80);hold(b,75,{moveY:1,jumpHeld:true});
    assert.ok(b.on.p.freeSkate);assert.equal(b.on.p.animationClipHint,'player.skate');
    evidence.push({test:'jump, spin, slide and board-priority movement parity',legacyIce,frames:b.frames,peak});
  }

  // THE POINT OF THE STRIDE: both shoes are on the ice, not over it. Measured on the drawn soles, the way the
  // seat itself measures them: the lowest vertex of each over the floor, pushing and coasting. (The old walk's
  // soles rode 15 to 29 cm up: it was never seated, and its steps were not solved to one height.)
  {
    const b=pair('ice-contact'),p=b.on.p,v=new THREE.Vector3(),worst={[ICE]:0,[GLIDE]:0},seen={[ICE]:0,[GLIDE]:0};
    const measure=()=>{
      const hint=p.animationClipHint;if(!isIce(hint)||b.on.runtime.activeClipId!==hint||!p.grounded)return;
      for(const {sole}of p.proceduralFootwear){
        sole.updateWorldMatrix(true,false);const points=sole.geometry.getAttribute('position');let low=Infinity;
        for(let i=0;i<points.count;i++)low=Math.min(low,v.fromBufferAttribute(points,i).applyMatrix4(sole.matrixWorld).y-p.pos.y);
        worst[hint]=Math.max(worst[hint],Math.abs(low));
      }
      seen[hint]++;
    };
    hold(b,25);
    for(let i=0;i<260;i++){tick(b,{moveY:1});if(i>30)measure();}
    for(let i=0;i<150;i++){tick(b);if(i>30)measure();}
    assert.ok(seen[ICE]>150&&seen[GLIDE]>80,JSON.stringify(seen));
    assert.ok(worst[ICE]<.02,`a shoe leaves the ice in the stride: ${(worst[ICE]*100).toFixed(1)} cm`);
    assert.ok(worst[GLIDE]<.02,`a shoe leaves the ice in the glide: ${(worst[GLIDE]*100).toFixed(1)} cm`);
    evidence.push({test:'both soles on the ice through the stride and the glide',strideCm:+(worst[ICE]*100).toFixed(2),glideCm:+(worst[GLIDE]*100).toFixed(2),frames:seen});
  }

  // Isolate only the new ice route here: both actors retain the authored
  // runtime, while the control maps the new hint back to the prior Run route.
  for(const [kind,x]of [['crate',1.2],['crate',1.65],['wumpa',2.65]]){
    const components=[kind==='crate'?{t:'crate',p:[x,0,-12],kind:'wood'}:{t:'wumpa',p:[x,1,-12]}];
    const on=create(`ice-${kind}-${x}-new`,{components}),oldPose=create(`ice-${kind}-${x}-old`,{components,oldIceHint:true});
    let previous=makeInput(),maxBoundsWidthChange=0,firstMovementDifference=null,firstFruitOn=null,firstFruitOld=null;
    for(let frame=0;frame<360;frame++){
      const input=normalizeGameInput({moveY:1},previous);previous={...input};step(on,input);step(oldPose,input);
      const n=on.p.interactionBoundsDiagnostics,o=oldPose.p.interactionBoundsDiagnostics;
      maxBoundsWidthChange=Math.max(maxBoundsWidthChange,Math.abs((n.max[0]-n.min[0])-(o.max[0]-o.min[0])));
      if(firstMovementDifference===null&&JSON.stringify(physics(on.p))!==JSON.stringify(physics(oldPose.p)))firstMovementDifference=frame;
      if(firstFruitOn===null&&on.p.fruit>0)firstFruitOn=frame;
      if(firstFruitOld===null&&oldPose.p.fruit>0)firstFruitOld=frame;
    }
    const report={kind,x,maxBoundsWidthChange,firstMovementDifference,newFruit:on.p.fruit,oldFruit:oldPose.p.fruit,firstFruitOn,firstFruitOld,
      newCrates:on.level.crates.map(c=>c.alive),oldCrates:oldPose.level.crates.map(c=>c.alive)};
    if(firstMovementDifference!==null||on.p.fruit!==oldPose.p.fruit||firstFruitOn!==firstFruitOld||JSON.stringify(report.newCrates)!==JSON.stringify(report.oldCrates))interactionWarnings.push(report);
    evidence.push({test:'measured pose-envelope interaction probe',...report});
  }
  assert.equal(JSON.stringify(TUNING),originalTuning,'animation test changed movement tuning');
  console.log(JSON.stringify({evidence,interactionWarnings},null,2));
  console.log('PASS ice stride and glide: catalog, both soles on the ice, priority, migration and upgrade, and enabled/disabled movement parity; interaction-envelope observations reported separately');
} finally {
  for(const f of fixtures){f.runtime.dispose();f.level.dispose();}
  await server.close();console.warn=warn;console.error=error;
}
