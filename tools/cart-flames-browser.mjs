import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5497',full=!!process.env.CART_FULL;
const seconds=Number(process.env.CART_FLAME_RACE_SECONDS||180),out=process.env.CART_FLAME_OUTPUT??'/private/tmp/cart-flames-browser';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(seed=>{
  window.__game.renderQualitySettings.setRegularResolution(null);
  if(seed!==null){const r=window.__game.getSkateRace(),start=r.start.bind(r);r.start=mode=>start(mode,seed);}
 },process.env.CART_FLAME_SEED?Number(process.env.CART_FLAME_SEED):null);
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 // The button queues input for the next simulation tick. Observe the reset
 // before hooking this race's fleet, especially when lite renders quickly.
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='countdown');
 const starting=await page.evaluate(()=>{
  const r=window.__game.getSkateRace(),c=r.carts;
  window.flameReviewObservedCart=c;window.flameReview={seed:r.runSeed,starting:[...c.thrustCooldown],shots:[],hits:[],samples:[]};
  const fire=c.audio.thrust.bind(c.audio);c.audio.thrust=(body,index,listener)=>{
   window.flameReview.shots.push({id:c.driverForCart[index],time:r.elapsed});return fire(body,index,listener);
  };
  const attack=c.attack;c.attack=(id,origin,power)=>{
   const index=c.cartForRacer[id],body=c.fleet.physics.carts[index],health=body?.health;
   const from=r.riders.find(r=>r.player.pos===origin)?.id;attack(id,origin,power);
   window.flameReview.hits.push({from,id,time:r.elapsed,damage:body&&health!==undefined?health-body.health:null});
  };
  return window.flameReview.starting;
 });
 assert.equal(new Set(starting).size,8);assert.ok(starting.every(v=>v>.8&&v<6));
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.stats.thrusters),0);
 await page.keyboard.press('KeyF');await page.waitForTimeout(70);
 assert.equal(await page.evaluate(()=>window.flameReview.shots.filter(s=>s.id===0).length),0,'starting charge allowed a human burst immediately');
 assert.match(await page.evaluate(()=>window.__game.getSkateRace().carts.hud().notice),/FLAMES RECHARGING/);await shot('recharging');
 await page.evaluate(()=>{
  const r=window.__game.getSkateRace(),step=r.step.bind(r);r.step=(dt,input)=>step(dt,r.phase==='running'?r.drive(0):input);
 });
 await page.waitForFunction(()=>window.__game.getSkateRace().carts.thrustTime.some((v,i)=>i>0&&v>0),null,{timeout:30000});await shot('rival-flames-native');
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));
 await page.waitForFunction(()=>window.__game.getSkateRace().carts.thrustTime.some((v,i)=>i>0&&v>0),null,{timeout:30000});await shot('rival-flames-normal');
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 let finished=false;
 for(let i=0;i<seconds;i++){
  await page.waitForTimeout(1000);
  const state=await page.evaluate(()=>{const r=window.__game.getSkateRace(),s={time:r.elapsed,finished:r.riders.filter(r=>r.finish!==null).length,shots:window.flameReview.shots.length,damageHits:window.flameReview.hits.filter(h=>h.damage>0).length};window.flameReview.samples.push(s);return s;});
  if(i%20===0)console.log(JSON.stringify(state));
  if(state.finished===8){finished=true;break;}
  if(state.time>=seconds)break;
 }
 const report=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {...window.flameReview,observedCurrentFleet:window.flameReviewObservedCart===r.carts,stamp:document.querySelector('.hud-build')?.textContent,glError:g.renderer.getContext().getError(),stats:r.carts.stats,riders:r.riders.map(r=>({id:r.id,finish:r.finish,falls:r.falls}))};});
 assert.equal(report.observedCurrentFleet,true,'Measurement must observe the active race fleet');
 assert.equal(report.shots.length,report.stats.thrusters,'Every burst must reach the observer');
 const rivals=new Set(report.shots.filter(s=>s.id>0).map(s=>s.id));
 assert.ok(rivals.size>=4,'too few rivals found firing opportunities');
 assert.ok(report.hits.some(h=>h.from>0&&h.damage>0),'rival flames did not damage any actual cart');
 for(let id=0;id<8;id++){
  const shots=report.shots.filter(s=>s.id===id);if(shots.length)assert.ok(shots[0].time>=starting[id]-.02,'first shot bypassed starting charge');
  assert.ok(shots.slice(1).every((s,i)=>s.time-shots[i].time>=5.99),'a racer bypassed the six-second recharge');
 }
 assert.ok(report.shots.every(s=>s.time>.8),'starting grid spammed flames');
 if(seconds>=180)assert.equal(finished,true,'the full field must finish with flame combat');
 assert.match(report.stamp,/Codex\/sol fork/);assert.equal(report.glError,0);assert.deepEqual(errors,[]);
 await shot('race');await writeFile(`${out}/report.json`,JSON.stringify({full,...report,errors},null,2)+'\n');
 console.log('PASS',JSON.stringify({full,stamp:report.stamp,rivalShooters:[...rivals].sort(),bursts:report.shots.length,damageHits:report.hits.filter(h=>h.damage>0).length,finished,glError:report.glError}));
}catch(error){await shot('failure');console.log('ERRORS',errors);throw error;}finally{await context.close();await browser.close();}
