import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(x=>x.startsWith('http'))||'http://127.0.0.1:5193/';
const lite=process.argv.includes('--lite'),final=process.argv.includes('--final');
const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6)??(final?'docs/drowned-crown/final':'docs/drowned-crown/screenshots');
await mkdir(out,{recursive:true});
const sections=JSON.parse(await readFile(new URL('./sections.json',import.meta.url),'utf8'));
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const viewport={width:3840,height:2160};
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 // Visual review uses the game's Max setting: native 4K world and output buffers.
 // Saving a larger screenshot of the default 720p preset is not a 4K review.
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 // Ignore editor snapshots for source review. The final deployment pass checks the pack separately.
 await page.route('**/levels.json*',r=>r.fulfill({contentType:'application/json',body:'{"v":2,"levels":[]}'}));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&renderdiag&level=drowned-crown${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets(),g.getLevel().prepareSurfaceImages()]);});
 const evidence=[];
 for(const section of sections.filter(s=>only?s.id.startsWith(only):true)){
  await page.evaluate(s=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...s.position),heading:g.player.camDir.clone().set(...s.heading)});},section);
  await page.waitForTimeout(1400);
  const sample=await page.evaluate(()=>{const g=window.__game;return{position:g.player.pos.toArray(),grounded:g.player.grounded,state:g.player.state,camera:g.camera.position.toArray(),cameraQuaternion:g.camera.quaternion.toArray(),fov:g.camera.fov,stamp:document.querySelector('.hud-build')?.textContent,frame:g.getRenderFrameStats(),resolution:JSON.parse(document.querySelector('#render-diagnostics').textContent)};});
  assert.ok(sample.grounded,`${section.id} player must be supported`);assert.equal(sample.state,'ride');
  assert.ok(Math.hypot(sample.position[0]-section.position[0],sample.position[2]-section.position[2])<.25,`${section.id} camera must remain at its authored player position`);
  assert.equal(sample.resolution.settings.enabled,false,'Review must use Max/native rendering');
  const native={width:viewport.width,height:viewport.height};
  assert.deepEqual(sample.resolution.drawingBuffer,lite?{width:1920,height:1080}:native);
  if(!lite&&sample.resolution.presentation){
   assert.equal(sample.resolution.presentation.mode,'native');
   assert.equal(sample.resolution.presentation.inputWidth,native.width);
   assert.equal(sample.resolution.presentation.inputHeight,native.height);
   assert.equal(sample.resolution.presentation.outputWidth,native.width);
   assert.equal(sample.resolution.presentation.outputHeight,native.height);
  }
  await page.screenshot({path:`${out}/${section.id}.png`});evidence.push({...section,...sample});
  console.log(section.id,JSON.stringify({position:sample.position,camera:sample.camera,drawingBuffer:sample.resolution.drawingBuffer,presentation:sample.resolution.presentation}));
 }
 await writeFile(`${out}/views${only?'-'+only:''}.json`,JSON.stringify({mode:lite?'lite':'full',reviewResolution:lite?'4K viewport with explicit half-resolution lite buffer':'3840 × 2160 native world and output, Max setting',source:'actual game follow camera, supported player, no free camera',views:evidence,errors},null,2)+'\n');
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
