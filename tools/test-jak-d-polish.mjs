import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const bank=JSON.parse(await readFile(process.argv[2],'utf8'));
const previous=JSON.parse(await readFile(new URL('./fixtures/pre-reference-jump-clips.json',import.meta.url),'utf8'));
await withSkateRuntime(async({server,player:p,level,THREE,TUNING})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const base=a.createPlayerStarterAnimationSuite(binding.definition);
  const old={...base,clips:base.clips.map(c=>previous.find(o=>o.id===c.id)??c)};
  const direct=createJakDirectSuite(base,binding.definition,bank);
  const runtime=createCharacterAnimationRuntime(p,old);
  const point=id=>binding.joints.get(id).getWorldPosition(new THREE.Vector3());
  const reset=(variant,profile)=>{
    p.enterLevel('jak-polish');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy=variant==='D'?{...JAK_DIRECT_PHYSICS,flip:true,...profile}:null;
    runtime.setDocument(variant==='D'?direct:old);runtime.restart();
  };
  const tick=input=>{
    p.camDir.set(0,0,-1);p.step(1/60,makeInput(input),level);level.update(1/60);p.commitRenderStep(level);
  };
  const headTop=()=>new THREE.Box3().setFromObject(p.meshyHead.mesh,true).max.y;
  const jump=(variant,hold,move=false,double=false,profile)=>{
    reset(variant,profile);let air=-1,land=-1,second=-1,headPeak=-Infinity,rootPeak=-Infinity,peakFrame=-1;
    let maxHeadStep=0,maxRecoveryHeadStep=0,handoffHeadStep=0,oldHead=headTop(),oldClip=null;const clips=new Set();
    for(let f=0;f<240;f++) {
      const input={moveY:move?1:0,jumpPressed:f===50,jumpHeld:f>=50&&f<50+hold,jumpReleased:f===50+hold};
      if(double&&air>=0&&second<0&&!p.grounded&&p.vVel<.5){second=f;input.jumpPressed=input.jumpHeld=true;}
      if(second>=0&&f===second+1)input.jumpReleased=true;
      tick(input);clips.add(runtime.activeClipId);
      const head=headTop();
      if(!p.grounded&&air<0)air=f;
      if(air>=0&&land<0) {
        if(head>headPeak){headPeak=head;peakFrame=f;}rootPeak=Math.max(rootPeak,p.pos.y);
        if(p.grounded)land=f;
      }
      if(land>=0) {
        maxHeadStep=Math.max(maxHeadStep,Math.abs(head-oldHead));
        if(f>land+3)maxRecoveryHeadStep=Math.max(maxRecoveryHeadStep,Math.abs(head-oldHead));
        if(oldClip!==runtime.activeClipId&&['player.run','player.idle'].includes(runtime.activeClipId))
          handoffHeadStep=Math.max(handoffHeadStep,Math.abs(head-oldHead));
      }
      oldHead=head;oldClip=runtime.activeClipId;
      assert.equal(p.freeSkate,false,'jump fixture unexpectedly mounted');
    }
    return {variant,hold,move,double,air,land,second,headPeak,rootPeak,peakFrame,maxHeadStep,maxRecoveryHeadStep,handoffHeadStep,finalClip:runtime.activeClipId,clips:[...clips]};
  };
  const jumps=[];
  for(const [hold,move,double] of [[1,false,false],[3,false,false],[6,false,false],[12,false,false],[18,false,false],[24,false,false],[35,false,false],[1,true,false],[18,true,false],[1,false,true],[12,false,true],[24,false,true]])
    for(const variant of ['A','D'])jumps.push(jump(variant,hold,move,double));
  let calibration;
  if(process.argv.includes('--calibrate')) {
    const solve=(target,measure)=>{
      let lo=0.05,hi=7,last;
      for(let i=0;i<11;i++) {
        const height=(lo+hi)/2;last=measure(height);
        if(last.headPeak<target)lo=height;else hi=height;
      }
      return {height:(lo+hi)/2,last};
    };
    const fullA=jump('A',35),tapA=jump('A',1),doubleA=jump('A',35,false,true);
    const full=solve(fullA.headPeak,height=>jump('D',35,false,false,{maximumHeight:height}));
    const tap=solve(tapA.headPeak,height=>jump('D',1,false,false,{maximumHeight:full.height,minimumHeight:height}));
    const profile={maximumHeight:full.height,minimumHeight:tap.height};
    const second=solve(doubleA.headPeak,height=>jump('D',35,false,true,{...profile,doubleHeight:height,doubleMinimumHeight:height}));
    const doubleTapA=jump('A',1,false,true);
    const secondTap=solve(doubleTapA.headPeak,height=>jump('D',1,false,true,{...profile,doubleHeight:second.height,doubleMinimumHeight:height}));
    calibration={...profile,doubleHeight:second.height,doubleMinimumHeight:secondTap.height,targets:[tapA,fullA,doubleA,doubleTapA],matches:[tap.last,full.last,second.last,secondTap.last],
      intermediate:jump('D',12,false,false,{...profile,doubleHeight:second.height}),
      intermediateDouble:jump('D',12,false,true,{...profile,doubleHeight:second.height,doubleMinimumHeight:secondTap.height})};
  }
  const runs=[],runTraces=[];
  for(const variant of ['A','D']) {
    reset(variant);const rows=[];
    for(let f=0;f<240;f++) {
      tick({moveX:f>=120&&f<160?-1:0,moveY:f<60?.3:f<120?1:0});
      rows.push({f,pos:p.pos.toArray(),speed:p.walkVelocity.length(),turn:p.walkTurnaround,clip:runtime.activeClipId,
        hips:point('hips').toArray(),spine:point('spine').toArray(),chest:point('chest').toArray(),head:headTop(),
        waist:point('spine').distanceTo(point('hips'))});
    }
    runTraces.push(rows.map(r=>[...r.pos,r.speed,r.turn]));
    runs.push({variant,waistRange:[Math.min(...rows.map(r=>r.waist)),Math.max(...rows.map(r=>r.waist))],snapshots:rows.filter(r=>[0,30,59,90,119,121,128,140,160,180,239].includes(r.f))});
  }
  assert.deepEqual(runTraces[1],runTraces[0],'D changed native walk, acceleration, turn inertia or stopping');
  assert.ok(runs[1].waistRange[1]<runs[0].waistRange[1]*1.2,'D waist is detached from the lower body');
  const climbs=[];
  for(const moving of [false,true]) {
    reset('D');p.pos.set(20,2.35,-1.1);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-1;
    p.walkVelocity.set(0,0,-4);p.lastVelZ=-4;p.rawInput=makeInput({moveY:1});
    const wall=level.walls.find(w=>Math.abs(w.max.y-3.35)<.01);
    assert.ok(p.tryLedgeGrab(wall,level));for(let f=0;f<100;f++)tick({});
    let exited=-1,maxLateHeadStep=0,oldHead=headTop();const clips=[],samples=[];
    for(let f=0;f<90;f++) {
      tick({jumpPressed:f===0,moveY:moving?1:0});
      const head=headTop();
      if(p.state!=='hang'&&exited<0)exited=f;
      if(exited>=0&&f<exited+24)maxLateHeadStep=Math.max(maxLateHeadStep,Math.abs(head-oldHead));oldHead=head;
      clips.push(runtime.activeClipId);samples.push({f,y:p.pos.y,head,clip:runtime.activeClipId,speed:p.walkVelocity.length()});
    }
    assert.ok(exited>=28&&exited<=30,'D pull-up duration changed');
    assert.ok(maxLateHeadStep<.085,`climb settle snapped: ${maxLateHeadStep}`);
    assert.equal(samples[45].clip,moving?'player.run':'player.idle','climb did not settle into the requested locomotion');
    if(moving)assert.ok(samples[45].speed>2,'climb settle blocked movement');
    assert.ok(!clips.slice(exited,exited+24).some(c=>c.includes('jump')||c.includes('land')),'climb introduced a second jump/landing');
    climbs.push({moving,exited,maxLateHeadStep,clips:[...new Set(clips)],samples:samples.slice(20,48)});
  }
  if(!process.argv.includes('--calibrate')&&!process.argv.includes('--measure'))for(let i=0;i<jumps.length;i+=2) {
    const [before,after]=jumps.slice(i,i+2),error=Math.abs(after.headPeak-before.headPeak);
    assert.ok(error<.06,`head peak differs by ${error}m for hold=${before.hold}, moving=${before.move}, double=${before.double}`);
    assert.ok(after.handoffHeadStep<.04,`landing to locomotion snapped by ${after.handoffHeadStep}m`);
  }
  console.log(JSON.stringify({tuning:{walkSpeed:TUNING.walkSpeed,walkRampTime:TUNING.walkRampTime,walkSlowdownTime:TUNING.walkSlowdownTime},rig:binding.definition.joints.filter(j=>['hips','torsoRoot','spine','chest'].includes(j.id)),jumps,runs,climbs,calibration},null,2));
  runtime.dispose();
},{levelEntry:{id:'jak-polish',name:'D polish',data:{v:1,name:'D polish',spawn:[0,.02,0],killY:-30,
 components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},{t:'platform',p:[20,1.8,-4],s:[8,3.6,5]},{t:'gate',p:[0,0,-200]}]}}});
