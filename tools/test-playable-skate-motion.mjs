import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data=JSON.parse(await readFile(process.argv[2] || '.skate-reference-data/motion.json','utf8'));
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {boardGroundClearance}=await server.ssrLoadModule('/src/skateReferenceLab/boardGrounding.ts');
  const {BoardScribbleSequence,BoardScribbleEffect,SCRIBBLE_FRAMES,SCRIBBLE_FPS,MOUNT_CLEAR_DURATION}=await server.ssrLoadModule('/src/skateReferenceLab/boardScribble.ts');
  // One full-board tick between the grow-in/out. Smaller drawings change;
  // the card and stroke width never scale, and visibility cannot retrigger ink.
  const clock=new BoardScribbleSequence(),root=new THREE.Group(),board=new THREE.Group();root.add(board);
  const effect=new BoardScribbleEffect(new THREE.Texture(),root,board,clock);
  assert.equal(effect.sprite.material.transparent,true,'ink must draw after the floor/grid');
  assert.equal(effect.sprite.material.blending,THREE.NoBlending,'late ink changed the cutout drawing');
  assert.equal(effect.sprite.material.depthTest,true,'ink would cover foreground limbs');
  assert.equal(effect.sprite.material.depthWrite,false);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(4,2,7);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  clock.start(true);effect.update(camera);
  const quad=effect.sprite.scale.toArray(),cells=new Set(),inkFrames=[];
  assert.equal(clock.boardVisible,false,'board reveals before the first ink drawings');
  for(let f=0;f<SCRIBBLE_FRAMES;f++){
    if(f)clock.step(1/SCRIBBLE_FPS);
    effect.update(camera);cells.add(effect.sprite.material.map.offset.toArray().join(','));
    inkFrames.push(clock.frame);
    assert.deepEqual(effect.sprite.scale.toArray(),quad,'scribble is being scaled instead of redrawn');
    assert.ok(effect.sprite.visible);
    assert.equal(clock.boardVisible,f>=9,'board covered the one full-size ink drawing');
  }
  assert.equal(cells.size,19);assert.equal(inkFrames.filter(f=>f===0).length,1);
  assert.ok(inkFrames.slice(0,8).every((f,i,a)=>f>=14&&(!i||f<=a[i-1])),'growth does not use larger successive drawings');
  assert.ok(inkFrames.slice(9).every((f,i,a)=>f>=14&&(!i||f>=a[i-1])),'clearing does not use smaller successive drawings');
  clock.step(1/20);effect.update(camera);assert.equal(effect.sprite.visible,false);
  for(let f=0;f<120;f++)clock.step(1/60);
  assert.equal(clock.appearances,1);
  clock.start(false);assert.equal(clock.disappearances,1);assert.equal(clock.boardVisible,true,'dismount hides the deck before the growth apex');
  effect.update(camera);const disappearancePosition=effect.sprite.position.clone(),disappearanceScale=effect.sprite.scale.clone();
  clock.enabled=false;effect.update(camera);
  clock.enabled=true;effect.update(camera);
  assert.ok(effect.sprite.position.distanceTo(disappearancePosition)<1e-9,'paused A/B moved the disappearance ink');
  assert.ok(effect.sprite.scale.distanceTo(disappearanceScale)<1e-9,'A/B resized the active burst');
  board.position.set(5,3,-2);effect.update(camera);
  assert.ok(effect.sprite.position.clone().sub(disappearancePosition).distanceTo(board.position)<1e-9,'pickup ink did not follow the board toward the hand');
  assert.ok(effect.sprite.scale.distanceTo(disappearanceScale)<1e-9,'following the pickup resized the ink');
  const standingInkDuration=.2;
  clock.start(false,standingInkDuration,2);let apexTicks=0;
  for(let f=0;f<12;f++){
    if(f)clock.step(1/60);
    effect.update(camera);cells.add(effect.sprite.material.map.offset.toArray().join(','));
    assert.equal(clock.active,true);
    if(clock.frame===0)apexTicks++;
    assert.equal(clock.boardVisible,f<2,'standing deck missed the hand catch');
  }
  assert.equal(apexTicks,1);
  clock.step(1/60);assert.equal(clock.active,false,'standing pickup missed tail deadline');
  clock.start(true);assert.equal(clock.appearances,2,'new mount cue did not restart');
  clock.enabled=false;assert.equal(clock.active,false);assert.equal(clock.boardVisible,true);
  const elapsed=clock.elapsed;clock.enabled=true;assert.equal(clock.elapsed,elapsed,'A/B advanced the source clock');
  clock.cancel();clock.prepare(.3,.55);effect.update(camera,new THREE.Plane(new THREE.Vector3(0,1,0),0));
  const previewPosition=effect.sprite.position.clone(),previewProgress=clock.progress,previewCounts=[clock.appearances,clock.disappearances];
  clock.unwind();clock.step(1/60);
  root.position.set(1,2,3);board.position.set(-4,5,7);effect.update(camera);
  assert.ok(clock.progress<previewProgress&&clock.frame>=14,'cancel did not reverse the preview');
  assert.ok(effect.sprite.position.distanceTo(previewPosition)<1e-9,'cancelled preparation followed a released jump into the air');
  assert.equal(effect.floorEnabled.value,1,'cancelled preparation lost its cached ground surface');
  const partial=clock.progress;clock.prepare(1/60,.55);effect.update(camera);
  assert.ok(clock.progress>partial&&clock.progress<previewProgress,'re-hold restarted instead of reversing from the current drawing');
  assert.ok(effect.sprite.position.distanceTo(previewPosition)>.1,'re-hold failed to follow the board again');
  clock.prepare(2,.55);assert.equal(clock.frame,14,'a pending mount held a full-board drawing');
  assert.deepEqual([clock.appearances,clock.disappearances],previewCounts,'a cancelled preview counted as an equipment switch');
  clock.start(true,MOUNT_CLEAR_DURATION,0);const committed=[];
  for(let f=0;f<19;f++){if(f)clock.step(1/60);committed.push(clock.frame);assert.equal(clock.boardVisible,f>0);}
  assert.deepEqual(committed,[0,...Array.from({length:18},(_,i)=>i+14)],'committed mount did not have one apex and 18 clearing drawings');
  clock.step(1/60);assert.equal(clock.active,false);
  clock.prepare(.2,.55);clock.unwind();clock.step(.18);assert.equal(clock.active,false,'cancel never settled');
  clock.prepare(1/60,.55);clock.unwind();effect.update(camera);
  assert.equal(effect.sprite.visible,false,'unrendered preparation first appeared on release');
  // Floor splitting must cover the complete original PNG rectangle and keep
  // each triangle on one side of the surface, including corner/edge contacts.
  root.position.set(0,0,0);board.position.set(0,0,0);clock.start(true);
  for(const slope of [0,.22])for(const y of [-1,0,.244,1])for(let f=0;f<32;f++){
    const floor=new THREE.Plane(new THREE.Vector3(0,1,slope).normalize(),-y);
    clock.elapsed=f/60;effect.update(camera,floor);
    const geometry=effect.sprite.geometry,positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    const count=geometry.drawRange.count;assert.ok(count>=6&&count<=12&&count%3===0);
    const center=effect.sprite.position.clone().applyMatrix4(camera.matrixWorldInverse),c=Math.cos(effect.sprite.material.rotation),s=Math.sin(effect.sprite.material.rotation);
    let area=0;
    for(let i=0;i<count;i+=3){
      const distances=[];
      for(let j=0;j<3;j++){
        const k=i+j,x=positions.getX(k),y=positions.getY(k);
        assert.ok(Math.abs(uv.getX(k)-x-.5)<1e-7&&Math.abs(uv.getY(k)-y-.5)<1e-7,'floor projection changed PNG coordinates');
        const u=(x+.5-effect.sprite.center.x)*effect.sprite.scale.x,v=(y+.5-effect.sprite.center.y)*effect.sprite.scale.y;
        const world=new THREE.Vector3(center.x+c*u-s*v,center.y+s*u+c*v,center.z).applyMatrix4(camera.matrixWorld);
        distances.push(floor.distanceToPoint(world)-.0005);
      }
      assert.ok(Math.min(...distances)>-1e-6||Math.max(...distances)<1e-6,'a triangle interpolates depth across the floor edge');
      area+=Math.abs((positions.getX(i+1)-positions.getX(i))*(positions.getY(i+2)-positions.getY(i))-(positions.getX(i+2)-positions.getX(i))*(positions.getY(i+1)-positions.getY(i)))/2;
    }
    assert.ok(Math.abs(area-1)<1e-7,'floor split lost or overlapped part of the drawing');
    assert.deepEqual(effect.sprite.scale.toArray(),quad,'floor split resized the drawing');
  }
  clock.cancel();assert.equal(clock.active,false);
  clock.reset();assert.equal(clock.active,false);effect.dispose();
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const p=new Player(scene),control=new Player(scene);
  const source=new PlayableSkateMotion(p,data);
  const binding=RigBinding.fromSculptRuntime(p.animationRig.root);
  const runtime=createCharacterAnimationRuntime(p,createPlayerStarterAnimationSuite(binding.definition));
  p.respawn(level,true);control.respawn(level,true);
  let jump=false,frames=0,maxJointStep=0,previousHead=null; const stepByPhase={};
  const visits=new Set();
  let groundedEquipmentFrames=0;
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
    if(p.grounded&&['mount','dismount'].includes(source.phase)){
      const support=new THREE.Plane().setFromNormalAndCoplanarPoint(p.groundHit.normal,p.pos);
      assert.ok(boardGroundClearance(source.retarget.board,support)>=.002-1e-7,`native crossfade put the board through the floor at ${f}`);
      groundedEquipmentFrames++;
    }

  }
  for(const state of ['mount','push','air','land','dismount'])assert.ok(visits.has(state),`missing ${state}`);
  for(const [state,step] of Object.entries(stepByPhase))if(state!=='foot')assert.ok(step<.2,`${state} has a discontinuous head step: ${step}`);
  const primaryFrames=frames;
  assert.equal(source.boardScribble.appearances,2,'equipment appearance burst retriggered or was missed');
  assert.equal(source.boardScribble.disappearances,1,'equipment disappearance burst retriggered or was missed');
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
  assert.ok(groundedEquipmentFrames>150);
  console.log(JSON.stringify({frames,primaryFrames,groundedEquipmentFrames,visits:[...visits],interrupted:[...interrupted],maxJointStep,stepByPhase}));
},{levelEntry:{id:'skate-motion-test',name:'Skate motion test',data:{v:1,name:'Skate motion test',spawn:[0,.03,6],killY:-20,components:[{t:'platform',p:[0,-.5,-100],s:[1000,1,1000]},{t:'gate',p:[0,0,-400]}]}}});
