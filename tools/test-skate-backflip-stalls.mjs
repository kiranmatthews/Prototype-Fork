import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,THREE,server,Level,TUNING})=>{
  TUNING.chaseCam=1;
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),up=v(0,1,0),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),deck=p.boardG.getObjectByName('Deck_ContinuousRoundedKick');
  const point=v(),matrix=new THREE.Matrix4();
  let frames=0,vertices=0,minShorts=Infinity,minCoping=Infinity,maxFoot=0,maxKnee=0,minHip=Infinity,stalls=0,flips=0;
  const failures=[];
  function garment(label){
    p.group.updateMatrixWorld(true);
    const s=p.boardG.userData.settings,k=s.overallScale;
    matrix.copy(p.boardG.matrixWorld).invert().multiply(shorts.matrixWorld);
    for(let i=0;i<shorts.geometry.attributes.position.count;i++){
      shorts.getVertexPosition(i,point).applyMatrix4(matrix);vertices++;
      if(Math.abs(point.x)>s.deckHalfWidth*k||point.z< -s.deckTailLength*k||point.z>s.deckNoseLength*k)continue;
      const gap=point.y-(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
      minShorts=Math.min(minShorts,gap);
      if(gap<.02&&failures.length<12)failures.push({label,kind:'garment',gap});
    }
    maxFoot=Math.max(maxFoot,p.boardG.userData.skateContact?.footError??0);
  }
  function posture(label){
    const soles=at('socket-foot-left').add(at('socket-foot-right')).multiplyScalar(.5);
    const h=at('hips').sub(soles).dot(up.clone().transformDirection(p.riderG.matrixWorld));minHip=Math.min(minHip,h);
    for(const side of ['left','right']){
      const knee=at(`knee-${side}`).sub(at(`hip-${side}`)).angleTo(at(`ankle-${side}`).sub(at(`knee-${side}`)));
      maxKnee=Math.max(maxKnee,knee);
      const hip=at(`hip-${side}`),ankle=at(`ankle-${side}`),mid=at(`knee-${side}`),line=ankle.clone().sub(hip).normalize();
      const forward=v(0,0,1).transformDirection(p.riderG.getObjectByName(`ankle-${side}`).matrixWorld);
      const bend=mid.sub(hip).addScaledVector(line,-mid.dot(line)).dot(forward);
      if(bend<-.015&&failures.length<12)failures.push({label,kind:'backward knee',bend});
      if((knee>1.6||h<.55)&&failures.length<12)failures.push({label,kind:'posture',knee,h});
    }
  }
  const pipes=[0,90].map(yaw=>new Level(new THREE.Scene(),{id:`stall-${yaw}`,name:'Stall QA',data:{v:1,name:'Stall QA',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'vertramp',p:[0,0,0],len:140,w:2,rise:3,vkind:'half',yaw,arc:90},{t:'gate',p:[0,0,-450]}]}}));
  if(!process.env.BACKFLIP_ONLY)for(const level of pipes)for(const side of [-1,1])for(const stance of [-1,1])for(const reversed of [false,true])for(const requested of ['axle','rock','tip']){
    const hp=level.halfpipes[0],out=hp.axis==='z'?v(side,0,0):v(0,0,side);
    const position=out.clone().multiplyScalar(2.2);position.y=.01;
    p.respawn(level,true,true,{position,heading:out});runtime.restart();
    p.axisF.copy(out);p.axisL.set(out.z,0,-out.x);p.visualYaw=Math.atan2(out.x,out.z)-Math.PI;
    p.camDir.copy(out);
    p.freeSkate=p.airFromSkate=true;p.sidePose=p.deckPose=p.skatePose=1;p.skateMountT=-1;p.speed=20;p.stance=stance;
    p.deckYawOffset=reversed?Math.PI:0;p.balanceBoostT=60;
    p.groundHit=p.queryGround(level);if(p.groundHit)p.rideNormal.copy(p.groundHit.normal);
    const expected=requested==='tip'?(reversed?'tail':'nose'):requested;
    let entered=false,held=0,exit=false;const trace=[];const label=`${hp.axis}/${side}/${stance}/${reversed}/${expected}`;
    for(let f=0;f<180;f++){
      const input=makeInput({moveY:exit?-1:entered?0:1,grindHeld:!entered});
      if(!entered&&f>=11){if(requested==='tip')input.moveX=stance;else if(requested==='rock')input.moveY=-1;}
      if(entered&&!exit){p.balanceBoostT=0;p.balance=.72*Math.sin(held*.18);p.balanceVel=0;}
      if(held>=55&&!exit){input.jumpPressed=input.jumpHeld=true;exit=true;}
      p.step(1/60,input,level);frames++;
      if(f%15===0)trace.push({f,pos:p.pos.toArray(),heading:p.axisF.toArray(),state:p.state,stall:p.lipStallT});
      if(p.lipStallT>0){
        entered=true;held++;assert.equal(p.lipStyle,expected,label);
        assert.equal(p.stance,stance,`${label}: catch changed stance`);
        assert.ok(Math.abs(Math.cos(p.deckYawOffset)-(reversed?-1:1))<1e-5,`${label}: catch reversed board`);
        garment(label);posture(label);
        if(requested==='tip'){
          const nose=v(0,0,1).transformDirection(p.boardG.matrixWorld);
          nose.y=0;nose.normalize();
          assert.ok(nose.dot(out)*(reversed?-1:1)>.75,`${label}: tip stall turned away from entry`);
        }
        const center=out.clone().multiplyScalar(hp.lipX);center.y=hp.lipY+.05;
        for(let i=0;i<deck.geometry.attributes.position.count;i++){
          point.fromBufferAttribute(deck.geometry.attributes.position,i).applyMatrix4(deck.matrixWorld).sub(center);
          const distance=Math.hypot(point.dot(out),point.y);minCoping=Math.min(minCoping,distance);
          if(distance<.088&&failures.length<12)failures.push({label,kind:'coping',distance});
        }
      }else if(entered){garment(label);if(p.grounded)break;}
      assert.equal(p.isBailing,false,`${label}: stalled route bailed ${JSON.stringify({f,entered,held,exit,pos:p.pos.toArray(),hp:{lipX:hp.lipX,lipY:hp.lipY},failures})}`);
    }
    assert.ok(entered&&held>=55&&exit,`${label}: native stall was not exercised ${JSON.stringify({entered,held,exit,trace,failures})}`);stalls++;
  }
  const level=pipes[0];
  for(const stance of [-1,1])for(const heading of [v(0,0,-1),v(1,0,0)]){
    p.respawn(level,true,true,{position:v(0,2,-100),heading});runtime.restart();
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.visualYaw=Math.atan2(heading.x,heading.z)-Math.PI;
    p.freeSkate=p.airFromSkate=true;p.sidePose=p.deckPose=p.skatePose=1;p.skateMountT=-1;p.stance=stance;
    p.state='air';p.grounded=false;p.speed=12;p.vVel=p.launchVy=20;p.airMomentum=true;p.airGrav='vert';p.boardOllieAir=true;p.special.award(1200);
    let started=false,inverted=false,completed=false,landed=false,noseRise=false;const turns=[];
    const right=v().crossVectors(up,heading).normalize();
    for(let f=0;f<160;f++){
      const input=makeInput();if(f===2)input.moveX=-1;if(f===4){input.moveX=1;input.spinPressed=input.spinHeld=true;}
      p.step(1/60,input,level);frames++;
      if(p.specialFlip){
        p.group.updateMatrixWorld(true);
        started=true;assert.equal(p.specialFlip.label,'Backflip');
        const progress=1-p.flipT/p.flipDuration,normal=up.clone().transformDirection(p.boardG.matrixWorld);
        const nose=v(0,0,1).transformDirection(p.boardG.matrixWorld),width=v(1,0,0).transformDirection(p.boardG.matrixWorld);
        if(normal.y<-.9)inverted=true;if(progress<.15&&nose.y>.2)noseRise=true;
        if(f%6===0)turns.push({progress,up:normal.toArray()});
        assert.ok(width.dot(right)>.97,'Backflip introduced a yaw/roll twist');
        if(progress>.4&&progress<.65)assert.equal(p.boardG.userData.skateGrab?.hand,`socket-grip-${stance>0?'right':'left'}`,'Backflip needs its leading-hand apex grip');
      }else if(started)completed=true;
      if(started)garment('Backflip');
      assert.equal(p.isBailing,false,'Backflip bailed');
      if(started&&p.grounded){landed=true;break;}
    }
    assert.ok(started&&noseRise&&inverted&&completed&&landed,`Backflip must pop nose-up, invert, finish and land ${JSON.stringify({started,noseRise,inverted,completed,landed,turns,stalls,failures,minShorts,minCoping,minHip,maxKnee})}`);
    assert.equal(p.comboPoints,2500);assert.equal(p.comboMult,1);flips++;
  }
  runtime.dispose();pipes.forEach(l=>l.dispose());
  console.log({stalls,flips,frames,vertices,minShorts,minCoping,minHip,maxKneeDegrees:maxKnee*180/Math.PI,maxFoot,failures});
  assert.deepEqual(failures,[]);assert.ok(maxFoot<.006);
  console.log(`PASS ${flips} native Backflips and ${stalls} lip stalls: orientation, shallow legs, garment/board and coping clearance.`);
});
