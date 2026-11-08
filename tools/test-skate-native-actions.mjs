import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [skate,jak]=await Promise.all([bank('skate'),bank('jak')]);
await withSkateRuntime(async({server,scene,level,Player,CONST})=>{
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {DEFAULT_SKATE_STANCE}=await server.ssrLoadModule('/src/skateMount.ts');
  const players=[new Player(scene),new Player(scene)], [p,old]=players;
  const bases=players.map(p=>createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
  const runtimes=players.map((player,i)=>createCharacterAnimationRuntime(player,i===0
    ?createJakDirectSuite(bases[i],RigBinding.fromSculptRuntime(player.animationRig.root).definition,jak):bases[i]));
  const pose=player=>[player.bodyGroup,player.riderG,player.boardG.parent,...player.animationRig.joints.map(j=>j.node),player.boardG]
    .flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray(),Number(n.visible)]);
  const difference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
  const failures=new Map(),results=[];let current=null,frames=0,checked=0,originalChecked=0;
  const install=p.setFinalPoseOverlay.bind(p);
  p.setFinalPoseOverlay=callback=>install(callback?context=>{
    const expected=current?.owns(p)?pose(p):null;
    callback(context);
    if(expected){
      checked++;current.checked++;
      const delta=difference(expected,pose(p));
      if(delta>1e-8&&!failures.has(current.name))failures.set(current.name,{kind:'overwritten native pose',delta,frame:frames});
    }
  }:null);
  const motion=new PlayableSkateMotion(p,skate,{continuousTransitions:true});
  const step=sample=>{
    for(const player of players){player.step(1/60,makeInput(sample),level);player.commitRenderStep(level);}
    level.update(1/60);frames++;
    assert.ok(p.pos.distanceTo(old.pos)<1e-8,`${current?.name}: D moved gameplay`);
    for(const key of ['state','grounded','vVel','speed','freeSkate','stance','flipT','spinTimer','manualing'])
      assert.equal(p[key],old[key],`${current?.name}: D changed ${key}`);
    if(current?.owns(p)){
      assert.equal(motion.boardScribble.active,false,`${current.name}: action played equipment ink`);
      if(current.original){
        originalChecked++;
        const delta=difference(pose(p),pose(old));
        current.maxOriginalDelta=Math.max(current.maxOriginalDelta,delta);
        if(delta>1e-7&&!failures.has(current.name))failures.set(current.name,{kind:'D replaced native air clip',delta,frame:frames});
      }
    }
  };
  const reset=()=>{
    current=null;motion.setActive(false);
    players.forEach((player,i)=>{
      player.enterLevel('native-actions');player.respawn(level,true,true);runtimes[i].restart();
      player.freeSkate=true;player.speed=18;player.lastPlanar=18;
      player.grounded=true;player.state='ride';player.groundHit=player.queryGround(level);
    });
    motion.setActive(true);
    for(let i=0;i<35;i++)step({});
    assert.ok(motion.sourceName,'ordinary skating must still use the new suite');
  };
  const air=player=>{
    player.chargeTimer=.4;player.chargedJump(CONST.fixedStep);
    player.pos.y+=12;player.prevPos.copy(player.pos);
  };
  const run=(name,setup,owns,input,count=60,original=false)=>{
    reset();players.forEach(setup);current={name,owns,original,checked:0,maxOriginalDelta:0};
    for(let f=0;f<count;f++)step(input(f));
    assert.ok(current.checked>0,`${name}: fixture never reached the action`);
    assert.equal(motion.boardScribble.appearances,0,`${name}: action invented a mount`);
    assert.equal(motion.boardScribble.disappearances,0,`${name}: action invented a pickup`);
    results.push({name,frames:current.checked});
    console.log(JSON.stringify({name,frames:current.checked,maxOriginalDelta:current.maxOriginalDelta,failure:failures.get(name)}));current=null;
  };
  const rejoined=()=>{
    assert.equal(motion.diagnostics.nativeOwner,null,'completed action still suppresses the new suite');
    assert.ok(motion.sourceName,'completed action did not resume the source motion');
  };
  run('grounded spin',()=>{},p=>p.spinning,f=>({spinPressed:f===0,spinHeld:f<2}));
  rejoined();
  run('repeat grounded spin',()=>{},p=>p.spinning,f=>({moveY:1,spinPressed:f===0||f===55,spinHeld:f===0||f===55}),100);
  rejoined();
  for(const direction of [-1,1])run(`bare air spin ${direction}`,air,
    p=>!p.grounded&&Math.abs(p.grabSpinAngle)>.001,f=>({moveX:f<18?direction:0}),55);
  for(const [x,y] of [[0,0],[-1,0],[1,0],[0,1],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]])
    run(`deck trick ${x},${y}`,air,p=>p.flipT>0,f=>({spinPressed:f===0,spinHeld:f===0,moveX:f===0?x:0,moveY:f===0?y:0}),55);
  for(const [x,y] of [[0,0],[-1,0],[1,0],[0,1],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]])
    run(`grab including release ${x},${y}`,air,p=>p.grabPhase!=='none'||p.grabPose>.001,
      f=>({grabPressed:f===2,grabHeld:f>=2&&f<16,moveX:f===2?x:0,moveY:f===2?y:0}),55);
  run('revert and switch stance',p=>{p.revertT=.3;},p=>p.revertPoseT>0||p.stance!==DEFAULT_SKATE_STANCE,
    f=>({transferPressed:f===0}),75);
  run('manual and release',()=>{},p=>p.manualing!==0||Math.abs(p.manualPitch)>.001,
    f=>({moveY:f===1?1:f===3?-1:0,jumpHeld:f===35,jumpPressed:f===35,jumpReleased:f===36}),100);
  assert.equal(p.manualing,0,'ollie did not release the manual');rejoined();
  run('reversed deck',p=>{p.deckYawOffset=Math.PI;},()=>true,()=>({}),30);
  run('ice stride and brace',p=>{p.pos.set(300,.2,0);p.prevPos.copy(p.pos);p.groundHit=p.queryGround(level);},
    // Entry is now an intentional source/native blend. Settled ice must still
    // preserve the exact native pose; all discrete actions retain that rule.
    p=>!!p.boardG.userData.iceSkateMotion&&motion.diagnostics.iceBlend===1,f=>({moveX:f>10?.4:0}),45);
  // These motions share a native jump/fall hint, but do not run D's on-foot
  // source clock. A leftover Jak clock must not replace their authored poses.
  for(const flag of ['bounceJump','grindExitAir','swimJumpAir','kiteReleased'])run(`native air ${flag}`,player=>{
    air(player);player.freeSkate=player.airFromSkate=false;player.airGrav='foot';
    if(flag==='kiteReleased')player.kiteReleaseT=0;else player[flag]=true;
    if(player===p){player.footJumpStudyLaunch={...JAK_DIRECT_PHYSICS,flip:true};player.footStudyFrame=17;}
  },p=>p.state==='air',()=>({}),28,true);
  run('earned double jump after crate bounce',player=>{
    air(player);player.freeSkate=player.airFromSkate=false;player.airGrav='foot';player.bounceJump=true;
    if(player===p){player.footJumpStudyLaunch={...JAK_DIRECT_PHYSICS,flip:true};player.footStudyFrame=17;}
  },p=>p.doubleJumpAir,f=>({jumpPressed:f===2,jumpHeld:f===2,jumpReleased:f===3}),28,true);
  assert.equal(runtimes[0].diagnostics.activeClipId,'player.native-air-double-jump');
  // Protect native pose owners even if the state stays ride/air and the hint
  // remains player.skate. Inspect the actual solved pose on the final boundary.
  for(const [name,setup,owns] of [
    ['sketchy landing',p=>{p.sketchyT=.6;},p=>p.sketchyT>0],
    ['wallride release',p=>{air(p);p.wallridePose=1;p.wallNormal.set(1,0,0);},p=>p.wallridePose>.001],
    ['spring flight',p=>{air(p);p.trampolineAir=p.bounceJump=true;p.trampolineLaunchSpeed=56;},p=>p.trampolineAir],
  ])run(name,setup,owns,()=>({}),35);
  motion.dispose();runtimes.forEach(r=>r.dispose());
  console.log(JSON.stringify({frames,checked,originalChecked,results,failures:Object.fromEntries(failures)},null,2));
  assert.equal(failures.size,0,'D must preserve each native action and its release, not only its input/score');
},{levelEntry:{id:'native-actions',name:'Native actions',data:{v:1,name:'Native actions',spawn:[0,.02,6],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[2000,1,2000],edgeGrinding:false},
    {t:'platform',p:[300,.1,0],s:[200,.2,200],slip:true,iceGrip:.08,edgeGrinding:false},{t:'gate',p:[0,0,-800]}]}}});
