import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);let pw;
try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href);
const b=await build({entryPoints:['src/levels/puzzle-trilogy.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const gallery={...api.PUZZLE_LEVELS.find(l=>l.id==='crate-primer'),id:'pose-ledge-gallery'};
gallery.data={...gallery.data,components:gallery.data.components.filter(c=>c.nm!=='One-line side-scrolling boundary')};
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out='docs/carlisle-relay/pose-facing',lite=process.argv.includes('--lite'),mode=lite?'lite':'full';
await mkdir(out,{recursive:true});const report={mode,base,errors:[],frames:[]};
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const read=()=>page.evaluate(()=>{const g=window.__game,p=g.player;p.group.updateWorldMatrix(true,true);
 const face=p.pos.clone().set(0,0,1).transformDirection(p.bodyGroup.matrixWorld);face.y=0;face.normalize();
 const inward=p.ledgeNormal.clone().negate();inward.y=0;inward.normalize();
 return{state:p.state,phase:p.ledgePhase,at:p.pos.toArray(),grounded:p.grounded,face:face.toArray(),normal:p.ledgeNormal.toArray(),dot:face.dot(inward),spin:p.spinning,bodyVisible:p.bodyGroup.visible,spinPresentation:p.spinEffectDiagnostics,clip:p.animationClipHint,time:p.runTime,axes:[p.axisF.toArray(),p.axisL.toArray()]};});
const shot=async name=>page.screenshot({path:`${out}/${mode}-ledge-${name}.png`});
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async gallery=>{const g=window.__game;g.campaign.startEphemeral();g.saveUserLevel(gallery);g.switchLevel(gallery.id);await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  const p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(65.47,6.8,0)});p.state='air';p.grounded=false;p.vVel=-1;
  // Release the approach key on the catch frame so the following step does
  // not queue a mantle before the grip/shimmy review. Physics runs normally.
  const step=p.step;p.step=function(...args){step.apply(this,args);if(this.state==='hang'){window.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',code:'ArrowRight',bubbles:true}));g.input.update();this.step=step;}};
 },gallery);
 await page.keyboard.down('ArrowRight');
 await page.waitForFunction(()=>window.__game.player.state==='hang',null,{timeout:10000});
 await page.keyboard.up('ArrowRight');
 for(let i=0;i<8;i++){const r=await read();report.frames.push(r);assert.equal(r.state,'hang');assert.ok(r.dot>.999,JSON.stringify(r));await page.waitForTimeout(16);}
 await shot('grip');
 if(!lite){await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(80);await shot('normal-grip');await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});}
 // Choose the live camera's tangent key; the fixture only removes its
 // side-scroll depth locks to expose this otherwise unchanged gallery lip.
 const shimKey=await page.evaluate(()=>{const p=window.__game.player,n=p.ledgeNormal,f=p.camDir;return Math.abs(-f.z*n.z-f.x*n.x)>Math.abs(f.x*n.z-f.z*n.x)?'ArrowRight':'ArrowUp';});
 await page.keyboard.down(shimKey);const start=await read();await page.waitForTimeout(320);await page.keyboard.up(shimKey);
 const sh=await read();assert.equal(sh.state,'hang');assert.ok(sh.dot>.999);assert.ok(Math.hypot(...sh.at.map((v,i)=>v-start.at[i]))>.2);report.shimmy={start,end:sh};await shot('shimmy');
 await page.keyboard.down('KeyF');await page.waitForTimeout(30);await page.keyboard.up('KeyF');
 let climbed=false;
 for(let i=0;i<80;i++){const r=await read();report.frames.push(r);if(r.state==='hang'){assert.ok(r.dot>.999,JSON.stringify(r));assert.equal(r.spinPresentation.sculptureVisible,false,'rotating spin sculpture hid the ledge-facing rider');assert.equal(r.bodyVisible,true);if(r.phase==='climb'&&!climbed){climbed=true;await shot('mantle');}}
  if(r.grounded&&r.at[0]>66&&r.at[1]>7.9)break;await page.waitForTimeout(16);
 }
 report.finished=await read();assert.ok(climbed&&report.finished.grounded&&report.finished.at[0]>66);
 assert.ok(report.frames.some(r=>r.state==='hang'&&r.spin&&r.bodyVisible&&(lite||r.spinPresentation.characterRingsVisible)),'no visible held-rider attack frame reviewed');
 report.source=await page.evaluate(()=>({build:document.querySelector('.hud-build')?.textContent,canvas:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]}));
 assert.deepEqual(report.errors,[]);console.log('PASS',JSON.stringify({mode,frames:report.frames.length,shimmy:report.shimmy,finished:report.finished,source:report.source,errors:report.errors}));
}catch(e){report.failure={message:e.message,player:await read().catch(()=>null)};throw e;}
finally{for(const k of ['ArrowUp','ArrowRight','KeyF'])await page.keyboard.up(k).catch(()=>{});await writeFile(`${out}/${mode}-ledge-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
