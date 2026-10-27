import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);let module;
try{module=require.resolve('playwright');}catch{module=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(module).href);
const base=process.env.BEACH_BASE??'http://127.0.0.1:5287',out=process.env.BEACH_OUTPUT??'docs/beach-street/kite-controls';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
// This fixture owns DOM keys. A controller used in the visible preview must
// not inject independent presses into the headless validation browser.
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const report={started:new Date().toISOString(),base,errors:[],failed:[],captures:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.failed.push({url:r.url(),status:r.status()});});
const key=async(code,down)=>page.evaluate(({code,down})=>document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true})),{code,down});
const release=async()=>{for(const code of ['Space','KeyF','KeyE','KeyQ','ArrowLeft','ArrowRight','ArrowDown'])await key(code,false);};
const wait=async ms=>page.waitForTimeout(ms);
// Real digital steering corrects the changing wind; fixtures never zero it.
const steerTo=async x=>page.evaluate(x=>{
 clearInterval(window.kiteGuide);
 for(const code of ['ArrowLeft','ArrowRight'])document.body.dispatchEvent(new KeyboardEvent('keyup',{code,key:code,bubbles:true}));
 const down=new Set();
 window.kiteGuide=setInterval(()=>{
  const p=window.__game.player,error=p.state==='grind'?-(p.balance+p.balanceVel*.18)*8:x-p.pos.x-(p.kiteMotion?.lateral??0)*.15;
  for(const [code,wanted] of [['ArrowLeft',error<-.08],['ArrowRight',error>.08]]){
   if(wanted===down.has(code))continue;
   document.body.dispatchEvent(new KeyboardEvent(wanted?'keydown':'keyup',{code,key:code,bubbles:true}));
   if(wanted)down.add(code);else down.delete(code);
  }
 },16);
},x);
const snapshot=async()=>page.evaluate(()=>{const g=window.__game,p=g.player;return {position:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,charge:p.jumpChargeSeconds,diagnostics:p.kiteDiagnostics,stamp:document.querySelector('.hud-build')?.textContent};});
const capture=async(name,view=null)=>{
 await page.evaluate(view=>{window.kiteReview=view;},view);await wait(100);await page.screenshot({path:`${out}/${name}.png`});report.captures.push({name,...await snapshot()});
};
const reset=async(position=null)=>{await page.evaluate(()=>clearInterval(window.kiteGuide));await release();await page.evaluate(position=>{const g=window.__game,p=g.player,l=g.getLevel();
 const placement=position?{position:p.pos.clone().fromArray(position),heading:p.pos.clone().set(0,0,-1)}:undefined;
 p.respawn(l,true,false,placement);p.lives=99;window.kiteReview=null;},position);};
