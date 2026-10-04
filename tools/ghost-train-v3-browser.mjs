// Real keyboard opening, live steam/flicker and renderer diagnostics.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5230').replace(/\/$/,'');
const out=process.env.GHOST_V3_OUTPUT||'/private/tmp/ghost-train-v3-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const report={base,errors,mode:'full renderer; actual keyboard; no actor placement'};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}/?playtest&level=ghost-train`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>window.__game.getLevel().prepareGhostTrainAssets());
 await page.waitForFunction(()=>{const d=window.__game.getLevel().ghostTrainDiagnostics;return Object.values(d.scenery.assets).every(a=>a.status==='ready')&&['stone','floor','timber','bath'].every(k=>d.textures[k]==='ready');});
 await page.screenshot({path:out+'/boarding-start.png'});
 await page.keyboard.down('ArrowUp');
 await page.waitForFunction(()=>18-window.__game.player.pos.z>=25,null,{timeout:20000});
 await page.keyboard.press('KeyF',{delay:90});
 await page.waitForFunction(()=>18-window.__game.player.pos.z>=28,null,{timeout:10000});
 await page.keyboard.down('Space');
 await page.waitForFunction(()=>18-window.__game.player.pos.z>=35,null,{timeout:10000});
 await page.keyboard.up('Space');
 await page.waitForFunction(()=>window.__game.player.state==='air',null,{timeout:5000});
 await page.waitForFunction(()=>window.__game.player.grounded&&18-window.__game.player.pos.z>40.6,null,{timeout:10000});
 await page.keyboard.up('ArrowUp');await page.keyboard.down('KeyQ');await page.keyboard.press('KeyF',{delay:90});
 await page.waitForFunction(()=>Math.abs(window.__game.player.speed)<.1,null,{timeout:15000});await page.keyboard.up('KeyQ');
 report.opening=await page.evaluate(()=>{const g=window.__game;return{position:g.player.pos.toArray(),state:g.player.state,grounded:g.player.grounded,deaths:g.player.totalDeaths,bailing:g.player.isBailing,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.opening.deaths,0);assert.equal(report.opening.bailing,false);assert.equal(report.opening.grounded,true);assert.match(report.opening.stamp,/Codex\/sol fork/);
 const samples=[];
 for(let i=0;i<42;i++){
  samples.push(await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),steam=g.scene.getObjectByName('Bounded drifting green steam'),signs=[];g.scene.traverse(o=>{if(o.name==='Failing neon ride sign')signs.push(o.material.opacity);});return{time:steam.material.uniforms.time.value,steam:steam.count,firstCloud:Array.from(steam.instanceMatrix.array.slice(12,15)),lights:l.ghostTrainDiagnostics.scenery.lightTargets.map(x=>x.power),signs,frameMs:g.frameStats.rawDt*1000};}));
  await page.waitForTimeout(200);
 }
 const last=samples.at(-1),first=samples[0],signs=samples.map(s=>s.signs[0]);
 assert.ok(last.time-first.time>1);assert.ok(samples.every(s=>s.steam>0&&s.steam<=128));assert.notDeepEqual(last.firstCloud,first.firstCloud);
 assert.ok(Math.max(...signs)-Math.min(...signs)>.2,'neon did not visibly flicker through its native cycle');
 report.effects={seconds:last.time-first.time,steamPeak:Math.max(...samples.map(s=>s.steam)),neonRange:[Math.min(...signs),Math.max(...signs)],meanFrameMs:samples.reduce((n,s)=>n+s.frameMs,0)/samples.length};
 report.assets=await page.evaluate(()=>window.__game.getLevel().ghostTrainDiagnostics);
 await page.screenshot({path:out+'/opening-after-jump.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({opening:report.opening,effects:report.effects,errors,out}));
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
