import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(await readFile(process.argv[2],'utf8'));
await withSkateRuntime(async({server,player:p,level,TUNING,Level,scene})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=createJakDirectSuite(a.createPlayerStarterAnimationSuite(binding.definition),binding.definition,bank);
  const runtime=createCharacterAnimationRuntime(p,suite),cases=[],original={...TUNING};
  const fixtures=[
    ['vertical tap',3,()=>[0,0],false],
    ['vertical full',35,()=>[0,0],false],
    ['precision',18,()=>[0,.2],false],
    ['walking',18,()=>[0,.4],false],
    ['brief nudge',3,f=>[0,f>=49&&f<57?1:0],false],
    ['late air steering',18,f=>[0,f>=68?1:0],false],
    ['running',18,()=>[0,1],true],
    ['strafe',18,()=>[1,0],true],
    ['diagonal',18,()=>[Math.SQRT1_2,Math.SQRT1_2],true],
    ['brake before takeoff',18,f=>[0,f<40?1:0],false],
    ['release movement at takeoff',18,f=>[0,f<68?1:0],true],
    ['release sideways at takeoff',18,f=>[f<68?1:0,0],true],
    ['reverse at takeoff with momentum',18,f=>[0,f<68?1:-1],true],
    ['reverse and slow before takeoff',18,f=>[0,f<57?1:-1],false],
    ['running tap',3,()=>[0,1],true],
    ['small stick with fast travel',18,()=>[0,.4],true,{walkSpeed:15}],
    ['large stick with slow travel',18,()=>[0,.6],false,{walkSpeed:6}],
    ['below speed threshold',18,()=>[0,1],false,{jumpFlipMinSpeed:9.05}],
    ['at speed threshold',18,()=>[0,1],true,{jumpFlipMinSpeed:9}],
    ['above speed threshold',18,()=>[0,1],true,{jumpFlipMinSpeed:8.95}],
    ['raise cutoff in air',18,()=>[0,1],true,{}, {jumpFlipMinSpeed:20}],
    ['lower cutoff in air',18,()=>[0,1],false,{jumpFlipMinSpeed:20}, {jumpFlipMinSpeed:1}],
    ['legacy hold time is ignored',3,()=>[0,1],true,{flipHoldTime:.6}],
  ];
  for(const [name,hold,move,roll,tuning={},airEdit] of fixtures) {
    const traces=[];
    for(const enabled of [false,true]) {
      Object.assign(TUNING,original,tuning);
      const cutoff=TUNING.jumpFlipMinSpeed;
      p.enterLevel('jak-precision');p.respawn(level,true,true);p.freeSkate=false;
      p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:enabled};runtime.restart();
      let air=-1,land=-1,start=null,launchClip=null,launchSpeed=0,distance=0;
      const clips=new Set(),physics=[];
      for(let f=0;f<220;f++) {
        if(air>=0&&f===air+3)Object.assign(TUNING,airEdit);
        const [moveX,moveY]=move(f);
        p.camDir.set(0,0,-1);p.step(1/60,makeInput({moveX,moveY,jumpPressed:f===50,
          jumpHeld:f>=50&&f<50+hold,jumpReleased:f===50+hold}),level);
        level.update(1/60);p.commitRenderStep(level);
        if(!p.grounded&&air<0) {
          air=f;start=p.pos.clone();launchClip=runtime.activeClipId;launchSpeed=Math.hypot(p.walkVelocity.x,p.walkVelocity.z);
          assert.equal(runtime.diagnostics.motionContext.inputs.jakFlip,enabled&&roll?1:0,`${name}: wrong takeoff decision`);
          assert.ok(Math.abs(runtime.diagnostics.motionContext.inputs.jakTakeoffSpeed-launchSpeed)<1e-8,
            `${name}: takeoff must sample physical travel in any direction`);
        }
        if(air>=0&&land<0) {
          clips.add(runtime.activeClipId);
          if(p.grounded){land=f;distance=Math.hypot(p.pos.x-start.x,p.pos.z-start.z);}
          else {
            assert.equal(runtime.diagnostics.motionContext.inputs.jakFlip,enabled&&roll?1:0,
              `${name}: steering/tuning changed the roll choice in midair`);
            assert.equal(runtime.diagnostics.motionContext.inputs.jakTakeoffSpeed,launchSpeed,
              `${name}: takeoff speed was not latched`);
            assert.equal(runtime.diagnostics.motionContext.inputs.jakFlipMinSpeed,cutoff,
              `${name}: launch cutoff was not latched`);
          }
        }
        assert.equal(p.freeSkate,false,`${name}: mounted during an on-foot jump`);
        physics.push([...p.pos.toArray(),p.vVel,p.grounded]);
      }
      assert.equal(air,50+hold,'release-to-jump timing changed');assert.ok(land>air,'never landed');
      assert.equal(launchClip,enabled&&roll?'player.jak-flip':'player.jump',`${name}: wrong launch animation`);
      if(!enabled||!roll)assert.ok(!clips.has('player.jak-flip')&&!clips.has('player.jak-flip-land'),`${name}: upright hop rolled`);
      traces.push(physics);
      if(enabled)cases.push({name,launchSpeed,cutoff,roll,air,land,distance,clips:[...clips]});
    }
    assert.deepEqual(traces[0],traces[1],`${name}: roll selection changed movement`);
  }
  Object.assign(TUNING,original);
  // Coyote releases run before this tick's air displacement: their momentum
  // must count even though pos - prevPos is still zero at the trigger.
  const ledge=new Level(scene,{id:'coyote-flip',name:'Coyote flip',data:{v:1,name:'Coyote flip',
    spawn:[0,.02,0],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[10,1,10]},
      {t:'platform',p:[0,-5.5,0],s:[100,1,100]},{t:'gate',p:[0,-5,-40]}]}});
  const coyote=[];
  for(const [name,x,y,coast] of [['coyote forward',0,1,false],['coyote sideways',1,0,false],
    ['coyote release direction',0,1,true]]) {
    const traces=[];
    for(const enabled of [false,true]) {
      p.enterLevel('coyote-flip');p.respawn(ledge,true,true);p.freeSkate=false;
      p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:enabled};runtime.restart();
      let departed=-1,launchSpeed=0,land=-1;
      const physics=[];
      for(let f=0;f<160;f++) {
        const release=departed>=0&&f===departed+1,neutral=coast&&departed>=0;
        const priorSpeed=Math.hypot(p.walkVelocity.x,p.walkVelocity.z);
        p.camDir.set(0,0,-1);p.step(1/60,makeInput({moveX:neutral?0:x,moveY:neutral?0:y,
          jumpPressed:f===50,jumpHeld:f>=50&&departed<0,jumpReleased:release}),ledge);
        ledge.update(1/60);p.commitRenderStep(ledge);
        if(!p.grounded&&departed<0)departed=f;
        if(release) {
          assert.ok(departed>=50&&departed<70,`${name}: fixture missed the charged walk-off`);
          assert.ok(p.vVel>10,`${name}: no coyote jump`);
          const inputs=runtime.diagnostics.motionContext.inputs;
          launchSpeed=inputs.jakTakeoffSpeed;
          assert.equal(launchSpeed,priorSpeed,`${name}: lost pre-displacement momentum`);
          assert.equal(inputs.jakFlip,enabled?1:0,`${name}: coyote flip decision`);
        }
        if(departed>=0&&p.grounded&&land<0)land=f;
        assert.equal(p.freeSkate,false,`${name}: mounted during the coyote gesture`);
        physics.push([...p.pos.toArray(),p.vVel,p.grounded]);
      }
      assert.ok(launchSpeed>8&&land>departed,`${name}: incomplete jump`);
      traces.push(physics);
      if(enabled)coyote.push({name,departed,launchSpeed,land});
    }
    assert.deepEqual(traces[0],traces[1],`${name}: flip changed coyote movement`);
  }
  ledge.dispose();runtime.dispose();
  console.log(JSON.stringify({frames:fixtures.length*2*220+coyote.length*2*160,cases,coyote},null,2));
},{levelEntry:{id:'jak-precision',name:'Precision jumps',data:{v:1,name:'Precision jumps',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},{t:'gate',p:[0,0,-200]}]}}});
