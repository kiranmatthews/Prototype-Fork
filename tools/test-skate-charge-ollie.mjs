import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({server,THREE,Level,Player})=>{
  const {SkateBodySpring,skateBodyFlexTarget}=await server.ssrLoadModule('/src/skateBodyMotion.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const rest={grounded:true,charge:0,verticalVelocity:0,launchVelocity:10,contactBounce:0,mount:0};
  const loaded={...rest,charge:1};
  const at=seconds=>({...rest,grounded:false,verticalVelocity:10-seconds*20});
  assert.ok(skateBodyFlexTarget(loaded)>skateBodyFlexTarget(rest));
  assert.ok(skateBodyFlexTarget(at(0))<skateBodyFlexTarget(loaded),'release should extend out of load');
  assert.ok(skateBodyFlexTarget(at(.5))>skateBodyFlexTarget(at(0)),'knees should gather at apex');
  assert.ok(skateBodyFlexTarget(at(1))<skateBodyFlexTarget(at(.5)),'fall should relax into the catch');
  const samples=[];
  for(const fps of [30,60,120]){
    const spring=new SkateBodySpring();
    for(let i=0;i<fps/2;i++)spring.step(1/fps,loaded);
    samples.push(spring.value);
    for(let i=0;i<fps;i++){
      const before=spring.value;spring.step(1/fps,at(i/fps));
      assert.ok(Number.isFinite(spring.value)&&spring.value>=.62&&spring.value<=1.24);
      assert.ok(Math.abs(spring.value-before)<7/fps,`spring snapped at ${fps} fps: ${spring.value-before}`);
    }
  }
  assert.ok(Math.max(...samples)-Math.min(...samples)<1e-10,'constant-target spring depends on frame rate');
  const level=new Level(new THREE.Scene(),{id:'ollie-test',name:'Ollie test',data:{v:1,name:'Ollie test',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const p=new Player(level.scene),control=new Player(level.scene);
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(binding.definition));
  const joint=n=>p.riderG.getObjectByName(n).getWorldPosition(new THREE.Vector3());
  const knee=side=>joint('knee-'+side).sub(joint('hip-'+side)).angleTo(joint('ankle-'+side).sub(joint('knee-'+side)));
  let total=0,maxFoot=0,maxKnee=0,maxHeightStep=0;const poseErrors=[];
  try{
    for(const park of [false,true])for(const stance of [-1,1])for(const hold of [3,55]){
      level.skatepark=park;
      for(const rider of [p,control]){
        rider.enterLevel('ollie-test');rider.respawn(level,true);
        rider.parkControls=park;rider.freeSkate=true;rider.speed=12;rider.parkVelocity.set(0,0,-12);
        rider.sidePose=rider.deckPose=rider.skatePose=1;rider.stance=stance;rider.skateMountT=-1;
      }
      runtime.restart();
      let air=false,landed=false,releaseFlex=0,extension=Infinity,apex=0,landAge=0,previousHeight=null;
      for(let frame=0;frame<240;frame++){
        const input=makeInput({moveY:1,jumpHeld:frame>=60&&frame<60+hold,jumpPressed:frame===60,jumpReleased:frame===60+hold});
        p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);total++;
        assert.ok(p.pos.distanceTo(control.pos)<1e-9,'authored animation changed the controller position');
        for(const key of ['speed','vVel','grounded','state','freeSkate','airFromSkate'])assert.equal(p[key],control[key],`controller ${key} changed`);
        assert.equal(p.animationClipHint,'player.skate','board air escaped into an on-foot animation');
        assert.equal(runtime.activeClipId,null,'board pose received an authored on-foot overlay');
        assert.equal(runtime.diagnostics.landingOneShotActive,false,'board landing got a second bounce layer');
        const c=p.boardG.userData.skateContact;
        const poseInfo={park,stance,hold,frame,error:c?.footError,flex:c?.bodyFlex,height:c?.bodyHeight,knees:[knee('left'),knee('right')],vVel:p.vVel};
        if(!c||c.footError>=.006)poseErrors.push({problem:'feet',...poseInfo});
        maxFoot=Math.max(maxFoot,c.footError);maxKnee=Math.max(maxKnee,knee('left'),knee('right'));
        if(frame>5&&previousHeight!==null){
          maxHeightStep=Math.max(maxHeightStep,Math.abs(c.bodyHeight-previousHeight));
          if(Math.abs(c.bodyHeight-previousHeight)>=.045)poseErrors.push({problem:'height step',step:c.bodyHeight-previousHeight,...poseInfo});
        }
        previousHeight=c.bodyHeight;
        // The leading knee lifts with the nose, while the trailing leg opens.
        // That useful asymmetry is not the old two-legged deep squat.
        if(Math.max(...poseInfo.knees)>=1.5||(poseInfo.knees[0]+poseInfo.knees[1])/2>=1.15)poseErrors.push({problem:'knee bend',...poseInfo});
        if(frame===59+hold)releaseFlex=c.bodyFlex;
        if(!p.grounded){
          air=true;
          if(p.vVel>p.launchVy*.4)extension=Math.min(extension,c.bodyFlex);
          if(Math.abs(p.vVel)<2)apex=Math.max(apex,c.bodyFlex);
        }else if(air){landed=true;landAge++;}
        if(landAge>45){assert.ok(c.bodyFlex<.7,'landing bounce never returned to relaxed ride');break;}
      }
      assert.ok(air&&landed&&landAge>45,'real charged ollie did not take off and settle');
      if(hold===55)assert.ok(extension<releaseFlex-.2,'held charge did not spring open at takeoff');
      assert.ok(apex>extension+.08,'airborne extension never gathered at the apex');
    }
    console.log(`Tap/full ollie in campaign/park, both stances; ${total} controller frames with exact motion parity; max knee ${(maxKnee*180/Math.PI).toFixed(1)}°, sole ${(maxFoot*1000).toFixed(2)} mm, pelvis step ${(maxHeightStep*1000).toFixed(2)} mm; spring 30/60/120 fps.`);
    assert.equal(poseErrors.length,0,`pose continuity/contact failures: ${JSON.stringify(poseErrors.slice(0,8))}`);
    console.log('PASS spring, contact, charge/air/landing ownership and unchanged movement');
  }finally{runtime.dispose();level.dispose();}
});
