import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';

const bundle=await build({stdin:{contents:`export * from './src/golf-cart/physics';export * from './src/golf-cart/fleet';export {dirtHeight,CART_RALLY_JUMPS} from './src/levels/cart-stadium-layout';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {GolfCartPhysics,GolfCartFleet,NO_CART_INPUT,dirtHeight,CART_RALLY_JUMPS}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const flat=()=>({height:0,grip:1,drag:0,safe:true,supported:true});
const options={scale:1.25,topSpeed:38,engine:23,speedLimit:44,maxLaunchVelocity:9,airRecoveryDelay:6,damageCapacity:8,gravity:24,stableLandings:true};
const spawn={x:0,z:0,yaw:0},dt=1/120,report={landings:[]};

// Sideways momentum and steering at touchdown used to turn ordinary jumps into rolls.
for(const height of [.6,2,6,12])for(const lateral of [-9,0,9])for(const steer of [-.8,0,.8]){
 const world=new GolfCartPhysics(flat,[spawn],[],options),c=world.carts[0];
 Object.assign(c,{y:height,vx:lateral,vz:-28,vy:-1,grounded:false,roll:.3,airTime:.4});
 let touch=-1,compression=0,rebound=0;
 for(let i=0;i<120*4;i++){
  world.advance(dt,w=>w.inputs[0]={...NO_CART_INPUT,steer,handbrake:steer!==0});
  if(c.grounded&&touch<0)touch=i;
  if(touch>=0){compression=Math.max(compression,c.landingCompression);rebound=Math.max(rebound,c.y);assert.ok(c.grounded,'Landing stays planted even while drifting');}
  if(touch>=0&&i-touch>=90)break;
 }
 assert.ok(touch>=0,'Cart reaches supported ground');assert.equal(c.rolls,0,'A sideways landing cannot start a rollover');
 assert.equal(c.airborneCount,0,'Landing damage and terrain contact do not relaunch the cart');assert.equal(rebound,0,'No physical rebound');
 assert.ok(compression>.025&&compression<=.14,'Hard touchdown compresses the suspended body');
 assert.ok(c.landingCompression<.001,'Compression settles without an oscillation');
 report.landings.push({height,lateral,steer,touchdown:touch*dt,compression,rebound,rolls:c.rolls});
}

// Ordinary terrain takeoff stays easy; the rally's shorter arc is independent of render rate.
const ramp=(x,z)=>({...flat(),height:z<0?2.4:z<8?(8-z)*.3:0});
const flight=hz=>{
 const w=new GolfCartPhysics(ramp,[{x:0,z:10,yaw:0}],[],options),c=w.carts[0];c.vz=-22;
 let apex=0,air=0,firstLanding=-1,postLandingLift=0;
 for(let i=0;i<hz*4;i++){
  w.advance(1/hz);
  if(!c.grounded){air+=1/hz;apex=Math.max(apex,c.y);if(firstLanding>=0)postLandingLift=Math.max(postLandingLift,c.y);}
  else if(c.airborneCount>0&&firstLanding<0)firstLanding=i/hz;
 }
 assert.ok(apex>2.5&&apex<4.5&&air>.35&&air<1.1,'A real ramp produces a short, readable arc');
 assert.equal(c.airborneCount,1,'One crest produces one flight');assert.equal(c.rolls,0);assert.equal(postLandingLift,0);
 return {apex,air,firstLanding,state:[c.x,c.y,c.z,c.vy,c.pitch,c.roll]};
};
report.flights=[30,60,144].map(hz=>({hz,...flight(hz)}));
for(const f of report.flights.slice(1))f.state.forEach((v,i)=>assert.ok(Math.abs(v-report.flights[0].state[i])<1e-8,'Identical fixed-step outcome at 30/60/144 Hz'));

// Landing on the uphill face of a dirt double must not launch another hop at
// its crest a fraction of a second later. Keep every full-height mound intact.
report.dirtDoubles=[];
for(const jump of CART_RALLY_JUMPS){
 const w=new GolfCartPhysics((x,z)=>({...flat(),height:dirtHeight(-z)}),[{x:0,z:-(jump.start-40),yaw:0}],[],options),c=w.carts[0];c.vz=-34;
 let touched=false,relifts=0;
 for(let i=0;i<120*8&&-c.z<jump.end+50;i++){
  w.advance(dt,world=>world.inputs[0]={...NO_CART_INPUT,throttle:1});
  if(c.airborneCount>0&&c.grounded)touched=true;
  if(touched&&!c.grounded)relifts++;
 }
 assert.ok(touched,'The complete full-height double is traversed');assert.equal(relifts,0,'The landing-mound crest cannot cause a second hop');
 assert.equal(c.airborneCount,1);assert.equal(c.rolls,0);report.dirtDoubles.push({start:jump.start,flights:c.airborneCount,relifts,rolls:c.rolls});
}

// Supporting terrain below a flying cart must not tip it toward a bank it has not touched.
const bank=new GolfCartPhysics((x,z)=>({...flat(),height:x*.4}),[spawn],[],options),bankCart=bank.carts[0];
Object.assign(bankCart,{y:12,vy:0,grounded:false});for(let i=0;i<60;i++)bank.advance(dt);
assert.ok(Math.abs(bankCart.roll)<.001,'Airborne body stays upright over a cross-slope');

// The same actual T-bone still flips the victim and recovers, while a gentle nudge does not.
report.contacts=[];
for(const speed of [5,16,24]){
 const w=new GolfCartPhysics(flat,[{x:-7,z:0,yaw:-Math.PI/2},spawn],[],options);w.carts[0].vx=speed;
 let angle=0;for(let i=0;i<120*7;i++){w.advance(dt);angle=Math.max(angle,Math.abs(w.carts[1].tumbleAngle));}
 const victim=w.carts[1];assert.ok(victim.hits>0,'Real chassis contact occurs');
 if(speed===5)assert.equal(victim.rolls,0,'A nudge stays upright');
 else{assert.equal(victim.rolls,1,'A hard kart collision still rolls the victim');assert.ok(angle>Math.PI);assert.equal(victim.recoveries,1);}
 assert.equal(victim.tumbling,false);report.contacts.push({speed,rolls:victim.rolls,recoveries:victim.recoveries,maxAngle:angle});
}

// Real wall contacts and a descending chassis overlapping another kart used to
// enter the same rollover path as a deliberate T-bone, even with stableLandings.
report.landingContacts=[];
for(const kind of ['wall','descending-pack','settling-pack']){
 const boundary=kind==='wall'?(x,y,z,radius)=>x+radius>3?{nx:-1,nz:0,depth:x+radius-3,x:3,z}:null:undefined;
 const w=new GolfCartPhysics(flat,kind==='wall'?[spawn]:[{x:-3,z:0,yaw:0},spawn],[],{...options,boundary});
 const c=w.carts[0];Object.assign(c,{vx:22,y:kind==='wall'?2:kind==='descending-pack'?.7:0,vy:-6,grounded:kind==='settling-pack',airTime:.4,landingTime:kind==='settling-pack'?.18:0});
 let maxVy=-Infinity;
 for(let i=0;i<180;i++){w.advance(dt);if(c.hits)maxVy=Math.max(maxVy,...w.carts.map(c=>c.vy));}
 assert.ok(w.carts.every(c=>c.hits>0),`${kind} actually contacts`);
 assert.ok(w.carts.every(c=>c.rolls===0),`${kind} does not roll either kart`);
 assert.ok(maxVy<=0,`${kind} cannot kick the kart back upward`);
 report.landingContacts.push({kind,maxVy,hits:w.carts.map(c=>c.hits),rolls:w.carts.map(c=>c.rolls)});
}

// Compression moves the cabin/driver together, leaving the tyres on the support plane.
const fleet=new GolfCartFleet({ground:flat,spawns:[spawn],physics:options});
const c=fleet.physics.carts[0];Object.assign(c,{y:.1,vy:-12,grounded:false,airTime:1});
fleet.physics.advance(2*dt);fleet.present(0);
assert.ok(fleet.models[0].body.position.y<-.10,'A hard landing visibly compresses the cabin');
assert.ok(fleet.models[0].wheels.every(w=>w.position.y===.41),'Tyres remain planted');
report.compression=fleet.models[0].body.position.y;
for(let i=0;i<30;i++)fleet.physics.advance(dt);fleet.present(0);
assert.ok(Math.abs(fleet.models[0].body.position.y)<.006,'Cabin returns within a quarter second');fleet.dispose();

await writeFile(process.env.CART_LANDING_REPORT??'/private/tmp/cart-landings.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS 36 sideways/steering landings, short ramp flight at 30/60/144 Hz, planted tyres, rapid suspension settle, and collision-driven rolls',JSON.stringify({flights:report.flights,contacts:report.contacts,compression:report.compression}));
