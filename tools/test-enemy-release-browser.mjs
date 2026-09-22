// Reproduce a pre-roster app pinned by a cache-first worker, then exercise the
// real save-preserving update page and future Home update discovery.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [currentDir,oldDir]=process.argv.slice(2).map(value=>path.resolve(value));
assert.ok(currentDir&&oldDir,'Usage: node tools/test-enemy-release-browser.mjs <current-dist> <pre-roster-dist>');
const output=process.env.ENEMY_RELEASE_OUTPUT||'/private/tmp/enemy-release';await mkdir(output,{recursive:true});
const engine=process.env.ENEMY_BROWSER||'chromium',results=[],errors=[];
let live=oldDir,future=false;const downloads=[];
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wasm':'application/wasm','.wav':'audio/wav','.mp3':'audio/mpeg','.woff2':'font/woff2','.otf':'font/otf'};
const worker=`const cacheName='solProtoOffline:'+new URL(self.registration.scope).pathname+':legacy-fixture';self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(cacheName);await c.put(new URL('index.html',self.registration.scope),await fetch(new URL('index.html',self.registration.scope),{cache:'no-store'}));await c.put(new URL('__offline_ready__',self.registration.scope),new Response('legacy-fixture'));await self.skipWaiting();})()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'&&(new URL(e.request.url).pathname.endsWith('/')||new URL(e.request.url).pathname.endsWith('/index.html')))e.respondWith(caches.open(cacheName).then(c=>c.match(new URL('index.html',self.registration.scope))));});`;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/__update-wait'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><link rel="icon" href="data:,"><title>Closed game</title>');return;}
 if(!url.pathname.startsWith('/Prototype-Fork/')){res.writeHead(404).end();return;}
 if(url.searchParams.has('__offline_revision'))downloads.push(url.pathname);
 const relative=decodeURIComponent(url.pathname.slice('/Prototype-Fork/'.length))||'index.html';
 if(relative==='legacy-worker.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'}).end(live===oldDir?worker:await readFile(path.join(currentDir,'sw.js')));return;}
 if(relative==='release.json'&&future){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"entry":"assets/index-future.js"}');return;}
 const safe=path.resolve(live,relative);if(!safe.startsWith(live+path.sep)){res.writeHead(403).end();return;}
 try{
  // Old hashed dependencies remain available to the already-running old HTML.
  let bytes;try{bytes=await readFile(safe);}catch(error){if(live!==oldDir&&relative.startsWith('assets/'))bytes=await readFile(path.resolve(oldDir,relative));else throw error;}
  res.writeHead(200,{'Content-Type':mime[path.extname(relative)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/Prototype-Fork/`;
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
try{
 const context=await browser.newContext({viewport:{width:852,height:393},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const watch=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url+' ['+page.url()+']');});};
 let page=await context.newPage();watch(page);
 const ready=async()=>{
  await page.waitForFunction(()=>window.__game?.getLevel().enemies.length===8&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets()]);});
  await page.waitForFunction(()=>window.__game.getLoadingDiagnostics().pending.length===0,null,{timeout:120000});
  await page.waitForLoadState('networkidle');
 };
 const snapshot=()=>page.evaluate(()=>({stamp:document.querySelector('.hud-build').textContent,controlled:!!navigator.serviceWorker.controller,
  enemies:window.__game.getLevel().enemies.map(e=>{let boxes=0,triangles=0;e.group.traverse(o=>{if(o.isMesh){if(o.geometry.type==='BoxGeometry')boxes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return{kind:e.kind,status:e.visual?.diagnostics.status??'legacy',boxes,triangles};})}));
 await page.goto(base+'?lite&playtest&level=jungle');await ready();
 await page.evaluate(async()=>{await navigator.serviceWorker.register('./legacy-worker.js');await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const saved=await page.evaluate(()=>{const g=window.__game;g.campaign.newGame(1);g.renderQualitySettings.setRegularResolution(540);g.crtGuestSettings.setEnabled(false);
  g.saveUserLevel({id:'preserved-enemy-level',name:'My enemy level',data:{v:1,name:'My enemy level',spawn:[0,.1,2],killY:-20,components:[{t:'platform',p:[0,-.5,0],s:[20,1,40]},{t:'enemy',foe:'grunt',p:[0,0,-6]},{t:'gate',p:[0,0,-16]}]}});
  // Preserve an actual pre-roster editor capture as the Jungle override too.
  g.saveUserLevel({id:'jungle',name:'Jungle Ruins',data:g.getLevel().captureData()});
  return Object.fromEntries(['solProtoCampaignSavesV1','solProtoUserLevels','solProtoRenderQuality.v1'].map(k=>[k,localStorage.getItem(k)]));});
 live=currentDir;
 await page.reload();await ready();const stale=await snapshot();
 assert.ok(stale.enemies.every(e=>e.status==='legacy'));assert.ok(stale.enemies.some(e=>e.boxes>0));assert.equal(stale.controlled,true);results.push({phase:'plain-reload-stays-old',...stale});
 const cachesBefore=await page.evaluate(()=>caches.keys()),downloadsBefore=downloads.length;
 await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting,null,{timeout:60000});
 assert.equal(downloads.length,downloadsBefore,'automatic worker update must not download game assets');
 assert.deepEqual(await page.evaluate(()=>caches.keys()),cachesBefore,'automatic update must not allocate a new release cache');
 await page.close();page=await context.newPage();watch(page);
 await page.goto(new URL('/__update-wait',base).href);
 await page.waitForFunction(async base=>{const r=await navigator.serviceWorker.getRegistration(base);return r?.active?.state==='activated'&&!r.waiting;},base,{timeout:60000});
 await page.goto(base+'?lite&playtest&level=jungle');await ready();
 const reopened=await snapshot();assert.ok(reopened.enemies.every(e=>e.status==='ready'&&e.boxes===0));assert.equal(reopened.controlled,true);
 assert.ok(page.url().includes('__game_entry='));
 assert.deepEqual(await page.evaluate(()=>caches.keys()),cachesBefore,'old complete offline copy survives lightweight activation');
 results.push({phase:'app-close-reopen-new-models',...reopened,automaticAssetDownloads:downloads.length-downloadsBefore});
 await page.goto(base+'update-game.html?playtest&level=jungle');
 assert.equal(await page.locator('canvas').count(),0);
 await page.getByRole('button',{name:'Update and open game',exact:true}).click();await ready();
 await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
 const updated=await snapshot();assert.ok(updated.enemies.every(e=>e.status==='ready'&&e.boxes===0));assert.equal(updated.controlled,false);
 const after=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(saved));assert.deepEqual(after,saved);
 assert.ok(await page.evaluate(()=>window.__game.findLevel('preserved-enemy-level')));
 assert.ok(await page.evaluate(()=>!!window.__game.findLevel('jungle').data),'pre-roster Jungle editor override remains installed');
 results.push({phase:'explicit-update-new-models',...updated,savesPreserved:true});
 // Show one actual replacement in the full game, without loading a review model.
 await page.goto(base+'?playtest&level=jungle');await ready();await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
 await page.evaluate(()=>{const g=window.__game,e=g.getLevel().enemies[0];g.player.step=()=>{};const render=g.renderer.render.bind(g.renderer);g.renderer.render=(scene,camera)=>{if(scene===g.scene&&camera===g.camera){camera.position.copy(e.group.position).add({x:2.4,y:1.6,z:3.5});camera.lookAt(e.group.position.x,e.group.position.y+.55,e.group.position.z);}return render(scene,camera);};});
 await page.waitForTimeout(250);await ready();await page.screenshot({path:`${output}/${engine}-jungle-new-enemy.png`});
 await page.close();future=true;
 page=await context.newPage();watch(page);await page.goto(base);
 await page.getByRole('button',{name:'UPDATE GAME',exact:true}).waitFor({timeout:120000});
 await page.screenshot({path:`${output}/${engine}-home-update.png`});
 await page.getByRole('button',{name:'UPDATE GAME',exact:true}).click();await page.waitForURL('**/update-game.html*');
 results.push({phase:'future-update-home-action',url:page.url(),canvasCount:await page.locator('canvas').count()});
 assert.deepEqual(errors,[]);console.log(`${engine}: PASS reproduced old cube enemies after reload, updated to all8 models, preserved saves/custom levels/settings, full Jungle rendering and Home update discovery.`);
}finally{await writeFile(`${output}/${engine}.json`,JSON.stringify({base,results,errors},null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
