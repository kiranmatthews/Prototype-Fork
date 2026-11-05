import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data=JSON.parse(await readFile(process.argv[2] || '.skate-reference-data/motion.json','utf8'));
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const p=new Player(scene),control=new Player(scene);
  const source=new PlayableSkateMotion(p,data);
  const binding=RigBinding.fromSculptRuntime(p.animationRig.root);
  const runtime=createCharacterAnimationRuntime(p,createPlayerStarterAnimationSuite(binding.definition));
  p.respawn(level,true);control.respawn(level,true);
  let jump=false,frames=0,maxJointStep=0,previousHead=null; const stepByPhase={};
  const visits=new Set();
  for(let f=0;f<900;f++){
    const time=f/60,held=time>.4&&time<3.5 || time>11&&time<13;
    const input=makeInput({moveY:time<4.8 || time>10?1:0,jumpHeld:held,jumpPressed:held&&!jump,jumpReleased:!held&&jump,grabHeld:time>4.8&&time<8.4});jump=held;
    for(const rider of [p,control]){rider.rawInput=input;rider.step(1/60,input,level);}
    level.update(1/60);frames++;
    assert.ok(p.pos.distanceTo(control.pos)<1e-9,`presentation moved player at ${f}`);
    for(const key of ['speed','vVel','grounded','state','freeSkate','airFromSkate'])assert.equal(p[key],control[key],`${key} differs at ${f}`);
    for(const j of p.animationRig.joints)assert.ok([...j.node.position.toArray(),...j.node.quaternion.toArray(),...j.node.scale.toArray()].every(Number.isFinite),`${j.id} invalid at ${f}`);
    p.group.updateMatrixWorld(true);
    const h=p.animationRig.jointsById.get('head').node.getWorldPosition(new THREE.Vector3()).sub(p.pos);
    if(previousHead){const delta=h.distanceTo(previousHead);maxJointStep=Math.max(maxJointStep,delta);stepByPhase[source.phase]=Math.max(stepByPhase[source.phase]??0,delta);if(delta>.2)console.log('large-step',f,source.phase,delta);}previousHead=h;
    visits.add(source.phase);

  }
  for(const state of ['mount','push','air','land','dismount'])assert.ok(visits.has(state),`missing ${state}`);
  for(const [state,step] of Object.entries(stepByPhase))if(state!=='foot')assert.ok(step<.2,`${state} has a discontinuous head step: ${step}`);
  const primaryFrames=frames;
  const interrupted=new Set();
  for(const release of [8,36,70]){
    for(const rider of [p,control]){rider.enterLevel('skate-motion-test');rider.respawn(level,true);rider.freeSkate=false;}
    source.reset();runtime.restart();jump=false;
    for(let f=0;f<360;f++){
      const held=f<release;
      const input=makeInput({moveY:f>24&&f<release?1:0,jumpHeld:held,jumpPressed:held&&!jump,jumpReleased:!held&&jump,grabHeld:f>100&&f<170});jump=held;
      for(const rider of [p,control]){rider.rawInput=input;rider.step(1/60,input,level);}
      level.update(1/60);frames++;interrupted.add(source.phase);
      assert.ok(p.pos.distanceTo(control.pos)<1e-9,`interrupt changed physics at ${release}/${f}`);
      for(const key of ['speed','vVel','grounded','state','freeSkate','airFromSkate'])assert.equal(p[key],control[key]);
      if(!p.freeSkate&&!p.grounded)assert.equal(source.phase,'foot','pickup continued through an on-foot jump');
    }
    assert.equal(source.phase,'foot','short gesture left the source layer stuck');
    assert.equal(source.retarget.board.visible,false,'board stayed carried after the finite exit');
  }
  source.enabled=false;
  for(let f=0;f<30;f++){const input=makeInput();p.rawInput=input;p.step(1/60,input,level);}
  assert.equal(source.phase,'foot');
  source.dispose();runtime.dispose();
  console.log(JSON.stringify({frames,primaryFrames,visits:[...visits],interrupted:[...interrupted],maxJointStep,stepByPhase}));
},{levelEntry:{id:'skate-motion-test',name:'Skate motion test',data:{v:1,name:'Skate motion test',spawn:[0,.03,6],killY:-20,components:[{t:'platform',p:[0,-.5,-100],s:[1000,1,1000]},{t:'gate',p:[0,0,-400]}]}}});
