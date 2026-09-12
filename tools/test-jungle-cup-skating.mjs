import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async ({ THREE, server, player, level, step, TUNING, CONST }) => {
  const { SkateChaseCamera, SKATE_CAMERA } = await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const { SKATE_PARK, skateSurfaceDirection, skateSurfaceHeading } = await server.ssrLoadModule('/src/skateParkPhysics.ts');
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  const place = (p,h,speed=TUNING.parkChargeSpeed) => {
    player.respawn(level,true,true,{position:new THREE.Vector3(...p),heading:new THREE.Vector3(...h)});
    player.axisF.set(...h).normalize();player.axisL.set(player.axisF.z,0,-player.axisF.x);
    player.freeSkate=true;player.speed=speed;
    player.groundHit=player.queryGround(level);player.rideNormal.copy(player.groundHit.normal);
  };
  // Independent reference measurements: original inch-based values converted
  // to metres, not expectations inferred from a successful current run.
  assert.ok(Math.abs(SKATE_PARK.vertGravity-31.1727272727)<1e-8);
  assert.equal(SKATE_PARK.airGravity,34.29);
  assert.equal(SKATE_PARK.groundGravity,25.4);
  assert.ok(Math.abs(SKATE_PARK.vertPopMax-6.985)<1e-10);
  for (const degrees of [0,30,60,89,90]) {
    const angle=degrees*Math.PI/180, normal=new THREE.Vector3(0,Math.cos(angle),-Math.sin(angle));
    const heading=new THREE.Vector3(.6,0,.8),direction=skateSurfaceDirection(new THREE.Vector3(),heading,normal);
    assert.ok(Math.abs(direction.x-.6)<1e-8,`${degrees}: approach angle collapsed on the wall`);
    assert.ok(Math.abs(direction.dot(normal))<1e-8);
    assert.ok(skateSurfaceHeading(new THREE.Vector3(),direction,normal).distanceTo(heading)<1e-8);
  }
  const samples=[];
  for(const cameraOffset of [0,.8,Math.PI]){
    place([0,.1,10],[0,0,-1],12);
    const input=makeInput({moveX:.65,jumpHeld:true,jumpPressed:true});
    for(let i=0;i<100;i++){player.camDir.set(Math.sin(cameraOffset+i*.02),0,Math.cos(cameraOffset+i*.02));step(input);}
    samples.push([...player.pos.toArray(),...player.axisF.toArray(),player.speed]);
  }
  assert.deepEqual(samples[0],samples[1]);assert.deepEqual(samples[0],samples[2]);
  assert.ok(samples[0][0]>5,'right steering did not turn rider right');
  place([0,.1,10],[1,0,0],12);
  for(let i=0;i<60;i++)step(makeInput({moveY:-1}));
  assert.equal(player.speed,0);assert.equal(player.freeSkate,true);assert.equal(player.brakeLockT,0);
  // Restored park controls: idle stays stopped; steering picks up to cruise.
  for(let i=0;i<60;i++)step(makeInput());
  assert.equal(player.speed,0);assert.equal(player.freeSkate,true);
  place([28,.1,-80],[0,0,1],0);
  for(let i=0;i<90;i++)step(makeInput({moveY:1}));
  assert.ok(Math.abs(player.speed-TUNING.parkCruiseSpeed)<.03);
  for(let i=0;i<90;i++)step(makeInput({jumpHeld:true,moveY:1}));
  assert.ok(Math.abs(player.speed-TUNING.parkChargeSpeed)<.03,'charged target differs from platforming');

  // Start outside the new interior sessions when isolating perimeter vert.
  const cases=[
    ['north',[28,.1,-90],[0,0,-1]],['south',[0,.1,0],[0,0,1]],
    ['west',[-28,.1,-70],[-1,0,0]],['east',[28,.1,-42],[1,0,0]],
    ['north-west',[-37,.1,-108],[-1,0,-1]],['north-east',[37,.1,-108],[1,0,-1]],
    ['south-west',[-37,.1,16],[-1,0,1]],['south-east',[37,.1,16],[1,0,1]],
  ];
  let returns=0,apexChecks=0,worstShunt=0,worstFraming=0;
  for(const speed of [16,21,26])for(const [name,p,h] of cases){
    place(p,h,speed);
    const input=makeInput({jumpHeld:true,jumpPressed:true});
    const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(SKATE_CAMERA.verticalFov,16/9,.1,400);
    let launch=null,landed=false;
    for(let i=0;i<500;i++){
      const previous=player.pos.clone(),wasVert=player.vertAir,oldVy=player.vVel,oldSpeed=player.speed;
      step(input);
      assert.ok(player.pos.toArray().every(Number.isFinite),`${name}: nonfinite position`);
      assert.ok(player.pos.distanceTo(previous)<1.1,`${name}: discontinuous travel`);
      assert.equal(player.isBailing,false,`${name}: ordinary vert caused bail`);
      if(!wasVert&&player.vertAir){
        launch={p:player.pos.clone(),n:player.vertNormal.clone(),vy:player.vVel,i};
        assert.ok(player.pos.y>=4.39,`${name}: launched before the actual 4.4m lip`);
        assert.ok(player.pos.y<4.85,`${name}: missed the lip`);
        assert.ok(player.vVel<=oldSpeed+(TUNING.parkChargeAcceleration+SKATE_PARK.groundGravity)*CONST.fixedStep+.05,`${name}: free lip pop minted velocity`);
      }
      if(launch&&wasVert&&player.vertAir&&!player.grounded&&name==='south'){
        assert.ok(Math.abs(player.vVel-oldVy+31.1727272727*CONST.fixedStep)<1e-7,'gravity changed around apex');
        const t=(i-launch.i)*CONST.fixedStep;
        const expected=launch.p.y+launch.vy*t-.5*31.1727272727*t*t;
        assert.ok(Math.abs(player.pos.y-expected)<1e-7,'vert is not a ballistic arc');
      }
      rig.update(camera,{position:player.pos,heading:player.skateCameraHeading,up:player.skateCameraUp,vertAir:player.vertAir,
        vertNormal:player.vertNormal,verticalSpeed:player.vVel,speed:player.speed,grounded:player.grounded,bailing:player.skateCameraBailing},
        CONST.fixedStep,i===0,level.groundMeshes,TUNING);
      camera.updateMatrixWorld(true);
      for(const height of [0.1,1.5,3.0]){
        const ndc=player.pos.clone().addScaledVector(player.skateCameraUp,height).project(camera);
        worstFraming=Math.max(worstFraming,Math.abs(ndc.x),Math.abs(ndc.y));
        assert.ok(Math.abs(ndc.x)<.96&&Math.abs(ndc.y)<.96,`${name}: camera cropped rider (${ndc.x},${ndc.y})`);
      }
      const torso=player.pos.clone().addScaledVector(player.skateCameraUp,1.5);
      const view=torso.clone().sub(camera.position),distance=view.length();
      const sight=new THREE.Raycaster(camera.position,view.normalize(),.05,Math.max(.05,distance-.2));
      assert.equal(sight.intersectObjects(level.groundMeshes,false).length,0,`${name}: coping hides the rider`);
      if(player.vertAir&&!player.grounded&&Math.abs(player.vVel)<1){
        assert.ok(player.skateCameraUp.dot(player.vertNormal)>.98,`${name}: apex was forced upright`);
        assert.ok(camera.up.dot(player.vertNormal)>.65,`${name}: camera inverted the wall frame`);apexChecks++;
      }
      if(launch&&player.grounded){
        if(!name.includes('-')){
          const error=Math.abs(player.pos.clone().sub(launch.p).dot(launch.n));
          worstShunt=Math.max(worstShunt,error);
          assert.ok(error<.09,`${name}: ${error}m shunt from launch plane`);
        }
        assert.ok(player.speed>8,`${name}: drop-in lost momentum`);
        returns++;landed=true;break;
      }
      assert.ok(player.pos.y>=-.025,`${name}: fell under floor`);
    }
    assert.ok(landed,`${name} at ${speed}: stalled/never returned from vert`);
  }
  assert.ok(apexChecks>=24);
  // Angled entry must survive the transition without flattening into a coping
  // slide. A curved return must continue tracking the real wall around a bend.
  // At the new 23 m/s target, z=8 meets the corner almost head-on.
  // Start farther forward to retain a genuinely oblique curved-wall air.
  place([30,.1,12],[.8,0,1]);
  let startNormal=null,trackedTurn=0,angledLaunch=false;
  for(let i=0;i<400;i++){
    step(makeInput({jumpHeld:true,jumpPressed:i===0}));
    if(player.vertAir&&!player.grounded){
      angledLaunch=true;
      assert.ok(Math.abs(player.vertLatVel)<12,'approach collapsed into a coping slide');
      startNormal??=player.vertNormal.clone();
      trackedTurn=Math.max(trackedTurn,startNormal.angleTo(player.vertNormal));
      assert.equal(player.vertTracked,true,'lost a continuous curved coping');
    }
    if(startNormal&&player.grounded)break;
  }
  assert.ok(angledLaunch);assert.ok(trackedTurn>.03,'curved coping did not redirect the air');
  // A charged release is a real extra impulse; holding X through the edge is
  // not. The same input sequence also checks there is no swallowed release.
  place([0,.1,10],[0,0,1]);let popped=false,chargedLaunch=null,chargedApex=0;
  for(let i=0;i<300;i++){
    const pop=!popped&&player.grounded&&player.rideNormal.y<.12;if(pop)popped=true;
    step(makeInput({jumpHeld:!popped,jumpPressed:i===0,jumpReleased:pop}));
    if(player.vertAir&&!chargedLaunch)chargedLaunch={p:player.pos.clone(),vy:player.vVel};
    chargedApex=Math.max(chargedApex,player.pos.y);
    if(chargedLaunch&&player.grounded)break;
  }
  assert.ok(chargedLaunch&&chargedLaunch.vy>SKATE_PARK.vertPopMax,'vert release lost its climb');
  assert.ok(Math.abs(chargedApex-chargedLaunch.p.y-chargedLaunch.vy**2/(2*SKATE_PARK.vertGravity))<.03,'charged hangtime is not ballistic');
  // Air direction inputs rotate the board; releasing does not auto-complete
  // a half turn. No direction input changes the locked plane position.
  place([0,.1,10],[0,0,1]);for(let i=0;i<200&&!player.vertAir;i++)step(makeInput({jumpHeld:true}));
  const z=player.pos.z;
  for(let i=0;i<14;i++)step(makeInput({moveX:1}));
  const partial=player.grabSpinAngle;assert.ok(Math.abs(partial)>.3);
  for(let i=0;i<10;i++)step(makeInput());
  assert.equal(player.grabSpinAngle,partial,'release silently completed a trick');
  assert.ok(Math.abs(player.pos.z-z)<.001,'spin translated the locked air');

  // Actual charged airs: a completed 360 banks, an off-axis 90 bails, and
  // an unspun angled air rides away without a phantom rotation score.
  for (const [label,spinFrames,angle,expectedBail] of [
    ['360',58,0,false],['90',19,0,true],['angled',0,.45,false],
  ]) {
    place([0,.1,10],[angle,0,1]);let popped=false,air=0,hadAir=false,resolved=false;
    for(let i=0;i<500;i++){
      const pop=!popped&&player.grounded&&player.rideNormal.y<.12;if(pop)popped=true;
      if(player.vertAir)air++;
      step(makeInput({jumpHeld:!popped,jumpReleased:pop,jumpPressed:i===0,moveX:hadAir&&air<=spinFrames?1:0}));
      if(player.vertAir)hadAir=true;
      if(hadAir&&(player.grounded||player.isBailing)){
        assert.equal(player.isBailing,expectedBail,`${label}: incorrect actual landing judgement`);
        if(label==='360')assert.ok(player.comboLabels.some(l=>l.includes('360')));
        if(label==='angled')assert.equal(player.comboPoints,0,'automatic turn counted as a trick');
        resolved=true;break;
      }
    }
    assert.ok(resolved,`${label}: never completed air`);
  }

  // Up is only allowed to break vert when the feet clear the wall. It may
  // not inject an outward velocity through the solid vertical top.
  place([0,.1,10],[0,0,1]);for(let i=0;i<200&&!player.vertAir;i++)step(makeInput({jumpHeld:true}));
  player.pos.y=3.8;player.prevPos.copy(player.pos);player.vVel=12;
  player.airborneT=.05;player.parkBreakHold=.14;
  step(makeInput({moveY:1}));assert.equal(player.vertAir,true,'Up pushed through a solid vert face');
  player.pos.y=4.6;player.prevPos.copy(player.pos);player.vVel=9;
  step(makeInput({moveY:1}));assert.equal(player.vertAir,false,'Up failed to clear the coping');
  assert.ok(player.axisF.z>0&&player.speed>5,'clear transfer lost its outward motion');
  for(let i=0;i<180;i++)step(makeInput());
  assert.equal(player.totalDeaths,0);assert.ok(player.pos.y>=-.05,'transfer escaped the supported deck');

  // The same camera target has the same response at different render rates.
  const rotations=[];
  for(const hz of [30,60,120]){
    const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(57,16/9,.1,400);
    const rider={position:new THREE.Vector3(),heading:new THREE.Vector3(0,0,-1),up:new THREE.Vector3(0,1,0),vertAir:false,vertNormal:new THREE.Vector3(0,0,1),verticalSpeed:0,speed:12,grounded:true,bailing:false};
    rig.update(camera,rider,0,true,[]);
    rider.vertAir=true;rider.grounded=false;rider.up.copy(rider.vertNormal);
    for(let i=0;i<hz;i++)rig.update(camera,rider,1/hz,false,[]);
    rotations.push(camera.quaternion.clone());
  }
  assert.ok(rotations[0].angleTo(rotations[1])<1e-6&&rotations[1].angleTo(rotations[2])<1e-6);

  let catches=0;
  for(const [name,p,h] of cases)for(const offset of [-.5,0,.5]){
    place(p,h,23);const input=makeInput({jumpHeld:true,jumpPressed:true});
    for(let i=0;i<240&&!player.vertAir;i++)step(input);
    assert.ok(player.vertAir,name);
    player.pos.addScaledVector(player.vertNormal,offset);player.pos.y+=4;
    player.prevPos.copy(player.pos);player.vVel=-45;player.vertLatVel=offset*4;player.vertTracked=false;
    for(let i=0;i<150&&!player.grounded;i++)step(makeInput());
    assert.ok(player.grounded&&player.pos.y>=-.025,`${name}: terminal-speed contact leaked`);
    assert.equal(player.totalDeaths,0);catches++;
  }
  player.respawn(level,true);const replay=JSON.parse(await readFile(new URL('./fixtures/jungle-cup-user-replay.json',import.meta.url),'utf8'));
  const replayer=new Replayer();replayer.begin(replay);const input=makeInput();let frames=0;
  while(replayer.active){
    if(!replayer.feed(input,player.camDir))break;step(input);frames++;
    assert.ok(player.pos.toArray().every(Number.isFinite));
    assert.ok(player.pos.y>=-.05,'user replay clipped below the foundation');
    assert.equal(player.totalDeaths,0,'user replay died');
  }
  replayer.end();assert.equal(frames,replay.frames);
  let stressFrames=0;
  for(let seed=0;seed<cases.length;seed++){
    const [,p,h]=cases[seed];place(p,h,23);let stalled=0;
    for(let i=0;i<2400;i++){
      const phase=i%180,turn=Math.sin(Math.floor(i/63)*2.17+seed*1.73);
      const input=makeInput({moveY:i%700<80?1:0,moveX:Math.abs(turn)<.3?0:turn*.7,
        jumpHeld:phase<140,jumpPressed:phase===0,jumpReleased:phase===140,
        grindHeld:i%530<45,grindPressed:i%530===0,spinHeld:i%421<10,spinPressed:i%421===0});
      const before=player.pos.clone();step(input);stressFrames++;
      assert.ok(player.pos.toArray().every(Number.isFinite));
      assert.ok(player.pos.y>=-.05,`stress ${seed}/${i}: floor penetration ${player.pos.toArray()}`);
      assert.equal(player.totalDeaths,0,`stress ${seed}/${i}: escaped park`);
      assert.ok(Math.abs(player.pos.x)<58&&player.pos.z<38&&player.pos.z>-130,'perimeter leak');
      const stuck=player.grounded&&player.freeSkate&&!player.isBailing&&player.lipStallT<=0&&
        player.groundHit?.normal.y<.76&&before.distanceToSquared(player.pos)<1e-5;
      stalled=stuck?stalled+1:0;assert.ok(stalled<120,`stress ${seed}/${i}: welded to transition`);
    }
  }
  console.log(`PASS preserved park motor: ${returns} vert returns, ballistic gravity/no free pop, charged impulse, full surface frame, curved tracking, no spin snap, ${catches} terminal contacts, ${frames} replay + ${stressFrames} stress frames. Camera: full rider visibility, wall-oriented apex, 30/60/120 Hz equivalence. Shunt ${worstShunt.toFixed(4)}m; framing ${worstFraming.toFixed(3)}.`);
});
