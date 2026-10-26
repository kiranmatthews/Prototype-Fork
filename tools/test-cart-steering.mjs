import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';

const bundle=await build({stdin:{contents:"export * from './src/golf-cart/controls';export * from './src/golf-cart/physics';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {RallyControls,GolfCartPhysics}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const dt=1/120,flat=()=>({height:0,grip:1,drag:.08,safe:true,supported:true});
const options={scale:1.25,topSpeed:38,engine:23,speedLimit:44,stableLandings:true};
const angle=(x,z)=>Math.atan2(-x,-z),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const report={coasting:[],accelerating:[],reverse:[]};
function run({basis=0,yaw=basis,speed=0,input,seconds=5,hz=120}){
 const world=new GolfCartPhysics(flat,[{x:0,z:0,yaw}],[],options),cart=world.carts[0],controls=new RallyControls();
 const forward={x:-Math.sin(basis),z:-Math.cos(basis)};
 Object.assign(cart,{vx:-Math.sin(yaw)*speed,vz:-Math.cos(yaw)*speed,speed});
 let tailSteer=0,tailSamples=0,firstStopped=-1;
 for(let i=0;i<seconds*hz;i++)world.advance(1/hz,w=>{
  w.inputs[0]=controls.sample(dt,input,{yaw:cart.yaw,speed:cart.speed,forward});
  if(w.time>seconds-1){tailSteer+=Math.abs(w.inputs[0].steer);tailSamples++;}
  if(Math.abs(cart.speed)<.1&&firstStopped<0)firstStopped=w.time;
 });
 const tx=forward.x*(input.moveY||0)-forward.z*(input.moveX||0),tz=forward.z*(input.moveY||0)+forward.x*(input.moveX||0);
 return {world,cart,controls,forward,error:Math.abs(wrap(angle(cart.vx,cart.vz)-angle(tx,tz))),tailSteer:tailSteer/tailSamples,firstStopped};
}

// Screen-relative steering must converge on the held direction, including a
// collision leaving the car facing the camera but rolling away in reverse.
for(const basis of [0,.7,-1.8,Math.PI])for(const offset of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const input of [{moveX:1},{moveX:-1},{moveY:1},{moveX:.7,moveY:.7}]){
 const r=run({basis,yaw:basis+offset,speed:-8,input});
 assert.ok(r.error<.04,'Reverse coasting converges to the held screen direction');
 assert.ok(r.tailSteer<.09,'Aligned reverse travel settles without alternating full-lock steering');
 assert.ok(r.cart.speed<-2,'Direction alone neither accelerates nor forces a stop');
 assert.equal(r.cart.airborneCount,0);assert.equal(r.cart.respawns,0);
 report.coasting.push({basis,offset,input,error:r.error,tailSteer:r.tailSteer});
}

// A spun car still turns back around under X, whether stopped, rolling forward
// into the camera, or reversing after a hit. Cross does not become a jump.
for(const speed of [-8,0,8])for(const offset of [Math.PI,-Math.PI+.05,Math.PI-.05]){
 const r=run({yaw:offset,speed,input:{moveY:1,jumpHeld:true}});
 assert.ok(r.error<.04,'X plus up recovers a backwards-facing cart');
 assert.ok(r.cart.speed>25);assert.equal(r.cart.airborneCount,0);
 report.accelerating.push({speed,offset,error:r.error,finalSpeed:r.cart.speed});
}

// Keep the existing pull-back brake -> reverse pedal and Circle priority.
for(const moveX of [-.4,0,.4]){
 const r=run({speed:12,input:{moveX,moveY:-1,jumpHeld:true}});
 assert.ok(r.firstStopped>=0&&r.firstStopped<1.5,'Pull back brakes before reversing');
 assert.ok(r.cart.speed<-5&&r.error<.04,'Reverse follows the stick at a controlled speed');
 const release=r.controls.sample(dt,{moveX,moveY:-1,jumpReleased:true},{yaw:r.cart.yaw,speed:r.cart.speed,forward:r.forward});
 assert.equal(release.throttle,0);assert.equal(release.brake,0,'Holding the current reverse direction can coast after X release');assert.equal(release.hop,false);
 for(let i=0;i<120;i++)r.world.advance(dt,w=>w.inputs[0]=r.controls.sample(dt,{grabHeld:true,jumpHeld:true},{yaw:r.cart.yaw,speed:r.cart.speed,forward:r.forward}));
 assert.ok(Math.abs(r.cart.speed)<.01,'Circle stops reverse motion even with X held');
 report.reverse.push({moveX,firstStopped:r.firstStopped,error:r.error});
}
const cancelled=new RallyControls().sample(dt,{jumpHeld:true,jumpCancelled:true});assert.equal(cancelled.throttle,0);assert.equal(cancelled.hop,false);

// Render cadence cannot change the feedback or the physical recovery path.
const states=[30,60,144].map(hz=>{const r=run({yaw:Math.PI,speed:-8,input:{moveX:1},hz,seconds:6});return [r.cart.x,r.cart.z,r.cart.yaw,r.cart.speed];});
for(const state of states.slice(1))state.forEach((n,i)=>assert.ok(Math.abs(n-states[0][i])<1e-8));
report.fixedStep=true;
await writeFile(process.env.CART_STEERING_REPORT??'/private/tmp/cart-steering.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS backward coasting, spin recovery, reverse/brake controls and 30/60/144 Hz steering',JSON.stringify({coasting:report.coasting.length,accelerating:report.accelerating.length,reverse:report.reverse.length,maxError:Math.max(...report.coasting.map(r=>r.error))}));
