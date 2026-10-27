import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const layout=await e.server.ssrLoadModule('/src/levels/cart-stadium-layout.ts');
 const {RALLY_ROCK_STATIONS}=await e.server.ssrLoadModule('/src/levels/rally-rock-obstacles.ts');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');
 const spawn=(s,u,back=false)=>{const p=layout.rallySurfacePoint(s,u),f=layout.cartRallyFrame(s);return {x:p[0],z:p[2],yaw:-Math.atan(f.dx)+(back?Math.PI:0)};};
 const tick=()=>{race.step(1/60,{});e.l.update(1/60);};
 const blockedDoor=(c,index)=>{const at=c.exitPoint(index,-1);at.y+=.8;return e.l.walls.some(w=>w.containsPoint(at));};
 const cases=[];
 for(const [i,s]of RALLY_ROCK_STATIONS.entries()){
  race.start('race',0);race.phase='running';const c=race.carts,w=c.fleet.physics,id=5,blocked=8,clear=9,side=i%2?1:-1;
  for(const rider of race.riders)if(rider.id!==id)rider.finish=1;
  for(let j=0;j<w.carts.length;j++)if(![id,blocked,clear].includes(j))c.locked[j]=60;
  for(const [index,at,u,back]of [[id,s,-side*10,false],[blocked,s,-side*2.4,side>0],[clear,s+22,-side*8,false]]){
   Object.assign(w.spawns[index],spawn(at,u,back));w.reset(index);c.homes[index]={...w.spawns[index]};
  }
  c.sync();const rider=race.riders[id];rider.progress=race.course.project(rider.player.pos).s;c.wreck(id);
  for(let n=0;n<60;n++)tick();
  assert.ok(blockedDoor(c,blocked),'The actual settled cart has its driver doorway inside a rock');
  assert.equal(c.nearest(id,350),clear,'AI targets the usable spare beyond the blocked doorway');
  let seconds=0;
  for(let n=0;n<900;n++){tick();seconds=(n+1)/60;if(c.cartForRacer[id]>=0&&!c.isAnimating(id))break;}
  assert.equal(c.cartForRacer[id],clear,`Racer recovers beside rock ${i+1}`);assert.equal(c.isAnimating(id),false);assert.equal(rider.falls,0);
  cases.push({rock:i+1,seconds,cart:c.cartForRacer[id],falls:rider.falls});
 }
 // The human target ring must reject the same obstruction and become usable
 // again as soon as the kart is moved clear, without restarting the race.
 race.start('time-trial',0);race.phase='running';const c=race.carts,w=c.fleet.physics,spare=1,s=RALLY_ROCK_STATIONS[0];
 for(let j=2;j<w.carts.length;j++)c.locked[j]=60;
 Object.assign(w.spawns[0],spawn(s,10));w.reset(0);Object.assign(w.spawns[spare],spawn(s,2.4));w.reset(spare);c.sync();c.wreck(0);
 for(let n=0;n<60;n++)tick();
 const player=race.riders[0].player;player.resetRacePosition(e.l,c.exitPoint(spare,1),new e.THREE.Vector3(0,0,-1),true);c.actionCooldown[0]=0;
 assert.ok(blockedDoor(c,spare));assert.equal(c.nearest(0),-1);assert.equal(c.interact(0),false,'Triangle cannot start an entry through rock');
 Object.assign(w.spawns[spare],spawn(s,6.4));w.reset(spare);
 player.resetRacePosition(e.l,c.exitPoint(spare,-1),new e.THREE.Vector3(0,0,-1),true);c.actionCooldown[0]=0;
 assert.equal(blockedDoor(c,spare),false);assert.equal(c.nearest(0),spare);assert.equal(c.interact(0),true);
 for(let n=0;n<180;n++)tick();
 assert.equal(c.cartForRacer[0],spare);assert.equal(c.isAnimating(0),false);
 const report={passed:true,cases,human:{blockedTargetRejected:true,blockedEntryRejected:true,reopensWhenMoved:true,animatedEntryCompletes:true}};
 await writeFile(process.env.CART_ENTRY_CLEARANCE_REPORT??'/private/tmp/cart-entry-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));race.attach({skateRace:null},'flats');
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
