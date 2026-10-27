import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';

const fixture={v:1,name:'Kart and skate pace',spawn:[0,.1,30],killY:-30,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-4900],s:[80,1,10400]},
 {t:'rail',p:[20,.8,-30],len:40,yaw:0},
 {t:'gate',p:[0,0,-9900]},
 {t:'camnode',p:[0,0,100]},{t:'camnode',p:[0,0,-10000]},
],skateRace:{v:1,racers:8,vehicle:'golf-cart',seed:3,line:[[0,0,100,80],[0,0,-9900,80]],jumps:[],finishWidth:70,originalLength:10000}};
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const {GolfCartPhysics,NO_CART_INPUT}=await e.server.ssrLoadModule('/src/golf-cart/physics.ts');
 const {TUNING}=await e.server.ssrLoadModule('/src/tuning.ts');
 const runtimeErrors=[],originalError=console.error;console.error=(...args)=>{runtimeErrors.push(String(args[0]));if(runtimeErrors.length<=3)originalError(...args);};
 const tuningBefore=JSON.stringify(TUNING),p=e.p,v=(...xyz)=>new e.THREE.Vector3(...xyz),forward=v(0,0,-1);
 const race=new SkateRace(e.scene,p,false,()=>true);race.attach(e.l,'kart-skating-fixture');
 let previous={},c;
 const reset=()=>{race.start('time-trial',42);race.phase='running';c=race.carts;previous={};};
 const tick=(count,sample={})=>{for(let i=0;i<count;i++){const input=normalizeGameInput(typeof sample==='function'?sample(i):sample,previous);previous=input;race.step(e.dt,input);}};
 const report={passed:false,dt:e.dt};
 reset();tick(1,{grindHeld:true});assert.ok(c.isAnimating(0),'Triangle starts a real exit');
 tick(90);assert.equal(c.isDriving(0),false);assert.equal(c.isAnimating(0),false);assert.equal(p.boardRolling,false,'Standing exit remains on foot until skate input');
 tick(180,{moveY:1,jumpHeld:true});assert.ok(p.boardRolling,'Normal hold-X movement mounts the board after exiting');assert.ok(p.speed>15);assert.equal(c.cartForRacer[0],-1);
 const beforeJump=p.pos.y;tick(1,{moveY:1});tick(10,{moveY:1});assert.equal(p.grounded,false,'X release still ollies on a skateboard');assert.ok(p.pos.y>beforeJump+.1);report.onFootOllie={speed:p.speed,height:p.pos.y-beforeJump};
 tick(180,{moveY:1,jumpHeld:true});assert.ok(p.grounded&&p.boardRolling,'The skateboard lands and keeps rolling');

 // Compare the same native player motor, from the same on-foot state, with
 // and without the race wrapper. Disable only skeletal presentation during
 // the long empty-track measurement; the real-browser pass covers that.
 const hooks=p.raceHooks,finishVisualStep=p.finishVisualStep;p.finishVisualStep=()=>{};
 try{
  const measure=racing=>{
   p.raceHooks=hooks;p.resetRacePosition(e.l,v(0,0,-100),forward,true);p.raceHooks=racing?hooks:null;
   previous={};race.riders[0].boost=0;race.riders[0].progress=200;const milestones=[];
   for(let frame=0;frame<90/e.dt;frame++){
    const input=normalizeGameInput({moveY:1,jumpHeld:true},previous);previous=input;
    if(racing)race.step(e.dt,input);else p.step(e.dt,input,e.l);
    if((frame+1)%Math.round(10/e.dt)===0)milestones.push({seconds:(frame+1)*e.dt,speed:p.speed,z:p.pos.z,skating:p.boardRolling});
   }
   assert.ok(p.grounded&&p.boardRolling&&!p.isBailing);return milestones;
  };
  report.nativeSkating=measure(false);report.rallySkating=measure(true);
  assert.deepEqual(report.rallySkating,report.nativeSkating,'Every measured speed and position matches unchanged native skating');
  assert.ok(p.speed>32&&p.speed<33,'Native earned overdrive remains available');
  race.riders[0].item='mushroom';assert.ok(race.useItem(0));tick(90,{moveY:1,jumpHeld:true});
  report.boostedSkating=p.speed;assert.ok(p.speed>report.rallySkating.at(-1).speed+.3,'Race items still boost the skateboard');
 }finally{p.raceHooks=hooks;p.finishVisualStep=finishVisualStep;}

 // Use the production rally motor on the same road surface, at each damage
 // condition. Neither pace nor the ability to skate repairs a damaged kart.
 const kartSpeed=health=>{
  const {topSpeed,engine,speedLimit,scale,maxDamageSpeedLoss,stableLandings}=c.fleet.physics;
  const w=new GolfCartPhysics(()=>({height:0,grip:1,drag:.08,safe:true,supported:true}),[{x:0,z:0,yaw:0}],[],{topSpeed,engine,speedLimit,scale,maxDamageSpeedLoss,stableLandings});
  const k=w.carts[0];k.health=health;
  for(let i=0;i<30/e.dt;i++)w.advance(e.dt,world=>{world.inputs[0]={...NO_CART_INPUT,throttle:1};});
  assert.equal(k.health,health);return k.speed;
 };
 report.kartSpeeds={healthy:kartSpeed(1),damaged:kartSpeed(.3)};
 assert.ok(report.kartSpeeds.healthy>report.rallySkating.at(-1).speed*1.25,'A healthy kart clearly outruns fully charged skating');
 assert.ok(report.kartSpeeds.damaged>33,'Even a heavily damaged but running kart beats sustained flat-ground skating');
 assert.ok(report.kartSpeeds.healthy>report.boostedSkating,'The healthy kart remains faster than the measured skateboard item boost');

 // Triangle must still catch an actual rail when no nearby kart can be entered.
 race.riders[0].boost=0;p.resetRacePosition(e.l,v(20,1.05,-30),forward,false);
 Object.assign(p,{state:'air',grounded:false,vVel:-1,speed:12,grindVel:12,regrindCd:0});previous={};
 assert.equal(c.nearest(0),-1);tick(1,{grindHeld:true});
 assert.equal(p.state,'grind','The native Triangle grind reaches the player unchanged');report.triangleGrind=true;

 // A skater next to a parked rival uses the existing yank/entry animation;
 // Triangle cannot both grind and take the kart, and the board is hidden.
 race.start('race',42);race.phase='running';c=race.carts;c.drive=()=>normalizeGameInput({});previous={};
 c.exit(0,false);c.locked[0]=5;const target=c.fleet.physics.carts[1];
 p.resetRacePosition(e.l,c.exitPoint(1,-1),forward,false);p.speed=2;c.actionCooldown[0]=0;
 tick(1,{grindHeld:true});assert.ok(c.isAnimating(0));assert.equal(c.cartForRacer[0],-1);
 const board=p.vehicleVisualRoot.getObjectByName('skateboard-scale-compensation');assert.ok(board);assert.equal(board.visible,false,'The skateboard is stowed during entry');
 tick(140);assert.equal(c.cartForRacer[0],1);assert.equal(c.cartForRacer[1],-1);assert.equal(c.driverForCart[1],0);assert.equal(c.stats.steals,1);assert.equal(c.isAnimating(0),false);
 const beforeFlights=target.airborneCount;tick(45,{moveY:1,jumpHeld:true});tick(1,{moveY:1});tick(8,{moveY:1});
 assert.equal(target.airborneCount,beforeFlights,'X release never jumps the kart');
 tick(90,{grabHeld:true});tick(1,{grindHeld:true});tick(90);assert.equal(c.isDriving(0),false);tick(180,{moveY:1,jumpHeld:true});assert.ok(p.boardRolling,'Skating works again after stealing, driving and exiting');
 report.skateStealDriveExit=true;assert.equal(JSON.stringify(TUNING),tuningBefore,'Skate tuning never changes');
 race.attach({skateRace:null},'flats');console.error=originalError;assert.deepEqual(runtimeErrors,[],'Native runtime emitted no errors');report.runtimeErrors=runtimeErrors;report.passed=true;
 const out=process.env.CART_SKATING_REPORT??'/private/tmp/cart-skating.json';await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:()=>fixture,levelId:'kart-skating-fixture'});
