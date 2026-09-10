import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE, server, Level, Player, CONST}) => {
  const {SWIMMING, stepSwimVelocity, stepSwimBuoyancy} = await server.ssrLoadModule('/src/swimming.ts');
  const ends=[];
  for(const hz of [30,60,120]) {
    const v=new THREE.Vector3(),forward=new THREE.Vector3(0,0,-1);
    let y=5,vy=-12;
    for(let i=0;i<hz*2;i++) {
      stepSwimVelocity(v,forward,1,1,false,1/hz);
      const b=stepSwimBuoyancy(y,vy,1,1.4,1/hz);y=b.y;vy=b.velocity;
    }
    assert.ok(v.length()<=SWIMMING.speed+1e-9,'diagonal speed bonus');
    ends.push([v.x,v.z,y,vy]);
  }
  for(const e of ends)for(let i=0;i<4;i++)assert.ok(Math.abs(e[i]-ends[0][i])<1e-8,'frame-rate-dependent float/drag');
  const {createPlayerStarterAnimationSuite,reconcilePlayerStarterAnimationSuite} = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const {RigBinding} = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const {createCharacterAnimationRuntime} = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {normalizeCustomLevelData} = await server.ssrLoadModule('/src/level.ts');
  const scene=new THREE.Scene(),level=new Level(scene,{id:'jungle',name:'Jungle Ruins'});
  scene.updateMatrixWorld(true);
  const player=new Player(scene);player.rawInput=makeInput();player.respawn(level,true);
  const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition;
  const suite=createPlayerStarterAnimationSuite(rig);
  const runtime=createCharacterAnimationRuntime(player,suite);
  const swims=suite.clips.filter(c=>c.id.startsWith('player.swim'));
  assert.equal(swims.length,2);
  for(const c of swims){
    assert.equal(c.metadata.sourceAnimation.license,'CC0-1.0');
    assert.ok(c.tracks.length>=22);assert.equal(c.contacts.length,0);
    for(const track of c.tracks)assert.deepEqual(track.keys.at(0).value,track.keys.at(-1).value,'swim loop seam');
  }
  const old={...suite,metadata:{...suite.metadata,playerStarterCatalogVersion:19},clips:suite.clips.filter(c=>!c.id.startsWith('player.swim'))};
  assert.equal(reconcilePlayerStarterAnimationSuite(old,rig).clips.filter(c=>c.id.startsWith('player.swim')).length,2);
  const capture=level.captureData();assert.ok(normalizeCustomLevelData(capture),'shore capture rejected');
  assert.ok(capture.ocean.swimBounds);assert.ok(capture.components.some(c=>c.nm==='Jungle cove beach and seabed'));
  assert.equal(level.swimmingSurfaceAt(0,-100),null,'water leaked into original jungle route');
  const lives=player.lives;
  const tick=input=>{level.update(CONST.fixedStep);player.step(CONST.fixedStep,input,level);input.consumeEdges();
    assert.equal(player.lives,lives,'swimming consumed a life');assert.notEqual(player.state,'dead');
    assert.ok(player.pos.toArray().every(Number.isFinite));};
  let entered=false,exit=false;
  const headYs=[];
  for(let i=0;i<1600;i++){
    tick(makeInput({moveY:-1}));
    if(player.swimming){entered=true;assert.equal(player.freeSkate,false);assert.equal(runtime.activeClipId,'player.swim');}
    if(player.pos.z>52)break;
  }
  assert.ok(entered,'walk from spawn did not enter water');
  assert.ok(player.pos.z>42,'swimmer cannot traverse the cove');
  const swimPosition=player.pos.clone();
  for(let i=0;i<480;i++){
    tick(makeInput());
    const head=player.animationRig.jointsById.get('head')?.node;
    if(head)headYs.push(head.getWorldPosition(new THREE.Vector3()).y);
  }
  assert.equal(player.state,'swim');assert.equal(runtime.activeClipId,'player.swim-idle');
  assert.ok(player.swimVelocity.length()<.01,'released input kept accelerating');
  assert.ok(player.pos.distanceTo(swimPosition)<3,'idle drift failed to settle');
  for(let i=0;i<1600;i++){
    tick(makeInput({moveY:1}));
    if(entered&&player.grounded&&player.state==='ride')exit=true;
    if(player.pos.z<12)break;
  }
  assert.ok(exit&&player.pos.z<12,'cannot walk back out of the sea');
  assert.ok(!player.freeSkate,'water exit unexpectedly mounted the board');
  // A hard fall or an active knockdown enters buoyancy rather than soft-locking on the bed.
  player.pos.set(swimPosition.x,8,52);player.prevPos.copy(player.pos);player.state='air';player.grounded=false;
  player.vVel=-22;player.airFromSkate=true;player.bailDownT=1;player.ragActive=true;
  for(let i=0;i<360;i++)tick(makeInput());
  assert.equal(player.state,'swim');assert.equal(player.isBailing,false);
  // The new cove remains enclosed while pushing hard against each open-water edge.
  const b=capture.ocean.swimBounds;
  for (const [moveX,moveY] of [[-1,0],[1,0],[0,-1],[-1,-1],[1,-1]]) {
    player.respawn(level,true);player.pos.set(swimPosition.x,level.water.seaLevel-1.6,60);
    player.prevPos.copy(player.pos);player.state='air';player.grounded=false;
    for(let i=0;i<1400;i++)tick(makeInput({moveX,moveY,jumpHeld:true}));
    assert.equal(player.state,'swim','water edge lost buoyancy');
    assert.ok(player.pos.x>b[0]&&player.pos.x<b[2]&&player.pos.z<b[3],'escaped swimming boundary');
  }
  player.respawn(level,true);assert.equal(player.swimming,false);assert.equal(player.swimVelocity.length(),0);
  console.log('PASS swim source loops/migration, 30/60/120 Hz buoyancy/drag, spawn → wade → swim → idle → shore, hard-fall recovery, reset, five fast edge approaches and ocean capture.');
  console.log('Water/head range', level.water.seaLevel, headYs.length? [Math.min(...headYs),Math.max(...headYs)]:[]);
  runtime.dispose();level.dispose();
});
