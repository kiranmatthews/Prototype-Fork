import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5321/',out=process.env.WAREHOUSE_OUTPUT||'/private/tmp/warehouse-art-baseline';
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],samples=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&level=warehouse`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded&&window.__game.getLevel().warehouseDiagnostics?.artReady,null,{timeout:120000});
 if(process.env.WAREHOUSE_NATIVE==='1'){await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));await page.waitForTimeout(1000);}
 // Fixed review stations in the current layout. Respawn moves the subject;
 // every capture retains the actual competition camera and post processing.
 for(const [name,position,heading]of[['arrival',[0,3.35,10],[0,0,-1]],['street',[8,.15,-32],[0,0,-1]],['halfpipe',[-31,.15,-30],[0,0,-1]],['loading-dock',[-22,3.35,-117],[1,0,0]],['workshop',[30,4.95,-57],[0,0,-1]],['maintenance',[-35,9.65,-83],[0,0,1]]]){
  await page.evaluate(({position,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,true,{position:p.pos.clone().fromArray(position),heading:p.axisF.clone().fromArray(heading)});p.axisF.fromArray(heading);p.axisL.set(p.axisF.z,0,-p.axisF.x);p.camDir.copy(p.axisF);},{position,heading});
  await page.waitForTimeout(1000);
  const result=await page.evaluate(async()=>{const g=window.__game,frames=[];let before=performance.now();for(let i=0;i<120;i++){const now=await new Promise(requestAnimationFrame);if(i>5)frames.push(now-before);before=now;}frames.sort((a,b)=>a-b);const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {median:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],draw:{...g.renderer.info.render},memory:{...g.renderer.info.memory},renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,warehouse:g.getLevel().warehouseDiagnostics??null,stamp:document.querySelector('.hud-build')?.textContent};});
  await page.screenshot({path:`${out}/${name}.png`});samples.push({name,position,...result});console.log(name,result.median,result.p95,result.draw.calls,result.draw.triangles);
 }
}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,errors,samples},null,2));await browser.close();}
