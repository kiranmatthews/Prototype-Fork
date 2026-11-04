import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=process.argv[2];
const entry={id:'travel-test',name:'Board travel',data:{v:1,name:'Board travel',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}};
await withSkateRuntime(async({server,THREE,Player,level,player:p,TUNING})=>{
  const {JAK_DIRECT_PHYSICS,createJakDirectSuite}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {SkateTravelMotion}=await server.ssrLoadModule('/src/skateTravelMotion.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=a.createPlayerStarterAnimationSuite(binding.definition);
  const runtime=createCharacterAnimationRuntime(p,bank?createJakDirectSuite(suite,binding.definition,JSON.parse(await readFile(bank,'utf8'))):suite);
  const control=new Player(level.scene);control.competitionMode=control.endlessDeaths=true;
  p.onFootJumpStudy=JAK_DIRECT_PHYSICS;
  const samples=[],errors=[];let frames=0;
  const scenarios=['mount-stop','cancel','early-ollie','remount','carve','standing'];
  try{
    for(const stance of [-1,1])for(const scenario of scenarios.filter(name=>!process.env.SKATE_TRAVEL_CASE||name===process.env.SKATE_TRAVEL_CASE)){
      for(const rider of [p,control]){rider.enterLevel('travel-test');rider.respawn(level,true);rider.freeSkate=false;rider.stance=stance;}
      runtime.restart();
      let prev=null,prevQ=null,previousYaw=0,maxStep=0,maxAngle=0,maxHand=0,maxFeet=0,maxPushFeet=0,maxLean=0;
      const phases=new Set();let pushGround=0,visibleFrames=0,remountStart=-1,interruptedExit=false;
      for(let frame=0;frame<530;frame++){
        const previous=p.boardG.userData.skateTravel;
        if(scenario==='remount'&&remountStart<0&&previous?.exiting)remountStart=frame;
        const release=scenario==='cancel'?48:scenario==='early-ollie'?66:220;
        const brake=frame>=260&&frame<350&&remountStart<0;
        const remount=remountStart>=0&&frame<remountStart+100;
        const input=makeInput({moveX:scenario==='carve'&&frame>=130&&frame<200?.65:0,
          moveY:scenario==='standing'&&frame<30?0:brake?-1:frame<260||remount?1:0,
          jumpHeld:frame>=30&&frame<release||remount,jumpPressed:frame===30||frame===remountStart,
          jumpReleased:frame===release||frame===remountStart+100&&remountStart>=0,grabHeld:brake,grabPressed:frame===260});
        p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);frames++;
        // This is a visual study, so all live tuning and controller outcomes
        // must remain identical to the original non-study skater.
        assert.ok(p.pos.distanceTo(control.pos)<1e-8,`${scenario} ${frame}: movement changed`);
        for(const key of ['speed','vVel','grounded','state','freeSkate'])assert.equal(p[key],control[key],`${scenario} ${frame}: ${key}`);
        const board=p.boardG,pose=board.userData.skateTravel;
        if(previous?.exiting&&pose?.transfer&&!pose.exiting)interruptedExit=true;
        if(process.env.SKATE_TRAVEL_DEBUG&&[48,66,285].includes(frame))console.log(JSON.stringify({scenario,stance,frame,
          pos:p.pos.toArray(),board:board.getWorldPosition(new THREE.Vector3()).toArray(),
          pose,hand:board.userData.skateCarryHandError,feet:board.userData.skateTransferFootError,
          joints:Object.fromEntries(['shoulder-left','elbow-left','wrist-left','socket-grip-left','shoulder-right','elbow-right','wrist-right','socket-grip-right'].map(n=>[n,p.riderG.getObjectByName(n).getWorldPosition(new THREE.Vector3()).toArray()]))}));
        if(!pose)continue;
        phases.add(pose.phase);visibleFrames+=board.visible?1:0;
        assert.ok(board.visible,`${scenario} ${frame}: board disappeared`);
        assert.deepEqual(p.riderG.scale.toArray(),[1,1,1],'whole-rider scaling');
        const position=board.getWorldPosition(new THREE.Vector3()).sub(p.pos);
        const q=board.getWorldQuaternion(new THREE.Quaternion());
        const step=prev?position.distanceTo(prev):0,angle=prevQ?q.angleTo(prevQ):0;
        maxStep=Math.max(maxStep,step);maxAngle=Math.max(maxAngle,angle);prev=position;prevQ=q;
        // A stowed board follows the existing running/turning body. Measure
        // that attachment in the hip frame, not against the physics capsule.
        if(pose.phase==='carry'&&pose.route===0){
          const hips=p.riderG.getObjectByName('hips'),s=board.userData.settings;
          const centerY=(s.boardToGroundDistance-s.deckThickness*.5)*s.overallScale;
          const offset=board.localToWorld(new THREE.Vector3(0,centerY,0)).sub(hips.getWorldPosition(new THREE.Vector3()))
            .applyQuaternion(hips.getWorldQuaternion(new THREE.Quaternion()).normalize().invert());
          const carryError=offset.distanceTo(new THREE.Vector3(0,.48,-.42));
          if(carryError>.002)errors.push({scenario,stance,frame,phase:pose.phase,problem:'carry',carryError,offset:offset.toArray()});
        }else if(step>.4||angle>.65)errors.push({scenario,stance,frame,phase:pose.phase,problem:'continuity',step,angle,
          route:pose.route,previousRoute:previous?.route,yaw:p.visualYaw,previousYaw});
        previousYaw=p.visualYaw;
        const hand=board.userData.skateCarryHandError??0,feet=board.userData.skateTransferFootError??0;
        if(pose.grip>.999){maxHand=Math.max(maxHand,hand);if(hand>.02)errors.push({scenario,stance,frame,phase:pose.phase,problem:'hand',hand,
          contact:board.userData.skateCarryContact,
          joints:Object.fromEntries(['shoulder','elbow','wrist'].map(n=>[n,p.riderG.getObjectByName(`${n}-${p.stance>0?'right':'left'}`).getWorldPosition(new THREE.Vector3()).toArray()]))});}
        maxFeet=Math.max(maxFeet,feet);
        if(feet>.02)errors.push({scenario,stance,frame,phase:pose.phase,problem:'transfer feet',feet});
        const push=board.userData.skatePushContact;
        if(push){
          const hipHeight=p.riderG.getObjectByName('hips').getWorldPosition(new THREE.Vector3()).y-p.pos.y;
          if(hipHeight<.55)errors.push({scenario,stance,frame,phase:pose.phase,problem:'push collapsed',hipHeight});
          const foot=p.riderG.getObjectByName(push.foot).getWorldPosition(new THREE.Vector3());
          const error=foot.distanceTo(new THREE.Vector3(...push.target));maxPushFeet=Math.max(maxPushFeet,error);
          if(error>.01)errors.push({scenario,stance,frame,phase:pose.phase,problem:'push contact',error});
          if(push.grounded)pushGround++;
        }
        maxLean=Math.max(maxLean,Math.abs(pose.steer));
      }
      samples.push({scenario,stance,phases:[...phases],visibleFrames,maxStep,maxAngle,maxHand,maxFeet,maxPushFeet,pushGround,maxLean,interruptedExit});
      if(scenario==='cancel')assert.ok(phases.has('cancel')&&!phases.has('hop'),'cancel committed a mount');
      if(scenario==='mount-stop'||scenario==='standing')for(const phase of ['prepare','place','hop','catch','push','step-off','pickup','stow','carry'])assert.ok(phases.has(phase),`missing ${scenario} ${phase}`);
      if(scenario==='carve')assert.ok(maxLean>.2,'turning never affected balance');
      if(scenario==='remount')assert.ok(interruptedExit,'remount did not exercise an interrupted pickup');
    }
    // Absolute timelines and finite settles at multiple presentation rates.
    for(const fps of [30,60,120])for(const reverseAt of [0,.15,.4,.7]){
      const motion=new SkateTravelMotion();let pose,previous;
      for(let i=0;i<fps*7;i++){
        const time=i/fps;
        pose=motion.step(1/fps,{enabled:true,available:true,eligible:true,grounded:true,
          mounted:time>=1&&time<3||reverseAt>0&&time>=3+reverseAt&&time<5,
          preparing:time<1,holdProgress:time,charging:time<2,braking:time>2.8&&time<3,
          speed:8,topSpeed:20,heading:time>1&&time<2?.8*time:1.6,time});
        assert.ok(Object.values(pose.deformations).every(v=>Number.isFinite(v)&&v>.5&&v<1.8));
        if(previous){
          assert.ok(Math.abs(pose.route-previous.route)<12/fps,'board route snapped at a reversal');
          assert.ok(Math.abs(pose.grip-previous.grip)<20/fps,'grip snapped at a reversal');
        }
        previous=pose;
      }
      assert.equal(pose.phase,'carry');assert.equal(pose.route,0);assert.equal(pose.stance,0);
    }
    console.log(JSON.stringify({frames,samples,errors:errors.slice(0,25),errorCount:errors.length},null,2));
    if(process.env.SKATE_TRAVEL_REPORT)await writeFile(process.env.SKATE_TRAVEL_REPORT,JSON.stringify({frames,samples,errors},null,2));
    assert.equal(errors.length,0,'Board/hand/foot continuity failures; see measurements above');
    console.log('PASS complete board path, cancellation, remount, foot push, turning, frame rates and unchanged tuning/physics');
  }finally{runtime.dispose();}
},{levelEntry:entry});
