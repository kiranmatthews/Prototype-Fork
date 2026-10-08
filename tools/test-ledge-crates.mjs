import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async ({THREE,Level,Player,CONST,TUNING,server})=>{
 const levels=[];
 const make=(kind='wood',axis='x',sign=1,ceiling=false)=>{
  const point=(inward,y,across=0)=>axis==='x'?[inward*sign,y,across]:[across,y,inward*sign];
  const data={v:1,name:'Ledge crate regression',spawn:point(-.7,.8),killY:-12,components:[
   {t:'platform',p:point(3,-.5),s:axis==='x'?[6,5,8]:[8,5,6],edgeGrinding:false},
   {t:'crate',p:point(.65,2),kind},
   {t:'platform',p:point(50,1.5),s:[8,1,8]},
   {t:'gate',p:point(50,2)},
   ...(ceiling?[{t:'wall',p:point(.5,2.5),s:axis==='x'?[2,.5,3]:[3,.5,2]}]:[]),
  ]};
  const l=new Level(new THREE.Scene(),{id:'ledge-crates',name:data.name,data});levels.push(l);l.update(0);l.scene.updateMatrixWorld(true);
  const p=new Player(l.scene);p.enterLevel('ledge-crates');p.respawn(l,true);p.rawInput=makeInput();
  p.state='air';p.grounded=false;p.pos.fromArray(point(-.52,.8));p.prevPos.copy(p.pos);p.vVel=-1;p.lastVelX=axis==='x'?sign:0;p.lastVelZ=axis==='z'?sign:0;
  p.rawInput=makeInput(axis==='x'?{moveX:sign}:{moveY:-sign});
  const wall=l.walls.find(w=>Math.abs(w.max.y-1.75)<.01);assert.ok(wall, JSON.stringify(l.walls.map(w=>[w.min.toArray(),w.max.toArray()])));
  const caught=p.tryLedgeGrab(wall,l);
  const tick=(input={})=>{p.step(CONST.fixedStep,makeInput(input),l);l.update(CONST.fixedStep);p.commitRenderStep(l);};
  return{p,l,c:l.crates[0],tick,caught,point};
 };
 try{
  for(const axis of ['x','z'])for(const sign of [-1,1])for(const kind of ['wood','mystery','multihit','bouncy']){
   const f=make(kind,axis,sign);assert.ok(f.caught,`${axis}/${sign}/${kind}: no catch`);
   for(let i=0;i<10;i++)f.tick();
   f.tick({jumpPressed:true,jumpHeld:true});
   for(let i=0;i<35;i++)f.tick();
   assert.equal(f.c.alive,false,`${axis}/${sign}/${kind}: blocked by crate`);
   assert.ok(f.p.grounded&&f.p.pos.y>1.99,`${axis}/${sign}/${kind}: no supported finish ${f.p.state}/${f.p.pos.toArray()}`);
  }
  const spin=make();for(let i=0;i<10;i++)spin.tick();spin.tick({spinHeld:true,spinPressed:true});
  assert.ok(spin.p.spinning,'grip swallowed spin input');assert.equal(spin.p.ledgePhase,'climb','spin should request pop-up');
  for(let i=0;i<35;i++)spin.tick();assert.equal(spin.c.alive,false);assert.ok(spin.p.grounded);
  const held=make();for(let i=0;i<10;i++)held.tick();held.tick({jumpPressed:true,jumpHeld:true});
  for(let i=0;i<40;i++)held.tick({jumpHeld:true});held.tick({jumpReleased:true});assert.ok(held.p.grounded,'climb button caused an extra jump');
  for(const kind of ['metal','metalbounce','bang','nitrobang']){
   const f=make(kind);assert.ok(f.caught);for(let i=0;i<10;i++)f.tick();f.tick({jumpPressed:true});for(let i=0;i<30;i++)f.tick();
   assert.ok(f.c.alive);assert.equal(f.p.state,'hang');assert.equal(f.p.ledgePhase,'grip',`${kind}: passed through solid crate`);
  }
  const ceiling=make('wood','x',1,true);assert.ok(ceiling.caught);for(let i=0;i<10;i++)ceiling.tick();ceiling.tick({jumpPressed:true});for(let i=0;i<30;i++)ceiling.tick();assert.equal(ceiling.p.ledgePhase,'grip');
  for(const kind of ['tnt','nitro']){const f=make(kind);assert.ok(f.caught);for(let i=0;i<10;i++)f.tick();f.tick({jumpPressed:true});for(let i=0;i<35;i++)f.tick();assert.equal(f.c.alive,false);assert.ok(f.l.explosions.length||f.p.state==='dead',`${kind}: lost hazard contact`);}
  const rig=await server.ssrLoadModule('/src/cameraRig.ts');for(const side of [0,.25,.5,1])assert.deepEqual(rig.cameraRigFraming(TUNING,side),rig.cameraRigFraming(TUNING,0));
  const wideRig={camDist:16.5,camHeight:7.4,camPitch:21};
  assert.deepEqual(rig.cameraRigFraming(wideRig,1,0,0,false,TUNING),rig.cameraRigFraming(TUNING),'authored wide side preset escaped gameplay framing');
  assert.deepEqual(rig.cameraRigFraming(wideRig,1,0,0,true,TUNING),rig.cameraRigFraming(TUNING,0,0,0,true),'split screen kept the wide side preset');
  // Actual low-speed board takeoffs must retain their heading and momentum
  // through neutral input; speed alone cannot turn them into walking jumps.
  for(const speed of [3,8.3,9.4,12]){
   const f=make();f.p.respawn(f.l,true,false,{position:new THREE.Vector3(...f.point(3,2.02))});
   for(let i=0;i<10;i++)f.tick();
   const p=f.p;p.freeSkate=true;p.speed=speed;p.charging=true;p.chargeTimer=.4;
   p.chargedJump(CONST.fixedStep);const heading=p.axisF.clone(),before=p.pos.clone();
   f.tick();assert.ok(p.airFromSkate&&p.boardOllieAir);
   assert.ok(Math.abs(p.speed-speed)<1e-6,`slow board jump lost speed: ${speed}/${p.speed}`);
   assert.ok(p.pos.clone().sub(before).dot(heading)>speed*CONST.fixedStep*.95);
   if(speed<9){
    p.vVel=TUNING.crateBounce;p.bounceRefresh();const bounceX=p.pos.x;
    f.tick({moveX:1});
    assert.ok(Math.abs(p.pos.x-bounceX-TUNING.walkSpeed*CONST.fixedStep)<1e-6,'crate bounce inherited the board steering lock');
   }
  }
  const jump=make();jump.p.respawn(jump.l,true,false,{position:new THREE.Vector3(...jump.point(3,2.02))});
  for(let i=0;i<10;i++)jump.tick();jump.p.charging=true;jump.p.chargeTimer=.4;jump.p.chargedJump(CONST.fixedStep);
  jump.tick({moveX:1});jump.tick({moveX:1,jumpPressed:true,jumpHeld:true});
  const beforeDouble=jump.p.pos.x;jump.tick({moveX:1,jumpReleased:true});
  assert.ok(jump.p.doubleJumpAir);assert.equal(TUNING.doubleJumpHorizontalScale,1);
  assert.ok(Math.abs(jump.p.pos.x-beforeDouble-TUNING.walkSpeed*CONST.fixedStep)<1e-6,'double jump cut lateral travel');
  // Side-on authored cameras (bonus rooms, galleries) share the close rig.
  const {CameraViewFraming,cameraSideWeight}=await server.ssrLoadModule('/src/cameraViews.ts');
  for(const angle of [0,.7,Math.PI/2])for(const aspect of [16/9,390/844]){
   const dir={x:Math.cos(angle),z:Math.sin(angle)},view={p:[0,0,0],s:[200,80,40],yaw:0,feather:1,
    cameraPosition:[-22*dir.z,8.2,22*dir.x],cameraTarget:[0,5.6,0],cameraFollowDistance:18,cameraFollowTargetHeight:5.3};
   assert.ok(cameraSideWeight(view,dir)>.999);
   const camera=new THREE.PerspectiveCamera(49,aspect,.1,400),layer=new CameraViewFraming(),subject=new THREE.Vector3(4,8,2);
   const distance=Math.hypot(TUNING.camDist,TUNING.camHeight-1.3);
   layer.apply(camera,{view,weight:1},subject,true,undefined,{travel:dir,distance});camera.updateMatrixWorld(true);
   assert.ok(Math.abs(camera.position.distanceTo(subject.clone().add(new THREE.Vector3(0,1.3,0)))-distance)<1e-6);
   for(const y of [0,2.8]){const q=subject.clone().add(new THREE.Vector3(0,y,0)).project(camera);assert.ok(Math.abs(q.x)<1&&Math.abs(q.y)<1,'close side camera cropped hero');}
   assert.ok(cameraSideWeight(view,{x:-dir.z,z:dir.x})<.001,'forward corridor was treated as side-scroll');
  }
  const {THEMED_BONUS_COURSES}=await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
  for(const course of THEMED_BONUS_COURSES)for(const aspect of [16/9,390/844]){
   const spec=course.data.components.find(c=>c.t==='camnode'&&c.cameraView);
   assert.ok(spec,course.id);
   const view={...spec,yaw:spec.yaw??0,feather:spec.radius??1};
   const camera=new THREE.PerspectiveCamera(49,aspect,.1,400),layer=new CameraViewFraming();
   const distance=Math.hypot(TUNING.camDist,TUNING.camHeight-1.3);
   for(let frame=0;frame<=60;frame++){
    const subject=new THREE.Vector3(0,4*Math.sin(Math.PI*frame/60),0);
    layer.restore(camera);
    layer.apply(camera,{view,weight:1},subject,frame===0,
     {groundY:0,grounded:frame===0||frame===60,dt:1/60},{travel:{x:1,z:0},distance,dt:1/60});
    camera.updateMatrixWorld(true);
    for(const x of [-.5,.5])for(const y of [0,2.8]){
     const q=subject.clone().add(new THREE.Vector3(x,y,0)).project(camera);
     assert.ok(Math.abs(q.x)<1&&Math.abs(q.y)<1,`${course.id}: close bonus jump cropped the rider at ${frame}/${aspect}`);
    }
   }
   layer.restore(camera);
   const start=camera.position.clone();
   layer.apply(camera,{view,weight:1},new THREE.Vector3(),false,undefined,{travel:{x:0,z:-1},distance,dt:1/60});
   assert.ok(camera.position.distanceTo(start)<16,'side-to-forward transition snapped out to the authored panorama');
  }
  console.log('PASS four ledge faces, wood families, spin pop-up, held climb release, solid ceilings/steel, explosives and constant side-scroll camera scale');
 }finally{for(const l of levels)l.dispose();}
});
