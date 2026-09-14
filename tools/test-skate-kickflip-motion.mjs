import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,Level,Player})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {sampleKickflip,sampleHeelflip}=await server.ssrLoadModule('/src/skateTricks.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const level=new Level(new THREE.Scene(),{id:'kickflip-test',name:'Kickflip test',data:{v:1,name:'Kickflip test',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const control=new Player(level.scene);control.syncVisual=()=>{};
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),point=v(),matrix=new THREE.Matrix4();
  const shoes=['left','right'].flatMap(side=>['shoe','sole','shoe-foxing'].map(part=>p.riderG.getObjectByName(`${part}-${side}`)));
  assert.ok(shoes.every(Boolean));
  const failures=[];let cases=0,frames=0,vertices=0,minShorts=Infinity,maxFoot=0,maxArcError=0,maxKnee=0,maxStep=0,minShoe=Infinity;
  for(const kind of ['kick','heel'])for(const park of [false,true])for(const stance of [-1,1])for(const reversed of [false,true])for(const delay of [1,9]){
    cases++;level.skatepark=park;
    for(const rider of [p,control]){
      rider.enterLevel('kickflip-test');rider.respawn(level,true);rider.parkControls=park;rider.freeSkate=true;rider.speed=8;rider.parkVelocity.set(0,0,-8);
      rider.sidePose=rider.deckPose=rider.skatePose=1;rider.stance=stance;rider.skateMountT=-1;rider.deckYawOffset=reversed?Math.PI:0;
    }
    runtime.restart();let air=0,started=false,landAge=0,previous=null,coast=[],catchFrames=[],flicked=false,heelRaised=false;
    for(let f=0;f<220;f++){
      if(p.state==='air')air++;
      const input=makeInput({jumpHeld:f>=30&&f<60,jumpPressed:f===30,jumpReleased:f===60,spinPressed:air===delay,spinHeld:air===delay,moveX:air===delay&&kind==='heel'?1:0});
      p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);frames++;
      assert.ok(p.pos.distanceTo(control.pos)<1e-9,`${kind} presentation changed controller motion`);
      assert.equal(p.isBailing,false);p.group.updateMatrixWorld(true);
      const s=p.boardG.userData.settings,k=s.overallScale,centreY=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,0,0)-s.deckThickness*.5)*k;
      const centre=p.boardG.localToWorld(v(0,centreY,0)),contact=p.boardG.userData.skateContact;
      const m=p.boardG.userData.skateFootFlip;
      if(m){
        assert.equal(m.kind,kind);started=true;const t=1-p.flipT/p.flipDuration;
        const frameUp=v(0,1,0).applyQuaternion(p.group.getWorldQuaternion(new THREE.Quaternion()));
        const error=centre.clone().sub(p.group.getWorldPosition(v())).addScaledVector(frameUp,-centreY).length();maxArcError=Math.max(maxArcError,error);
        const knees=['left','right'].map(side=>at(`knee-${side}`).sub(at(`hip-${side}`)).angleTo(at(`ankle-${side}`).sub(at(`knee-${side}`))));
        maxKnee=Math.max(maxKnee,...knees);maxFoot=Math.max(maxFoot,contact.footError);
        const front=at(m.front),back=at(m.back),localFront=p.boardG.worldToLocal(front.clone());
        const side=stance>0?'right':'left';
        if(kind==='heel'&&t>.15&&t<.40&&at(`socket-toe-${side}`).y-at(`socket-heel-${side}`).y>.10)heelRaised=true;
        if(t>.09&&t<.14)assert.equal(Math.sign(localFront.x),(kind==='heel'?-1:1)*stance*(reversed?-1:1),'wrong foot edge initiates the flip');
        if(t>.10&&t<.25&&Math.abs(localFront.x)>s.deckHalfWidth*k*.8)flicked=true;
        if(t>.3&&t<.65){
          const nose=v(0,0,1).transformDirection(p.boardG.matrixWorld),width=v(1,0,0).transformDirection(p.boardG.matrixWorld);
          const right=frameUp.clone().cross(nose).normalize(),up=nose.clone().cross(right).normalize();
          coast.push({t,angle:Math.atan2(width.dot(up),width.dot(right))});
        }
        if(t>.72)catchFrames.push({t,front:front.y-centre.y,back:back.y-centre.y});
        if(previous){const delta=centre.clone().sub(previous.centre).sub(p.pos.clone().sub(previous.pos)).addScaledVector(frameUp.clone().sub(previous.up),-centreY);maxStep=Math.max(maxStep,delta.length());}
        previous={centre, pos:p.pos.clone(),up:frameUp};
        if(error>.004&&failures.length<8)failures.push({trick:kind,kind:'arc',park,stance,reversed,delay,t,error});
        if(contact.footError>.008&&failures.length<8)failures.push({trick:kind,kind:'foot',park,stance,reversed,delay,t,error:contact.footError});
      }
      if(m)for(const mesh of shoes){
        matrix.copy(p.boardG.matrixWorld).invert().multiply(mesh.matrixWorld);
        for(let i=0;i<mesh.geometry.attributes.position.count;i++){
          point.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix);
          if(Math.abs(point.x)>s.deckHalfWidth*k*.95||point.z< -s.deckTailLength*k*.95||point.z>s.deckNoseLength*k*.95)continue;
          const surface=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
          const gap=Math.abs(point.y-surface+s.deckThickness*k*.5)-s.deckThickness*k*.5;minShoe=Math.min(minShoe,gap);
          if(gap<-.001&&failures.length<8)failures.push({trick:kind,kind:'shoe',park,stance,reversed,delay,t:1-p.flipT/p.flipDuration,mesh:mesh.name,gap});
        }
      }
      if(started){
        matrix.copy(p.boardG.matrixWorld).invert().multiply(shorts.matrixWorld);
        for(let i=0;i<shorts.geometry.attributes.position.count;i++){
          shorts.getVertexPosition(i,point).applyMatrix4(matrix);vertices++;
          if(Math.abs(point.x)>s.deckHalfWidth*k||point.z< -s.deckTailLength*k||point.z>s.deckNoseLength*k)continue;
          const surface=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
          const gap=Math.abs(point.y-surface+s.deckThickness*k*.5)-s.deckThickness*k*.5;minShorts=Math.min(minShorts,gap);
          if(gap<.02&&failures.length<8)failures.push({trick:kind,kind:'shorts',park,stance,reversed,delay,f,gap});
        }
        if(p.grounded)landAge++;
        if(landAge>20)break;
      }
    }
    assert.ok(started&&landAge>20&&flicked&&coast.length>=2&&catchFrames.length>=3,'missing native flick, free rotation, catch or landing');
    let angularSpeed=null;
    for(let i=1;i<coast.length;i++){
      const difference=coast[i].angle-coast[i-1].angle,speed=Math.atan2(Math.sin(difference),Math.cos(difference))/(coast[i].t-coast[i-1].t);
      angularSpeed??=speed;assert.ok(Math.abs(speed-angularSpeed)<.01,JSON.stringify({problem:'angular coast',kind,park,stance,reversed,delay,angularSpeed,speed,coast}));
    }
    assert.equal(Math.sign(angularSpeed),(kind==='heel'?1:-1)*stance*(reversed?-1:1),'heel/toe flick spins the wrong way');
    if(kind==='heel')assert.ok(heelRaised,'leading shoe never presents its heel to the board');
    for(let i=1;i<catchFrames.length;i++)assert.ok(catchFrames[i].front<=catchFrames[i-1].front+.012,'front foot rises to catch');
    assert.ok(catchFrames.at(-1).front<catchFrames[0].front-.10,'front foot never comes down to meet board');
    assert.ok(catchFrames.at(-1).back<.03,'rear foot never catches');
    assert.equal(p.comboPoints,100);assert.equal(p.comboMult,1);
  }
  runtime.dispose();level.dispose();
  assert.equal(sampleKickflip(1).turn,1);assert.equal(sampleKickflip(.10).turn,0);assert.equal(sampleHeelflip(1).turn,1);assert.equal(sampleHeelflip(1).heelLead,0);
  console.log({cases,frames,vertices,minShorts,maxFoot,maxArcError,maxStep,minShoe,maxKneeDegrees:maxKnee*180/Math.PI,failures});
  assert.deepEqual(failures,[]);
  console.log('PASS native Kickflip/Heelflip impulses, opposite edges/rotations, raised leading heel, independent deck-centre flight, downward foot catches, clearance and unchanged movement in both stances/deck orientations.');
});
