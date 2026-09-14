import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,Level})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const {directStretchableBones}=await server.ssrLoadModule('/src/character/stretchableBone.ts');
  const {withSkatePresentationRig}=await server.ssrLoadModule('/src/animation/skateCatalog.ts');
  const level=new Level(new THREE.Scene(),{id:'tornado-pose-test',name:'Tornado pose',data:{v:1,name:'Tornado pose',spawn:[0,2,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),joint=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface');
  const vertex=v(),toBoard=new THREE.Matrix4();
  let frames=0,vertices=0,minClearance=Infinity,maxFoot=0,maxHand=0,maxShaftGap=0,minHipHeight=Infinity,maxKnee=0,backLean=0;
  const errors=[];
  function checkShorts(context){
    p.group.updateMatrixWorld(true);
    const s=p.boardG.userData.settings,scale=s.overallScale;
    toBoard.copy(p.boardG.matrixWorld).invert().multiply(shorts.matrixWorld);
    for(let i=0;i<shorts.geometry.attributes.position.count;i++){
      shorts.getVertexPosition(i,vertex).applyMatrix4(toBoard);vertices++;
      if(Math.abs(vertex.x)>s.deckHalfWidth*scale||vertex.z< -s.deckTailLength*scale||vertex.z>s.deckNoseLength*scale)continue;
      const top=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,vertex.x/scale,vertex.z/scale))*scale;
      const gap=vertex.y-top;minClearance=Math.min(minClearance,gap);
      if(gap<.02&&errors.length<8)errors.push({...context,kind:'shorts/board',gap,vertex:vertex.toArray()});
    }
  }
  for(const stance of [-1,1])for(const heading of [v(0,0,-1),v(1,0,0)]){
    p.respawn(level,true,true,{position:v(0,2,0),heading});runtime.restart();
    p.freeSkate=p.airFromSkate=true;p.skateMountT=-1;p.sidePose=p.deckPose=p.skatePose=1;p.stance=stance;
    p.state='air';p.grounded=false;p.speed=12;p.vVel=p.launchVy=20;p.airMomentum=true;p.airGrav='vert';p.special.award(1200);
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.visualYaw=Math.atan2(heading.x,heading.z)-Math.PI;
    let started=false,completed=false,landed=false,held=0,landFrames=0;
    for(let f=0;f<260;f++){
      const input=makeInput();
      if(f===2)input.moveX=1;
      if(f===4){input.moveY=-1;input.grabPressed=input.grabHeld=true;}
      p.step(1/60,input,level);frames++;
      if(p.specialGrab?.id==='the-900'){started=true;assert.equal(p.specialGrab.label,'Tornado Twist');}
      if(p.specialGrabLanding&&!completed){completed=true;assert.ok(Math.abs(p.grabSpinAngle-p.specialGrabStartAngle-stance*5*Math.PI)<1e-7,'the move lost its 900-degree spin');}
      assert.equal(p.isBailing,false,`native special bailed at frame ${f}`);
      if(started&&p.grounded){landed=true;landFrames++;}
      if(started){
        checkShorts({source:'native',stance,f});
        maxFoot=Math.max(maxFoot,p.boardG.userData.skateContact?.footError??0);
        for(const side of ['left','right'])for(const [anchor,end] of [['shoulder','elbow'],['elbow','wrist']]){
          for(const bone of directStretchableBones(p.riderG.getObjectByName(`${anchor}-${side}`)))maxShaftGap=Math.max(maxShaftGap,bone.distalSocket.getWorldPosition(v()).distanceTo(joint(`${end}-${side}`)));
        }
      }
      if(p.specialGrab&&p.grabPose>.95){
        held++;
        const height=joint('hips').y-(joint('socket-foot-left').y+joint('socket-foot-right').y)/2;
        minHipHeight=Math.min(minHipHeight,height);
        const knees=['left','right'].map(side=>joint(`knee-${side}`).sub(joint(`hip-${side}`)).angleTo(joint(`ankle-${side}`).sub(joint(`knee-${side}`))));
        maxKnee=Math.max(maxKnee,...knees);
        maxHand=Math.max(maxHand,p.boardG.userData.skateGrab?.error??Infinity);
        assert.equal(p.boardG.userData.skateGrab?.hand,`socket-grip-${stance>0?'right':'left'}`,'the leading-hand grip changed');
        const facing=p.riderG.getWorldDirection(v());facing.y=0;facing.normalize();
        const lean=joint('neck').sub(joint('spine')).normalize().dot(facing);backLean=Math.min(backLean,lean);
      }
      if(landFrames>40)break;
    }
    assert.ok(started&&completed&&landed&&held>5,'native entry, spin, grab, release and landing did not complete');
  }
  runtime.dispose();
  const catalog=JSON.parse(await readFile(new URL('../public/animations/skate-review/catalog.json',import.meta.url),'utf8'));
  const clip=catalog.clips.find(c=>c.id==='player.skate-study.special-the-900');
  assert.equal(clip.name,'Skate · S39 · Tornado Twist');
  p.enterAnimationPreview();
  const rig=withSkatePresentationRig(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition),binding=a.RigBinding.fromDefinition(p.animationRig.root,rig),motion=a.createProceduralMotionContext();
  for(let f=0;f<=120;f++){
    p.applyAnimationDeformations({});
    const pose=a.sampleComposedClip(clip,clip.duration*f/120,motion);
    binding.applyPose(pose,{resetUnspecified:true});p.applyAnimationDeformations(pose.scalars);p.syncCharacterAppearance({upperArmRestAngleWeight:0});
    checkShorts({source:'review',f});
  }
  p.exitAnimationPreview();level.dispose();
  console.log({frames,vertices,minClearance,minHipHeight,maxKneeDegrees:maxKnee*180/Math.PI,maxFoot,maxHand,maxShaftGap,backLean,errors});
  assert.equal(errors.length,0,'shorts must remain above the board through the complete move');
  assert.ok(minHipHeight>.65&&maxKnee<1.4,'the pose collapsed into a deep squat');
  assert.ok(backLean<-.08,'the upper body does not lean back');
  assert.ok(maxFoot<.006&&maxHand<.006,'foot or grab contact detached');
  assert.ok(maxShaftGap<.002,'reaching arm has a visible bone gap');
  console.log('PASS native Tornado Twist in both stances/headings: complete 900, high pelvis/back lean, planted leading grip/feet, continuous arm shafts and skinned-shorts clearance.');
});
