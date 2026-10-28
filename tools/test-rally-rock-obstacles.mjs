import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),{GolfCartPhysics}=await r.server.ssrLoadModule('/src/golf-cart/physics.ts');
 const layout=await r.server.ssrLoadModule('/src/levels/cart-stadium-layout.ts'),{RALLY_ROCK_STATIONS}=await r.server.ssrLoadModule('/src/levels/rally-rock-obstacles.ts');
 const rocks=r.sourceModule.COCONUT_CART_RALLY_LEVEL.components.filter(c=>c.nm?.startsWith('Rally Meshy rock'));
 assert.equal(rocks.length,14);assert.ok(rocks.every(c=>c.dkind==='coastv2buttress'&&c.w>=1.5&&!c.s));
 for(const s of RALLY_ROCK_STATIONS)for(const j of layout.CART_RALLY_JUMPS)assert.ok(s+11<j.start-(j.runUp??32)||s-11>j.end-(j.landingLead??8)+(j.landingRise??20)+(j.landingPlateau??0)+(j.landingTail??32),'Rock footprints leave complete takeoff and landing mounds clear');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'coconut-cart-rally');race.start('time-trial',1);race.phase='running';const rally=race.carts,w=rally.fleet.physics;
 assert.ok(w.obstacles.length>=126);const traversals=[],impacts=[];
 const parked=w.spawns.slice(1).map(p=>({x:p.x,z:p.z,clear:rally.bayOutsideWalls(p.x,rally.ground(p.x,p.z).height,p.z)}));assert.ok(parked.every(p=>p.clear),'All initial spare carts park clear of the rocks');
 for(const rock of rocks)assert.equal(rally.clearBay(rock.p[0],rock.p[2],-1),false,'Replacement delivery cannot put a kart inside a rock');
 const spawn=(s,u=0)=>{const p=layout.rallySurfacePoint(s,u),f=layout.cartRallyFrame(s);return {x:p[0],z:p[2],yaw:-Math.atan(f.dx)};};
 for(const [i,s]of RALLY_ROCK_STATIONS.entries()){
  Object.assign(w.spawns[0],spawn(s-45));w.reset(0);const c=w.carts[0];c.vx=-Math.sin(c.yaw)*25;c.vz=-Math.cos(c.yaw)*25;c.speed=25;rally.sync();race.riders[0].progress=race.course.project(r.p.pos).s;
  let maxOffset=0;
  for(let n=0;n<1200&&-c.z<s+24;n++){race.step(1/60,rally.drive(0));r.l.update(1/60);maxOffset=Math.max(maxOffset,Math.abs(race.course.project(r.p.pos).offset));}
  assert.ok(-c.z>s+24,`AI passes obstacle ${i+1}`);assert.equal(c.hits,0,`An unimpeded driver can avoid rock ${i+1} at ${s}; final ${c.x},${c.z}; offset ${maxOffset}`);assert.equal(c.respawns,0);assert.equal(c.rolls,0);assert.ok(maxOffset>1.7,'Passing requires a clear steering deviation');
  traversals.push({s,passed:true,maxOffset,hits:c.hits,rolls:c.rolls});
  const side=i%2?1:-1,solo=new GolfCartPhysics((x,z)=>rally.ground(x,z),[spawn(s-24,side*7.4)],w.obstacles,{scale:1.25,topSpeed:38,engine:23,gravity:24,stableLandings:true,damageCapacity:11.2});
  const v=solo.carts[0];v.vx=-Math.sin(v.yaw)*25;v.vz=-Math.cos(v.yaw)*25;v.speed=25;
  for(let n=0;n<480&&!v.hits;n++)solo.advance(1/120,world=>world.inputs[0]={throttle:1,steer:0,brake:0,handbrake:false});
  assert.ok(v.hits>0&&v.health<1,`Rock ${i+1} produces actual impact damage`);assert.ok(Math.hypot(v.vx,v.vz)<20,'Impact substantially slows the cart');assert.equal(v.rolls,0,'Rock impact does not introduce automatic jump rollovers');impacts.push({s,speed:Math.hypot(v.vx,v.vz),health:v.health,hit:solo.impacts[0]});
 }
 const s=RALLY_ROCK_STATIONS[0],ram=new GolfCartPhysics((x,z)=>rally.ground(x,z),[spawn(s-23,-7.4),spawn(s-17,-7.4)],w.obstacles,{scale:1.25,topSpeed:38,engine:23,gravity:24,stableLandings:true,damageCapacity:11.2});
 for(const [i,c]of ram.carts.entries()){const speed=i===0?27:2;c.vx=-Math.sin(c.yaw)*speed;c.vz=-Math.cos(c.yaw)*speed;c.speed=speed;}
 let rivalContact=false,rockContact=false;
 for(let n=0;n<420;n++){ram.advance(1/120,world=>{world.inputs[0]={throttle:1,steer:0,brake:0,handbrake:false};});rivalContact||=ram.impacts.some(hit=>hit.other!==null);rockContact||=ram.impacts.some(hit=>hit.cart===1&&hit.other===null);}
 assert.ok(rivalContact&&rockContact,'A pursuing racer can shunt an opponent into the rock');assert.ok(ram.carts[1].health<1);
 // Reproduce the full-race failure: a wrecked rival reaches the front
 // right corner of rock seven while its nearest loaner is beyond the rock.
 race.start('race',0);race.phase='running';const rescue=race.carts,id=5;
 for(const rider of race.riders)if(rider.id!==id)rider.finish=1;
 Object.assign(rescue.fleet.physics.spawns[id],spawn(1847,-7.4));rescue.fleet.physics.reset(id);rescue.sync();const rider=race.riders[id];rider.progress=race.course.project(rider.player.pos).s;rescue.wreck(id);
 const recoveryStart=rider.progress;let recoverySeconds=0;
 for(let n=0;n<1800&&rider.progress<recoveryStart+90;n++){race.step(1/60,{});r.l.update(1/60);recoverySeconds=(n+1)/60;}
 assert.ok(rider.progress>recoveryStart+90&&rescue.cartForRacer[id]>=0,'A wrecked rival runs around the rock, takes a loaner and resumes racing');
 const recovery={seconds:recoverySeconds,cart:rescue.cartForRacer[id],progress:rider.progress-recoveryStart};
 const report={passed:true,rocks:rocks.length,collisionBodies:w.obstacles.length,parked,traversals,impacts,recovery,ram:{rivalContact,rockContact,targetHealth:ram.carts[1].health},jumpsPreserved:12};
 await writeFile(process.env.RALLY_ROCK_REPORT??'/private/tmp/rally-rock-mechanics.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));race.attach({skateRace:null},'flats');
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
