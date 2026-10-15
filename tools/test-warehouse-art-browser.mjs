import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5320/',out=process.env.WAREHOUSE_OUTPUT||'/private/tmp/warehouse-art-stability';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],rows=[],recoveries=[];let failure=null,wallAudit=null;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const sample=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel(),textures=new Set();g.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
 let compressed=0,estimatedBytes=0;for(const t of textures){if(t.isCompressedTexture&&t.mipmaps?.length){compressed++;estimatedBytes+=t.mipmaps.reduce((n,m)=>n+(m.data?.byteLength??0),0);}else{const image=t.image;if(image?.width&&image?.height)estimatedBytes+=image.width*image.height*4*(t.generateMipmaps?4/3:1);}}
 return {id:g.getCurrentLevel().id,art:l.warehouseDiagnostics,memory:{...g.renderer.info.memory},programs:g.renderer.info.programs.length,programReferences:g.renderer.info.programs.reduce((n,p)=>n+p.usedTimes,0),compressed,sceneTextureBytes:Math.round(estimatedBytes),decoder:g.getSceneryDecoderDiagnostics(),tone:g.renderer.toneMapping,glError:g.renderer.getContext().getError()};});
try{
 await page.goto(`${base}?playtest&level=warehouse`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
 await page.waitForTimeout(6000);const initial=await sample();rows.push(initial);
 assert.ok(initial.art.artReady&&initial.art.loaded.length>=14);assert.equal(initial.art.collectibleModels,5);assert.deepEqual(initial.art.errors,[]);assert.ok(initial.compressed>=40);assert.equal(initial.glError,0);assert.equal(initial.tone,0,'warehouse tone curve must not escape the world pass');
 assert.ok(initial.art.loaded.includes('warehousewalllower')&&initial.art.loaded.includes('warehousewallupper'));
 wallAudit=await page.evaluate(()=>{const l=window.__game.getLevel(),data=l.captureData();let count=0,uvMin=Infinity,uvMax=-Infinity,backingMaps=0;
  l.root.traverse(m=>{if(!m.isMesh)return;if(m.userData.warehouseWall){count+=m.count;const uv=m.geometry.getAttribute('uv');for(let i=0;i<uv.count;i++){uvMin=Math.min(uvMin,uv.getX(i),uv.getY(i));uvMax=Math.max(uvMax,uv.getX(i),uv.getY(i));}}
   if(/Warehouse masonry/.test(data.components[m.userData.editorIdx]?.nm??'')&&m.material.map)backingMaps++;
  });return {count,authored:data.components.filter(c=>c.dkind==='warehousewalllower'||c.dkind==='warehousewallupper').length,uvMin,uvMax,backingMaps,brickRequests:performance.getEntriesByType('resource').filter(e=>/warehouse\/materials\/brick-/.test(e.name)).length};});
 assert.equal(wallAudit.count,wallAudit.authored);assert.ok(wallAudit.count>100);assert.ok(wallAudit.uvMin>=-.001&&wallAudit.uvMax<=1.001);assert.equal(wallAudit.backingMaps,0);assert.equal(wallAudit.brickRequests,0);
 console.log('PASS original Meshy wall atlases, fitted sections, untextured backing and no repeating brick-map requests',JSON.stringify(wallAudit));
 const pixels=await page.evaluate(()=>{const g=window.__game,target=g.getLevel().warehousePresentation.environment,b=new Uint16Array(target.width*target.height*4);g.renderer.readRenderTargetPixels(target,0,0,target.width,target.height,b);let invalid=0;for(const value of b)if((value&31744)===31744)invalid++;return {samples:b.length,invalid};});assert.equal(pixels.invalid,0,'environment convolution remains finite');
 await page.screenshot({path:`${out}/arrival.png`});
 for(const id of ['flats','warehouse','flats','warehouse','flats','warehouse']){
  await page.evaluate(async id=>{const g=window.__game;await g.gameFlow.transition(()=>{if(!g.switchLevel(id))throw Error('level switch rejected');g.gameFlow.hide();});},id);
  await page.waitForTimeout(6000);const row=await sample();rows.push(row);assert.equal(row.glError,0);assert.equal(row.decoder.workers,0,'idle decoder must retire');
  if(id==='warehouse'){assert.ok(row.art.artReady&&row.art.reflectionReady);assert.equal(row.art.collectibleModels,5);assert.deepEqual(row.art.errors,[]);}
  console.log(id,JSON.stringify({memory:row.memory,compressed:row.compressed,textureMiB:row.sceneTextureBytes/1048576,programs:row.programs}));
 }
 const away=rows.filter(r=>r.id==='flats'),returns=rows.filter(r=>r.id==='warehouse').slice(1);
 for(const key of ['textures','geometries']){assert.ok(Math.max(...away.map(r=>r.memory[key]))-Math.min(...away.map(r=>r.memory[key]))<=2,`retired ${key} cannot accumulate`);assert.ok(Math.max(...returns.map(r=>r.memory[key]))-Math.min(...returns.map(r=>r.memory[key]))<=2,`warehouse ${key} residency stays bounded`);}
 assert.ok(away.at(-1).memory.textures<initial.memory.textures-20,'leaving the park releases its textures');
 for(let i=0;i<2;i++){
  const recovery=await page.evaluate(async()=>{const g=window.__game,ext=g.renderer.getContext().getExtension('WEBGL_lose_context');if(!ext)throw Error('missing graphics recovery extension');const position=g.player.pos.toArray();ext.loseContext();await new Promise(r=>setTimeout(r,250));const held=g.frameStats.totalFixedSteps;await new Promise(r=>setTimeout(r,250));const after=g.frameStats.totalFixedSteps;ext.restoreContext();return {held,after,position};});
  assert.equal(recovery.held,recovery.after);await page.waitForFunction(held=>{const g=window.__game;return !g.renderer.getContext().isContextLost()&&g.frameStats.totalFixedSteps>held&&g.getLevel().warehouseDiagnostics?.reflectionReady;},recovery.held,{timeout:60000});
  await page.waitForTimeout(700);recovery.restored=await sample();assert.equal(recovery.restored.glError,0);assert.deepEqual(recovery.restored.art.errors,[]);recoveries.push(recovery);
 }
 for(const viewport of[{width:1920,height:1080},{width:390,height:844}]){await page.setViewportSize(viewport);await page.waitForTimeout(500);await page.screenshot({path:`${out}/view-${viewport.width}.png`});assert.equal((await sample()).glError,0);}
 assert.deepEqual(errors,[]);console.log('PASS complete art, finite reflections, compressed textures, bounded repeated transitions, retired decoder, graphics recovery and responsive rendering');
}catch(error){failure=String(error);throw error;}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,rows,recoveries,wallAudit,errors,failure},null,2));await browser.close();}
