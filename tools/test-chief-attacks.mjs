import assert from 'node:assert/strict';
import * as THREE from 'three';
import { withChiefRuntime } from './crab-chief-harness.mjs';

await withChiefRuntime(async ({l,p,tick})=>{
  const boss=l.boss;
  const results=[];
  // A stage-start fixture places the standard two-mask Player in the front
  // court. From the first tell onward, movement, attacks, collisions and mask
  // spending all run through production Player.step, without immunity or
  // test damage callbacks. This test does not claim to earn phase one.
  const prepare=attack=>{
    p.respawn(l,true,false,{position:new THREE.Vector3(0,.1,3)});
    for(let i=0;i<3;i++)tick();
    boss.phase=2;boss.health=6;boss.state='idle';boss.stateTime=.85;
    boss.ordinal=attack==='slam'?1:0;
    assert.equal(p.masks,2);assert.equal(p.uberTimer,0);assert.equal(p.invulnTimer,0);
  };
  const play=(attack,policy)=>{
    prepare(attack);let maxBubbleZ=-Infinity,maxWave=0,jumpFrame=-1000;
    const begin=l.boss.time,positions=[];
    for(let frame=0;frame<900;frame++){
      const input=policy({frame,jumpFrame,setJump:()=>jumpFrame=frame});
      tick(input);
      const diagnostics=boss.diagnostics;
      for(const bubble of diagnostics.bubblePositions)maxBubbleZ=Math.max(maxBubbleZ,bubble[2]);
      for(const wave of diagnostics.activeWaves)maxWave=Math.max(maxWave,wave.radius);
      positions.push({frame,position:p.pos.toArray(),state:p.state,boss:boss.state,masks:p.masks});
      if(boss.state==='tongue-form'){
        assert.equal(diagnostics.activeBubbles,0,'tongue formation overlaps unfinished projectiles');
        assert.equal(diagnostics.activeWaves.length,0,'tongue formation overlaps an unfinished slam ring');
        assert.equal(p.totalDeaths,0);assert.equal(p.isBailing,false);
        const result={attack,masks:p.masks,hits:boss.playerHits,maxBubbleZ,maxWave,seconds:boss.time-begin,position:p.pos.toArray()};
        results.push(result);return {result,positions};
      }
    }
    throw new Error(`Attack never opened: ${JSON.stringify({attack,player:p.pos.toArray(),boss:boss.diagnostics})}`);
  };
  const volleyHit=play('volley',()=>({})).result;
  assert.equal(volleyHit.masks,1,'stationary front-court player never took an aimed volley');
  assert.equal(volleyHit.hits,1);assert.ok(volleyHit.maxBubbleZ>2,'volley was deleted before reaching the front court');
  const volleyDodge=play('volley',()=>({moveY:p.pos.z<12?-1:0})).result;
  assert.equal(volleyDodge.masks,2,'ordinary retreat did not dodge the locked volley');
  assert.equal(volleyDodge.hits,0);assert.ok(p.pos.z>10,'dodge never moved the production player');
  const slamHit=play('slam',()=>({})).result;
  assert.equal(slamHit.masks,1,'stationary front-court player never took the targeted slam');
  assert.equal(slamHit.hits,1);assert.ok(slamHit.maxWave>24,'slam ripple was cleared before crossing the arena');
  const slamRipple=play('slam',()=>({moveX:p.pos.x<7?1:0})).result;
  assert.equal(slamRipple.masks,1,'grounded sidestep incorrectly escaped the propagating ripple');
  assert.equal(slamRipple.hits,1,'ripple fixture lost a mask to something other than the boss');
  const jumped=play('slam',({frame,jumpFrame,setJump})=>{
    const input={moveX:p.pos.x<7?1:0};
    const approaching=boss.diagnostics.activeWaves.some(wave=>{
      const d=Math.hypot(p.pos.x-wave.centre[0],p.pos.z-wave.centre[2]);
      return d-wave.radius<3.0&&d-wave.radius>.8;
    });
    if(approaching&&p.grounded&&frame-jumpFrame>60){input.jumpHeld=true;input.jumpPressed=true;setJump();}
    return input;
  });
  const slamJump=jumped.result;
  assert.equal(slamJump.masks,2,'normal sidestep and jump did not evade the marked slam plus ripple');
  assert.equal(slamJump.hits,0);
  // Phase one retains its old pearl-court lock and .6s slam recovery.
  p.respawn(l,true,false,{position:new THREE.Vector3(0,.1,3)});
  boss.state='idle';boss.stateTime=.85;tick();assert.equal(boss.target.z,-6);
  for(let i=0;i<150&&boss.state!=='recover';i++)tick({moveX:1});
  assert.equal(boss.state,'recover');
  const slamStart=boss.history.findLast(row=>row.state==='slam').time;
  const recover=boss.history.findLast(row=>row.state==='recover').time;
  assert.ok(recover-slamStart>=.59&&recover-slamStart<.63,'phase one attack timing changed');
  // The tongue stays attached while the chief returns from an off-centre,
  // front-court slam. The mouth endpoint follows both live X and Z during
  // formation, then settles at the same full-length rail endpoint.
  boss.reset(true);boss.phase=2;boss.target.set(6,0,3);boss.state='slam';boss.stateTime=3.15;boss.present(0);
  boss.state='tongue-form';
  for(const t of [0,.05,.1,.2,.35,.4,.8,1.2]){
    boss.stateTime=t;boss.present(0);
    const mouth=boss.model.root.position.clone().add(new THREE.Vector3(0,6.4,1));
    assert.ok(boss.phaseGeometry.tongueMouth.distanceTo(mouth)<1e-8,`forming tongue left the chief mouth at ${t}s`);
    assert.ok(boss.phaseGeometry.tongueRail.pointAt(boss.phaseGeometry.tongueRail.totalLength).distanceTo(mouth)<1e-5,`forming rail endpoint left the live mouth at ${t}s`);
    if(t<.35){assert.ok(Math.abs(mouth.x)>.05,'formation fixture never tested lateral return');assert.ok(mouth.z>-22,'formation fixture never tested front-court return');}
    if(t===1.2)assert.ok(mouth.distanceTo(new THREE.Vector3(0,6.4,-23))<1e-8,'fully formed tongue changed its settled endpoint');
  }
  // Focused deadline fixtures use real rail identity. A ride caught near the
  // end of the twelve-second opportunity keeps its surface until it exits;
  // an unrelated terrace grind cannot extend the opening.
  boss.reset(true);boss.phase=2;boss.health=6;boss.state='tongue-open';boss.stateTime=11.98;boss.present(0);
  const tongue=boss.phaseGeometry.tongueRail;
  const actor={position:tongue.pointAt(.1),state:'grind',speed:6.5,grounded:false,
    skating:true,grinding:true,attacking:false,spinning:false,immune:false,shielded:true,rail:tongue,support:null};
  for(let i=0;i<4;i++){boss.step(1/60,actor);boss.present(1/60);}
  assert.equal(boss.state,'tongue-open','opening retracted beneath a genuine late tongue rider');
  assert.equal(boss.phaseGeometry.tongueActive,true);assert.equal(tongue.grindable,true,'deadline disabled the real rider support');
  actor.rail=l.rails.find(rail=>rail!==tongue);boss.step(1/60,actor);boss.present(1/60);
  assert.equal(boss.state,'idle','unrelated rail extended the expired tongue opportunity');
  assert.equal(boss.phaseGeometry.tongueActive,false);
  // The downward claw and its later ripple carry different presentation
  // causes. Both still use the encounter's ordinary damage/life rules.
  boss.reset(true); boss.state = 'slam'; boss.stateTime = .2; boss.target.set(0, 0, -6);
  const victim = { position: new THREE.Vector3(0, 0, -6), state: 'ride', speed: 0,
    grounded: true, skating: false, grinding: false, attacking: false, immune: false, shielded: false };
  const claw = boss.step(1 / 60, victim);
  assert.equal(claw.hurt, true); assert.equal(claw.fatal, true); assert.equal(claw.impact, 'crush');
  boss.reset(true); boss.state = 'recover'; boss.stateTime = 0;
  boss.emitWave(new THREE.Vector3(), 11); victim.position.set(0, 0, 0);
  const ripple = boss.step(1 / 60, victim);
  assert.equal(ripple.hurt, true); assert.equal(ripple.fatal, true); assert.equal(ripple.impact, undefined);
  console.log('PASS phase 2 production Player hit/dodge attacks, actual front-court aim, completed projectile/ripple travel, clear tongue formation, two masks and unchanged phase one timing.');
  console.log(JSON.stringify(results,null,2));
});
