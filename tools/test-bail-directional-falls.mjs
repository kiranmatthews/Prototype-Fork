import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST, TUNING }) => {
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const { BailRiseMotion, BAIL_RISE_SETTLE_SECONDS } = await server.ssrLoadModule('/src/character/bailRiseMotion.ts');
  const scene = new THREE.Scene(), level = new Level(scene, {id:'balance-fall',name:'Balance fall',data:{v:1,name:'Balance fall',spawn:[0,.04,0],killY:-100,
    components:[{t:'platform',p:[0,-.5,0],s:[200,1,200],edgeGrinding:false},{t:'gate',p:[70,0,-70]}]}});
  const p = new Player(scene), input = makeInput({inventoryHeld:true}); p.rawInput = input; p.respawn(level,true);
  const runtime = createCharacterAnimationRuntime(p,createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  let boardAge=0; const boardSounds=[], boardRows=[];
  level.discardedBoards.onImpact=()=>boardSounds.push(boardAge);
  const random=Math.random, rows=[], spin=new THREE.Vector3(), top=new THREE.Vector3(), fall=new THREE.Vector3(), travel=new THREE.Vector3();
  try {
    for(const seed0 of [42,109,829]) for(const heading of [0,Math.PI/2]) for(const stance of [1,-1]) for(const mode of [0,1,-1]) for(const needle of [1,-1]) {
      let seed=seed0;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      p.respawn(level,true,true,{position:new THREE.Vector3(0,.04,0),heading:new THREE.Vector3(Math.sin(heading),0,-Math.cos(heading))});
      level.discardedBoards.clear(); boardAge=0; boardSounds.length=0;
      p.invulnTimer=0;p.step(CONST.fixedStep,input,level);p.freeSkate=true;p.speed=12;p.stance=stance;
      if(mode){p.enterManual(mode);for(let i=0;i<12;i++){p.balance=needle*.8;p.step(CONST.fixedStep,input,level);}}
      travel.copy(p.axisF).multiplyScalar(Math.sign(p.speed||1));
      if(mode)fall.copy(travel).multiplyScalar(-needle);else fall.set(-travel.z*needle,0,travel.x*needle);
      p.balance=needle;p.balanceVel=needle*5;p.balanceCritT=TUNING.bailGrace+.05;
      if(mode)p.step(CONST.fixedStep,input,level);else p.bail(false,p.speed,'balance');
      assert.ok(p.isBailing,`manual path did not bail: ${mode}/${needle}/${heading}/${stance}/${seed0}: ${p.state}/${p.speed}/${p.manualing}`);
      p.ragdollWorldSpin(spin); top.crossVectors(spin,new THREE.Vector3(0,1,0));
      const direction=top.dot(fall);assert.ok(direction>1,`body spun away from lost balance: ${mode}/${needle}/${stance}: ${direction}`);
      let boardDot=null,bodyDot=null;
      if(mode){
        boardDot=p.flyBoardVel.dot(fall);bodyDot=travel.copy(p.axisF).multiplyScalar(p.speed).dot(fall);
        assert.ok(boardDot < -8 && bodyDot>.5,`manual body/deck failed to separate: ${bodyDot}/${boardDot}`);
      }
      let minUp=1,peakFall=0,recoveryAt=null,fallenAtRecovery=false,afterRiseFrames=0,recoilAfter=0,firstFree=null,maxAfterFreeTurn=0;
      const previous=new THREE.Quaternion(),current=new THREE.Quaternion();p.riderG.getWorldQuaternion(previous).normalize();
      for(let frame=0;frame<200;frame++){
        boardAge+=CONST.fixedStep;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);
        if(p.isBailing&&p.bailRecoverT<0)minUp=Math.min(minUp,top.set(0,1,0).applyQuaternion(p.ragQ).y);
        if(recoveryAt===null&&p.bailRecoverT>=0){recoveryAt=p.bailFallAge;fallenAtRecovery=p.bailHasFallen;}
        p.riderG.getWorldQuaternion(current).normalize();
        if(p.isBailing && p.bailRecoverT<0) peakFall=Math.max(peakFall,top.set(0,1,0).applyQuaternion(current).dot(fall));
        if(!p.isBailing){firstFree??=frame/60;maxAfterFreeTurn=Math.max(maxAfterFreeTurn,previous.angleTo(current));
          if(p.bailRiseAge>=0){afterRiseFrames++;recoilAfter=Math.max(recoilAfter,Math.abs(p.bailRiseMotion.pitch)+Math.abs(p.bailRiseMotion.roll));}}
        previous.copy(current);
      }
      assert.ok(recoveryAt>=.45 && fallenAtRecovery,`recovered without a full fall: ${mode}/${needle}/${heading}/${stance}/${seed0}: ${recoveryAt}/${minUp}`);
      assert.ok(peakFall>.35,`visible body did not fall toward lost balance: ${peakFall}`);
      assert.ok(firstFree<2.5&&p.grounded&&!p.isBailing,'fall did not finish on supported ground');
      assert.ok(afterRiseFrames>=20&&recoilAfter>.015,'rise motion disappeared at gameplay handoff');
      assert.equal(p.bailRiseAge,-1,'rise motion did not finitely settle');
      assert.ok(maxAfterFreeTurn<.4,'get-up handoff snapped the visible rider');
      assert.equal(p.breakApartDiagnostics?.active??false,false,'nonfatal body detached');
      if(mode && seed0===42 && heading===0 && stance===1){
        let settledAt=p.looseBoard?.rest ? boardAge : null;
        for(let frame=200;frame<720;frame++){
          boardAge+=CONST.fixedStep;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);
          if(p.looseBoard?.rest)settledAt??=boardAge;
        }
        assert.ok(settledAt!==null&&settledAt<10,'manual slip board never stopped');
        assert.ok(boardSounds.every(t=>t<=settledAt),'manual board emitted an impact after rest');
        assert.equal(p.looseBoard.velocity.lengthSq()+p.looseBoard.angular.lengthSq(),0,'sleeping manual board kept moving');
        boardRows.push({mode,needle,settledAt,watchedSeconds:boardAge,sounds:[...boardSounds]});
      }
      rows.push({mode,needle,heading,stance,seed:seed0,direction,boardDot,bodyDot,minUp,peakFall,recoveryAt,firstFree,afterRiseFrames,recoilAfter,maxAfterFreeTurn});
    }
    const rise=new BailRiseMotion(), values=[];
    for(let frame=0;frame<=240;frame++) {rise.sample(frame/240*BAIL_RISE_SETTLE_SECONDS,1,1);values.push(rise.pitch);assert.ok(Object.values(rise.deformations).every(v=>Number.isFinite(v)&&v>.8&&v<1.2));}
    assert.ok(Math.min(...values)<-.03&&Math.max(...values)>.01,'rise lacked compression and rebound');
    rise.sample(BAIL_RISE_SETTLE_SECONDS,1,1);assert.equal(rise.pitch,0);assert.equal(rise.roll,0);assert.ok(Object.values(rise.deformations).every(v=>v===1));
    p.bailRiseAge=.2;p.respawn(level,true);assert.equal(p.bailRiseAge,-1,'respawn retained old rise motion');
    console.log(JSON.stringify({passed:true,cases:rows.length,finiteSegmentRebound:true,boardRows,rows},null,2));
  } finally {Math.random=random;runtime.dispose();level.dispose();}
});
