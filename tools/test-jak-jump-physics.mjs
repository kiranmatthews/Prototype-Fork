import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({server, THREE, Player, Level}) => {
  const {JAK_JUMP_PHYSICS, createJakStudySuite} = await server.ssrLoadModule('/tools/jak-jump-variant.ts');
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime} = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {TUNING} = await server.ssrLoadModule('/src/tuning.ts');
  const originalTuning = JSON.stringify(TUNING);
  const level = new Level(new THREE.Scene(), {id:'jump-study-test',name:'Jump study',data:{v:1,name:'Jump study',
    spawn:[0,.02,0],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const p = new Player(level.scene), control = new Player(level.scene);
  const rig = a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite = createJakStudySuite(a.createPlayerStarterAnimationSuite(rig.definition));
  const runtime = createCharacterAnimationRuntime(p,suite);
  const results=[];
  try {
    for (const [name,hold,move,double,change] of [
      ['tap',3,0,false,null],['full',35,0,false,null],['double',35,0,true,null],
      ['coast',3,1,false,null],['select C during A flight',35,0,false,'on'],
      ['select A during C flight',35,0,false,'off'],
    ]) {
      for(const rider of [p,control]) {rider.enterLevel('jump-study-test');rider.respawn(level,true);rider.freeSkate=false;}
      p.onFootJumpStudy = change==='on'?null:JAK_JUMP_PHYSICS;
      control.onFootJumpStudy = change==='off'?JAK_JUMP_PHYSICS:null;
      runtime.restart();
      let peak=0,airFrame=-1,landFrame=-1,secondFrame=-1,secondY=0,secondPeak=0,changed=false,coastSpeed=0;
      const seen=new Set();
      for(let frame=0;frame<240;frame++) {
        const input=makeInput({moveY:move && frame<45+hold+4?move:0,jumpPressed:frame===45,
          jumpHeld:frame>=45&&frame<45+hold,jumpReleased:frame===45+hold});
        if(double&&airFrame>=0&&secondFrame<0&&p.vVel<1&&!p.grounded) {
          secondFrame=frame;input.jumpPressed=input.jumpHeld=true;
        }
        if(secondFrame>=0&&frame===secondFrame+1){input.jumpReleased=true;secondY=p.pos.y;}
        p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);
        if(!p.grounded&&airFrame<0)airFrame=frame;
        if(airFrame>=0&&p.grounded&&landFrame<0)landFrame=frame;
        peak=Math.max(peak,p.pos.y);if(secondFrame>=0&&frame>secondFrame)secondPeak=Math.max(secondPeak,p.pos.y-secondY);
        seen.add(runtime.activeClipId);
        if(frame===45+hold+5)coastSpeed=Math.hypot(p.walkVelocity.x,p.walkVelocity.z);
        if(change&&airFrame>=0&&!changed){p.onFootJumpStudy=change==='on'?JAK_JUMP_PHYSICS:null;changed=true;}
        if(change){assert.deepEqual(p.pos.toArray(),control.pos.toArray(),'mid-flight selection spliced two physics arcs');assert.equal(p.vVel,control.vVel);}
        assert.ok(p.pos.toArray().every(Number.isFinite));
      }
      assert.ok(airFrame>=0&&landFrame>airFrame&&p.grounded,`${name}: launch/landing incomplete`);
      assert.equal(runtime.activeClipId,'player.idle',`${name}: recovery did not finish`);
      if(name==='tap')assert.ok(peak>1.1&&peak<1.5,`tap peak ${peak}`);
      if(name==='full')assert.ok(peak>2.65&&peak<2.95,`full peak ${peak}`);
      if(double){assert.ok(seen.has('player.double-jump'));assert.ok(secondPeak>1.65&&secondPeak<1.95,`second height ${secondPeak}`);}
      if(move)assert.ok(coastSpeed>0.1,'C still snaps horizontal momentum to zero in air');
      results.push({name,peak,airtime:(landFrame-airFrame)/60,secondPeak,coastSpeed});
    }
    // Long-hold mounting must remain exactly the original gesture and physics.
    for(const rider of [p,control]){rider.enterLevel('jump-study-test');rider.respawn(level,true);rider.freeSkate=false;}
    p.onFootJumpStudy=JAK_JUMP_PHYSICS;control.onFootJumpStudy=null;
    let mounted=false;
    for(let frame=0;frame<180;frame++) {
      const input=makeInput({moveY:1,jumpPressed:frame===30,jumpHeld:frame>=30&&frame<120,jumpReleased:frame===120});
      p.step(1/60,input,level);control.step(1/60,input,level);level.update(1/60);
      mounted ||= p.freeSkate;
      assert.deepEqual(p.pos.toArray(),control.pos.toArray(),'C changed hold-to-skate or its ollie');
      for(const key of ['speed','vVel','freeSkate','state'])assert.equal(p[key],control[key]);
    }
    assert.ok(mounted,'mount control was not exercised');
    assert.equal(JSON.stringify(TUNING),originalTuning,'C mutated global tuning');
    console.log('PASS C foot heights, balanced arcs, air coasting, finite recovery, mid-flight selection continuity and exact hold-to-skate parity',results);
  } finally {runtime.dispose();level.dispose();}
});
