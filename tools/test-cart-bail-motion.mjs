import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts'),layout=await e.server.ssrLoadModule('/src/levels/cart-stadium-layout.ts');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');const results=[];
 for(const scenario of [{name:'slow roll',speed:8},{name:'full speed',speed:32},{name:'reverse',speed:-20},{name:'airborne',speed:28,height:4},{name:'cart wreck after release',speed:26,wreck:true},{name:'rock side',speed:25,s:78,u:7},{name:'blocked door',speed:25,s:90,u:4},{name:'moving wreck ejection',speed:24,forced:true},{name:'offscreen moving wreck',speed:24,forced:true,hidden:true,s:1050}]){
  race.start('time-trial',0);race.phase='running';const c=race.carts,w=c.fleet.physics,at=layout.rallySurfacePoint(scenario.s??58,scenario.u??0),f=layout.cartRallyFrame(scenario.s??58),v=w.carts[0];
  if(scenario.hidden){const camera=new e.THREE.PerspectiveCamera(50,1,.1,10);camera.position.set(-1000,40,0);camera.lookAt(-1000,40,-10);camera.updateMatrixWorld(true);c.fleet.updateView(camera);assert.equal(c.fleet.isPresented(0),false);}
  Object.assign(w.spawns[0],{x:at[0],z:at[2],yaw:-Math.atan(f.dx)});w.reset(0);v.vx=-Math.sin(v.yaw)*scenario.speed;v.vz=-Math.cos(v.yaw)*scenario.speed;v.speed=scenario.speed;if(scenario.height){v.y+=scenario.height;v.grounded=false;v.vy=2;}
  c.sync();c.present(1);race.riders[0].progress=race.course.project(e.p.pos).s;const scale=e.p.vehicleVisualRoot.getWorldScale(new e.THREE.Vector3()),cartStart=new e.THREE.Vector3(v.x,v.y,v.z);
  if(scenario.forced)c.wreck(0);else race.step(e.dt,normalizeGameInput({grindPressed:true}));const action=c.interactions[0];assert.ok(action?.bail,'Moving Triangle starts an independent leap');assert.equal(c.cartForRacer[0],-1,'The driver leaves the seat immediately');assert.equal(c.driverForCart[0],-1);assert.equal(c.interact(0),false,'Cannot steal another cart during the leap');
  const b=action.bail,frames=[],soleContacts=[];assert.ok(b.position.distanceTo(cartStart)<2,'A culled kart must release its driver from the current physics position');let previous='';
  for(let n=0;n<240&&c.isAnimating(0);n++){
   if(scenario.wreck&&n===5)c.wreck(0);
   race.step(e.dt,normalizeGameInput({}));c.present(1);e.l.update(e.dt);
   const unchanged=e.p.vehicleVisualRoot.getWorldScale(new e.THREE.Vector3()).distanceTo(scale)<1e-8;assert.ok(unchanged,'The actual racer stays the same size');
   for(const joint of e.p.animationRig.joints)assert.ok([...joint.node.position,...joint.node.quaternion,...joint.node.scale].every(Number.isFinite));
   if(c.isAnimating(0)){
    const p=b.position,inside=e.l.walls.some(w=>w.containsPoint(p.clone().add(new e.THREE.Vector3(0,.8,0))));assert.equal(inside,false,'The leap cannot enter a rock');
    if(b.phase==='roll'&&b.phaseAge===0){
     const head=e.p.animationRig.jointsById.get('head').node.getWorldPosition(new e.THREE.Vector3()).y;
     const feet=['Left','Right'].map(side=>e.p.animationRig.jointsById.get('ankle'+side).node.getWorldPosition(new e.THREE.Vector3()).y);
     assert.ok(head<Math.min(...feet),`The head leads the first ground contact: head ${head}, feet ${feet}`);
     assert.equal(action.actor.locomotion.clipId,'player.roll-land','The real board-abandon landing clip owns recovery');
    }
    if(b.phase==='roll'&&b.progress>=.65&&b.progress<=.71){
     const sole=e.p.animationRig.jointsById.get('ankleRight').node.getObjectByName('socket-foot-right');assert.ok(sole,'The trailing foot plants its actual sole socket');
     const at=sole.getWorldPosition(new e.THREE.Vector3()),target=action.actor.bailFoot;soleContacts.push({progress:b.progress,error:at.distanceTo(target),height:at.y-b.position.y});
    }
    if(b.phase!==previous){frames.push({phase:b.phase,time:b.age,position:p.toArray(),ground:c.ground(p.x,p.z).height,ankles:['Left','Right'].map(side=>e.p.animationRig.jointsById.get('ankle'+side).node.getWorldPosition(new e.THREE.Vector3()).y-p.y)});previous=b.phase;}
   }
  }
  assert.equal(c.isAnimating(0),false);assert.equal(e.p.vehicleVisualRoot.parent,e.p.group);assert.equal(b.contacts,1,'The head-first catch continues into one board-abandon roll');assert.ok(b.age<1.5,'Leap and bounce return control promptly');assert.ok(e.p.grounded);assert.equal(race.riders[0].falls,0);
  assert.ok(b.age-frames.find(r=>r.phase==='roll').time<.65,'The existing roll returns control promptly');
  assert.ok(cartStart.distanceTo(new e.THREE.Vector3(v.x,v.y,v.z))>2,'The moving kart continues away from the released driver');
  const here=e.p.pos.clone();c.present(.2);c.present(.8);assert.deepEqual(e.p.pos.toArray(),here.toArray(),'Rendering cannot move the simulation');
  assert.ok(soleContacts.length>0);assert.ok(soleContacts.every(c=>c.error<.12),'The source landing plants the actual sole within twelve centimetres');
  results.push({scenario:scenario.name,soleContacts,seconds:b.age,contacts:b.contacts,frames,cartTravel:cartStart.distanceTo(new e.THREE.Vector3(v.x,v.y,v.z)),separation:e.p.pos.distanceTo(new e.THREE.Vector3(v.x,v.y,v.z)),falls:race.riders[0].falls});
 }
 race.start('time-trial',0);race.phase='running';assert.ok(race.carts.interact(0));assert.equal(race.carts.interactions[0].bail,undefined,'A stationary cart keeps the existing exit animation');
 race.start('time-trial',0);race.phase='running';const c=race.carts,v=c.fleet.physics.carts[0];v.vz=-25;v.speed=25;c.interact(0);assert.ok(c.interactions[0].bail);race.start('time-trial',0);assert.equal(race.carts.interactions.length,0);assert.equal(e.p.vehicleVisualRoot.parent,race.carts.nativeDrivers[0].root,'Restart restores the borrowed racer');
 race.attach({skateRace:null},'flats');const report={passed:true,results,stationaryExitPreserved:true,restart:true};await writeFile(process.env.CART_BAIL_REPORT??'/private/tmp/cart-bail-motion.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
