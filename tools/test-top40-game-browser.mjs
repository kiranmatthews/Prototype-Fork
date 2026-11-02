import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5198').replace(/\/$/,''),out=process.argv[3]||'/private/tmp/top40-glb-textures/game';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={base,errors:[],retiredRequests:[],levels:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('request',r=>{if(/pig-matron|pig-guard|pig-oink|pig-squeal|heirloom-shotgun/.test(r.url()))report.retiredRequests.push(r.url());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 const ready=async()=>{await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:60000});};
 await page.goto(base+'/?playtest&lite&level=rooftop-relay',{waitUntil:'domcontentloaded',timeout:180000});await ready();
 report.lite=await page.evaluate(()=>({enemies:window.__game.getLevel().enemies.length,grounded:window.__game.player.grounded}));assert.equal(report.lite.enemies,0);
 for(const id of ['rooftop-relay','treehouse-trail','drowned-crown']){
  await page.goto(base+'/?playtest&level='+id,{waitUntil:'domcontentloaded',timeout:180000});await ready();
  await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
  await page.waitForFunction(()=>window.__game.getLoadingDiagnostics().pending.length===0,null,{timeout:180000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const level=await page.evaluate(()=>{const g=window.__game;return{id:g.getCurrentLevel().id,grounded:g.player.grounded,enemies:g.getLevel().enemies.length,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],triangles:g.renderer.info.render.triangles,stamp:document.querySelector('.hud-build')?.textContent};});
  assert.equal(level.id,id);assert.match(level.stamp,/Codex\/sol fork/);assert.deepEqual(level.buffer,[1440,900]);assert.ok(level.triangles>0);if(id==='rooftop-relay')assert.equal(level.enemies,0);
  await page.screenshot({path:out+'/'+id+'-native.png'});
  await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:out+'/'+id+'-normal.png'});
  report.levels.push(level);console.log(JSON.stringify(level));
 }
 // The only gameplay removal is Rooftop Relay: exercise its checkpoints,
 // missed-roof reset and exit using the real runtime.
 await page.goto(base+'/?playtest&level=rooftop-relay',{waitUntil:'domcontentloaded',timeout:180000});await ready();
 if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('m');
 await page.waitForFunction(()=>window.__game.gameFlow.developerChromeVisible);
 const spawn=await page.evaluate(()=>window.__game.getLevel().currentSpawn.toArray());
 await page.keyboard.press('l');await page.waitForFunction(p=>window.__game.getLevel().currentSpawn.toArray().some((n,i)=>Math.abs(n-p[i])>1),spawn);await page.waitForFunction(()=>window.__game.player.grounded);
 report.checkpoint=await page.evaluate(()=>({active:window.__game.getLevel().checkpoints.filter(c=>c.active).length,enemies:window.__game.getLevel().enemies.length}));assert.ok(report.checkpoint.active>0);assert.equal(report.checkpoint.enemies,0);
 const beforeFall=await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel(),before={deaths:p.totalDeaths,lives:p.lives,endless:p.endlessDeaths};p.pos.set(l.currentSpawn.x+2000,l.killY-5,l.currentSpawn.z);p.vVel=-10;p.grounded=false;p.state='air';p.collapseRenderInterpolation();return before;});
 await page.waitForFunction(before=>{const g=window.__game,p=g.player;return(before.endless?p.totalDeaths===before.deaths+1:p.lives===before.lives-1)&&p.grounded&&!g.gameFlow.blocksGameplay&&p.pos.distanceTo(g.getLevel().currentSpawn)<3;},beforeFall,{timeout:30000});report.respawn=true;
 await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),gate=g.getCurrentLevel().data.components.find(c=>c.t==='gate');g.player.respawn(l,true,false,{position:g.player.pos.clone().set(gate.p[0],gate.p[1]+3,gate.p[2])});});
 await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:30000});report.finish=true;
 assert.deepEqual(report.retiredRequests,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
