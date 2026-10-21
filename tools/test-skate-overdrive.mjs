import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const entry={id:'skate-overdrive-test',name:'Skate overdrive',data:{v:1,name:'Skate overdrive',spawn:[0,.1,0],killY:-30,startWarpPad:false,components:[
  {t:'platform',p:[0,-1,-10000],s:[100,2,24000],edgeGrinding:false},
  {t:'ramp',p:[160,0,-60],len:120,w:40,rise:20,vert:false},
  {t:'gate',p:[35,0,1900]},
]}};
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
await withSkateRuntime(async({player:p,level,step,server,TUNING,THREE})=>{
  const {SkateOverdrive,setLegacySkateOverdriveReplay}=await server.ssrLoadModule('/src/skateOverdrive.ts');
  const {Recorder,Replayer,isReplayFile}=await server.ssrLoadModule('/src/replay.ts');
  const tuningBefore=JSON.stringify(TUNING),reports=[];
  for(const hz of [30,60,120,240]){
    const band=new SkateOverdrive();let speed=23;
    for(let i=0;i<hz*120;i++)speed=band.step(1/hz,speed,23,true);
    near(speed,33-10*.99**480,1e-7);assert.ok(speed<33);reports.push({hz,speed});
  }
  const band=new SkateOverdrive();
  near(band.step(.24,23,23,true),23);near(band.step(.01,23,23,true),23.1);
  let speed=23.1;
  for(let i=0;i<80;i++){speed=band.step(.24,speed,23,true);speed=band.step(.01,speed,23,false)}
  near(speed,23.1);band.retain(23.02,23);near(band.ceiling(23),23.02);
  band.boost(29,23);near(band.ceiling(23),29);
  band.boost(60,23);near(band.ceiling(23),33);
  band.retain(20,23);near(band.ceiling(23),0);

  const setup=(speed,park=false,x=0)=>{
    level.skatepark=park;p.respawn(level,true,true,{position:new THREE.Vector3(x,.02,0),heading:new THREE.Vector3(0,0,-1)});
    p.pos.set(x,100,x===0?0:-60);
    const floor=new THREE.Raycaster(p.pos.clone(),new THREE.Vector3(0,-1,0)).intersectObjects(level.groundMeshes,false)[0];
    assert.ok(floor,'fixture ray missed ground');p.pos.y=floor.point.y+.02;p.prevPos.copy(p.pos);p.speed=speed;p.freeSkate=true;p.airFromSkate=true;
    p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.camDir.set(0,0,-1);p.grounded=true;p.groundHit=p.queryGround(level);
    assert.ok(p.groundHit);p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.rideNormal.copy(p.groundHit.normal);
    p.charging=true;p.chargePlanted=false;p.chargeTimer=.4;p.lastPlanar=speed;p.sketchyT=p.softSkateImpactT=0;
  };
  // These long empty-track runs exercise native movement and collisions;
  // skeletal presentation is covered in the separate real-browser pass.
  const finishVisualStep=p.finishVisualStep;p.finishVisualStep=()=>{};
  const run=(frames,input)=>{for(let i=0;i<frames;i++)step(makeInput(input));return p.speed};
  try{
    for(const park of [false,true]){
      setup(23,park);const milestones=[];
      for(let quarter=1;quarter<=240;quarter++){
        run(15,{moveY:1,jumpHeld:true});
        if([1,4,40,80,240].includes(quarter))milestones.push({seconds:quarter/4,speed:p.speed});
      }
      near(milestones[0].speed,23.1,1e-6);
      near(p.speed,33-10*.99**240,1e-6);assert.ok(!p.isBailing&&p.grounded);
      reports.push({park,milestones});
      // Below the old top speed, release decay, braking and road gravity
      // must match the old motor with identical authored tuning.
      for(const scenario of [
        {speed:10,frames:30,input:{moveY:1,jumpHeld:true}},
        {speed:24,frames:20,input:{moveY:1}},
        {speed:24,frames:20,input:{}},
        {speed:24,frames:20,input:{grabHeld:true,jumpHeld:true}},
        {speed:23,frames:20,input:{moveY:1,jumpHeld:true},x:160},
      ]){
        const values=[];
        for(const legacy of [true,false]){
          setLegacySkateOverdriveReplay(legacy);setup(scenario.speed,park,scenario.x??0);
          if(!legacy)p.registerSkateBoost();
          values.push({speed:run(scenario.frames,scenario.input),pos:p.pos.toArray()});
        }
        assert.deepEqual(values[1],values[0],`existing motor changed: ${JSON.stringify({park,scenario,values})}`);
      }
      setup(28,park);p.registerSkateBoost();run(15,{moveY:1,jumpHeld:true});near(p.speed,28.05,1e-6);
      // Losing speed spends the earned reserve; it is not an unlocked
      // faster acceleration target the next time the player pushes.
      p.speed=24;run(15,{moveY:1,jumpHeld:true});near(p.speed,24.09,1e-6);
      setup(23,park);run(10,{moveY:1,jumpHeld:true});p.pos.y=8;p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=2;
      const ceiling=p.skateOverdriveCeiling;run(8,{moveY:1,jumpHeld:true});near(p.skateOverdriveCeiling,ceiling);
      setup(30,park);p.registerSkateBoost();p.respawn(level,true);near(p.skateOverdriveCeiling,0);
      const speedKey=park?'parkChargeSpeed':'maxSpeed',originalBase=TUNING[speedKey];
      try{TUNING[speedKey]=18;setup(18,park);run(15,{moveY:1,jumpHeld:true});near(p.speed,18.1,1e-6);}
      finally{TUNING[speedKey]=originalBase;}
    }
    // Real speed pads retain their authored launch, including pads faster
    // than the new sustained band; their old finite boost window stays intact.
    setup(23);p.groundHit={...p.groundHit,speedPadId:99,speedPadSpeed:48,speedPadHold:3.9};p.applySpeedPad();
    near(p.speed,48);near(p.skateOverdriveCeiling,33);near(p.grindBoostT,3.9);
    setup(32);p.registerSkateBoost();p.state='air';p.grounded=false;p.pos.y=8;p.prevPos.copy(p.pos);p.vVel=0;
    run(4,{moveY:1});near(p.speed,32);assert.ok(!p.grounded,'air fixture landed too soon');
    const recorder=new Recorder();recorder.start('test');const take=recorder.export();
    assert.equal(take.skateOverdrivePolicy,1);assert.ok(isReplayFile(take));assert.equal(isReplayFile({...take,skateOverdrivePolicy:2}),false);
    const replayer=new Replayer();delete take.skateOverdrivePolicy;replayer.begin(take);
    setup(23);near(run(60,{moveY:1,jumpHeld:true}),23);replayer.end();
    setup(23);assert.ok(run(60,{moveY:1,jumpHeld:true})>23.3);
    assert.equal(JSON.stringify(TUNING),tuningBefore,'movement tuning changed');
    console.log(JSON.stringify(reports));
    console.log('PASS earned +10 skate ceiling, exact quarter-second diminishing gains, interrupted holds, spent momentum, boost entry, course/park motors, unchanged baseline/decay/brake/slope tuning, air carry and legacy replays');
  }finally{p.finishVisualStep=finishVisualStep;setLegacySkateOverdriveReplay(false);}
},{levelEntry:entry});
