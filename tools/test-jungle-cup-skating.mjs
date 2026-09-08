import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async ({ THREE, server, player, level, step, TUNING, CONST }) => {
  const { SkateChaseCamera, chaseHeadingStep } = await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  const place = (p,h,speed=23) => {
    player.respawn(level,true,true,{position:new THREE.Vector3(...p),heading:new THREE.Vector3(...h)});
    player.axisF.set(...h).normalize();player.axisL.set(player.axisF.z,0,-player.axisF.x);
    player.freeSkate=true;player.speed=speed;
    player.groundHit=player.queryGround(level);player.rideNormal.copy(player.groundHit.normal);
  };
  // Identical rider inputs must produce identical motion with a stationary,
  // lagging, orbiting, or completely backwards camera.
  const samples = [];
  for(const cameraOffset of [0,.8,Math.PI]){
    place([0,.1,10],[0,0,-1],12);
    const forward=makeInput({moveY:1,moveX:.65,jumpHeld:true,jumpPressed:true});
    for(let i=0;i<100;i++){
      player.camDir.set(Math.sin(cameraOffset+i*.02),0,Math.cos(cameraOffset+i*.02));
      step(forward);
    }
    samples.push([...player.pos.toArray(),...player.axisF.toArray(),player.speed]);
  }
  assert.deepEqual(samples[0],samples[1]);assert.deepEqual(samples[0],samples[2]);
  assert.ok(samples[0][0]>5,'right steering did not turn rider right');
  // A stop remains mounted and immediately responds again, with no walking
  // handoff, charge-commit wait, or reversed mapping after the camera turns.
  place([0,.1,10],[1,0,0],12);
  const brake=makeInput({moveY:-1});for(let i=0;i<60;i++)step(brake);
  assert.equal(player.speed,0);assert.equal(player.freeSkate,true);assert.equal(player.brakeLockT,0);
  const pivot=makeInput({moveX:1});for(let i=0;i<45;i++)step(pivot);
  const heading=player.axisF.clone();
  const facing=new THREE.Vector3(-Math.sin(player.visualYaw),0,-Math.cos(player.visualYaw));
  assert.ok(facing.dot(heading)>.97,'mounted steering left body facing behind');
  const push=makeInput({moveY:1});for(let i=0;i<60;i++)step(push);
  assert.ok(player.speed>9,'brake recovery did not accelerate');
  assert.ok(player.axisF.dot(heading)>.99,'forward changed heading instead of accelerating');

  const cases=[
    ['north',[28,.1,-90],[0,0,-1]],['south',[0,.1,0],[0,0,1]],
    ['west',[-28,.1,-70],[-1,0,0]],['east',[28,.1,-42],[1,0,0]],
    ['north-west',[-26,.1,-98],[-1,0,-1]],['north-east',[26,.1,-98],[1,0,-1]],
    ['south-west',[-26,.1,6],[-1,0,1]],['south-east',[26,.1,6],[1,0,1]],
  ];
  let returns=0, apexChecks=0, worstPlaneError=0, worstFraming=0;
  for(const speed of [16,23,32])for(const [name,p,h] of cases){
    place(p,h,speed);
    const input=makeInput({moveY:1,jumpHeld:true,jumpPressed:true});
    const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(58,16/9,.1,400);
    let launch=null,landed=false,minY=100;
    for(let i=0;i<420;i++){
      const previous=player.pos.clone(),wasVert=player.vertAir;
      step(input);minY=Math.min(minY,player.pos.y);
      assert.ok(player.pos.toArray().every(Number.isFinite),`${name}: nonfinite position`);
      assert.ok(player.pos.distanceTo(previous)<1.1,`${name}: discontinuous travel`);
      assert.equal(player.isBailing,false,`${name}: ordinary vert caused bail`);
      if(!wasVert&&player.vertAir) launch={p:player.pos.clone(),n:player.vertNormal.clone()};
      rig.update(camera,{position:player.pos,heading:player.skateCameraHeading,up:player.skateCameraUp,vertAir:player.vertAir,
        vertNormal:player.vertNormal,verticalSpeed:player.vVel,speed:player.speed,grounded:player.grounded,bailing:player.skateCameraBailing},
        CONST.fixedStep,i===0,level.groundMeshes,TUNING);
      camera.updateMatrixWorld(true);
      const torso=player.pos.clone().addScaledVector(player.skateCameraUp,1.5);
      const ndc=torso.clone().project(camera);
      worstFraming=Math.max(worstFraming,Math.abs(ndc.x),Math.abs(ndc.y));
      assert.ok(Math.abs(ndc.x)<.92&&Math.abs(ndc.y)<.92,`${name}: camera lost rider (${ndc.x},${ndc.y})`);
      const view=torso.clone().sub(camera.position),distance=view.length();
      const sight=new THREE.Raycaster(camera.position,view.normalize(),.05,Math.max(.05,distance-.2));
      assert.equal(sight.intersectObjects(level.groundMeshes,false).length,0,`${name}: coping hides the rider`);
      if(player.vertAir&&!player.grounded&&Math.abs(player.vVel)<1){
        assert.ok(player.alignPose<.1,`${name}@${speed} frame ${i}: apex pose ${player.alignPose}, launch ${player.vertLaunchSpeed}, vy ${player.vVel}`);apexChecks++;
      }
      if(launch&&player.grounded){
        const error=Math.abs(player.pos.clone().sub(launch.p).dot(launch.n));
        worstPlaneError=Math.max(worstPlaneError,error);
        assert.ok(error<.025,`${name}: ${error}m shunt from launch plane`);
        assert.ok(player.speed>8,`${name}: drop-in lost momentum`);
        returns++;landed=true;break;
      }
    }
    assert.ok(minY>=-.025,`${name}: fell under floor`);
    assert.ok(landed,`${name} at ${speed}: stalled/never returned from vert`);
  }
  assert.ok(apexChecks>=24);
  // True 180s must traverse an arc, never collapse a vector or snap the lens.
  for(const hz of [30,60,120]){
    let yaw=0;
    for(let i=0;i<hz;i++){
      const next=chaseHeadingStep(yaw,Math.PI,1/hz);
      assert.ok(Number.isFinite(next)&&Math.abs(next-yaw)<=Math.PI*5/3/hz+1e-8);
      yaw=next;
    }
    assert.ok(Math.abs(yaw-Math.PI)<.025,`camera return not settled at ${hz}Hz`);
  }
  // Incoming air contacts on each face at terminal speed and a range of
  // angles must hit the transition before its underlying foundation.
  let catches=0;
  for(const [name,p,h] of cases)for(const offset of [-.5,0,.5]){
    place(p,h,23);const input=makeInput({moveY:1,jumpHeld:true,jumpPressed:true});
    for(let i=0;i<240&&!player.vertAir;i++)step(input);
    assert.ok(player.vertAir,name);
    player.pos.addScaledVector(player.vertNormal,offset);player.pos.y+=4;
    player.prevPos.copy(player.pos);player.vVel=-45;player.vertLatVel=offset*4;
    for(let i=0;i<150&&!player.grounded;i++)step(makeInput());
    assert.ok(player.grounded&&player.pos.y>=-.025,`${name}: terminal-speed contact leaked`);
    assert.equal(player.totalDeaths,0);catches++;
  }
  // The attached report's entire input stream is now a permanent regression.
  player.respawn(level,true);const replay=JSON.parse(await readFile(new URL('./fixtures/jungle-cup-user-replay.json',import.meta.url),'utf8'));
  const replayer=new Replayer();replayer.begin(replay);const input=makeInput();let frames=0;
  while(replayer.active){
    if(!replayer.feed(input,player.camDir))break;step(input);frames++;
    assert.ok(player.pos.toArray().every(Number.isFinite));
    assert.ok(player.pos.y>=-.05,'user replay clipped below the foundation');
    assert.equal(player.totalDeaths,0,'user replay died');
  }
  replayer.end();assert.equal(frames,replay.frames);
  // Mixed sustained input, jumps, tricks, coping catches and recoveries. Start
  // near every corner/side so the run cannot pass by merely circling the flat.
  let stressFrames=0;
  for(let seed=0;seed<cases.length;seed++){
    const [,p,h]=cases[seed];place(p,h,23);let stalled=0;
    for(let i=0;i<2400;i++){
      const phase=i%180,turn=Math.sin(Math.floor(i/63)*2.17+seed*1.73);
      const input=makeInput({moveY:1,moveX:Math.abs(turn)<.3?0:turn*.7,
        jumpHeld:phase<140,jumpPressed:phase===0,jumpReleased:phase===140,
        grindHeld:i%530<45,grindPressed:i%530===0,
        spinHeld:i%421<10,spinPressed:i%421===0});
      const before=player.pos.clone();step(input);stressFrames++;
      assert.ok(player.pos.toArray().every(Number.isFinite));
      assert.ok(player.pos.y>=-.05,`stress ${seed}/${i}: floor penetration ${player.pos.toArray()}`);
      assert.equal(player.totalDeaths,0,`stress ${seed}/${i}: escaped park`);
      assert.ok(Math.abs(player.pos.x)<58&&player.pos.z<38&&player.pos.z>-130,'perimeter leak');
      const stuck=player.grounded&&player.freeSkate&&!player.isBailing&&player.lipStallT<=0&&
        player.groundHit?.normal.y<.76&&before.distanceToSquared(player.pos)<1e-5;
      stalled=stuck?stalled+1:0;
      assert.ok(stalled<120,`stress ${seed}/${i}: welded to transition`);
    }
  }
  console.log(`PASS park skating: ${returns} same-plane vert returns, ${catches} terminal-speed contacts, ${frames} replay + ${stressFrames} mixed-input frames; camera-independent controls, mounted brake/restart, apex pose and 30/60/120Hz camera turns. Plane error ${worstPlaneError.toExponential(2)}m; maximum rider NDC ${worstFraming.toFixed(3)}.`);
});
