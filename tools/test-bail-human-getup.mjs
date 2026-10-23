import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
const bytes=await readFile(new URL('../public/characters/three-finger-hand/three-finger-hand.glb',import.meta.url));
const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
await withSkateRuntime(async({THREE,server,Player,Level,CONST,TUNING})=>{
  const {BailGetUpPose,recoveryStrideMagnitude}=await server.ssrLoadModule('/src/character/bailGetUpPose.ts');
  const {BailKnockdown}=await server.ssrLoadModule('/src/character/bailKnockdown.ts');
  const {RigBinding}=await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const {createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {createRiggedCartoonHandPairFromScene,attachAndSyncRiggedCartoonHandPair}=await server.ssrLoadModule('/src/character/riggedCartoonHand.ts');
  const {removeProceduralCartoonGloveSurface}=await server.ssrLoadModule('/src/character/cartoonGlove.ts');
  const pose=new BailGetUpPose(), knock=new BailKnockdown();
  for(const wave of [-1,-.24,0,.24,1]) {
    assert.equal(recoveryStrideMagnitude(wave,0),Math.abs(wave),'ordinary gait changed');
    const h=1e-5, left=(recoveryStrideMagnitude(wave,1)-recoveryStrideMagnitude(wave-h,1))/h;
    const right=(recoveryStrideMagnitude(wave+h,1)-recoveryStrideMagnitude(wave,1))/h;
    assert.ok(Math.abs(right-left)<.001,'the loaded passing knee has a velocity corner');
  }
  for(const side of [-1,1]) for(const roll of [-1,0,1]) {
    for(const end of [0,1]) {
      pose.sample(end,side,roll);
      assert.equal(pose.curl+pose.gather+pose.press+pose.stride,0);
      assert.ok(Object.values(pose.deformations).every(v=>v===1));
    }
    pose.sample(.5,side,roll);
    assert.ok(pose.curl>.6 && pose.leadHip<-.8 && pose.leadKnee>1,'get-up failed to fold at the waist and gather knees');
    assert.ok(pose.leadHip<pose.trailHip-.3,'both legs stood up symmetrically');
  }
  knock.impact(24,true);assert.ok(knock.ready,'ordinary wall bump acquired a dazed pause');
  knock.impact(40,true);assert.ok(!knock.ready);knock.reset();assert.ok(knock.ready);
  const scene=new THREE.Scene(),level=new Level(scene,{id:'human-getup',name:'Human get-up',data:{v:1,name:'Human get-up',spawn:[0,.04,0],killY:-60,components:[
    {t:'platform',p:[0,-.5,0],s:[200,1,200],edgeGrinding:false},
    {t:'platform',p:[0,2,-10],s:[12,4,1],edgeGrinding:false},{t:'gate',p:[70,0,-70]},
  ]}});
  const p=new Player(scene),input=makeInput({inventoryHeld:true});p.rawInput=input;p.respawn(level,true);
  const pair=createRiggedCartoonHandPairFromScene(gltf.scene);attachAndSyncRiggedCartoonHandPair(pair,p.gloveLeft,p.gloveRight);
  p.riggedCartoonHands=pair;p.riggedCartoonHandState='ready';removeProceduralCartoonGloveSurface(p.gloveLeft);removeProceduralCartoonGloveSurface(p.gloveRight);
  p.rebuildCharacterRenderBatches();p.syncCharacterAppearance();
  const runtime=createCharacterAnimationRuntime(p,createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const random=Math.random,rows=[],forward=new THREE.Vector3(),up=new THREE.Vector3(),point=new THREE.Vector3();
  const head=new THREE.Vector3(),previousHead=new THREE.Vector3(),headDelta=new THREE.Vector3(),previousDelta=new THREE.Vector3();
  try {
    for(const initialSeed of [42,829,1229,3167]) for(const cause of ['balance','side-left','side-right','manual','nose-manual','heavy-wall','high-fall']) {
      let seed=initialSeed;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      const heavy=cause==='heavy-wall'||cause==='high-fall';
      p.respawn(level,true,true,{position:new THREE.Vector3(cause==='heavy-wall'?0:30,.04,0),heading:new THREE.Vector3(0,0,-1)});
      level.discardedBoards.clear();p.invulnTimer=0;p.step(CONST.fixedStep,input,level);p.speed=10;p.freeSkate=true;
      if(cause==='heavy-wall')p.speed=40;
      else if(cause==='high-fall') {p.pos.y=32;p.prevPos.copy(p.pos);p.airPeakY=32;p.vVel=-8;p.speed=4;p.grounded=false;p.state='air';p.airFromSkate=p.airMomentum=true;p.airGrav='board';}
      else if(cause.includes('side'))p.beginPvpKnockdown(5,cause==='side-left'?-1:1);
      else if(cause.includes('manual')) {
        const sign=cause==='manual'?1:-1;p.enterManual(sign);
        for(let i=0;i<12;i++){p.balance=sign*.8;p.step(CONST.fixedStep,input,level);}
        p.balance=sign;p.balanceVel=sign*5;p.balanceCritT=TUNING.bailGrace+.05;p.step(CONST.fixedStep,input,level);
      } else {p.balance=initialSeed%2?1:-1;p.bail(false,10,'balance');}
      let entered=false,completed=false,recoveryFrame=-1,maxCurl=0,maxGather=0,maxAsymmetry=0,minClearance=Infinity;
      let restFrames=0,faceUpFrames=0,maxRest=0,peakSeverity=0,maxScans=0;
      let entryHeadChange=0,maxEarlyHeadChange=0;
      previousHead.set(0,0,0);previousDelta.set(0,0,0);
      const measure=p.interactionMeasure,native=measure.skinnedBounds.bind(measure);
      measure.skinnedBounds=(...args)=>{if(p.isBailing)maxScans++;return native(...args);};
      try {
        for(let frame=0;frame<480;frame++) {
          const wasRecovering=p.bailRecoverT>=0;
          p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);
          p.group.updateMatrixWorld(true);
          p.headM.localToWorld(head.set(0,.3,0)).sub(p.pos);headDelta.copy(head).sub(previousHead);
          const headChange=headDelta.distanceTo(previousDelta);
          if(!wasRecovering&&p.bailRecoverT>=0)entryHeadChange=headChange;
          if(p.bailRecoverT>=0&&p.bailRecoverT/p.bailRecoverDuration<.2)maxEarlyHeadChange=Math.max(maxEarlyHeadChange,headChange);
          previousHead.copy(head);previousDelta.copy(headDelta);
          entered ||= p.isBailing;
          if(entered)peakSeverity=Math.max(peakSeverity,p.bailKnockdown.strength);
          if(entered)maxRest=Math.max(maxRest,p.bailKnockdown.restTime);
          if(p.isBailing&&p.bailRecoverT<0&&p.bailKnockdown.restTime>0) {
            restFrames++;maxRest=Math.max(maxRest,p.bailKnockdown.restTime);
            if(forward.set(0,0,1).applyQuaternion(p.ragQ).y>.9)faceUpFrames++;
            assert.ok(Math.abs(up.set(0,1,0).applyQuaternion(p.ragQ).y)<.3,'dazed hold stayed on its feet');
          }
          if(p.bailRecoverT>=0) {
            recoveryFrame=recoveryFrame<0?frame:recoveryFrame;
            maxCurl=Math.max(maxCurl,Math.abs(p.spineG.rotation.x));
            if(p.bailGetUpPose.gather>.5)maxGather=Math.max(maxGather,-Math.min(p.legL.rotation.x,p.legR.rotation.x));
            maxAsymmetry=Math.max(maxAsymmetry,Math.abs(p.legL.rotation.x-p.legR.rotation.x));
          }
          if(p.isBailing&&p.grounded&&p.groundHit) {
            const clearance=measure.sampledPlaneDistance(p.riderG,p.groundHit.normal,point.set(p.pos.x,p.groundHit.y,p.pos.z));
            minClearance=Math.min(minClearance,clearance);
          }
          assert.ok(p.animationRig.joints.every(j=>[...j.node.quaternion.toArray(),...j.node.position.toArray()].every(Number.isFinite)));
          assert.ok(!p.breakApartDiagnostics?.active,'nonfatal get-up detached its body');
          assert.notEqual(p.state,'dead');
          if(entered&&!p.isBailing&&p.bailRiseAge<0){completed=true;break;}
        }
      } finally {measure.skinnedBounds=native;}
      const row={cause,seed:initialSeed,entered,completed,recoveryFrame,entryHeadChange,maxEarlyHeadChange,maxCurl,maxGather,maxAsymmetry,minClearance,peakSeverity,maxRest,restFrames,faceUpFrames,maxScans};
      assert.ok(entered&&completed&&maxCurl>.65&&maxGather>.65&&maxAsymmetry>.4,JSON.stringify(row));
      assert.ok(minClearance>-.012&&maxScans===0,JSON.stringify(row));
      assert.ok(entryHeadChange<.11&&maxEarlyHeadChange<.25,`head jerked out of the resting pose: ${JSON.stringify(row)}`);
      if(heavy)assert.ok(peakSeverity>0&&maxRest>=.28&&restFrames>=15,JSON.stringify(row));
      else assert.equal(peakSeverity,0,`ordinary spill gained heavy recovery: ${JSON.stringify(row)}`);
      rows.push(row);
    }
    assert.ok(rows.some(r=>r.cause==='heavy-wall'&&r.faceUpFrames>=15),'no high-speed wall slam rested flat on its back');
    console.log(JSON.stringify({passed:true,cases:rows.length,realHandTriangles:pair.triangleCount,rows},null,2));
  } finally {Math.random=random;runtime.dispose();level.dispose();}
});
