import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5497',full=!!process.env.CART_FULL;
const out=process.env.CART_AUDIO_OUTPUT??'/private/tmp/cart-audio-isolation';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{
  const g=window.__game,sound=g.sfx;await sound.prepare();g.renderQualitySettings.setRegularResolution(null);
  const probe=window.cartAudioReview={phase:'kart',shots:[],loopLeaks:[],footCalls:0,footLeaks:0};
  const owned=()=>{const c=g.getSkateRace().carts;return !!c&&(c.isDriving(0)||c.isAnimating(0));};
  const play=sound.play.bind(sound);sound.play=(name,...args)=>{probe.shots.push({name,phase:probe.phase,owned:owned(),state:sound.ctx.state});return play(name,...args);};
  const loop=sound.setLoop.bind(sound);sound.setLoop=(id,name,active,...args)=>{if(active&&owned()&&['skate','grind','wallride'].includes(id))probe.loopLeaks.push({id,name,phase:probe.phase});return loop(id,name,active,...args);};
  const foot=g.player.updateFootstepAudio.bind(g.player);g.player.updateFootstepAudio=()=>{probe.footCalls++;if(owned())probe.footLeaks++;return foot();};
 });
 const buffers=await page.evaluate(()=>[...window.__game.sfx.buffers].filter(([key])=>key.startsWith('kart')).map(([key,b])=>({key,duration:b.duration,rate:b.sampleRate})));
 assert.equal(buffers.length,8);assert.ok(buffers.every(v=>v.duration>.4));
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>window.__game.getSkateRace().carts.drive=()=>({moveX:0,moveY:0}));
 await page.waitForFunction(()=>window.__game.sfx.loops.has('rally-engine-0'),null,{timeout:10000});
 const idle=await page.evaluate(()=>{const s=window.__game.sfx;return {loops:[...s.loops].map(([id,v])=>({id,name:v.name})),rate:s.loops.get('rally-engine-0').src.playbackRate.value,state:s.ctx.state};});
 assert.equal(idle.state,'running');assert.ok(idle.loops.some(v=>v.name==='kartEngine'));
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForTimeout(1000);
 const driving=await page.evaluate(()=>{const g=window.__game;return {speed:g.player.speed,hiddenSkateState:g.player.skateSoundRolling,loops:[...g.sfx.loops].map(([id,v])=>({id,name:v.name})),rate:g.sfx.loops.get('rally-engine-0').src.playbackRate.value};});
 assert.ok(driving.speed>5);assert.equal(driving.hiddenSkateState,true,'Fixture exercises the hidden rider state that caused the leak');
 assert.ok(driving.rate>idle.rate);assert.ok(!driving.loops.some(v=>['skate','grind','wallride'].includes(v.id)));
 await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');await page.keyboard.down('KeyT');await page.waitForFunction(()=>window.__game.sfx.loops.has('rally-skid'),null,{timeout:10000});await page.keyboard.up('KeyT');
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.__game.sfx.loops.has('rally-thruster'),null,{timeout:3000});
 await page.waitForFunction(()=>!window.__game.sfx.loops.has('rally-thruster'),null,{timeout:3000});
 console.log('PASS engine pitch, kart skid/flames, and no skateboard loops while driving');

 await page.keyboard.down('KeyQ');await page.waitForFunction(()=>Math.abs(window.__game.player.speed)<.1,null,{timeout:5000});await page.keyboard.up('KeyQ');
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>{const c=window.__game.getSkateRace().carts;return !c.isDriving(0)&&!c.isAnimating(0);},null,{timeout:6000});
 await page.evaluate(()=>window.cartAudioReview.phase='on-foot');
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.cartAudioReview.shots.filter(s=>s.phase==='on-foot'&&s.name.startsWith('footstep')).length>=2,null,{timeout:12000});await page.keyboard.up('ArrowUp');
 const foot=await page.evaluate(()=>({board:window.__game.player.boardRolling,shots:window.cartAudioReview.shots.filter(s=>s.phase==='on-foot'&&s.name.startsWith('footstep'))}));
 assert.equal(foot.board,false);assert.ok(foot.shots.every(s=>s.state==='running'));await page.screenshot({path:`${out}/on-foot.png`});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),c=r.carts;c.actionCooldown[0]=0;c.locked[0]=5;c.locked[1]=0;
  g.player.resetRacePosition(g.getLevel(),c.exitPoint(1,-1),g.player.raceHeading,true);window.cartAudioReview.phase='theft';
 });
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>{const c=window.__game.getSkateRace().carts;return c.cartForRacer[0]===1&&!c.isAnimating(0);},null,{timeout:8000});
 assert.equal(await page.evaluate(()=>window.cartAudioReview.shots.some(s=>s.phase==='theft'&&s.name==='kartCrash')),true,'The yank uses kart impact foley');
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForTimeout(1000);await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');
 const isolation=await page.evaluate(()=>{const p=window.cartAudioReview;return {loopLeaks:p.loopLeaks,footLeaks:p.footLeaks,skateShots:p.shots.filter(s=>['skateTransition','skateHalt','railLand','ollie'].includes(s.name)),steals:window.__game.getSkateRace().carts.stats.steals};});
 assert.deepEqual(isolation.loopLeaks,[]);assert.equal(isolation.footLeaks,0);assert.deepEqual(isolation.skateShots,[]);assert.equal(isolation.steals,1);
 await page.screenshot({path:`${out}/driving.png`});console.log('PASS on-foot footsteps, yank impact, and audio isolation after re-entry');

 await page.evaluate(()=>{
  const g=window.__game,c=g.getSkateRace().carts,w=c.fleet.physics,index=c.cartForRacer[0],a=w.carts[index];
  c.audio.impact({cart:index,other:null,x:a.x,y:a.y,z:a.z,strength:8,panel:0},g.player.pos);
 });
 assert.equal(await page.evaluate(()=>window.__game.sfx.managedShots.has('rally-impact-1')),true);
 await page.evaluate(()=>window.__game.getSkateRace().carts.hit(0,undefined,1));await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.__game.sfx.managedShots.has('rally-explosion')),true);assert.equal(await page.evaluate(()=>window.__game.sfx.loops.has('rally-fire')),true);
 await page.keyboard.press('Escape');await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>window.__game.sfx.loops.size),0,'Pause stops all audio loops');
 console.log('PASS crash, explosion, fire and pause silence');

 // The ownership guard must release when switching back to an actual skate race.
 await page.evaluate(()=>{const g=window.__game;window.cartAudioReview.phase='skate-race';g.gameFlow.hide();g.switchLevel('slipstream-race');});
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='slipstream-race'&&window.__game.getSkateRace().active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.sfx.loops.has('skate'),null,{timeout:10000});
 const skating=await page.evaluate(()=>({name:window.__game.sfx.loops.get('skate').name,state:window.__game.sfx.ctx.state,kartLoops:[...window.__game.sfx.loops.keys()].filter(k=>k.startsWith('rally-')),start:window.cartAudioReview.shots.some(s=>s.phase==='skate-race'&&s.name==='skateTransition')}));
 await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');assert.equal(skating.name,'skateLoop');assert.equal(skating.state,'running');assert.deepEqual(skating.kartLoops,[]);assert.equal(skating.start,true);
 const runtime=await page.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,glError:window.__game.renderer.getContext().getError()}));
 assert.match(runtime.stamp,/Codex\/sol fork/);assert.equal(runtime.glError,0);assert.deepEqual(errors,[]);
 await writeFile(process.env.CART_AUDIO_REPORT??`${out}/report.json`,JSON.stringify({full,buffers,idle,driving,foot,isolation,skating,runtime,thrusterStartStop:true,skidding:true,impact:true,explosion:true,fire:true,pauseSilence:true,errors},null,2));
 console.log('PASS actual skate race audio resumes, kart loops dispose, no console/WebGL errors',JSON.stringify(runtime));
}catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});console.log('ERRORS',JSON.stringify(errors));throw error;}finally{await browser.close();}
