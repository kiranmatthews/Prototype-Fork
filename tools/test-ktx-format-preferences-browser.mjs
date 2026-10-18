import {mkdir,writeFile} from 'node:fs/promises';
import {strict as assert} from 'node:assert';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RGB_ETC2_Format,RGBA_ASTC_4x4_Format,RGBA_BPTC_Format} from 'three';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.KTX_BROWSER_OUTPUT??join(tmpdir(),'ktx-format-preferences'),url=process.argv.find(arg=>/^https?:/.test(arg))??'http://127.0.0.1:5198/';await mkdir(out,{recursive:true});
const legacy=process.argv.includes('--legacy');let legacyOverrides=0;
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('crash',()=>errors.push('Page crashed'));
 // For a paired production comparison, restore only the original two shared
 // arrays in the fetched bundle. No disk asset or dependency is changed.
 if(legacy)await page.route(/\/assets\/level-[\w-]+\.js(?:\?.*)?$/,async route=>{
  const response=await route.fetch(),source=await response.text();
  const code=source.replace(/\[\.\.\.([\w$]+)\](?=\.sort\(function\([^)]*\)\{return [^}]*\.priority(?:ETC1S|UASTC))/g,(_,name)=>{legacyOverrides++;return name;});
  await route.fulfill({response,body:code});
 });
 await page.addInitScript(()=>{window.contextLosses=0;document.addEventListener('webglcontextlost',()=>window.contextLosses++,true)});
 await page.goto(url+'?playtest&level=jungle-terraces&lite',{timeout:120000,waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:240000});
 await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:15000});
 const report=await page.evaluate(async()=>{const g=window.__game,l=g.getLevel();g.player.step=()=>{};await l.prepareJungleAssets();await l.prepareSurfaceImages();await g.player.preparePresentationAssets();for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);const textures=new Map(),gpuTextures=new Map();g.scene.traverse(o=>{for(const material of [o.material].flat().filter(Boolean))for(const t of Object.values(material)){if(t?.isTexture){const gpu=g.renderer.properties.get(t).__webglTexture,bytes=t.mipmaps?.reduce((sum,m)=>sum+(m.data?.byteLength??0),0)??0;if(gpu&&bytes)gpuTextures.set(gpu,bytes);}if(t?.isTexture&&!textures.has(t.uuid))textures.set(t.uuid,{name:t.name,format:t.format,width:t.image?.width,height:t.image?.height,mips:t.mipmaps?.length,bytes:t.mipmaps?.reduce((sum,m)=>sum+(m.data?.byteLength??0),0)??0});}});return{level:g.getCurrentLevel().id,spawn:g.player.pos.toArray(),grounded:g.player.grounded,textureCount:textures.size,textures:[...textures.values()],uploadedCompressedTextures:gpuTextures.size,uploadedCompressedMipBytes:[...gpuTextures.values()].reduce((sum,bytes)=>sum+bytes,0),loading:g.getLoadingDiagnostics(),render:{...g.renderer.info.render,memory:{...g.renderer.info.memory}},contextLosses:window.contextLosses,support:g.renderer.getContext().getSupportedExtensions().filter(e=>e.includes('texture')&&(e.includes('compression')||e.includes('compressed')))};});
 await page.screenshot({path:out+'/spawn.png'});report.errors=errors;report.legacy=legacy;report.legacyOverrides=legacyOverrides;if(legacy)assert.equal(legacyOverrides,2,'legacy comparison must revert exactly the two priority-list copies');await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);assert.equal(report.contextLosses,0);assert.deepEqual(report.loading.failed,[]);assert.equal(report.level,'jungle-terraces');assert.equal(report.grounded,true);
 const compressed=report.textures.filter(t=>t.bytes),etc=compressed.filter(t=>t.format===RGB_ETC2_Format),astc=compressed.filter(t=>t.format===RGBA_ASTC_4x4_Format);
 if(!legacy&&report.support.includes('WEBGL_compressed_texture_etc')){assert.ok(etc.length>=10,'native ETC1S scenery must use ETC2');if(report.support.includes('WEBGL_compressed_texture_astc'))assert.equal(compressed.filter(t=>t.format===RGBA_BPTC_Format).length,0,'this ETC1S/ASTC fixture must not select BC7 when both native formats are available');}
 if(report.support.includes('WEBGL_compressed_texture_astc'))assert.ok(astc.length>=4,'UASTC must retain ASTC');
 console.log(JSON.stringify({level:report.level,textures:report.textureCount,uploadedCompressedTextures:report.uploadedCompressedTextures,uploadedCompressedMipBytes:report.uploadedCompressedMipBytes,nativeEtcTextures:etc.length,astcTextures:astc.length,errors}));
}finally{await browser.close()}
