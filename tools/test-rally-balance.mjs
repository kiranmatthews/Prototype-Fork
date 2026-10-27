import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const fixture={v:1,name:'Rally balance',spawn:[0,.1,30],killY:-30,startWarpPad:false,components:[{t:'platform',p:[0,-.5,-400],s:[60,1,1200]},{t:'crate',kind:'mystery',p:[20,0,50]},...[-8,-2.7,2.7,8].map(x=>({t:'crate',kind:'mystery',p:[x,0,-330]})),{t:'gate',p:[0,0,-900]},{t:'camnode',p:[0,0,100]},{t:'camnode',p:[0,0,-910]}],skateRace:{v:1,racers:8,vehicle:'golf-cart',seed:3,line:[[0,0,100,60],[0,0,-900,60]],jumps:[],finishWidth:55,originalLength:1000}};
await withBlockworksRuntime(async e=>{
 const {RaceItemDeck}=await e.server.ssrLoadModule('/src/race/itemOdds.ts'),{GolfCartPhysics,NO_CART_INPUT}=await e.server.ssrLoadModule('/src/golf-cart/physics.ts'),{SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const {rallyChasePace}=await e.server.ssrLoadModule('/src/golf-cart/balance.ts');
 const assist=[-20,0,20,35,60,100,150,500].map(rallyChasePace);assert.ok(assist.every(x=>x>=0&&x<=.04));assert.equal(assist[3],0);assert.equal(assist[6],assist[7]);assert.ok(assist.every((x,i)=>i===0||x>=assist[i-1]));
 const heavy=['blue-shell','shock-shell','tidal-wave'],ultra=['star','tidal-wave'];
 const sample=(rank,gap,allowHeavy=true,allowUltra=true)=>{const deck=new RaceItemDeck(),counts={},recent=[];deck.reset(87557);for(let i=0;i<50000;i++){const item=deck.draw(rank,gap,allowHeavy,allowUltra,true);assert.ok(!recent.includes(item));counts[item]=(counts[item]??0)+1;recent.push(item);if(recent.length>2)recent.shift();}return counts;};
 const leader=sample(1,0),close=sample(8,15),chase=sample(8,140),second=sample(2,140);
 assert.ok(heavy.every(k=>!leader[k]&&!close[k]));assert.deepEqual(sample(2,15),close,'Last place in a close pack gets the same local tools as second');assert.deepEqual(sample(8,1000),chase,'Falling far back cannot grow rewards without a cap');
 assert.ok(chase.mushroom>close.mushroom*1.25&&second.mushroom>leader.mushroom*1.5);assert.ok(chase.mushroom<50000*.30,'A distant racer still has to drive and use ordinary items');
 assert.ok(chase['blue-shell']<50000*.10,'Leader attacks remain a minority of chasing items');assert.ok((chase['shock-shell']+chase['tidal-wave'])<50000*.035,'Field-wide attacks remain rare');assert.ok(ultra.every(k=>!sample(8,140,true,false)[k]),'The once-per-racer ultra gate applies to the rally');assert.ok(heavy.every(k=>!sample(8,140,false)[k]),'The shared heavy cooldown applies');
 assert.ok(leader.shield+leader.horn>50000*.2,'The leader keeps meaningful defensive tools');for(const counts of [leader,close,chase])assert.ok(counts.tnt&&counts.nitro);
 const speed=(health,maxDamageSpeedLoss)=>{const w=new GolfCartPhysics(()=>({height:0,grip:1,drag:.4,safe:true,supported:true}),[{x:0,z:0,yaw:0}],[],{topSpeed:38,engine:23,speedLimit:44,crestLaunch:false,maxDamageSpeedLoss});w.carts[0].health=health;w.inputs[0]={...NO_CART_INPUT,throttle:1};for(let i=0;i<1200;i++)w.advance(1/60);assert.equal(w.carts[0].health,health,'Pace tuning never repairs damage');return {speed:w.carts[0].speed,z:w.carts[0].z};};
 const healthyBefore=speed(1,.35),healthyAfter=speed(1,.18),damagedBefore=speed(.3,.35),damagedAfter=speed(.3,.18);assert.deepEqual(healthyAfter,healthyBefore,'Clean driving keeps exactly the same physical pace');assert.ok(damagedAfter.speed>damagedBefore.speed+2);assert.ok(damagedAfter.speed<healthyAfter.speed-2,'Damage still costs pace');assert.deepEqual(speed(.65,.18),speed(.65,.35),'Ordinary damage retains the previous pace penalty');assert.deepEqual(speed(.3),damagedBefore,'Other kart levels retain the previous damage penalty');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'balance-fixture');race.start('race',42);race.phase='running';const c=race.carts,v=c.fleet.physics.carts[1],r=race.riders[1];
 v.x=2.2;v.z=-300;v.yaw=0;v.speed=38;v.vx=0;v.vz=-38;v.grounded=true;v.steer=0;r.progress=400;c.sync();assert.equal(c.drive(1).grabHeld,true);assert.ok(c.drive(1).moveX>0,'AI selects the available box nearest its existing lane');r.boost=2;assert.equal(c.drive(1).grabHeld,false,'AI does not brake away its straight-line boost');v.yaw=Math.PI/2;assert.equal(c.drive(1).grabHeld,true,'Boost still brakes for a sharp corner');r.boost=0;
 r.item='mushroom';r.itemCooldown=0;assert.equal(race.drive(1).itemPressed,false,'AI holds a boost while pointed across the track');v.yaw=0;assert.equal(race.drive(1).itemPressed,true,'AI spends the boost on a supported straight');r.itemCooldown=0;v.grounded=false;assert.equal(race.drive(1).itemPressed,false,'AI saves power while airborne');v.grounded=true;c.cartForRacer[1]=-1;assert.equal(race.drive(1).itemPressed,false,'AI saves driving power while on foot');c.cartForRacer[1]=1;
 r.item=null;race.crateBroken(e.l.crates[1],1);assert.equal(race.returns.get(e.l.crates[1]),1.2,'Shared item rows return quickly enough for the chasing pack');
 race.riders[0].item='mushroom';assert.equal(race.useItem(0),true,'Human item use stays immediate');assert.equal(race.riders[0].boost,4);
 race.riders[1].item='blue-shell';assert.equal(race.useItem(1),true);assert.equal(race.heavyAt,18,'An armed heavy attack reserves eighteen seconds before another draw');race.riders[1].item='tidal-wave';assert.equal(race.useItem(1),true);assert.equal(race.heavyAt,24);
 race.riders[0].progress=500;race.riders[1].progress=100;race.step(e.dt,{});assert.equal(c.paceAssist[0],0);assert.equal(c.paceAssist[1],.04);
 race.riders[0].progress=100;race.riders[1].progress=500;race.step(e.dt,{});assert.equal(c.paceAssist[0],.04,'The same capped help applies to the human racer');assert.equal(c.paceAssist[1],0);
 r.knockGrace=0;r.shield=0;r.star=0;v.health=1;assert.equal(race.hit(r,undefined,.1),true);const afterHit=v.health;assert.equal(r.knockGrace,2.2);assert.equal(race.hit(r,undefined,.1),false);assert.equal(v.health,afterHit,'Consecutive weapon hits cannot immediately pile on extra damage');r.knockGrace=0;assert.equal(race.hit(r,undefined,.1),true,'Weapon vulnerability returns after the recovery window');
 race.start('time-trial',42);assert.equal(race.count,1);race.phase='running';e.l.raceActorId=0;e.l.breakCrate(e.l.crates[0]);assert.equal(race.riders[0].item,'mushroom');race.step(e.dt,{});assert.equal(race.carts.paceAssist[0],0);
 // A blocked driver must reverse using physical controls rather than remain at the rock forever.
 race.start('time-trial',42);race.phase='running';const solo=race.carts,world=solo.fleet.physics;Object.assign(world.spawns[0],{x:0,z:-300,yaw:0});world.reset(0);world.obstacles.push({x:0,z:-303,radius:2,height:4,id:'balance-ram-trap'});solo.sync();race.riders[0].progress=race.course.project(e.p.pos).s;const start=race.riders[0].progress;let reversed=false;for(let i=0;i<900&&race.riders[0].progress<start+30;i++){race.step(e.dt,race.drive(0));reversed ||=world.carts[0].speed<-.5;}assert.ok(reversed,'A trapped driver uses reverse');assert.ok(race.riders[0].progress>start+30,'The driver escapes and resumes racing');
 // Compare physical pursuit on the same straight using identical controls,
 // without items, contact, AI skill differences or a finish crossing.
 const pursuit=(gap,humanChases=false,boost=0)=>{
  race.start('race',42);race.phase='running';const carts=race.carts,w=carts.fleet.physics,leaderId=humanChases?1:0,chaserId=1-leaderId;
  for(const rider of race.riders)if(rider.id>1)rider.finish=1;
  for(const [id,progress,x]of [[leaderId,450,-18],[chaserId,450-gap,18]]){
   Object.assign(w.spawns[id],{x,z:100-progress,yaw:0});w.reset(id);Object.assign(w.carts[id],{speed:20,vz:-20});race.riders[id].progress=progress;race.riders[id].boost=boost;
  }
  carts.sync();const input={moveX:0,moveY:1,jumpHeld:true};carts.drive=()=>({...input});
  for(let frame=0;frame<(boost?60:480);frame++)race.step(e.dt,{...input});
  return {leaderSpeed:w.carts[leaderId].speed,chaserSpeed:w.carts[chaserId].speed,gap:race.riders[leaderId].progress-race.riders[chaserId].progress};
 };
 const closePursuit=pursuit(15),distantPursuit=pursuit(150),humanPursuit=pursuit(150,true);
 assert.equal(distantPursuit.leaderSpeed,closePursuit.leaderSpeed,'A chaser never slows the leader');
 assert.ok(distantPursuit.chaserSpeed>closePursuit.chaserSpeed+.5&&distantPursuit.chaserSpeed<closePursuit.chaserSpeed*1.045,'Physical pursuit gains remain small');
 assert.ok(distantPursuit.gap<145&&distantPursuit.gap>130,'A distant chaser recovers ground without erasing the lead');
 assert.deepEqual(humanPursuit,distantPursuit,'Human and AI drivers receive identical physical help');
 const boostedClose=pursuit(15,false,2),boostedFar=pursuit(150,false,2);assert.equal(boostedFar.chaserSpeed,boostedClose.chaserSpeed,'Chase assistance does not stack on a boost');
 race.attach({skateRace:null},'flats');
 const report={passed:true,assist,drawsPerCase:50000,leader,close,chase,second,healthyBefore,healthyAfter,damagedBefore,damagedAfter,closePursuit,distantPursuit,humanPursuit,boostedClose,boostedFar,hitRecovery:true,aiBoost:true,humanItemsImmediate:true,trialBoosts:true,heavyCooldown:true};await writeFile(process.env.RALLY_BALANCE_CHECK??'/private/tmp/rally-balance-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:()=>fixture,levelId:'balance-fixture'});
