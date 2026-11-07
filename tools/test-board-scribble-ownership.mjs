import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data=JSON.parse(await readFile(process.argv[2]||'.skate-reference-data/motion.json','utf8'));
// Replay against the user's accepted pre-scribble implementation, not a second
// copy of the current implementation. Keep this temporary module out of commits.
const legacyUrl=new URL(`../src/skateReferenceLab/.pre-scribble-reference-${process.pid}.ts`,import.meta.url);
const legacySource=execFileSync('git',['show','22cebbe2a0382f97c92e9b1f80ccf7497de656ae:src/skateReferenceLab/playableMotion.ts'],{encoding:'utf8'});
await writeFile(legacyUrl,legacySource);
try {
  await withSkateRuntime(async({server,scene,level,Player})=>{
    const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
    const {PlayableSkateMotion:LegacyMotion}=await server.ssrLoadModule(`/src/skateReferenceLab/.pre-scribble-reference-${process.pid}.ts`);
    const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
    const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
    const players=[new Player(scene),new Player(scene),new Player(scene)];
    const [a,b,legacy]=players;
    const motions=[new PlayableSkateMotion(a,data),new PlayableSkateMotion(b,data),new LegacyMotion(legacy,data)];
    const [pre,ink,accepted]=motions;pre.scribbles=false;
    const runtimes=players.map(p=>{
      const binding=RigBinding.fromSculptRuntime(p.animationRig.root);
      return createCharacterAnimationRuntime(p,createPlayerStarterAnimationSuite(binding.definition));
    });
    const resetAll=()=>players.forEach((p,i)=>{p.enterLevel('scribble-test');p.respawn(level,true);p.freeSkate=false;motions[i].reset();runtimes[i].restart();});
    const pose=(motion)=>motion.nodes.flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]);
    const comparePose=(x,y,message)=>{const aa=pose(x),bb=pose(y);assert.equal(aa.length,bb.length);aa.forEach((v,i)=>assert.ok(Math.abs(v-bb[i])<1e-9,`${message} transform ${i}: ${v}/${bb[i]}`));};
    resetAll();let held=false,poseFrames=0,toggleChecks=0;const toggled=new Set();
    for(let frame=0;frame<660;frame++){
      const time=frame/60,jump=time>.4&&time<3.5;
      const input=makeInput({moveY:time<4.8?1:0,jumpHeld:jump,jumpPressed:jump&&!held,jumpReleased:!jump&&held,grabHeld:time>4.8&&time<8.4});held=jump;
      for(const p of players){p.rawInput=input;p.step(1/60,input,level);}level.update(1/60);
      comparePose(pre,accepted,`pre-scribble baseline ${frame}`);
      comparePose(ink,accepted,`scribble pose ${frame}`);poseFrames++;
      for(const motion of [pre,ink])for(const key of ['phase','time','sourceName'])assert.equal(motion[key],accepted[key],`${key} changed at ${frame}`);
      assert.equal(pre.retarget.board.visible,accepted.retarget.board.visible,`A board visibility ${frame}`);
      pre.boardMaterials.forEach((v,i)=>assert.equal(v.material.opacity,accepted.boardMaterials[i].material.opacity,`A opacity ${frame}`));
      for(const p of [a,b]){assert.ok(p.pos.distanceTo(legacy.pos)<1e-9);for(const key of ['speed','vVel','grounded','state','freeSkate','airFromSkate'])assert.equal(p[key],legacy[key]);}
      assert.equal(pre.boardScribble.active,false,'A drew ink');
      const toggleKey=`${ink.boardScribble.serial}:${ink.boardScribble.frame<12?'early':'late'}`;
      if(ink.boardScribble.active && !toggled.has(toggleKey)){
        toggled.add(toggleKey);
        const time=ink.time,elapsed=ink.boardScribble.elapsed,serial=ink.boardScribble.serial;
        ink.scribbles=false;assert.equal(ink.boardScribble.active,false);
        assert.equal(ink.retarget.board.visible,accepted.retarget.board.visible);
        ink.boardMaterials.forEach((v,i)=>assert.equal(v.material.opacity,accepted.boardMaterials[i].material.opacity));
        ink.scribbles=true;assert.equal(ink.boardScribble.elapsed,elapsed);assert.equal(ink.time,time);assert.equal(ink.boardScribble.serial,serial);
        comparePose(ink,accepted,`paused A/B ${frame}`);toggleChecks++;
      }
    }
    assert.equal(ink.boardScribble.appearances,1);assert.equal(ink.boardScribble.disappearances,1);assert.ok(toggleChecks>=4);

    const stepB=(input=makeInput())=>{b.rawInput=input;b.step(1/60,input,level);level.update(1/60);};
    const freshB=()=>{b.enterLevel('scribble-test');b.respawn(level,true);b.freeSkate=false;ink.reset();runtimes[1].restart();};
    const reach=(phase,age=0)=>{
      for(let f=0;f<600;f++){
        stepB(makeInput({moveY:phase==='dismount'?0:1,jumpHeld:phase!=='dismount',grabHeld:phase==='dismount'}));
        if(ink.phase===phase&&ink.time>=age)return;
      }
      assert.fail(`Could not reach ${phase}/${age}`);
    };
    const counts=()=>[ink.boardScribble.appearances,ink.boardScribble.disappearances];
    // Native hold preparation, direction cancellation, immediate re-hold, and
    // short release-to-jump retain the accepted pose/physics on every tick.
    const holdResults=[];
    for(const releaseJump of [false,true]){
      resetAll();let wasHeld=false,previousProgress=0,sawUnwind=false,sawResume=false,sawCommit=false,peakTicks=0;
      for(let f=0;f<100;f++){
        const cancelling=f>=18&&f<21,held=releaseJump?f<18:true;
        const input=makeInput({moveY:cancelling?0:1,jumpHeld:held,jumpPressed:held&&!wasHeld,jumpReleased:!held&&wasHeld});wasHeld=held;
        for(const p of players){p.rawInput=input;p.step(1/60,input,level);}level.update(1/60);
        comparePose(ink,accepted,`hold/cancel pose ${releaseJump}/${f}`);poseFrames++;
        assert.ok(b.pos.distanceTo(legacy.pos)<1e-9);
        for(const key of ['speed','vVel','grounded','state','freeSkate','airFromSkate'])assert.equal(b[key],legacy[key]);
        const effect=ink.boardScribble;
        if(f<18){assert.equal(effect.stage,'prepare');assert.equal(b.freeSkate,false);assert.equal(effect.boardVisible,false);assert.ok(effect.frame>=14);assert.deepEqual(counts(),[0,0]);}
        if(cancelling){assert.equal(effect.stage,'unwind');assert.ok(effect.progress<previousProgress);sawUnwind=true;}
        if(f===21&&!releaseJump){assert.equal(effect.stage,'prepare');assert.ok(effect.progress>previousProgress);assert.ok(effect.progress<.5);sawResume=true;}
        if(effect.active&&effect.frame===0){peakTicks++;sawCommit=true;assert.equal(b.freeSkate,true);}
        if(f===19){const progress=effect.progress;ink.scribbles=false;assert.equal(effect.active,false);assert.equal(ink.retarget.board.visible,accepted.retarget.board.visible);ink.scribbles=true;assert.equal(effect.progress,progress);}
        if(releaseJump&&f>=30){assert.equal(effect.active,false,'released preview never cleared');assert.deepEqual(counts(),[0,0]);}
        previousProgress=effect.progress;
      }
      assert.ok(sawUnwind);
      if(!releaseJump){assert.ok(sawResume&&sawCommit);assert.equal(peakTicks,1);assert.deepEqual(counts(),[1,0]);}
      else assert.equal(sawCommit,false);
      holdResults.push({releaseJump,sawUnwind,sawResume,sawCommit,peakTicks});
    }
    freshB();for(let f=0;f<60;f++){stepB(makeInput({jumpHeld:true,jumpPressed:f===0}));assert.equal(ink.boardScribble.active,false,'stationary jump charge triggered mount ink');}
    freshB();for(let f=0;f<16;f++)stepB(makeInput({jumpHeld:true,jumpPressed:f===0,moveY:1}));
    assert.equal(ink.boardScribble.stage,'prepare');b.bail(false,8,'trip');stepB();assert.equal(ink.boardScribble.active,false);assert.deepEqual(counts(),[0,0]);
    // Review both complete source clips through the installed final callback.
    // Catch samples were measured from source board/right-hand separation.
    const catchResults=[];
    for(const [name,catchFrame,startFrame,peakFrame,endFrame] of [['BR_DISMOUNT_LO_INTO_STAND_0',26,24,26,36],['BR_DISMOUNT_LO_INTO_RUN_FWD',56,24,32,56]]){
      freshB();stepB();ink.enter('dismount',name);
      let first=-1,last=-1,apexTicks=0;
      const source=data.clips.find(c=>c.name===name);
      for(let frame=1;frame<source.frames.length+3;frame++){
        stepB();
        if(ink.boardScribble.active){if(first<0)first=frame;last=frame;if(ink.boardScribble.frame===0)apexTicks++;}
        if(frame<startFrame){
          assert.equal(ink.boardScribble.active,false,`${name}: ink started while feet still touched the deck`);
          assert.equal(ink.retarget.board.visible,true,`${name}: deck vanished before feet cleared`);
        }
        if(frame>=startFrame&&frame<peakFrame)assert.equal(ink.retarget.board.visible,true,`${name}: board vanished during ink growth`);
        if(frame>=peakFrame&&ink.phase==='dismount')assert.equal(ink.retarget.board.visible,false,`${name}: vanished board reappeared at ${frame}`);
        if(frame>=endFrame)assert.equal(ink.boardScribble.active,false,`${name}: ink did not finish at ${frame}`);
        if(frame>=catchFrame){
          assert.equal(ink.retarget.board.visible,false,`${name}: board survived catch at ${frame}`);
        }
        if(frame===catchFrame){
          ink.scribbles=false;assert.equal(ink.retarget.board.visible,true,'A lost its original carried board');
          ink.scribbles=true;assert.equal(ink.retarget.board.visible,false,'B revived the caught board after A/B');
        }
      }
      assert.equal(first,startFrame);assert.equal(last,endFrame-1);assert.equal(apexTicks,1);
      assert.deepEqual(counts(),[0,1]);catchResults.push({name,first,last,peakFrame,catchFrame,endFrame,apexTicks});
    }
    const bailResults=[];
    for(const [phase,age,masked] of [['mount',.10,false],['ride',.1,false],['ride',.1,true],['dismount',.20,false],['dismount',.4,false],['dismount',1.45,false]]){
      freshB();reach(phase==='dismount'?'ride':phase,phase==='dismount'?0:age);
      if(phase==='dismount')reach('dismount',age);
      const before=counts();b.bail(masked,Math.max(8,b.speed),'trip');assert.ok(b.isBailing);
      for(let f=0;f<360;f++){
        stepB();assert.equal(ink.boardScribble.active,false,`ink during ${phase} bail/recovery at ${f}`);
        assert.deepEqual(counts(),before,`bail/recovery fired an equipment cue (${phase}, ${f})`);
      }
      bailResults.push({phase,age,masked,counts:counts()});
    }
    // Repeated visibility changes are not equipment events, including while a
    // different pose owner (rail, ledge, flip, slide, manual, vert) has control.
    freshB();reach('ride',.1);const before=counts();
    for(let f=0;f<60;f++){
      ink.retarget.board.visible=!!(f%2);stepB();assert.deepEqual(counts(),before);assert.equal(ink.boardScribble.active,false);
    }
    for(const [flag,field,value] of [['crawling','crawling',true],['sliding','slideTimer',1],['wallriding','wallriding',true],
      ['grabbing','grabPhase','held'],['flip','flipT',1],['manual','manualing',1],['vert','vertAir',true]]){
      freshB();reach('mount',.1);const before=counts(),original=b[field];
      b[field]=value;
      // Exercise the installed final-overlay callback after staging the pose owner.
      b.playerAnimationBridge.prepareLegacyPose();b.playerAnimationBridge.applyFinalOverlay(1/60);
      assert.equal(ink.boardScribble.active,false,`${flag} retained mount ink`);assert.deepEqual(counts(),before);
      b[field]=original;
    }
    freshB();reach('mount',.1);const beforeGrind=counts();b.state='grind';
    b.playerAnimationBridge.prepareLegacyPose();b.playerAnimationBridge.applyFinalOverlay(1/60);
    assert.equal(ink.boardScribble.active,false);assert.deepEqual(counts(),beforeGrind);
    freshB();reach('mount',.1);const beforeDeath=counts();b.die();
    for(let f=0;f<20;f++){stepB();assert.equal(ink.boardScribble.active,false);assert.deepEqual(counts(),beforeDeath);}
    freshB();assert.equal(ink.boardScribble.active,false);assert.deepEqual(counts(),[0,0]);
    for(const motion of motions)motion.dispose();for(const runtime of runtimes)runtime.dispose();
    console.log(JSON.stringify({baseline:'22cebbe2',poseFrames,toggleChecks,holdResults,catchResults,bailResults,unrelatedVisibilityChanges:60,otherOwners:8,deathAndReset:true}));
  },{levelEntry:{id:'scribble-test',name:'Scribble test',data:{v:1,name:'Scribble test',spawn:[0,.03,6],killY:-20,components:[{t:'platform',p:[0,-.5,-100],s:[1000,1,1000]},{t:'gate',p:[0,0,-400]}]}}});
} finally {await rm(legacyUrl,{force:true});}
