import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE,server,scene,player:p,level,step,CONST,TUNING})=>{
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const rail=new Rail([new THREE.Vector3(0,1,5),new THREE.Vector3(0,1,-115)]);
  level.rails.push(rail);level.grindRails.push(rail);level.root.add(rail.object);scene.updateMatrixWorld(true);
  const fresh=()=>{
    const position=rail.pointAt(2).add(new THREE.Vector3(0,.25,0)),heading=rail.tangentAt(2);
    p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);
    p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=8;p.vVel=0;
    step(makeInput({grindHeld:true,grindPressed:true}));
    assert.equal(p.state,'grind');assert.equal(p.grindRail,rail);
  };
  const seed=(side=1)=>{p.balance=side*.55;p.balanceVel=side*.3;p.balanceAge=2.4;p.noisePhase=1.7;};
  const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-10,`${label}: ${actual} != ${expected}`);
  const carried=(prior,sign=1)=>{
    close(p.balance,prior.value*.9*sign,'needle');close(p.balanceVel,prior.velocity*.9*sign,'momentum');
    close(p.balanceAge,prior.age,'difficulty age');close(p.noisePhase,prior.noise,'noise phase');
  };
  assert.equal(TUNING.balanceReentryRelief,.1);
  // Real Square + charged-ollie departures and Triangle catches. The exact
  // departure snapshot includes that step's balance motion; air must not
  // integrate, reseed or gradually erase it.
  for(const side of [-1,1]){
    fresh();
    for(let hop=0;hop<3;hop++){
      // Centre actively while charging, then test the catch from a known lean.
      for(let i=0;i<15;i++)step(makeInput({jumpHeld:true,grindHeld:true,moveX:-Math.sign(p.balance+p.balanceVel*.12)}));
      seed(side);p.balanceAge+=hop;
      const mult=p.comboMult;
      step(makeInput({jumpReleased:true,grindHeld:true,spinPressed:true,spinHeld:true}));
      assert.equal(p.state,'air');assert.ok(p.flipT>0);
      const prior={...p.comboBalance};assert.ok(Math.abs(prior.value)>.5);
      let caught=false;
      for(let i=0;i<100;i++){
        step(makeInput({grindHeld:true,grindPressed:true}));
        assert.deepEqual(p.comboBalance,prior,'air erased the saved balance');
        if(p.state==='grind'){carried(prior);caught=true;break;}
        assert.equal(p.isBailing,false);
      }
      assert.ok(caught,'real ollie/flip never recaught rail');assert.ok(p.comboMult>=mult+2);
    }
  }
  // A style change is continuous balancing: no catch relief, no time reset.
  fresh();seed();const age=p.balanceAge;
  step(makeInput({grindHeld:true,grindPressed:true,moveY:1}));
  assert.equal(p.grindStyle,'nose');assert.ok(p.balance>.55);assert.ok(p.balanceAge>age);

  // Cross-mode catches share the same history, including the direct
  // manual -> grind path that formerly zeroed the newly caught meter.
  for(const side of [-1,1]){
    fresh();seed(side);p.railLeft();const grind={...p.comboBalance};p.grindRail=null;p.state='ride';
    p.enterManual(1);carried(grind);seed(side);
    p.enterGrind(rail,rail.closest(rail.pointAt(2)),level);
    assert.equal(p.manualing,0);carried({value:side*.55,velocity:side*.3,age:2.4,noise:1.7});
    step(makeInput({grindHeld:true}));assert.ok(Math.abs(p.balance)>.49,'stale manual cleanup erased grind');
    p.railLeft();p.grindRail=null;p.state='ride';p.enterManual(-1);seed(side);
    p.endManual();const manual={...p.comboBalance};
    p.state='air';p.balanceVel=0; // ordinary air clears only the hidden live meter
    p.enterManual(1);carried(manual);
    p.endManual();const second={...p.comboBalance};p.enterManual(-1);carried(second);
    close(Math.abs(p.balance),.55*.9*.9,'two entries grant two small reliefs');
  }
  // Lip meters can point along either screen axis; preserve their displayed
  // side, not an internal pipe-local sign, when returning to another meter.
  level.buildVertRamp({t:'vertramp',p:[0,0,-50],len:16,w:3,rise:6,vkind:'half'});scene.updateMatrixWorld(true);
  const hp=level.halfpipes.at(-1);
  for(const side of [-1,1]){
    fresh();seed(side);p.railLeft();p.grindRail=null;const prior={...p.comboBalance};
    p.pos.set(hp.lipX,hp.lipY,-50);p.enterLipStall(hp);carried(prior,p.lipDispSign);
    p.lipDrop(false);const lip={...p.comboBalance};p.enterManual(1);carried(lip);
  }
  for(const finish of ['bankCombo','loseCombo']){
    fresh();seed();p.railLeft();p.grindRail=null;p.state='ride';p[finish]();
    assert.equal(p.comboBalance,null);p.enterManual(1);
    assert.equal(p.balance,0);assert.equal(p.balanceVel,0);assert.equal(p.balanceAge,0);
  }
  fresh();seed();p.railLeft();fresh();
  assert.equal(p.comboBalance,null);close(Math.abs(p.balance),CONST.balanceStart,'fresh catch');
  assert.equal(p.balanceVel,0);assert.equal(p.balanceAge,0);
  console.log('PASS balance carry: six real rail ollie/flip catches, both signs, 90% offset/momentum, retained age/noise, cross-mode/manual/lip links, no style-change relief, and fresh bank/bail/respawn resets.');
});
