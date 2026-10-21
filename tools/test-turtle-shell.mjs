import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE,level,player:p,step,TUNING,CONST})=>{
  const enemy=level.enemies[0], reports=[];
  const reset=()=>{
    level.reset(true);level.update(0);
    p.respawn(level,true,true,{position:new THREE.Vector3(-1,0,0),heading:new THREE.Vector3(1,0,0)});
    p.freeSkate=false;p.airFromSkate=false;p.competitionMode=false;p.invulnTimer=0;
    p.camDir.set(0,0,-1);p.state='ride';p.grounded=true;p.rawInput=makeInput();level.update(0);
  };
  const wait=n=>{const input=makeInput();for(let i=0;i<n;i++)step(input);};
  const spin=()=>step(makeInput({spinPressed:true,spinHeld:true}));
  reset();spin();
  assert.equal(enemy.alive,false,JSON.stringify({label:'fresh spin',state:p.state,pos:p.pos.toArray(),spin:p.spinTimer,spinCd:p.spinCd,spinBox:[p.spinBox.min.toArray(),p.spinBox.max.toArray()],enemy:[enemy.box.min.toArray(),enemy.box.max.toArray()]}));
  assert.ok(enemy.shell);assert.equal(enemy.flungT,undefined);
  const token=p.debrisSpinToken;
  wait(90);
  assert.ok(enemy.shell&&enemy.group.visible,'killing spin must not remove the shell later');
  assert.equal(p.debrisSpinToken,token);
  p.pos.set(-1,0,0);p.prevPos.copy(p.pos);p.speed=0;
  const points=p.points;
  spin();assert.notEqual(p.debrisSpinToken,token);
  assert.equal(enemy.shell,undefined,'second real-input spin removes bounce collider');
  assert.ok(enemy.flungVel&&enemy.flungVel.y>0);assert.equal(enemy.alive,false);
  assert.equal(p.points,points,'shell removal cannot award another kill');
  wait(100);assert.equal(enemy.group.visible,false);
  reports.push('input spin → persistent shell → fresh spin → ballistic removal');

  reset();p.pos.set(0,1.8,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-5;
  for(let i=0;i<30&&enemy.alive;i++)step(makeInput());
  assert.ok(enemy.shell&&!enemy.alive,'ordinary falling stomp must flip the turtle');
  assert.equal(p.vVel,TUNING.crateBounce);assert.equal(p.pos.y,enemy.shell.box.max.y+.02);
  const stompXZ=[p.pos.x,p.pos.z];wait(12);
  assert.deepEqual([p.pos.x,p.pos.z],stompXZ,'new taller shell must not side-eject the first stomp bounce');
  assert.ok(enemy.shell&&p.vVel>0);
  reports.push('first stomp flips and bounces straight above the new belly');

  for(const held of [false,true]){
    reset();level.killEnemy(enemy);wait(30);
    // Descend using actual player physics, then leave and return for a second bounce.
    for(let bounce=0;bounce<2;bounce++){
      p.pos.set(0,enemy.shell.box.max.y+.45,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;
      p.freeSkate=false;p.airFromSkate=false;p.vVel=-5;p.speed=0;p.walkVelocity.set(0,0,0);
      p.airJumpUsed=true;p.doubleJumpAir=true;p.charging=false;p.slamActive=false;
      const input=makeInput({jumpHeld:held});
      let frames=0;while(p.vVel<0&&frames++<30)step(input);
      assert.ok(frames<30,'descending sole missed the shell');
      assert.equal(p.vVel,TUNING.arrowBounce*(held?TUNING.arrowBoostMult:1));
      assert.equal(p.pos.y,enemy.shell.box.max.y+.02,'bounce snaps to shell top');
      assert.equal(p.airJumpUsed,false);assert.equal(p.doubleJumpAir,false);
      assert.equal(p.airGrav,'foot');assert.equal(p.charging,false);
      assert.equal(p.cratesBroken,0);assert.ok(enemy.shell&&enemy.group.visible);
      step(makeInput());assert.ok(p.vVel>0,'next frame must rise, not collide again');
    }
  }
  reports.push('repeat normal/held bounces, swept top contact and double-jump rearm');

  // A slam that kills the turtle can reach the floor on a later frame. Its
  // shockwave is still the same attack and must leave the new shell intact.
  reset();p.pos.set(0,.7,0);p.prevPos.set(0,1.2,0);p.state='air';p.vVel=-20;
  p.slamActive=true;p.debrisSlamToken={};p.spinTimer=0;
  p.playerBox.copy(enemy.box);p.collide(level);
  assert.ok(enemy.shell);assert.equal(enemy.shell.lastSlam,p.debrisSlamToken);
  p.pos.y=0;p.slamImpact(level);assert.ok(enemy.shell,'same slam shockwave removes new carcass');
  const slamAwards=[],nativeScore=p.score.bind(p);
  p.score=(amount,label)=>{slamAwards.push({amount,label});nativeScore(amount,label);};
  p.slamImpact(level);assert.ok(enemy.shell,'repeated same-impact callback removes new carcass');
  // A new body slam, including its nearby floor shockwave, launches it.
  p.debrisSlamToken={};p.slamImpact(level);
  assert.equal(enemy.shell,undefined);assert.ok(enemy.flungVel);
  p.score=nativeScore;
  assert.deepEqual(slamAwards,[{amount:CONST.ptsSlam,label:'Body Slam'},{amount:CONST.ptsSlam,label:'Body Slam'}],
    'only authored slam score, no repeat enemy reward');
  reports.push('first slam flips, same slam cannot fling; new slam shockwave flings');

  reset();level.killEnemy(enemy);wait(30);
  p.pos.set(0,3,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-2;
  p.freeSkate=false;p.airFromSkate=false;
  step(makeInput({grabPressed:true,grabHeld:true}));assert.equal(p.slamActive,true);
  for(let i=0;i<90&&enemy.shell;i++)step(makeInput({grabHeld:true}));
  assert.equal(enemy.shell,undefined,'real-input body slam should fling carcass');
  assert.ok(enemy.flungVel);
  reports.push('actual airborne Circle/body-slam input removes existing shell');

  reset();level.killEnemy(enemy);wait(30);
  p.pos.set(-.9,0,0);p.prevPos.set(-1.1,0,0);p.state='ride';p.grounded=true;
  p.playerBox.copy(enemy.shell.box);const lives=p.lives;p.collide(level);
  assert.equal(p.lives,lives);assert.equal(p.isBailing,false);assert.ok(enemy.shell);
  // Rope attacks use the same first/second-spin contract.
  reset();p.pos.set(0,0,0);p.debrisSpinToken={};p.ropeSpinSmash(level);
  assert.ok(enemy.shell);p.ropeSpinSmash(level);assert.ok(enemy.shell);
  p.debrisSpinToken={};p.ropeSpinSmash(level);assert.equal(enemy.shell,undefined);
  reports.push('safe side contact and rope-spin attack identity');

  for(const hard of [false,true]){
    level.reset(hard);level.update(0);
    assert.equal(enemy.alive,true);assert.equal(enemy.shell,undefined);assert.equal(enemy.flungVel,undefined);
    assert.equal(enemy.state,'patrol');assert.ok(enemy.box.max.y>enemy.box.min.y);
    level.killEnemy(enemy);assert.ok(enemy.shell);assert.equal(level.killEnemy(enemy),false);
  }
  // Reskinned catalogue slots are not ordinary turtles.
  for(const skin of ['ghostknight','ghostfood','ghostcake']){
    level.reset(true);enemy.group.userData.ghostSkin=skin;level.update(0);
    assert.equal(enemy.spinKill,false);assert.equal(enemy.spinRecoil,true);
    level.killEnemy(enemy);assert.equal(enemy.shell,undefined,skin);
    delete enemy.group.userData.ghostSkin;
  }
  console.log('Turtle shells: '+reports.join('; ')+'. Reset, score and skin isolation passed.');
},{levelEntry:{id:'turtle-shell-test',name:'Turtle shell test',data:{v:1,name:'Turtle shell test',spawn:[-1,0,0],killY:-20,components:[
  {t:'platform',p:[0,-.5,0],s:[40,1,40]},
  {t:'enemy',foe:'turtle',p:[0,0,0],range:0,speed:0},
  {t:'gate',p:[0,0,-18]},
]}}});
