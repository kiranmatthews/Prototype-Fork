import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine=process.env.TOUCH_BROWSER==='webkit'?webkit:chromium;
const base=process.argv[2] || 'http://127.0.0.1:5194/';
const output=process.env.TOUCH_OUTPUT || '/private/tmp/touch-screen-awake-browser';await mkdir(output,{recursive:true});
const browser=await engine.launch({headless:true,...(engine===chromium?{channel:'chrome'}:{})});
const report={engine:engine===webkit?'webkit':'chromium',errors:[]};
try {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${base}?touch&playtest&level=codex-lab&lite`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&!document.body.classList.contains('game-startup-loading'),null,{timeout:120000});
 report.before=await page.evaluate(()=>window.__touch.screenAwake.diagnostics);
 assert.equal(report.before.activated,false);assert.equal(report.before.held,false);
 await page.locator('[data-touch-button="x"]').tap();
 await page.waitForFunction(()=>!window.__touch.screenAwake.diagnostics.pending);
 report.playing=await page.evaluate(()=>window.__touch.screenAwake.diagnostics);
 assert.equal(report.playing.activated,true);assert.equal(report.playing.wanted,true);
 // Record the actual platform grant. A denied policy remains supported input,
 // and deterministic injected tests separately prove permission/error races.
 await page.locator('.tc-pause').tap();await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='pause');
 await page.waitForFunction(()=>!window.__touch.screenAwake.diagnostics.held);
 report.paused=await page.evaluate(()=>window.__touch.screenAwake.diagnostics);assert.equal(report.paused.wanted,false);
 await page.getByRole('button',{name:'RESUME',exact:true}).tap();await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay&&!window.__touch.screenAwake.diagnostics.pending);
 report.resumed=await page.evaluate(()=>window.__touch.screenAwake.diagnostics);assert.equal(report.resumed.wanted,true);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.waitForFunction(()=>!window.__touch.screenAwake.diagnostics.held);
 report.blurred=await page.evaluate(()=>window.__touch.screenAwake.diagnostics);assert.equal(report.blurred.wanted,false);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>!window.__touch.screenAwake.diagnostics.pending);
 report.focused=await page.evaluate(()=>window.__touch.screenAwake.diagnostics);assert.equal(report.focused.wanted,true);
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
 await context.close();
} finally {await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
