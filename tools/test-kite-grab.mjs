import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data={v:1,name:'Kite Indy fixture',kiteTow:true,startWarpPad:false,spawn:[0,.12,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,-600],s:[200,1,1600]},{t:'gate',p:[0,0,-1300]}]};
const report={};
await withSkateRuntime(async({player:p,level,step,TUNING,server,THREE,Level})=>{
  const {KiteGrab,KITE_GRAB}=await server.ssrLoadModule('/src/kiteGrab.ts');
  const {KiteTowMotion}=await server.ssrLoadModule('/src/kiteTow.ts');
  report.unwinds=[];
  for(const hz of [30,60,120])for(const sign of [-1,1]){
    const g=new KiteGrab(),dt=1/hz;
    for(let i=0;i<Math.round(.8*hz);i++)g.step(dt,{airborne:true,pressed:i===0,held:true,steer:sign,canStart:true});
    const release=g.angle;assert.ok(Math.abs(release)>6,'A full turn retains its tether twist');
    g.step(dt,{airborne:true,pressed:false,held:false,steer:0,canStart:true});
    assert.ok(Math.abs(g.angle)<Math.abs(release),'Reverse rotation begins on release');
    const duration=g.returnDuration;let crossed=false;
    for(let i=0;i<hz*3&&g.phase!=='ready';i++){
      g.step(dt,{airborne:true,pressed:true,held:true,steer:-sign,canStart:true});
      crossed ||= g.angle*release<0;
    }
    assert.ok(crossed,'Return overshoots the original orientation');
    assert.equal(g.phase,'ready');assert.equal(g.angle,0);assert.equal(g.hang,0);assert.equal(g.pose,0);
    assert.ok(duration>.9,'Whole turns need time to unwind');
    assert.equal(g.land().earned,true);assert.equal(g.land().earned,false,'Only one payout per landing');
    report.unwinds.push({hz,sign,duration,crossed});
  }
  const tick=v=>step(makeInput(v));
  const reset=()=>{p.respawn(level,true);p.kiteMotion.reset(17);p.endlessDeaths=true;tick({grabPressed:true,grabHeld:true});for(let i=0;i<40;i++)tick({});};
  const jump=()=>{for(let i=0;i<24;i++)tick({jumpHeld:true,jumpPressed:i===0});tick({jumpReleased:true});assert.equal(p.state,'air');};
  const land=()=>{
    for(let i=0;i<240&&!p.grounded&&p.state!=='dead';i++){
      tick({});
      if(p.kiteGrab.hang>.001){
        const error=p.kiteVisual.gripErrors[p.kiteVisual.hangingHand];
        assert.ok(error<.04,`Bar contact through unwind: ${JSON.stringify({error,...p.kiteGrab.diagnostics})}`);
      }
    }
    return {state:p.state,speed:p.speed,boost:p.kiteDiagnostics.grab.boost};
  };
  const grab=(frames=12,steer=0)=>{for(let i=0;i<frames;i++)tick({grabPressed:i===0,grabHeld:true,moveX:steer});};

  reset();assert.equal(p.grabPhase,'none','Circle on the ground does not start an aerial grab');
  jump();const empty=land();assert.equal(empty.boost,0);
  reset();jump();grab();
  assert.equal(p.grabKind,'indy');assert.equal(p.grabPhase,'held');
  const contact=p.boardG.userData.skateGrab;
  report.held={diagnostics:p.kiteDiagnostics,contact,feet:p.boardG.userData.skateContact};
  assert.equal(contact.kind,'indy');assert.ok(contact.error<.04,`Indy contact ${contact.error}`);
  const barHand=p.stance>0?0:1;
  assert.equal(p.kiteVisual.hangingHand,barHand);
  assert.ok(p.kiteVisual.gripErrors[barHand]<.04,`Hanging bar contact ${p.kiteVisual.gripErrors[barHand]}`);
  assert.ok(p.kiteVisual.gripErrors[1-barHand]>.25,'Trailing hand is released from the bar');
  report.contacts=[];
  const originalStance=p.stance;
  for(const stance of [-1,1])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]){
    p.stance=stance;p.grabSpinAngle=angle;p.kiteVisual.hangingHand=null;
    for(let i=0;i<8;i++)p.finishVisualStep(makeInput(),1/60);
    const held=stance>0?0:1,grab=p.boardG.userData.skateGrab;
    const socket=p.riderG.getObjectByName(grab.hand);
    const boardError=socket.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...grab.target));
    const sample={stance,angle,barError:p.kiteVisual.gripErrors[held],boardError,footError:p.boardG.userData.skateContact.footError};
    report.contacts.push(sample);
    assert.ok(sample.barError<.04&&sample.boardError<.04&&sample.footError<.04,JSON.stringify(sample));
  }
  p.stance=originalStance;p.grabSpinAngle=0;p.kiteVisual.hangingHand=null;p.finishVisualStep(makeInput(),1/60);
  tick({});const earned=land();assert.equal(earned.state,'ride');assert.equal(earned.boost,KITE_GRAB.boost);
  assert.ok(Math.abs(earned.speed-empty.speed-KITE_GRAB.boost)<.02,'Landing reward is added to existing speed');
  report.clean={empty,earned};
  for(let stack=2;stack<=5;stack++){
    jump();grab();tick({});const result=land();
    assert.equal(result.boost,Math.min(KITE_GRAB.boostMax,KITE_GRAB.boost*stack));
  }
  const high=p.speed;p.applyPerfectGrind();
  assert.ok(p.speed>=Math.max(high,TUNING.perfectGrindSpeed+KITE_GRAB.boostMax),'Perfect grind keeps the independent kite stack');
  p.kiteMotion.speed=p.speed;tick({});assert.ok(p.speed>high-1,'Next kite step retains other boost momentum');
  report.stacked={speed:p.speed,boost:p.kiteDiagnostics.grab.boost};
  for(let i=0;i<60*10;i++)tick({});assert.equal(p.kiteDiagnostics.grab.boost,0,'Bonus expires finitely');
  reset();jump();for(let i=0;i<180&&p.state!=='dead';i++)tick({grabPressed:i===0,grabHeld:true});
  assert.equal(p.state,'dead','Landing while holding the grab fails');assert.equal(p.kiteDiagnostics.grab.boost,0);
  assert.equal(p.breakApart.tetherDiagnostics.length,1,'Only the hand actually holding the bar stays tethered');
  reset();jump();for(let i=0;i<180&&p.state==='air';i++){
    const late=p.vVel<0&&p.pos.y<.75;
    tick({grabPressed:i===0,grabHeld:!late,moveX:!late?.65:0});
  }
  assert.equal(p.state,'dead','Touchdown during unwind fails');
  reset();jump();grab(12,.65);tick({});const rotated=land();
  assert.equal(rotated.state,'ride');assert.equal(rotated.boost,KITE_GRAB.boost);
  assert.equal(p.grabSpinAngle,0);assert.equal(p.kiteVisual.hangingHand,null);
  reset();jump();grab();p.respawn(level,true);assert.equal(p.kiteDiagnostics.grab.phase,'idle');assert.equal(p.kiteDiagnostics.grab.boost,0);
  // Compare identical tension bursts with and without the additional speed band.
  const bursts=[];
  for(const extra of [0,6]){
    const m=new KiteTowMotion(17);m.started=true;m.speed=26+extra;
    for(let i=0;i<80;i++)m.step(1/60,100,true,{moveX:0,moveY:i<60?-1:0,jumpHeld:false,jumpPressed:false},TUNING,extra);
    bursts.push(m.speed);
  }
  assert.ok(bursts[1]>bursts[0]+4,'Stored kite tension and trick speed combine');report.bursts=bursts;
  const ordinary=new Level(new THREE.Scene(),{id:'ordinary-grab',name:'Ordinary grab',data:{...data,kiteTow:false}});
  try{
    p.respawn(ordinary,true);p.freeSkate=true;p.speed=20;
    const tickOrdinary=v=>{const input=makeInput(v);ordinary.update(1/60);p.step(1/60,input,ordinary);input.consumeEdges();};
    for(let i=0;i<24;i++)tickOrdinary({jumpHeld:true,moveY:1});tickOrdinary({jumpReleased:true,moveY:1});
    tickOrdinary({grabPressed:true,grabHeld:true,moveX:-1});
    assert.equal(p.grabKind,'melon','Ordinary levels keep their directional grab');
    assert.equal(p.kiteDiagnostics.grab.phase,'idle');
  }finally{ordinary.dispose();}
  report.pass=true;
},{levelEntry:{id:'kite-indy-fixture',name:data.name,data}});
await mkdir('docs/kite-indy',{recursive:true});
await writeFile('docs/kite-indy/runtime-check.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS kite Indy input, full-turn unwind/overshoot, landing risk, contacts, additive speed and ordinary-level isolation');
