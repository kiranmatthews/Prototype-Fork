import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE,server,scene,player:p,level,step,TUNING,CONST})=>{
  const defaults={...TUNING};
  const core=(value,velocity,control=0,seconds=1/60)=>{
    p.balance=value;p.balanceVel=velocity;p.noisePhase=0;
    p.stepBalanceCore(seconds,Math.sign(value||1),.63,control,0);
    return {value:p.balance,velocity:p.balanceVel};
  };
  TUNING.balanceNoise=0;
  const speeds=[.1,.3,.5,.7,.9].map(v=>core(v,0).velocity);
  assert.ok(speeds[4]-speeds[3]>(speeds[1]-speeds[0])*8,'edge acceleration is still nearly linear');
  for(const v of [.1,.3,.5,.7,.9]){
    const a=core(v,0),b=core(-v,0);
    assert.ok(Math.abs(a.velocity+b.velocity)<1e-10 && Math.abs(a.value+b.value)<1e-10,'unbalanced left/right pull');
  }
  assert.ok(core(.2,.8,-TUNING.balanceControl).velocity>0,'counter-input reversed velocity instantly');
  const recover=(side,start,velocity)=>{
    let state={value:side*start,velocity:side*velocity};
    for(let i=0;i<120;i++){
      state=core(state.value,state.velocity,-side*TUNING.balanceControl);
      if(Math.abs(state.value)>=1)return false;
      if(side*state.value<=.15)return true;
    }
    return false;
  };
  for(const side of [-1,1]){
    assert.equal(recover(side,.45,1),true,'early correction should remain recoverable');
    assert.equal(recover(side,.9,2.2),false,'late edge correction was rescued');
  }
  Object.assign(TUNING,defaults);
  assert.equal(TUNING.bailGrace,0);assert.equal(TUNING.grindCalm,0);
  assert.equal(TUNING.balanceSafePeriod,0);assert.equal(TUNING.balanceGrace,0);
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const rail=new Rail([new THREE.Vector3(0,7,25),new THREE.Vector3(0,7,-115)]);
  level.rails.push(rail);level.grindRails.push(rail);level.root.add(rail.object);scene.updateMatrixWorld(true);
  const catchRail=(side=1,held=0)=>{
    const position=rail.pointAt(2).add(new THREE.Vector3(0,.25,0)),heading=rail.tangentAt(2);
    p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);
    p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=8;p.vVel=0;
    step(makeInput({grindHeld:true,grindPressed:true,moveX:held}));
    assert.equal(p.state,'grind');assert.equal(p.grindRail,rail);
    p.balance=side*CONST.balanceStart;p.balanceVel=0;p.noisePhase=0;
  };
  const timeToFail=(side,held)=>{
    catchRail(side,held);let max=0;
    for(let i=0;i<240;i++){
      step(makeInput({grindHeld:true,moveX:held}));max=Math.max(max,Math.abs(p.balance));
      if(p.state!=='grind'){assert.equal(p.isBailing,true);return (i+1)*CONST.fixedStep;}
    }
    assert.fail(`uncontrolled grind survived four seconds (${max})`);
  };
  const times=[];
  for(const side of [-1,1]){
    const neutral=timeToFail(side,0),wrong=timeToFail(side,side);
    assert.ok(neutral<2 && neutral>.4,'fresh drift is either toothless or unreadably fast');
    assert.ok(wrong<neutral*.65,'a stale catch-direction hold was protected');
    catchRail(side);p.balance=side*.995;p.balanceVel=side;
    step(makeInput({grindHeld:true}));assert.equal(p.isBailing,true,'meter crossing did not fail this frame');
    times.push({side,neutral,wrong});
  }
  // A skilled predictive correction can still hold the middle through the
  // difficulty ceiling. No timed forced bail or perfect-balance boost.
  catchRail();let maxBalance=0,corrections=0,last=0,inputX=0;
  for(let i=0;i<720;i++){
    if(i%3===0){
      const ahead=p.balance+p.balanceVel*.12;
      inputX=Math.abs(ahead)>.025?-Math.sign(ahead):0;
      if(inputX!==last)corrections++;last=inputX;
    }
    step(makeInput({grindHeld:true,moveX:inputX}));
    maxBalance=Math.max(maxBalance,Math.abs(p.balance));
    assert.equal(p.state,'grind','centred predictive balancing became impossible');
    assert.equal(p.balanceBoostT,0);assert.equal(p.uberTimer,0);
  }
  assert.ok(maxBalance<.65 && corrections>20,'controlled test did not actively balance');
  // Manual and lip use the same immediate boundary rule, with the existing
  // inward lip release still intentionally dropping into the transition.
  for(const side of [-1,1]){
    p.respawn(level,true,true,{position:new THREE.Vector3(0,.1,10),heading:new THREE.Vector3(0,0,-1)});
    p.freeSkate=true;p.speed=12;p.groundHit=p.queryGround(level);p.pos.y=p.groundHit.y;p.rideNormal.copy(p.groundHit.normal);
    p.enterManual(1);p.balance=side*.995;p.balanceVel=side;
    step(makeInput());assert.equal(p.isBailing,true,'manual crossing retained a rescue buffer');
  }
  level.buildVertRamp({t:'vertramp',p:[0,0,-50],len:16,w:3,rise:6,vkind:'half'});scene.updateMatrixWorld(true);
  const hp=level.halfpipes.at(-1);
  for(const side of [-1,1]){
    p.respawn(level,true,true,{position:new THREE.Vector3(hp.lipX,hp.lipY,-50),heading:new THREE.Vector3(1,0,0)});
    p.freeSkate=true;p.enterLipStall(hp);p.balance=side*.995;p.balanceVel=side;
    step(makeInput());assert.equal(p.lipStallT,0,'lip crossing retained a rescue buffer');
    assert.equal(p.isBailing,side<0,'lip failure lost its intended inward drop / outward bail distinction');
  }
  console.log(`PASS progressive balance: symmetric cubic pull, momentum, early recovery / failed late saves, immediate grind/manual/lip boundaries. No-input vs held-wrong failures ${JSON.stringify(times)}. Twelve-second active grind: ${corrections} corrections, peak ${maxBalance.toFixed(3)}.`);
});
