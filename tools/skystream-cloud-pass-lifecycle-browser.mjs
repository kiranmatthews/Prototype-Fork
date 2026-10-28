import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5188/',out=process.env.CLOUD_LIFECYCLE_OUTPUT||'/private/tmp/skystream-360p-lifecycle';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const ready=id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id);
 const snapshot=()=>page.evaluate(()=>{const g=window.__game;return {level:g.getCurrentLevel().id,pass:g.cloudPathPass.diagnostics,grounded:g.player.grounded,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],scissored:g.renderer.getScissorTest(),graphics:g.renderer.domElement.dataset.graphicsState,stamp:document.querySelector('.hud-build')?.textContent};});
 await page.goto(base+'?playtest&level=bonus-skystream&lite',{waitUntil:'domcontentloaded'});await ready('bonus-skystream');await page.waitForFunction(()=>window.__game.player.grounded);report.lite=await snapshot();assert.equal(report.lite.pass.height,360);assert.equal(report.lite.pass.clouds,12);
 await page.goto(base+'?playtest&level=bonus-skystream',{waitUntil:'domcontentloaded'});await ready('bonus-skystream');await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});await page.waitForTimeout(800);report.full=await snapshot();assert.equal(report.full.pass.height,360);assert.equal(report.full.pass.clouds,12);await page.screenshot({path:out+'/bonus-native.png'});
 await page.evaluate(()=>window.__game.set2P(true,true));await page.waitForTimeout(900);report.split=await snapshot();assert.equal(report.split.pass.height,360);assert.equal(report.split.scissored,false);await page.screenshot({path:out+'/split-native.png'});await page.evaluate(()=>window.__game.set2P(false));
 await page.evaluate(()=>{window.__cloudRestoreExt=window.__game.renderer.getContext().getExtension('WEBGL_lose_context');window.__cloudRestoreExt.loseContext();});await page.waitForFunction(()=>window.__game.renderer.domElement.dataset.graphicsState==='lost');report.lost=await snapshot();assert.equal(report.lost.pass.width,0);
 await page.waitForTimeout(500);await page.evaluate(()=>window.__cloudRestoreExt.restoreContext());await page.waitForFunction(()=>window.__game.renderer.domElement.dataset.graphicsState==='ready'&&window.__game.cloudPathPass.diagnostics.height===360);await page.waitForTimeout(800);report.restored=await snapshot();await page.screenshot({path:out+'/restored-native.png'});
 await page.evaluate(()=>window.__game.switchLevel('warproom'));await ready('warproom');await page.waitForFunction(()=>window.__game.cloudPathPass.diagnostics.width===0,null,{timeout:15000});report.other=await snapshot();assert.equal(report.other.pass.width,0);assert.equal(report.other.pass.targetBytes,0);
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
