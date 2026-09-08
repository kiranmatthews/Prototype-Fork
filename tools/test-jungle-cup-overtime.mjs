import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async ({ THREE, server, player, level, step, CONST }) => {
  const { JungleCupEvent } = await server.ssrLoadModule('/src/competition/event.ts');
  const fresh = () => { const e=new JungleCupEvent(()=>.5);e.startRun();e.stepPresentation(3);return e; };
  const event=fresh();
  assert.equal(event.stepRun(59.99,1234,true),false);
  assert.equal(event.overtime,false);
  assert.equal(event.stepRun(.02,1234,true),false);
  assert.equal(event.remaining,0);assert.equal(event.overtime,true);assert.equal(event.phase,'running');
  document.body.dataset={};document.head=document.createElement('head');
  const { CompetitionPresentation }=await server.ssrLoadModule('/src/competition/presentation.ts');
  const presentation=new CompetitionPresentation(()=>{});presentation.render(event);
  assert.ok(presentation.element.innerHTML.includes('0:00'),'overtime clock did not render zero');
  assert.ok(presentation.element.innerHTML.includes('FINAL COMBO'),'overtime HUD cue missing');
  for(let i=0;i<100;i++)assert.equal(event.stepRun(60,1234+i,true),false,'overtime imposed a duration limit');
  assert.equal(event.runs.length,0,'judges ran before the combo resolved');
  event.stepPresentation(600);assert.equal(event.overtime,true,'pause/presentation consumed overtime');
  event.comboResolved();
  assert.equal(event.stepRun(1/60,20000,true),true,'same-frame new combo reopened overtime');
  assert.equal(event.runs[0].gameplayScore,20000,'final bank was not judged');
  assert.equal(event.remaining,0);assert.equal(event.overtime,false);
  assert.equal(event.stepRun(60,50000,true),false);assert.equal(event.runs.length,1,'run judged twice');
  event.stepPresentation(3);event.showStandings();event.startRun();
  assert.equal(event.remaining,60);assert.equal(event.overtime,false,'overtime leaked into next run');
  event.stepPresentation(3);assert.equal(event.stepRun(60,100,true),false,'old resolution latch leaked');
  const empty=fresh();assert.equal(empty.stepRun(60,456,false),true,'empty air received overtime');
  const early=fresh();early.comboResolved();assert.equal(early.stepRun(60,0,true),false,'pre-buzzer bank blocked a later combo');

  const place=()=>{
    player.respawn(level,true,true,{position:new THREE.Vector3(0,.1,14),heading:new THREE.Vector3(0,0,-1)});
    player.groundHit=player.queryGround(level);player.rideNormal.copy(player.groundHit.normal);
    player.freeSkate=true;player.speed=12;player.onWipeout=()=>{};
    player.onComboBank=()=>{};player.onComboBail=()=>{};
  };
  const seedCombo=()=>{player.comboPoints=120;player.comboMult=3;player.comboHasTrick=true;player.comboLabels=['Manual'];player.comboTimer=.2;};
  // A real manual survives the buzzer; releasing it uses normal link grace,
  // and the ordinary bank callback closes the event with the final purse.
  place();seedCombo();player.manualing=1;player.points=1234;
  const manual=fresh();manual.remaining=.01;
  player.onComboBank=()=>manual.comboResolved();player.onComboBail=()=>manual.comboResolved();
  for(let i=0;i<12;i++){
    step(makeInput());assert.equal(manual.stepRun(CONST.fixedStep,player.points,player.competitionComboActive),false);
  }
  assert.equal(player.manualing,1);assert.equal(player.points,1234,'manual was forcibly cashed at zero');
  assert.equal(manual.remaining,0);assert.equal(manual.overtime,true);
  player.manualing=0;player.comboTimer=.1;
  for(let i=0;i<15&&manual.phase==='running';i++){
    step(makeInput());manual.stepRun(CONST.fixedStep,player.points,player.competitionComboActive);
  }
  assert.equal(manual.phase,'judges');assert.equal(manual.runs[0].gameplayScore,1594);
  // Bail at zero loses only the pending combo, includes the last bail, and
  // cannot respawn into another extension of the already-ended run.
  place();seedCombo();player.points=1234;
  const bail=fresh();player.onWipeout=()=>bail.bail();player.onComboBail=()=>bail.comboResolved();
  bail.stepRun(60,player.points,player.competitionComboActive);player.bail();
  assert.equal(player.competitionComboActive,false);
  assert.equal(bail.stepRun(CONST.fixedStep,player.points,player.competitionComboActive),true);
  assert.equal(bail.runs[0].gameplayScore,1234);assert.equal(bail.runs[0].bails,1);
  // A protected wipeout that preserves the string is still the same combo.
  place();seedCombo();const protectedRun=fresh();
  protectedRun.stepRun(60,player.points,player.competitionComboActive);
  player.bail(true);
  assert.equal(player.competitionComboActive,true,'protected combo was cut off during recovery');
  assert.equal(protectedRun.stepRun(1/60,player.points,player.competitionComboActive),false);

  // An already-started flip is visible as a live combo before its award.
  place();player.state='air';player.grounded=false;player.airFromSkate=true;player.airGrav='board';
  assert.equal(player.competitionComboActive,false,'bare ollie extended the clock');
  player.flipT=.2;player.flipName='Kickflip';assert.equal(player.competitionComboActive,true,'pending flip lost at buzzer');
  player.bail();assert.equal(player.competitionComboActive,false);

  // Always skate: keep the wipeout, then recall a board without ANY input.
  place();player.speed=20;player.bail();assert.ok(player.bailTimeLeft>0);assert.equal(player.freeSkate,false);
  let recovered=false;
  for(let i=0;i<600;i++){
    step(makeInput());
    if(player.bailTimeLeft===0&&player.grounded){recovered=true;break;}
  }
  assert.ok(recovered,'neutral recovery never completed');
  assert.equal(player.freeSkate,true,'recovered on foot');assert.equal(player.boardSnapT,0);
  assert.equal(player.flyBoard,null,'loose board still owned the mounted rider');
  assert.equal(player.totalDeaths,0);
  place();player.throwBoard(true);player.freeSkate=false;player.boardSnapT=10;player.skateBlockT=10;
  step(makeInput());assert.equal(player.freeSkate,true,'other board loss was not recalled');assert.equal(player.boardSnapT,0);
  place();player.pos.y=5;player.prevPos.copy(player.pos);player.state='air';player.grounded=false;
  player.freeSkate=false;player.airFromSkate=false;player.airGrav='foot';player.vVel=-2;player.boardSnapT=10;
  step(makeInput());assert.equal(player.freeSkate,true,'air recovery retained a foot state');
  assert.equal(player.airFromSkate,true);assert.equal(player.airGrav,'board');assert.equal(player.boardSnapT,0);
  // Extra ollie presses cannot turn park skating into a foot/eject mode.
  place();player.chargeTimer=.4;player.chargedJump(CONST.fixedStep);
  for(let cycle=0;cycle<3;cycle++){
    step(makeInput({jumpHeld:true,jumpPressed:true}));
    for(let i=0;i<3;i++)step(makeInput({jumpHeld:true}));
    step(makeInput({jumpReleased:true}));
    assert.equal(player.airFromSkate,true);assert.equal(player.freeSkate,true);assert.equal(player.emergencyEjectUsed,false);
  }
  // Circle+down is still a board grab, not the on-foot pancake slam.
  place();player.chargeTimer=.4;player.chargedJump(CONST.fixedStep);
  step(makeInput({moveY:-1,grabHeld:true,grabPressed:true}));
  assert.equal(player.slamActive,false);assert.equal(player.airFromSkate,true);assert.equal(player.grabPhase,'enter');
  // The third vert release is consumed without dropping the deck.
  place();player.pos.set(28,.1,-42);player.axisF.set(1,0,0);player.axisL.set(0,0,-1);player.speed=23;
  for(let i=0;i<240&&!player.vertAir;i++)step(makeInput({moveY:1,jumpHeld:true,jumpPressed:i===0}));
  assert.equal(player.vertAir,true);
  for(let i=0;i<2;i++){step(makeInput({jumpHeld:true,jumpPressed:true}));step(makeInput({jumpReleased:true}));}
  assert.equal(player.vertBoardRelease.stage,3);assert.equal(player.freeSkate,true);assert.equal(player.airFromSkate,true);
  assert.equal(player.emergencyEjectUsed,false);assert.equal(player.flyBoard,null);
  console.log('PASS competition overtime: 100-minute extension, final bank/bail, same-tick resolution, reset/pause, real manual linking and pending flips; always-skate neutral bail/board recovery and blocked foot exits.');
});