try{
 await page.goto(`${base}/?playtest&level=coastal-street-run`,{waitUntil:'domcontentloaded',timeout:150000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='coastal-street-run'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:150000});
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('coastal-street-run');await g.switchLevel('coastal-street-run');g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();await g.player.preparePresentationAssets();
 g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
 const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{if(args[1]===g.camera&&window.kiteReview){const r=window.kiteReview,p=r.focus??g.player.pos;
 g.camera.position.set(p.x+r.x,p.y+r.y,p.z+r.z);g.camera.lookAt(p.x,p.y+(r.targetY??1.5),p.z+(r.targetZ??0));g.camera.fov=r.fov??48;g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld();}return render(...args);};
 });
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);
 await reset();await wait(1500);report.waiting=await snapshot();assert.equal(report.waiting.diagnostics.started,false);assert.equal(report.waiting.speed,0);
 await capture('waiting-course');await capture('grip-front',{x:0,y:2.5,z:-6});await capture('grip-side',{x:6,y:2.3,z:0});
 report.arms=await page.evaluate(()=>{const p=window.__game.player;return [[p.armL,p.gloveRight.gripSocket],[p.armR,p.gloveLeft.gripSocket]].map(([a,b])=>({shoulder:a.getWorldPosition(p.pos.clone()).toArray(),grip:b.getWorldPosition(p.pos.clone()).toArray()}));});
 assert.ok(report.arms.every(a=>a.grip[2]<a.shoulder[2]-.15));assert.ok((report.arms[0].shoulder[0]-report.arms[1].shoulder[0])*(report.arms[0].grip[0]-report.arms[1].grip[0])>0);
 await page.evaluate(()=>{window.kiteReview=null;});await key('Space',true);await wait(650);report.held=await snapshot();assert.equal(report.held.state,'ride');assert.ok(report.held.speed>4);
 await key('Space',false);await page.waitForFunction(()=>window.__game.player.state==='air');report.released=await snapshot();
 assert.ok(report.released.position[1]>report.held.position[1]);await key('KeyF',true);await page.waitForFunction(()=>window.__game.player.flipT>0);await key('KeyF',false);
 report.flip=await page.evaluate(()=>({name:window.__game.player.flipName,t:window.__game.player.flipT,special:window.__game.player.specialFlip}));assert.ok(report.flip.t>0);assert.equal(report.flip.special,null);
 await capture('charged-flip',{x:5,y:2.8,z:7});
 // Open lane beside the first planter: charge speed, brake, then pay it back.
 await reset([3.8,12.12,15]);await steerTo(3.8);await key('Space',true);await page.waitForFunction(()=>window.__game.player.speed>22.8);
 await key('ArrowDown',true);await page.waitForFunction(()=>window.__game.player.speed<5);report.braking=await snapshot();assert.ok(report.braking.diagnostics.reserve>150);
 await key('ArrowDown',false);await page.waitForFunction(()=>window.__game.player.speed>22);report.boost=await snapshot();assert.ok(report.boost.diagnostics.reserve<report.braking.diagnostics.reserve);
 // Catch the authored beach boundary rail and release a full normal rail jump.
 await reset([7.2,12.95,15]);await steerTo(7.2);await key('KeyE',true);
 await page.waitForFunction(()=>window.__game.player.state==='grind',null,{timeout:10000});
 await key('Space',true);await wait(450);report.grind=await snapshot();assert.equal(report.grind.state,'grind');
 assert.ok(Math.max(...report.grind.diagnostics.gripErrors)<.08);
 await capture('grind',{x:4,y:2.4,z:6});
 report.grindBeforeRelease=await page.evaluate(()=>({state:window.__game.player.state,balance:window.__game.player.balance,charge:window.__game.player.chargeTimer}));
 await key('Space',false);
 await page.waitForFunction(()=>window.__game.player.state==='air');report.grindExit=await snapshot();await key('KeyE',false);
 report.grindExit.launch=await page.evaluate(()=>window.__game.player.vVel);assert.ok(report.grindExit.launch>10);
 // Contact the actual optional pad with no jump input. Hold its existing warp
 // presentation only long enough to inspect the automatically planted feet.
 await reset();const pad=await page.evaluate(()=>window.__game.getLevel().bonusPlatformDiagnostics);
 report.padDefinition=pad;assert.ok(pad&&pad.tilt>1);await reset([pad.x,pad.y-1.8+.12,pad.z+17]);await steerTo(pad.x);
 await page.evaluate(()=>window.__game.setBonusTravelReviewRate(0));await key('KeyF',true);await page.waitForFunction(()=>window.__game.player.kiteDiagnostics.started);await key('KeyF',false);
 await page.waitForFunction(()=>window.__game.player.kiteBonusDocked,null,{timeout:15000});
 await page.waitForFunction(()=>window.__game.getBonusDeparture(),null,{timeout:15000});
 report.pad=await snapshot();assert.ok(Math.max(...report.pad.diagnostics.dock.errors)<.05,JSON.stringify(report.pad));
 await capture('pad-planted',{x:5,y:2.6,z:6,targetY:1});await capture('pad-side',{x:7,y:1.5,z:0,targetY:.9});
 await page.evaluate(()=>window.__game.setBonusTravelReviewRate(1));
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id.startsWith('bonus:'),null,{timeout:120000});report.bonusEntered=true;
 // Return through the existing runtime, then inspect a real fatal planter hit.
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 // Release the pad-approach steering before the transition. The shared input
 // guard deliberately waits for neutral controls after any loading screen.
 await page.evaluate(()=>clearInterval(window.kiteGuide));await release();
 await page.evaluate(()=>window.__game.returnFromBonus(false));await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='coastal-street-run'&&!window.__game.gameFlow.blocksGameplay&&!window.__game.getBonusDeparture(),null,{timeout:120000});
 await wait(100);
 report.bonusReturn=await snapshot();assert.equal(report.bonusReturn.diagnostics.started,false);
 assert.ok(report.bonusReturn.position[2]>pad.z+14,'Failed bonus returns before the entrance for a retry');
 await steerTo(pad.x-2.1);await key('Space',true);
 await page.waitForFunction(z=>window.__game.player.pos.z<z-1||window.__game.player.state==='dead',pad.z);
 assert.equal(await page.evaluate(()=>window.__game.player.kiteBonusDocked),false,'Retry can still be declined');
 await steerTo(3.8);
 await page.waitForFunction(z=>window.__game.player.pos.z<z-17||window.__game.player.state==='dead',pad.z);
 report.bonusReturnExit=await snapshot();assert.notEqual(report.bonusReturnExit.state,'dead','The bonus return has room to steer past the next planter');
 await reset([0,12.12,-50]);await steerTo(0);await key('KeyF',true);await page.waitForFunction(()=>window.__game.player.spinning);
 report.spin=await page.evaluate(()=>window.__game.player.spinning);assert.equal(report.spin,true);await key('KeyF',false);
 await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:15000});
 report.deathStart=await snapshot();await page.evaluate(()=>{const p=window.__game.player;p.respawnTimer=5;window.kiteReview={x:6,y:3.4,z:9,targetY:.7,targetZ:-6,fov:55,focus:{x:p.pos.x,y:p.pos.y,z:p.pos.z}};});
 await capture('death-release',await page.evaluate(()=>window.kiteReview));await wait(550);await capture('death-flyaway',await page.evaluate(()=>window.kiteReview));
 report.deathLater=await snapshot();assert.ok(report.deathLater.diagnostics.flyaway);assert.ok(report.deathLater.diagnostics.fragments.length>=2);
 assert.ok(report.deathLater.diagnostics.fragments[0].position[2]<report.deathStart.diagnostics.fragments[0].position[2]-3);
 await page.waitForFunction(()=>window.__game.player.state==='ride',null,{timeout:15000});const stopped=await snapshot();await wait(800);report.respawn=await snapshot();assert.equal(report.respawn.diagnostics.started,false);assert.ok(Math.abs(stopped.position[2]-report.respawn.position[2])<.01);
 await page.evaluate(()=>{window.kiteReview=null;window.__game.renderQualitySettings.setRegularResolution(480);window.__game.crtGuestSettings.setEnabled(true);});await capture('normal-presentation');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);report.pass=true;
}catch(e){report.pass=false;report.error=e.stack;report.failureState=await snapshot().catch(()=>null);await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{report.finished=new Date().toISOString();await writeFile(`${out}/browser-controls.json`,JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({pass:report.pass,error:report.error,errors:report.errors}));}
