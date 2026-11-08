import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(await readFile(process.argv[2],'utf8'));
const measure=process.argv.includes('--measure');
await withSkateRuntime(async({server,player:p,level,THREE,TUNING})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const base=a.createPlayerStarterAnimationSuite(binding.definition),suite=createJakDirectSuite(base,binding.definition,bank);
  const runtime=createCharacterAnimationRuntime(p,base),original={...TUNING},cases=[];
  const configurations=[
    {name:'tap',hold:3}, {name:'charged',hold:23},
    {name:'full vertical',hold:35,move:0,roll:false},
    {name:'low fast arc',hold:3,roll:false,tuning:{jumpMinVelocity:8,jumpVelocity:10,riseGravity:65,fallGravity:145}},
    {name:'high slow arc',hold:23,tuning:{jumpMinVelocity:14,jumpVelocity:19,riseGravity:20,fallGravity:40}},
    {name:'unequal gravity',hold:18,tuning:{jumpMinVelocity:10,jumpVelocity:16,riseGravity:24,fallGravity:155}},
    {name:'early double',hold:18,doubleAfter:5,tuning:{doubleJumpVelocity:14,doubleJumpHorizontalScale:.65}},
    {name:'apex double',hold:18,doubleAfter:22},
    {name:'double disabled',hold:18,doubleAfter:5,tuning:{doubleJump:0}},
    {name:'expired double window',hold:18,doubleAfter:18,tuning:{doubleJumpWindow:.1}},
    {name:'live gravity edit',hold:18,editAt:10,edit:{riseGravity:55,fallGravity:140}},
    {name:'live double edit',hold:18,doubleAfter:15,editAt:8,edit:{doubleJumpVelocity:17,doubleJumpWindow:1}},
  ];
  for(const config of configurations) {
    const traces=[];
    for(const direct of [false,true]) {
      Object.assign(TUNING,original,config.tuning);
      p.enterLevel('jak-ui');p.respawn(level,true,true);p.freeSkate=false;
      p.onFootJumpStudy=direct?{...JAK_DIRECT_PHYSICS,flip:true}:null;
      runtime.setDocument(direct?suite:base);runtime.restart();
      const rows=[];let launch=-1,land=-1,lastAngle=0,turn=0;
      for(let f=0;f<300;f++) {
        const age=launch<0?-1:f-launch;
        if(age===config.editAt)Object.assign(TUNING,config.edit);
        const input={moveY:config.move??1,jumpPressed:f===50,jumpHeld:f>=50&&f<50+config.hold,jumpReleased:f===50+config.hold};
        if(age===config.doubleAfter)input.jumpPressed=input.jumpHeld=true;
        if(age===config.doubleAfter+1)input.jumpReleased=true;
        p.camDir.set(0,0,-1);p.step(1/60,makeInput(input),level);level.update(1/60);p.commitRenderStep(level);
        if(!p.grounded&&launch<0)launch=f;
        if(launch>=0&&p.grounded&&land<0)land=f;
        const pose=binding.capturePose();
        const up=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().fromArray(pose.joints.hips.quaternion));
        const angle=Math.atan2(up.z,up.y);
        turn+=THREE.MathUtils.euclideanModulo(angle-lastAngle+Math.PI,2*Math.PI)-Math.PI;lastAngle=angle;
        const point=id=>binding.joints.get(id).getWorldPosition(new THREE.Vector3());
        const knees=['Left','Right'].map(side=>point(`knee${side}`).sub(point(`hip${side}`))
          .angleTo(point(`ankle${side}`).sub(point(`knee${side}`))));
        rows.push({f,clip:runtime.activeClipId,phase:runtime.diagnostics.timelineTime,turn:turn*180/Math.PI,knees,
          roll:p.footStudyFlipProgress,air:!p.grounded,double:p.doubleJumpAir,
          physics:[...p.pos.toArray(),p.vVel,...p.walkVelocity.toArray(),p.grounded,p.freeSkate,p.doubleJumpAir]});
        assert.ok([...p.pos.toArray(),p.vVel,...pose.joints.hips.quaternion].every(Number.isFinite));
        assert.deepEqual(p.riderG.scale.toArray(),[1,1,1]);
      }
      assert.ok(launch>=0&&land>launch,`${config.name}: no complete flight`);
      traces.push(rows.map(r=>r.physics));
      if(direct) {
        const air=rows.slice(launch,land),maxTurn=Math.max(...air.map(r=>r.turn));
        const open=air.find(r=>r.roll>=1&&r.knees.every(k=>k<.9));
        if(!measure && config.roll!==false) {
          assert.ok(maxTurn>345,`${config.name}: somersault did not complete (${maxTurn} degrees)`);
          assert.ok(open,`${config.name}: never opened the legs before landing`);
          for(let i=1;i<air.length;i++)if(air[i-1].turn>70&&air[i-1].turn<330)
            assert.ok(air[i].turn>=air[i-1].turn-1,`${config.name}: reversed the unfinished roll`);
        }
        if(config.roll===false)assert.ok(!air.some(r=>r.clip==='player.jak-flip'),'small/vertical hop rolled');
        cases.push({name:config.name,launch,land,maxTurn,openFrame:open?.f,clips:[...new Set(air.map(r=>r.clip))],
          peak:Math.max(...air.map(r=>r.physics[1])),rows:measure?air:undefined});
      }
    }
    assert.deepEqual(traces[1],traces[0],`${config.name}: D bypassed UI movement tuning`);
  }
  Object.assign(TUNING,original);runtime.dispose();
  console.log(JSON.stringify({frames:configurations.length*600,cases},null,2));
},{levelEntry:{id:'jak-ui',name:'UI tuning and full rolls',data:{v:1,name:'UI tuning and full rolls',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}}});
