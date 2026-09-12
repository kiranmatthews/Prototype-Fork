import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, scene, player:p, level, step, CONST }) => {
  const { Rail } = await server.ssrLoadModule('/src/rails.ts');
  const { DECK_TRICKS } = await server.ssrLoadModule('/src/skateTricks.ts');
  const rail = new Rail([new THREE.Vector3(0, 1, 5), new THREE.Vector3(0, 1, -35)]);
  level.rails.push(rail);level.grindRails.push(rail);level.root.add(rail.object);scene.updateMatrixWorld(true);
  const catchRail = () => {
    const position=rail.pointAt(2).add(new THREE.Vector3(0,.25,0)),heading=rail.tangentAt(2);
    p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.speed=8;
    p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.vVel=0;
    step(makeInput({grindHeld:true,grindPressed:true}));
    assert.equal(p.state,'grind');assert.equal(p.grindRail,rail);
    p.balanceBoostT=10;
  };
  // A fresh Triangle edge is valid immediately after catch or another trick.
  // Holding it has no edge and must not repeatedly score the same selection.
  catchRail();let switches=0;
  for(const [x,y,style] of [[-1,0,'board'],[0,1,'nose'],[0,-1,'five0'],[1,1,'crook'],[-1,-1,'smith'],[1,-1,'feeble'],[0,0,'normal']]){
    step(makeInput({grindHeld:true,grindPressed:true,moveX:x,moveY:y}));
    assert.equal(p.grindStyle,style,`early Triangle did not select ${style}`);
    assert.equal(p.state,'grind');switches++;
    const count=p.comboMult;
    step(makeInput({grindHeld:true,moveX:x,moveY:y}));assert.equal(p.comboMult,count);
  }
  const directions=[[-1,0],[1,0],[0,1],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]];
  let chords=0;
  for(const [x,y] of directions)for(const lead of [0,3,9]){
    catchRail();p.spinCd=2;
    for(let i=0;i<15;i++)step(makeInput({jumpHeld:true,grindHeld:true}));
    const before=p.comboMult;
    if(lead){
      step(makeInput({jumpHeld:true,grindHeld:true,spinPressed:true,spinHeld:true,moveX:x,moveY:y}));
      assert.ok(p.queuedFlip,'Square edge before rail release was discarded');
      for(let i=1;i<lead;i++)step(makeInput({jumpHeld:true,grindHeld:true}));
    }
    step(makeInput({jumpReleased:true,grindHeld:true,...(!lead?{spinPressed:true,spinHeld:true,moveX:x,moveY:y}:{})}));
    assert.equal(p.state,'air');assert.ok(p.flipT>0,`Square/${x}/${y}/${lead} failed`);
    const name=p.flipName;assert.ok(DECK_TRICKS.some(t=>t.label===name));
    // Keep Triangle available while the flip runs. Even a fresh re-grab
    // cannot truncate the flip before its catch/score beat.
    let caught=false;
    for(let i=0;i<90;i++){
      const remaining=p.flipT;
      step(makeInput({grindHeld:true,grindPressed:true}));
      if(p.state==='grind'){
        assert.ok(remaining<=CONST.fixedStep+1e-6,'rail caught an unfinished flip');
        assert.ok(p.comboLabels.includes(name),`${name}: rail erased the completed trick`);
        assert.ok(p.comboMult>=before+2,'flip and rail catch were not both scored');
        caught=true;break;
      }
      assert.equal(p.isBailing,false,`${name}: early flip bailed`);
    }
    assert.ok(caught,`${name}: could not re-grind after the flip`);chords++;
  }
  console.log(`PASS ${switches} immediate grind switches and ${chords} directional Square/rail-ollie chords (0–150 ms lead), with completed flips scored before rail catches and no held-button repeats.`);
});
