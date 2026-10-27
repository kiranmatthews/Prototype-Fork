import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5497',full=!!process.env.CART_FULL,out=process.env.CART_MIX_OUTPUT??'/private/tmp/cart-mix-browser';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const screenshot=name=>page.screenshot({path:`${out}/${name}.png`});
const rings=()=>page.evaluate(()=>{const c=window.__game.getSkateRace().carts;return c.fleet.models.slice(0,8).map(m=>({top:m.materials.nozzleOrange.color.getHexString(),ring:m.materials.nozzleRing.color.getHexString(),mount:m.materials.nozzleBrass.color.getHexString()}));});
const engine=()=>page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts,index=c.cartForRacer[0],a=g.sfx.loops.get(`rally-engine-${index}`);return {speed:c.fleet.physics.carts[index].speed,gain:a?.gain.gain.value,rate:a?.src.playbackRate.value,grounded:c.fleet.physics.carts[index].grounded};});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 // Use ordinary input unlock. Awaiting sfx.prepare() here would conceal startup failures.
 await page.mouse.click(1450,600);await page.waitForFunction(()=>window.__game.sfx.ctx.state==='running'&&window.__game.sfx.buffers.has('kartEngine'),null,{timeout:12000});
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 assert.equal(await page.evaluate(()=>[...window.__game.sfx.loops.keys()].some(k=>k.startsWith('rally-engine-'))),false,'Parked grid stays silent');
 // Keep the spectral/proximity fixture moving: stationary engines are intentionally off.
 await page.evaluate(()=>{const c=window.__game.getSkateRace().carts;for(const k of c.fleet.physics.carts.slice(0,8))Object.assign(k,{speed:3,vz:-3});c.updateAudio(2);});
 const grid=await page.evaluate(async()=>{
  const s=window.__game.sfx,voice=s.loops.get('rally-engine-0'),a=s.ctx.createAnalyser(),filter=s.ctx.createBiquadFilter(),speaker=s.ctx.createAnalyser(),master=s.ctx.createAnalyser();
  a.fftSize=speaker.fftSize=master.fftSize=8192;filter.type='highpass';filter.frequency.value=300;filter.Q.value=.707;
  voice.gain.connect(a);voice.gain.connect(filter);filter.connect(speaker);s.master.connect(master);
  await new Promise(r=>setTimeout(r,400));
  const read=node=>{const v=new Float32Array(node.fftSize);node.getFloatTimeDomainData(v);return {rms:Math.sqrt(v.reduce((n,x)=>n+x*x,0)/v.length),peak:Math.max(...v.map(Math.abs))};};
  const spectrum=new Float32Array(a.frequencyBinCount);a.getFloatFrequencyData(spectrum);
  const result={ctx:s.ctx.state,loops:[...s.loops.keys()],raw:read(a),speakerBand:read(speaker),master:read(master),peakHz:spectrum.indexOf(Math.max(...spectrum))*s.ctx.sampleRate/a.fftSize};
  voice.gain.disconnect(a);voice.gain.disconnect(filter);s.master.disconnect(master);filter.disconnect();a.disconnect();speaker.disconnect();master.disconnect();return result;
 });
 assert.equal(grid.loops.filter(id=>id.startsWith('rally-engine-')).length,8);assert.ok(grid.speakerBand.rms>.04,'moving engine is inaudible above the sub-bass band');assert.ok(grid.peakHz>300&&grid.peakHz<4000,'engine needs audible midrange');assert.ok(grid.speakerBand.rms>grid.raw.rms*.65,'engine is dominated by bass');assert.ok(grid.master.peak<.95,'grid engines clip the output');
 await page.evaluate(()=>{const c=window.__game.getSkateRace().carts;for(const k of c.fleet.physics.carts)Object.assign(k,{speed:0,vx:0,vy:0,vz:0});c.updateAudio(2);});
 const startingRings=await rings();assert.ok(startingRings.every(v=>v.top==='e87729'&&v.ring==='eaa03a'));
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='countdown'&&!window.__game.sfx.loops.has('rally-engine-0'));
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),c=r.carts,s=g.sfx;
  window.mixReview={drive:c.drive.bind(c),shots:[],flight:[],pilot:false};c.drive=()=>({moveX:0,moveY:0});
  const play=s.play.bind(s);s.play=(name,volume=1,rate=1,...rest)=>{const shot={name,volume,gain:s.emitterGain,channel:s.emitterChannel,effective:volume*s.emitterGain,played:false};const stop=play(name,volume,rate,...rest);shot.played=!!stop;window.mixReview.shots.push(shot);return stop;};
 });
 await page.waitForFunction(()=>window.__game.getSkateRace().carts.thrustCooldown.every(v=>v===0),null,{timeout:15000});
 const readyRings=await rings();assert.ok(readyRings.every(v=>v.top==='62f06b'&&v.ring==='eaa03a'));assert.ok(readyRings.every(v=>v.mount==='c39543'));
 const rendered=await page.evaluate(()=>{const c=window.__game.getSkateRace().carts;return c.fleet.batches.filter(b=>b.mesh.name.includes('cooling-fins')).map(b=>({name:b.mesh.name,count:b.mesh.count,colors:Array.from(b.mesh.instanceColor.array)}));});
 assert.equal(rendered.length,2);assert.ok(rendered.every(b=>b.count>0&&b.colors[1]>b.colors[0]*2),'ready color did not reach the rendered instances');
 await screenshot('ready-native');await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(150);await screenshot('ready-normal');
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 const detail=await page.evaluate(()=>{
  const g=window.__game,c=g.getSkateRace().carts,k=c.fleet.physics.carts[0],camera=g.camera.clone();camera.position.set(k.x+6,k.y+2.5,k.z+3.5);camera.lookAt(k.x,k.y+1.25,k.z);camera.updateMatrixWorld();c.updateView(camera);const visible=[...c.fleet.visible];c.fleet.visible.fill(false);c.fleet.visible[0]=true;c.fleet.models.forEach((m,i)=>m.root.visible=i===0);c.fleet.present(0);g.renderer.render(g.scene,camera);const data=g.renderer.domElement.toDataURL('image/png');c.fleet.visible=visible;c.updateView(g.camera);c.present();return data;
 });await writeFile(`${out}/ready-detail.png`,Buffer.from(detail.split(',')[1],'base64'));
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.__game.getSkateRace().carts.thrustTime[0]>0);
 const spentRings=await rings();assert.equal(spentRings[0].top,'e87729');assert.ok(spentRings.slice(1).every(v=>v.top==='62f06b'&&v.ring==='eaa03a'));await screenshot('spent');
 await page.waitForFunction(()=>window.__game.getSkateRace().carts.thrustCooldown[0]===0,null,{timeout:15000});assert.equal((await rings())[0].top,'62f06b');
 const idle=await engine();await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForTimeout(1100);const throttle=await engine();await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');
 assert.ok(throttle.speed>5);assert.equal(idle.gain,undefined);assert.ok(throttle.rate>1.1);assert.ok(throttle.gain>.38);
 await page.keyboard.down('KeyQ');await page.waitForFunction(()=>Math.abs(window.__game.player.speed)<.2,null,{timeout:5000});await page.keyboard.up('KeyQ');
 const proximity=await page.evaluate(()=>{
  const g=window.__game,c=g.getSkateRace().carts,w=c.fleet.physics,body=w.carts[1],saved={...body},result=[];let src;
  for(const distance of [4,20,45,85]){
   Object.assign(body,{x:g.player.pos.x+distance,y:g.player.pos.y,z:g.player.pos.z,speed:5,vx:0,vy:0,vz:-5,grounded:true});
   c.updateAudio(2);const voice=g.sfx.loops.get('rally-engine-1');src??=voice?.src;result.push({distance,gain:voice?.gain.gain.value??0,sameSource:voice?.src===src});
  }
  Object.assign(body,saved);c.updateAudio(2);return result;
 });assert.ok(proximity[0].gain>proximity[1].gain*1.5);assert.ok(proximity[1].gain>proximity[2].gain*3);assert.equal(proximity[3].gain,0);assert.ok(proximity.slice(0,3).every(v=>v.sameSource));
 const crateShots=[];
 for(const distance of [80,4,25]){
  await page.waitForTimeout(70);
  crateShots.push(await page.evaluate(distance=>{
   const g=window.__game,l=g.getLevel(),s=g.sfx,c=l.crates.find(c=>c.alive&&!c.metal&&!c.metalBounce&&!c.bang&&!c.nitroBang&&!c.pending),start=window.mixReview.shots.length;
   c.mesh.position.copy(g.player.pos);c.mesh.position.x+=distance;l.playerPos.copy(c.mesh.position);l.raceActorId=1;
   s.withGain(.001,()=>l.breakCrate(c,true),'race-rivals');l.playerPos.copy(g.player.pos);l.raceActorId=0;
   return {distance,shots:window.mixReview.shots.slice(start).filter(s=>s.name.startsWith('crateBreak'))};
  },distance));
 }
 const far=crateShots[0].shots[0],near=crateShots[1].shots[0],mid=crateShots[2].shots[0];assert.equal(far.effective,0);assert.equal(far.played,false);assert.ok(near.played&&near.effective>.35&&near.effective<=.4);assert.ok(mid.effective<near.effective*.4&&mid.played);assert.equal(near.channel,'race-crates');
 await page.waitForTimeout(70);
 const pack=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),start=window.mixReview.shots.length;for(const c of l.crates.filter(c=>c.alive&&!c.metal&&!c.metalBounce&&!c.bang&&!c.nitroBang&&!c.pending).slice(0,8)){c.mesh.position.copy(g.player.pos);c.mesh.position.x+=4;l.raceActorId=1;l.breakCrate(c,true);}l.raceActorId=0;return window.mixReview.shots.slice(start).filter(s=>s.name.startsWith('crateBreak'));});assert.ok(pack.filter(s=>s.played).length<=2,'pack stacked full-volume box hits');
 // A fresh solo run isolates an actual mound jump from the parked audio-test
 // field and the moved/reappearing crate fixtures above.
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',47531);
  const c=r.carts,drive=c.drive.bind(c),step=r.step.bind(r);window.mixReview.pilot=true;
  r.step=(dt,input)=>{const p=window.mixReview;step(dt,p.pilot&&r.phase==='running'?drive(0):input);if(p.pilot&&r.phase==='running'){const a=c.fleet.physics.carts[0],voice=g.sfx.loops.get('rally-engine-0');p.flight.push({grounded:a.grounded,vy:a.vy,speed:a.speed,rate:voice?.src.playbackRate.value});}};
 });
 await page.waitForFunction(()=>window.mixReview.flight.filter(v=>!v.grounded&&v.vy>1).length>12,null,{timeout:45000});
 await page.waitForFunction(()=>{const f=window.mixReview.flight;return f.at(-1).grounded&&f.some(v=>!v.grounded&&v.vy>1);},null,{timeout:12000});
 const flight=await page.evaluate(()=>{window.mixReview.pilot=false;return window.mixReview.flight;});
 const beforeAir=flight.findIndex(v=>!v.grounded&&v.vy>1),groundRate=Math.max(...flight.slice(Math.max(0,beforeAir-20),beforeAir).map(v=>v.rate)),airRate=Math.max(...flight.filter(v=>!v.grounded).map(v=>v.rate));
 assert.ok(airRate>groundRate+.25,'jump did not produce unloaded engine revs');
 const bus=await page.evaluate(()=>{const s=window.__game.sfx,old=s.sfxBus.gain.value;s.setVolumes({sfxVolume:0,musicVolume:1});const muted=s.sfxBus.gain.value;s.setVolumes({sfxVolume:old,musicVolume:1});return {muted};});assert.equal(bus.muted,0);
 await page.evaluate(()=>window.__game.getSkateRace().carts.hit(0,undefined,2));await page.waitForTimeout(200);
 const burnt=await rings();assert.equal(burnt[0].ring,'181a1c');assert.equal(burnt[0].top,'181a1c');assert.equal(await page.evaluate(()=>window.__game.sfx.loops.has('rally-engine-0')),false);
 const fireMix=await page.evaluate(async()=>{
  const g=window.__game,c=g.getSkateRace().carts,s=g.sfx,body=c.fleet.physics.carts[0],saved={...body},step=g.getSkateRace().step;g.getSkateRace().step=()=>{};
  const result=[];
  for(const distance of [3,25,85]){
   Object.assign(body,{x:g.player.pos.x+distance,y:g.player.pos.y,z:g.player.pos.z});c.effects.burnAges[0]=2;c.updateAudio(2);
   const voice=s.loops.get('rally-fire');let rms=0;
   if(voice){const a=s.ctx.createAnalyser();a.fftSize=8192;voice.gain.connect(a);await new Promise(r=>setTimeout(r,250));const v=new Float32Array(a.fftSize);a.getFloatTimeDomainData(v);rms=Math.sqrt(v.reduce((n,x)=>n+x*x,0)/v.length);voice.gain.disconnect(a);a.disconnect();}
   result.push({distance,gain:voice?.gain.gain.value??0,rms});
  }
  Object.assign(body,saved);c.updateAudio(2);g.getSkateRace().step=step;return result;
 });assert.ok(fireMix[0].rms>.12,'nearby burning kart should be clearly audible');assert.ok(fireMix[0].gain>fireMix[1].gain*1.8);assert.equal(fireMix[2].gain,0);
 await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__game.sfx.loops.size),0);
 const runtime=await page.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,glError:window.__game.renderer.getContext().getError()}));assert.match(runtime.stamp,/Codex\/sol fork/);assert.equal(runtime.glError,0);assert.deepEqual(errors,[]);
 const report={full,fireMix,grid,startingRings,readyRings,spentRings,burnt,idle,throttle,proximity,crateShots,packPlayed:pack.filter(s=>s.played).length,flight:{samples:flight.length,groundRate,airRate},bus,pauseSilence:true,runtime,errors};await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify({full,peakHz:grid.peakHz,speakerBandRms:grid.speakerBand.rms,gridPeak:grid.master.peak,idle,throttle,proximity,crateGains:crateShots.map(v=>[v.distance,v.shots[0].effective]),flight:report.flight,runtime}));
}catch(error){await screenshot('failure').catch(()=>{});console.log('ERRORS',errors);throw error;}finally{await context.close();await browser.close();}
