import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data={v:1,name:'Board abandon steering',spawn:[0,.05,0],killY:-40,
  components:[{t:'platform',p:[0,-.5,0],s:[200,1,200]},{t:'gate',p:[0,0,-90]}]};
await withSkateRuntime(async({player:p,level,CONST,TUNING})=>{
  const original=TUNING.boardAbandonSteering,dt=CONST.fixedStep;
  const run=(strength,{vert=false,moveX=1,moveY=0}={})=>{
    TUNING.boardAbandonSteering=strength;p.competitionMode=false;p.enterLevel('board-abandon-steering');p.respawn(level,true);
    p.pos.set(0,100,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.groundHit=null;
    p.axisF.set(0,0,-1);p.axisL.set(1,0,0);p.camDir.set(0,0,-1);p.speed=24;
    p.freeSkate=true;p.airFromSkate=true;p.boardOllieAir=true;p.airMomentum=true;
    if(vert){p.vertAir=true;p.vertNormal.set(-1,0,0);p.vertLatVel=24;}
    p.performBoardAbandon(.5,vert?'Board Abandon':'Emergency Eject',vert);
    for(let i=0;i<12;i++)p.step(dt,makeInput({moveX,moveY}),level);
    assert.equal(p.emergencyEjectLandingPending,true);assert.equal(p.freeSkate,false);
    if(moveX===0&&moveY<0){
      assert.ok(Math.abs(p.pos.x)<1e-8,'straight reversal must not choose a turning side');
      assert.ok(p.speed>0&&p.speed<24,'straight reversal must brake the carried speed');
    }else assert.ok(Math.abs(p.speed-24)<1e-8,'steering must preserve departure speed');
    return {x:p.pos.x,y:p.pos.y,vy:p.vVel,angle:Math.atan2(p.axisF.x,-p.axisF.z)*180/Math.PI};
  };
  // Haunted Hassle frame 6817: a 23 m/s ollie was about 1.6° off the lane
  // when the second jump release arrived with straight back already held.
  const replayPullback = (offset, moveY, park) => {
    level.skatepark = park;
    TUNING.boardAbandonSteering = 25;
    p.competitionMode = false;
    p.enterLevel('board-abandon-steering');
    p.respawn(level, true);
    p.pos.set(0, 30, 0);
    p.prevPos.copy(p.pos);
    Object.assign(p, { state: 'air', grounded: false, groundHit: null, speed: 23,
      freeSkate: true, airFromSkate: true, airGrav: 'board', boardOllieAir: true, airMomentum: true });
    p.axisF.set(Math.sin(offset), 0, -Math.cos(offset));
    p.axisL.set(p.axisF.z, 0, -p.axisF.x);
    p.camDir.set(0, 0, -1);
    for (let i = 0; i < 14; i++) {
      p.step(dt, makeInput({ moveY: -1, jumpPressed: i === 0, jumpHeld: true }), level);
    }
    const launch = p.pos.clone();
    const sideSpeed = Math.abs(p.axisF.x * p.speed);
    const points = [];
    for (let i = 0; i < 40; i++) {
      if (park && i > 0) p.camDir.copy(p.axisF); // The chase view follows the new velocity.
      p.step(dt, makeInput({ moveY, jumpReleased: i === 0 }), level);
      assert.ok(p.boardAbandonActive && !p.freeSkate);
      const dx = p.pos.x - launch.x;
      assert.ok(Math.abs(dx) <= sideSpeed * (i + 1) * dt + 1e-8, 'back input amplified lateral carry');
      points.push({ dx, forward: launch.z - p.pos.z, forwardSpeed: -p.axisF.z * p.speed, y: p.pos.y });
    }
    return points;
  };
  try{
    const results=[];
    for(const vert of [false,true]){
      const rows=[0,25,50,100].map(strength=>({strength,...run(strength,{vert})}));
      assert.ok(Math.abs(rows[0].x)<1e-8);assert.ok(Math.abs(rows[0].angle)<1e-8);
      for(let i=1;i<rows.length;i++){
        assert.ok(rows[i].angle>rows[i-1].angle);
        assert.equal(rows[i].y,rows[0].y);assert.equal(rows[i].vy,rows[0].vy);
      }
      assert.ok(rows[1].angle>39&&rows[1].angle<42,'default should allow a small gradual correction');
      assert.ok(rows[3].angle>81&&rows[3].angle<83,'100% retains the original quick response');
      assert.ok(rows[1].x<rows[3].x*.5);
      assert.deepEqual(run(0,{vert,moveX:0,moveY:0}),run(100,{vert,moveX:0,moveY:0}),'neutral carry is independent of steering strength');
      assert.ok(Math.abs(run(25,{vert,moveX:0,moveY:-1}).angle)<90,'default cannot almost reverse the jump in 0.2 seconds');
      results.push({vert,rows});
    }
    for (const park of [false, true]) {
      const offset = 1.6 * Math.PI / 180;
      const back = replayPullback(offset, -1, park);
      const mirror = replayPullback(-offset, -1, park);
      const soft = replayPullback(offset, -.3, park);
      const coast = replayPullback(offset, 0, park);
      for (let i = 0; i < back.length; i++) {
        assert.ok(Math.abs(back[i].dx + mirror[i].dx) < 1e-8, 'left and right approaches must mirror');
        assert.equal(back[i].y, coast[i].y, 'braking changed the jump height');
      }
      assert.ok(0 < back[11].forwardSpeed && back[11].forwardSpeed < soft[11].forwardSpeed);
      assert.ok(soft[11].forwardSpeed < coast[11].forwardSpeed);
      const last = back.at(-1);
      assert.ok(last.forwardSpeed < 0, 'sustained back must be able to reverse');
      assert.ok(last.forward > 0 && last.forward < coast.at(-1).forward / 2,
        'pullback must shorten the net forward jump from the recorded approach speed');
    }
    level.skatepark = false;
    run(100);const heading=p.axisF.clone();TUNING.boardAbandonSteering=0;
    p.step(dt,makeInput({moveX:-1}),level);
    assert.deepEqual(p.axisF,heading,'slider applies during the existing jump');
    console.log(JSON.stringify(results));
    console.log('PASS ordinary/vert board abandons: live 0/25/50/100 steering, weaker reversal, preserved momentum/height and neutral carry.');
  }finally{TUNING.boardAbandonSteering=original;}
},{levelEntry:{id:'board-abandon-steering',name:data.name,data}});
