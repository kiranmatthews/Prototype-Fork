import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({player:p,level,THREE,step,CONST,server})=>{
  const tricks=await server.ssrLoadModule('/src/skateTricks.ts');
  const scoring=await server.ssrLoadModule('/src/trickScoring.ts');
  const cases=[
    ['kick',-1,0,'Kickflip'],['heel',1,0,'Heelflip'],['imposs',0,1,'Impossible'],['shove',0,-1,'Pop Shove-It'],
    ['hardflip',-1,1,'Hardflip'],['inward-heel',1,1,'Inward Heelflip'],
    ['varial',-1,-1,'Varial Kickflip'],['varial-heel',1,-1,'Varial Heelflip'],
  ];
  for(const [kind,x,y,label] of cases){assert.equal(tricks.deckTrickFromInput(x,y),kind);assert.equal(tricks.deckTrickInfo(kind).label,label);}
  assert.equal(tricks.deckTrickFromInput(0,0),'kick');
  assert.equal(tricks.sampleDeckTrick('shove',1).yaw,Math.PI,'a pop shove-it must be 180, not a 360 shove-it');
  assert.equal(tricks.sampleDeckTrick('varial',1).yaw,Math.PI);
  for(const [kind] of cases){
    for(const t of [0,.05,.25,.5,.75,.99,1])for(const value of Object.values(tricks.sampleDeckTrick(kind,t)))assert.ok(Number.isFinite(value));
    const catchPose=tricks.sampleDeckTrick(kind,1);
    assert.equal(catchPose.riderLift,0);assert.equal(catchPose.deckDrop,0);
  }
  const walls=[[[0,.1,10],[0,0,1]],[[28,.1,-90],[0,0,-1]],[[28,.1,-42],[1,0,0]],[[-28,.1,-70],[-1,0,0]]];
  function place(wall=walls[0]){
    p.respawn(level,true,true,{position:new THREE.Vector3(...wall[0]),heading:new THREE.Vector3(...wall[1])});
    p.axisF.set(...wall[1]);p.axisL.set(wall[1][2],0,-wall[1][0]);p.freeSkate=true;p.speed=15.3;
    p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);
  }
  function launch(wall){
    place(wall);for(let f=0;f<300&&!p.vertAir;f++)step(makeInput({jumpHeld:true}));
    assert.ok(p.vertAir&&!p.grounded,'real ramp did not launch');
  }
  let landings=0,maxRiderOffset=0;
  for(const wall of walls)for(const [kind,x,y,label] of cases){
    launch(wall);
    // An unrelated previous attack cooldown cannot eat a fresh deck command.
    p.spinCd=2;
    const vy=p.vVel;
    step(makeInput({spinHeld:true,spinPressed:true,moveX:x,moveY:y}));
    assert.equal(p.flipKind,kind);assert.equal(p.flipName,label);assert.ok(p.flipT>0);
    assert.ok(Math.abs(p.vVel-(vy-31.1727272727*CONST.fixedStep))<1e-8,'Square injected a flight impulse');
    assert.equal(p.spinTimer,0,'park flip started a body attack');
    let previous=p.boardG.getWorldQuaternion(new THREE.Quaternion()),caught=false;
    for(let f=0;f<180&&!p.grounded;f++){
      const wasFlipping=p.flipT>0;
      step(makeInput());
      maxRiderOffset=Math.max(maxRiderOffset,p.riderG.position.length());
      assert.equal(p.isBailing,false,`${label}: clean early vert trick bailed`);
      const rotation=p.boardG.getWorldQuaternion(new THREE.Quaternion());
      if(wasFlipping&&p.flipT===0){assert.ok(previous.angleTo(rotation)<.4,`${label}: catch snapped the board`);caught=true;}
      previous.copy(rotation);
    }
    assert.ok(caught&&p.grounded,`${label}: did not catch/land`);
    assert.ok(p.comboLabels.includes(label));assert.equal(p.comboPoints,tricks.deckTrickInfo(kind).points);landings++;
  }
  assert.ok(maxRiderOffset<1.2,`foot solver dragged the rider during a flip: ${maxRiderOffset}`);
  // A catch finishing on the touchdown tick scores once; an actually
  // unfinished park flip bails instead of landing with the board mid-turn.
  place();p.pos.y=.02;p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.airFromSkate=true;p.airGrav='board';p.vVel=-1;
  p.flipKind='kick';p.flipName='Kickflip';p.flipT=CONST.fixedStep;p.flipDuration=.34;
  step(makeInput());assert.equal(p.isBailing,false);assert.equal(p.comboPoints,100);assert.equal(p.flipT,0);
  place();p.pos.y=.02;p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.airFromSkate=true;p.airGrav='board';p.vVel=-1;
  p.flipKind='kick';p.flipName='Kickflip';p.flipT=.2;p.flipDuration=.34;
  step(makeInput());assert.equal(p.isBailing,true);assert.equal(p.comboPoints,0);
  // Specials own their full body rotation and consume their actual command.
  for(const kind of ['flip','grab']){
    launch();p.special.award(1200);
    step(makeInput({moveX:kind==='flip'?-1:1}));step(makeInput());
    step(makeInput(kind==='flip'?{moveX:1,spinPressed:true,spinHeld:true}:{moveY:-1,grabPressed:true,grabHeld:true}));
    assert.equal((kind==='flip'?p.specialFlip:p.specialGrab)?.id,kind==='flip'?'kickflip-mctwist':'the-900');
    for(let f=0;f<100&&!p.grounded;f++){
      step(makeInput({grabHeld:kind==='grab'}));
      assert.equal(p.isBailing,false,`${kind}: committed special did not land`);
      assert.ok(p.bodyGroup.quaternion.toArray().every(Number.isFinite));
    }
    assert.ok(p.grounded);assert.equal(p.comboPoints,kind==='flip'?2500:3000);assert.equal(p.comboMult,1);
  }
  // The apex uses exactly the same ballistic integration with Square held.
  launch();while(p.vVel>1)step(makeInput());
  const oldVy=p.vVel;step(makeInput({spinPressed:true,spinHeld:true}));
  assert.ok(Math.abs(p.vVel-(oldVy-31.1727272727*CONST.fixedStep))<1e-8);
  // A second flip can queue in the catch window; its direction is captured
  // on the button edge, even when the stick is released before the catch.
  launch();step(makeInput({spinPressed:true,spinHeld:true}));
  while(p.flipT>.09)step(makeInput());
  step(makeInput({spinPressed:true,spinHeld:true,moveY:-1}));
  for(let f=0;f<10&&p.flipKind!=='shove';f++)step(makeInput());
  assert.equal(p.flipKind,'shove');assert.ok(p.flipT>0);assert.equal(p.comboMult,1);
  while(p.flipT>0)step(makeInput());assert.equal(p.comboMult,2);assert.equal(p.comboPoints,200);
  // Used direction+face chords cannot seed a later special. With a full
  // meter, Left+Square then Right+Square is still Kickflip -> Heelflip.
  launch();p.special.award(1200);
  step(makeInput({moveX:-1,spinPressed:true,spinHeld:true}));
  while(p.flipT>.09)step(makeInput());
  step(makeInput({moveX:1,spinPressed:true,spinHeld:true}));
  for(let f=0;f<10&&p.flipKind!=='heel';f++)step(makeInput());
  assert.equal(p.flipKind,'heel');assert.equal(p.specialFlip,null,'ordinary chord accidentally triggered a special');
  // Holding Square cannot automatically retrigger at the next catch.
  launch();step(makeInput({spinPressed:true,spinHeld:true}));
  for(let f=0;f<40;f++)step(makeInput({spinHeld:true}));
  assert.equal(p.comboMult,1);assert.equal(p.flipT,0);
  // Grab -> Square releases the pose, then performs the latched flip. The
  // still-held Circle must not grab the flipping board again.
  launch();step(makeInput({grabPressed:true,grabHeld:true,moveX:1}));
  for(let f=0;f<8;f++)step(makeInput({grabHeld:true}));
  assert.equal(p.grabTrickName,'Indy');
  step(makeInput({grabHeld:true,spinPressed:true,spinHeld:true,moveY:-1}));
  assert.equal(p.grabPhase,'exit');assert.equal(p.flipT,0);
  for(let f=0;f<14&&p.flipT===0;f++)step(makeInput({grabHeld:true}));
  assert.equal(p.flipKind,'shove');assert.ok(p.flipT>0);assert.equal(p.grabPhase,'none');
  for(let f=0;f<10;f++)step(makeInput({grabHeld:true}));assert.equal(p.grabPhase,'none');
  // Flips own the deck until caught; a late Circle press waits and keeps its
  // chosen grab instead of reading a subsequent steering direction.
  launch();step(makeInput({spinPressed:true,spinHeld:true}));
  while(p.flipT>.09)step(makeInput());
  step(makeInput({grabPressed:true,grabHeld:true,moveY:-1}));assert.equal(p.grabPhase,'none');
  for(let f=0;f<10&&p.grabPhase==='none';f++)step(makeInput({grabHeld:true}));
  assert.equal(p.grabTrickName,'Tailgrab');
  const uses=[...p.comboUses],paid=p.comboPoints;
  for(let f=0;f<6;f++)step(makeInput({grabHeld:true,moveX:-1}));
  assert.equal(p.grabTrickName,'Tailgrab');assert.deepEqual([...p.comboUses],uses);
  assert.ok(p.comboPoints>=paid,'steering repriced an already-started grab');
  // Landed history commits once. Failed attempts do not depreciate future
  // attempts, and bailing cannot refresh the history already landed.
  place();p.state='air';p.grounded=false;
  assert.equal(p.score(100,'Kickflip').pay,100);p.bankCombo();
  assert.equal(p.score(100,'Kickflip').pay,75);p.loseCombo();
  assert.equal(p.score(100,'Kickflip').pay,75);p.bankCombo();
  assert.equal(p.score(100,'Kickflip').pay,50);p.bankCombo();
  assert.equal(p.score(100,'Kickflip').pay,25);p.bankCombo();
  assert.equal(p.score(100,'Kickflip').pay,10);p.bankCombo();
  assert.equal(p.score(100,'Kickflip').pay,10);p.loseCombo();
  const state=p.captureRunState();
  p.respawn(level,false);p.state='air';p.grounded=false;assert.equal(p.score(100,'Kickflip').pay,10);p.loseCombo();
  p.respawn(level,true);p.state='air';p.grounded=false;assert.equal(p.score(100,'Kickflip').pay,100);p.loseCombo();
  p.resumeSuspendedLevel(level,new THREE.Vector3(0,.1,10),state);p.state='air';p.grounded=false;
  assert.equal(p.score(100,'Kickflip').pay,10);p.loseCombo();
  assert.equal(p.score(25,'Box').pay,25);assert.equal(p.score(25,'Box').pay,25);assert.equal(p.comboMult,0);
  // Timed points are increments of the same depreciated trick; they never
  // increase its combo multiplier, and fractional points survive rounding.
  place();p.state='grind';p.score(100,'50-50','grind');
  for(let i=0;i<8;i++)p.awardHeldScore('grind',.25,300);
  assert.equal(p.comboPoints,700);assert.equal(p.comboMult,1);p.bankCombo();
  p.score(100,'50-50','grind');for(let i=0;i<8;i++)p.awardHeldScore('grind',.25,300);
  assert.equal(p.comboPoints,525);assert.equal(p.comboMult,1);p.bankCombo();
  const held=(factor=1)=>({raw:100,paid:Math.round(100*factor),factor,power:1,seconds:0});
  const whole=held(.1),split=held(.1);scoring.extendHeldTrick(whole,300,10);
  for(let i=0;i<600;i++)scoring.extendHeldTrick(split,300,1/60);
  assert.equal(whole.paid,split.paid,'hold scoring depends on frame subdivision');
  assert.ok(whole.paid>70&&whole.paid<310,'long holds did not soften their rate');
  const stop=held();assert.equal(scoring.extendHeldTrick(stop,0,2),0,'stationary grind earned duration points');
  console.log(`PASS ${landings} eight-direction vert flips; apex gravity, buffered flip/grab chains, latched grabs, catch continuity, run/bail/reset history, fractional/timed scoring and world rewards. Rider offset ${maxRiderOffset.toFixed(3)}m.`);
});
