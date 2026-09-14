import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({player:p,server,THREE,level})=>{
  const {SkateBalanceArms}=await server.ssrLoadModule('/src/skateBodyMotion.ts');
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const motion=new SkateBalanceArms();let previous=0,maxSwingStep=0,peak=0;
  for(let f=0;f<480;f++){
    const sample=motion.step(1/60,f<300,.90+.09*Math.sin(f*.19),f%16<8);
    maxSwingStep=Math.max(maxSwingStep,Math.abs(sample.swing-previous));peak=Math.max(peak,Math.abs(sample.swing));previous=sample.swing;
    assert.ok(Math.abs(sample.swing)<.28);
  }
  assert.ok(peak>.15,'danger still needs readable arm corrections');assert.ok(maxSwingStep<.05,'critical toggles create a flail spike');assert.ok(Math.abs(previous)<1e-7,'arm correction did not settle after exit');
  const rail=new Rail([new THREE.Vector3(0,5,1000),new THREE.Vector3(0,5,-1000)],false),results=[];
  const joints=['shoulder-left','shoulder-right','elbow-left','elbow-right'].map(n=>p.riderG.getObjectByName(n));
  for(const stance of [-1,1])for(const clock of [0,600]){
    p.respawn(level,true);runtime.restart();p.state='grind';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.stance=stance;
    p.grindRail=rail;p.grindT=1000;p.grindDir=1;p.grindStyle='normal';p.grindVel=p.speed=8;
    p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.visualYaw=0;p.skateMountT=-1;p.sidePose=p.deckPose=p.skatePose=1;
    let last=null,maxStep=0;
    for(let f=0;f<360;f++){
      p.runTime=clock+f/60;p.balance=.9+.09*Math.sin(f*.19);p.balanceCritT=f%16<8?.1:0;
      p.syncVisual(makeInput(),1/60);p.group.updateMatrixWorld(true);
      const current=joints.map(n=>n.quaternion.clone());
      if(f>120&&last)for(let j=0;j<current.length;j++)maxStep=Math.max(maxStep,last[j].angleTo(current[j]));
      last=current;
    }
    assert.ok(maxStep<.10,`native balance arms vibrate: ${maxStep*180/Math.PI} degrees/frame at ${clock}s`);results.push({stance,clock,maxStepDegrees:maxStep*180/Math.PI});
  }
  let mappings=0;
  for(const stance of [-1,1])for(const deckYaw of [0,Math.PI])for(const direction of [-1,1])for(const [inputY,style] of [[1,'nose'],[-1,'five0']]){
    p.respawn(level,true);runtime.restart();p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.stance=stance;p.deckYawOffset=deckYaw;
    p.pos.copy(rail.pointAt(1000)).add(new THREE.Vector3(0,.25,0));p.prevPos.copy(p.pos);p.axisF.set(0,0,-direction);p.axisL.set(-direction,0,0);p.speed=8;
    p.rawInput=makeInput({moveY:inputY,grindHeld:true,grindPressed:true});
    p.enterGrind(rail,{point:rail.pointAt(1000),tangent:rail.tangentAt(1000),t:1000},level);
    assert.equal(p.grindStyle,style,'vertical grind input chose the opposite name');
    for(let f=0;f<90;f++){p.runTime+=1/60;p.syncVisual(makeInput(),1/60);}p.group.updateMatrixWorld(true);
    const settings=p.boardG.userData.settings,k=settings.overallScale,h=(settings.wheelRadius-settings.truckHangerRadius)*k;
    const front=p.boardG.localToWorld(new THREE.Vector3(0,h,settings.frontTruckLocalZ*k));
    const rear=p.boardG.localToWorld(new THREE.Vector3(0,h,settings.rearTruckLocalZ*k));
    const supported=style==='nose'?front:rear,raised=style==='nose'?rear:front;
    assert.ok(Math.abs(supported.y-5.09)<.002,`${style} is not on its named truck`);assert.ok(raised.y-supported.y>.15,`${style} raises the wrong end`);mappings++;
  }
  console.log('PASS',mappings,'normal/fakie and both-direction input/contact mappings: UP Nosegrind/front truck, DOWN 5-0/rear truck.');
  runtime.dispose();console.log({maxSwingStep,peak,results});console.log('PASS bounded, phase-continuous balance arms at early/late run clocks, critical toggles and settled exit.');
});
