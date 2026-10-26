import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');
 const T=e.THREE,visuals=race.riders.map(r=>r.player.vehicleVisualRoot),scales=visuals.map(b=>b.scale.toArray()),contacts=[];
 let c=race.carts;c.present(1);
 for(const r of race.riders){
  const m=c.fleet.models[r.id],body=r.player.vehicleVisualRoot,driver=c.nativeDrivers[r.id];
  assert.equal(body,visuals[r.id]);assert.equal(body.parent,driver.root,'the actual racer is in the seat');
  assert.ok(body.getWorldScale(new T.Vector3()).distanceTo(new T.Vector3(...scales[r.id]))<1e-8,'mounting preserves full character size');
  const head=new T.Box3().setFromObject(body.getObjectByName('head')),roof=new T.Box3().setFromObject(m.root.getObjectByName('canopy'));
  assert.ok(head.max.y<roof.min.y-.08,'head clears the underside of the roof');
  assert.ok(Math.max(...driver.contacts.hands)<.035,'both hands reach the steering wheel');
  assert.ok(Math.max(...driver.contacts.feet)<.025,'both feet rest on the floor');
  for(const steer of [-1,0,1]){c.fleet.physics.carts[r.id].steer=steer;c.present(1);assert.ok(Math.max(...driver.contacts.hands)<.035,'wheel grips follow steering');}
  contacts.push({id:r.id,roofClearance:roof.min.y-head.max.y,hands:[...driver.contacts.hands],feet:[...driver.contacts.feet]});
 }
 c.exit(0,false);assert.equal(e.p.vehicleVisualRoot,visuals[0]);assert.equal(e.p.vehicleVisualRoot.parent,e.p.group);
 assert.deepEqual(e.p.vehicleVisualRoot.getWorldScale(new T.Vector3()).toArray(),scales[0]);assert.equal(e.p.vehicleVisualRoot.getObjectByName('skateboard-scale-compensation').visible,true);
 const oneRun=flame=>{race.start('time-trial',0);race.phase='running';c=race.carts;for(let i=0;i<40;i++)race.step(e.dt,normalizeGameInput({jumpHeld:true}));race.step(e.dt,normalizeGameInput({jumpHeld:true,spinPressed:flame}));return Object.fromEntries(['x','y','z','vx','vy','vz','yaw','speed','roll','pitch'].map(k=>[k,c.fleet.physics.carts[0][k]]));};
 const baseline=oneRun(false),firing=oneRun(true);assert.deepEqual(firing,baseline,'Square never adds speed, lift, steering or a chassis spin');
 c.present(1);assert.ok(c.effects.jets.count>=6,'all six side nozzles emit Gouraud flame tongues');
 const m=c.fleet.models[0],w=c.fleet.physics.carts[0];assert.ok(Math.abs(m.root.rotation.y-w.yaw)<1e-8,'rendered kart does not spin');
 race.start('race',0);race.phase='running';c=race.carts;c.drive=()=>({moveX:0,moveY:0});
 const a=c.fleet.physics.carts[0],b=c.fleet.physics.carts[1],d=c.fleet.physics.carts[2];
 Object.assign(a,{yaw:0,vx:0,vz:0});Object.assign(b,{x:a.x+4.2,y:a.y,z:a.z+10,vx:0,vz:0});Object.assign(d,{x:a.x,y:a.y,z:a.z-4.5,vx:0,vz:0});c.sync();
 let hits=[];c.attack=(id,origin,power)=>{hits.push(id);c.hit(id,origin,power);};
 c.step(e.dt,normalizeGameInput({spinPressed:true}));assert.equal(hits.includes(1),false);
 Object.assign(b,{x:a.x+4.2,y:a.y,z:a.z,vx:0,vz:0});c.sync();
 c.step(e.dt,normalizeGameInput({}));assert.ok(hits.includes(1),'entering active side flames takes damage');assert.equal(hits.includes(2),false,'racers in front are outside side jets');assert.ok(b.health<1);
 for(let i=0;i<60;i++)c.step(e.dt,normalizeGameInput({}));assert.equal(hits.filter(id=>id===1).length,1,'a burst hits each rival only once');c.present(1);assert.equal(c.effects.jets.count,0);
 race.attach({skateRace:null},'flats');assert.equal(e.p.vehicleVisualRoot,visuals[0]);assert.equal(e.p.vehicleVisualRoot.parent,e.p.group);assert.equal(e.p.group.visible,true);
 await writeFile(process.env.CART_DRIVER_REPORT??'/private/tmp/cart-drivers.json',JSON.stringify({passed:true,contacts,sameCharacter:true,sameScale:true,noFlameBoost:true,sideDamage:true,activeBurstContact:true,cleanup:true},null,2)+'\n');
 console.log('PASS full-size original drivers, roof/hand/foot clearance, exit restoration, zero flame propulsion and side-only damage');
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
