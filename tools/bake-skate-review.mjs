// Capture the current gameplay presentation, not a second set of pose guesses.
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({player:p,Level,server,THREE})=>{
  const level=new Level(new THREE.Scene(),{id:'skate-review-capture',name:'Skate review capture',data:{v:1,name:'Skate review capture',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const lipLevel=new Level(new THREE.Scene(),{id:'skate-review-pipe',name:'Skate review pipe',data:{v:1,name:'Skate review pipe',spawn:[0,.02,2.8],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'vertramp',p:[0,0,5],len:140,w:2,rise:3,vkind:'half',yaw:90,arc:90},{t:'gate',p:[0,0,-450]}]}});
  const wallLevel=new Level(new THREE.Scene(),{id:'skate-review-wall',name:'Skate review wall',data:{v:1,name:'Skate review wall',spawn:[.2,3,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'wall',p:[-.65,0,0],s:[.2,7,140]},{t:'gate',p:[0,0,-450]}]}});
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {SKATE_REVIEW_ENTRIES,SKATE_REVIEW_REVISION,withSkatePresentationRig,skateReviewSignature}=await server.ssrLoadModule('/src/animation/skateCatalog.ts');
  const previousSignatures={};
  for(const path of ['public/animations/skate-review/catalog.json',process.env.SKATE_REVIEW_PREVIOUS].filter(Boolean)){
    let previous;
    try{previous=JSON.parse(await fs.readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    for(const clip of previous.clips??[])previousSignatures[clip.id]=[...new Set([...(previousSignatures[clip.id]??[]),...(previous.previousSignatures?.[clip.id]??[]),skateReviewSignature(clip)])];
  }
  const {withCharacterElasticity}=await server.ssrLoadModule('/src/animation/elasticity.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {DECK_TRICKS,GRIND_CONTACTS}=await server.ssrLoadModule('/src/skateTricks.ts');
  const {SPECIAL_TRICKS}=await server.ssrLoadModule('/src/specialTricks.ts');
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const base=a.RigBinding.fromSculptRuntime(p.animationRig.root).definition;
  const rig=withSkatePresentationRig(base),binding=a.RigBinding.fromDefinition(p.animationRig.root,rig);
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(base));
  const rail=new Rail([new THREE.Vector3(0,.8,4),new THREE.Vector3(0,.8,-4)],false);
  const highRail=new Rail([new THREE.Vector3(0,4.5,70),new THREE.Vector3(0,4.5,-70)],false);
  const runRail=new Rail([new THREE.Vector3(0,.8,70),new THREE.Vector3(0,.8,-70)],false);
  level.grindRails.push(runRail,highRail);level.rails.push(runRail,highRail);
  const clips=[],fps=30,dt=1/60;
  let maxRoundtrip=0;
  for(const entry of SKATE_REVIEW_ENTRIES){
    p.respawn(level,true,true,{position:new THREE.Vector3(),heading:new THREE.Vector3(0,0,-1)});runtime.restart();
    p.freeSkate=p.airFromSkate=true;p.skateMountT=-1;p.sidePose=p.deckPose=1;
    p.alignPose=p.slopePose=p.slopeRoll=0;p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.visualYaw=0;
    const [category,id]=entry.id.split(':');
    const nativeGrind=category==='grind'||id==='darkslide';
    const nativeLip=category==='lip',nativeWall=id==='Wallride',nativeManual=id==='Manual'||id==='Nose Manual';
    const nativeRevert=id==='Revert';
    const nativeBackflip=id==='kickflip-mctwist',nativeFootFlip=category==='flip'&&(id==='kick'||id==='heel');
    const native=nativeGrind||nativeLip||nativeWall||nativeManual||nativeRevert||nativeBackflip||nativeFootFlip;
    const arena=nativeLip||nativeBackflip?lipLevel:nativeWall?wallLevel:level;
    const grindDirections={normal:[0,0],nose:[0,1],five0:[0,-1],board:[1,0],lip:[1,0],smith:[-1,-1],feeble:[1,-1],crook:[-1,1],under:[0,0]};
    const stateTrace=[];
    let lipEnteredAt=null,lipExitSent=false,landedAt=null,backflipAirFrames=0,footFlipAirFrames=0;
    const hold=category==='grind'||category==='lip'||id==='darkslide'||id==='Manual'||id==='Nose Manual'||id==='Wallride';
    const frames=[];
    function pose(time){
      if(native&&time>=0){
        const f=Math.round(time*60),command=makeInput();
        if(nativeGrind&&f===(id==='darkslide'?2:0)){
          command.grindHeld=command.grindPressed=true;
          [command.moveX,command.moveY]=grindDirections[id]??[1,0];
        }
        if(id==='darkslide'&&f===0)command.moveX=-1;
        if(nativeFootFlip){
          command.jumpHeld=f>=12&&f<42;command.jumpPressed=f===12;command.jumpReleased=f===42;
          if(p.state==='air'){
            footFlipAirFrames++;
            if(footFlipAirFrames===4){command.spinPressed=command.spinHeld=true;command.moveX=id==='heel'?1:0;}
          }
        }else if(nativeBackflip){
          command.jumpHeld=landedAt===null;
          if(p.state==='air'){
            backflipAirFrames++;
            if(backflipAirFrames===1)command.moveX=-1;
            if(backflipAirFrames===3){command.moveX=1;command.spinPressed=command.spinHeld=true;}
          }
        }else if(nativeRevert){
          if(f===36||f===120){p.revertT=.3;command.transferPressed=true;}
        }else if(nativeLip){
          command.moveY=lipEnteredAt===null?1:lipExitSent?-1:0;command.grindHeld=lipEnteredAt===null;
          if(lipEnteredAt===null&&f>=11){
            command.moveX=id==='nose'?-1:id==='tail'?1:0;
            if(id==='rock')command.moveY=-1;
          }
          if(lipEnteredAt!==null&&!lipExitSent&&time>=lipEnteredAt+1.3){command.jumpPressed=command.jumpHeld=true;lipExitSent=true;}
        }else if(nativeWall){
          command.grindHeld=f<36;command.jumpHeld=f>=30&&f<36;command.jumpPressed=f===30;command.jumpReleased=f===36;
        }else if(nativeManual){
          if(f===30)p.tryManual(id==='Manual'?1:-1);
          command.jumpHeld=f>=108&&f<120;command.jumpPressed=f===108;command.jumpReleased=f===120;
        }else if(id==='under'){
          if(f===24)command.grabHeld=command.grabPressed=true;
          command.jumpHeld=f>=132&&f<138;command.jumpPressed=f===132;command.jumpReleased=f===138;
        }else{
          command.jumpHeld=f>=126&&f<138;command.jumpPressed=f===126;command.jumpReleased=f===138;
          if(f>=139&&f<154)command.moveX=1;
        }
        if((nativeLip||nativeBackflip||nativeFootFlip)&&landedAt!==null&&time>landedAt+.25){p.runTime+=dt;p.syncVisual(makeInput(),dt);}
        else p.step(dt,command,arena);
        if(nativeLip&&p.lipStallT>0&&lipEnteredAt===null){lipEnteredAt=time;assert.equal(p.lipStyle,id,'wrong lip-stall entry');}
        if(nativeLip&&lipExitSent&&p.grounded&&p.lipStallT<=0&&landedAt===null)landedAt=time;
        if(nativeBackflip&&backflipAirFrames>0&&p.grounded&&landedAt===null)landedAt=time;
        if(nativeFootFlip&&footFlipAirFrames>0&&p.grounded&&landedAt===null)landedAt=time;
        stateTrace.push({time,state:p.state,under:p.underK,underFlag:p.railUnder,lip:p.lipStallT>0,wall:p.wallriding,manual:p.manualing,grounded:p.grounded,y:p.pos.y,
          ...(nativeRevert?{stance:p.stance,reverting:p.revertPoseT>0}:{}),
          ...(nativeBackflip?{backflip:!!p.specialFlip}:{}),
          ...(nativeFootFlip?{flipping:p.flipT>0}:{})});
        if(nativeGrind&&f===(id==='darkslide'?2:0)){
          assert.equal(p.grindStyle,id==='under'?'normal':id==='darkslide'?'board':id,`Wrong entry for ${entry.name}`);
          if(id==='darkslide')assert.equal(p.specialGrind?.id,'darkslide');
        }
        assert.equal(p.isBailing,false,`${entry.name} route bailed at ${time}`);
        return;
      }
      const u=Math.max(0,time/entry.duration);
      p.rawInput=makeInput();p.runTime=Math.max(0,time);p.balance=0;p.stance=1;p.speed=id.includes('idle')||id==='Idle to charge'?0:8;
      p.charging=id==='Charge idle'||id==='Idle to charge'&&u>.22&&u<.67;p.chargeTimer=p.charging?1:0;
      const flightStart=.35,flightEnd=entry.duration-.55,flight=Math.max(0,Math.min(1,(time-flightStart)/(flightEnd-flightStart)));
      const airborne=!hold&&(category==='flip'||category==='grab'||id==='Ollie'||category==='special')&&time>=flightStart&&time<flightEnd;
      p.state=category==='grind'||id==='darkslide'?'grind':airborne||id==='Wallride'?'air':'ride';p.grounded=p.state==='ride';
      p.airborneT=airborne?time-flightStart:0;p.launchVy=8;p.vVel=airborne?8*(1-2*flight):0;
      p.grindStyle=category==='grind'&&id!=='under'?id:'board';p.grindRail=p.state==='grind'?(id==='under'?highRail:rail):null;p.grindT=4;p.grindDir=p.grindCrossDir=p.grindApproachSide=p.grindYawDir=1;
      p.underK=0;p.railUnder=false;
      p.skateMountT=id==='Skate mount'&&time>=.5&&time<.94?time-.5:-1;
      p.grabKind=category==='grab'?id:'mute';p.grabPhase=category==='grab'&&time>.55&&time<flightEnd-.3?'held':'none';
      p.grabT=p.grabPhase==='held'?1:0;
      p.specialGrind=id==='darkslide'?SPECIAL_TRICKS[2]:null;
      const specialProgress=Math.max(0,Math.min(1,(time-.6)/.9));
      p.specialGrab=id==='the-900'&&time>=.6&&specialProgress<1?SPECIAL_TRICKS[1]:null;
      p.specialGrabLanding=id==='the-900'&&specialProgress===1;
      p.nineHundredPose=id==='the-900'&&time>=.6;
      if(id==='the-900')p.grabKind='mute';
      if(p.specialGrab)p.grabPhase=specialProgress>.12&&specialProgress<.83?'held':'none';
      p.specialFlip=id==='kickflip-mctwist'&&time>=.6&&specialProgress<1?SPECIAL_TRICKS[0]:null;
      const flip=DECK_TRICKS.find(t=>t.kind===id),trickProgress=flip?Math.max(0,Math.min(1,(time-.6)/flip.duration)):0;
      p.flipKind=flip?.kind??'kick';p.flipDuration=p.specialFlip?.duration??flip?.duration??1;
      p.flipT=p.specialFlip?(1-specialProgress)*p.flipDuration:flip&&time>=.6&&trickProgress<1?(1-trickProgress)*flip.duration:0;
      const smooth=specialProgress*specialProgress*(3-2*specialProgress);
      p.grabSpinAngle=id==='the-900'?Math.PI*5*smooth:0;
      p.deckYawOffset=flip&&trickProgress===1?flip.yaw*Math.PI*2:0;
      p.revertPoseT=0;p.revertPoseSign=1;
      p.manualing=id==='Manual'?1:id==='Nose Manual'?-1:0;p.lipStallT=category==='lip'?5:0;p.lipStyle=category==='lip'?id:'axle';
      p.boardOllieAir=(id==='Ollie'||id==='kickflip-mctwist')&&airborne;p.wallriding=id==='Wallride';p.wallridePose=p.wallriding?1:0;p.wallNormal.set(1,0,0);
      p.pos.set(0,p.state==='grind'?.95:category==='lip'?.8:p.wallriding?1:airborne?Math.sin(Math.PI*flight)*1.15:0);p.prevPos.copy(p.pos);
      if(id==='under'){p.snapEase=1;p.placeOnRail(highRail);p.prevPos.copy(p.pos);}
      if(native){p.state='ride';p.grounded=true;p.grindRail=null;p.grindStyle='normal';p.underK=0;p.railUnder=false;p.specialGrind=null;p.manualing=0;p.lipStallT=0;p.wallriding=false;p.pos.set(0,0,0);p.prevPos.copy(p.pos);}
      p.syncVisual(makeInput(),dt);
    }
    for(let i=0;i<90;i++)pose(-1);
    if(nativeGrind){
      p.state='air';p.grounded=false;p.grindRail=null;p.underK=0;p.railUnder=false;p.underCoolT=0;p.regrindCd=0;
      p.grindVel=p.speed=12;p.vVel=-1;p.balanceBoostT=60;p.balance=p.balanceVel=0;p.stance=1;
      level.grindRails.length=0;level.rails.length=0;level.grindRails.push(id==='under'?highRail:runRail);level.rails.push(id==='under'?highRail:runRail);
      p.pos.set(id==='lip'?.12:id==='board'?-.12:0,(id==='under'?4.5:.8)+.25,0);p.prevPos.copy(p.pos);
      p.axisF.set(id==='lip'||id==='board'?.3:0,0,-1).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);
      p.visualYaw=Math.atan2(p.axisF.x,p.axisF.z)-Math.PI;
      if(id==='darkslide')p.special.award(1200);
    }else if(nativeLip||nativeBackflip){
      p.pos.set(0,.01,2.8);p.prevPos.copy(p.pos);p.speed=20;p.grounded=true;p.state='ride';p.freeSkate=true;p.grindRail=null;p.lipStallT=0;
      p.groundHit=p.queryGround(lipLevel);if(p.groundHit)p.rideNormal.copy(p.groundHit.normal);p.balanceBoostT=60;p.charging=false;p.chargeTimer=0;p.stance=1;
      if(id==='tail'){p.deckYawOffset=Math.PI;p.stance=-1;}
      if(nativeBackflip)p.special.award(1200);
    }else if(nativeWall){
      p.pos.set(.2,3,0);p.prevPos.copy(p.pos);p.speed=12;p.vVel=2;p.state='air';p.grounded=false;p.wallriding=false;p.wallridePose=0;p.wallCoolT=0;
      p.axisF.set(-.45,0,-1).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.airFromSkate=p.freeSkate=true;p.airMomentum=true;p.airGrav='board';
    }else if(nativeManual||nativeRevert||nativeFootFlip){
      level.grindRails.length=0;level.rails.length=0;p.pos.set(0,0,0);p.prevPos.copy(p.pos);p.state='ride';p.grounded=true;p.speed=12;p.manualing=0;p.balanceBoostT=60;
      if(nativeFootFlip){p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);p.charging=false;p.chargeTimer=0;p.speed=8;}
    }
    for(let f=0;f<=Math.round(entry.duration*60);f++){
      pose(f/60);if(f%2!==0&&!nativeLip&&!nativeBackflip&&!nativeFootFlip&&id!=='under')continue;
      const live=[...binding.joints.values()].map(node=>node.getWorldPosition(new THREE.Vector3()));
      p.clearCharacterAppearance();
      const scalars=Object.fromEntries(p.animationRig.deformations.map(d=>[d.controlId,p.playerAnimationBridge.deformationValue(d.controlId)]));
      p.playerAnimationBridge.restoreDeformationStates(true);
      const captured=binding.capturePose();captured.scalars=scalars;
      // Round-trip the exact same bone/deformation data used by the Studio.
      binding.applyPose(captured,{resetUnspecified:true});p.playerAnimationBridge.applyDeformations(scalars);p.syncCharacterAppearance();
      let i=0;for(const node of binding.joints.values())maxRoundtrip=Math.max(maxRoundtrip,node.getWorldPosition(new THREE.Vector3()).distanceTo(live[i++]));
      // Keep the real entry/swing/drop orientation, while centering travel
      // along the long rail so it stays reviewable in a small card.
      const canonical=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
      const outer=canonical.clone().invert().multiply(p.group.quaternion);
      const body=captured.joints.skateBody;
      body.quaternion=outer.clone().multiply(new THREE.Quaternion().fromArray(body.quaternion)).toArray();
      const offset=new THREE.Vector3(native?p.pos.x:0,p.pos.y,nativeLip||nativeBackflip?p.pos.z:0).applyQuaternion(canonical.clone().invert());
      body.position=new THREE.Vector3().fromArray(body.position).applyQuaternion(outer).add(offset).toArray();
      frames.push({time:f/60,pose:captured,boardVisible:p.boardG.visible});
    }
    let clip=a.createAnimationClip({id:entry.clipId,name:`Skate · ${entry.number} · ${entry.name}`,rigId:base.id,duration:entry.duration});
    clip.tags=['skate','review',entry.category];clip.loop={mode:'loop',seamless:false};
    clip.metadata={skateReviewId:entry.id,skateReviewRevision:SKATE_REVIEW_REVISION,reviewCapture:true,
      description:'Editable gameplay capture for review. Gameplay retains its procedural source until a repair is accepted.'};
    if(native){
      assert.ok((nativeRevert||stateTrace.some(s=>s.state==='air'))&&stateTrace.at(-1).grounded,`${entry.name} must exit and land`);
      if(nativeGrind)assert.ok(stateTrace.some(s=>s.state==='grind'));
      if(nativeLip)assert.ok(stateTrace.some(s=>s.lip)&&lipExitSent,'lip cycle must enter and exit');
      if(nativeWall)assert.ok(stateTrace.some(s=>s.wall),'wallride cycle never attached');
      if(nativeManual)assert.ok(stateTrace.some(s=>s.manual!==0)&&stateTrace.at(-1).manual===0,'manual cycle must load and release');
      if(nativeRevert)assert.ok(stateTrace.some(s=>s.stance===-1)&&stateTrace.at(-1).stance===1,'reverts must alternate normal/fakie');
      if(nativeFootFlip)assert.ok(stateTrace.some(s=>s.flipping)&&landedAt!==null,`${entry.name} must pop, flick and land`);
      if(nativeBackflip)assert.ok(stateTrace.some(s=>s.backflip)&&landedAt!==null,'Backflip must launch, rotate and land');
      if(id==='under'){
        const at=t=>stateTrace[Math.round(t*60)];
        assert.ok(at(.2).under<.01&&at(.95).under>.99&&at(2.1).under>.99);
        assert.ok(at(2.4).state==='air'&&at(3.8).grounded,'under-rail drop did not land');
      }
      clip.metadata.transitionCapture='native Player.step inputs';
      clip.metadata.transitionEvidence=stateTrace.filter((s,i)=>i===0||s.state!==stateTrace[i-1].state||s.underFlag!==stateTrace[i-1].underFlag||s.lip!==stateTrace[i-1].lip||s.wall!==stateTrace[i-1].wall||s.manual!==stateTrace[i-1].manual||s.stance!==stateTrace[i-1].stance||s.reverting!==stateTrace[i-1].reverting||s.backflip!==stateTrace[i-1].backflip||s.flipping!==stateTrace[i-1].flipping);
      clip.metadata.reviewRailHeight=id==='under'?4.5:nativeLip||nativeBackflip?3.05:.8;
      if(nativeLip||nativeBackflip){clip.metadata.reviewPipe=true;clip.metadata.captureFps=60;}
      if(id==='under'||nativeFootFlip)clip.metadata.captureFps=60;
    }
    clip.metadata.boardVisibility=frames.filter((f,i)=>i===0||f.boardVisible!==frames[i-1].boardVisible).map(f=>[f.time,f.boardVisible]);
    const track=(kind,target,values)=>{
      const identity=kind==='scale'?[1,1,1]:kind==='quaternion'?[0,0,0,1]:kind==='position'?[0,0,0]:1;
      const distance=(a,b)=>typeof a==='number'?Math.abs(a-b):Math.hypot(...a.map((n,i)=>n-b[i]));
      if(values.every(v=>distance(v,identity)<1e-6))return;
      const constant=values.every(v=>distance(v,values[0])<1e-6);
      const kept=new Set([0,values.length-1]);
      const tolerance=kind==='quaternion'?.0009:.0002;
      const segments=[[0,values.length-1]];
      while(!constant&&segments.length){
        const [start,end]=segments.pop();let worst=tolerance,index=-1;
        for(let j=start+1;j<end;j++){
          const t=(frames[j].time-frames[start].time)/(frames[end].time-frames[start].time);
          let error;
          if(kind==='quaternion')error=new THREE.Quaternion().fromArray(values[start]).slerp(new THREE.Quaternion().fromArray(values[end]),t).angleTo(new THREE.Quaternion().fromArray(values[j]));
          else {const interpolated=typeof values[start]==='number'?values[start]+(values[end]-values[start])*t:values[start].map((v,i)=>v+(values[end][i]-v)*t);error=distance(interpolated,values[j]);}
          if(error>worst){worst=error;index=j;}
        }
        if(index>=0){kept.add(index);segments.push([start,index],[index,end]);}
      }
      const keys=(constant?[0]:[...kept].sort((a,b)=>a-b)).map(i=>({id:`k${i}`,time:frames[i].time,value:values[i],interpolation:'linear'}));
      clip.tracks.push({id:`${kind}:${target}`,name:kind==='scalar'?`Elasticity · ${target}`:undefined,kind,target,keys});
    };
    for(const id of binding.joints.keys())for(const kind of ['position','quaternion','scale'])
      track(kind,id,frames.map(f=>f.pose.joints[id][kind]));
    // Constant controls still own their channel, preventing a second elastic
    // layer from being added over the captured shared gameplay profiles.
    for(const control of base.controls){
      const values=frames.map(f=>f.pose.scalars[control.id]??control.defaultValue);
      if(values.every(v=>Math.abs(v-1)<1e-6))clip.tracks.push({id:`scalar:${control.id}`,kind:'scalar',target:control.id,keys:[{id:'k0',time:0,value:1,interpolation:'linear'}]});
      else track('scalar',control.id,values);
    }
    clip=withCharacterElasticity(clip,rig);clips.push(clip);
    console.log(`${entry.number} ${entry.name}: ${clip.tracks.length} tracks`);
  }
  runtime.dispose();
  level.dispose();
  lipLevel.dispose();wallLevel.dispose();
  assert.ok(maxRoundtrip<.003,`Capture changed the visible rig by ${maxRoundtrip}m`);
  const source=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  await fs.mkdir('public/animations/skate-review',{recursive:true});
  // Six decimal places retain sub-millimetre reconstruction while reducing
  // transfer and parse cost. Each entry remains ordinary editable keys.
  const json=JSON.stringify({revision:SKATE_REVIEW_REVISION,source,fps,maxRoundtrip,previousSignatures,clips},(_k,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v);
  await fs.writeFile('public/animations/skate-review/catalog.json',json+'\n');
  console.log(`Captured ${clips.length} clips, ${(json.length/1048576).toFixed(2)} MiB, max round-trip ${maxRoundtrip.toFixed(6)}m.`);
});
