import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(x=>x.startsWith('http'))||'http://127.0.0.1:5193/';
const lite=process.argv.includes('--lite'),final=process.argv.includes('--final');
const out=final?'docs/drowned-crown/final':'docs/drowned-crown/screenshots';
await mkdir(out,{recursive:true});
const sections=JSON.parse(await readFile(new URL('./sections.json',import.meta.url),'utf8'));
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 // Ignore editor snapshots for source review. The final deployment pass checks the pack separately.
 await page.route('**/levels.json*',r=>r.fulfill({contentType:'application/json',body:'{"v":2,"levels":[]}'}));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&level=drowned-crown${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets(),g.getLevel().prepareSurfaceImages()]);});
 const evidence=[];
 for(const section of sections.filter(s=>only?s.id.startsWith(only):!final||['01','04','06','08','10','13'].includes(s.id.slice(0,2)))){
  await page.evaluate(s=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...s.position),heading:g.player.camDir.clone().set(...s.heading)});},section);
  await page.waitForTimeout(1400);
  const sample=await page.evaluate(()=>{const g=window.__game;return{position:g.player.pos.toArray(),grounded:g.player.grounded,state:g.player.state,camera:g.camera.position.toArray(),cameraQuaternion:g.camera.quaternion.toArray(),fov:g.camera.fov,stamp:document.querySelector('.hud-build')?.textContent,frame:g.getRenderFrameStats()};});
  assert.ok(sample.grounded,`${section.id} player must be supported`);assert.equal(sample.state,'ride');
  await page.screenshot({path:`${out}/${section.id}.png`});evidence.push({...section,...sample});
  console.log(section.id,JSON.stringify({position:sample.position,camera:sample.camera}));
 }
 await writeFile(`${out}/views${only?'-'+only:''}.json`,JSON.stringify({mode:lite?'lite':'full',source:'actual game follow camera, supported player, no free camera',views:evidence,errors},null,2)+'\n');
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
