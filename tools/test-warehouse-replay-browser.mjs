import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const replayBytes=await readFile(new URL('./fixtures/warehouse-bank-collision.json',import.meta.url));
const replay=JSON.parse(replayBytes.toString('utf8'));
const fixture=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/warehouse-bank-collision-level.json.gz',import.meta.url))).toString('utf8'));
assert.equal(fixture.provenance.replay.sha256,createHash('sha256').update(replayBytes).digest('hex'));
const base=process.argv[2]||'http://127.0.0.1:5321/';
const full=process.env.WAREHOUSE_FULL==='1';
const output=process.env.WAREHOUSE_OUTPUT||'/private/tmp/warehouse-collision-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&level=warehouse${full?'':'&lite'}`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
 // Import the exact historical native triangles into this isolated Chrome
 // profile. The current warehouse may have an entirely different layout.
 // Normal level loading prepares collision, camera and interpolation; the
 // subsequent replay runs through the unchanged real main/render loop.
 const fixtureId=await page.evaluate(async fixture=>{
  const g=window.__game,data={...fixture.data,alwaysSkate:true,name:'Warehouse collision fixture'};
  const id=g.saveUserLevel({id:'',name:data.name,data});
  if(!id||!g.findLevel(id))throw Error('Historical fixture import rejected');
  await g.gameFlow.transition(()=>{if(!g.switchLevel(id))throw Error('Historical fixture level switch rejected');g.gameFlow.hide();});
  return id;
 },fixture);
 await page.waitForFunction(id=>window.__game.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,fixtureId,{timeout:120000});
 if(full){await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));await page.waitForTimeout(1000);}
 await page.evaluate(replay=>{
  const g=window.__game,l=g.getLevel();
  if(!l.alwaysSkate||l.warehouseArtEnabled)throw Error('Historical mounted/native fixture was not loaded');
  g.player.endlessDeaths=replay.endlessDeaths;g.player.respawn(l,true);
  g.replayer.begin(replay);window.__warehouseReplaySamples=[];
  const sample=()=>{const p=g.player;window.__warehouseReplaySamples.push({time:performance.now(),frame:g.replayer.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed});
   if(g.replayer.active)window.__warehouseReplayRaf=requestAnimationFrame(sample);};sample();
 },replay);
 await page.waitForFunction(()=>window.__game.replayer.frame>=670,null,{timeout:60000});
 const exit=await page.evaluate(()=>({frame:window.__game.replayer.frame,position:window.__game.player.pos.toArray(),speed:window.__game.player.speed}));
 assert.ok(exit.position[2]<-68&&exit.speed>15,'real browser playback must clear the recorded bank');
 await page.screenshot({path:`${output}/recorded-bank-exit.png`});
 await page.waitForFunction(()=>window.__game.replayer.frame>=750,null,{timeout:30000});
 const result=await page.evaluate(()=>{const g=window.__game;g.replayer.end();cancelAnimationFrame(window.__warehouseReplayRaf);
  return {exit:g.player.pos.toArray(),samples:window.__warehouseReplaySamples,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.ok(result.exit[2]<-95,'the old trapping interval must now continue through the park');assert.deepEqual(errors,[]);
 const intervals=result.samples.slice(6).map((s,i)=>s.time-result.samples[i+5].time).sort((a,b)=>a-b);
 const timing={samples:intervals.length,median:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)]};
 await writeFile(`${output}/replay.json`,JSON.stringify({base,full,historicalFixture:fixture.provenance,fixtureId,...result,timing,errors},null,2));
 console.log('PASS real-time browser replay on frozen historical geometry clears the reported bank without console errors (not current-layout traversal acceptance)',JSON.stringify(timing));
}finally{await browser.close();}
