import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data=JSON.parse(await readFile(process.argv[2]||'.skate-reference-data/motion.json','utf8'));
const jak=JSON.parse(await readFile(process.argv[3],'utf8'));
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {boardGroundClearance}=await server.ssrLoadModule('/src/skateReferenceLab/boardGrounding.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const players=[new Player(scene),new Player(scene),new Player(scene)];
  const [p,baseline,control]=players;
  const motion=new PlayableSkateMotion(p,data,{continuousTransitions:true});
  const original=new PlayableSkateMotion(baseline,data);
  const runtimes=players.map(p=>{
    const binding=RigBinding.fromSculptRuntime(p.animationRig.root);
    p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
    return createCharacterAnimationRuntime(p,createJakDirectSuite(createPlayerStarterAnimationSuite(binding.definition),binding.definition,jak));
  });
  const reset=()=>{
    motion.setActive(false);original.setActive(false);
    players.forEach((p,i)=>{p.enterLevel('jump-skate-integration');p.respawn(level,true);p.freeSkate=false;runtimes[i].restart();});
    motion.setActive(true);original.setActive(true);
  };
  const pose=p=>[p.bodyGroup,p.riderG,...p.animationRig.joints.map(j=>j.node),p.bodyGroup.getObjectByName('board')]
    .flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray(),Number(n.visible)]);
  let frames=0,clearance=Infinity,interpolatedClearance=Infinity,uncorrectedInterpolation=Infinity;
  const step=input=>{
    for(const player of players){player.step(1/60,input,level);player.commitRenderStep(level);}
    level.update(1/60);frames++;
    for(const player of [p,baseline]){
      assert.ok(player.pos.distanceTo(control.pos)<1e-9,`presentation moved physics at ${frames}`);
      for(const key of ['speed','vVel','grounded','state','freeSkate','airFromSkate'])assert.equal(player[key],control[key],`${key} at ${frames}`);
    }
    if(!motion.active||(motion.phase==='foot'&&motion.fade>=1&&motion.mountPreparation===0)){
      const a=pose(p),b=pose(control);
      a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`native foot/disabled presentation changed transform ${i} at ${frames}`));
    }
    if(motion.active&&p.grounded&&['mount','dismount'].includes(motion.phase)){
      const support=new THREE.Plane().setFromNormalAndCoplanarPoint(p.groundHit.normal,p.pos);
      clearance=Math.min(clearance,boardGroundClearance(motion.retarget.board,support));
      for(const alpha of [.2,.5,.8]){
        p.applyRenderInterpolation(alpha);
        uncorrectedInterpolation=Math.min(uncorrectedInterpolation,boardGroundClearance(motion.retarget.board,support));
        motion.constrainRenderPose();
        interpolatedClearance=Math.min(interpolatedClearance,boardGroundClearance(motion.retarget.board,support));
        p.restoreRenderPose();
      }
    }
  };
  reset();let held=false,phase='foot';
  const histories=[[],[]],seams=[];
  for(let f=0;f<660;f++){
    const t=f/60,jump=t>.4&&t<3.5;
    step(makeInput({moveY:t<4.8?1:0,jumpHeld:jump,jumpPressed:jump&&!held,jumpReleased:!jump&&held,grabHeld:t>4.8&&t<8.4}));held=jump;
    const values=[p,baseline].map((player,i)=>{
      const h=player.animationRig.jointsById.get('head').node.getWorldPosition(new THREE.Vector3()).sub(player.pos);
      const history=histories[i];history.push(h);if(history.length>3)history.shift();
      return history.length===3?h.clone().sub(history[1]).sub(history[1].clone().sub(history[0])).length():0;
    });
    if(motion.phase!==phase){seams.push({from:phase,to:motion.phase,frame:f,fluid:values[0],frozen:values[1]});phase=motion.phase;}
    assert.equal(motion.phase,original.phase,'polish changed source sequence');
    assert.equal(motion.time,original.time,'polish retimed a source clip');
    assert.equal(motion.boardScribble.frame,original.boardScribble.frame,'polish retimed the equipment ink');
  }
  assert.ok(clearance>=.002-1e-7,'blended equipment penetrated support');
  assert.ok(interpolatedClearance>=.002-1e-7,'render interpolation put the deck through the floor');
  assert.equal(motion.boardScribble.appearances,1);assert.equal(motion.boardScribble.disappearances,1);
  const movingSeams=seams.filter(s=>!['foot','dismount'].includes(s.to));
  const fluid=movingSeams.reduce((s,c)=>s+c.fluid,0),frozen=movingSeams.reduce((s,c)=>s+c.frozen,0);
  assert.ok(fluid<frozen*.9,`outgoing motion did not improve transition continuity: ${fluid}/${frozen}`);

  // Switch out while riding, then back in without replaying equipment cues.
  reset();held=false;let switches=0;
  for(let f=0;f<430;f++){
    if([110,150,190].includes(f)){motion.setActive(false);switches++;}
    if([130,170,210].includes(f)){motion.setActive(true);switches++;}
    const jump=f>20&&f<300;
    step(makeInput({moveY:1,jumpHeld:jump,jumpPressed:jump&&!held,jumpReleased:!jump&&held}));held=jump;
    if(f>110)assert.equal(motion.boardScribble.appearances,0,'variant switch invented a mount');
  }
  // Paused comparison restores the untouched native pose immediately.
  motion.setActive(false);const a=pose(p),b=pose(control);
  a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`paused variant switch left transform ${i}`));
  motion.setActive(true);assert.equal(motion.boardScribble.active,false);

  // A respawn must not retain a source clock or turn into a pickup.
  reset();step(makeInput());assert.equal(motion.phase,'foot');assert.equal(motion.boardScribble.active,false);
  for(const state of ['hang','grind','dead']){
    p.state=state;control.state=state;
    // Match Player's real pose boundary: persistent appearance offsets must
    // be removed before restoring the bridge pose and applied exactly once.
    for(const player of [p,control]){
      player.clearCharacterAppearance();player.playerAnimationBridge.prepareLegacyPose();player.syncCharacterAppearance();
    }
    motion.enter('mount','BR_STAND_0_INTO_MOUNT');
    const before=pose(p);p.playerAnimationBridge.applyFinalOverlay(1/60);
    const after=pose(p);before.forEach((v,i)=>assert.ok(Math.abs(v-after[i])<1e-8,`${state} lost pose ownership ${i}`));
    assert.equal(motion.boardScribble.active,false);
  }
  motion.dispose();original.dispose();runtimes.forEach(r=>r.dispose());
  console.log(JSON.stringify({frames,switches,clearance,uncorrectedInterpolation,interpolatedClearance,transitionAcceleration:{fluid,frozen},seams}));
},{levelEntry:{id:'jump-skate-integration',name:'Jump skate integration',data:{v:1,name:'Jump skate integration',spawn:[0,.03,6],killY:-20,
  components:[{t:'platform',p:[0,-.5,-100],s:[1000,1,1000]},{t:'gate',p:[0,0,-400]}]}}});
