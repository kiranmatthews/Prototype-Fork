import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,level,step})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),point=v(),matrix=new THREE.Matrix4();
  const walls=[[[0,.1,10],[0,0,1]],[[28,.1,-90],[0,0,-1]],[[28,.1,-42],[1,0,0]],[[-28,.1,-70],[-1,0,0]]];
  const shoes=['left','right'].flatMap(side=>['shoe','sole','shoe-foxing'].map(part=>p.riderG.getObjectByName(`${part}-${side}`)));
  const heads=[];p.headM.traverse(n=>{if(!n.isMesh)return;for(let q=n;q&&q!==p.headM.parent;q=q.parent)if(!q.visible)return;heads.push(n);});
  let cases=0,frames=0,vertices=0,heldFrames=0,minShorts=Infinity,minShoe=Infinity,minHead=Infinity,minHip=Infinity,minWaist=Infinity,maxKnee=0,maxFoot=0,maxHand=0,maxSpineStep=0,maxWaistStep=0;const errors=[];
  const fail=e=>{if(errors.length<8&&!errors.some(old=>old.kind===e.kind))errors.push(e);};
  for(const stance of (process.env.NOSEGRAB_DEBUG?[Number(process.env.NOSEGRAB_DEBUG)]:[-1,1]))for(const deck of (process.env.NOSEGRAB_REVERSED?[Math.PI]:process.env.NOSEGRAB_DEBUG?[0]:[0,Math.PI]))for(const [position,heading] of (process.env.NOSEGRAB_DEBUG?walls.slice(0,1):walls)){
    cases++;p.respawn(level,true,true,{position:v(...position),heading:v(...heading)});runtime.restart();
    p.axisF.set(...heading);p.axisL.set(heading[2],0,-heading[0]);p.freeSkate=true;p.speed=15.3;p.stance=stance;p.deckYawOffset=deck;
    p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);
    for(let f=0;f<260&&!p.vertAir;f++)step(makeInput({jumpHeld:true}));assert.ok(p.vertAir);
    let started=false,held=0,released=false,prior=p.riderG.getObjectByName('spine').quaternion.clone(),priorWaist=p.riderG.getObjectByName('torso-root').quaternion.clone();
    for(let f=0;f<150;f++){
      const input=makeInput({jumpHeld:true,grabHeld:f>=2&&f<32,grabPressed:f===2,moveY:f===2?1:0});
      step(input);frames++;p.group.updateMatrixWorld(true);assert.equal(p.isBailing,false,'Nosegrab bailed');
      const contact=p.boardG.userData.skateGrab,s=p.boardG.userData.settings,k=s.overallScale;
      const boardUp=v(0,1,0).transformDirection(p.boardG.matrixWorld);
      if(contact){
        started=true;assert.equal(contact.kind,'nose');assert.equal(p.stance,stance);
        const feet=at('socket-foot-left').add(at('socket-foot-right')).multiplyScalar(.5);
        const hip=at('hips').sub(feet).dot(boardUp);minHip=Math.min(minHip,hip);
        const knees=['left','right'].map(side=>at(`knee-${side}`).sub(at(`hip-${side}`)).angleTo(at(`ankle-${side}`).sub(at(`knee-${side}`))));maxKnee=Math.max(maxKnee,...knees);
        const spine=p.riderG.getObjectByName('spine');maxSpineStep=Math.max(maxSpineStep,prior.angleTo(spine.quaternion));prior.copy(spine.quaternion);
        const waistNode=p.riderG.getObjectByName('torso-root');maxWaistStep=Math.max(maxWaistStep,priorWaist.angleTo(waistNode.quaternion));priorWaist.copy(waistNode.quaternion);
        if(p.grabPose>.95){
          held++;heldFrames++;const side=stance*(deck?-1:1)>0?'right':'left';assert.equal(contact.hand,`socket-grip-${side}`);
          const handError=at(contact.hand).distanceTo(v(...contact.target));maxHand=Math.max(maxHand,handError);
          if(handError>.006)fail({kind:'grip',stance,deck,f,handError});
          const palm=p.boardG.worldToLocal(at(contact.hand));if(!(palm.z>s.deckNoseLength*k*.9&&Math.abs(palm.x)<.05))fail({kind:'edge',f,palm:palm.toArray()});
          const nose=v(0,0,1).transformDirection(p.boardG.matrixWorld);
          const forwardReach=at(`wrist-${side}`).sub(at(`shoulder-${side}`)).dot(nose);if(forwardReach<.10)fail({kind:'forward arm',stance,deck,f,forwardReach});
          const seat=at('hips').sub(feet).dot(nose);if(seat>-.10)fail({kind:'seat',stance,deck,f,seat});
          const shoulders=at('shoulder-left').add(at('shoulder-right')).multiplyScalar(.5);
          const waist=shoulders.sub(at('spine')).angleTo(boardUp);minWaist=Math.min(minWaist,waist);
          if(hip<.55||Math.max(...knees)>1.45||waist<.60||waist>1.90)fail({kind:'posture',stance,deck,f,hip,knees,waist});
        }
      }else if(started)released=true;
      if(started){
        const footError=p.boardG.userData.skateContact.footError;maxFoot=Math.max(maxFoot,footError);if(footError>.006)fail({kind:'foot',stance,deck,f,footError});
        for(const mesh of [shorts,...(contact?[...shoes,...heads]:[])]){
          matrix.copy(p.boardG.matrixWorld).invert().multiply(mesh.matrixWorld);
          for(let i=0;i<mesh.geometry.attributes.position.count;i++){
            mesh.getVertexPosition(i,point).applyMatrix4(matrix);vertices++;
            if(Math.abs(point.x)>s.deckHalfWidth*k*.95||point.z< -s.deckTailLength*k*.95||point.z>s.deckNoseLength*k*.95)continue;
            const gap=point.y-(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
            if(mesh===shorts)minShorts=Math.min(minShorts,gap);else if(heads.includes(mesh))minHead=Math.min(minHead,gap);else minShoe=Math.min(minShoe,gap);
            if(gap<(mesh===shorts?.02:-.001))fail({kind:mesh.name,stance,deck,f,gap});
          }
        }
      }
      if(started&&p.grounded)break;
    }
    assert.ok(started&&held>8&&released&&p.grounded,'missing grab entry/hold/release/landing');assert.equal(p.comboMult,1);assert.ok(p.comboPoints>=300);
  }
  runtime.dispose();console.log({cases,frames,vertices,heldFrames,minShorts,minShoe,minHead,minHip,minWaistDegrees:minWaist*180/Math.PI,maxKneeDegrees:maxKnee*180/Math.PI,maxFoot,maxHand,maxSpineStepDegrees:maxSpineStep*180/Math.PI,maxWaistStepDegrees:maxWaistStep*180/Math.PI,errors});assert.deepEqual(errors,[]);assert.ok(maxWaistStep<.5,'waist fold snaps');
  console.log('PASS native Nosegrab forward reach, seated hips, front-end grip, planted feet, clearance and clean release/landing.');
});
