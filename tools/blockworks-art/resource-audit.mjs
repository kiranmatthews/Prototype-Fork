// Resource ownership check across real bonus lifecycle transitions.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BLOCKWORKS_URL||'http://127.0.0.1:5187',out='docs/blockworks-art/quality';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(base+'/?playtest&level=codex-lab',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();window.qualityParent=g.getLevel();g.player.step=()=>{};});
 const samples=[];
 for(let cycle=0;cycle<3;cycle++){
  await page.evaluate(()=>window.__game.enterBonusRound());
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='bonus:codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async()=>{await window.__game.getLevel().prepareJungleAssets();window.__game.returnFromBonus(false);});
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.waitForTimeout(6500);
  const sample=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),textures=new Set();
   l.root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(m))if(value?.isCompressedTexture)textures.add(value);});
   return{sameParent:l===window.qualityParent,position:g.player.pos.toArray(),resources:{...g.renderer.info.memory},programs:g.renderer.info.programs.length,
    compressedTextures:textures.size,compressedMipBytes:[...textures].reduce((n,t)=>n+t.mipmaps.reduce((sum,m)=>sum+(m.data?.byteLength??0),0),0),
    inputViews:l.cameraViews.length,presentationViews:l.cameraPresentationViews.length,assets:l.blockworksArtDiagnostics};
  });
  assert.ok(sample.sameParent);assert.equal(sample.inputViews,0);assert.equal(sample.presentationViews,1);assert.ok(sample.compressedTextures>60);
  samples.push(sample);console.log(JSON.stringify({cycle,resources:sample.resources,programs:sample.programs,compressedTextures:sample.compressedTextures}));
 }
 for(const sample of samples.slice(1)){assert.deepEqual(sample.resources,samples[0].resources);assert.equal(sample.programs,samples[0].programs);assert.deepEqual(sample.position,samples[0].position);}
 assert.deepEqual(errors,[]);
 await writeFile(out+'/resource-lifetime.json',JSON.stringify({at:new Date().toISOString(),method:'Three real API entry/abort transitions, frozen player, 6.5-second settled return samples. Resource ownership evidence, not traversal.',samples,errors},null,2)+'\n');
}finally{await browser.close();}
