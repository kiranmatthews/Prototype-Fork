import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,Level,Player})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const level=new Level(new THREE.Scene(),{id:'inward-heel-test',name:'Inward Heelflip test',data:{v:1,name:'Inward Heelflip test',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const control=new Player(level.scene);control.syncVisual=()=>{};
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),point=v(),matrix=new THREE.Matrix4();
  const shoes=['left','right'].flatMap(side=>['shoe','sole','shoe-foxing','shoe-tongue'].map(part=>p.riderG.getObjectByName(`${part}-${side}`))),shins=[];
  for(const side of ['left','right'])p.riderG.getObjectByName(`stretch-bone-lower-leg-${side}`).traverse(n=>{if(n.isMesh)shins.push(n);});
  let cases=0,frames=0,vertices=0,minShorts=Infinity,minShoe=Infinity,minShin=Infinity,maxFoot=0,maxArc=0,maxSpan=0,maxNoseRise=0,maxYawError=0,maxRollError=0;const failures=[];
  const fail=record=>{if(failures.length<20&&!failures.some(f=>f.kind===record.kind&&f.trick===record.trick&&f.t===record.t))failures.push(record);};
  for(const kind of ['inward-heel'])for(const park of (process.env.INWARD_DEBUG?[false]:[false,true]))for(const stance of (process.env.INWARD_DEBUG?[-1]:[-1,1]))for(const reversed of (process.env.INWARD_DEBUG?[false]:[false,true]))for(const delay of (process.env.INWARD_DEBUG?[1]:[1,9])){
    cases++;level.skatepark=park;const sign=1,parity=reversed?-1:1;
    for(const rider of [p,control]){
      rider.enterLevel('inward-heel-test');rider.respawn(level,true);rider.parkControls=park;rider.freeSkate=true;rider.speed=8;rider.parkVelocity.set(0,0,-8);
      rider.sidePose=rider.deckPose=rider.skatePose=1;rider.stance=stance;rider.skateMountT=-1;rider.deckYawOffset=reversed?Math.PI:0;
    }
    runtime.restart();let air=0,started=false,landAge=0,clearanceKick=false,steep=false,heelRaised=false,tailLoad=false,balanced=false,initialNose=null,initialBody=null,lastYaw=null,lastRoll=null,yawTotal=0,rollTotal=0;const catches=[];
    for(let f=0;f<230;f++){
      if(p.state==='air')air++;
      const input=makeInput({jumpHeld:f>=30&&f<60,jumpPressed:f===30,jumpReleased:f===60,spinPressed:air===delay,spinHeld:air===delay,moveX:air===delay?1:0,moveY:air===delay?1:0});
      p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);frames++;p.group.updateMatrixWorld(true);
      assert.ok(p.pos.distanceTo(control.pos)<1e-9,'inward heelflip animation changed movement');assert.equal(p.isBailing,false);
      const s=p.boardG.userData.settings,k=s.overallScale,centreY=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,0,0)-s.deckThickness*.5)*k;
      const centre=p.boardG.localToWorld(v(0,centreY,0)),m=p.boardG.userData.skateFootFlip;
      const frame=p.group.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(v(0,1,0),p.visualYaw));
      const up=v(0,1,0).applyQuaternion(frame),right=v(1,0,0).applyQuaternion(frame);
      if(f===29){initialNose=v(0,0,1).transformDirection(p.boardG.matrixWorld);initialBody=v(0,0,1).transformDirection(p.bodyGroup.matrixWorld);initialBody.y=0;initialBody.normalize();}
      if(m){
        assert.equal(m.kind,kind);assert.equal(p.animationClipHint,'player.skate');started=true;const t=1-p.flipT/p.flipDuration;
        const error=centre.clone().sub(p.group.getWorldPosition(v())).addScaledVector(up,-centreY).length();maxArc=Math.max(maxArc,error);
        if(error>.004)fail({kind:'arc',trick:kind,park,stance,reversed,delay,t,error});
        const footError=p.boardG.userData.skateContact.footError;maxFoot=Math.max(maxFoot,footError);
        if(footError>.008)fail({kind:'foot',trick:kind,park,stance,reversed,delay,t,error:footError});
        const front=at(m.front),back=at(m.back),localBack=p.boardG.worldToLocal(back.clone());
        if(t>.06&&t<.16&&localBack.z*parity<-.64*k)tailLoad=true;
        if(t>.16&&t<.35&&front.clone().sub(centre).dot(right)*stance<-.1&&back.clone().sub(centre).dot(right)*stance<-.1)clearanceKick=true;
        const noseRise=v(0,0,parity).transformDirection(p.boardG.matrixWorld).dot(v(0,1,0).applyQuaternion(frame));maxNoseRise=Math.max(maxNoseRise,noseRise);if(noseRise>.70)steep=true;
        if(t>.18){
          // Body orientation supplies the unflipped catch plane, allowing the
          // actual deck roll to be separated from its simultaneous half-yaw.
          const base=p.bodyGroup.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(v(0,1,0),-stance*parity*Math.PI/2));
          const q=base.invert().multiply(p.boardG.getWorldQuaternion(new THREE.Quaternion()));
          const nose=v(0,0,1).applyQuaternion(q),width=v(1,0,0).applyQuaternion(q),normal=v(0,1,0).applyQuaternion(q);
          const yaw=Math.atan2(nose.x,nose.z),roll=Math.atan2(width.y,normal.y);
          yawTotal+=lastYaw===null?yaw:Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));
          rollTotal+=lastRoll===null?roll:Math.atan2(Math.sin(roll-lastRoll),Math.cos(roll-lastRoll));lastYaw=yaw;lastRoll=roll;
        }
        const frontSide=stance>0?'right':'left',backSide=stance>0?'left':'right';
        if(t>.15&&t<.40&&at(`socket-toe-${frontSide}`).clone().sub(at(`socket-heel-${frontSide}`)).dot(up)>.10)heelRaised=true;
        const span=at('wrist-left').distanceTo(at('wrist-right'));maxSpan=Math.max(maxSpan,span);
        const frontReach=at(`wrist-${frontSide}`).sub(at(`shoulder-${frontSide}`)),backReach=at(`wrist-${backSide}`).sub(at(`shoulder-${backSide}`));
        if(m.arms>.95&&span>1.25&&backReach.dot(up)-frontReach.dot(up)>.1&&backReach.length()-frontReach.length()>.02)balanced=true;
        if(t>.72)catches.push({front:front.clone().sub(centre).dot(up),back:back.clone().sub(centre).dot(up)});
      }
      if(started){
        for(const mesh of [shorts,...(m?[...shoes,...shins]:[])]){
          matrix.copy(p.boardG.matrixWorld).invert().multiply(mesh.matrixWorld);
          for(let i=0;i<mesh.geometry.attributes.position.count;i++){
            if(mesh===shorts){mesh.getVertexPosition(i,point);vertices++;}else point.fromBufferAttribute(mesh.geometry.attributes.position,i);
            point.applyMatrix4(matrix);
            if(Math.abs(point.x)>s.deckHalfWidth*k*.95||point.z< -s.deckTailLength*k*.95||point.z>s.deckNoseLength*k*.95)continue;
            const surface=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
            const gap=Math.abs(point.y-surface+s.deckThickness*k*.5)-s.deckThickness*k*.5;
            if(mesh===shorts)minShorts=Math.min(minShorts,gap);else if(shoes.includes(mesh))minShoe=Math.min(minShoe,gap);else minShin=Math.min(minShin,gap);
            if(gap<(mesh===shorts?.02:-.001))fail({kind:mesh.name,trick:kind,park,stance,reversed,delay,t:m?1-p.flipT/p.flipDuration:null,gap});
          }
        }
        if(p.grounded)landAge++;if(landAge>20)break;
      }
    }
    if(!(started&&clearanceKick&&steep&&heelRaised&&tailLoad&&balanced&&landAge>20))fail({kind:'phases',trick:kind,park,stance,reversed,delay,started,clearanceKick,steep,heelRaised,tailLoad,balanced,landAge});
    maxYawError=Math.max(maxYawError,Math.abs(yawTotal-Math.PI*sign*stance));maxRollError=Math.max(maxRollError,Math.abs(rollTotal-2*Math.PI*stance*parity));
    assert.ok(Math.abs(yawTotal-Math.PI*sign*stance)<.02,`${kind} misses its half-shove`);assert.ok(Math.abs(rollTotal-2*Math.PI*stance*parity)<.02,`${kind} misses its complete roll`);
    assert.ok(catches.length>1&&catches.at(-1).front<catches[0].front-.07,JSON.stringify({problem:'downward catch',kind,park,stance,reversed,delay,catches}));
    const body=v(0,0,1).transformDirection(p.bodyGroup.matrixWorld);body.y=0;body.normalize();assert.ok(body.dot(initialBody)>.95,'rider turns with the board');
    assert.ok(v(0,0,1).transformDirection(p.boardG.matrixWorld).dot(initialNose)<-.98);assert.equal(p.stance,stance);
    assert.equal(p.comboPoints,350);assert.equal(p.comboMult,1);
  }
  runtime.dispose();level.dispose();console.log({cases,frames,vertices,minShorts,minShoe,minShin,maxFoot,maxArc,maxSpan,maxNoseRise,maxYawError,maxRollError,failures});assert.deepEqual(failures,[]);
  console.log('PASS native backside scoop/toe-up heel flick, pitched inward heelflip passage, half-shove/full roll, asymmetric arm balance, independent flight, downward catch, mesh clearance and unchanged movement.');
});
