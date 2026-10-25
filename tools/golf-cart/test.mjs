import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const fixture=await build({stdin:{contents:`export * from './src/golf-cart/physics';export * from './src/golf-cart/model';export * from './src/golf-cart/driver';export * from './src/golf-cart/fleet';export * from './src/golf-cart/course';export * from './src/golf-cart/labCourse';export * as THREE from 'three';export {countryClubNearestRoad,countryClubDeckHeight} from './src/levels/country-club-layout';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(fixture.outputFiles[0].text).toString('base64'));
const {GolfCartPhysics,NO_CART_INPUT,CART_PHYSICS,GolfCartKit,GolfDriverKit,GolfCartFleet,THREE}=m;
const flat=()=>({height:0,grip:1,drag:0,safe:true});
const run=(world,seconds,hz=60,control)=>{for(let i=0;i<Math.round(seconds*hz);i++)world.advance(1/hz,control);return world.carts[0];};
const drive=w=>{w.inputs[0]={throttle:1,steer:w.time>2?.45:0,brake:0,handbrake:w.time>4&&w.time<5,hop:w.time>3&&w.time<3.2};};
const report={};
const states=[30,60,144].map(hz=>run(new GolfCartPhysics(flat,[{x:0,z:0,yaw:0}]),10,hz,drive));
for(const c of states.slice(1))for(const key of ['x','y','z','vx','vz','vy','yaw','roll','pitch','travel','tumbleAngle'])assert.ok(Math.abs(c[key]-states[0][key])<1e-8,`${key}: render-rate invariance`);
report.renderRates=[30,60,144];
const speedWorld=new GolfCartPhysics(flat,[{x:0,z:0,yaw:0}]);const fast=run(speedWorld,20,60,w=>w.inputs[0]={...NO_CART_INPUT,throttle:1});
assert.ok(fast.speed>12&&fast.speed<CART_PHYSICS.topSpeed,'useful bounded cruising speed');report.topSpeedKmh=fast.speed*3.6;
run(speedWorld,3,60,w=>w.inputs[0]={...NO_CART_INPUT,brake:1});assert.ok(Math.abs(fast.speed)<.01,'brakes stop the cart');
run(speedWorld,8,60,w=>w.inputs[0]={...NO_CART_INPUT,throttle:-1,steer:.6});assert.ok(fast.speed< -3&&fast.speed> -6.1,'reverse is bounded');
const parked=new GolfCartPhysics(flat,[{x:2,z:-3,yaw:1}]);run(parked,60);assert.equal(parked.carts[0].x,2);assert.equal(parked.carts[0].z,-3);assert.equal(parked.carts[0].y,0);
const wall=new GolfCartPhysics(flat,[{x:0,z:5,yaw:0}],[{x:0,z:0,radius:1,id:'barrel'}]);wall.carts[0].vz=-13;
run(wall,1);assert.ok(wall.carts[0].z>2.0,'rounded chassis does not tunnel into barrel');assert.ok(wall.carts[0].damage[0]>.1,'nose damage from frontal impact');assert.ok(wall.carts[0].hits>=1);report.wallDamage=[...wall.carts[0].damage];
const largeWall=new GolfCartPhysics(flat,[{x:0,z:7,yaw:0}],[{x:0,z:0,radius:1,id:'barrel'}],{scale:2});largeWall.carts[0].vz=-13;run(largeWall,1);assert.ok(largeWall.carts[0].z>3.5,'double-sized chassis contacts the obstacle at its larger bumper');
const pair=new GolfCartPhysics(flat,[{x:0,z:4,yaw:0},{x:0,z:-4,yaw:Math.PI}]);pair.carts[0].vz=-10;pair.carts[1].vz=10;run(pair,1);
assert.ok(pair.carts.every(c=>c.hits>0&&c.health<1),'both bodies take impact damage');assert.ok(pair.carts[0].z>pair.carts[1].z,'head-on collision preserves ordering');assert.ok(pair.carts.every(c=>Math.hypot(c.vx,c.vz)<10),'collision loses energy');
const overlap=new GolfCartPhysics(flat,Array.from({length:5},()=>({x:0,z:0,yaw:0})));run(overlap,3);assert.ok(overlap.carts.every(c=>[c.x,c.z,c.yaw].every(Number.isFinite)),'coincident spawns separate without NaNs');
const recovery=new GolfCartPhysics((x,z)=>({...flat(),safe:Math.hypot(x,z)<5}),[{x:0,z:0,yaw:0}]);recovery.carts[0].x=20;run(recovery,1.3);assert.equal(recovery.carts[0].respawns,1);assert.equal(recovery.carts[0].x,0);
recovery.advance(30);assert.ok(recovery.droppedTime>29,'background gaps cannot trigger unbounded catch-up');assert.ok(recovery.steps<200);
const hopper=new GolfCartPhysics(flat,[{x:0,z:0,yaw:0}]);let hopApex=0;for(let i=0;i<120*3;i++){hopper.advance(1/120,w=>w.inputs[0]={...NO_CART_INPUT,hop:true});hopApex=Math.max(hopApex,hopper.carts[0].y);}
assert.ok(hopApex>1.1&&hopApex<1.5,'stationary spring hop gives useful air');assert.equal(hopper.carts[0].airborneCount,1,'held hop does not auto-repeat');assert.ok(hopper.carts[0].grounded);assert.equal(hopper.carts[0].health,1,'normal bouncy landings do not damage the cart');
const rampGround=(x,z)=>({...flat(),height:z>=0&&z<6?(6-z)*.2:0});const ramp=new GolfCartPhysics(rampGround,[{x:0,z:8,yaw:0}]);ramp.carts[0].vz=-12;let rampAir=0;
for(let i=0;i<120*3;i++){ramp.advance(1/120);rampAir=Math.max(rampAir,ramp.carts[0].y-rampGround(ramp.carts[0].x,ramp.carts[0].z).height);}assert.ok(rampAir>1.2,'ramp crests launch the cart');
const roll=new GolfCartPhysics(flat,[{x:0,z:0,yaw:0}]);roll.kick(0,10,0,16);let maxRoll=0;for(let i=0;i<120*6;i++){roll.advance(1/120);maxRoll=Math.max(maxRoll,Math.abs(roll.carts[0].tumbleAngle));}
assert.equal(roll.carts[0].rolls,1);assert.ok(maxRoll>Math.PI,'hard side hit can roll onto the roof');assert.equal(roll.carts[0].tumbling,false,'finite self-righting recovery');assert.equal(roll.carts[0].recoveries,1);assert.equal(roll.carts[0].tumbleAngle,0);
const ordinary=new GolfCartPhysics(flat,[{x:0,z:0,yaw:0}]);run(ordinary,30,60,w=>w.inputs[0]={...NO_CART_INPUT,throttle:1,steer:.8});assert.equal(ordinary.carts[0].rolls,0,'ordinary grounded cornering never triggers a random flip');
const tBone=new GolfCartPhysics(flat,[{x:-7,z:0,yaw:-Math.PI/2},{x:0,z:0,yaw:0}]);tBone.carts[0].vx=16;run(tBone,6);assert.equal(tBone.carts[1].rolls,1,'a real fast side collision can roll the struck cart');assert.equal(tBone.carts[1].recoveries,1,'natural collision roll recovers');
report.silliness={hopApex,rampAir,maxRollRadians:maxRoll,rareSideImpactRolls:roll.carts[0].rolls,recoveries:roll.carts[0].recoveries,naturalSideCollisionRolls:tBone.carts[1].rolls};
const fleet=new GolfCartFleet({ground:m.labGround,spawns:m.LAB_SPAWNS,routes:m.LAB_ROUTES,obstacles:m.LAB_OBSTACLES});
const initialGeometry=fleet.models[0].root.getObjectByName('chassis').geometry;assert.equal(initialGeometry,fleet.models[4].root.getObjectByName('chassis').geometry,'shared fleet geometry');
const other=fleet.models[1].materials.paint.color.getHex();fleet.models[0].setPalette({paint:'#ff0000'});assert.equal(fleet.models[1].materials.paint.color.getHex(),other,'paint isolation');
const cart=fleet.models[0],peer=fleet.models[1],canopy=cart.root.getObjectByName('canopy'),bag=cart.root.getObjectByName('golf-bag');
assert.equal(canopy.material.map,peer.root.getObjectByName('canopy').material.map,'fleet shares the canopy texture');
assert.equal(cart.wheels[0].children[0].material.map,peer.wheels[3].children[0].material.map,'twenty wheels share one texture');
assert.equal(canopy.material.flatShading,false,'sculpted canopy keeps smooth normals');
assert.equal(cart.root.getObjectByName('nose-shell').material.flatShading,true,'procedural body keeps authored flat shading');
const peerRoof=peer.materials.canopyArt.color.getHex(),peerBag=peer.materials.bagArt.color.getHex();
cart.setPalette({cream:'#97d2ff',cargo:'#9933ee'});
assert.equal(canopy.material.color.getHex(),0x97d2ff);assert.equal(bag.material.color.getHex(),0x9933ee);
assert.equal(peer.materials.canopyArt.color.getHex(),peerRoof);assert.equal(peer.materials.bagArt.color.getHex(),peerBag);
for(const geometry of [...fleet.kit.parts.map(p=>p.geometry),fleet.kit.wheel,cart.socket.getObjectByName('HeadRebound').geometry]){
  if(!geometry.userData.source)continue;
  const normals=geometry.getAttribute('normal');
  for(let i=0;i<normals.count;i++)assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<.01,'finite unit smooth normals');
  assert.equal(geometry.getAttribute('uv').count,geometry.getAttribute('position').count,'complete texture coordinates');
}
let textureDisposed=0;canopy.material.map.addEventListener('dispose',()=>textureDisposed++);
const allBefore=fleet.models[0].stats.triangles;for(const style of m.DRIVER_STYLES){fleet.setDriver(0,style);assert.equal(fleet.models[0].socket.children.length,1);}
fleet.setDriver(0,null);assert.equal(fleet.models[0].socket.children.length,0);assert.ok(fleet.models[0].stats.triangles<allBefore);fleet.setDriver(0,'captain');
fleet.models[0].setModule('roof',false);assert.equal(fleet.models[0].modules.roof.visible,false);fleet.models[0].setModule('roof',true);
const timings=[];for(let i=0;i<60*60;i++){const begin=performance.now();fleet.update(1/60);timings.push(performance.now()-begin);}
assert.ok(fleet.physics.carts.every(c=>[c.x,c.y,c.z,c.yaw,c.roll,c.pitch].every(Number.isFinite)&&Math.abs(c.roll)<.4),'one minute, five physical AI drivers remain stable');
assert.ok(fleet.physics.carts.every(c=>c.travel>50),'all AI carts actually drive');
assert.ok(fleet.stats.fleetTriangles<40000,'five-cart geometry budget');
timings.sort((a,b)=>a-b);report.fleet={...fleet.stats,updateMedianMs:timings[Math.floor(timings.length*.5)],updateP95Ms:timings[Math.floor(timings.length*.95)],travel: fleet.physics.carts.map(c=>c.travel),respawns:fleet.physics.carts.map(c=>c.respawns),rolls:fleet.physics.carts.map(c=>c.rolls)};
const boxes=fleet.models.map(model=>{model.root.position.set(0,0,0);model.root.rotation.set(0,0,0);model.update({time:0,steer:0,roll:0,pitch:0,impact:0,speed:0,wheelTravel:0,suspension:[0,0,0,0],damage:[0,0,0]});model.root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).toArray();});
report.bounds=boxes[0];assert.ok(boxes[0][0]<2&&boxes[0][1]<2.2&&boxes[0][2]<3.4,'game-sized chassis');
let disposed=0;initialGeometry.addEventListener('dispose',()=>disposed++);fleet.models[0].dispose();assert.equal(disposed,0,'one cart cannot invalidate peers');fleet.dispose();assert.equal(disposed,1);fleet.dispose();assert.equal(disposed,1,'idempotent fleet disposal');assert.equal(textureDisposed,1,'shared artwork texture disposed exactly once');
const scene=new THREE.Scene(),traffic=new m.CountryClubCarts(scene);const level={walls:[]};const begin=performance.now();traffic.attach(level,'country-club');assert.equal(traffic.fleet.models.length,20);const courseFleet=traffic.fleet;report.courseAttachMs=performance.now()-begin;
for(const c of courseFleet.physics.carts)assert.ok(Math.abs(c.y-courseFleet.physics.ground(c.x,c.z).height)<.12,'tyres sit on the actual fairway support');
const probe=new m.CountryClubCarts(new THREE.Scene());let casts=0;probe.attach({walls:[],raycastGround:()=>{casts++;return [{point:{y:12}}];}},'country-club');assert.ok(casts>0&&casts<=128,'traffic setup samples real support without raycasting the whole navigation grid');assert.ok(probe.fleet.physics.carts.every(c=>c.y===12),'authored runtime collision support overrides source fallback');probe.attach({walls:[]},'flats');
assert.ok(courseFleet.models.every(m=>m.root.scale.x===2),'all twenty carts and their seated drivers are double size');
assert.equal(courseFleet.physics.radius,CART_PHYSICS.radius*2);assert.equal(courseFleet.physics.probeOffset,CART_PHYSICS.probeOffset*2);
const moving={pos:new THREE.Vector3(),speed:52,state:'dead'};
const roam=traffic.roaming,world=courseFleet.physics;
roam.reset(world,71);const firstSpawns=world.carts.map(c=>[c.x,c.z,c.yaw]);
roam.reset(world,72);assert.notDeepEqual(world.carts.map(c=>[c.x,c.z,c.yaw]),firstSpawns,'different race seeds change traffic placement');
roam.reset(world,71);assert.deepEqual(world.carts.map(c=>[c.x,c.z,c.yaw]),firstSpawns,'traffic restart remains reproducible for replays');
const samples=Array.from({length:20},()=>({offroad:0,total:0,onroad:0,maxHome:0,minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity}));
for(let i=0;i<60*150;i++){
  roam.course.sample(Math.min(roam.course.length-20,i/60*52),0,moving.pos);traffic.step(1/60,moving);
  if(i%60===0)world.carts.forEach((c,j)=>{
    const near=roam.course.project(new THREE.Vector3(c.x,c.y,c.z)),s=samples[j],home=roam.patches[j].home;
    s.total++;if(near.distance>roam.course.width(near.s)/2+5)s.offroad++;else s.onroad++;
    s.maxHome=Math.max(s.maxHome,Math.hypot(c.x-home.x,c.z-home.z));
    s.minX=Math.min(s.minX,c.x);s.maxX=Math.max(s.maxX,c.x);s.minZ=Math.min(s.minZ,c.z);s.maxZ=Math.max(s.maxZ,c.z);
  });
}
report.course={fleet:courseFleet.stats,progress:roam.progress,speed:world.carts.map(c=>c.speed),health:world.carts.map(c=>c.health),rolls:world.carts.map(c=>c.rolls),elapsedMs:performance.now()-begin,positions:world.carts.map(c=>[c.x,c.y,c.z]),travel:world.carts.map(c=>c.travel),respawns:world.carts.map(c=>c.respawns),samples,trips:roam.drivers.map(d=>d.trips),nodes:roam.patches.map(p=>p.nodes.length)};
console.log(JSON.stringify({roaming:report.course}));
assert.ok(world.carts.every(c=>[c.x,c.y,c.z,c.speed].every(Number.isFinite)),'all twenty roaming carts remain finite');
assert.ok(samples.every(s=>s.maxHome<130),'carts stay dispersed in local territories instead of racing to the finish');
assert.ok(samples.reduce((n,s)=>n+s.offroad,0)/samples.reduce((n,s)=>n+s.total,0)>.65,'most traffic travels across the field');
assert.ok(samples.filter(s=>s.onroad>0).length>=6,'independent fairway trips still cross the race');
assert.ok(world.carts.every(c=>c.travel>350),'every cart drives meaningful cross-country distances');
assert.ok(roam.drivers.every(d=>d.trips>=4),'no cart stays trapped at a route end');
assert.ok(world.carts.every(c=>c.respawns<=2),'safe routes avoid repeated water resets');
// Moving the skater to the opposite end cannot alter a cart's controls or route.
const snapshot=()=>world.carts.map(c=>[c.x,c.z,c.yaw,c.speed]);
const replay=at=>{roam.reset(world,82);moving.pos.copy(roam.course.sample(at));for(let j=0;j<60*12;j++)traffic.step(1/60,moving);return snapshot();};
assert.deepEqual(replay(0),replay(roam.course.length),'free roam stays independent of the skater');
// Equal arrival windows must favour actual first place, even when it is last
// in the supplied list. Commit to supported grass destinations, not a chase.
const targeted=[0,0,0];
for(let i=0;i<roam.patches.length;i++){
  roam.reset(world,71);
  const station=roam.course.project(roam.patches[i].home).s;
  const leaders=[3,2,1].map(rank=>({rank,progress:station-80,speed:25}));
  world.advance(1/60,w=>roam.drive(w,leaders));
  roam.crossingsByRank.forEach((n,rank)=>targeted[rank]+=n);
  for(const [j,d]of roam.drivers.entries())if(d.targetRank){
    assert.equal(d.targetRank,1,'first place wins otherwise equal crossing opportunities');
    assert.ok(roam.patches[j].nodes[d.path.at(-1)].offroad,'targeted crossing still exits onto grass');
    const path=[...d.path];roam.clearAfterContact(j,world);
    for(let step=0;step<30;step++)world.advance(1/60,w=>roam.drive(w,leaders));
    assert.deepEqual(d.path,path,'contact grace cannot immediately retarget the racer');
  }
}
assert.ok(targeted[0]>=10,'leaders approaching the real course receive crossing traffic');
assert.deepEqual(targeted.slice(1),[0,0]);
report.leaderCrossings=targeted;
roam.reset(world,71);assert.deepEqual(roam.crossingsByRank,[0,0,0],'retry clears leader crossing history');
traffic.attach({walls:[]},'flats');assert.equal(traffic.fleet,null);assert.equal(scene.children.length,0,'level switching releases the fleet');
await mkdir('docs/golf-cart',{recursive:true});await writeFile(process.env.GOLF_CART_REPORT||'docs/golf-cart/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.log('Golf cart dynamics, shared resources, driver swaps, budgets and course patrols passed.');
