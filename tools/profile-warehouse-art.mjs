import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5321/',out=process.env.WAREHOUSE_OUTPUT||'/private/tmp/warehouse-art-baseline';
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],samples=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&level=warehouse`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
 if(process.env.WAREHOUSE_NATIVE==='1'){await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));await page.waitForTimeout(1000);}
 for(const [name,position,heading]of[['arrival',[-42,8.15,23],[0,0,-1]],['street',[12,.15,-45],[0,0,-1]],['halfpipe',[-46,.15,-91],[1,0,0]],['loading-dock',[-45,5.55,-171],[0,0,1]],['service-loft',[26,18.15,-165],[0,0,1]],['roof',[-48,32.15,-93],[1,0,0]]]){
  await page.evaluate(({position,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,true,{position:p.pos.clone().fromArray(position),heading:p.axisF.clone().fromArray(heading)});p.axisF.fromArray(heading);p.axisL.set(p.axisF.z,0,-p.axisF.x);p.camDir.copy(p.axisF);},{position,heading});
  await page.waitForTimeout(1000);
  const result=await page.evaluate(async()=>{const g=window.__game,frames=[];let before=performance.now();for(let i=0;i<120;i++){const now=await new Promise(requestAnimationFrame);if(i>5)frames.push(now-before);before=now;}frames.sort((a,b)=>a-b);const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {median:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],draw:{...g.renderer.info.render},memory:{...g.renderer.info.memory},renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,warehouse:g.getLevel().warehouseDiagnostics??null,stamp:document.querySelector('.hud-build')?.textContent};});
  await page.screenshot({path:`${out}/${name}.png`});samples.push({name,position,...result});console.log(name,result.median,result.p95,result.draw.calls,result.draw.triangles);
 }
}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,errors,samples},null,2));await browser.close();}
