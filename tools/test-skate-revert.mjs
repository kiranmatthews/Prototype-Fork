import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,Level,level:park,step})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const flat=new Level(new THREE.Scene(),{id:'revert-test',name:'Revert',data:{v:1,name:'Revert',spawn:[0,.01,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const v=(...xyz)=>new THREE.Vector3(...xyz),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const yaw=node=>{const forward=v(0,0,1).transformDirection(node.matrixWorld);return Math.atan2(forward.x,forward.z);};
  const delta=(x,y)=>Math.atan2(Math.sin(x-y),Math.cos(x-y));
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),point=v(),matrix=new THREE.Matrix4();
  let frames=0,vertices=0,reverts=0,maxHop=0,maxKnee=0,maxFoot=0,minClearance=Infinity,maxTurnStep=0,maxArmReach=0,minWristAlignment=1;
  function clearance(){
    const s=p.boardG.userData.settings,k=s.overallScale;
    matrix.copy(p.boardG.matrixWorld).invert().multiply(shorts.matrixWorld);
    for(let i=0;i<shorts.geometry.attributes.position.count;i++){
      shorts.getVertexPosition(i,point).applyMatrix4(matrix);vertices++;
      if(Math.abs(point.x)>s.deckHalfWidth*k||point.z< -s.deckTailLength*k||point.z>s.deckNoseLength*k)continue;
      const gap=point.y-(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
      minClearance=Math.min(minClearance,gap);assert.ok(gap>.02,`revert shorts intersect the board: ${gap}`);
    }
  }
  for(const entering of [-1,1])for(const deck of [0,Math.PI])for(const heading of [v(0,0,-1),v(1,0,0)]){
    p.respawn(flat,true,true,{position:v(0,0,0),heading});runtime.restart();
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.visualYaw=Math.atan2(heading.x,heading.z)-Math.PI;
    p.freeSkate=p.airFromSkate=true;p.sidePose=p.deckPose=p.skatePose=1;p.skateMountT=-1;p.speed=12;p.stance=entering;p.deckYawOffset=deck;
    for(let f=0;f<50;f++)p.step(1/60,makeInput(),flat);
    p.group.updateMatrixWorld(true);
    let priorBoard=yaw(p.boardG),priorBody=yaw(p.bodyGroup),boardTurn=0,bodyTurn=0,active=false,sign=entering,air=false,arm=false,kneeRise=0;const trace=[];
    const bend=()=>Math.max(...['left','right'].map(side=>at(`knee-${side}`).sub(at(`hip-${side}`)).angleTo(at(`ankle-${side}`).sub(at(`knee-${side}`)))));
    const idleBend=bend();
    for(let f=0;f<165;f++){
      const input=makeInput(),start=f===15||f===95;
      if(start){p.revertT=.3;input.transferPressed=true;sign=p.stance;boardTurn=bodyTurn=0;active=true;air=arm=false;}
      // A fresh eligibility window during the active pose cannot stack a turn.
      if(f===20)p.revertT=.3;if(f>=20&&f<=30)input.transferPressed=true;
      const wasStance=p.stance;p.step(1/60,input,flat);frames++;p.group.updateMatrixWorld(true);
      assert.equal(p.isBailing,false);assert.equal(p.stance,start?-wasStance:wasStance,'revert must switch exactly once per input');
      const nextBoard=yaw(p.boardG),nextBody=yaw(p.bodyGroup),db=delta(nextBoard,priorBoard),dr=delta(nextBody,priorBody);
      priorBoard=nextBoard;priorBody=nextBody;maxTurnStep=Math.max(maxTurnStep,Math.abs(db),Math.abs(dr));
      if(active){
        boardTurn+=db;bodyTurn+=dr;clearance();
        maxFoot=Math.max(maxFoot,p.boardG.userData.skateContact.footError);maxKnee=Math.max(maxKnee,bend());
        const lift=p.boardG.getWorldPosition(v()).y-p.pos.y;maxHop=Math.max(maxHop,lift);
        const motion=p.boardG.userData.skateRevert;
        if(lift>.12){air=true;kneeRise=Math.max(kneeRise,bend()-idleBend);}
        if(motion?.reach>.95){
          const side=sign>0?'left':'right';assert.equal(motion.hand,`socket-grip-${side}`);
          const shoulder=at(`shoulder-${side}`),elbow=at(`elbow-${side}`),wrist=at(`wrist-${side}`);
          const reach=shoulder.distanceTo(wrist)/(shoulder.distanceTo(elbow)+elbow.distanceTo(wrist));maxArmReach=Math.max(maxArmReach,reach);
          const fingers=v(0,-1,0).transformDirection(p.riderG.getObjectByName(`socket-grip-${side}`).matrixWorld);
          const alignment=fingers.dot(wrist.clone().sub(elbow).normalize());minWristAlignment=Math.min(minWristAlignment,alignment);
          assert.ok(alignment>Math.cos(Math.PI/12),'balancing hand droops away from the forearm');
          if(reach>.82&&wrist.y>shoulder.y-.06)arm=true;
          trace.push({time:p.revertPoseT,reach,wristHeight:wrist.y-shoulder.y,knee:bend(),bodyFlex:p.boardG.userData.skateContact.bodyFlex});
        }
        if(p.revertPoseT<=0){
          assert.ok(Math.abs(boardTurn+sign*Math.PI)<.002,`board rotated ${boardTurn*180/Math.PI} degrees`);
          assert.ok(Math.abs(bodyTurn+sign*Math.PI)<.002,`body rotated ${bodyTurn*180/Math.PI} degrees`);
          assert.ok(air&&arm&&kneeRise>.04,`missing hop, balancing reach or knee flex: ${JSON.stringify({air,arm,kneeRise,idleBend,trace})}`);
          active=false;reverts++;
        }
      }
    }
    assert.equal(p.stance,entering,'two separate reverts must restore the initial stance');
  }
  // Eligibility comes from an actual vert landing in gameplay.
  p.respawn(park,true,true,{position:v(0,.1,10),heading:v(0,0,1)});runtime.restart();p.axisF.set(0,0,1);p.axisL.set(1,0,0);p.freeSkate=true;p.speed=15.3;
  p.groundHit=p.queryGround(park);p.rideNormal.copy(p.groundHit.normal);
  let launched=false,landed=false;
  for(let f=0;f<260;f++){step(makeInput({jumpHeld:true}));if(p.vertAir)launched=true;if(launched&&p.grounded){landed=true;break;}}
  assert.ok(landed&&p.revertT>0);const previous=p.stance;step(makeInput({transferPressed:true}));assert.equal(p.stance,-previous);assert.ok(p.revertPoseT>0);
  for(let f=0;f<50;f++)step(makeInput());assert.equal(p.isBailing,false);assert.equal(p.revertPoseT,0);
  runtime.dispose();flat.dispose();
  console.log({frames,reverts,vertices,maxHop,maxKneeDegrees:maxKnee*180/Math.PI,maxFoot,minClearance,maxTurnStepDegrees:maxTurnStep*180/Math.PI,maxArmReach,maxWristBendDegrees:Math.acos(minWristAlignment)*180/Math.PI});
  assert.equal(reverts,16);assert.ok(maxTurnStep<.35&&maxKnee<1.25&&maxFoot<.006);
  console.log('PASS native 180-degree reverts in both stances/deck orientations/headings: stance alternation, small hop/knee load, balancing arm, planted feet and shorts clearance.');
});
