import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,player:p,level,step,CONST})=>{
 const {JungleCupEvent,COMPETITION_TUNING:t}=await server.ssrLoadModule('/src/competition/event.ts');
 const {advanceComboCashInDisplay}=await server.ssrLoadModule('/src/comboHud.ts');
 const beeps=[],event=new JungleCupEvent(()=>.5,second=>beeps.push(second));
 event.startRun();event.stepPresentation(3);
 for(let i=0;i<3600;i++)event.stepRun(CONST.fixedStep,0,false,false);
 assert.deepEqual(beeps,[3,2,1]);assert.equal(event.remaining,0);assert.equal(event.phase,'running');
 for(let i=0;i<600;i++)event.stepRun(.1,0,false,false);
 assert.deepEqual(beeps,[3,2,1],'zero/pause repeated the countdown cue');
 assert.equal(event.stepRun(0,0,false,true),true);assert.equal(event.phase,'finishing');
 assert.equal(event.stepFinish(10,false,true),false,'judges appeared before dismount');
 assert.equal(event.stepFinish(t.finishBeat-.01,true,true),false,'post-dismount beat was skipped');
 assert.equal(event.stepFinish(.01,true,false),false,'unfinished HUD tally was skipped');
 assert.equal(event.stepFinish(0,true,true),true);assert.equal(event.runs.length,1);
 assert.equal(event.stepFinish(10,true,true),false,'run judged twice');
 event.stepPresentation(3);event.showStandings();event.startRun();event.stepPresentation(3);
 event.stepRun(60,0,false,false);
 assert.deepEqual(beeps,[3,2,1,3,2,1],'next run did not get its own three cues');

 const place=()=>{
  p.respawn(level,true,true,{position:new THREE.Vector3(0,.1,14),heading:new THREE.Vector3(0,0,-1)});
  p.freeSkate=true;p.speed=12;p.groundHit=p.queryGround(level);p.pos.y=p.groundHit.y;
  p.rideNormal.copy(p.groundHit.normal);p.prevPos.copy(p.pos);
  p.prepareStartPresentation(level);
 };
 // An ordinary ollie with no score/trick keeps the run alive at zero.
 place();p.chargeTimer=.4;p.chargedJump(CONST.fixedStep);
 const air=new JungleCupEvent(()=>.5);air.startRun();air.stepPresentation(3);air.remaining=.01;
 assert.equal(p.competitionComboActive,false);
 let landed=false;
 for(let i=0;i<240;i++){
  step(makeInput());
  if(air.stepRun(CONST.fixedStep,p.points,p.competitionComboActive,p.competitionReadyToStop)){
   assert.equal(p.grounded,true);assert.equal(p.state,'ride');landed=true;break;
  }
  assert.equal(air.phase,'running');assert.equal(air.runs.length,0);
 }
 assert.ok(landed,'bare air never reached a supported finish');
 const before=p.pos.clone();p.beginCompetitionFinish(level);
 assert.equal(p.freeSkate,false);assert.ok(p.competitionParkedBoard?.visible);
 let sawLift=false;
 for(let i=0;i<37;i++){
  step(makeInput({jumpHeld:true,jumpReleased:true,spinPressed:true,grindHeld:true,moveX:1}));
  assert.equal(p.freeSkate,false,'always-skate remounted during the dismount');
  assert.equal(p.isBailing,false);assert.equal(p.state,'ride');
  assert.equal(p.flipT,0);assert.equal(p.speed,0);
  sawLift ||= p.riderG.position.y>.04;
 }
 assert.ok(sawLift,'dismount only hid the board without a visible hop');
 assert.ok(p.competitionDismounted);assert.ok(p.pos.distanceTo(before)>.4);
 assert.ok(p.pos.distanceTo(before)<.8);assert.ok(Math.abs(p.pos.y-p.queryGround(level).y)<.01);
 const parked=p.competitionParkedBoard;
 // The real purse-to-score algorithm can take longer than a fixed beat.
 let purse=100000,shown=0,frames=0;
 while(purse>0){
  assert.equal(air.stepFinish(CONST.fixedStep,true,false),false);
  ({combo:purse,score:shown}=advanceComboCashInDisplay(purse,shown,100000,false));frames++;
 }
 assert.ok(frames>60);assert.equal(shown,100000);
 assert.equal(air.stepFinish(0,true,true),true);
 p.respawn(level,true);assert.equal(parked.parent,null,'retry leaked the parked board');
 assert.equal(p.competitionDismounted,false);
 step(makeInput());assert.equal(p.freeSkate,true,'next run did not restore always-skate');

 place();p.state='grind';assert.equal(p.competitionReadyToStop,false);
 place();p.manualing=1;assert.equal(p.competitionReadyToStop,false);
 place();p.grabPhase='exit';assert.equal(p.competitionReadyToStop,false);
 place();p.bail();assert.equal(p.competitionReadyToStop,false);
 console.log('PASS skate run finish: exactly 3–2–1 cues, unscored-air landing, combo/pose gates, visible supported dismount, no input/remount during finish, real tally drain, post-dismount beat and retry cleanup.');
});
