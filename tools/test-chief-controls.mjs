import assert from 'node:assert/strict';
import * as THREE from 'three';
import {withChiefRuntime,chiefInput} from './crab-chief-harness.mjs';

await withChiefRuntime(async({l,p,bossCamera,camera,server})=>{
  const {ChiefInputFrame}=await server.ssrLoadModule('/src/boss/inputFrame.ts');
  const boss=l.boss,originalStep=boss.step;
  let previous={};
  // These fixtures use actual screen/device samples. The journey harness's
  // tick accepts world intent, so bypass only that authoring conversion.
  const tick=(sample={})=>{
    const input=chiefInput(sample,previous);previous={...input};p.rawInput=input;
    p.step(1/60,input,l);l.update(1/60);p.commitRenderStep(l);
    bossCamera.restore(camera);bossCamera.apply(camera,boss,p.renderPosition,1/60);
    p.camDir.copy(bossCamera.heading);input.consumeEdges();
  };
  assert.equal(p.masks,2,'boss arrival did not grant two masks');
  assert.equal('playerHealth' in boss,false,'boss retained a separate heart pool');
  assert.equal('playerHealth' in boss.diagnostics,false,'boss still exposed heart health');
  p.masks=0;p.respawn(l,false);assert.equal(p.masks,2,'soft boss retry did not restore two masks');
  p.masks=0;p.respawn(l,true);assert.equal(p.masks,2,'hard boss restart did not restore two masks');
  // Combat is suppressed in these movement fixtures; all Player input,
  // terrain, momentum, jump and collision paths remain production code.
  boss.step=()=>({hurt:false,fatal:false,strike:false});
  // Arena rail curb contacts are tested by the fight pilot, separately from
  // this control-basis fixture. Keep its walking/cardinal paths unobstructed.
  l.rails.length=0;
  const place=(angle)=>{
    const position=new THREE.Vector3(Math.sin(angle)*7,.1,-28+Math.cos(angle)*7);
    p.rawInput={moveX:0,moveY:0};p.camDir.set(-Math.sin(angle),0,-Math.cos(angle));
    p.respawn(l,true,false,{position});boss.state='idle';boss.model.pose({state:'idle',time:1,stateTime:1,phase:1,target:position,left:true,exposed:false,defeated:false});
    bossCamera.restore(camera);bossCamera.apply(camera,boss,p.renderPosition,1/60,true);p.camDir.copy(bossCamera.heading);
    tick();
  };
  const step=sample=>{p.camDir.copy(bossCamera.heading);return tick(sample);};
  let walking=0,skating=0,landings=0;
  for(let i=0;i<8;i++)for(const [mx,my] of [[0,1],[1,0],[0,-1],[-1,0]]){
    const angle=i*Math.PI/4;place(angle);
    const forward=p.camDir.clone(),right=new THREE.Vector3(-forward.z,0,forward.x),start=p.pos.clone();
    for(let frame=0;frame<20;frame++){
      const before=p.pos.clone(),heading=p.camDir.clone();
      step({moveX:mx,moveY:my});
      const moved=p.pos.clone().sub(before).setY(0);
      const screen=heading.clone().multiplyScalar(my).addScaledVector(new THREE.Vector3(-heading.z,0,heading.x),mx);
      if(moved.length()>.01)assert.ok(moved.normalize().dot(screen)>.985,'held walking input drifted out of the visible camera frame');
    }
    const displacement=p.pos.clone().sub(start);displacement.y=0;
    const expected=forward.multiplyScalar(my).addScaledVector(right,mx).normalize();
    assert.ok(displacement.length()>.4,`walking stalled at angle ${angle}, stick ${mx},${my}`);
    assert.ok(displacement.normalize().dot(expected)>.985,`walking inverted at angle ${angle}, stick ${mx},${my}; actual ${displacement.toArray()} expected ${expected.toArray()}, camera ${p.camDir.toArray()}, basis ${JSON.stringify(p.bossInputBasis)}, pos ${p.pos.toArray()}`);
    assert.equal(p.isBailing,false);walking++;
  }
  for(let i=0;i<8;i++)for(const [mx,my] of [[0,1],[1,0]]){
    const angle=i*Math.PI/4;place(angle);
    const start=p.pos.clone();
    const screenPath=new THREE.Vector3();
    for(let frame=0;frame<45;frame++){
      const before=p.pos.clone(),heading=p.camDir.clone();
      step({moveX:mx,moveY:my,jumpHeld:true});
      const travelled=p.pos.clone().sub(before).setY(0).length();
      screenPath.addScaledVector(heading.multiplyScalar(my).addScaledVector(new THREE.Vector3(-p.bossInputBasis.z,0,p.bossInputBasis.x),mx),travelled);
    }
    const displacement=p.pos.clone().sub(start);displacement.y=0;
    assert.ok(displacement.length()>.4,`skating stalled at angle ${angle}, stick ${mx},${my}, displacement ${displacement.toArray()}, state ${p.state}, speed ${p.speed}, board ${p.boardRolling}, basis ${JSON.stringify(p.bossInputBasis)}, pos ${p.pos.toArray()}`);
    assert.ok(displacement.normalize().dot(screenPath.normalize())>.98,`mount/carve left the visible screen direction at angle ${angle}`);
    assert.ok(p.bossInputBasis.x*p.camDir.x+p.bossInputBasis.z*p.camDir.z>.995,'skating retained a stale camera frame');
    assert.equal(p.isBailing,false);assert.equal(p.boardRolling,true);skating++;
  }
  // Holding a direction adopts a smooth camera turn without requiring a
  // neutral/re-aim beat. It must not rewrite physical airborne momentum.
  place(0);
  for(let i=0;i<41;i++)step({moveX:1,jumpHeld:true});
  for(let i=0;i<12;i++){
    const yaw=Math.PI+i*.035;p.camDir.set(Math.sin(yaw),0,Math.cos(yaw));
    const heading=p.camDir.clone();tick({moveX:1,jumpHeld:true});
    assert.ok(p.bossInputBasis.x*heading.x+p.bossInputBasis.z*heading.z>.999999,'held input kept the old view');
  }
  tick({moveX:1,jumpHeld:false});assert.equal(p.state,'air');
  const launch=p.axisF.clone();
  for(let i=0;i<10;i++){
    p.camDir.set(Math.sin(i*Math.PI/5),0,Math.cos(i*Math.PI/5));
    tick({moveX:i<5?1:-1});
    assert.ok(p.axisF.dot(launch)>.999999,'camera/input rotation re-headed an airborne board');
    assert.equal(p.isBailing,false);
  }
  for(const angle of [Math.PI,Math.PI*.75,Math.PI*1.25]){
    place(angle);assert.equal(p.masks,2);
    for(let i=0;i<45;i++)step({moveX:1,jumpHeld:true});
    assert.equal(p.boardRolling,true);step({moveX:1,jumpHeld:false});
    assert.equal(p.state,'air');const launch=p.axisF.clone();let airborneFrames=0;
    for(let i=0;i<150&&(!p.grounded||p.state!=='ride');i++){
      step({moveX:1});airborneFrames++;
      assert.equal(p.isBailing,false,`behind-chief ollie bailed at angle ${angle}`);
      assert.ok(p.axisF.dot(launch)>.995,`behind-chief ollie re-headed before landing at angle ${angle}`);
    }
    assert.ok(airborneFrames>10,'behind-chief fixture never flew a real skating arc');
    assert.equal(p.state,'ride');assert.equal(p.grounded,true);assert.equal(p.totalDeaths,0);
    assert.equal(p.masks,2);landings++;
  }
  const frame=new ChiefInputFrame();
  frame.sample(0,1,{x:0,z:-1});assert.deepEqual(frame.sample(0,1,{x:0,z:1}),{x:0,z:1});
  frame.sample(0,0,{x:0,z:1});assert.deepEqual(frame.sample(0,1,{x:0,z:1}),{x:0,z:1});
  // World intent converts directly with no ambiguous held frame or neutral beat.
  for(let i=0;i<32;i++){
    const angle=i*.41,cameraDirection={x:Math.sin(angle),z:Math.cos(angle)},world={x:Math.sin(angle*.73),z:Math.cos(angle*.73)};
    let input=frame.inputForWorld(world.x,world.z,cameraDirection);
    assert.equal(input.needsNeutral,false);
    const basis=frame.sample(input.moveX,input.moveY,cameraDirection);
    assert.ok(Math.abs(basis.x*input.moveY-basis.z*input.moveX-world.x)<1e-6);
    assert.ok(Math.abs(basis.z*input.moveY+basis.x*input.moveX-world.z)<1e-6);
  }
  boss.step=originalStep;
  console.log(`PASS chief controls: ${walking} real walking and ${skating} mount/carve fixtures around front/back/sides, ${landings} behind-chief skating ollie/landing paths, held screen-relative steering, immutable airborne heading, fresh screen frame, read-only world-intent conversion, two-mask arrival/retries and no heart pool.`);
});
