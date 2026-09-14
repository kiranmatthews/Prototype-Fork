import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

export async function checkGrabDefinition(kind=process.env.GRAB_KIND??'method'){
const directions={melon:[-1,0],method:[-1,1],stalefish:[-1,-1],japan:[1,-1]};
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
  let cases=0,frames=0,vertices=0,heldFrames=0,minShorts=Infinity,minShoe=Infinity,minHead=Infinity,minHip=Infinity,minWaist=Infinity,maxKnee=0,maxFoot=0,maxHand=0,maxSpineStep=0,maxWaistStep=0,minPalmFacing=1,armHeadHits=0,legHeadHits=0,armShortsHits=0;const errors=[];
  const ray=new THREE.Raycaster();
  for(const mesh of heads)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.side=THREE.DoubleSide;
  const armHitsHead=(a,b,radius=.035,targets=heads)=>{
    const direction=b.clone().sub(a),length=direction.length();direction.normalize();
    const side=direction.clone().cross(v(0,1,0));if(side.lengthSq()<1e-8)side.set(1,0,0);side.normalize();
    for(const offset of [-radius,0,radius]){
      ray.set(a.clone().addScaledVector(side,offset),direction);ray.near=.035;ray.far=length-.015;
      if(ray.intersectObjects(targets,false).length)return true;
    }
    return false;
  };
  const fail=e=>{if(errors.length<8&&!errors.some(old=>old.kind===e.kind))errors.push(e);};
  for(const stance of (process.env.GRAB_DEBUG?[Number(process.env.GRAB_DEBUG)]:[-1,1]))for(const deck of (process.env.GRAB_REVERSED?[Math.PI]:process.env.GRAB_DEBUG?[0]:[0,Math.PI]))for(const [position,heading] of (process.env.GRAB_DEBUG?walls.slice(0,1):walls)){
    cases++;p.respawn(level,true,true,{position:v(...position),heading:v(...heading)});runtime.restart();
    p.axisF.set(...heading);p.axisL.set(heading[2],0,-heading[0]);p.freeSkate=true;p.speed=15.3;p.stance=stance;p.deckYawOffset=deck;
    p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);
    for(let f=0;f<260&&!p.vertAir;f++)step(makeInput({jumpHeld:true}));assert.ok(p.vertAir);
    let started=false,held=0,released=false,prior=p.riderG.getObjectByName('spine').quaternion.clone(),priorWaist=p.riderG.getObjectByName('torso-root').quaternion.clone();
    for(let f=0;f<150;f++){
      const input=makeInput({jumpHeld:true,grabHeld:f>=2&&f<32,grabPressed:f===2,moveX:f===2?directions[kind][0]:0,moveY:f===2?directions[kind][1]:0});
      step(input);frames++;p.group.updateMatrixWorld(true);assert.equal(p.isBailing,false,`${kind} bailed`);
      const contact=p.boardG.userData.skateGrab,s=p.boardG.userData.settings,k=s.overallScale;
      const boardUp=v(0,1,0).transformDirection(p.boardG.matrixWorld);
      if(contact){
        started=true;assert.equal(contact.kind,kind);assert.equal(p.stance,stance);
        const feet=at('socket-foot-left').add(at('socket-foot-right')).multiplyScalar(.5);
        const hip=at('hips').sub(feet).dot(boardUp);minHip=Math.min(minHip,hip);
        const knees=['left','right'].map(side=>at(`knee-${side}`).sub(at(`hip-${side}`)).angleTo(at(`ankle-${side}`).sub(at(`knee-${side}`))));maxKnee=Math.max(maxKnee,...knees);
        const spine=p.riderG.getObjectByName('spine');maxSpineStep=Math.max(maxSpineStep,prior.angleTo(spine.quaternion));prior.copy(spine.quaternion);
        const waistNode=p.riderG.getObjectByName('torso-root');maxWaistStep=Math.max(maxWaistStep,priorWaist.angleTo(waistNode.quaternion));priorWaist.copy(waistNode.quaternion);
        for(const limbSide of ['left','right']){
          if(armHitsHead(at(`hip-${limbSide}`),at(`knee-${limbSide}`),.05)||armHitsHead(at(`knee-${limbSide}`),at(`ankle-${limbSide}`),.05)){legHeadHits++;fail({kind:'leg/head',stance,deck,f,limbSide});}
            if(armHitsHead(at(`shoulder-${limbSide}`),at(`elbow-${limbSide}`))||armHitsHead(at(`elbow-${limbSide}`),at(`wrist-${limbSide}`))){armHeadHits++;fail({kind:'arm/head',stance,deck,f,limbSide});}
        }
        if(p.grabPose>.95){
          held++;heldFrames++;
          const leading=kind!=='stalefish';const side=(stance>0)===leading?'right':'left';assert.equal(contact.hand,`socket-grip-${side}`);
          const handError=at(contact.hand).distanceTo(v(...contact.target));maxHand=Math.max(maxHand,handError);
          if(handError>.006)fail({kind:'grip',stance,deck,f,handError});
          const palm=p.boardG.worldToLocal(at(contact.hand));if(!(palm.x*stance*(deck? -1:1)*(kind==='japan'?1:-1)>s.deckHalfWidth*k*.9&&Math.abs(palm.z)<.3))fail({kind:'edge',f,palm:palm.toArray()});
          for(const limbSide of ['left','right']){
            for(const part of ['upper','lower'])assert.ok(p.playerAnimationBridge.deformationValue(`deform.leg.${part}.${limbSide}.length`)>.90,`${kind} must retain leg length`);
          }
          const grip=p.riderG.getObjectByName(contact.hand);
          const palmNormal=v(0,0,-1).applyMatrix3(new THREE.Matrix3().getNormalMatrix(grip.matrixWorld)).normalize();
          const inward=v((kind==='japan'?-1:1)*stance*(deck?-1:1),0,0).transformDirection(p.boardG.matrixWorld);
          const palmFacing=palmNormal.dot(inward);minPalmFacing=Math.min(minPalmFacing,palmFacing);if(palmFacing<.80)fail({kind:'palm facing',stance,deck,f,palmFacing});
          const toe=v(0,0,1).transformDirection(p.bodyGroup.matrixWorld),up=v(0,1,0).transformDirection(p.group.matrixWorld);
          const hipPoint=at('hips'),shoulders=at('shoulder-left').add(at('shoulder-right')).multiplyScalar(.5);
          const seat=hipPoint.clone().sub(feet).dot(toe),waist=shoulders.clone().sub(at('spine')).angleTo(v(0,1,0).transformDirection(p.bodyGroup.matrixWorld));minWaist=Math.min(minWaist,waist);
          if(process.env.GRAB_DEBUG&&held===1)console.log('pose',kind,{hip,seat,waist,knees,boardRaise:feet.clone().sub(hipPoint).dot(up),arch:shoulders.clone().sub(at('spine')).normalize().dot(toe),elbowBack:p.boardG.worldToLocal(at(`elbow-${side}`)).z*(deck?-1:1),elbowHeel:p.boardG.worldToLocal(at(`elbow-${side}`)).x*stance*(deck?-1:1),backKneeHeel:p.boardG.worldToLocal(at(`knee-${stance>0?'left':'right'}`)).x*stance*(deck?-1:1),backAnkle:p.boardG.worldToLocal(at(`ankle-${stance>0?'left':'right'}`)).z*(deck?-1:1)});
          if(kind==='method'||kind==='japan'){
            if(seat<.25)fail({kind:'board not behind',f,seat});
            for(const side of ['left','right']){const knee=at(`knee-${side}`);if(at(`hip-${side}`).sub(knee).dot(up)<.10||knee.clone().sub(at(`ankle-${side}`)).dot(toe)<.10)fail({kind:'knees not down/forward',f,side});}
            if(kind==='method'&&waist>.60)fail({kind:'Method folds chest down instead of arching',f,waist});
          }else if(seat>-.08)fail({kind:'missing seated stance',f,seat});
          const upper=shoulders.clone().sub(at('spine')).normalize(),raise=feet.clone().sub(hipPoint).dot(up);
          if(kind==='method'&&(raise<.10||upper.dot(toe)>-.10))fail({kind:'missing Method arch and raised deck',f,raise,arch:upper.dot(toe)});
          if(kind==='japan'&&(raise<.01||upper.dot(toe)<.15))fail({kind:'missing Japan tucked shape',f,raise,fold:upper.dot(toe)});
          if(kind==='melon'&&(waist<.30||waist>1.0||shoulders.clone().sub(hipPoint).dot(up)<.20))fail({kind:'Melon torso is not seated over its knees',f,waist});
          if(kind==='stalefish'){
            const elbow=p.boardG.worldToLocal(at(`elbow-${side}`)),knee=p.boardG.worldToLocal(at(`knee-${stance>0?'left':'right'}`));
            const heelward=(elbow.x-knee.x)*stance*(deck?-1:1);if(heelward>-.10)fail({kind:'Stalefish arm fails to wrap behind rear knee',f,heelward});
          }
          for(const limbSide of ['left','right'])if(armHitsHead(at(`shoulder-${limbSide}`),at(`elbow-${limbSide}`),.035,[shorts])||armHitsHead(at(`elbow-${limbSide}`),at(`wrist-${limbSide}`),.035,[shorts])){armShortsHits++;fail({kind:'arm/shorts',stance,deck,f,limbSide});}
          if(hip<.20||Math.max(...knees)>2.85)fail({kind:'posture',stance,deck,f,hip,knees,waist});

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
  runtime.dispose();console.log({cases,frames,vertices,heldFrames,minShorts,minShoe,minHead,minHip,minWaistDegrees:minWaist*180/Math.PI,maxKneeDegrees:maxKnee*180/Math.PI,maxFoot,maxHand,maxSpineStepDegrees:maxSpineStep*180/Math.PI,maxWaistStepDegrees:maxWaistStep*180/Math.PI,minPalmFacing,armHeadHits,legHeadHits,armShortsHits,errors});assert.deepEqual(errors,[]);assert.ok(maxWaistStep<.5,'waist fold snaps');
  console.log('PASS native',kind,'definition, planted grip/feet, garment/head clearance and clean entry/release/landing.');
});

}
if(process.argv[1]?.endsWith('test-skate-grab-definitions.mjs')){for(const kind of (process.env.GRAB_KIND?[process.env.GRAB_KIND]:['melon','method','stalefish','japan']))await checkGrabDefinition(kind);}
