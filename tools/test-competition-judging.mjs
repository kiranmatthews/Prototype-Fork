import assert from 'node:assert/strict';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({server,player:p})=>{
  const {JungleCupEvent,judgeRun,COMPETITION_TUNING:T}=await server.ssrLoadModule('/src/competition/event.ts');
  const mark=(score,bails,idle=0)=>judgeRun(score,bails,()=>.5,idle).score;
  const huge=T.perfectRunTarget*T.hugeScoreMultiple;
  assert.ok(mark(huge,1)>mark(T.perfectRunTarget,1)+2.9);
  assert.ok(mark(huge,2)>96,'two bails should remain competitive with a huge score');
  assert.ok(mark(huge,2)-mark(huge,3)>6,'third bail received first-two forgiveness');
  assert.ok(mark(T.perfectRunTarget/2,0)-mark(T.perfectRunTarget/2,1)>3.7,'ordinary bail cost was weakened');
  const run=()=>{const e=new JungleCupEvent(()=>.5);e.startRun();e.stepPresentation(3);return e;};
  const idle=(e,seconds,dt=1/60)=>{for(let t=0;t<seconds-1e-8;t+=dt){const step=Math.min(dt,seconds-t);e.trackActivity(step,false);e.stepRun(step,huge,true,false);}};
  const e=run();idle(e,12);assert.equal(e.inactivityPenalty,0);
  idle(e,8);assert.ok(Math.abs(e.inactivityPenalty-8)<1e-8,'20-second break should cost eight marks');
  assert.ok(mark(huge,0,e.inactivityPenalty)<92,'respectable score erased long inactivity');
  const retained=e.inactivityPenalty;e.trackActivity(1/60,true);
  assert.equal(e.idleSeconds,0);assert.equal(e.inactivityPenalty,retained,'one trick erased the accumulated deduction');
  idle(e,20);assert.ok(Math.abs(e.inactivityPenalty-16)<1e-8,'separate long gaps were not accumulated');
  const idleWhole=run();idle(idleWhole,60);assert.equal(idleWhole.inactivityPenalty,T.idlePenaltyMax);
  assert.equal(mark(0,0,idleWhole.inactivityPenalty),0,'doing nothing for the whole heat received a respectable mark');
  const oldPenalty=idleWhole.inactivityPenalty;idleWhole.trackActivity(120,false);
  assert.equal(idleWhole.inactivityPenalty,oldPenalty,'overtime added an inactivity penalty');
  const fine=run(),coarse=run();idle(fine,25,1/120);idle(coarse,25,1/20);
  assert.ok(Math.abs(fine.inactivityPenalty-coarse.inactivityPenalty)<1e-8,'deduction depends on frame rate');
  for(const phase of ['intro','countdown','finishing','judges','standings']){
    const menu=run();menu.phase=phase;menu.trackActivity(100,false);assert.equal(menu.inactivityPenalty,0);
  }
  const heat=run();const skies=[];
  for(let i=0;i<3;i++){
    skies.push(heat.heatLook.sky);heat.trackActivity(20,false);
    heat.stepRun(60,huge,false,true);heat.stepFinish(T.finishBeat,true,true);
    assert.equal(heat.runs[i].inactivityPenalty,8);assert.equal(heat.heatLook.sky,skies[i]);
    heat.stepPresentation(3);heat.showStandings();
    if(i<2){heat.startRun();assert.equal(heat.inactivityPenalty,0);assert.equal(heat.idleSeconds,0);heat.stepPresentation(3);}
  }
  assert.deepEqual(skies,['day','sunset','night']);assert.equal(new JungleCupEvent().heatLook.sky,'day');
  // A stale combo on the ground cannot pretend the skater is still doing a trick.
  p.comboHasTrick=true;p.comboMult=10;p.state='ride';p.grounded=true;p.speed=10;
  assert.equal(p.competitionPerformingTrick,false);
  p.manualing=1;assert.equal(p.competitionPerformingTrick,true);p.manualing=0;
  p.state='grind';assert.equal(p.competitionPerformingTrick,true);p.speed=0;assert.equal(p.competitionPerformingTrick,false);
  p.state='air';p.grounded=false;p.airFromSkate=true;assert.equal(p.competitionPerformingTrick,true);
  p.state='dead';assert.equal(p.competitionPerformingTrick,false);
  // The Canvas HUD must still paint the portrait when its number has no DOM
  // layout, and must resume ordinary counters on leaving the competition.
  const {GameHudSurface}=await server.ssrLoadModule('/src/gameHudSurface.ts');
  const surface=Object.create(GameHudSurface.prototype);let avatarOnly=true;
  surface.elements={lifeRow:{isConnected:false,classList:{contains:()=>avatarOnly}}};
  let faces=0,numbers=[],labels=[];
  surface.drawLifeFace=()=>faces++;surface.drawRooInRect=(_ctx,value)=>numbers.push(value);
  surface.drawPlainText=(_ctx,value)=>labels.push(value);
  const paint=life=>surface.paintCounters({}, {},1280,720,{crates:null,fruit:null,life},0);
  paint(null);assert.equal(faces,1);assert.deepEqual(numbers,[]);assert.deepEqual(labels,[]);
  paint({value:7,deathsMode:true});assert.equal(faces,2);assert.deepEqual(numbers,[]);assert.deepEqual(labels,[]);
  avatarOnly=false;paint({value:7,deathsMode:true});assert.deepEqual(numbers,['7']);assert.deepEqual(labels,['DEATHS']);
  console.log(`PASS judging: huge score marks ${[0,1,2,3].map(b=>mark(huge,b)).join('/')} for 0–3 bails; 20s idle costs 8, 25s costs ${fine.inactivityPenalty.toFixed(3)}; no pause/overtime penalty, retained separate gaps, reset and day/sunset/night heat sequence.`);
  console.log('PASS avatar-only Canvas HUD: portrait retained, both numeric modes suppressed, ordinary counters restored.');
});
