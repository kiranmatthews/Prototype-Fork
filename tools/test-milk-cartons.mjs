import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, player, CONST, TUNING }) => {
  const { createMilkCarton, updateMilkCarton, pressMilkCarton } = await server.ssrLoadModule('/src/milkCarton.ts');
  const a=createMilkCarton(.96),b=createMilkCarton(.96);
  assert.equal(a.body.geometry,b.body.geometry); assert.equal(a.top.geometry,b.top.geometry);
  assert.notEqual(a.body.material,b.body.material,'time-trial face swaps must be per crate');
  for(const mesh of [a.body,a.top]) {
    const positions=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal');
    assert.ok(positions.count/3<500,'carton mesh exceeds its small prop budget');
    for(let i=0;i<positions.count;i++){
      assert.ok(Number.isFinite(positions.getX(i)+positions.getY(i)+positions.getZ(i)));
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(normals,i).length()-1)<1e-5);
    }
  }
  const fixtures=[];
  const fixture=(crates)=>{
    const scene=new THREE.Scene();
    const level=new Level(scene,{id:'carton-test',name:'Milk cartons',data:{v:1,name:'Milk cartons',spawn:[4,.02,3],killY:-20,components:[
      {t:'platform',p:[0,-.5,0],s:[20,1,20]},...crates,{t:'gate',p:[0,0,-8]},
    ]}});fixtures.push(level);scene.updateMatrixWorld(true);return level;
  };
  const crate=(y,kind='wood',extra={})=>({t:'crate',p:[0,y,0],kind,...extra});
  try {
    const level=fixture([crate(0),crate(.96),crate(1.92)]);
    const [bottom,middle,top]=level.crates;
    assert.deepEqual(level.crates.map(c=>c.carton.expansion),[0,0,1]);
    const boxes=level.crates.map(c=>c.box.clone());
    level.breakCrate(top);level.update(1/60);
    assert.equal(bottom.carton.expansion,0);
    assert.ok(middle.carton.expansion>0&&middle.carton.expansion<.1,'newly exposed lid should start unfolding gently');
    for(let i=0;i<90;i++)level.update(1/60);
    assert.ok(middle.carton.expansion>.99);
    level.crates.forEach((c,i)=>assert.ok(c.box.equals(boxes[i]),'visual cap changed collision bounds'));
    level.reset(true);
    assert.deepEqual(level.crates.map(c=>c.carton.expansion),[0,0,1],'reset did not restore stack tops');
    level.breakCrate(bottom);
    for(let i=0;i<180;i++)level.update(1/60);
    assert.ok(Math.abs(middle.box.min.y)<1e-5&&Math.abs(top.box.min.y-.96)<1e-5,'stack support/settling changed');
    assert.equal(middle.carton.expansion,0);assert.ok(top.carton.expansion>.99);
    const mixed=fixture([crate(0),crate(.96,'metal')]);
    assert.equal(mixed.crates[0].carton.expansion,0,'a special crate still covers its carton support');
    assert.equal(mixed.crates[1].carton,undefined,'special crate was replaced');
    const ghost=fixture([crate(0),crate(.96,'wood',{outline:true})]);
    assert.equal(ghost.crates[0].carton.expansion,1,'ghosts must not cover solid cartons');
    assert.equal(ghost.crates[1].carton.top.visible,false,'outline leaked an opaque spout');
    ghost.setCratePending(ghost.crates[1],false);ghost.update(1/60);
    assert.equal(ghost.crates[0].carton.expansion,0);assert.equal(ghost.crates[1].carton.top.visible,true);
    ghost.reset(true);assert.equal(ghost.crates[0].carton.expansion,1);assert.equal(ghost.crates[1].carton.top.visible,false);
    // The solid count can stay the same when a destruction and a switch fire
    // together; exposure must still follow the actual column membership.
    const swaps=fixture([crate(0),crate(.96),{t:'crate',p:[3,0,0],kind:'wood'},{t:'crate',p:[3,.96,0],kind:'wood',outline:true}]);
    swaps.update(1/60);swaps.breakCrate(swaps.crates[1]);swaps.setCratePending(swaps.crates[3],false);swaps.update(1/60);
    assert.equal(swaps.crates[0].carton.covered,false);assert.equal(swaps.crates[2].carton.covered,true);
    const row=fixture([{t:'crate',p:[-.96,0,0],kind:'wood'},crate(0),{t:'crate',p:[.96,0,0],kind:'wood'}]);
    row.pressCartonTops(new THREE.Vector3(0,1.1,0),CONST.playerHalf,-4);row.update(1/60);
    assert.equal(row.crates[0].carton.expansion,1);assert.equal(row.crates[2].carton.expansion,1);
    assert.ok(row.crates[1].carton.expansion<.5,'sole contact missed its own carton');
    const print=level.crates[0].carton.body.material.map;
    level.setTimeTrial(true);level.setTimeTrial(false);
    assert.equal(level.crates[0].carton.body.material.map,print,'time-trial restore lost milk print');
    level.setComboRun(true);level.setComboRun(false);
    assert.equal(level.crates[0].carton.body.material.map,print,'combo-mode restore lost milk print');

    // A controlled sole descent must displace the crimp exactly as far as
    // the foot moves, at every speed/frame rate. Pausing weight pauses the fold.
    const contact=fixture([crate(0)]),c=contact.crates[0],sole={x:.2,z:.2};
    let checked=0;
    for(const fps of [30,60,120])for(const speed of [.3,1,3,8]){
      contact.reset(true);
      for(let clearance=.35;clearance>.02;clearance-=speed/fps){
        const foot=new THREE.Vector3(0,c.box.max.y+clearance,0);
        contact.pressCartonTops(foot,sole,-speed);contact.update(1/fps);
        const tip=c.mesh.position.y+.493*.96+.4*.96*c.carton.expansion;
        assert.ok(Math.abs(tip-(foot.y-.002))<1e-5,`spout outran/lagged weight at ${fps} Hz / ${speed} m/s`);
        const before=c.carton.expansion;
        for(let hold=0;hold<3;hold++){contact.pressCartonTops(foot,sole,0);contact.update(1/fps);}
        assert.ok(Math.abs(before-c.carton.expansion)<1e-6,'stationary weight continued crushing');
        assert.ok(c.box.equals(new THREE.Box3(new THREE.Vector3(-.48,0,-.48),new THREE.Vector3(.48,.96,.48))));
        checked++;
      }
    }
    for(let i=0;i<100;i++)contact.update(1/60);
    assert.ok(c.carton.expansion>.99,'unweighted carton did not reopen');
    contact.reset(true);
    contact.pressCartonTops(new THREE.Vector3(0,1.1,0),sole,3);
    assert.equal(c.carton.expansion,1,'ascending player collapsed the spout');
    contact.pressCartonTops(new THREE.Vector3(2,1.1,0),sole,-3);
    assert.equal(c.carton.expansion,1,'side miss collapsed the spout');
    pressMilkCarton(a,.1);updateMilkCarton(a,1/60);
    assert.equal(b.expansion,1,'one carton changed its neighbour');

    // Exercise actual character physics and crate reward/bounce arbitration.
    for(const fallSpeed of [0,5,16]){
      contact.reset(true);player.competitionMode=false;player.respawn(contact,true);
      player.prepareStartPresentation(contact);player.rawInput=makeInput();
      player.pos.set(0,1.7,0);player.prevPos.copy(player.pos);
      player.state='air';player.grounded=false;player.freeSkate=false;player.airFromSkate=false;
      player.airRose=true;player.airPeakY=2;player.airGrav='foot';player.vVel=-fallSpeed;player.speed=0;
      for(let frame=0;frame<90&&c.alive;frame++){
        player.step(CONST.fixedStep,player.rawInput,contact);contact.update(CONST.fixedStep);
        if(c.alive&&c.carton.expansion<1){
          let soleY=Infinity;
          for(const {sole} of player.proceduralFootwear){
            sole.updateWorldMatrix(true,false);
            const points=sole.geometry.getAttribute('position');
            for(let i=0;i<points.count;i++)soleY=Math.min(soleY,new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(sole.matrixWorld).y);
          }
          assert.ok(Math.abs(soleY-player.pos.y-.004)<.002,'visible shoe did not meet the weight-driven spout');
        }
      }
      assert.equal(c.alive,false,'landing failed to destroy the carton');
      assert.equal(player.cratesBroken,1,'carton awarded more than one break');
      assert.ok(player.vVel>=TUNING.crateBounce-.01,'carton changed the established bounce');
      assert.equal(c.carton.expansion,0,'stomp snap failed to complete the fold');
      assert.equal(c.mesh.scale.y,1,'body disappeared before the interpolated downstroke completed');
    }
    console.log(`milk cartons: stack/reset/ghost/special support, ${checked} foot-driven fold samples at 30/60/120 Hz, three actual landings: ok`);
  } finally { for(const level of fixtures)level.dispose(); }
});
