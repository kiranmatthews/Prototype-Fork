import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const bank=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [jak,skate]=await Promise.all([bank('jak'),bank('skate')]);
const tuningOnly=process.argv.includes('--tuning-only');
await withSkateRuntime(async({server,scene,level,Player,THREE,TUNING})=>{
  const {GameplayAnimationPresentation,gameplayAnimationDocument,GAMEPLAY_ANIMATION_SCHEME}=await server.ssrLoadModule('/src/gameplayAnimationScheme.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const players=[new Player(scene),new Player(scene)],[p,control]=players;
  const assets={jak,skate,ink:new THREE.Texture()};
  const rig=RigBinding.fromSculptRuntime(p.animationRig.root).definition;
  const document=gameplayAnimationDocument(createPlayerStarterAnimationSuite(rig),rig,jak);
  assert.equal(document.metadata.gameplayAnimationScheme,GAMEPLAY_ANIMATION_SCHEME);
  assert.equal(gameplayAnimationDocument(document,rig,jak),document,'adoption discarded edited D keys');
  const runtime=createCharacterAnimationRuntime(p,document);
  const presentation=new GameplayAnimationPresentation(p,scene,assets),motion=presentation.skate;
  const rows=[];let frames=0;
  const step=(fps,input)=>{
    for(const player of players){player.step(1/fps,makeInput(input),level);player.commitRenderStep(level);}
    level.update(1/fps);frames++;
    for(const key of ['state','grounded','speed','vVel','freeSkate','stance','charging','chargeTimer'])
      assert.equal(p[key],control[key],`${key}: presentation altered gameplay`);
    assert.ok(p.pos.distanceTo(control.pos)<1e-8);
    for(const joint of p.animationRig.joints)assert.ok([...joint.node.position,...joint.node.quaternion,...joint.node.scale].every(Number.isFinite));
  };
  const reset=(fps,stance)=>{
    players.forEach(player=>{player.enterLevel('push-recovery');player.respawn(level,true,true);
      player.freeSkate=true;player.speed=18;player.lastPlanar=18;player.stance=stance;});
    runtime.restart();
    for(let f=0;f<fps*.6;f++)step(fps,{});
    players.forEach(player=>{player.speed=4;player.lastPlanar=4;});
  };
  for(const fps of tuningOnly?[]:[30,60,120])for(const stance of [-1,1])for(const direction of [[0,0],[1,0],[0,1]]){
    reset(fps,stance);let pushes=0,charge=0,minLeadAgreement=1,maxHipTurn=0,previousHip=null;
    for(let f=0;f<fps*5;f++){
      step(fps,{moveX:direction[0],moveY:direction[1],jumpHeld:true,jumpPressed:f===0});
      if(motion.phase.startsWith('push'))pushes++;
      if(motion.phase==='charge')charge++;
      const hip=p.animationRig.jointsById.get('hips').node.getWorldQuaternion(new THREE.Quaternion()).normalize();
      if(previousHip)maxHipTurn=Math.max(maxHipTurn,hip.angleTo(previousHip)*fps/60);previousHip=hip;
      if(motion.phase==='push'&&motion.time>=.2&&motion.time<.5){
        const lead=player=>player.animationRig.jointsById.get('ankleRight').node.getWorldPosition(new THREE.Vector3())
          .sub(player.animationRig.jointsById.get('ankleLeft').node.getWorldPosition(new THREE.Vector3())).dot(player.axisF);
        minLeadAgreement=Math.min(minLeadAgreement,Math.sign(lead(p)*lead(control)));
      }
      assert.equal(motion.boardScribble.active,false,'speed recovery invented equipment ink');
    }
    assert.ok(pushes>=fps*.1,`no readable held-X push: ${JSON.stringify({fps,stance,direction,pushes,phase:motion.phase})}`);
    assert.ok(p.speed>=TUNING.cruiseSpeed,'held X failed to restore cruising speed');
    assert.ok(charge>fps*.15,`push never handed back to the charge pose: ${JSON.stringify({fps,stance,direction,speed:p.speed,phase:motion.phase,time:motion.time,diagnostics:motion.diagnostics})}`);
    assert.ok(minLeadAgreement>0,`push changed the leading foot: ${fps}/${stance}/${direction}`);
    assert.ok(maxHipTurn<.5,`push entry/exit snapped: ${maxHipTurn}, ${fps}/${stance}/${direction}`);
    step(fps,{jumpReleased:true});assert.equal(p.state,'air','push swallowed the ollie release');
    rows.push({fps,stance,direction,pushes,charge,minLeadAgreement,maxHipTurn});
  }
  for(const stance of tuningOnly?[]:[-1,1]){
    reset(60,stance);
    for(let f=0;f<50;f++)step(60,{jumpHeld:true});
    assert.ok(motion.diagnostics.speedRecoveryPush,'fixture did not enter a recovery stroke');
    step(60,{jumpHeld:true,jumpCancelled:true});
    assert.equal(motion.diagnostics.speedRecoveryPush,false,'cancel retained the recovery latch');
    assert.equal(p.grounded,true,'cancel triggered an ollie');
    step(60,{jumpHeld:true,spinPressed:true,spinHeld:true});
    assert.equal(motion.diagnostics.nativeOwner,'spin','pump swallowed a ground spin');
    // Fast X stays a crouch/ollie charge, and icy fakie keeps the authored ice
    // feet even when X is being used to recover speed.
    reset(60,stance);players.forEach(player=>player.speed=18);
    for(let f=0;f<20;f++){step(60,{jumpHeld:true});assert.equal(motion.diagnostics.speedRecoveryPush,false);}
    assert.equal(p.charging,true);
    reset(60,stance);players.forEach(player=>{player.pos.set(300,.02,6);player.prevPos.copy(player.pos);});
    for(let f=0;f<75;f++)step(60,{jumpHeld:true});
    assert.equal(motion.diagnostics.nativeOwner,'ice balance');assert.equal(motion.diagnostics.iceBlend,1);
    assert.equal(motion.boardScribble.active,false);
  }
  // Recovery is relative to the live UI cruising speed, not the old 19 m/s
  // cutoff for the ordinary forward-stick push.
  const savedCruise=TUNING.cruiseSpeed,savedMax=TUNING.maxSpeed;
  try{
    TUNING.cruiseSpeed=20;TUNING.maxSpeed=30;reset(60,-1);
    players.forEach(player=>{player.speed=10;player.lastPlanar=10;});
    let pushes=0;for(let f=0;f<300;f++){
      step(60,{jumpHeld:true});if(motion.phase.startsWith('push'))pushes++;
    }
    assert.ok(pushes>10,'higher UI cruise speed suppressed recovery pushes');
    assert.ok(p.speed>=TUNING.cruiseSpeed,`held X reached ${p.speed}, expected cruise ${TUNING.cruiseSpeed}`);
    assert.equal(motion.diagnostics.speedRecoveryPush,false);
  }finally{TUNING.cruiseSpeed=savedCruise;TUNING.maxSpeed=savedMax;}
  reset(60,-1);players.forEach(player=>{player.pos.set(-300,.02,6);player.prevPos.copy(player.pos);player.speed=1.5;});
  let softPushes=0;for(let f=0;f<180;f++){
    step(60,{jumpHeld:true});if(motion.phase.startsWith('push'))softPushes++;
  }
  assert.ok(softPushes>5,'soft-ground recovery did not pump');
  assert.ok(Math.abs(p.speed-4)<.01,`soft-ground speed cap changed: ${JSON.stringify({speed:p.speed,limit:p.groundHit?.groundSpeedLimit,pos:p.pos.toArray(),mounted:p.freeSkate,phase:motion.phase})}`);
  assert.equal(motion.diagnostics.speedRecoveryPush,false,'unreachable cruise kept soft-ground pumping forever');
  // A reset during the push/pickup must never look like an equipment change.
  for(const phase of tuningOnly?[]:['push','mount','dismount']){
    reset(60,-1);step(60,{moveY:1,jumpHeld:true,jumpPressed:true});
    motion.phase=phase;
    players.forEach(player=>player.respawn(level,true,true));
    runtime.restart();step(60,{});
    assert.equal(motion.phase,'foot');assert.equal(motion.boardScribble.active,false);
    assert.equal(motion.boardScribble.appearances,0);assert.equal(motion.boardScribble.disappearances,0);
  }
  presentation.dispose();runtime.dispose();assets.ink.dispose();
  console.log(JSON.stringify({frames,rows},null,2));
},{levelEntry:{id:'push-recovery',name:'Push recovery',data:{v:1,name:'Push recovery',spawn:[0,.02,6],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},
    {t:'platform',p:[-300,-.09,0],s:[100,.2,300],groundSpeedLimit:4,edgeGrinding:false},
    {t:'platform',p:[300,-.09,0],s:[100,.2,300],slip:true,iceGrip:.08,edgeGrinding:false},
    {t:'gate',p:[0,0,-400]}]}}});
