import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/grind-entry-inputs.json',import.meta.url),'utf8'));
await withSkateRuntime(async ({server,THREE,scene,player:p,level,step,TUNING,CONST})=>{
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const {TUNING_RANGES,TUNING_INFO,TUNING_SECTIONS}=await server.ssrLoadModule('/src/tuning.ts');
  const defaults={...TUNING};
  const rail=new Rail([new THREE.Vector3(0,7,25),new THREE.Vector3(0,7,-115)]);
  level.rails.push(rail);level.grindRails.push(rail);level.root.add(rail.object);scene.updateMatrixWorld(true);
  const catchRail=()=>{
    const position=rail.pointAt(2).add(new THREE.Vector3(0,.25,0)),heading=rail.tangentAt(2);
    p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.speed=8;p.vVel=0;
    p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;
    step(makeInput({grindHeld:true,grindPressed:true}));assert.equal(p.state,'grind');
    p.noisePhase=0;
  };
  const old={...defaults,balanceEntryLean:.15,balanceDrift:.9,balanceControl:3,balanceGrace:0,balanceRamp:.25,balanceRampMax:3,balanceInertia:.85,balanceGravity:6,grindCalm:0,balanceSafePeriod:0};
  const times=[];
  for(const c of fixture.cases){
    const result=[];
    for(const profile of [old,defaults]){
      Object.assign(TUNING,profile);catchRail();p.grindStyle=c.style;p.speed=p.grindVel=c.speed;
      p.balance=c.linked?c.balance:Math.sign(c.balance)*TUNING.balanceEntryLean;
      p.balanceVel=c.velocity;p.balanceAge=c.age;p.balanceEntryAge=0;
      let duration=0;
      while(p.state==='grind'&&duration<240){step(makeInput({grindHeld:true,moveX:c.inputX[duration]??0}));duration++;}
      result.push(duration*CONST.fixedStep);
    }
    assert.ok(result[1]>result[0]*1.65,`catch ${c.frame} did not gain meaningful response time: ${result}`);
    assert.ok(result[1]>(c.linked?.3:.7),`catch ${c.frame} still fails before its needle can be read`);
    times.push({frame:c.frame,old:result[0],new:result[1]});
  }
  Object.assign(TUNING,defaults);
  // Actual grind steps; a shared combo age must not bypass catch-only easing.
  const measure=(key,value,{age=4,entryAge=2,balance=.4,velocity=0,input=0,noise=0}={})=>{
    Object.assign(TUNING,defaults,{balanceNoise:noise,[key]:value});catchRail();
    p.balance=balance;p.balanceVel=velocity;p.balanceAge=age;p.balanceEntryAge=entryAge;p.noisePhase=0;
    step(makeInput({grindHeld:true,moveX:input}));return {balance:p.balance,velocity:p.balanceVel,age:p.balanceAge};
  };
  assert.ok(measure('grindCalm',1,{age:12,entryAge:.05}).balance<measure('grindCalm',0,{age:12,entryAge:.05}).balance,'linked age bypassed live grind settling');
  assert.ok(measure('balanceSafePeriod',1,{entryAge:.05,input:1}).balance<measure('balanceSafePeriod',0,{entryAge:.05,input:1}).balance,'catch input easing did not limit outward input');
  const inwardA=measure('balanceSafePeriod',1,{entryAge:.05,input:-1}),inwardB=measure('balanceSafePeriod',0,{entryAge:.05,input:-1});
  assert.equal(inwardA.balance,inwardB.balance,'catch ease suppressed inward correction');
  const pairs=[
    ['balanceDrift',0,1,{}],['balanceGravity',0,6,{balance:.7}],['balanceRamp',0,1,{}],
    ['balanceRampMax',1,4,{age:12}],['balanceNoise',0,.6,{balance:0,noise:.6}],
    ['balanceNoiseFreq',.5,20,{balance:0,noise:.6}],
  ];
  for(const [key,a,b,options]of pairs)assert.notEqual(measure(key,a,options).balance,measure(key,b,options).balance,`${key} has no live grind effect`);
  assert.ok(measure('balanceControl',5,{input:-1}).balance<measure('balanceControl',1,{input:-1}).balance);
  assert.ok(measure('balanceGrace',6).balance<measure('balanceGrace',0).balance);
  assert.ok(measure('balanceEdgePower',5,{balance:.5}).balance<measure('balanceEdgePower',1,{balance:.5}).balance);
  assert.notEqual(measure('balanceInertia',0,{velocity:1,input:-1}).balance,measure('balanceInertia',1,{velocity:1,input:-1}).balance);
  assert.notEqual(measure('balanceSpeedEffect',0).balance,measure('balanceSpeedEffect',2).balance);
  assert.notEqual(measure('grindSpeed',3).balance,measure('grindSpeed',15).balance);
  Object.assign(TUNING,defaults,{balanceEntryLean:.25});catchRail();assert.equal(Math.abs(p.balance),.25);
  // Manual controls: entry and hold thresholds, landing buffer, and live
  // drift/control/settling. Changes affect existing manuals too.
  const manual=(key,value,input=0,entryAge=2)=>{
    Object.assign(TUNING,defaults,{balanceNoise:0,[key]:value});
    p.respawn(level,true,true,{position:new THREE.Vector3(0,.1,10),heading:new THREE.Vector3(0,0,-1)});
    p.freeSkate=true;p.speed=8;p.groundHit=p.queryGround(level);p.pos.y=p.groundHit.y;p.rideNormal.copy(p.groundHit.normal);
    p.enterManual(1);p.balance=.3;p.balanceVel=0;p.balanceAge=6;p.balanceEntryAge=entryAge;
    step(makeInput({moveY:input}));assert.equal(p.manualing,1);return p.balance;
  };
  assert.ok(manual('manualDrift',0)<manual('manualDrift',1));
  assert.ok(manual('manualControl',6,1)<manual('manualControl',1,1));
  assert.ok(manual('manualCalm',1,0,.05)<manual('manualCalm',0,0,.05));
  Object.assign(TUNING,defaults);manual('manualDrift',.5);p.endManual();
  p.speed=4;TUNING.manualMinSpeed=5;assert.equal(p.canManual(),false);assert.equal(p.canHoldManual(),true);
  TUNING.manualMinSpeed=3;assert.equal(p.canManual(),true);
  p.state='air';p.airFromSkate=true;TUNING.manualArmWindow=.8;p.tryManual(1);assert.equal(p.manualArmT,.8);
  const flick=window=>{
    manual('manualFlickWindow',window);p.endManual();p.prevMoveY=0;p.flickUpT=p.flickDownT=1;
    step(makeInput({moveY:1}));for(let i=0;i<15;i++)step(makeInput());step(makeInput({moveY:-1}));return p.manualing;
  };
  assert.equal(flick(.1),0);assert.equal(flick(.5),1);
  const bump=grace=>{
    manual('manualCoyote',grace);p.state='air';p.grounded=false;p.airFromSkate=true;p.pos.y=10;p.prevPos.copy(p.pos);p.vVel=0;
    for(let i=0;i<10;i++)step(makeInput());return p.manualing;
  };
  assert.equal(bump(.05),0);assert.equal(bump(.5),1);
  const landing=grace=>{
    manual('manualLandGrace',grace);p.endManual();p.manualArmed=0;p.manualArmT=0;
    p.state='air';p.grounded=false;p.airFromSkate=true;p.pos.y=.2;p.prevPos.copy(p.pos);p.vVel=-2;p.comboTimer=.15;
    for(let i=0;i<30&&!p.grounded;i++)step(makeInput());assert.equal(p.grounded,true);return p.comboTimer;
  };
  assert.ok(landing(1.1)>landing(.25)+.8);
  for(const grace of [0,.2]){
    Object.assign(TUNING,defaults,{bailGrace:grace});catchRail();p.balance=.999;p.balanceVel=2;
    step(makeInput({grindHeld:true}));assert.equal(p.isBailing,grace===0,'bail buffer does not match its slider');
  }
  // Remaining movement tuners still have their advertised scope.
  const railSpeed=(drag,boost)=>{
    Object.assign(TUNING,defaults,{grindDrag:drag,railSpeedBoost:boost});catchRail();p.balanceBoostT=2;
    const entry=p.grindVel;for(let i=0;i<30;i++)step(makeInput({grindHeld:true}));return [entry,p.grindVel];
  };
  const normal=railSpeed(0,0),dragged=railSpeed(8,0),boosted=railSpeed(0,5);
  assert.ok(dragged[1]<normal[1]-3);assert.ok(boosted[0]>normal[0]+4.9);
  const hop=force=>{Object.assign(TUNING,defaults,{grindJumpForce:force});catchRail();p.balanceBoostT=2;
    for(let i=0;i<12;i++)step(makeInput({grindHeld:true,jumpHeld:true}));
    step(makeInput({grindHeld:true,jumpReleased:true}));assert.equal(p.state,'air');return p.vVel;};
  assert.ok(hop(20)>hop(6)+9);
  TUNING.perfectGrindSpeed=37;TUNING.perfectGrindHold=2;p.applyPerfectGrind();assert.equal(p.speed,37);assert.equal(p.grindBoostT,2);
  const prepareApproach=(t,heading,x=0)=>{
    const position=rail.pointAt(t).add(new THREE.Vector3(x,.25,0));
    p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);p.axisF.copy(heading);
    p.speed=8;p.vVel=0;p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;
    p.lastVelX=heading.x*8;p.lastVelZ=heading.z*8;p.rawInput=makeInput({grindHeld:true,grindPressed:true});
    p.railCand={rail,sample:rail.closest(position)};
  };
  Object.assign(TUNING,defaults);prepareApproach(4,new THREE.Vector3(0,0,-1),1.1);
  TUNING.railSnapDistance=.5;assert.equal(p.tryGrind(true,level),false);
  TUNING.railSnapDistance=2;assert.equal(p.tryGrind(true,level),true);
  prepareApproach(4,new THREE.Vector3(1,0,0));TUNING.grindApproachMargin=30;assert.equal(p.tryGrind(true,level),false);
  TUNING.grindApproachMargin=0;assert.equal(p.tryGrind(true,level),true);
  prepareApproach(rail.totalLength-.05,new THREE.Vector3(0,0,-1));assert.equal(p.tryGrind(true,level),false,'one-frame endpoint catch returned');
  prepareApproach(rail.totalLength-.05,new THREE.Vector3(0,0,1));assert.equal(p.tryGrind(true,level),true,'inward endpoint catch was rejected');
  Object.assign(TUNING,defaults);catchRail();p.balanceBoostT=2;TUNING.underRailCooldown=.7;
  p.underClearance=()=>true;step(makeInput({grindHeld:true,grabPressed:true}));assert.equal(p.underCoolT,.7);
  // Every exposed grind/manual/shared tuner has current documentation,
  // valid defaults and exactly one control in the panel.
  const allKeys=TUNING_SECTIONS.flatMap(section=>section.keys);
  for(const section of TUNING_SECTIONS.filter(section=>['GRINDS','BALANCE · SHARED','MANUAL & LIP'].includes(section.title)))
    for(const key of section.keys){
      assert.equal(allKeys.filter(k=>k===key).length,1,`duplicate slider ${key}`);
      assert.ok(TUNING_INFO[key]?.length>20,`missing help ${key}`);
      const r=TUNING_RANGES[key];assert.ok(defaults[key]>=r.min&&defaults[key]<=r.max,`default outside range ${key}`);
      const steps=(defaults[key]-r.min)/r.step;
      assert.ok(Math.abs(steps-Math.round(steps))<1e-7,`slider rounds away its default ${key}: ${defaults[key]}`);
    }
  // Saved v20 values follow new defaults unless deliberately changed. Loaded
  // out-of-range values cannot disagree with the displayed range control.
  document.body.dataset ??= {};
  const {UI}=await server.ssrLoadModule('/src/ui.ts');
  const valueField={value:''},rangeField={value:''};
  const ui={defaults,sliderEls:new Map([['manualLandGrace',{input:rangeField,value:valueField}]])};
  const savedStorage=globalThis.localStorage;
  globalThis.localStorage={getItem:()=>JSON.stringify({__v:20,tuning:{...old,balanceDrift:.65,balanceControl:3.7},defaults:old})};
  try{
    const saved=UI.prototype.readSaved.call(ui);
    assert.equal(saved.balanceDrift,.65);assert.equal(saved.balanceControl,3.7);assert.equal(saved.grindCalm,.5);assert.equal(saved.balanceSafePeriod,.25);
    UI.prototype.applyTuning.call(ui,{manualLandGrace:0,balanceControl:99});
    assert.equal(TUNING.manualLandGrace,.15);assert.equal(valueField.value,'0.15');assert.equal(rangeField.value,'0.15');assert.equal(TUNING.balanceControl,6);
  }finally{globalThis.localStorage=savedStorage;}
  Object.assign(TUNING,defaults);
  const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
  const driftField={input:{value:''},value:{value:''}};ui.sliderEls.set('balanceDrift',driftField);
  let refreshes=0;const replay=new Replayer(()=>{refreshes++;UI.prototype.syncTuningReadouts.call(ui);});
  replay.begin({v:2,level:'jungle-cup',date:'audit',tuning:{balanceDrift:.6},tuningChanges:[[1,'balanceDrift',.35]],mx:[0,0],my:[0,0],b:[0,0],frames:2,truncated:false,surfaceFrictionPolicy:1});
  assert.equal(driftField.value.value,'0.6');assert.equal(refreshes,1);
  replay.feed(makeInput());assert.equal(refreshes,1);
  replay.feed(makeInput());assert.equal(driftField.value.value,'0.35');assert.equal(driftField.input.value,'0.35');assert.equal(refreshes,2);
  replay.end();assert.equal(driftField.value.value,String(defaults.balanceDrift));assert.equal(refreshes,3);
  console.log(`PASS replay catch comparisons ${JSON.stringify(times)}; live grind/manual dynamics, catch input polarity, retained combo difficulty, landing buffer and slider metadata.`);
});
