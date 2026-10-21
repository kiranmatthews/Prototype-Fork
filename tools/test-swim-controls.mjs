import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const fixture = park => ({ id: 'swim-controls', name: 'Swim controls', data: {
  v: 1, name: 'Swim controls', spawn: [0, -1.65, 0], killY: -30, skatepark: park,
  components: [
    { t: 'platform', p: [0, -9, 0], s: [140, 2, 140], edgeGrinding: false },
    { t: 'mesh', p: [0, 0, 0], vertices: [-60,0,-60, -60,0,60, 60,0,60, 60,0,-60],
      indices: [0,1,2, 0,2,3], solid: false, materialStyle: 'water', swimDepth: 8 },
    { t: 'gate', p: [65, -8, 65] },
  ],
} });
await withSkateRuntime(async ({ THREE, server, Level, Player, CONST }) => {
  const { SWIMMING, stepSwimVelocity, legacySwimmingReplay } = await server.ssrLoadModule('/src/swimming.ts');
  const { Recorder, Replayer, isReplayFile } = await server.ssrLoadModule('/src/replay.ts');
  const forward = new THREE.Vector3(0,0,-1), speeds=[];
  const accelerate = (analog, strength, seconds, hz=60, x=0) => {
    const velocity = new THREE.Vector3();
    for (let frame=0; frame<seconds*hz; frame++) stepSwimVelocity(velocity,forward,x,strength,analog,1/hz);
    return velocity;
  };
  for (const analog of [false,true]) {
    const initial=accelerate(analog,1,.25).length(), middle=accelerate(analog,1,.5).length();
    const full=accelerate(analog,1,4).length();
    assert.ok(initial>0 && initial<middle && middle<full && full>SWIMMING.fastSpeed*.999);
    speeds.push({analog,quarterSecond:initial,halfSecond:middle,full});
    for (const hz of [30,120,240]) assert.ok(accelerate(analog,1,2,hz).distanceTo(accelerate(analog,1,2))<1e-9);
    assert.ok(accelerate(analog,1,4,60,1).length()<=SWIMMING.fastSpeed+1e-9,'diagonal speed boost');
    const stopped=accelerate(analog,1,4);
    for(let frame=0;frame<120;frame++)stepSwimVelocity(stopped,forward,0,0,analog,1/60);
    assert.ok(stopped.length()<.003,'neutral did not settle');
    const reversal=accelerate(analog,1,4);
    for(let frame=0;frame<180;frame++)stepSwimVelocity(reversal,forward,0,-1,analog,1/60);
    assert.ok(reversal.z>SWIMMING.fastSpeed*.99,'opposite direction did not rebuild speed');
  }
  assert.ok(speeds[0].quarterSecond<speeds[1].quarterSecond*.65,'digital ramp is not noticeably slower');
  for(const strength of [.25,.5,.75])assert.ok(Math.abs(accelerate(true,strength,4).length()/accelerate(true,1,4).length()-strength)<1e-9);

  for(const park of [false,true]) {
    const scene=new THREE.Scene(), level=new Level(scene,fixture(park)), p=new Player(scene);
    scene.updateMatrixWorld(true);p.enterLevel('swim-controls');p.endlessDeaths=true;
    const tick = (values={},frames=1) => {
      const input=makeInput(values);
      for(let i=0;i<frames;i++){p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
        assert.equal(p.isBailing,false);assert.notEqual(p.state,'dead');assert.ok(p.pos.toArray().every(Number.isFinite));}
    };
    const reset = () => {
      p.respawn(level,true,true,{position:new THREE.Vector3(0,-1.65,0),heading:forward});
      p.pos.set(0,-1.65,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=0;
      p.camDir.copy(forward);tick({},120);assert.equal(p.state,'swim');
    };
    try {
      reset();tick({moveY:1,moveAnalog:true},30);const ordinary=p.swimVelocity.length();
      reset();tick({moveY:1,moveAnalog:true,jumpPressed:true,jumpHeld:true},30);
      assert.equal(p.state,'swim');assert.ok(Math.abs(p.swimVelocity.length()-ordinary)<1e-9,'X still accelerates swimming');
      tick({jumpCancelled:true});tick({jumpReleased:true});assert.equal(p.state,'swim','cancelled press jumped');
      reset();tick({jumpHeld:true},12);tick({jumpReleased:true});assert.equal(p.state,'swim','carried held X created a new jump');
      for(const holdFrames of [1,24]) {
        reset();tick({jumpPressed:true,jumpHeld:true},holdFrames);tick({jumpReleased:true});
        assert.equal(p.state,'air');assert.equal(p.airFromSkate,false);assert.equal(p.freeSkate,false);
        const launch=p.vVel;assert.ok(launch>=12);assert.equal(p.lastJumpType,'Water Jump');assert.equal(p.waterJumping,true);
        for(let i=0;i<8;i++){tick();assert.equal(p.state,'air','water swallowed rising jump');assert.equal(p.freeSkate,false);}
        tick({jumpPressed:true,jumpHeld:true},2);tick({jumpReleased:true});
        assert.equal(p.doubleJumpAir,true,'water jump lost double jump');assert.equal(p.airJumpUsed,true);
        const double=p.vVel;assert.ok(double>9);
        tick({jumpPressed:true,jumpHeld:true},2);tick({jumpReleased:true});assert.ok(p.vVel<double,'third jump was allowed');
        let peak=p.pos.y,landed=false;
        for(let i=0;i<180;i++){tick();peak=Math.max(peak,p.pos.y);if(p.swimming){landed=true;break;}}
        assert.ok(peak>.5,'jump did not clear the surface');assert.ok(landed,'did not return to water');
        assert.equal(p.airJumpUsed,false,'water contact did not rearm jump');assert.equal(p.waterJumping,false);
        tick({jumpPressed:true,jumpHeld:true},2);tick({jumpReleased:true});assert.equal(p.state,'air','cannot jump after splashdown');
        console.log(JSON.stringify({park,holdFrames,launch,double,peak}));
      }
    } finally {level.dispose();}
  }
  const recorder=new Recorder();recorder.start('swim-controls');
  for(const analog of [false,true])recorder.record(makeInput({moveY:.5,moveAnalog:analog}));
  const take=recorder.export();assert.equal(take.swimmingControlsPolicy,1);assert.ok(isReplayFile(take));
  assert.equal(take.b[1],1<<16);assert.equal(isReplayFile({...take,swimmingControlsPolicy:2}),false);
  const replay=new Replayer(),out=makeInput();replay.begin(take);
  assert.equal(legacySwimmingReplay(),false);replay.feed(out);assert.equal(out.moveAnalog,false);replay.feed(out);assert.equal(out.moveAnalog,true);replay.end();
  delete take.swimmingControlsPolicy;replay.begin(take);assert.equal(legacySwimmingReplay(),true);
  const old=new THREE.Vector3();for(let i=0;i<240;i++)stepSwimVelocity(old,forward,0,1,false,1/60);
  assert.ok(Math.abs(old.length()-SWIMMING.speed)<1e-6);replay.end();assert.equal(legacySwimmingReplay(),false);
  console.log(JSON.stringify({speeds}));
  console.log('PASS swim magnitude, digital ramp, diagonals, reversal, neutral, timestep, X speed isolation, water jump/double/rearm, cancellation, always-skate pools and replay controls');
}, {levelEntry:fixture(false)});
