import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,server,THREE,Level,Player})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {sampleImpossible}=await server.ssrLoadModule('/src/skateTricks.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const level=new Level(new THREE.Scene(),{id:'impossible-test',name:'Impossible test',data:{v:1,name:'Impossible test',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const control=new Player(level.scene);control.syncVisual=()=>{};
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const v=(...xyz)=>new THREE.Vector3(...xyz),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),deck=p.boardG.getObjectByName('Deck_ContinuousRoundedKick'),point=v(),matrix=new THREE.Matrix4();
  const shoes=['left','right'].flatMap(side=>['shoe','sole','shoe-foxing','shoe-tongue'].map(part=>p.riderG.getObjectByName(`${part}-${side}`)));
  const failures=[];let cases=0,frames=0,vertices=0,minShorts=Infinity,minShoe=Infinity,minShin=Infinity,minDeck=Infinity,maxFoot=0,maxContact=0,maxArmSpan=0,maxContactDrift=0,maxMaterialDrift=0;
  for(const park of (process.env.IMPOSSIBLE_DEBUG?[false]:[false,true]))for(const stance of (process.env.IMPOSSIBLE_DEBUG?[-1]:[-1,1]))for(const reversed of (process.env.IMPOSSIBLE_DEBUG?[false]:[false,true]))for(const delay of (process.env.IMPOSSIBLE_DEBUG?[1]:[1,9])){
    cases++;level.skatepark=park;
    for(const rider of [p,control]){
      rider.enterLevel('impossible-test');rider.respawn(level,true);rider.parkControls=park;rider.freeSkate=true;rider.speed=8;rider.parkVelocity.set(0,0,-8);
      rider.sidePose=rider.deckPose=rider.skatePose=1;rider.stance=stance;rider.skateMountT=-1;rider.deckYawOffset=reversed?Math.PI:0;
    }
    runtime.restart();const rearSide=stance>0?'left':'right',shins=[];
    p.riderG.getObjectByName(`stretch-bone-lower-leg-${rearSide}`).traverse(node=>{if(node.isMesh)shins.push(node);});
    let air=0,started=false,landAge=0,inverted=false,initialNose=null,armWide=false;const contacts=[],materials=[];
    for(let f=0;f<230;f++){
      if(p.state==='air')air++;
      const input=makeInput({jumpHeld:f>=30&&f<60,jumpPressed:f===30,jumpReleased:f===60,spinPressed:air===delay,spinHeld:air===delay,moveY:air===delay?1:0});
      p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);frames++;p.group.updateMatrixWorld(true);
      assert.ok(p.pos.distanceTo(control.pos)<1e-9,'Impossible animation changed controller motion');assert.equal(p.isBailing,false);
      const s=p.boardG.userData.settings,k=s.overallScale,m=p.boardG.userData.skateImpossible;
      if(f===29)initialNose=v(0,0,1).transformDirection(p.boardG.matrixWorld);
      if(m){
        started=true;assert.equal(p.animationClipHint,'player.skate');const t=1-p.flipT/p.flipDuration;
        const rear=p.riderG.getObjectByName(`ankle-${rearSide}`),contact=v(...m.contact);
        contacts.push(rear.worldToLocal(contact.clone()));materials.push(m.materialPoint[2]*(reversed?-1:1));
        maxContact=Math.max(maxContact,contact.distanceTo(at(m.rearFoot)));
        if(process.env.IMPOSSIBLE_DEBUG&&t>.3&&t<.65)console.log({t,turn:m.turn,axis:m.axis,material:m.materialPoint,normal:v(0,1,0).transformDirection(p.boardG.matrixWorld).toArray(),nose:v(0,0,1).transformDirection(p.boardG.matrixWorld).toArray(),contact:contact.toArray(),foot:at(m.rearFoot).toArray(),hips:at('hips').toArray()});
        if(contact.distanceTo(at(m.rearFoot))>.55&&failures.length<12)failures.push({kind:'contact',park,stance,reversed,delay,t,distance:contact.distanceTo(at(m.rearFoot))});
        const normal=v(0,1,0).transformDirection(p.boardG.matrixWorld);if(normal.y<-.75)inverted=true;
        maxFoot=Math.max(maxFoot,p.boardG.userData.skateContact.footError);
        if(p.boardG.userData.skateContact.footError>.008&&failures.length<12)failures.push({kind:'foot',park,stance,reversed,delay,t,error:p.boardG.userData.skateContact.footError});
        const span=at('wrist-left').distanceTo(at('wrist-right'));maxArmSpan=Math.max(maxArmSpan,span);
        if(process.env.IMPOSSIBLE_DEBUG&&m.arms>.95)console.log('ARMS',t,span,!!p.boardG.userData.ollieMotion,p.playerAnimationBridge.deformationValue('deform.arm.upper.left.length'),p.animationClipHint);
        if(m.arms>.95&&span>1.5&&at('wrist-left').y>at('shoulder-left').y-.15&&at('wrist-right').y>at('shoulder-right').y-.15)armWide=true;
        for(let i=0;i<deck.geometry.attributes.position.count;i++){
          point.fromBufferAttribute(deck.geometry.attributes.position,i).applyMatrix4(deck.matrixWorld);minDeck=Math.min(minDeck,point.y);
          if(point.y<-.01&&failures.length<12)failures.push({kind:'ground',park,stance,reversed,delay,t,y:point.y});
        }
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
            if(gap<(mesh===shorts?.02:-.001)&&failures.length<20&&!failures.some(f=>f.kind===mesh.name&&f.t===(m?1-p.flipT/p.flipDuration:null)))failures.push({kind:mesh.name,park,stance,reversed,delay,t:m?1-p.flipT/p.flipDuration:null,gap});
          }
        }
        if(p.grounded)landAge++;if(landAge>20)break;
      }
    }
    let drift=0;for(const a of contacts)for(const b of contacts)drift=Math.max(drift,a.distanceTo(b));maxContactDrift=Math.max(maxContactDrift,drift);
    const materialDrift=Math.max(...materials)-Math.min(...materials);maxMaterialDrift=Math.max(maxMaterialDrift,materialDrift);
    if(!(started&&inverted&&armWide&&landAge>20&&drift>.08&&materialDrift>.5))failures.push({kind:'phases',park,stance,reversed,delay,started,inverted,armWide,landAge,drift,materialDrift});
    assert.ok(v(0,0,1).transformDirection(p.boardG.matrixWorld).dot(initialNose)>.98,'Impossible added a half-shove');assert.equal(p.stance,stance);
    assert.equal(p.comboPoints,100);assert.equal(p.comboMult,1);
  }
  runtime.dispose();level.dispose();assert.equal(sampleImpossible(1).angle,2*Math.PI);assert.equal(sampleImpossible(1).wrap,0);
  console.log({cases,frames,vertices,minShorts,minShoe,minShin,minDeck,maxFoot,maxContact,maxArmSpan,maxContactDrift,maxMaterialDrift,failures});assert.deepEqual(failures,[]);
  console.log('PASS moving rear-foot wrap, sliding deck/shoe contact, broad balancing arms, full rotation, garment/shoe/shin clearance and unchanged movement.');
});
