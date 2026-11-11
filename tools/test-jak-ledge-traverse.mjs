import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(await readFile(process.argv[2],'utf8'));
await withSkateRuntime(async({server,player:p,level,THREE,CONST})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const original=a.createPlayerStarterAnimationSuite(binding.definition);
  const suite=createJakDirectSuite(original,binding.definition,bank);
  const runtime=createCharacterAnimationRuntime(p,suite);
  const wall=level.walls.find(w=>Math.abs(w.max.y-3.35)<.01);
  const tick=(input={})=>{
    p.camDir.set(0,0,-1);p.step(CONST.fixedStep,makeInput(input),level);
    level.update(CONST.fixedStep);p.commitRenderStep(level);
  };
  const reset=(x=0)=>{
    p.enterLevel('jak-traverse');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};runtime.restart();
    p.pos.set(x,2.35,-1.1);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;
    p.vVel=-1;p.lastVelX=0;p.lastVelZ=-4;p.rawInput=makeInput({moveY:1});
    assert.ok(p.tryLedgeGrab(wall,level));for(let f=0;f<80;f++)tick();
  };
  const point=id=>binding.joints.get(id).getWorldPosition(new THREE.Vector3());
  const results=[];
  for(const first of [-1,1]) {
    reset();let maxHipStep=0,maxGrip=0,maxReverse=0,planted=0;
    let hip=point('hips'),handL=new THREE.Vector3(),handR=new THREE.Vector3();
    p.gloveLeft.gripSocket.getWorldPosition(handL);p.gloveRight.gripSocket.getWorldPosition(handR);
    for(let f=0;f<400;f++) {
      const move=f<70?first:f<150?-first:f<180?0:f<250?first:f<300?-first:0;
      const oldHip=hip,oldL=handL,oldR=handR;
      tick({moveX:move});
      assert.equal(p.state,'hang',`straight lost grip at ${f}`);assert.equal(p.ledgePhase,'grip');
      hip=point('hips');handL=p.gloveLeft.gripSocket.getWorldPosition(new THREE.Vector3());
      handR=p.gloveRight.gripSocket.getWorldPosition(new THREE.Vector3());
      maxHipStep=Math.max(maxHipStep,hip.distanceTo(oldHip));maxGrip=Math.max(maxGrip,p.ledgeGripError);
      if(move&&![70,180,250].includes(f))maxReverse=Math.max(maxReverse,-move*(hip.x-oldHip.x));
      if(move&&Math.min(handL.distanceTo(oldL),handR.distanceTo(oldR))<.002)planted++;
      if(f>360)assert.equal(p.ledgeHands.reaching,false,'stopped shimmy failed to settle');
      assert.ok(handR.x-handL.x>.1,'hands crossed during reversal');
    }
    assert.ok(maxHipStep<.065,`body jerk: ${maxHipStep}`);
    assert.ok(maxReverse<.001,`body moved against input: ${maxReverse}`);
    assert.ok(maxGrip<.003,`straight grip slipped: ${maxGrip}`);
    assert.ok(planted>200,'both gloves slid along the edge');
    results.push({kind:'reversals',first,maxHipStep,maxGrip,maxReverse,planted});
  }
  for(const direction of [-1,1]) {
    reset(direction*8.7);let maxGrip=0,maxHipStep=0,maxPlanarStep=0,travel=0,maxGripFrame;
    const faces=new Set();let hip=point('hips'),position=p.pos.clone();
    // (As long as the same ground took at two metres a second.)
    for(let f=0,frames=Math.round(240*2/p.ledgeHands.traverseSpeed);f<frames;f++) {
      const normal=p.ledgeNormal.clone(),oldHip=hip;
      tick({moveX:normal.z*direction,moveY:normal.x*direction});
      assert.equal(p.state,'hang',`corner lost grip at ${f}`);assert.equal(p.ledgePhase,'grip');
      faces.add(p.ledgeNormal.toArray().map(x=>Math.round(x)).join(','));
      if(p.ledgeGripError>maxGrip){maxGrip=p.ledgeGripError;maxGripFrame={f,position:p.pos.toArray(),normal:p.ledgeNormal.toArray(),lift:p.ledgeReachLift,
        left:p.ledgeHands.left.toArray(),right:p.ledgeHands.right.toArray(),hip:point('hips').toArray()};}
      travel+=p.pos.distanceTo(position);
      hip=point('hips');maxHipStep=Math.max(maxHipStep,hip.distanceTo(oldHip));
      maxPlanarStep=Math.max(maxPlanarStep,Math.hypot(hip.x-oldHip.x,hip.z-oldHip.z));position.copy(p.pos);
    }
    assert.ok(faces.size>=3,'test did not traverse corners');assert.ok(travel>9,'corner traversal stalled');
    assert.ok(maxGrip<.006,`corner glove slipped: ${maxGrip} ${JSON.stringify(maxGripFrame)}`);
    assert.ok(maxPlanarStep<.08,`corner body snapped sideways: ${maxPlanarStep}`);
    assert.ok(maxHipStep<.15,`corner body snapped: ${maxHipStep}`);
    results.push({kind:'corners',direction,maxGrip,maxHipStep,maxPlanarStep,travel,faces:[...faces]});
  }
  // The hands keep time with the lip, not the clock: one reach each for every
  // stride of it at any push of the stick, slowly enough to follow, and with a
  // beat hanging from both.
  for(const push of [1,.5]) {
    reset();const hands=[p.gloveLeft,p.gloveRight],at=()=>hands.map(glove=>glove.gripSocket.getWorldPosition(new THREE.Vector3()).x);
    let was=at(),reaches=0,moving=[false,false],both=0,from=p.pos.x,longest=0,started=[0,0],apart=[Infinity,0];
    const frames=360,settle=40;
    for(let f=0;f<frames;f++) {
      tick({moveX:push});const now=at();
      if(f===settle){from=p.pos.x;reaches=0;both=0;}
      for(const i of [0,1]) {
        const going=Math.abs(now[i]-was[i])>.005;
        if(going&&!moving[i]){reaches++;started[i]=was[i];}
        if(!going&&moving[i])longest=Math.max(longest,Math.abs(was[i]-started[i]));
        moving[i]=going;
      }
      if(f>=settle){if(!moving[0]&&!moving[1])both++;apart=[Math.min(apart[0],Math.abs(now[1]-now[0])),Math.max(apart[1],Math.abs(now[1]-now[0]))];}
      was=now;
    }
    const seconds=(frames-settle)/60,travel=Math.abs(p.pos.x-from),speed=travel/seconds,cycles=reaches/2,stride=travel/cycles;
    assert.ok(Math.abs(speed-push*p.ledgeHands.traverseSpeed)<.05,`push ${push}: he shimmies at ${speed} m/s`);
    assert.ok(Math.abs(stride-p.ledgeHands.stride)<.06,`push ${push}: a hand reaches every ${stride} m of lip, not every ${p.ledgeHands.stride}`);
    assert.ok(cycles/seconds<2.3,`push ${push}: the hands go round ${cycles/seconds} times a second`);
    assert.ok(longest<p.ledgeHands.stride+.08,`push ${push}: a hand reached ${longest} m`);
    assert.ok(both/(frames-settle)>.12,`push ${push}: he never hangs from both hands (${both} frames)`);
    assert.ok(apart[0]>.3&&apart[1]<1.05,`push ${push}: hands ${apart} m apart`);
    results.push({kind:'rhythm',push,speed,stride,cyclesPerSecond:cycles/seconds,longest,bothPlanted:both/(frames-settle),apart});
  }
  reset();
  p.onFootJumpStudy=null;runtime.setDocument(original);
  for(let f=0;f<50;f++)tick({moveX:1});
  const switchPosition=p.pos.clone();
  p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};runtime.setDocument(suite);tick();
  assert.ok(p.pos.distanceTo(switchPosition)<.01,'switching back to D moved the controller');
  assert.ok(p.ledgeGripError<.003,'switching back to D reused stale hand plants');
  assert.ok(Math.abs(point('hips').x-p.pos.x)<.01,'D retained an old ledge position');
  runtime.dispose();console.log(JSON.stringify({status:'pass',frames:1731,results,switchBack:'pass'},null,2));
},{levelEntry:{id:'jak-traverse',name:'Ledge traverse',data:{v:1,name:'Ledge traverse',spawn:[0,.02,5],killY:-30,components:[
  {t:'platform',p:[0,-.5,0],s:[80,1,80]},{t:'platform',p:[0,1.8,-4],s:[20,3.6,5]},{t:'gate',p:[0,0,-30]}]}}});
