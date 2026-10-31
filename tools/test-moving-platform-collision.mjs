import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data={v:1,name:'Moving platform sides',spawn:[12,.1,12],killY:-40,components:[
  {t:'platform',p:[12,-.5,12],s:[6,1,6]},
  {t:'mover',nm:'Rising deck',p:[0,6,0],s:[8,1.4,8],axis:'y',amp:1,speed:.55},
  {t:'mover',nm:'Spinning deck',p:[20,6,0],s:[8,1.4,12],axis:'x',amp:2,speed:.55,spin:35},
  {t:'gate',p:[12,0,10]},
]};
await withSkateRuntime(async({player:p,level,server,THREE,CONST,TUNING,Level})=>{
  p.competitionMode=false;
  const tuning=JSON.stringify(TUNING),normal=new THREE.Vector3();let contacts=0;
  const checkFaces=(mesh,world=level)=>{
    mesh.geometry.computeBoundingBox();mesh.updateMatrixWorld(true);
    const box=mesh.geometry.boundingBox,half={x:.42,y:.8,z:.36};
    const dy=world.movers.find(m=>m.mesh===mesh)?.lastDelta.y??0;
    for(const axis of ['x','z'])for(const sign of [-1,1]){
      const edge=sign>0?box.max[axis]:box.min[axis];
      const local=new THREE.Vector3(0,box.max.y-.9,0);local[axis]=edge+sign*2;
      const from=mesh.localToWorld(local.clone());local[axis]=edge-sign*2;
      const to=mesh.localToWorld(local.clone());
      assert.ok(world.meshSideCollisions.resolve(from,to,half,normal),`${mesh.name}: ${axis}/${sign} edge has no collision`);
      const resolved=mesh.worldToLocal(to.clone());
      assert.ok((resolved[axis]-edge)*sign>.3,`${mesh.name}: crossed a moving side`);contacts++;
      const above=from.clone();above.y=mesh.position.y-Math.min(0,dy)+box.max.y+.1;
      const aboveEnd=mesh.localToWorld(local.clone());aboveEnd.y=above.y;
      assert.equal(world.meshSideCollisions.resolve(above,aboveEnd,half,normal),false,'the top is still owned by native landing/support');
      const below=from.clone();below.y=mesh.position.y-Math.max(0,dy)+box.min.y-2.2;
      const belowEnd=mesh.localToWorld(local.clone());belowEnd.y=below.y;
      assert.equal(world.meshSideCollisions.resolve(below,belowEnd,half,normal),false,'a clear route beneath the deck was blocked');
    }
  };
  for(let phase=0;phase<4;phase++){
    level.update(.37);for(const m of level.movers)checkFaces(m.mesh);
  }

  // A rising foot jump meeting the thin front face used to enter the slab
  // before it was eligible for the normal top landing or ledge catch.
  p.respawn(level,true);const mover=level.movers[0];
  mover.amp=0;level.update(0);
  const top=mover.mesh.position.y+.7;
  p.pos.set(0,top-1.1,4.7);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;
  p.freeSkate=p.airFromSkate=false;p.vVel=4;p.speed=0;p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);
  for(let f=0;f<8;f++){
    p.step(CONST.fixedStep,makeInput({moveY:1}),level);level.update(CONST.fixedStep);
    assert.ok(p.pos.z>=4+p.hitboxHalf.z-.015,`native rising jump ghosted through face at frame ${f}: ${p.pos.toArray()}`);
    assert.ok(p.pos.toArray().every(Number.isFinite));
  }

  // Real authored lift shapes/yaws use the same path, independent of art.
  const {CARLISLE_TIDAL_RELAY_LEVEL:course}=await server.ssrLoadModule('/src/levels/carlisle-tidal-relay.ts');
  const lifts=course.components.filter(c=>c.t==='mover'&&/Tide steps|Counterweight \d/.test(c.nm??''));
  assert.equal(lifts.length,8);
  for(const lift of lifts){
    const authored=new Level(new THREE.Scene(),{id:'__authored_lift',name:lift.nm,
      data:{...data,components:[data.components[0],lift,data.components.at(-1)]}});
    try{for(let phase=0;phase<3;phase++){authored.update(.59);checkFaces(authored.movers[0].mesh,authored);}}
    finally{authored.dispose();}
  }
  const {MeshSideCollisions}=await server.ssrLoadModule('/src/meshSideCollisions.ts');
  const sides=new MeshSideCollisions(),mesh=new THREE.Mesh(new THREE.BoxGeometry(8,1.4,8));
  mesh.position.y=5.3;mesh.updateMatrixWorld(true);let active=true;sides.add(mesh,()=>active,true);
  sides.beginStep();mesh.position.x=3;mesh.updateMatrixWorld(true);
  const stationary=new THREE.Vector3(5,5.1,0),from=stationary.clone();
  assert.ok(sides.resolve(from,stationary,{x:.42,y:.8,z:.36},normal),'moving edge missed a stationary player');
  assert.ok(stationary.x>7.41,'moving side did not separate the body');
  mesh.visible=false;sides.resetMotion();
  assert.ok(sides.resolve(new THREE.Vector3(9,5.1,0),new THREE.Vector3(5,5.1,0),{x:.42,y:.8,z:.36},normal),'render visibility disabled collision');
  active=false;
  assert.equal(sides.resolve(new THREE.Vector3(9,5.1,0),new THREE.Vector3(5,5.1,0),{x:.42,y:.8,z:.36},normal),false,'inactive support retained a collider');
  active=true;mesh.position.x=50;mesh.updateMatrixWorld(true);sides.resetMotion();
  assert.equal(sides.resolve(from,from.clone(),{x:.42,y:.8,z:.36},normal),false,'reset swept an old platform pose through the player');
  sides.dispose();mesh.geometry.dispose();mesh.material.dispose();
  assert.equal(JSON.stringify(TUNING),tuning);
  console.log(`PASS ${contacts} moving/rotating/authored lift side contacts, unobstructed tops/undersides, native rising-jump edge block, stationary-body sweep, activation/reset, unchanged tuning.`);
},{levelEntry:{id:'__moving_platform_sides',name:data.name,data}});
