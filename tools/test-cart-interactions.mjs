import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');
 const T=e.THREE,scales=race.riders.map(r=>r.player.vehicleVisualRoot.scale.clone());let c;
 const start=()=>{race.start('race',0);race.phase='running';c=race.carts;c.drive=()=>({moveX:0,moveY:0});c.present(1);};
 const tick=(seconds,input={})=>{for(let t=0;t<seconds-1e-8;t+=e.dt){race.step(e.dt,normalizeGameInput(input));c.present(1);}};
 const footNear=(id,cart)=>{const v=c.fleet.physics.carts[cart],at=c.exitPoint(cart,-1);race.riders[id].player.resetRacePosition(e.l,at,new T.Vector3(-Math.sin(v.yaw),0,-Math.cos(v.yaw)),true);c.actionCooldown[id]=0;};
 start();const old=c.cartForRacer[0],other=c.cartForRacer[1],a=c.fleet.physics.carts[old],b=c.fleet.physics.carts[other];
 Object.assign(b,{x:a.x+3.8,y:a.y,z:a.z,vx:0,vz:0,yaw:a.yaw});c.sync();c.present(1);
 assert.equal(c.hud().target,'BAIL OUT');assert.equal(c.nearest(0),-1,'seated racers never target another kart');
 assert.equal(c.interact(0),true);assert.equal(c.cartForRacer[0],old);assert.equal(c.cartForRacer[1],other);assert.equal(c.stats.steals,0);assert.equal(c.isAnimating(0),true);
 const body=e.p.vehicleVisualRoot,before=body.getWorldPosition(new T.Vector3());tick(.45);
 assert.ok(body.getWorldPosition(new T.Vector3()).distanceTo(before)>.2,'the real body visibly moves through the doorway');
 const action=c.interactions[0],paused=action.age,position=e.p.pos.clone();c.present(.3);c.present(.7);assert.equal(action.age,paused);assert.deepEqual(e.p.pos.toArray(),position.toArray(),'render poses do not move simulation');
 assert.equal(c.interact(0),false,'second press cannot interrupt exit or claim another cart');tick(.55);
 assert.equal(c.cartForRacer[0],-1);assert.equal(c.cartForRacer[1],other);assert.equal(c.stats.steals,0);assert.equal(body.parent,e.p.group);
 assert.ok(e.p.grounded);assert.equal(c.stats.exits,1);
 // A new on-foot press visibly pulls the current owner out before seating the thief.
 footNear(0,other);b.health=.57;c.locked[other]=0;race.riders[0].item='mushroom';race.riders[1].item='shield';
 assert.equal(c.interact(0),true);assert.equal(c.cartForRacer[0],-1);assert.equal(c.cartForRacer[1],other);
 c.exit(2,false);footNear(2,other);assert.equal(c.interact(2),false,'one reservation prevents simultaneous theft');
 tick(.30);const pulling=c.interactions.find(x=>x.id===0);assert.ok(pulling.passenger);assert.equal(c.driverForCart[other],1);
 const pullContacts={hands:[...pulling.actor.contacts.hands],feet:[...pulling.actor.contacts.feet]};
 assert.ok(Math.max(...pullContacts.hands)<.06,'both hands actually grip the rival');assert.ok(Math.max(...pullContacts.feet)<.01,'pulling keeps both feet planted');
 tick(.62);assert.equal(c.cartForRacer[1],-1,'victim releases after the pull');assert.equal(c.cartForRacer[0],-1,'thief still has to climb in');assert.equal(c.driverForCart[other],-1);assert.ok(race.riders[1].player.skateCameraBailing);
 tick(1.0);assert.equal(c.cartForRacer[0],other);assert.equal(c.driverForCart[other],0);assert.equal(c.stats.steals,1);assert.equal(c.isAnimating(0),false);assert.ok(b.health<=.57&&b.health>.4);
 assert.equal(race.riders[0].item,'mushroom');assert.equal(race.riders[1].item,'shield');assert.equal(body.parent,c.nativeDrivers[0].root);
 assert.ok(body.getWorldScale(new T.Vector3()).distanceTo(scales[0])<1e-8,'entering never shrinks the actual racer');
 // Empty entry has its own animation, and restart safely returns every borrowed rig.
 start();c.exit(0,false);const spare=c.count;footNear(0,spare);assert.equal(c.interact(0),true);assert.equal(c.cartForRacer[0],-1);tick(.40);assert.ok(c.isAnimating(0));
 race.start('race',0);race.phase='running';c=race.carts;c.drive=()=>({moveX:0,moveY:0});c.present(1);assert.equal(c.interactions.length,0);assert.equal(e.p.vehicleVisualRoot.parent,c.nativeDrivers[0].root);
 c.exit(0,false);footNear(0,c.count);assert.equal(c.interact(0),true);tick(1.1);assert.equal(c.cartForRacer[0],c.count);
 // The passenger side routes around the rear before grabbing; no reach through the bench.
 start();c.exit(0,false);const q=race.course.sample(70),target=c.fleet.physics.carts[1];Object.assign(target,{x:q.x,y:c.ground(q.x,q.z).height,z:q.z,yaw:0,vx:0,vz:0});c.sync();c.present(1);
 e.p.resetRacePosition(e.l,c.exitPoint(1,1),new T.Vector3(0,0,-1),true);c.actionCooldown[0]=0;assert.equal(c.interact(0),true);
 const approach=c.interactions[0];assert.equal(approach.cart,1);assert.ok(approach.approach>1);assert.equal(approach.side,-1);
 for(let t=0;t<approach.approach-.05;t+=.1){tick(.1);const pos=e.p.pos;assert.ok(Math.abs(pos.x-target.x)>1.6||Math.abs(pos.z-target.z)>2,'approach stays outside the chassis');}
 tick(2.2);assert.equal(c.cartForRacer[0],1);assert.equal(c.driverForCart[1],0);
 // Destruction during a yank cancels both borrowed actors and leaves no owner in the wreck.
 start();c.exit(0,false);c.locked[0]=5;footNear(0,1);c.locked[1]=0;assert.equal(c.interact(0),true);tick(.25);c.fleet.physics.carts[1].health=0;tick(.05);
 assert.equal(c.isAnimating(0),false);assert.equal(c.isAnimating(1),false);assert.equal(c.cartForRacer[0],-1);assert.equal(c.cartForRacer[1],-1);assert.equal(c.driverForCart[1],-1);assert.equal(e.p.vehicleVisualRoot.parent,e.p.group);
 race.attach({skateRace:null},'flats');assert.equal(e.p.vehicleVisualRoot.parent,e.p.group);assert.equal(e.p.group.visible,true);
 const report={passed:true,onFootOnly:true,timedOwnership:true,reservation:true,fullSize:true,restart:true,wreckCancellation:true,pullContacts};
 await writeFile(process.env.CART_INTERACTION_REPORT??'/private/tmp/cart-interactions.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
