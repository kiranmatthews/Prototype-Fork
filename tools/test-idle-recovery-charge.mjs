import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
runInThisContext('const noop=()=>{};'+harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nconst held'))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn,error=console.error;
const expected=v=>/GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(v??''));
console.warn=(...a)=>{if(!expected(a[0]))warn(...a);};console.error=(...a)=>{if(!expected(a[0]))error(...a);};
try{
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {Level}=await server.ssrLoadModule('/src/level.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {TUNING}=await server.ssrLoadModule('/src/tuning.ts');
  const level=new Level(new THREE.Scene(),{id:'idle-polish-test',name:'Idle polish',data:{v:1,name:'Idle polish',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[120,1,120]},{t:'gate',p:[0,0,-55]}]}});
  const p=new Player(level.scene),control=new Player(level.scene);
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=a.createPlayerStarterAnimationSuite(binding.definition);
  const idle=suite.clips.find(c=>c.id==='player.idle');
  assert.equal(idle.playbackSpeed,2);
  const runtime=createCharacterAnimationRuntime(p,suite);
  const reset=()=>{for(const v of [p,control]){v.enterLevel('idle-polish-test');v.respawn(level,true);}runtime.restart();};
  const tick=(extra={})=>{const input={moveX:0,moveY:0,...extra};p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);
    assert.ok(p.pos.distanceTo(control.pos)<1e-9,'animation changed the controller');};
  const hold=(frames,input={})=>{for(let f=0;f<frames;f++)tick(input);};
  const poseNearIdle=()=>{
    const d=runtime.diagnostics;assert.ok(d.idleRecoveryWeight>=.999);
    const target=a.sampleComposedClip(idle,d.idleRecoveryTimelineTime,p.animationIntent.motion);
    for(const joint of ['shoulderLeft','shoulderRight','elbowLeft','elbowRight','hipLeft','hipRight','kneeLeft','kneeRight']){
      const actual=runtime.lastSampledPose.joints[joint].quaternion;
      assert.ok(new THREE.Quaternion().fromArray(actual).angleTo(new THREE.Quaternion().fromArray(target.joints[joint].quaternion))<1e-5,
        `${joint} was not already idle within the rebound`);
    }
  };
  const checkRecovery=source=>{
    let saw=false,finished=false,prior=null;
    for(let frame=0;frame<180;frame++){
      tick();const d=runtime.diagnostics;
      if(d.activeClipId===source&&d.idleRecoveryWeight>=.999){poseNearIdle();saw=true;}
      if(prior===source&&d.activeClipId==='player.idle'){
        assert.ok(saw,`${source}: limbs recovered only after the animation`);
        assert.equal(d.transitionBlendWeight,null,`${source}: added a second after-recovery fade`);
        finished=true;break;
      }
      prior=d.activeClipId;
    }
    assert.ok(finished,`${source} did not hand off to idle`);
  };
  reset();hold(40);
  const origin=p.pos.clone();let preload=0;
  for(let frame=0;frame<45;frame++){
    tick({jumpHeld:true,jumpPressed:frame===0});
    assert.equal(p.state,'ride');assert.equal(p.freeSkate,false);assert.ok(p.pos.distanceTo(origin)<1e-9);
    assert.equal(runtime.activeClipId,'player.jump-charge');
    if(frame===2)preload=p.chargePose;
  }
  assert.ok(preload>.20&&preload<.55,'immediate preload cue was lost');
  assert.ok(p.chargePose>.99,'held charge did not deepen to its endpoint');
  // Hands are behind the shoulders; knees load without moving the feet/root.
  const local=n=>p.bodyGroup.worldToLocal(p.riderG.getObjectByName(n).getWorldPosition(new THREE.Vector3()));
  for(const side of ['left','right'])assert.ok(local('wrist-'+side).z<local('shoulder-'+side).z-.08,'missing rearward arm wind-up');
  let low=Infinity;
  for(const {sole} of p.proceduralFootwear){sole.updateWorldMatrix(true,false);const vertices=sole.geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++)low=Math.min(low,new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(sole.matrixWorld).y);}
  assert.ok(Math.abs(low-.006)<.01,`loaded soles left the floor: ${low}`);
  tick({jumpReleased:true});assert.equal(p.state,'air');
  assert.ok(p.launchVy>=TUNING.jumpVelocity-.01,'full release lost jump power');
  checkRecovery('player.land');
  reset();hold(40);hold(2,{jumpHeld:true});tick({jumpReleased:true});
  assert.equal(p.state,'air');assert.ok(p.launchVy>=TUNING.jumpMinVelocity&&p.launchVy<TUNING.jumpVelocity-.5,'tap/full charge distinction was lost');
  checkRecovery('player.land');
  reset();hold(130,{moveY:1});tick();assert.equal(runtime.activeClipId,'player.run-stop');checkRecovery('player.run-stop');
  assert.equal(p.stance,-1,'default stance was not reversed');
  const saved=structuredClone(suite);saved.metadata.playerStarterCatalogVersion=29;
  saved.clips=saved.clips.filter(c=>c.id!=='player.jump-charge');
  const savedIdle=saved.clips.find(c=>c.id==='player.idle');savedIdle.playbackSpeed=4.2857;delete savedIdle.metadata.idleTempoRevision;
  savedIdle.tracks[0].keys[0].value[0]+=.01;
  const upgraded=a.reconcilePlayerStarterAnimationSuite(saved,binding.definition);
  assert.equal(upgraded.clips.find(c=>c.id==='player.idle').playbackSpeed,2);
  assert.deepEqual(upgraded.clips.find(c=>c.id==='player.idle').tracks,savedIdle.tracks,'speed edit lost user keyframes');
  assert.ok(upgraded.clips.some(c=>c.id==='player.jump-charge'));
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(upgraded,binding.definition),upgraded);
  runtime.dispose();level.dispose();
  console.log('PASS idle 2x, limbs recovered inside both landing/skid, exact idle handoff, preload/hold/tap/full release, planted soles, new stance and saved migration');
}finally{await server.close();console.warn=warn;console.error=error;}
