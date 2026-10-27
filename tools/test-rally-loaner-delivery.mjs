import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');race.start('time-trial',42);
 const c=race.carts,w=c.fleet.physics,count=w.carts.length-1,dropRoot=c.drops.root;
 let previous={};const tick=(n,sample={})=>{for(let i=0;i<n;i++){const input=normalizeGameInput(sample,previous);race.step(1/60,input);previous=input;}};
 assert.equal(c.stats.loanerDrops,count);assert.equal(c.drops.activeCount,count);assert.ok(w.carts.slice(1).every(k=>!k.grounded&&k.health===1));
 const height=w.carts[1].y;tick(60);assert.equal(w.carts[1].y,height,'Countdown preserves the initial supply drop');
 race.phase='running';tick(300);assert.equal(c.stats.loanerLandings,count);assert.equal(c.drops.activeCount,0);assert.ok(w.carts.slice(1).every(k=>k.grounded&&k.health===1&&k.rolls===0));
 // Strand the actual on-foot player with all parked spares temporarily unavailable.
 c.exit(0,false);c.wreck(0);const start=race.course.support(e.l,900);assert.ok(start);e.p.resetRacePosition(e.l,start,race.course.tangent(900),true);race.riders[0].progress=900;race.riders[0].anchorProgress=900;race.riders[0].anchor.copy(start);c.actionCooldown[0]=0;
 for(let index=1;index<w.carts.length;index++)c.locked[index]=120;
 for(let frame=0;frame<360&&c.stats.loanerDrops===count;frame++)tick(1);
 assert.equal(c.stats.loanerDrops,count+1,'The club dispatches one new loaner');
 const delivery=w.carts.findIndex((_,i)=>c.drops.isDescending(i));assert.ok(delivery>0);const kart=w.carts[delivery];
 assert.ok(kart.y-c.ground(kart.x,kart.z).height>15);assert.match(c.hud().target,/INCOMING/);assert.equal(c.hud().actionReady,false);assert.equal(c.canTake(0,delivery),false);assert.equal(c.interact(0),false,'An airborne loaner cannot be taken');assert.match(c.hud().notice,/TOUCHDOWN/);
 let landingSeconds=0;for(let frame=0;frame<240&&c.drops.isDescending(delivery);frame++){tick(1);landingSeconds=(frame+1)/60;}
 assert.ok(kart.grounded&&kart.health===1);assert.equal(c.stats.loanerDrops,count+1,'Waiting for one parachute does not dispatch a pile of duplicates');assert.equal(c.stats.loanerLandings,count+1);
 e.p.resetRacePosition(e.l,c.exitPoint(delivery,-1),race.course.tangent(race.riders[0].progress),true);c.actionCooldown[0]=0;
 tick(1,{grindHeld:true});assert.equal(c.isAnimating(0),true);tick(180);assert.equal(c.cartForRacer[0],delivery);assert.equal(c.isAnimating(0),false);assert.equal(race.riders[0].falls,0);
 // Returning a displaced, abandoned spare uses the same drop lifecycle.
 const recycled=delivery===2?3:2,home=c.homes[recycled];Object.assign(w.carts[recycled],{x:home.x+70,z:home.z+70});c.spareTime[recycled]=19;
 tick(1);assert.ok(c.drops.isDescending(recycled),'Replenished bays parachute their next cart in');assert.equal(c.stats.loanerDrops,count+2);
 const beforeRestart=c.drops;race.start('race',42);assert.equal(beforeRestart.activeCount,0);assert.equal(dropRoot.parent,null);assert.equal(race.carts.drops.activeCount,race.carts.fleet.physics.carts.length-race.count);
 const next=race.carts.drops;race.attach({skateRace:null},'flats');assert.equal(next.activeCount,0);assert.equal(next.root.parent,null);
 const report={passed:true,openingLoaners:count,realInitialLandings:true,replacementDelivery:delivery,landingSeconds,airborneEntryBlocked:true,noDuplicateDispatch:true,animatedEntryAfterLanding:true,falls:0,recycledBayDrop:true,restartCleanup:true};
 await writeFile(process.env.RALLY_DELIVERY_REPORT??'/private/tmp/rally-loaner-delivery.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
