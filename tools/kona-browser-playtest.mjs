import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.KONA_OUTPUT||'/private/tmp/kona-playtest';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${process.env.KONA_URL||'http://127.0.0.1:5283'}/?playtest&level=kona${process.env.KONA_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='kona'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
 // Exercise the real level menu, then the real K/L checkpoint controls.
 await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.locator('.hud-levelplay[title="Kona · PS1"]').click();
 await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded);
 for(let i=0;i<5;i++){
  await page.keyboard.press('KeyL');
  await page.waitForFunction(i=>{const g=window.__game,l=g.getLevel();return l.checkpoints.indexOf(l.activeCheckpoint)===i&&g.player.grounded;},i,{timeout:15000});
 }
 await page.keyboard.press('KeyK');await page.waitForFunction(()=>{const g=window.__game,l=g.getLevel();return g.player.pos.distanceTo(l.checkpoints[3].spawnPos)<1;});
 await page.keyboard.press('KeyL');await page.waitForFunction(()=>{const g=window.__game,l=g.getLevel();return g.player.pos.distanceTo(l.checkpoints[4].spawnPos)<1;});await page.keyboard.press('KeyM');
 await page.evaluate(async()=>{const {installKonaReview}=await import("/tools/kona-review-controller.mjs");await installKonaReview();});
 for(const kind of (process.env.KONA_CASES||'snake,vert,transfer,jump,rail,recovery,finish').split(',')){
  await page.evaluate(kind=>window.startKonaReview(kind),kind);
  await page.waitForFunction(()=>window.konaReview.done,null,{timeout:120000});
  await page.screenshot({path:`${output}/${process.env.KONA_FULL?'full':'lite'}-${kind}.png`});
  const report=await page.evaluate(()=>{const {path,pipe,trace,...r}=window.konaReview;return{...r,trace};});
  await writeFile(`${output}/${kind}.json`,JSON.stringify(report,null,2));const {trace,...brief}=report;reports.push(brief);console.log(JSON.stringify(brief));
  if(process.env.KONA_STRICT){assert.equal(report.failed,undefined,`${kind} did not complete cleanly`);if(kind!=='recovery'){assert.equal(report.deaths,0);assert.equal(report.bails,0);}else assert.equal(report.lives,report.livesBefore-1);if(kind==='jump'){assert.match(report.takeoffFrom,/kicker/);assert.match(report.landedOn,/catcher/);assert.ok(report.lateral<2);}if(kind==='rail')assert.ok(report.grindFrames>15);}
 }
 await writeFile(`${output}/report.json`,JSON.stringify({reports,errors},null,2));assert.deepEqual(errors,[]);
}catch(error){const state=await page.evaluate(()=>{const g=window.__game;return {review:window.konaReview,flow:g?.gameFlow.blocksGameplay,p:g?.player.pos.toArray(),state:g?.player.state,frames:g?.getRenderFrameStats()};}).catch(()=>null);await writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),state,errors},null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
