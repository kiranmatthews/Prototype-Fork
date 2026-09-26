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
  const {ICE_WALK_CLIP_ID:ICE,ICE_WALK_DURATION,ICE_EFFORT_INPUT,ICE_SIDE_SLIP_INPUT}=await server.ssrLoadModule('/src/animation/iceWalk.ts');
  const originalTuning=JSON.stringify(TUNING),dt=CONST.fixedStep;
  const hintGetter=Object.getOwnPropertyDescriptor(Player.prototype,'animationClipHint').get;
  const create=(name,{enabled=true,oldIceHint=false,legacyIce=false,components=[]}={})=>{
    const scene=new THREE.Scene(),level=new Level(scene,{id:name,name,data:{v:1,name,spawn:[0,.02,-5],killY:-30,
      components:[{t:'platform',p:[0,-.5,0],s:[200,1,120],slip:true,...(legacyIce?{}:{iceGrip:.08}),edgeGrinding:false},
        {t:'platform',p:[0,-.5,-120],s:[200,1,120],edgeGrinding:false},{t:'gate',p:[80,0,-170]},...components]}});
    scene.updateMatrixWorld(true);
    const p=new Player(scene);p.enterLevel(name);p.rawInput=makeInput();p.respawn(level,true);
    if(oldIceHint)Object.defineProperty(p,'animationClipHint',{get(){const hint=hintGetter.call(this);return hint===ICE?'player.run':hint;}});
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
  evidence.push({test:'editable in-place seamless cycle, independent elasticity, glide contacts and lossless31→32 migration',tracks:clip.tracks.length});

  const eligible=base.p;
  const resetHint=()=>{eligible.respawn(base.level,true);eligible.groundHit=eligible.queryGround(base.level);eligible.walkVelocity.set(0,0,0);eligible.rawInput=makeInput({moveY:1});};
  resetHint();assert.equal(eligible.animationClipHint,ICE,'traction startup must scrabble before reaching run speed');
  eligible.rawInput=makeInput();eligible.lastPlanar=12;assert.notEqual(eligible.animationClipHint,ICE,'moving support/world carry woke the ice cycle');
  eligible.walkVelocity.set(0,0,-3);assert.equal(eligible.animationClipHint,ICE,'neutral-input ice coast lost its balance cycle');
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
  for(const [name,setup]of exclusions){resetHint();setup(eligible);assert.notEqual(eligible.animationClipHint,ICE,`${name} was masked by ice locomotion`);}
  evidence.push({test:'ice eligibility and higher-priority ownership',excludedStates:exclusions.length});

  const motion=pair('ice-motion');hold(motion,30);
  assert.notEqual(motion.on.runtime.activeClipId,ICE,'stationary ice idling slipped endlessly');
  assert.equal(tick(motion,{moveY:1}).hint,ICE);
  hold(motion,269,{moveY:1});assert.equal(motion.on.runtime.activeClipId,ICE);
  const physicalBeforeRelease=motion.on.p.walkVelocity.length();
  for(let i=0;i<120;i++){const result=tick(motion);assert.equal(result.hint,ICE);assert.equal(result.active,ICE);assert.notEqual(motion.on.runtime.diagnostics.transientClipId,'player.run-stop');}
  assert.ok(motion.on.p.walkVelocity.length()>physicalBeforeRelease*.5,'ice coast was physically shortened');
  hold(motion,140,{moveY:-1});let lateralResponse=0;
  for(let i=0;i<150;i++){const result=tick(motion,{moveX:1});lateralResponse=Math.max(lateralResponse,Math.abs(result.motion.inputs.iceSideSlip));}
  assert.ok(lateralResponse>1e-4,`side-slip response did not read transient facing lag: ${lateralResponse}`);
  let dryFrames=0;
  for(let i=0;i<1800&&dryFrames<45;i++){
    const result=tick(motion,{moveY:1});
    if(!motion.on.p.groundHit?.slippy){dryFrames++;assert.notEqual(result.hint,ICE);}
  }
  assert.equal(dryFrames,45,'physical route did not leave ice for dry ground');
  assert.notEqual(motion.on.runtime.activeClipId,ICE,'ice pose persisted on dry ground');
  evidence.push({test:'enabled/disabled traction, coast, reversal, side slip and dry exit parity',frames:motion.frames,lateralResponse});

  for(const legacyIce of [false,true]){
    const b=pair('ice-actions-'+legacyIce,{legacyIce});hold(b,25);hold(b,180,{moveY:1});
    assert.equal(b.on.p.animationClipHint,ICE);
    hold(b,26,{jumpHeld:true});tick(b,{jumpReleased:true});assert.equal(b.on.p.state,'air');assert.notEqual(b.on.p.animationClipHint,ICE);
    let peak=b.on.p.pos.y;for(let i=0;i<120&&!b.on.p.grounded;i++){tick(b);peak=Math.max(peak,b.on.p.pos.y);}
    hold(b,45);assert.ok(b.on.p.grounded && peak>2.7&&peak<3.05);
    hold(b,160,{moveY:1});tick(b,{moveY:1,spinHeld:true});assert.equal(b.on.p.animationClipHint,'player.spin');
    hold(b,35,{moveY:1});tick(b,{moveY:1,grabHeld:true});assert.notEqual(b.on.p.animationClipHint,ICE,'slide lost its pose');
    hold(b,80);hold(b,75,{moveY:1,jumpHeld:true});
    assert.ok(b.on.p.freeSkate);assert.equal(b.on.p.animationClipHint,'player.skate');
    evidence.push({test:'jump, spin, slide and board-priority movement parity',legacyIce,frames:b.frames,peak});
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
  console.log('PASS ice-walk catalog, priority, migration and enabled/disabled movement parity; interaction-envelope observations reported separately');
} finally {
  for(const f of fixtures){f.runtime.dispose();f.level.dispose();}
  await server.close();console.warn=warn;console.error=error;
}
