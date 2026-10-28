import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
globalThis.window={addEventListener(){}};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {GolfCartPhysics,NO_CART_INPUT}=await server.ssrLoadModule('/src/golf-cart/physics.ts');
 const {CartRaceAudio}=await server.ssrLoadModule('/src/golf-cart/raceAudio.ts');
 const {sfx}=await server.ssrLoadModule('/src/audio.ts');
 const sources=[];
 sfx.ctx={state:'running',currentTime:2,createBufferSource(){return {playbackRate:{value:1},connect(){},disconnect(){this.disconnected=true;},start(){sources.push(this);},stop(){this.stopped=true;}};},createGain(){return {gain:{value:0},connect(){},disconnect(){this.disconnected=true;}};}};
 sfx.sfxBus={};
 for(const name of ['kartEngine','kartFire','kartThrusterLoop','kartSkid'])sfx.buffers.set(name,{length:44100,sampleRate:44100});
 const world=new GolfCartPhysics(()=>({height:0,grip:1,drag:0,safe:true,supported:true}),[{x:0,z:0,yaw:0},{x:4,z:0,yaw:0}],[]);
 const audio=new CartRaceAudio(),listener=new Vector3(),owners=[0,1],burning=[false,false],age=[0,0],thrust=[0,0];
 const update=()=>audio.update(.5,world,owners,0,burning,age,thrust,listener);
 const voice=id=>sfx.loops.get(`rally-engine-${id}`);
 const move=(id,vx=0,vy=0,vz=0)=>Object.assign(world.carts[id],{vx,vy,vz,speed:-vz,grounded:vy===0});
 update();assert.equal(sfx.loops.size,0,'Parked carts are silent outside the countdown');
 // Countdown revs are explicit and never alter the driving physics.
 const poses=JSON.stringify(world.carts);
 audio.update(.5,world,owners,0,burning,age,thrust,listener,[.2,.4]);
 assert.ok(voice(0)&&voice(1),'Both stationary drivers rev during countdown');const idleRate=voice(0).src.playbackRate.value;
 audio.update(.5,world,owners,0,burning,age,thrust,listener,[1,.2]);
 assert.ok(voice(0).src.playbackRate.value>idleRate+.35,'Holding X produces an audible rev');
 assert.equal(JSON.stringify(world.carts),poses,'Revving stores no velocity');
 owners[1]=-1;audio.update(.5,world,owners,0,burning,age,thrust,listener,[1,1]);assert.equal(voice(1),undefined,'Unoccupied loaners never rev');owners[1]=1;
 update();assert.equal(sfx.loops.size,0,'Leaving countdown restores parked silence');
 world.inputs[0]={...NO_CART_INPUT,throttle:1};update();assert.equal(voice(0),undefined,'Throttle against an immovable stop does not keep an engine running');
 move(0,0,0,-12);move(1,0,0,-8);update();assert.ok(voice(0)&&voice(1),'Both moving human and rival carts are audible');
 const first=voice(0),groundRate=first.src.playbackRate.value;
 move(0,0,5,-12);update();assert.equal(voice(0),first,'Motion keeps the same loop source');assert.ok(first.src.playbackRate.value>groundRate+.2,'Airborne revs retain their raised pitch');
 move(0,0,4,0);update();assert.equal(voice(0),first,'Vertical flight is movement even at zero forward speed');
 move(0,3,0,0);update();assert.equal(voice(0),first,'A sideways slide is still movement');
 move(0);world.carts[0].speed=12;update();assert.equal(voice(0),undefined,'Actual velocity stops the engine even if a cached speed has not caught up');
 assert.ok(first.src.stopped&&first.src.disconnected&&first.gain.disconnected,'Stopped engines release their audio nodes');
 for(let frame=0;frame<100;frame++){move(0,frame%2?.1:-.1,.015,0);update();}
 assert.equal(voice(0),undefined,'Small settled suspension jitter stays silent');
 move(0,0,0,-4);update();assert.ok(voice(0)&&voice(0).src!==first.src,'Driving away restarts the engine');
 const near=voice(1).gain.gain.value;world.carts[1].x=35;update();const distant=voice(1).gain.gain.value;assert.ok(distant<near*.4,'Moving rivals retain proximity attenuation');
 world.carts[1].x=90;update();assert.equal(voice(1),undefined);world.carts[1].x=4;move(1);update();assert.equal(voice(1),undefined,'Returning a parked rival to earshot remains silent');
 move(0);burning[0]=true;update();assert.equal(voice(0),undefined);assert.ok(sfx.loops.has('rally-fire'),'A stopped burning kart still crackles');
 burning[0]=false;thrust[0]=1;update();assert.ok(sfx.loops.has('rally-thruster'),'A stationary flamethrower remains audible');thrust[0]=0;
 move(0,0,0,-5);owners[0]=-1;update();assert.equal(voice(0),undefined,'An abandoned rolling kart has no engine');owners[0]=0;
 audio.dispose();assert.equal(sfx.loops.size,0);
 // Use the production braking equations until both finished carts settle.
 move(0,0,0,-20);move(1,0,0,-16);world.inputs=world.inputs.map(()=>({...NO_CART_INPUT,brake:1}));update();
 for(let i=0;i<600;i++){world.advance(1/60);audio.update(1/60,world,owners,0,burning,age,thrust,listener);}
 assert.ok(world.carts.every(c=>Math.hypot(c.vx,c.vy,c.vz)<.12));assert.equal(sfx.loops.size,0,'Braked finish-line carts stay silent');
 audio.dispose();
 const report={passed:true,parked:true,countdownRevs:true,blockedThrottle:true,movingHumanAndRivals:true,airborne:true,sideways:true,jitter:true,restart:true,proximity:true,fireAndThrustersRetained:true,abandoned:true,finishBraking:true,audioNodesReleased:true};
 const out=process.env.CART_STATIONARY_REPORT??'docs/cart-stationary-audio/check.json';await mkdir(new URL('../docs/cart-stationary-audio/',import.meta.url),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log('PASS stationary kart audio',JSON.stringify(report));
}finally{await server.close();}
