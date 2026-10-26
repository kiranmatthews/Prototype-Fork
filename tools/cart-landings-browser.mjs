import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5497';
const out=process.env.CART_LANDING_BROWSER_OUTPUT??'/private/tmp/cart-landing-native';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',0);g.renderQualitySettings.setRegularResolution(null);
  // Clear the landing lane of parked loaners so this fixture measures ground impact.
  // Hard kart-to-kart contact is covered separately by test-cart-landings.mjs.
  const rally=r.carts,world=rally.fleet.physics;
  for(let i=1;i<world.carts.length;i++){
   const c=world.carts[i],s=r.course.project(g.player.pos.clone().set(c.x,c.y,c.z)).s,p=r.course.sample(s,-14),f=r.course.tangent(s);
   Object.assign(world.spawns[i],{x:p.x,z:p.z,yaw:Math.atan2(-f.x,-f.z)});Object.assign(rally.homes[i],world.spawns[i]);world.reset(i);
  }
  const step=r.step.bind(r),v=window.cartLandingReview={paused:false,target:'apex',stage:'driving',samples:[],takeoff:null,landed:null,rebounds:0};
  const record=(stage,c)=>{v.stage=stage;v.paused=true;v.samples.push({stage,time:r.elapsed,x:c.x,y:c.y,z:c.z,vy:c.vy,rolls:c.rolls,grounded:c.grounded,compression:c.landingCompression,bodyY:r.carts.fleet.models[r.carts.cartForRacer[0]].body.position.y});};
  r.step=(dt,input)=>{
   if(v.paused)return;
   const c0=r.carts.fleet.physics.carts[r.carts.cartForRacer[0]],wasGrounded=c0?.grounded,oldVy=c0?.vy;
   step(dt,{...input,...(r.phase==='running'?r.drive(0):{})});
   const c=r.carts.fleet.physics.carts[r.carts.cartForRacer[0]];if(!c)return;
   if(wasGrounded&&!c.grounded&&v.takeoff===null&&r.riders[0].progress>100)v.takeoff=r.elapsed;
   if(v.takeoff!==null&&v.target==='apex'&&oldVy>0&&c.vy<=0&&!c.grounded)record('apex',c);
   if(v.target==='landing'&&!wasGrounded&&c.grounded){v.landed=r.elapsed;record('landing',c);}
   if(v.target==='settled'&&v.landed!==null){if(!c.grounded)v.rebounds++;if(r.elapsed-v.landed>=.25)record('settled',c);}
  };
 });
 for(const stage of ['apex','landing','settled']){
  await page.waitForFunction(stage=>window.cartLandingReview.stage===stage,stage,{timeout:60000});
  await page.waitForTimeout(150);await page.evaluate(()=>{const r=window.__game.getSkateRace();window.cartLandingReview.samples.at(-1).bodyY=r.carts.fleet.models[r.carts.cartForRacer[0]].body.position.y;});await page.screenshot({path:`${out}/${stage}-native.png`});
  if(stage==='apex'){
   await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(150);await page.screenshot({path:`${out}/apex-normal.png`});
   await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
  }
  if(stage!=='settled')await page.evaluate(next=>{window.cartLandingReview.target=next;window.cartLandingReview.paused=false;},stage==='apex'?'landing':'settled');
 }
 const report=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),w=r.carts.fleet.physics;return {...window.cartLandingReview,stamp:document.querySelector('.hud-build')?.textContent,gravity:w.gravity,stableLandings:w.stableLandings,falls:r.riders[0].falls,frame:g.getRenderFrameStats(),glError:g.renderer.getContext().getError()};});
 await writeFile(`${out}/report.json`,JSON.stringify({...report,errors},null,2));
 assert.equal(report.stableLandings,true);assert.equal(report.gravity,11.5);assert.equal(report.rebounds,0);assert.equal(report.falls,0);
 assert.ok(report.landed-report.takeoff>1.5,'Full-render dirt jump has floaty airtime');
 assert.ok(report.samples.every(s=>s.rolls===0));assert.ok(report.samples[1].compression>.06,'Heavy touchdown compresses the suspension');
 assert.ok(report.samples[2].compression<.006,'Suspension settles in a quarter second');
 assert.match(report.stamp,/Codex\/sol fork/);assert.equal(report.glError,0);assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({...report,errors},null,2));console.log('PASS native and normal presentation, real dirt jump, firm landing and rapid settle',JSON.stringify(report));
}catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});console.log('ERRORS',errors);throw error;}finally{await browser.close();}
