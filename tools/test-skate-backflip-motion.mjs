import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,level,step})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {sampleBackflip}=await server.ssrLoadModule('/src/skateTricks.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),point=v(),matrix=new THREE.Matrix4();
  const walls=[[[0,.1,10],[0,0,1]],[[28,.1,-90],[0,0,-1]],[[28,.1,-42],[1,0,0]],[[-28,.1,-70],[-1,0,0]]];
  let frames=0,vertices=0,gripFrames=0,minShorts=Infinity,maxFoot=0,maxHand=0,maxKnee=0,maxApexRatio=0,maxFootCase=null,maxBodyStep=0;
  const errors=[];
  for(const stance of [-1,1])for(const [position,heading] of walls){
    p.respawn(level,true,true,{position:v(...position),heading:v(...heading)});runtime.restart();
    p.axisF.set(...heading);p.axisL.set(heading[2],0,-heading[0]);p.freeSkate=true;p.speed=15.3;p.stance=stance;
    p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);p.special.award(1200);
    for(let f=0;f<260&&!p.vertAir;f++)step(makeInput({jumpHeld:true}));assert.ok(p.vertAir,'vert launch never occurred');
    let started=false,held=0,entryHeight=0,apexHeight=Infinity,compressed=false,overlap=false;
    let previousBody=p.bodyGroup.getWorldQuaternion(new THREE.Quaternion());
    for(let f=0;f<130;f++){
      const input=makeInput({jumpHeld:true});if(f===0)input.moveX=-1;if(f===2){input.moveX=1;input.spinPressed=input.spinHeld=true;}
      step(input);frames++;p.group.updateMatrixWorld(true);
      assert.equal(p.isBailing,false,'Backflip did not land cleanly');
      if(p.specialFlip){
        const current=p.bodyGroup.getWorldQuaternion(new THREE.Quaternion());maxBodyStep=Math.max(maxBodyStep,previousBody.angleTo(current));
        const t=1-p.flipT/p.flipDuration,m=sampleBackflip(t);
        const boardUp=v(0,1,0).transformDirection(p.boardG.matrixWorld);
        const hip=at('hips').sub(at('socket-foot-left').add(at('socket-foot-right')).multiplyScalar(.5)).dot(boardUp);
        if(!started){entryHeight=hip;assert.ok(p.airborneT<.10,'Backflip waited until after the ollie');}started=true;
        if(t<.12&&m.rotation<-.0001&&p.boardG.userData.ollieMotion)overlap=true;
        const knees=['left','right'].map(side=>at(`knee-${side}`).sub(at(`hip-${side}`)).angleTo(at(`ankle-${side}`).sub(at(`knee-${side}`))));
        maxKnee=Math.max(maxKnee,...knees);
        if(Math.max(...knees)>1.35&&errors.length<8)errors.push({kind:'knee',stance,t,knees});
        if(m.compression>.99){
          compressed=true;apexHeight=Math.min(apexHeight,hip);
          for(const side of ['left','right'])for(const part of ['upper','lower']){
            const length=p.playerAnimationBridge.deformationValue(`deform.leg.${part}.${side}.length`);
            assert.ok(length>.55&&length<.70,`apex leg must shorten independently: ${length}`);
          }
        }
        if(m.grab>.99){
          held++;gripFrames++;
          const side=stance>0?'right':'left',s=p.boardG.userData.settings,k=s.overallScale;
          const x=s.deckHalfWidth*k*stance,z=.1;
          const target=p.boardG.localToWorld(v(x,(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,x/k,z/k))*k,z));
          const error=at(`socket-grip-${side}`).distanceTo(target);maxHand=Math.max(maxHand,error);
          if(error>.006&&errors.length<8)errors.push({kind:'grip',stance,t,error});
          assert.equal(p.boardG.userData.skateGrab?.hand,`socket-grip-${side}`);
        }
      }
      previousBody=p.bodyGroup.getWorldQuaternion(new THREE.Quaternion());
      if(started){
        const footError=p.boardG.userData.skateContact?.footError??0;
        if(footError>maxFoot){maxFoot=footError;maxFootCase={stance,f,state:p.state,progress:p.specialFlip?1-p.flipT/p.flipDuration:null,
          height:p.boardG.userData.skateContact?.bodyHeight,span:p.boardG.userData.skateContact?.footSpan,
          feet:['left','right'].map(side=>({side,position:p.boardG.worldToLocal(at(`socket-foot-${side}`)).toArray()}))};}
        const s=p.boardG.userData.settings,k=s.overallScale;matrix.copy(p.boardG.matrixWorld).invert().multiply(shorts.matrixWorld);
        for(let i=0;i<shorts.geometry.attributes.position.count;i++){
          shorts.getVertexPosition(i,point).applyMatrix4(matrix);vertices++;
          if(Math.abs(point.x)>s.deckHalfWidth*k||point.z< -s.deckTailLength*k||point.z>s.deckNoseLength*k)continue;
          const gap=point.y-(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;minShorts=Math.min(minShorts,gap);
          if(gap<.02&&errors.length<8)errors.push({kind:'shorts',stance,gap});
        }
        assert.ok(p.bodyGroup.scale.distanceTo(v(1.18,1.36,1.18))<1e-7,'Backflip scaled the whole skeleton');
      }
      if(started&&p.grounded)break;
    }
    maxApexRatio=Math.max(maxApexRatio,apexHeight/entryHeight);
    assert.ok(started&&compressed&&overlap&&held>5&&p.grounded,'missing simultaneous launch, compressed grip or landing');
    assert.ok(apexHeight<entryHeight*.65,'apex compression is too small');
    assert.equal(p.comboPoints,2500);assert.equal(p.comboMult,1);
  }
  runtime.dispose();console.log({frames,vertices,gripFrames,minShorts,maxFoot,maxFootCase,maxHand,maxKneeDegrees:maxKnee*180/Math.PI,maxApexRatio,maxBodyStepDegrees:maxBodyStep*180/Math.PI,errors});
  assert.equal(sampleBackflip(1).rotation,-2*Math.PI);assert.deepEqual(errors,[]);assert.ok(maxFoot<.006,JSON.stringify(maxFootCase));assert.ok(maxBodyStep<.45,'Backflip body rotation snaps');
  console.log('PASS simultaneous ollie/backflip, short-segment apex, one planted hand, shallow knees, complete rotation and clean landing on four walls in both stances.');
});
