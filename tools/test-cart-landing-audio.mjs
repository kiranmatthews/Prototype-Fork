import assert from 'node:assert/strict';import {createServer} from 'vite';import {writeFile} from 'node:fs/promises';import * as THREE from 'three';
// Only the mixer is under test; real Web Audio decoding is covered in Chrome.
globalThis.window={addEventListener(){}};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {GolfCartPhysics}=await server.ssrLoadModule('/src/golf-cart/physics.ts'),{CartRaceAudio}=await server.ssrLoadModule('/src/golf-cart/raceAudio.ts'),{sfx}=await server.ssrLoadModule('/src/audio.ts');
 const flat=()=>({height:0,grip:1,drag:0,safe:true,supported:true}),drops=[];
 for(const state of [{y:.35,vy:-4,cooldown:0},{y:5,vy:-10,cooldown:1}]){
  const w=new GolfCartPhysics(flat,[{x:0,z:0,yaw:0}],[],{gravity:24,stableLandings:true,damageCapacity:11.2}),c=w.carts[0],events=[];Object.assign(c,{...state,grounded:false,airTime:.2});
  for(let i=0;i<160;i++){w.advance(1/120);events.push(...w.landings);}
  assert.equal(events.length,1,'Exactly one sound event per actual landing');assert.equal(c.health,1,'Sound is independent of damage or damage cooldown');assert.equal(c.rolls,0);assert.equal(c.grounded,true);assert.equal(c.vy,0);drops.push(events[0]);
 }
 const audio=new CartRaceAudio(),shots=[],original=sfx.playManaged;sfx.playManaged=(key,name,gain,rate)=>{shots.push({key,name,gain,rate});return()=>{};};
 try{
  const at=new THREE.Vector3();audio.landing(drops[1],at,0);audio.landing(drops[0],at,0);
  audio.landing({...drops[1],cart:1,x:25},at,0);audio.landing({...drops[1],cart:2,x:90},at,0);
  assert.equal(shots.length,3);assert.ok(shots[0].gain>shots[1].gain*1.5);assert.ok(shots[2].gain<shots[0].gain*.3);assert.ok(shots.every(s=>s.name==='kartLanding'));
  const n=shots.length;audio.impact({...drops[1],other:null,panel:2,landing:true},at);assert.equal(shots.length,n,'Damaging touchdown cannot double-play the generic crash');
  audio.impact({...drops[1],other:1,panel:0},at);assert.equal(shots.at(-1).name,'kartCrash','Actual collisions still crash');
 }finally{audio.dispose();sfx.playManaged=original;}
 // Exercise the actual SFX debounce, not just mixer call arguments. A stolen
 // kart can have a higher index than a rival, so either callback order matters.
 const sources=[],originalCtx=sfx.ctx,originalBus=sfx.sfxBus;
 sfx.ctx={state:'running',currentTime:2,createBufferSource(){const node={playbackRate:{value:1},connect(g){this.output=g;},disconnect(){this.disconnected=true;},start(){sources.push(this);},stop(){this.stopped=true;}};return node;},createGain(){return {gain:{value:0},connect(){},disconnect(){this.disconnected=true;}};}};
 sfx.sfxBus={};sfx.buffers.set('kartLanding',{});
 try{
  for(const order of [[0,7,1],[7,0,1]]){
   const start=sources.length;
   for(const cart of order)audio.landing({...drops[1],cart},new THREE.Vector3(),7);
   assert.equal(sources.length-start,2,'A simultaneous pack landing preserves the driver and one bounded rival cue');
   const gains=sources.slice(start).map(s=>s.output.gain.value);assert.ok(Math.max(...gains)>Math.min(...gains)*1.9,'The driver remains more prominent than the rival');
   audio.dispose();assert.equal(sfx.managedShots.size,0);assert.ok(sources.slice(start).every(s=>s.stopped&&s.disconnected&&s.output.disconnected),'Pause/restart can cancel every landing voice');sfx.ctx.currentTime+=.1;
  }
 }finally{sfx.ctx=originalCtx;sfx.sfxBus=originalBus;}
 const report={passed:true,drops,shots,independentOfDamage:true,exactlyOnePerLanding:true,unchangedPlantedLanding:true,simultaneousRivalAndPlayer:true,packVoiceLimit:true,landingTeardown:true};await writeFile(process.env.CART_LANDING_AUDIO_REPORT??'/private/tmp/cart-landing-audio.json',JSON.stringify(report,null,2));console.log('PASS cart landing audio',JSON.stringify(report));
}finally{await server.close();}
