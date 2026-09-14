import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,Level})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const {directStretchableBones}=await server.ssrLoadModule('/src/character/stretchableBone.ts');
  const level=new Level(new THREE.Scene(),{id:'hang-dark-review',name:'Hang and Darkslide',data:{v:1,name:'Hang and Darkslide',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),joint=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  let frames=0,maxGrip=0,maxDarkStep=0,minHeadGap=Infinity,maxTransitGrip=0,maxShaftGap=0;let maxDarkCase=null,maxGripCase=null;
  const issues=[];
  for(const under of [true,false])for(const stance of [-1,1])for(const direction of [-1,1]){
    const railY=under?4.5:.8,rail=new Rail([v(0,railY,70),v(0,railY,-70)],false);
    level.grindRails.length=level.rails.length=0;level.grindRails.push(rail);level.rails.push(rail);
    p.respawn(level,true,true,{position:v(0,0,0),heading:v(0,0,-direction)});runtime.restart();
    p.freeSkate=p.airFromSkate=true;p.skateMountT=-1;p.sidePose=p.deckPose=p.skatePose=1;p.stance=stance;
    p.state='ride';p.grounded=true;p.speed=12;p.balance=p.balanceVel=0;p.balanceBoostT=60;
    for(let f=0;f<60;f++){p.runTime=f/60;p.syncVisual(makeInput(),1/60);}
    p.state='air';p.grounded=false;p.pos.set(0,railY+.25,0);p.prevPos.copy(p.pos);p.vVel=-1;p.grindVel=12;p.regrindCd=0;p.underCoolT=0;
    p.axisF.set(0,0,-direction);p.axisL.set(-direction,0,0);p.visualYaw=Math.atan2(p.axisF.x,p.axisF.z)-Math.PI;
    if(!under)p.special.award(1200);
    let held=0,landed=false,previous=null,flicked=false,jumpedClear=false,caughtLate=false,shoesLifted=false,maxHipCross=0;const catchHeights=[];
    for(let f=0;f<=(under?432:252);f++){
      const input=makeInput();
      if(f===(under?0:2)){input.grindPressed=input.grindHeld=true;if(!under)input.moveX=1;}
      if(!under&&f===0)input.moveX=-1;
      if(under&&[36,132,231].includes(f))input.grabPressed=input.grabHeld=true;
      const load=under?312:126,release=under?318:138;
      input.jumpHeld=f>=load&&f<release;input.jumpPressed=f===load;input.jumpReleased=f===release;
      if(!under&&f>=139&&f<154)input.moveX=1;
      p.step(1/60,input,level);frames++;
      assert.equal(p.isBailing,false,`${under?'under':'dark'} route bailed at ${f}`);
      const s=p.boardG.userData.settings,origin=p.boardG.getWorldPosition(v());
      const boardDirection=p.boardG.localToWorld(v(0,0,1)).sub(origin).normalize();
      const boardUp=p.boardG.localToWorld(v(0,1,0)).sub(origin).normalize();
      if(under&&(p.boardG.userData.skateUnderRail?.handContact??0)>.999&&p.boardG.userData.skateUnderRail.handError>maxTransitGrip){maxTransitGrip=p.boardG.userData.skateUnderRail.handError;maxGripCase={stance,direction,f,progress:p.underK,phase:p.boardG.userData.skateUnderRail.phase};}
      if(under)for(const side of ['left','right'])for(const [anchor,end] of [['shoulder','elbow'],['elbow','wrist']]){
        const node=p.riderG.getObjectByName(`${anchor}-${side}`);
        for(const bone of directStretchableBones(node))maxShaftGap=Math.max(maxShaftGap,bone.distalSocket.getWorldPosition(v()).distanceTo(joint(`${end}-${side}`)));
      }
      if(under&&p.state==='grind'){
        const m=p.boardG.userData.skateUnderRail;
        if(f>36&&f<80&&m){
          if(m.boardTurn>.05&&m.boardTurn<.95&&m.bodyDrop>.002&&m.armReach>.02)flicked=true;
          if(m.footContact===0&&m.bodyDrop<.8)jumpedClear=true;
          if(m.handContact>.999)caughtLate=true;
          if(m.airFeet>.5)shoesLifted=true;
          maxHipCross=Math.max(maxHipCross,Math.abs(joint('hips').x),Math.abs(joint('hips').z-rail.pointAt(p.grindT).z));
        }
        if(f>=36&&f<=110)catchHeights.push({f,y:joint('hips').y});
        const box=new THREE.Box3().setFromObject(p.headM);
        const dx=Math.max(box.min.x,0,-box.max.x),dy=Math.max(box.min.y-railY,0,railY-box.max.y);
        if(Math.hypot(dx,dy)<.10)issues.push({kind:'head crosses rail',stance,direction,f,w:p.underK,box:[box.min.toArray(),box.max.toArray()]});
        if(p.underK>.999){
          held++;
          assert.ok(Math.abs(boardDirection.z)<.002,'under-rail board is not crosswise');
          minHeadGap=Math.min(minHeadGap,railY-.09-box.max.y);
          assert.ok(railY-.09-box.max.y>.04&&railY-.09-box.max.y<.14,`head/hair clearance ${railY-.09-box.max.y} at ${stance}/${direction}/${f}; ${JSON.stringify(p.boardG.userData.skateUnderRail)}`);
          const trucks=[s.frontTruckLocalZ,s.rearTruckLocalZ].map(z=>p.boardG.localToWorld(v(0,s.wheelRadius,z)));
          const palms=[joint('socket-grip-left'),joint('socket-grip-right')];
          const error=Math.min(Math.max(palms[0].distanceTo(trucks[0]),palms[1].distanceTo(trucks[1])),Math.max(palms[1].distanceTo(trucks[0]),palms[0].distanceTo(trucks[1])));
          maxGrip=Math.max(maxGrip,error);assert.ok(error<.006,`both truck grips must stay planted: ${error}`);
          for(const side of ['left','right'])for(const part of ['upper','lower'])assert.ok(p.playerAnimationBridge.deformationValue(`deform.arm.${part}.${side}.length`)>2.5&&p.playerAnimationBridge.deformationValue(`deform.arm.${part}.${side}.length`)<3.2,'under-rail arms need visibly elongated shafts');
        }
      }
      if(!under&&p.state==='grind'&&f>20){
        held++;assert.ok(boardUp.y<-.999,'Darkslide griptape must face the rail');
        const feet=['left','right'].map(side=>joint('socket-foot-'+side));
        const width=Math.abs(p.boardG.worldToLocal(feet[0].clone()).z-p.boardG.worldToLocal(feet[1].clone()).z);
        assert.ok(width<.85,'Darkslide stance is too wide');
        assert.ok(joint('hips').y>Math.max(joint('knee-left').y,joint('knee-right').y)+.15,'Darkslide groin is below the knees');
        assert.ok(joint('hips').y-(feet[0].y+feet[1].y)/2>.7,'Darkslide collapsed into a deep squat');
        assert.ok(p.boardG.userData.skateContact.footError<.006,'Darkslide feet detached');
      }
      if(!under){
        const current=joint('hips').sub(p.pos);
        if(previous&&current.distanceTo(previous)>maxDarkStep){maxDarkStep=current.distanceTo(previous);maxDarkCase={stance,direction,f,state:p.state,delta:current.clone().sub(previous).toArray()};}
        previous=current;
      }
      if(f>release&&p.grounded)landed=true;
    }
    assert.ok(held>20&&landed,'the complete entry/hold/exit/landing was not reviewed');
    if(under){
      assert.ok(flicked&&jumpedClear&&caughtLate&&shoesLifted,'turn, vertical drop and reach must overlap');
      const rest=catchHeights.at(-1).y,low=catchHeights.reduce((a,b)=>b.y<a.y?b:a);
      const rebound=Math.max(...catchHeights.filter(s=>s.f>low.f&&s.f<85).map(s=>s.y))-rest;
      assert.ok(low.y-rest<-.08&&rebound>.005,`catch needs visible dip/rebound: ${low.y-rest}/${rebound}`);
      assert.ok(maxHipCross<.025,'hips must drop vertically without an out-and-back detour');
    }
  }
  runtime.dispose();level.dispose();
  console.log(JSON.stringify({frames,maxGrip,maxTransitGrip,maxShaftGap,minHeadGap,maxGripCase,maxDarkStep,maxDarkCase,transitionIssues:issues.slice(0,8)}));
  assert.equal(issues.length,0,'head must clear the rail while the hips travel vertically');
  assert.ok(maxTransitGrip<.006,'truck grips must remain planted through the swing');
  assert.ok(maxShaftGap<.002,'visible arm shafts must reach their actual elbow/wrist endpoints');
  assert.ok(maxDarkStep<.24,'Darkslide pelvis snaps during entry or exit');
  console.log('PASS under-rail crosswise board, two truck grips, extended arms/head clearance, and upright narrow Darkslide through native inputs in both stances/directions.');
});
