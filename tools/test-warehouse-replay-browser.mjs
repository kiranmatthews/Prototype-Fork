import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const replay=JSON.parse(await readFile(new URL('./fixtures/warehouse-bank-collision.json',import.meta.url),'utf8'));
const base=process.argv[2]||'http://127.0.0.1:5321/';
const full=process.env.WAREHOUSE_FULL==='1';
const output=process.env.WAREHOUSE_OUTPUT||'/private/tmp/warehouse-collision-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&level=warehouse${full?'':'&lite'}`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
 if(full){await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));await page.waitForTimeout(1000);}
 await page.evaluate(replay=>{
  const g=window.__game,l=g.getLevel();
  // Preserve this recording's mounted spawn so its exact reported edge is
  // tested even though new warehouse sessions now begin on foot.
  l.builtFromData.alwaysSkate=true;g.player.endlessDeaths=replay.endlessDeaths;g.player.respawn(l,true);
  g.replayer.begin(replay);window.__warehouseReplaySamples=[];
  const sample=()=>{const p=g.player;window.__warehouseReplaySamples.push({time:performance.now(),frame:g.replayer.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed});
   if(g.replayer.active)window.__warehouseReplayRaf=requestAnimationFrame(sample);};sample();
 },replay);
 await page.waitForFunction(()=>window.__game.replayer.frame>=670,null,{timeout:60000});
 const exit=await page.evaluate(()=>({frame:window.__game.replayer.frame,position:window.__game.player.pos.toArray(),speed:window.__game.player.speed}));
 assert.ok(exit.position[2]<-68&&exit.speed>15,'real browser playback must clear the recorded bank');
 await page.screenshot({path:`${output}/recorded-bank-exit.png`});
 await page.waitForFunction(()=>window.__game.replayer.frame>=750,null,{timeout:30000});
 const result=await page.evaluate(()=>{const g=window.__game;g.replayer.end();cancelAnimationFrame(window.__warehouseReplayRaf);g.getLevel().builtFromData.alwaysSkate=false;
  return {exit:g.player.pos.toArray(),samples:window.__warehouseReplaySamples,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.ok(result.exit[2]<-95,'the old trapping interval must now continue through the park');assert.deepEqual(errors,[]);
 const intervals=result.samples.slice(6).map((s,i)=>s.time-result.samples[i+5].time).sort((a,b)=>a-b);
 const timing={samples:intervals.length,median:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)]};
 await writeFile(`${output}/replay.json`,JSON.stringify({base,full,...result,timing,errors},null,2));
 console.log('PASS real-time browser replay clears the bank and continues through the park without console errors',JSON.stringify(timing));
}finally{await browser.close();}
