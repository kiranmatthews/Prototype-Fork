import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async ({ player:p, level, step, THREE, CONST, server }) => {
  const { JungleCupEvent } = await server.ssrLoadModule('/src/competition/event.ts');
  const place = vert => {
    p.respawn(level,true,true,{position:new THREE.Vector3(0,.1,vert?10:0),heading:new THREE.Vector3(0,0,vert?1:-1)});
    p.axisF.set(0,0,vert?1:-1);p.axisL.set(vert?1:-1,0,0);
    p.freeSkate=true;p.speed=vert?15.3:12;p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);
    if(vert){for(let i=0;i<300&&!p.vertAir;i++)step(makeInput({jumpHeld:true}));assert.ok(p.vertAir);}
    else {p.chargeTimer=.4;p.chargedJump(CONST.fixedStep);}
    assert.equal(p.state,'air');
  };
  for(const [vert,halves] of [[false,1],[true,1],[true,2]])for(const direction of [-1,1]){
    place(vert);const before=p.points,banks=[];p.onComboBank=(amount,label)=>banks.push({amount,label});
    let preview=false,turned=false,lastPreview=null;
    for(let i=0;i<300&&p.state==='air';i++){
      const turning=Math.abs(p.grabSpinAngle)<halves*Math.PI;
      step(makeInput({moveX:turning?direction:0}));
      if(p.comboHudPreview){lastPreview=p.comboHudPreview;preview=true;assert.equal(p.points,before,'pending rotation banked before landing');}
      if(Math.abs(p.grabSpinAngle)>=halves*Math.PI)turned=true;
    }
    assert.ok(turned,`${vert?'vert':'ollie'} did not complete ${halves*180}`);
    assert.ok(preview,'bare spin never displayed a live score');
    assert.equal(p.isBailing,false,'aligned spin bailed');
    assert.equal(p.comboHasTrick,true,'bare spin was hidden as platforming');
    assert.equal(p.comboMult,1,'bare spin created duplicate trick entries');
    assert.equal(p.comboPoints,halves*CONST.ptsSpin);
    assert.ok(p.comboLabels[0].includes(`${halves*180}°`));
    assert.equal(lastPreview.labels,p.comboLabels[0],'spin preview changed stance labels at landing');
    for(let i=0;i<300&&!banks.length;i++)step(makeInput());
    assert.equal(banks.length,1,'bare spin did not emit its cash-in');
    assert.equal(banks[0].amount,halves*CONST.ptsSpin);
    assert.equal(p.points-before,halves*CONST.ptsSpin);
  }
  // The buzzer must preserve a pending rotation, then judge its normal bank.
  place(true);while(Math.abs(p.grabSpinAngle)<Math.PI)step(makeInput({moveX:1}));
  const event=new JungleCupEvent(()=>.5);event.startRun();event.stepPresentation(3);
  p.onComboBank=()=>event.comboResolved();p.onComboBail=()=>event.comboResolved();
  assert.equal(event.stepRun(60,p.points,p.competitionComboActive),false);
  assert.equal(event.overtime,true);
  for(let i=0;i<300&&event.phase==='running';i++){step(makeInput());event.stepRun(CONST.fixedStep,p.points,p.competitionComboActive);}
  assert.equal(event.phase,'judges');assert.equal(event.runs[0].gameplayScore,CONST.ptsSpin);
  place(true);while(Math.abs(p.grabSpinAngle)<Math.PI)step(makeInput({moveX:-1}));
  assert.ok(p.comboHudPreview);p.bail();assert.equal(p.comboHudPreview,null);assert.equal(p.points,0);
  place(false);assert.equal(p.comboHudPreview,null,'unrotated ollie invents a trick');
  assert.equal(p.competitionComboActive,false,'unrotated ollie extends the clock');
  p.grabSpinAngle=Math.PI/2;assert.equal(p.comboHudPreview,null,'quarter turn advertised a landable 180');
  p.grabSpinAngle=Math.PI*.86;assert.equal(p.comboHudPreview.points,CONST.ptsSpin,'landing tolerance lost its spin preview');
  console.log('PASS grabless ollie 180 and vert 180/360 both ways: live preview, clean landing, one multiplier/cash-in, exact points, overtime and bail/no-spin guards.');
});
