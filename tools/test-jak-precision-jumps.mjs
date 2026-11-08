import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(await readFile(process.argv[2],'utf8'));
await withSkateRuntime(async({server,player:p,level,THREE})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=createJakDirectSuite(a.createPlayerStarterAnimationSuite(binding.definition),binding.definition,bank);
  const runtime=createCharacterAnimationRuntime(p,suite),cases=[];
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
    ['release movement at takeoff',18,f=>[0,f<68?1:0],false],
  ];
  for(const [name,hold,move,roll] of fixtures) {
    const traces=[];
    for(const enabled of [false,true]) {
      p.enterLevel('jak-precision');p.respawn(level,true,true);p.freeSkate=false;
      p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:enabled};runtime.restart();
      let air=-1,land=-1,start=null,launchClip=null,launchSpeed=0,distance=0;
      const clips=new Set(),physics=[];
      for(let f=0;f<220;f++) {
        const [moveX,moveY]=move(f);
        p.camDir.set(0,0,-1);p.step(1/60,makeInput({moveX,moveY,jumpPressed:f===50,
          jumpHeld:f>=50&&f<50+hold,jumpReleased:f===50+hold}),level);
        level.update(1/60);p.commitRenderStep(level);
        if(!p.grounded&&air<0) {
          air=f;start=p.pos.clone();launchClip=runtime.activeClipId;launchSpeed=p.walkVelocity.length();
          assert.equal(runtime.diagnostics.motionContext.inputs.jakFlip,enabled&&roll?1:0,`${name}: wrong takeoff decision`);
        }
        if(air>=0&&land<0) {
          clips.add(runtime.activeClipId);
          if(p.grounded){land=f;distance=Math.hypot(p.pos.x-start.x,p.pos.z-start.z);}
          else assert.equal(runtime.diagnostics.motionContext.inputs.jakFlip,enabled&&roll?1:0,
            `${name}: steering changed the roll choice in midair`);
        }
        assert.equal(p.freeSkate,false,`${name}: mounted during an on-foot jump`);
        physics.push([...p.pos.toArray(),p.vVel,p.grounded]);
      }
      assert.equal(air,50+hold,'release-to-jump timing changed');assert.ok(land>air,'never landed');
      assert.equal(launchClip,enabled&&roll?'player.jak-flip':'player.jump',`${name}: wrong launch animation`);
      if(!enabled||!roll)assert.ok(!clips.has('player.jak-flip')&&!clips.has('player.jak-flip-land'),`${name}: upright hop rolled`);
      traces.push(physics);
      if(enabled)cases.push({name,launchSpeed,roll,air,land,distance,clips:[...clips]});
    }
    assert.deepEqual(traces[0],traces[1],`${name}: roll selection changed movement`);
  }
  runtime.dispose();console.log(JSON.stringify({frames:fixtures.length*2*220,cases},null,2));
},{levelEntry:{id:'jak-precision',name:'Precision jumps',data:{v:1,name:'Precision jumps',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},{t:'gate',p:[0,0,-200]}]}}});
