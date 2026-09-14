import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,Level,Player})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {samplePopShoveIt}=await server.ssrLoadModule('/src/skateTricks.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const level=new Level(new THREE.Scene(),{id:'shove-test',name:'Shove test',data:{v:1,name:'Shove test',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const control=new Player(level.scene);control.syncVisual=()=>{};
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),point=v(),matrix=new THREE.Matrix4();
  const shoes=['left','right'].flatMap(side=>['shoe','sole','shoe-foxing'].map(part=>p.riderG.getObjectByName(`${part}-${side}`)));
  let cases=0,frames=0,vertices=0,maxFoot=0,maxArc=0,minShorts=Infinity,minShoe=Infinity,maxTilt=0,maxScoop=0,maxTurnError=0;const failures=[];
  for(const park of [false,true])for(const stance of [-1,1])for(const reversed of [false,true])for(const delay of [1,9]){
    cases++;level.skatepark=park;
    for(const rider of [p,control]){
      rider.enterLevel('shove-test');rider.respawn(level,true);rider.parkControls=park;rider.freeSkate=true;rider.speed=8;rider.parkVelocity.set(0,0,-8);
      rider.sidePose=rider.deckPose=rider.skatePose=1;rider.stance=stance;rider.skateMountT=-1;rider.deckYawOffset=reversed?Math.PI:0;
    }
    runtime.restart();let air=0,started=false,landAge=0,tailLoaded=false,scooped=false,frontCaught=false,initialBody=null,initialNose=null,lastYaw=null,totalYaw=0;
    for(let f=0;f<220;f++){
      if(p.state==='air')air++;
      const input=makeInput({jumpHeld:f>=30&&f<60,jumpPressed:f===30,jumpReleased:f===60,spinPressed:air===delay,spinHeld:air===delay,moveY:air===delay?-1:0});
      p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);frames++;p.group.updateMatrixWorld(true);
      assert.ok(p.pos.distanceTo(control.pos)<1e-9,'shove animation changed controller motion');assert.equal(p.isBailing,false);
      const s=p.boardG.userData.settings,k=s.overallScale,centreY=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,0,0)-s.deckThickness*.5)*k;
      const centre=p.boardG.localToWorld(v(0,centreY,0)),m=p.boardG.userData.skateFootFlip;
      const frame=p.group.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(v(0,1,0),p.visualYaw));
      const up=v(0,1,0).applyQuaternion(frame),right=v(1,0,0).applyQuaternion(frame),forward=v(0,0,1).applyQuaternion(frame);
      const nose=v(0,0,1).transformDirection(p.boardG.matrixWorld),width=v(1,0,0).transformDirection(p.boardG.matrixWorld);
      const yaw=Math.atan2(nose.dot(right),nose.dot(forward));
      if(f===29){initialBody=v(0,0,1).transformDirection(p.bodyGroup.matrixWorld);initialBody.y=0;initialBody.normalize();initialNose=nose.clone();}
      if(m){
        assert.equal(m.kind,'shove');started=true;const t=1-p.flipT/p.flipDuration,parity=reversed?-1:1;
        const error=centre.clone().sub(p.group.getWorldPosition(v())).addScaledVector(up,-centreY).length();maxArc=Math.max(maxArc,error);
        if(error>.004&&failures.length<8)failures.push({kind:'arc',park,stance,reversed,delay,t,error});
        maxFoot=Math.max(maxFoot,p.boardG.userData.skateContact.footError);
        if(p.boardG.userData.skateContact.footError>.008&&failures.length<8)failures.push({kind:'foot',park,stance,reversed,delay,t,error:p.boardG.userData.skateContact.footError});
        maxTilt=Math.max(maxTilt,Math.abs(width.dot(up)));
        const back=at(m.back),front=at(m.front),backLocal=p.boardG.worldToLocal(back.clone());
        if(t>.08&&t<.3&&backLocal.z*parity<-.67*k)tailLoaded=true;
        const scoop=-back.clone().sub(centre).dot(right)*stance;maxScoop=Math.max(maxScoop,scoop);
        if(t>.15&&t<.45&&scoop>.15)scooped=true;
        if(t>.88&&t<.98){
          const local=p.boardG.worldToLocal(front.clone()),surface=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,local.x/k,local.z/k))*k;
          if(local.y-surface<.035&&back.clone().sub(front).dot(up)>.06)frontCaught=true;
        }
        if(lastYaw!==null)totalYaw+=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));lastYaw=yaw;
      }
      if(started){
        if(!m&&lastYaw!==null){totalYaw+=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));lastYaw=null;}
        for(const mesh of [shorts,...(m?shoes:[])]){
          matrix.copy(p.boardG.matrixWorld).invert().multiply(mesh.matrixWorld);
          for(let i=0;i<mesh.geometry.attributes.position.count;i++){
            if(mesh===shorts){mesh.getVertexPosition(i,point);vertices++;}else point.fromBufferAttribute(mesh.geometry.attributes.position,i);
            point.applyMatrix4(matrix);
            if(Math.abs(point.x)>s.deckHalfWidth*k*.95||point.z< -s.deckTailLength*k*.95||point.z>s.deckNoseLength*k*.95)continue;
            const surface=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
            const gap=Math.abs(point.y-surface+s.deckThickness*k*.5)-s.deckThickness*k*.5;
            if(mesh===shorts)minShorts=Math.min(minShorts,gap);else minShoe=Math.min(minShoe,gap);
            if(gap<(mesh===shorts?.02:-.001)&&failures.length<8)failures.push({kind:mesh.name,park,stance,reversed,delay,t:m?1-p.flipT/p.flipDuration:null,gap});
          }
        }
        if(p.grounded)landAge++;if(landAge>20)break;
      }
    }
    assert.ok(started&&tailLoaded&&scooped&&frontCaught&&landAge>20,JSON.stringify({park,stance,reversed,delay,started,tailLoaded,scooped,frontCaught,landAge}));
    maxTurnError=Math.max(maxTurnError,Math.abs(totalYaw-Math.PI*stance));assert.ok(Math.abs(totalYaw-Math.PI*stance)<.02,'board did not turn exactly 180 degrees');
    const finalNose=v(0,0,1).transformDirection(p.boardG.matrixWorld),body=v(0,0,1).transformDirection(p.bodyGroup.matrixWorld);body.y=0;body.normalize();
    assert.ok(finalNose.dot(initialNose)<-.98,'nose and tail never swap');assert.ok(body.dot(initialBody)>.95,'rider turns around with the board');assert.equal(p.stance,stance);
    assert.equal(p.comboPoints,100);assert.equal(p.comboMult,1);
  }
  runtime.dispose();level.dispose();assert.equal(samplePopShoveIt(1).turn,1);assert.equal(samplePopShoveIt(1).bank,0);assert.equal(Math.abs(samplePopShoveIt(1).rock),0);assert.ok(maxTilt>.12,'shove remains perfectly flat');
  console.log({cases,frames,vertices,maxFoot,maxArc,minShorts,minShoe,maxTilt,maxScoop,maxTurnError,failures});assert.deepEqual(failures,[]);
  console.log('PASS native rear-foot tail scoop, tilted 180-degree board flight, stable rider stance, front-foot catch, mesh clearance and unchanged movement.');
});
